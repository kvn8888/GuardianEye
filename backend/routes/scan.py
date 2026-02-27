"""Scan routes — Image, Voice, Text submission and analysis pipeline."""
import os
import uuid
import json
import asyncio
import tempfile
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from sse_starlette.sse import EventSourceResponse
from models.schemas import ScanOut, Verdict, VisualAnalysis, VoiceAnalysis, ExtractedEntity

router = APIRouter()

# In-memory store for scan state (replace with Redis in prod)
_scans: dict[str, dict] = {}
_scan_events: dict[str, list] = {}


def _emit(scan_id: str, event_type: str, data: dict):
    """Push an SSE event to the scan's event queue."""
    if scan_id not in _scan_events:
        _scan_events[scan_id] = []
    _scan_events[scan_id].append({"event": event_type, "data": json.dumps(data)})


async def _replay_cached(scan_id: str, cached: dict):
    """Replay cached SSE events with staggered delays for animation."""
    sse_events = cached.get("sse_events") or []
    result = cached["result"]

    # Timing: simulate the pipeline visually
    step_delays = {
        "scan_started": 0.1,
        "step": 0.3,
        "reka_complete": 0.8,
        "gliner_complete": 0.6,
        "voice_complete": 0.8,
        "tavily_complete": 0.7,
        "yutori_complete": 0.5,
        "verdict": 0.4,
        "complete": 0.2,
    }

    if sse_events:
        # Replay the exact SSE events from the original run
        for evt in sse_events:
            delay = step_delays.get(evt.get("event", ""), 0.3)
            await asyncio.sleep(delay)
            _emit(scan_id, evt["event"], json.loads(evt["data"]) if isinstance(evt["data"], str) else evt["data"])
    else:
        # No stored events — just emit start + complete
        _emit(scan_id, "scan_started", {"scan_id": scan_id, "type": result.get("type", "text"), "cached": True})
        await asyncio.sleep(0.5)
        if result.get("verdict"):
            _emit(scan_id, "verdict", result["verdict"])
        await asyncio.sleep(0.3)
        _emit(scan_id, "complete", {"scan_id": scan_id, "cached": True})

    # Store in memory
    _scans[scan_id] = result


# ── POST /api/scan/image ────────────────────────────────────

@router.post("/scan/image", response_model=ScanOut)
async def scan_image(
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
):
    """Submit a screenshot for visual scam analysis. Accepts file upload or URL."""
    from services import cache_service

    if not image and not image_url:
        raise HTTPException(400, "Provide image file or image_url")

    scan_id = f"scan-{uuid.uuid4().hex[:12]}"
    _scans[scan_id] = {"status": "processing", "type": "image"}
    _emit(scan_id, "scan_started", {"scan_id": scan_id, "type": "image"})

    # Compute content hash for caching
    content_hash = None
    url = image_url
    if image and not url:
        image_bytes = await image.read()
        content_hash = cache_service.hash_image_bytes(image_bytes)
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(image.filename or ".png")[1])
        tmp.write(image_bytes)
        tmp.close()
        url = tmp.name
    elif image_url:
        content_hash = cache_service.hash_text(image_url)

    # Check cache
    if content_hash:
        cached = cache_service.get_cached(content_hash)
        if cached:
            asyncio.create_task(_replay_cached(scan_id, cached))
            return ScanOut(scan_id=scan_id, status="processing")

    # Fire pipeline in background
    asyncio.create_task(_run_image_pipeline(scan_id, url or "", content_hash))

    return ScanOut(scan_id=scan_id, status="processing")


async def _run_image_pipeline(scan_id: str, image_url: str, content_hash: str | None = None):
    """Full image scan pipeline: Reka → GLiNER → Tavily → Yutori → verdict."""
    from services import reka_service, gliner_service, tavily_service, yutori_service, openai_service, neo4j_service, cache_service

    # Step 1: Reka Vision analysis
    _emit(scan_id, "step", {"step": "reka_vision", "status": "running"})
    try:
        visual = await asyncio.to_thread(reka_service.analyze_screenshot, image_url)
    except Exception as e:
        visual = {"error": str(e), "scam_confidence": 0}
    _emit(scan_id, "reka_complete", {"visual": visual})

    # Step 2: GLiNER entity extraction on extracted text
    text_content = visual.get("text_content", "")
    _emit(scan_id, "step", {"step": "gliner_extract", "status": "running"})
    entities_raw = await gliner_service.extract_scam_entities(text_content)
    entities = entities_raw.get("entities", [])
    _emit(scan_id, "gliner_complete", {"entities": entities})

    # Step 3: Tavily quick reputation check (fast, 1-2s)
    _emit(scan_id, "step", {"step": "tavily_search", "status": "running"})
    tavily_results = await tavily_service.check_all_entities(entities)
    _emit(scan_id, "tavily_complete", {"results": tavily_results})

    # Step 4: Yutori deep research (slower, 30-60s)
    _emit(scan_id, "step", {"step": "yutori_research", "status": "running"})
    try:
        yutori_results = await yutori_service.research_all_entities(entities)
    except Exception:
        yutori_results = []
    _emit(scan_id, "yutori_complete", {"results": yutori_results})

    # Step 5: OpenAI verdict synthesis
    _emit(scan_id, "step", {"step": "verdict", "status": "running"})
    verdict = await asyncio.to_thread(
        openai_service.synthesize_verdict,
        visual_analysis=visual,
        entities=entities,
        tavily_results=tavily_results,
        yutori_results=yutori_results,
        raw_text=text_content,
    )
    _emit(scan_id, "verdict", verdict)

    # Step 6: Store in Neo4j
    await neo4j_service.create_scan_report(scan_id, "image", verdict)
    for ent in entities:
        await neo4j_service.add_entity_to_scan(scan_id, ent.get("text", ""), ent.get("label", ""))
    for tv in tavily_results:
        for src in tv.get("sources", []):
            await neo4j_service.add_evidence(scan_id, tv.get("entity", ""), {**src, "found_by": "tavily"})

    # Done
    final_result = {
        "status": "complete",
        "type": "image",
        "verdict": verdict,
        "visual": visual,
        "entities": entities,
    }
    _scans[scan_id] = final_result
    _emit(scan_id, "complete", {"scan_id": scan_id})

    # Cache the result
    if content_hash:
        cache_service.store_result(
            content_hash, "image", final_result,
            sse_events=_scan_events.get(scan_id),
            input_preview=image_url[:200],
        )


# ── POST /api/scan/voice ────────────────────────────────────

@router.post("/scan/voice", response_model=ScanOut)
async def scan_voice(
    audio: Optional[UploadFile] = File(None),
    audio_url: Optional[str] = Form(None),
):
    """Submit a voice recording for fraud analysis."""
    from services import cache_service

    if not audio and not audio_url:
        raise HTTPException(400, "Provide audio file or audio_url")

    scan_id = f"scan-{uuid.uuid4().hex[:12]}"
    _scans[scan_id] = {"status": "processing", "type": "voice"}
    _emit(scan_id, "scan_started", {"scan_id": scan_id, "type": "voice"})

    # Compute content hash for caching
    content_hash = None
    audio_path = ""
    if audio:
        audio_bytes = await audio.read()
        content_hash = cache_service.hash_image_bytes(audio_bytes)  # works for any bytes
        ext = os.path.splitext(audio.filename or ".wav")[1]
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        tmp.write(audio_bytes)
        tmp.close()
        audio_path = tmp.name
    elif audio_url:
        content_hash = cache_service.hash_text(audio_url)

    # Check cache
    if content_hash:
        cached = cache_service.get_cached(content_hash)
        if cached:
            asyncio.create_task(_replay_cached(scan_id, cached))
            return ScanOut(scan_id=scan_id, status="processing")

    asyncio.create_task(_run_voice_pipeline(scan_id, audio_path or audio_url or "", content_hash))
    return ScanOut(scan_id=scan_id, status="processing")


async def _run_voice_pipeline(scan_id: str, audio_path: str, content_hash: str | None = None):
    """Full voice scan pipeline: Modulate → GLiNER → Tavily → Yutori → verdict."""
    from services import modulate_service, gliner_service, tavily_service, yutori_service, openai_service, neo4j_service, cache_service

    # Step 1: Modulate/fallback voice analysis
    _emit(scan_id, "step", {"step": "voice_analysis", "status": "running"})
    try:
        voice = await modulate_service.analyze_voice(audio_path)
    except Exception as e:
        voice = {"error": str(e), "fraud_score": 0, "transcript": ""}
    _emit(scan_id, "voice_complete", {"voice": voice})

    # Step 2: GLiNER entity extraction on transcript
    transcript = voice.get("transcript", "")
    _emit(scan_id, "step", {"step": "gliner_extract", "status": "running"})
    entities_raw = await gliner_service.extract_scam_entities(transcript)
    entities = entities_raw.get("entities", [])
    _emit(scan_id, "gliner_complete", {"entities": entities})

    # Step 3: Tavily quick check
    _emit(scan_id, "step", {"step": "tavily_search", "status": "running"})
    tavily_results = await tavily_service.check_all_entities(entities)
    _emit(scan_id, "tavily_complete", {"results": tavily_results})

    # Step 4: Yutori deep research
    _emit(scan_id, "step", {"step": "yutori_research", "status": "running"})
    try:
        yutori_results = await yutori_service.research_all_entities(entities)
    except Exception:
        yutori_results = []
    _emit(scan_id, "yutori_complete", {"results": yutori_results})

    # Step 5: Verdict
    _emit(scan_id, "step", {"step": "verdict", "status": "running"})
    verdict = await asyncio.to_thread(
        openai_service.synthesize_verdict,
        voice_analysis=voice,
        entities=entities,
        tavily_results=tavily_results,
        yutori_results=yutori_results,
        raw_text=transcript,
    )
    _emit(scan_id, "verdict", verdict)

    # Step 6: Neo4j
    await neo4j_service.create_scan_report(scan_id, "voice", verdict)
    for ent in entities:
        await neo4j_service.add_entity_to_scan(scan_id, ent.get("text", ""), ent.get("label", ""))

    final_result = {
        "status": "complete",
        "type": "voice",
        "verdict": verdict,
        "voice": voice,
        "entities": entities,
    }
    _scans[scan_id] = final_result
    _emit(scan_id, "complete", {"scan_id": scan_id})

    # Cache the result
    if content_hash:
        cache_service.store_result(
            content_hash, "voice", final_result,
            sse_events=_scan_events.get(scan_id),
            input_preview=audio_path[:200],
        )

    # Cleanup temp file
    if os.path.exists(audio_path):
        os.unlink(audio_path)


# ── POST /api/scan/text ─────────────────────────────────────

@router.post("/scan/text", response_model=ScanOut)
async def scan_text(body: dict):
    """Submit raw text (email body, SMS, etc.) for scam analysis."""
    from services import cache_service

    text = body.get("text", "")
    if not text:
        raise HTTPException(400, "Provide text content")

    scan_id = f"scan-{uuid.uuid4().hex[:12]}"
    _scans[scan_id] = {"status": "processing", "type": "text"}
    _emit(scan_id, "scan_started", {"scan_id": scan_id, "type": "text"})

    # Check cache
    content_hash = cache_service.hash_text(text)
    cached = cache_service.get_cached(content_hash)
    if cached:
        asyncio.create_task(_replay_cached(scan_id, cached))
        return ScanOut(scan_id=scan_id, status="processing")

    asyncio.create_task(_run_text_pipeline(scan_id, text, content_hash))
    return ScanOut(scan_id=scan_id, status="processing")


async def _run_text_pipeline(scan_id: str, text: str, content_hash: str | None = None):
    """Text-only pipeline: GLiNER → classify → Tavily → Yutori → verdict."""
    from services import gliner_service, tavily_service, yutori_service, openai_service, neo4j_service, cache_service

    # Step 1: GLiNER extraction + classification in parallel
    _emit(scan_id, "step", {"step": "gliner_extract", "status": "running"})
    entities_raw, scam_class = await asyncio.gather(
        gliner_service.extract_scam_entities(text),
        gliner_service.classify_scam_type(text),
    )
    entities = entities_raw.get("entities", [])
    _emit(scan_id, "gliner_complete", {"entities": entities, "classification": scam_class})

    # Step 2: Tavily
    _emit(scan_id, "step", {"step": "tavily_search", "status": "running"})
    tavily_results = await tavily_service.check_all_entities(entities)
    _emit(scan_id, "tavily_complete", {"results": tavily_results})

    # Step 3: Yutori
    _emit(scan_id, "step", {"step": "yutori_research", "status": "running"})
    try:
        yutori_results = await yutori_service.research_all_entities(entities)
    except Exception:
        yutori_results = []
    _emit(scan_id, "yutori_complete", {"results": yutori_results})

    # Step 4: Verdict
    _emit(scan_id, "step", {"step": "verdict", "status": "running"})
    verdict = await asyncio.to_thread(
        openai_service.synthesize_verdict,
        entities=entities,
        tavily_results=tavily_results,
        yutori_results=yutori_results,
        raw_text=text,
    )
    _emit(scan_id, "verdict", verdict)

    # Step 5: Neo4j
    await neo4j_service.create_scan_report(scan_id, "text", verdict)
    for ent in entities:
        await neo4j_service.add_entity_to_scan(scan_id, ent.get("text", ""), ent.get("label", ""))

    final_result = {
        "status": "complete",
        "type": "text",
        "verdict": verdict,
        "entities": entities,
    }
    _scans[scan_id] = final_result
    _emit(scan_id, "complete", {"scan_id": scan_id})

    # Cache the result
    if content_hash:
        cache_service.store_result(
            content_hash, "text", final_result,
            sse_events=_scan_events.get(scan_id),
            input_preview=text[:200],
        )


# ── GET /api/scan/:id/status — SSE stream ──────────────────

@router.get("/scan/{scan_id}/status")
async def scan_status_stream(scan_id: str):
    """SSE stream of real-time analysis events."""
    async def generate():
        sent = 0
        while True:
            events = _scan_events.get(scan_id, [])
            while sent < len(events):
                yield events[sent]
                sent += 1
                # Check if complete
                if events[sent - 1]["event"] == "complete":
                    return
            await asyncio.sleep(0.5)

    return EventSourceResponse(generate())


# ── GET /api/scan/:id/verdict ───────────────────────────────

@router.get("/scan/{scan_id}/verdict")
async def scan_verdict(scan_id: str):
    """Get the full verdict for a completed scan."""
    scan = _scans.get(scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")
    return scan


# ── GET /api/scans — list all scans ────────────────────────

@router.get("/scans")
async def list_scans():
    """List all scans (completed and in-progress)."""
    scans = []
    for scan_id, data in _scans.items():
        scans.append({
            "scan_id": scan_id,
            "status": data.get("status", "unknown"),
            "type": data.get("type", "unknown"),
            "verdict": data.get("verdict"),
            "entities": data.get("entities", []),
            "visual": data.get("visual"),
            "voice": data.get("voice"),
        })
    # Most recent first
    scans.reverse()
    return {"scans": scans}


# ── Cache management ────────────────────────────────────────

@router.get("/cache/stats")
async def get_cache_stats():
    """Get cache statistics."""
    from services import cache_service
    return cache_service.cache_stats()


@router.delete("/cache")
async def clear_all_cache():
    """Clear all cached scan results."""
    from services import cache_service
    deleted = cache_service.clear_cache()
    return {"deleted": deleted, "message": f"Cleared {deleted} cached entries"}
