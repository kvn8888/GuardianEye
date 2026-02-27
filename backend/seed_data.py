"""Seed Neo4j with representative scam data for demo.

Provides a realistic-looking graph from the start so the network
visualization and threat dashboard aren't empty during demos.
Only inserts if the graph is empty (won't duplicate on restarts).
"""

from services import neo4j_service

# Realistic scam entity seed data — not real active scams.
# Based on common scam archetypes from FTC / FBI IC3 reports.
SEED_REPORTS = [
    {
        "scan_id": "seed-irs-phish-001",
        "scan_type": "image",
        "verdict": {
            "level": "RED",
            "confidence": 0.97,
            "explanation": "This email impersonates the IRS, which never contacts taxpayers by email. The link goes to a fake website.",
            "scam_type": "irs_government",
        },
        "entities": [
            ("irs-refund-claim.xyz", "url"),
            ("+1 (800) 555-0147", "phone_number"),
            ("IRS Tax Division", "company_name"),
            ("$3,247.00", "dollar_amount"),
        ],
    },
    {
        "scan_id": "seed-irs-phish-002",
        "scan_type": "text",
        "verdict": {
            "level": "RED",
            "confidence": 0.95,
            "explanation": "Government agencies never threaten arrest by phone. This is a classic IRS impersonation scam.",
            "scam_type": "irs_government",
        },
        "entities": [
            ("+1 (800) 555-0147", "phone_number"),
            ("tax-help-center.co", "url"),
            ("Federal Tax Corp", "company_name"),
        ],
    },
    {
        "scan_id": "seed-medicare-001",
        "scan_type": "voice",
        "verdict": {
            "level": "RED",
            "confidence": 0.92,
            "explanation": "Medicare never calls asking for your Social Security number. This is a benefits scam.",
            "scam_type": "irs_government",
        },
        "entities": [
            ("+1 (888) 555-0923", "phone_number"),
            ("Medicare Benefits Center", "company_name"),
            ("medicare-benefits-2026.com", "url"),
        ],
    },
    {
        "scan_id": "seed-amazon-phish-001",
        "scan_type": "text",
        "verdict": {
            "level": "YELLOW",
            "confidence": 0.78,
            "explanation": "The link does not go to Amazon's official website. The order format looks unusual.",
            "scam_type": "package_delivery",
        },
        "entities": [
            ("amzn-delivery.co", "url"),
            ("Amazon", "company_name"),
        ],
    },
    {
        "scan_id": "seed-grandparent-001",
        "scan_type": "text",
        "verdict": {
            "level": "RED",
            "confidence": 0.99,
            "explanation": "Classic grandparent scam. Legitimate family members never ask for gift cards.",
            "scam_type": "romance",
        },
        "entities": [
            ("+1 (555) 012-3456", "phone_number"),
            ("$500", "dollar_amount"),
        ],
    },
    {
        "scan_id": "seed-techsupport-001",
        "scan_type": "image",
        "verdict": {
            "level": "RED",
            "confidence": 0.94,
            "explanation": "Legitimate companies never send unsolicited virus warnings. This is a tech support scam.",
            "scam_type": "tech_support",
        },
        "entities": [
            ("+1 (800) 555-0199", "phone_number"),
            ("example-fake-antivirus.com", "url"),
            ("Global Tech Support", "company_name"),
        ],
    },
    {
        "scan_id": "seed-lottery-001",
        "scan_type": "text",
        "verdict": {
            "level": "RED",
            "confidence": 0.98,
            "explanation": "You cannot win a lottery you never entered. Upfront fees are always a scam.",
            "scam_type": "prize_lottery",
        },
        "entities": [
            ("claims@example-not-real-lottery.com", "email_address"),
            ("$5,000,000", "dollar_amount"),
            ("$250", "dollar_amount"),
            ("International Online Lottery", "company_name"),
        ],
    },
    {
        "scan_id": "seed-bank-phish-001",
        "scan_type": "image",
        "verdict": {
            "level": "RED",
            "confidence": 0.96,
            "explanation": "Banks never ask for passwords via email. The sender domain does not match any real bank.",
            "scam_type": "bank_fraud",
        },
        "entities": [
            ("fake-example-link-not-real.com", "url"),
            ("Definitely Real Bank", "company_name"),
            ("security-alert@totallynotabank-example.com", "email_address"),
        ],
    },
    {
        "scan_id": "seed-crypto-001",
        "scan_type": "text",
        "verdict": {
            "level": "RED",
            "confidence": 0.93,
            "explanation": "No legitimate investment guarantees 500% returns. This is a crypto scam.",
            "scam_type": "crypto_investment",
        },
        "entities": [
            ("crypto-gains-guaranteed.io", "url"),
            ("+1 (347) 555-0842", "phone_number"),
            ("$10,000", "dollar_amount"),
        ],
    },
    {
        "scan_id": "seed-ssn-001",
        "scan_type": "voice",
        "verdict": {
            "level": "RED",
            "confidence": 1.0,
            "explanation": "Social Security numbers cannot be suspended. The government will never threaten arrest over the phone.",
            "scam_type": "irs_government",
        },
        "entities": [
            ("+1 (800) 555-0199", "phone_number"),
            ("Social Security Administration", "company_name"),
        ],
    },
    # Cross-connections — same phone in different scams
    {
        "scan_id": "seed-techsupport-002",
        "scan_type": "voice",
        "verdict": {
            "level": "RED",
            "confidence": 0.91,
            "explanation": "This caller used high-pressure tactics and demanded remote access to your computer.",
            "scam_type": "tech_support",
        },
        "entities": [
            ("+1 (800) 555-0199", "phone_number"),
            ("Windows Security Center", "company_name"),
            ("remote-fix-now.com", "url"),
        ],
    },
    {
        "scan_id": "seed-delivery-001",
        "scan_type": "text",
        "verdict": {
            "level": "YELLOW",
            "confidence": 0.72,
            "explanation": "USPS does not send tracking links via text. Verify at usps.com directly.",
            "scam_type": "package_delivery",
        },
        "entities": [
            ("usps-tracking-update.info", "url"),
            ("USPS", "company_name"),
        ],
    },
]


async def seed_neo4j():
    """Seed the Neo4j database with demo data. Skips if data already exists."""
    from services.neo4j_service import _get_driver

    driver = _get_driver()
    if not driver:
        print("⚠  Neo4j not configured — skipping seed")
        return

    # Check if already seeded
    async with driver.session() as session:
        result = await session.run("MATCH (r:ScamReport) RETURN count(r) as c")
        record = await result.single()
        count = record["c"] if record else 0
        if count > 0:
            print(f"✓ Neo4j already has {count} reports — skipping seed")
            return

    # Seed all reports + entities
    for report in SEED_REPORTS:
        await neo4j_service.create_scan_report(
            report["scan_id"],
            report["scan_type"],
            report["verdict"],
        )
        for entity_text, entity_type in report["entities"]:
            await neo4j_service.add_entity_to_scan(
                report["scan_id"], entity_text, entity_type
            )

    print(f"✓ Neo4j seeded with {len(SEED_REPORTS)} reports and {sum(len(r['entities']) for r in SEED_REPORTS)} entities")
