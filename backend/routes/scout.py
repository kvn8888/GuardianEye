"""Scout routes — Yutori autonomous monitoring dashboard."""
from fastapi import APIRouter, HTTPException
from services import yutori_service

router = APIRouter()


@router.post("/scout/create")
async def create_scout(body: dict = {}):
    """Create a new Yutori scout for autonomous scam monitoring.
    Runs in background, checking FTC, r/Scams, ScamAdviser every 30 min.
    """
    webhook = body.get("webhook_url")
    try:
        scout = yutori_service.create_scam_scout(webhook_url=webhook)
        return {"scout": scout, "message": "Scout created — monitoring scam sources every 30 min"}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.get("/scout/status")
async def scout_status():
    """List all active Yutori scouts and their status."""
    scouts = yutori_service.list_active_scouts()
    return {"active_scouts": scouts, "count": len(scouts) if isinstance(scouts, list) else 0}


@router.get("/scout/{scout_id}/updates")
async def scout_updates(scout_id: str, limit: int = 20):
    """Get recent updates from a specific scout."""
    updates = yutori_service.get_scout_updates(scout_id, limit=limit)
    return {"scout_id": scout_id, "updates": updates}


@router.post("/scout/webhook")
async def scout_webhook(body: dict):
    """Webhook endpoint for Yutori scout output.
    When a scout finds new threats, Yutori POSTs here.
    We parse the results and add to Neo4j.
    """
    from services import gliner_service, neo4j_service
    import uuid

    # Extract entities from scout output
    output_text = str(body.get("output", body.get("data", "")))
    entities_raw = await gliner_service.extract_scam_entities(output_text)
    entities = entities_raw.get("entities", [])

    # Store as a scout-generated scan
    scan_id = f"scout-{uuid.uuid4().hex[:8]}"
    await neo4j_service.create_scan_report(scan_id, "scout", {
        "level": "YELLOW",
        "confidence": 0.5,
        "explanation": "Threat detected by autonomous scout",
        "scam_type": "unknown",
    })
    for ent in entities:
        await neo4j_service.add_entity_to_scan(scan_id, ent.get("text", ""), ent.get("label", ""))

    return {
        "received": True,
        "entities_extracted": len(entities),
        "scan_id": scan_id,
    }


@router.post("/alert/family")
async def alert_family(body: dict):
    """Send family alert notification.
    TODO: Integrate Twilio SMS or push notification service.
    """
    scan_id = body.get("scan_id", "")
    message = body.get("message", "Potential scam detected by GuardianEye")
    # TODO: Replace with Twilio/SendGrid integration
    return {
        "alert_sent": True,
        "scan_id": scan_id,
        "message": message,
        "delivery_method": "pending_integration",
    }
