"""Reka Vision — Screenshot scam analysis.

VALIDATED SDK (v3.2.0):
  pip install reka-api
  from reka.client import Reka
  from reka import ChatMessage
  response.responses[0].message (NOT .message.content)
  model: "reka-flash"
  image_url must be a fetchable URL or data:image/...;base64,... URI
  Local file paths DO NOT work — must convert to base64 first.
"""
import os
import json
import base64
import mimetypes
from reka.client import Reka
from reka import ChatMessage

_client = None

def _get_client() -> Reka | None:
    global _client
    key = os.getenv("REKA_API_KEY")
    if not key:
        return None
    if _client is None:
        _client = Reka(api_key=key)
    return _client


def _to_image_url(image_path_or_url: str) -> str:
    """Convert a local file path to a base64 data URI, or return URL as-is."""
    if image_path_or_url.startswith(("http://", "https://", "data:")):
        return image_path_or_url

    # Local file — convert to base64 data URI
    if not os.path.exists(image_path_or_url):
        raise FileNotFoundError(f"Image not found: {image_path_or_url}")

    mime, _ = mimetypes.guess_type(image_path_or_url)
    if not mime:
        mime = "image/png"  # default

    with open(image_path_or_url, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    return f"data:{mime};base64,{b64}"


def analyze_screenshot(image_url: str) -> dict:
    """Analyze a screenshot for scam indicators using Reka Vision."""
    client = _get_client()
    if not client:
        raise RuntimeError("REKA_API_KEY not configured")

    # Convert local file paths to base64 data URIs
    resolved_url = _to_image_url(image_url)

    response = client.chat.create(
        model="reka-flash",
        messages=[
            ChatMessage(
                role="user",
                content=[
                    {"type": "image_url", "image_url": resolved_url},
                    {
                        "type": "text",
                        "text": """Analyze this screenshot for scam/phishing indicators.

Return JSON with these fields:
{
  "logos_detected": [{"brand": "...", "looks_legitimate": true/false, "reasoning": "..."}],
  "urls_visible": ["..."],
  "urgency_cues": ["countdown timer", "warning banner", "threatening language"],
  "layout_suspicious": true/false,
  "layout_reasoning": "...",
  "text_content": "all readable text extracted from the image",
  "scam_confidence": 0-100,
  "red_flags": ["mismatched sender domain", "fake logo", "..."],
  "impersonated_brand": "Amazon" or null,
  "phone_numbers_visible": ["..."],
  "typosquatting_urls": ["amaz0n.support.com"]
}

If this is not a screenshot of a message/email/website, return scam_confidence: 0."""
                    }
                ],
            )
        ],
    )

    raw_msg = response.responses[0].message
    # SDK v3.2.0: .message is a ChatMessage object, text is in .content
    raw = raw_msg.content if hasattr(raw_msg, "content") else str(raw_msg)
    # Try to parse JSON from the response
    try:
        # Strip markdown code fences if present
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
            # Also handle ```json ... ```
            if text.strip().startswith("json"):
                text = text.strip()[4:]
        return json.loads(text.strip())
    except (json.JSONDecodeError, IndexError):
        return {
            "raw_analysis": raw,
            "scam_confidence": 0,
            "red_flags": [],
            "text_content": raw,
        }
