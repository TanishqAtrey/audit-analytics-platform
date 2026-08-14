# backend/core/reason_codes.py
"""Rule-based score decomposition into human-readable explanations."""

SEVERITY_BANDS = [
    (0.85, "very high"),
    (0.65, "high"),
    (0.40, "moderate"),
    (0.0, "low"),
]


def _severity(score: float) -> str:
    for threshold, label in SEVERITY_BANDS:
        if score >= threshold:
            return label
    return "low"


def _explain_benford_ensemble(score: float, detail: dict) -> str:
    parts = []
    if "chi_square_p_value" in detail:
        parts.append(f"chi-square p={detail['chi_square_p_value']:.4f}")
    if "mad" in detail:
        parts.append(f"MAD={detail['mad']:.4f} ({detail.get('mad_conformity', 'n/a')})")
    group = detail.get("group_key", "this vendor")
    stats = ", ".join(parts) if parts else "digit distribution deviates from Benford's Law"
    return f"Benford's Law: {_severity(score)} deviation for {group} ({stats})."


def _explain_duplicate_detection(score: float, detail: dict) -> str:
    match_id = detail.get("matched_record_id", "another record")
    field_hits = detail.get("matched_fields", [])
    field_str = ", ".join(field_hits) if field_hits else "vendor/amount/date"
    return (
        f"Near-duplicate invoice: {_severity(score)} similarity "
        f"({detail.get('composite_similarity', score * 100):.1f}/100) to "
        f"record {match_id} on {field_str}."
    )


def _explain_three_way_match(score: float, detail: dict) -> str:
    violations = detail.get("violations", [])
    if not violations:
        return f"3-way match: {_severity(score)} risk mismatch between PO, invoice and goods receipt."
    return f"3-way match: {', '.join(violations)}."


def _explain_transaction_anomaly(score: float, detail: dict) -> str:
    feats = detail.get("features_used", [])
    feat_str = f" across {', '.join(feats)}" if feats else ""
    return f"Ledger anomaly (Isolation Forest + LOF): {_severity(score)} outlier{feat_str}."


def _explain_beneish(score: float, detail: dict) -> str:
    m = detail.get("m_score")
    m_str = f"M-Score={m:.2f}" if m is not None else ""
    drivers = detail.get("top_drivers", [])
    driver_str = f"; largest contributors: {', '.join(drivers)}" if drivers else ""
    return f"Beneish M-Score: {_severity(score)} earnings-manipulation risk {m_str}{driver_str}."


def _explain_altman(score: float, detail: dict) -> str:
    z = detail.get("z_score")
    zone = detail.get("zone", "n/a")
    z_str = f"Z={z:.2f} ({zone} zone)" if z is not None else zone
    return f"Altman Z-Score: {_severity(score)} distress/bankruptcy risk, {z_str}."


def _explain_ratio_anomaly(score: float, detail: dict) -> str:
    feats = detail.get("features_used", [])
    feat_str = f" across {', '.join(feats)}" if feats else ""
    return f"Ratio anomaly (Isolation Forest + LOF): {_severity(score)} outlier{feat_str}."


_EXPLAINERS = {
    "benford_ensemble": _explain_benford_ensemble,
    "duplicate_detection": _explain_duplicate_detection,
    "three_way_match": _explain_three_way_match,
    "ledger_transaction_anomaly": _explain_transaction_anomaly,
    "beneish_m_score": _explain_beneish,
    "altman_z_score": _explain_altman,
    "ratio_anomaly": _explain_ratio_anomaly,
}


def build_reason_codes(scores: dict[str, float], details: dict[str, dict]) -> list[dict]:
    codes = []
    for test_name, score in scores.items():
        explainer = _EXPLAINERS.get(test_name)
        explanation = (
            explainer(score, details.get(test_name, {}))
            if explainer
            else f"{test_name}: {_severity(score)} anomaly score."
        )
        codes.append({
            "test_name": test_name,
            "contribution_score": round(float(score), 4),
            "explanation": explanation,
        })
    codes.sort(key=lambda c: c["contribution_score"], reverse=True)
    return codes