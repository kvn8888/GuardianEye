"""Reka Vision — Screenshot scam analysis (Gemini 3 Flash fallback).

Primary: Reka Flash for visual phishing analysis.
Fallback: Gemini 3 Flash multimodal vision when Reka is unavailable.
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
    """Analyze a screenshot for scam indicators. Tries Reka Vision, falls back to Gemini."""
    import concurrent.futures

    client = _get_client()
    if client:
        # Give Reka 15 seconds max, then switch to Gemini
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_analyze_with_reka, client, image_url)
            try:
                return future.result(timeout=15)
            except concurrent.futures.TimeoutError:
                future.cancel()
                print("⚠  Reka Vision timed out after 15s, falling back to Gemini")
            except Exception as e:
                print(f"⚠  Reka Vision failed: {e}, falling back to Gemini")

    # Fallback to Gemini 3 Flash vision
    return _analyze_with_gemini(image_url)


# ── Prompt shared by both engines ───────────────────────────

_VISION_PROMPT = """Analyze this screenshot for scam/phishing indicators.

Return ONLY valid JSON (no markdown, no code fences):
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


def _parse_vision_response(raw: str) -> dict:
    """Parse JSON from a vision model response, stripping code fences if present."""
    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
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


# ── Reka Vision (primary) ──────────────────────────────────

def _analyze_with_reka(client: Reka, image_url: str) -> dict:
    """Primary: Reka Flash vision analysis."""
    resolved_url = _to_image_url(image_url)

    response = client.chat.create(
        model="reka-flash",
        messages=[
            ChatMessage(
                role="user",
                content=[
                    {"type": "image_url", "image_url": resolved_url},
                    {"type": "text", "text": _VISION_PROMPT},
                ],
            )
        ],
    )

    raw_msg = response.responses[0].message
    raw = raw_msg.content if hasattr(raw_msg, "content") else str(raw_msg)
    result = _parse_vision_response(raw)
    result["analyzed_by"] = "reka-flash"
    return result


# ── Gemini 3 Flash Vision (fallback) ───────────────────────

def _analyze_with_gemini(image_url: str) -> dict:
    """Fallback: Gemini 3 Flash multimodal vision analysis."""
    from google import genai

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise RuntimeError("Neither REKA_API_KEY nor GEMINI_API_KEY configured for vision")

    client = genai.Client(api_key=gemini_key)

    # Build content parts — upload file or use URL
    if image_url.startswith(("http://", "https://")):
        # Remote URL — pass inline
        parts = [
            {"inline_data": {"mime_type": "image/png", "data": _url_to_base64(image_url)}},
            _VISION_PROMPT,
        ]
    elif image_url.startswith("data:"):
        # Already a data URI — extract base64
        mime, b64 = image_url.split(";base64,", 1)
        mime_type = mime.replace("data:", "")
        parts = [
            {"inline_data": {"mime_type": mime_type, "data": b64}},
            _VISION_PROMPT,
        ]
    else:
        # Local file — upload
        uploaded = client.files.upload(file=image_url)
        parts = [uploaded, _VISION_PROMPT]

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=parts,
        config={"response_mime_type": "application/json"},
    )

    result = _parse_vision_response(response.text)
    result["analyzed_by"] = "gemini-flash-fallback"
    return result


def _url_to_base64(url: str) -> str:
    """Fetch a URL and return its content as base64."""
    import httpx
    resp = httpx.get(url, timeout=30)
    resp.raise_for_status()
    return base64.b64encode(resp.content).decode()
