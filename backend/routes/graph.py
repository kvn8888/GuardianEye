"""Graph routes — Neo4j scam network visualization."""
from fastapi import APIRouter, HTTPException
from services import neo4j_service

router = APIRouter()


@router.get("/graph/{scan_id}")
async def get_scan_graph(scan_id: str):
    """Get the Neo4j subgraph for a specific scan (for visualization)."""
    graph = await neo4j_service.get_scan_graph(scan_id)
    if not graph["nodes"]:
        raise HTTPException(404, "Scan not found in graph")
    return graph


@router.get("/graph/network/{entity_value:path}")
async def get_entity_network(entity_value: str):
    """Get all scam reports connected to a specific entity.
    Shows how phone numbers/URLs connect across multiple scams.
    """
    network = await neo4j_service.get_entity_network(entity_value)
    return network


@router.get("/threats/recent")
async def recent_threats(limit: int = 20):
    """Get entities with the most scam reports — threat dashboard."""
    threats = await neo4j_service.get_recent_threats(limit=limit)
    return {"threats": threats, "count": len(threats)}
