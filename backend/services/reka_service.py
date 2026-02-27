"""Reka Vision — Screenshot scam analysis.

VALIDATED SDK:
  pip install reka-api
  from reka.client import Reka
  from reka import ChatMessage
  response.responses[0].message (NOT .message.content)
  model: "reka-flash"
"""
import os
import json
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


def analyze_screenshot(image_url: str) -> dict:
    """Analyze a screenshot for scam indicators using Reka Vision."""
    client = _get_client()
    if not client:
        raise RuntimeError("REKA_API_KEY not configured")

    response = client.chat.create(
        model="reka-flash",
        messages=[
            ChatMessage(
                role="user",
                content=[
                    {"type": "image_url", "image_url": image_url},
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

    raw = response.responses[0].message
    # Try to parse JSON from the response
    try:
        # Strip markdown code fences if present
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
        return json.loads(text)
    except (json.JSONDecodeError, IndexError):
        return {
            "raw_analysis": raw,
            "scam_confidence": 0,
            "red_flags": [],
            "text_content": raw,
        }
