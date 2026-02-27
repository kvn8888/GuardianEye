"""Modulate Velma — Voice fraud analysis.

VALIDATED:
  - NO public Python SDK on PyPI
  - NO documented REST API
  - ToxMod SDK is C/C++ for game engines
  - preview.modulate.ai accepts audio uploads (up to 50MB)
  - Supported formats: .aac .flac .m4a .mp3 .mp4 .ogg .opus .wav .webm
  - Must get API access from Modulate reps at hackathon
  - Fallback: OpenAI Whisper transcription + GPT-4o sentiment analysis
"""
import os
import json
import httpx
from openai import OpenAI


# ── Modulate Velma (if access is granted at hackathon) ──────

MODULATE_API_KEY = os.getenv("MODULATE_API_KEY", "")
# Endpoint TBD — get from Modulate team at event
MODULATE_ENDPOINT = os.getenv("MODULATE_API_URL", "https://api.modulate.ai/v1/analyze")


async def analyze_voice_modulate(audio_path: str) -> dict:
    """Submit audio to Modulate Velma for fraud analysis.

    WARNING: This endpoint is a placeholder. The actual URL and auth
    must be confirmed with Modulate reps at the hackathon.
    If Modulate access is unavailable, use analyze_voice_fallback() instead.
    """
    if not MODULATE_API_KEY:
        raise RuntimeError("MODULATE_API_KEY not set — use fallback")

    async with httpx.AsyncClient(timeout=60) as client:
        with open(audio_path, "rb") as f:
            resp = await client.post(
                MODULATE_ENDPOINT,
                headers={"Authorization": f"Bearer {MODULATE_API_KEY}"},
                files={"audio": (os.path.basename(audio_path), f)},
                data={
                    "analysis_types": "fraud_detection,emotion,toxicity,deepfake"
                },
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Modulate API error {resp.status_code}: {resp.text}")
            return resp.json()


# ── OpenAI Fallback (guaranteed to work) ────────────────────

def analyze_voice_fallback(audio_path: str) -> dict:
    """Fallback: Whisper transcription + GPT-4o scam/pressure analysis.
    Use this if Modulate API access is not available.
    """
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        raise RuntimeError("Neither MODULATE_API_KEY nor OPENAI_API_KEY configured")

    client = OpenAI(api_key=openai_key)

    # Step 1: Transcribe with Whisper
    with open(audio_path, "rb") as f:
        transcript_resp = client.audio.transcriptions.create(
            model="whisper-1", file=f
        )
    transcript = transcript_resp.text

    # Step 2: Analyze transcript for scam signals
    analysis_resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are an expert fraud analyst. Analyze phone call transcripts for scam indicators.",
            },
            {
                "role": "user",
                "content": f"""Analyze this phone call transcript for scam indicators:

"{transcript}"

Return JSON:
{{
  "transcript": "...",
  "fraud_score": 0-100,
  "emotion_profile": {{"urgency": 0-100, "fear": 0-100, "authority": 0-100, "friendliness": 0-100}},
  "pressure_tactics": ["creating artificial urgency", "impersonating authority"],
  "deepfake_detected": false,
  "scam_type": "tech_support" | "irs" | "bank_fraud" | "romance" | "prize" | "unknown",
  "red_flags": ["caller demanded immediate payment", "threatened arrest"],
  "scripted_speech_detected": true/false,
  "analyzed_by": "openai-fallback"
}}""",
            },
        ],
        response_format={"type": "json_object"},
    )

    raw = analysis_resp.choices[0].message.content
    try:
        result = json.loads(raw)
        result["transcript"] = transcript
        result["analyzed_by"] = "openai-fallback"
        return result
    except json.JSONDecodeError:
        return {
            "transcript": transcript,
            "fraud_score": 0,
            "emotion_profile": {},
            "pressure_tactics": [],
            "deepfake_detected": False,
            "analyzed_by": "openai-fallback",
            "raw_analysis": raw,
        }


# ── Unified entry point ────────────────────────────────────

async def analyze_voice(audio_path: str) -> dict:
    """Try Modulate first, fall back to OpenAI Whisper + GPT-4o."""
    if MODULATE_API_KEY:
        try:
            return await analyze_voice_modulate(audio_path)
        except Exception as e:
            print(f"⚠  Modulate failed: {e}, falling back to OpenAI")

    # Run sync fallback in thread
    import asyncio
    return await asyncio.to_thread(analyze_voice_fallback, audio_path)
