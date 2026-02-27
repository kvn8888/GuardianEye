"""Fastino / GLiNER2 — Structured entity extraction.

VALIDATED:
  API endpoint: POST https://api.fastino.ai/gliner-2
  API key from: https://labs.fastino.ai
  Tasks: extract_entities, classify_text, extract_json
  Local fallback: pip install gliner2, GLiNER2.from_pretrained("fastino/gliner2-base-v1")
  Pioneer fine-tuning API: https://api.pioneer.ai
"""
import os
import httpx
import json

FASTINO_API_KEY = os.getenv("FASTINO_API_KEY", "")
FASTINO_API_URL = "https://api.fastino.ai/gliner-2"


async def extract_scam_entities(text: str) -> dict:
    """Extract structured scam-related entities from text using GLiNER."""
    if not FASTINO_API_KEY:
        return _mock_entities(text)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            FASTINO_API_URL,
            headers={
                "Authorization": f"Bearer {FASTINO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "task": "extract_entities",
                "text": text[:8000],
                "schema": [
                    "phone_number",
                    "url",
                    "company_name",
                    "dollar_amount",
                    "case_number",
                    "personal_info_request",
                    "deadline",
                    "government_agency",
                    "threat_language",
                    "email_address",
                ],
            },
        )
        if resp.status_code != 200:
            print(f"⚠  GLiNER API error {resp.status_code}: {resp.text}")
            return _mock_entities(text)
        return resp.json()


async def classify_scam_type(text: str) -> dict:
    """Classify the type of scam detected using GLiNER text classification."""
    if not FASTINO_API_KEY:
        return {"predicted_class": "unknown", "confidence": 0.0}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            FASTINO_API_URL,
            headers={
                "Authorization": f"Bearer {FASTINO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "task": "classify_text",
                "text": text[:4000],
                "schema": [
                    "tech_support_scam",
                    "irs_government_scam",
                    "romance_scam",
                    "phishing_email",
                    "package_delivery_scam",
                    "bank_fraud_scam",
                    "lottery_prize_scam",
                    "crypto_investment_scam",
                    "legitimate_communication",
                ],
            },
        )
        if resp.status_code != 200:
            return {"predicted_class": "unknown", "confidence": 0.0}
        return resp.json()


async def classify_evidence_relevance(claim_text: str, evidence_text: str) -> dict:
    """Classify whether evidence supports or contradicts a scam assessment."""
    if not FASTINO_API_KEY:
        return {"predicted_class": "unknown", "confidence": 0.0}

    combined = f"SCAM REPORT: {claim_text}\nEVIDENCE: {evidence_text}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            FASTINO_API_URL,
            headers={
                "Authorization": f"Bearer {FASTINO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "task": "classify_text",
                "text": combined[:4000],
                "schema": [
                    "confirms_scam",
                    "entity_reported_as_fraud",
                    "entity_appears_legitimate",
                    "evidence_inconclusive",
                ],
            },
        )
        if resp.status_code != 200:
            return {"predicted_class": "unknown", "confidence": 0.0}
        return resp.json()


def _mock_entities(text: str) -> dict:
    """Basic regex fallback when GLiNER API is unavailable."""
    import re

    entities = []
    # Phone numbers
    for m in re.finditer(r"[\+]?[\d\-\(\)\s]{7,15}", text):
        clean = re.sub(r"[^\d+]", "", m.group())
        if len(clean) >= 7:
            entities.append({"text": m.group().strip(), "label": "phone_number", "score": 0.8})
    # URLs
    for m in re.finditer(r"https?://[^\s<>\"']+", text):
        entities.append({"text": m.group(), "label": "url", "score": 0.9})
    # Dollar amounts
    for m in re.finditer(r"\$[\d,]+(?:\.\d{2})?", text):
        entities.append({"text": m.group(), "label": "dollar_amount", "score": 0.85})

    return {"entities": entities, "source": "regex-fallback"}
