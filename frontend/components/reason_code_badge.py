import streamlit as st

TEST_COLORS = {
    "benford_ensemble": "#3B82F6", "duplicate_detection": "#2DD4BF", "three_way_match": "#F59E0B",
    "ledger_transaction_anomaly": "#F97316",
    "beneish_m_score": "#A855F7", "altman_z_score": "#EF4444", "ratio_anomaly": "#22C55E",
}


def render_reason_codes(reason_codes: list[dict]) -> None:
    if not reason_codes:
        st.caption("No sub-test detail available.")
        return
    for rc in reason_codes:
        color = TEST_COLORS.get(rc["test_name"], "#94A3B8")
        pct = int(rc["contribution_score"] * 100)
        st.markdown(f"""
            <div class="reason-badge" style="border-left: 3px solid {color};">
                <div class="reason-badge-header">
                    <span style="color:{color};font-weight:700;">{rc['test_name'].replace('_',' ').title()}</span>
                    <span class="reason-badge-score">{pct}%</span>
                </div>
                <div class="reason-badge-bar-track"><div class="reason-badge-bar-fill" style="width:{pct}%; background:{color};"></div></div>
                <div class="reason-badge-explanation">{rc['explanation']}</div>
            </div>
        """, unsafe_allow_html=True)