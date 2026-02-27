"""Pydantic models for API request/response schemas."""
from pydantic import BaseModel, Field
from typing import Optional


# ── Scan Input ──────────────────────────────────

class ImageScanInput(BaseModel):
    image_url: Optional[str] = None
    # For file upload, handled via Form/UploadFile in the route

class VoiceScanInput(BaseModel):
    audio_url: Optional[str] = None
    # For file upload, handled via Form/UploadFile in the route

class TextScanInput(BaseModel):
    text: str
    sender: Optional[str] = None  # e.g. phone number or email sender


# ── Entities ────────────────────────────────────

class ExtractedEntity(BaseModel):
    text: str
    label: str
    score: float = 0.0


class VoiceAnalysis(BaseModel):
    transcript: str = ""
    fraud_score: float = 0.0
    emotion_profile: dict = {}
    pressure_tactics: list[str] = []
    deepfake_detected: bool = False
    analyzed_by: str = "modulate"  # or "openai-fallback"


class VisualAnalysis(BaseModel):
    logos_detected: list[dict] = []
    urls_visible: list[str] = []
    urgency_cues: list[str] = []
    layout_suspicious: bool = False
    text_content: str = ""
    scam_confidence: int = 0
    red_flags: list[str] = []


# ── Verdict ─────────────────────────────────────

class Verdict(BaseModel):
    level: str = "pending"  # RED, YELLOW, GREEN, pending
    confidence: float = 0.0
    explanation: str = ""
    scam_type: str = "unknown"
    red_flags: list[str] = []
    entities_found: list[ExtractedEntity] = []
    evidence: list[dict] = []


# ── Scan Output ─────────────────────────────────

class ScanOut(BaseModel):
    scan_id: str
    status: str = "processing"  # processing, complete
    verdict: Optional[Verdict] = None
    visual_analysis: Optional[VisualAnalysis] = None
    voice_analysis: Optional[VoiceAnalysis] = None
    entities: list[ExtractedEntity] = []
    graph_connections: int = 0


# ── Scout / Threats ─────────────────────────────

class ThreatItem(BaseModel):
    entity: str
    entity_type: str  # phone, url, company
    reports_count: int = 0
    first_seen: str = ""
    source: str = ""


class ScoutStatus(BaseModel):
    scout_id: str
    status: str  # active, paused
    query: str
    output_interval: int
    recent_threats: list[ThreatItem] = []
