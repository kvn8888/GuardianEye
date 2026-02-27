"""Yutori — Autonomous scouting + deep research.

VALIDATED SDK:
  pip install yutori
  from yutori import YutoriClient
  client.scouts.create(query=..., output_interval=1800)   # seconds
  client.scouts.list(status="active")
  client.scouts.get("scout_id")
  client.scouts.get_updates("scout_id", limit=20)
  client.research.create(query=...)                        # returns dict
  task["task_id"]
  result["status"] in ("succeeded", "failed")
  No depth= param, no name= param, no url= param, no schedule= param
"""
import os
import time
import asyncio
from yutori import YutoriClient

_client = None


def _get_client() -> YutoriClient | None:
    global _client
    key = os.getenv("YUTORI_API_KEY")
    if not key:
        return None
    if _client is None:
        _client = YutoriClient(api_key=key)
    return _client


# ── Scouting API (autonomous background monitoring) ────────

def create_scam_scout(webhook_url: str | None = None) -> dict:
    """Create a Yutori scout that monitors scam reporting sites."""
    client = _get_client()
    if not client:
        raise RuntimeError("YUTORI_API_KEY not configured")

    kwargs = {
        "query": (
            "Monitor FTC scam alerts at consumer.ftc.gov/scam-alerts, "
            "r/Scams subreddit for new scam reports, "
            "ScamAdviser trending reports, IC3 FBI complaint feed, "
            "and AARP Fraud Watch Network for new scam phone numbers, "
            "phishing URLs, companies being impersonated, "
            "and new scam tactics targeting seniors. "
            "Extract and return structured data: phone numbers, URLs, "
            "company names, scam type, and reported frequency."
        ),
        "output_interval": 1800,  # 30 minutes, in SECONDS
        "user_timezone": "America/Los_Angeles",
    }
    if webhook_url:
        kwargs["webhook_url"] = webhook_url
        kwargs["skip_email"] = True

    scout = client.scouts.create(**kwargs)
    return scout


def list_active_scouts() -> list:
    client = _get_client()
    if not client:
        return []
    return client.scouts.list(status="active")


def get_scout_updates(scout_id: str, limit: int = 20) -> list:
    client = _get_client()
    if not client:
        return []
    return client.scouts.get_updates(scout_id, limit=limit)


# ── Research API (deep verification of entities) ───────────

def deep_research_entity(entity_text: str, entity_type: str) -> dict:
    """Use Yutori Research to deeply investigate a potential scam entity."""
    client = _get_client()
    if not client:
        raise RuntimeError("YUTORI_API_KEY not configured")

    task = client.research.create(
        query=(
            f"Is {entity_text} associated with scams or fraud? "
            f"Entity type: {entity_type}. "
            f"Check ScamAdviser, BBB complaints, FTC reports, "
            f"domain WHOIS registration details (age, registrant country), "
            f"community reports on Reddit and consumer forums. "
            f"Return: number of scam reports found, domain age if applicable, "
            f"registrant country, associated scam type, and confidence level."
        )
    )

    # Poll for results
    max_wait = 90
    start = time.time()
    while time.time() - start < max_wait:
        result = client.research.get(task["task_id"])
        if result["status"] == "succeeded":
            return {
                "entity": entity_text,
                "entity_type": entity_type,
                "research": result,
                "found_by": "yutori",
            }
        elif result["status"] == "failed":
            return {
                "entity": entity_text,
                "error": "Yutori research failed",
            }
        time.sleep(3)

    return {"entity": entity_text, "error": "Yutori research timeout (90s)"}


async def deep_research_entity_async(entity_text: str, entity_type: str) -> dict:
    """Async wrapper for the synchronous polling loop."""
    return await asyncio.to_thread(deep_research_entity, entity_text, entity_type)


async def research_all_entities(entities: list[dict]) -> list[dict]:
    """Fire Yutori Research tasks for all entities in parallel."""
    tasks = [
        deep_research_entity_async(e["text"], e["label"])
        for e in entities
        if e["label"] in ("phone_number", "url", "company_name", "email_address")
    ]
    if not tasks:
        return []
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [
        r if isinstance(r, dict) else {"error": str(r)}
        for r in results
    ]
