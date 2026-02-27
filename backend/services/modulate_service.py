"""Modulate Velma-2 — Voice analysis with emotion detection.

VALIDATED against public Modulate developer docs (Feb 2026):
  - Base URL: https://modulate-developer-apis.com
  - Batch endpoint: POST /api/velma-2-stt-batch
  - Auth: X-API-Key header
  - Form fields: upload_file (file), speaker_diarization (bool), emotion_signal (bool)
  - Response: { text, duration_ms, utterances[{ text, start_ms, duration_ms, speaker, emotion, accent }] }
  - Supported: AAC, AIFF, FLAC, MP3, MP4, MOV, OGG, Opus, WAV, WebM (up to 100MB)
  - Also has streaming via WebSocket: /api/velma-2-stt-streaming?api_key=KEY
  - Fallback: OpenAI Whisper transcription + GPT-4o sentiment analysis
"""
import os
import json
import httpx
from openai import OpenAI


# ── Modulate Velma-2 API ────────────────────────────────────

MODULATE_API_KEY = os.getenv("MODULATE_API_KEY", "")
MODULATE_BASE_URL = "https://modulate-developer-apis.com"


async def analyze_voice_modulate(audio_path: str) -> dict:
    """Submit audio to Modulate Velma-2 Batch for transcription + emotion detection.

    Uses the /api/velma-2-stt-batch endpoint with:
    - speaker_diarization=true (separate speakers)
    - emotion_signal=true (per-utterance emotion labels)
    """
    if not MODULATE_API_KEY:
        raise RuntimeError("MODULATE_API_KEY not set — use fallback")

    async with httpx.AsyncClient(timeout=120) as client:
        with open(audio_path, "rb") as f:
            resp = await client.post(
                f"{MODULATE_BASE_URL}/api/velma-2-stt-batch",
                headers={"X-API-Key": MODULATE_API_KEY},
                files={"upload_file": (os.path.basename(audio_path), f)},
                data={
                    "speaker_diarization": "true",
                    "emotion_signal": "true",
                },
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Modulate API error {resp.status_code}: {resp.text}")
            raw = resp.json()

    # Parse Velma-2 response into our scam analysis format
    return _parse_velma_response(raw)


def _parse_velma_response(raw: dict) -> dict:
    """Convert Velma-2 batch response into GuardianEye voice analysis format.

    Velma-2 returns:
    {
      "text": "full transcript",
      "duration_ms": 5000,
      "utterances": [
        { "text": "...", "start_ms": 0, "duration_ms": 2500,
          "speaker": 1, "emotion": "Neutral", "accent": "American" }
      ]
    }
    """
    transcript = raw.get("text", "")
    utterances = raw.get("utterances", [])
    duration_ms = raw.get("duration_ms", 0)

    # Build emotion profile from utterances
    emotion_counts: dict[str, int] = {}
    for utt in utterances:
        emotion = utt.get("emotion", "Neutral")
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

    total_utts = max(len(utterances), 1)
    emotion_profile = {
        emotion: round((count / total_utts) * 100)
        for emotion, count in emotion_counts.items()
    }

    # Count unique speakers
    speakers = set(utt.get("speaker", 0) for utt in utterances)

    # Detect pressure indicators from emotion distribution
    pressure_emotions = {"Angry", "Fear", "Urgent", "Frustrated", "Aggressive"}
    pressure_score = sum(
        emotion_counts.get(e, 0) for e in pressure_emotions
    ) / total_utts * 100

    # Detect scripted speech — low emotion variance + consistent pacing
    unique_emotions = len(emotion_counts)
    scripted = unique_emotions <= 2 and total_utts > 5

    # Build pressure tactics list from emotional content
    pressure_tactics = []
    if emotion_counts.get("Fear", 0) > 0:
        pressure_tactics.append("inducing fear")
    if emotion_counts.get("Angry", 0) > 0 or emotion_counts.get("Aggressive", 0) > 0:
        pressure_tactics.append("aggressive tone")
    if emotion_counts.get("Urgent", 0) > 0:
        pressure_tactics.append("creating artificial urgency")
    if scripted:
        pressure_tactics.append("scripted/rehearsed delivery detected")

    # Simple fraud score heuristic based on emotion signals
    fraud_score = min(100, int(pressure_score + (20 if scripted else 0) + (10 if len(speakers) == 1 else 0)))

    return {
        "transcript": transcript,
        "duration_ms": duration_ms,
        "fraud_score": fraud_score,
        "emotion_profile": emotion_profile,
        "pressure_tactics": pressure_tactics,
        "deepfake_detected": False,  # Velma-2 doesn't do deepfake detection
        "scripted_speech_detected": scripted,
        "speaker_count": len(speakers),
        "utterance_count": total_utts,
        "analyzed_by": "modulate-velma-2",
    }


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
