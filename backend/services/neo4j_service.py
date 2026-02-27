"""Neo4j — Scam network graph storage.

VALIDATED:
  pip install neo4j
  Use elementId(n) not deprecated id(n) for Neo4j 5+
  neo4j.AsyncGraphDatabase.driver() for async FastAPI
"""
import os
from neo4j import AsyncGraphDatabase

_driver = None


def _get_driver():
    global _driver
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USERNAME", "neo4j")
    pw = os.getenv("NEO4J_PASSWORD")
    if not uri or not pw:
        return None
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(uri, auth=(user, pw))
    return _driver


def close_driver():
    global _driver
    if _driver:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_driver.close())
            else:
                loop.run_until_complete(_driver.close())
        except Exception:
            pass
        _driver = None


# ── Write operations ────────────────────────────────────────

async def create_scan_report(scan_id: str, scan_type: str, verdict: dict) -> None:
    driver = _get_driver()
    if not driver:
        return
    async with driver.session() as session:
        await session.run(
            """CREATE (r:ScamReport {
                scanId: $scan_id, type: $scan_type,
                verdict: $verdict_level, confidence: $confidence,
                explanation: $explanation, scamType: $scam_type,
                createdAt: datetime()
            })""",
            scan_id=scan_id,
            scan_type=scan_type,
            verdict_level=verdict.get("level", "pending"),
            confidence=verdict.get("confidence", 0),
            explanation=verdict.get("explanation", ""),
            scam_type=verdict.get("scam_type", "unknown"),
        )


async def add_entity_to_scan(scan_id: str, entity_text: str, entity_type: str) -> None:
    driver = _get_driver()
    if not driver:
        return
    label_map = {
        "phone_number": "PhoneNumber",
        "url": "URL",
        "company_name": "CompanyImpersonated",
        "dollar_amount": "DollarAmount",
        "email_address": "EmailAddress",
    }
    node_label = label_map.get(entity_type, "Entity")

    async with driver.session() as session:
        # MERGE avoids duplicates across scans — key for network detection
        await session.run(
            f"""MATCH (r:ScamReport {{scanId: $scan_id}})
            MERGE (e:{node_label} {{value: $entity_text}})
            ON CREATE SET e.firstSeen = datetime(), e.reportCount = 1
            ON MATCH SET e.reportCount = e.reportCount + 1, e.lastSeen = datetime()
            CREATE (r)-[:CONTAINS {{entityType: $entity_type}}]->(e)""",
            scan_id=scan_id,
            entity_text=entity_text,
            entity_type=entity_type,
        )


async def add_evidence(scan_id: str, entity_text: str, evidence: dict) -> None:
    driver = _get_driver()
    if not driver:
        return
    async with driver.session() as session:
        await session.run(
            """MATCH (r:ScamReport {scanId: $scan_id})
            CREATE (ev:Evidence {
                snippet: $snippet, url: $url,
                sourceName: $source_name, foundBy: $found_by,
                createdAt: datetime()
            })
            CREATE (r)-[:HAS_EVIDENCE]->(ev)
            MERGE (s:Source {name: $source_name})
            ON CREATE SET s.domain = $domain
            CREATE (ev)-[:FROM_SOURCE]->(s)""",
            scan_id=scan_id,
            snippet=evidence.get("snippet", "")[:500],
            url=evidence.get("url", ""),
            source_name=evidence.get("title", evidence.get("source_name", "Unknown")),
            found_by=evidence.get("found_by", "unknown"),
            domain=_domain_from_url(evidence.get("url", "")),
        )


# ── Read operations ─────────────────────────────────────────

async def get_scan_graph(scan_id: str) -> dict:
    """Get the full subgraph for a single scan (for visualization)."""
    driver = _get_driver()
    if not driver:
        return {"nodes": [], "edges": []}
    async with driver.session() as session:
        result = await session.run(
            """MATCH (r:ScamReport {scanId: $scan_id})
            OPTIONAL MATCH (r)-[rel:CONTAINS]->(entity)
            OPTIONAL MATCH (r)-[:HAS_EVIDENCE]->(ev)-[:FROM_SOURCE]->(src)
            RETURN r, collect(DISTINCT {entity: entity, rel: rel}) as entities,
                   collect(DISTINCT {evidence: ev, source: src}) as evidence""",
            scan_id=scan_id,
        )
        records = [r async for r in result]
        if not records:
            return {"nodes": [], "edges": []}

        # Transform into vis-friendly format
        nodes, edges = [], []
        rec = records[0]
        report = rec["r"]

        nodes.append({
            "id": scan_id,
            "label": f"Scan: {report['type']}",
            "type": "report",
            "verdict": report.get("verdict", "pending"),
        })

        for ent_data in rec.get("entities", []):
            ent = ent_data.get("entity")
            if ent:
                ent_id = f"ent-{ent.get('value', '')}"
                nodes.append({
                    "id": ent_id,
                    "label": ent.get("value", "?"),
                    "type": ent_data.get("rel", {}).get("entityType", "entity"),
                    "reportCount": ent.get("reportCount", 1),
                })
                edges.append({"from": scan_id, "to": ent_id, "label": "CONTAINS"})

        return {"nodes": nodes, "edges": edges}


async def get_entity_network(entity_value: str) -> dict:
    """Find all scam reports connected to a specific entity (phone, URL, etc.)."""
    driver = _get_driver()
    if not driver:
        return {"nodes": [], "edges": [], "total_reports": 0}

    async with driver.session() as session:
        result = await session.run(
            """MATCH (e {value: $entity})<-[:CONTAINS]-(r:ScamReport)
            OPTIONAL MATCH (r)-[:CONTAINS]->(other)
            WHERE other <> e
            RETURN r, collect(DISTINCT other) as connected_entities,
                   e.reportCount as totalReports""",
            entity=entity_value,
        )
        records = [r async for r in result]
        nodes, edges = [], []
        total = 0

        for rec in records:
            report = rec["r"]
            total = rec.get("totalReports", 0) or 0
            rid = report.get("scanId", "?")
            nodes.append({
                "id": rid,
                "label": f"{report.get('type', '?')} scan",
                "verdict": report.get("verdict", "?"),
            })
            edges.append({"from": entity_value, "to": rid, "label": "REPORTED_IN"})

            for other in rec.get("connected_entities", []):
                oid = other.get("value", "?")
                nodes.append({"id": oid, "label": oid, "type": "entity"})
                edges.append({"from": rid, "to": oid, "label": "LINKED"})

        # Add the queried entity as center node
        nodes.insert(0, {
            "id": entity_value,
            "label": entity_value,
            "type": "entity",
            "reportCount": total,
        })
        return {"nodes": nodes, "edges": edges, "total_reports": total}


async def get_recent_threats(limit: int = 20) -> list[dict]:
    """Get entities with the most scam reports (for threat dashboard)."""
    driver = _get_driver()
    if not driver:
        return []
    async with driver.session() as session:
        result = await session.run(
            """MATCH (e)<-[:CONTAINS]-(r:ScamReport)
            WHERE e.reportCount > 1
            RETURN e.value as entity, labels(e)[0] as entityType,
                   e.reportCount as reports, e.firstSeen as firstSeen
            ORDER BY e.reportCount DESC
            LIMIT $limit""",
            limit=limit,
        )
        return [dict(r) async for r in result]


def _domain_from_url(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).hostname or ""
    except Exception:
        return ""
