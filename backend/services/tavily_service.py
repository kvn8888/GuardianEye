"""Tavily — Fast scam entity reputation lookup.

VALIDATED:
  Python SDK: pip install tavily-python
  from tavily import TavilyClient
  client.search(query, search_depth="basic", max_results=5, include_answer=True)
"""
import os
from tavily import TavilyClient

_client = None


def _get_client() -> TavilyClient | None:
    global _client
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        return None
    if _client is None:
        _client = TavilyClient(api_key=key)
    return _client


def quick_reputation_check(entity: str, entity_type: str) -> dict:
    """Quick scam reputation search via Tavily (1-2 seconds)."""
    client = _get_client()
    if not client:
        return {"entity": entity, "error": "TAVILY_API_KEY not configured"}

    query_map = {
        "phone_number": f'"{entity}" scam reported fraud phone',
        "url": f'"{entity}" phishing scam fake site',
        "company_name": f'"{entity}" scam impersonation fraud alert',
        "email_address": f'"{entity}" phishing scam email',
    }
    query = query_map.get(entity_type, f'"{entity}" scam fraud')

    try:
        result = client.search(
            query=query,
            search_depth="basic",
            max_results=5,
            include_answer=True,
        )
        return {
            "entity": entity,
            "entity_type": entity_type,
            "answer": result.get("answer", ""),
            "sources": [
                {
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "snippet": r.get("content", ""),
                    "score": r.get("score", 0),
                }
                for r in result.get("results", [])
            ],
            "found_by": "tavily",
        }
    except Exception as e:
        return {"entity": entity, "error": str(e)}


async def quick_reputation_check_async(entity: str, entity_type: str) -> dict:
    """Async wrapper for the sync Tavily call."""
    import asyncio
    return await asyncio.to_thread(quick_reputation_check, entity, entity_type)


async def check_all_entities(entities: list[dict]) -> list[dict]:
    """Run quick reputation checks on all extracted entities in parallel."""
    import asyncio

    researchable = [
        e for e in entities
        if e["label"] in ("phone_number", "url", "company_name", "email_address")
    ]
    if not researchable:
        return []

    tasks = [
        quick_reputation_check_async(e["text"], e["label"])
        for e in researchable
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [
        r if isinstance(r, dict) else {"error": str(r)}
        for r in results
    ]
