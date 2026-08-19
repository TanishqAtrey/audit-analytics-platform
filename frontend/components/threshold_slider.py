import streamlit as st

SLIDER_SPECS = {
    "ledger": [
        ("benford_sensitivity", "Benford Sensitivity", 0.0, 1.0, 0.5, 0.05),
        ("duplicate_similarity_threshold", "Duplicate Match Threshold", 50.0, 100.0, 85.0, 1.0),
        ("three_way_match_tolerance_pct", "3-Way Match Tolerance", 0.0, 0.20, 0.02, 0.01),
    ],
    "financial_statement": [
        ("isolation_forest_contamination", "Isolation Forest Sensitivity", 0.01, 0.30, 0.05, 0.01),
        ("lof_contamination", "LOF Sensitivity", 0.01, 0.30, 0.05, 0.01),
    ],
}
DEFAULTS = {
    "benford_sensitivity": 0.5, "duplicate_similarity_threshold": 85.0,
    "isolation_forest_contamination": 0.05, "lof_contamination": 0.05,
    "three_way_match_tolerance_pct": 0.02,
}


def render_threshold_sliders(domain: str, key_prefix: str = "threshold") -> dict:
    """Renders the relevant sliders for `domain`; untouched fields fall
    back to backend's own ThresholdConfig defaults."""
    config = dict(DEFAULTS)
    st.markdown("##### 🎚️ Sensitivity Controls")
    for field, label, lo, hi, default, step in SLIDER_SPECS[domain]:
        config[field] = st.slider(label, min_value=lo, max_value=hi, value=default, step=step,
                                   key=f"{key_prefix}_{field}")
    return config