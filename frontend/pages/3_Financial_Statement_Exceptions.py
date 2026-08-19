import streamlit as st
from frontend import api_client
from frontend.theme import inject_theme, render_hero
from frontend.components.exception_table import render_exception_table
from frontend.components.threshold_slider import render_threshold_sliders
from frontend.components.charts import flagged_over_time_chart

st.set_page_config(page_title="Financial Statement Exceptions · Audit Analytics", page_icon="📊", layout="wide")
inject_theme()
render_hero("Financial Statement", "Exceptions", "Beneish M-Score, Altman Z-Score, and ratio anomalies — ranked and explained.")

dataset_id = st.session_state.get("fs_dataset_id")
if not dataset_id:
    st.warning("No financial-statement dataset loaded yet. Go to **Upload Data** first.")
    st.stop()

with st.expander("⚙️ Detection settings"):
    thresholds = render_threshold_sliders("financial_statement", key_prefix="fs_page")
    run_clicked = st.button("▶ Run Detection", type="primary", key="run_fs_detection")

if run_clicked:
    reviewer = st.session_state.get("reviewer_name", "demo_user")
    with st.spinner("Running Beneish, Altman and ratio-anomaly..."):
        result = api_client.run_detection("financial_statement", dataset_id, thresholds, run_by=reviewer)
    if "error" in result:
        st.error(f"Detection run failed: {result['error']}")
    else:
        st.session_state["last_fs_run"] = result
        st.toast(f"Run #{result['run_id']}: {result['total_exceptions']} exceptions.", icon="✅")

last_run = st.session_state.get("last_fs_run")
if last_run:
    m = st.columns(3)
    m[0].metric("Company-Years Scanned", last_run["total_records_scanned"])
    m[1].metric("Exceptions Flagged", last_run["total_exceptions"])
    rate = (last_run["total_exceptions"] / last_run["total_records_scanned"] * 100) if last_run["total_records_scanned"] else 0
    m[2].metric("Flag Rate", f"{rate:.1f}%")

st.divider()
status_filter = st.selectbox("Filter by status", ["all", "unreviewed", "confirmed", "false_positive", "needs_review"], key="fs_status_filter")
exceptions = api_client.list_exceptions(domain="financial_statement", status=None if status_filter == "all" else status_filter, limit=100)

if isinstance(exceptions, dict) and "error" in exceptions:
    st.error(f"Could not load exceptions: {exceptions['error']}")
else:
    if exceptions:
        st.plotly_chart(flagged_over_time_chart(exceptions), use_container_width=True, key="fs_timeline")
    render_exception_table(exceptions, key_prefix="fs")