import streamlit as st
from frontend import api_client
from frontend.theme import inject_theme, render_hero
from frontend.components.exception_table import render_exception_table
from frontend.components.threshold_slider import render_threshold_sliders
from frontend.components.charts import flagged_over_time_chart

st.set_page_config(page_title="Ledger Exceptions · Audit Analytics", page_icon="📒", layout="wide")
inject_theme()
render_hero("Ledger", "Exceptions", "Benford's Law, near-duplicate invoices, and 3-way-match — ranked and explained.")

dataset_id = st.session_state.get("ledger_dataset_id")
if not dataset_id:
    st.warning("No ledger dataset loaded yet. Go to **Upload Data** first.")
    st.stop()

with st.expander("⚙️ Detection settings"):
    thresholds = render_threshold_sliders("ledger", key_prefix="ledger_page")
    run_clicked = st.button("▶ Run Detection", type="primary", key="run_ledger_detection")

if run_clicked:
    with st.spinner("Running Benford, duplicate-detection and 3-way-match..."):
        result = api_client.run_detection("ledger", dataset_id, thresholds)
    if "error" in result:
        st.error(f"Detection run failed: {result['error']}")
    else:
        st.session_state["last_ledger_run"] = result
        st.toast(f"Run #{result['run_id']}: {result['total_exceptions']} exceptions.", icon="✅")

last_run = st.session_state.get("last_ledger_run")
if last_run:
    m = st.columns(3)
    m[0].metric("Records Scanned", last_run["total_records_scanned"])
    m[1].metric("Exceptions Flagged", last_run["total_exceptions"])
    rate = (last_run["total_exceptions"] / last_run["total_records_scanned"] * 100) if last_run["total_records_scanned"] else 0
    m[2].metric("Flag Rate", f"{rate:.1f}%")

st.divider()
status_filter = st.selectbox("Filter by status", ["all", "unreviewed", "confirmed", "false_positive", "needs_review"], key="ledger_status_filter")
exceptions = api_client.list_exceptions(domain="ledger", status=None if status_filter == "all" else status_filter, limit=100)

if isinstance(exceptions, dict) and "error" in exceptions:
    st.error(f"Could not load exceptions: {exceptions['error']}")
else:
    if exceptions:
        st.plotly_chart(flagged_over_time_chart(exceptions), use_container_width=True, key="ledger_timeline")
    render_exception_table(exceptions, key_prefix="ledger")