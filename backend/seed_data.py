"""Seed Neo4j with representative scam data for demo.

Provides a realistic-looking graph with dense cross-connections so the
network visualization and threat dashboard look impressive from the start.
Only inserts if the graph is empty (won't duplicate on restarts).
"""

from services import neo4j_service

# ── Shared entities (appear in many reports to build dense networks) ─────
# These are fictional — not real active scam numbers/URLs.
PHONE_IRS = "+1 (800) 555-0147"
PHONE_TECH = "+1 (800) 555-0199"
PHONE_SSA = "+1 (888) 555-0923"
PHONE_AMAZON = "+1 (866) 555-0312"
PHONE_CRYPTO = "+1 (347) 555-0842"
PHONE_BANK = "+1 (855) 555-0476"
PHONE_MEDICARE = "+1 (800) 555-0661"

URL_IRS = "irs-refund-claim.xyz"
URL_TECH = "windows-security-alert.com"
URL_AMAZON = "amzn-order-verify.co"
URL_BANK = "secure-bank-login.net"
URL_CRYPTO = "crypto-gains-guaranteed.io"
URL_SSA = "ssa-benefits-update.org"
URL_DELIVERY = "usps-tracking-update.info"

SEED_REPORTS = [
    # ── IRS / Government Scam Network (6 reports, same phone + URL) ─────
    {
        "scan_id": "seed-irs-001", "scan_type": "image",
        "verdict": {"level": "RED", "confidence": 0.97, "explanation": "IRS never contacts taxpayers by email.", "scam_type": "irs_government"},
        "entities": [(URL_IRS, "url"), (PHONE_IRS, "phone_number"), ("IRS Tax Division", "company_name"), ("$3,247.00", "dollar_amount")],
    },
    {
        "scan_id": "seed-irs-002", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.95, "explanation": "Government agencies never threaten arrest by phone.", "scam_type": "irs_government"},
        "entities": [(PHONE_IRS, "phone_number"), ("tax-help-center.co", "url"), ("Federal Tax Bureau", "company_name")],
    },
    {
        "scan_id": "seed-irs-003", "scan_type": "voice",
        "verdict": {"level": "RED", "confidence": 0.98, "explanation": "Threatening arrest for unpaid taxes is always a scam.", "scam_type": "irs_government"},
        "entities": [(PHONE_IRS, "phone_number"), (URL_IRS, "url"), ("$8,500.00", "dollar_amount")],
    },
    {
        "scan_id": "seed-irs-004", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.96, "explanation": "The IRS does not accept gift cards as payment.", "scam_type": "irs_government"},
        "entities": [(PHONE_IRS, "phone_number"), ("$2,100.00", "dollar_amount"), ("Internal Revenue Service", "company_name")],
    },
    {
        "scan_id": "seed-irs-005", "scan_type": "image",
        "verdict": {"level": "RED", "confidence": 0.94, "explanation": "Fake IRS letter with incorrect formatting and logos.", "scam_type": "irs_government"},
        "entities": [(URL_IRS, "url"), (PHONE_IRS, "phone_number"), ("$4,890.00", "dollar_amount")],
    },
    {
        "scan_id": "seed-irs-006", "scan_type": "voice",
        "verdict": {"level": "RED", "confidence": 0.99, "explanation": "Automated robocall impersonating the IRS.", "scam_type": "irs_government"},
        "entities": [(PHONE_IRS, "phone_number"), ("IRS Criminal Division", "company_name")],
    },

    # ── SSA / Medicare Network (5 reports, shared phone) ────────────────
    {
        "scan_id": "seed-ssa-001", "scan_type": "voice",
        "verdict": {"level": "RED", "confidence": 1.0, "explanation": "SSN cannot be suspended. Government never threatens arrest.", "scam_type": "irs_government"},
        "entities": [(PHONE_SSA, "phone_number"), ("Social Security Administration", "company_name"), (URL_SSA, "url")],
    },
    {
        "scan_id": "seed-ssa-002", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.97, "explanation": "SSA does not text about benefits expiration.", "scam_type": "irs_government"},
        "entities": [(PHONE_SSA, "phone_number"), (URL_SSA, "url"), ("$1,450.00", "dollar_amount")],
    },
    {
        "scan_id": "seed-ssa-003", "scan_type": "voice",
        "verdict": {"level": "RED", "confidence": 0.92, "explanation": "Medicare never calls asking for SSN.", "scam_type": "irs_government"},
        "entities": [(PHONE_MEDICARE, "phone_number"), ("Medicare Benefits Center", "company_name"), (PHONE_SSA, "phone_number")],
    },
    {
        "scan_id": "seed-ssa-004", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.95, "explanation": "Fake benefits enrollment linked to same scam network.", "scam_type": "irs_government"},
        "entities": [(PHONE_SSA, "phone_number"), (URL_SSA, "url"), (PHONE_MEDICARE, "phone_number")],
    },
    {
        "scan_id": "seed-medicare-005", "scan_type": "voice",
        "verdict": {"level": "RED", "confidence": 0.93, "explanation": "Caller demanded Medicare number for 'new card'.", "scam_type": "irs_government"},
        "entities": [(PHONE_MEDICARE, "phone_number"), ("Medicare Enrollment", "company_name")],
    },

    # ── Tech Support Network (5 reports) ────────────────────────────────
    {
        "scan_id": "seed-tech-001", "scan_type": "image",
        "verdict": {"level": "RED", "confidence": 0.94, "explanation": "Fake virus warning popup. Microsoft never shows these.", "scam_type": "tech_support"},
        "entities": [(PHONE_TECH, "phone_number"), (URL_TECH, "url"), ("Microsoft Security", "company_name")],
    },
    {
        "scan_id": "seed-tech-002", "scan_type": "voice",
        "verdict": {"level": "RED", "confidence": 0.91, "explanation": "Caller demanded remote access to computer.", "scam_type": "tech_support"},
        "entities": [(PHONE_TECH, "phone_number"), ("Windows Security Center", "company_name"), ("remote-fix-now.com", "url")],
    },
    {
        "scan_id": "seed-tech-003", "scan_type": "image",
        "verdict": {"level": "RED", "confidence": 0.96, "explanation": "Browser lock popup with fake Microsoft branding.", "scam_type": "tech_support"},
        "entities": [(PHONE_TECH, "phone_number"), (URL_TECH, "url"), ("$299.99", "dollar_amount")],
    },
    {
        "scan_id": "seed-tech-004", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.93, "explanation": "Email claims computer is infected. Contains malicious link.", "scam_type": "tech_support"},
        "entities": [(URL_TECH, "url"), (PHONE_TECH, "phone_number"), ("Norton Security", "company_name")],
    },
    {
        "scan_id": "seed-tech-005", "scan_type": "voice",
        "verdict": {"level": "RED", "confidence": 0.95, "explanation": "Caller claimed IP address was compromised. Demanded payment.", "scam_type": "tech_support"},
        "entities": [(PHONE_TECH, "phone_number"), ("$499.00", "dollar_amount"), ("Geek Squad", "company_name")],
    },

    # ── Amazon / Package Delivery Network (4 reports) ───────────────────
    {
        "scan_id": "seed-amazon-001", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.88, "explanation": "Fake Amazon order notification with phishing link.", "scam_type": "package_delivery"},
        "entities": [(URL_AMAZON, "url"), ("Amazon", "company_name"), (PHONE_AMAZON, "phone_number")],
    },
    {
        "scan_id": "seed-amazon-002", "scan_type": "image",
        "verdict": {"level": "RED", "confidence": 0.92, "explanation": "Screenshot shows fake Amazon login page.", "scam_type": "package_delivery"},
        "entities": [(URL_AMAZON, "url"), ("Amazon", "company_name"), ("$1,299.99", "dollar_amount")],
    },
    {
        "scan_id": "seed-amazon-003", "scan_type": "text",
        "verdict": {"level": "YELLOW", "confidence": 0.72, "explanation": "USPS does not send tracking links via text.", "scam_type": "package_delivery"},
        "entities": [(URL_DELIVERY, "url"), ("USPS", "company_name"), (PHONE_AMAZON, "phone_number")],
    },
    {
        "scan_id": "seed-amazon-004", "scan_type": "voice",
        "verdict": {"level": "RED", "confidence": 0.90, "explanation": "Caller claimed unauthorized purchase on Amazon account.", "scam_type": "package_delivery"},
        "entities": [(PHONE_AMAZON, "phone_number"), ("Amazon", "company_name"), ("$2,499.00", "dollar_amount")],
    },

    # ── Banking / Financial Network (4 reports) ─────────────────────────
    {
        "scan_id": "seed-bank-001", "scan_type": "image",
        "verdict": {"level": "RED", "confidence": 0.96, "explanation": "Banks never ask for passwords via email.", "scam_type": "bank_fraud"},
        "entities": [(URL_BANK, "url"), (PHONE_BANK, "phone_number"), ("Chase Bank", "company_name")],
    },
    {
        "scan_id": "seed-bank-002", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.94, "explanation": "Fake fraud alert with suspicious link.", "scam_type": "bank_fraud"},
        "entities": [(URL_BANK, "url"), (PHONE_BANK, "phone_number"), ("Wells Fargo Security", "company_name")],
    },
    {
        "scan_id": "seed-bank-003", "scan_type": "voice",
        "verdict": {"level": "RED", "confidence": 0.97, "explanation": "Caller asked for full card number and CVV.", "scam_type": "bank_fraud"},
        "entities": [(PHONE_BANK, "phone_number"), ("Bank of America", "company_name"), ("$15,000.00", "dollar_amount")],
    },
    {
        "scan_id": "seed-bank-004", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.91, "explanation": "Phishing text mimics Zelle payment notification.", "scam_type": "bank_fraud"},
        "entities": [(URL_BANK, "url"), (PHONE_BANK, "phone_number"), ("Zelle", "company_name"), ("$850.00", "dollar_amount")],
    },

    # ── Crypto / Investment Network (3 reports) ─────────────────────────
    {
        "scan_id": "seed-crypto-001", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.93, "explanation": "No legitimate investment guarantees 500% returns.", "scam_type": "crypto_investment"},
        "entities": [(URL_CRYPTO, "url"), (PHONE_CRYPTO, "phone_number"), ("$10,000", "dollar_amount")],
    },
    {
        "scan_id": "seed-crypto-002", "scan_type": "image",
        "verdict": {"level": "RED", "confidence": 0.95, "explanation": "Fake crypto exchange with non-existent registration.", "scam_type": "crypto_investment"},
        "entities": [(URL_CRYPTO, "url"), (PHONE_CRYPTO, "phone_number"), ("CryptoVault Pro", "company_name")],
    },
    {
        "scan_id": "seed-crypto-003", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.89, "explanation": "Romance scam pivoting to crypto investment.", "scam_type": "crypto_investment"},
        "entities": [(PHONE_CRYPTO, "phone_number"), (URL_CRYPTO, "url"), ("$25,000", "dollar_amount")],
    },

    # ── Cross-network connections (links IRS ↔ Tech Support ↔ Bank) ────
    {
        "scan_id": "seed-cross-001", "scan_type": "voice",
        "verdict": {"level": "RED", "confidence": 0.98, "explanation": "Same call center running both IRS and tech support scams.", "scam_type": "tech_support"},
        "entities": [(PHONE_IRS, "phone_number"), (PHONE_TECH, "phone_number"), (URL_TECH, "url")],
    },
    {
        "scan_id": "seed-cross-002", "scan_type": "text",
        "verdict": {"level": "RED", "confidence": 0.96, "explanation": "Bank phishing email links to same domain as IRS scam.", "scam_type": "bank_fraud"},
        "entities": [(URL_BANK, "url"), (URL_IRS, "url"), (PHONE_BANK, "phone_number")],
    },
]


async def seed_neo4j(force: bool = False):
    """Seed the Neo4j database with demo data. Skips if data already exists unless force=True."""
    from services.neo4j_service import _get_driver

    driver = _get_driver()
    if not driver:
        print("⚠  Neo4j not configured — skipping seed")
        return

    async with driver.session() as session:
        result = await session.run("MATCH (r:ScamReport) RETURN count(r) as c")
        record = await result.single()
        count = record["c"] if record else 0

        if count > 0 and not force:
            print(f"✓ Neo4j already has {count} reports — skipping seed")
            return

        if count > 0 and force:
            # Clear old seed data
            await session.run("MATCH (n) DETACH DELETE n")
            print(f"✓ Cleared {count} old reports for re-seed")

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

    total_entities = sum(len(r["entities"]) for r in SEED_REPORTS)
    print(f"✓ Neo4j seeded with {len(SEED_REPORTS)} reports and {total_entities} entities")
