import streamlit as st
from frontend import api_client
from frontend.theme import inject_theme, render_hero
from frontend.components.exception_table import render_exception_table
from frontend.components.threshold_slider import render_threshold_sliders

st.set_page_config(page_title="Threshold Explorer · Audit Analytics", page_icon="🎚️", layout="wide")
inject_theme()
render_hero("Threshold", "Explorer", "Drag a slider, watch the ranked exception list react in real time.")

domain = st.radio("Domain", ["ledger", "financial_statement"], horizontal=True, key="explorer_domain")
dataset_id = st.session_state.get("ledger_dataset_id" if domain == "ledger" else "fs_dataset_id")

if not dataset_id:
    st.warning(f"No {domain.replace('_', ' ')} dataset loaded yet. Go to **Upload Data** first.")
    st.stop()

left, right = st.columns([1, 2])
with left:
    thresholds = render_threshold_sliders(domain, key_prefix="explorer")
    st.caption("Every drag triggers a new logged detection run — no cached shortcuts (see **Audit Log**).")

with right:
    with st.spinner("Re-scoring with the current thresholds..."):
        result = api_client.run_detection(domain, dataset_id, thresholds, run_by="threshold_explorer")
    if "error" in result:
        st.error(f"Detection run failed: {result['error']}")
    else:
        c1, c2 = st.columns(2)
        c1.metric("Exceptions at current thresholds", result["total_exceptions"])
        rate = (result["total_exceptions"] / result["total_records_scanned"] * 100) if result["total_records_scanned"] else 0
        c2.metric("Flag rate", f"{rate:.1f}%")
        st.markdown("##### Top 10 exceptions at these thresholds")
        render_exception_table(result["exceptions"][:10], key_prefix="explorer")