"""OpenAI — Verdict synthesis.

Combines signals from Reka Vision, Modulate/Whisper, GLiNER entities,
Tavily reputation, and Yutori research into a final scam verdict.
"""
import os
import json
from openai import OpenAI

_client = None


def _get_client() -> OpenAI | None:
    global _client
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    if _client is None:
        _client = OpenAI(api_key=key)
    return _client


def synthesize_verdict(
    *,
    visual_analysis: dict | None = None,
    voice_analysis: dict | None = None,
    entities: list[dict] | None = None,
    tavily_results: list[dict] | None = None,
    yutori_results: list[dict] | None = None,
    raw_text: str = "",
) -> dict:
    """Combine all signals into a final RED/YELLOW/GREEN verdict."""
    client = _get_client()
    if not client:
        return _rule_based_verdict(
            visual_analysis, voice_analysis, entities, tavily_results
        )

    # Build context for GPT
    context_parts = []

    if visual_analysis:
        context_parts.append(
            f"## Visual Analysis (Reka Vision)\n{json.dumps(visual_analysis, indent=2)}"
        )
    if voice_analysis:
        context_parts.append(
            f"## Voice Analysis\n{json.dumps(voice_analysis, indent=2)}"
        )
    if entities:
        context_parts.append(
            f"## Extracted Entities (GLiNER)\n{json.dumps(entities, indent=2)}"
        )
    if tavily_results:
        context_parts.append(
            f"## Quick Reputation Search (Tavily)\n{json.dumps(tavily_results, indent=2)}"
        )
    if yutori_results:
        context_parts.append(
            f"## Deep Research (Yutori)\n{json.dumps(yutori_results, indent=2)}"
        )
    if raw_text:
        context_parts.append(f"## Original Text\n{raw_text[:3000]}")

    combined_context = "\n\n".join(context_parts)

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert fraud analyst protecting seniors from scams. "
                        "Synthesize all available signals into a clear verdict. "
                        "Be definitive — seniors need clear advice, not hedging. "
                        "Write explanations a 75-year-old can understand."
                    ),
                },
                {
                    "role": "user",
                    "content": f"""Based on all the following evidence, determine if this is a scam.

{combined_context}

Return JSON:
{{
  "level": "RED" | "YELLOW" | "GREEN",
  "confidence": 0.0 to 1.0,
  "explanation": "Plain-English explanation a senior can understand (2-3 sentences max)",
  "scam_type": "tech_support" | "irs_government" | "phishing" | "romance" | "bank_fraud" | "prize_lottery" | "package_delivery" | "crypto_investment" | "unknown",
  "red_flags": ["specific red flag 1", "specific red flag 2"],
  "recommended_action": "What the senior should do right now",
  "should_alert_family": true/false
}}

Rules:
- RED: High confidence this is a scam. Multiple strong signals.
- YELLOW: Suspicious but not certain. Some signals but also some legitimate indicators.
- GREEN: Appears legitimate. No strong scam indicators found.
- When in doubt, err toward RED. Better to flag a legitimate message than miss a scam.
""",
                },
            ],
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"level": "YELLOW", "confidence": 0.3, "explanation": raw, "red_flags": []}
    except Exception as e:
        print(f"⚠  OpenAI verdict failed: {e}, using rule-based fallback")
        return _rule_based_verdict(
            visual_analysis, voice_analysis, entities, tavily_results
        )


def _rule_based_verdict(
    visual: dict | None,
    voice: dict | None,
    entities: list[dict] | None,
    tavily: list[dict] | None,
) -> dict:
    """Rule-based fallback when OpenAI is unavailable."""
    score = 0
    flags = []

    if visual:
        sc = visual.get("scam_confidence", 0)
        if sc > 70:
            score += 40
            flags.extend(visual.get("red_flags", []))
        elif sc > 40:
            score += 20

    if voice:
        fs = voice.get("fraud_score", 0)
        if fs > 70:
            score += 40
            flags.extend(voice.get("pressure_tactics", []))
        elif fs > 40:
            score += 20

    # Score entities — threat language, deadlines, and suspicious patterns
    if entities:
        label_scores = {
            "threat_language": 20,
            "deadline": 10,
            "personal_info_request": 15,
            "phone_number": 5,
            "url": 5,
            "dollar_amount": 10,
            "government_agency": 10,
            "case_number": 10,
        }
        for ent in entities:
            label = ent.get("label", "")
            add = label_scores.get(label, 0)
            if add > 0:
                score += add
                flags.append(f"Suspicious {label.replace('_', ' ')}: {ent.get('text', '?')}")

    if tavily:
        for t in tavily:
            answer = t.get("answer", "").lower()
            if "scam" in answer or "fraud" in answer or "reported" in answer:
                score += 15
                flags.append(f"{t.get('entity', '?')} found in scam reports")

    score = min(score, 100)
    level = "RED" if score >= 50 else "YELLOW" if score >= 25 else "GREEN"
    conf = min(score / 100.0, 1.0)

    # Build human-readable explanation
    if level == "RED":
        explanation = f"This looks very suspicious. We found {len(flags)} warning signs including threat language, suspicious links, and urgent deadlines. Do not respond or click any links."
    elif level == "YELLOW":
        explanation = f"This seems suspicious. We found {len(flags)} possible warning signs. Be cautious and verify with a trusted source before taking any action."
    else:
        explanation = "We did not find strong indicators that this is a scam, but always be careful with unexpected messages."

    return {
        "level": level,
        "confidence": conf,
        "explanation": explanation,
        "scam_type": "unknown",
        "red_flags": flags[:10],
        "recommended_action": "Do not respond or click any links. Call a trusted family member." if level == "RED" else "Verify with a trusted source before acting.",
        "should_alert_family": level == "RED",
        "analyzed_by": "rule-based-fallback",
    }
