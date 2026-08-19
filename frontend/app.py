import streamlit as st
from frontend import api_client
from frontend.theme import inject_theme, render_hero

st.set_page_config(page_title="Audit Analytics Platform", page_icon="🛡️", layout="wide", initial_sidebar_state="expanded")
inject_theme()
render_hero()

health = api_client.health_check()
status_col, docs_col, _ = st.columns([1, 1, 3])
with status_col:
    st.markdown("🔴 **Backend unreachable**" if "error" in health
                else f"🟢 **Backend online** · env: `{health.get('env', 'unknown')}`")
with docs_col:
    st.markdown(f"[API docs ↗]({api_client.BACKEND_URL}/docs)")

st.divider()

with st.sidebar:
    st.markdown("### 👤 Reviewer")
    st.session_state.setdefault("reviewer_name", "demo_user")
    st.session_state["reviewer_name"] = st.text_input(
        "Your name (attached to case-status changes)", value=st.session_state["reviewer_name"])
    st.divider()
    st.markdown("### 🗂️ Active Datasets")
    st.write(f"Ledger: `{st.session_state.get('ledger_dataset_id', '— none loaded —')}`")
    st.write(f"Financial statements: `{st.session_state.get('fs_dataset_id', '— none loaded —')}`")

st.markdown("### Where to go")
cards = [
    ("📤", "Upload Data", "Ingest a ledger CSV or select curated SEC EDGAR companies.", "1_Upload_Data"),
    ("📒", "Ledger Exceptions", "Benford, duplicate-invoice and 3-way-match flags, ranked.", "2_Ledger_Exceptions"),
    ("📊", "Financial Statement Exceptions", "Beneish, Altman and ratio-anomaly flags, ranked.", "3_Financial_Statement_Exceptions"),
    ("🎚️", "Threshold Explorer", "Drag sensitivity live and watch the exception list react.", "4_Threshold_Explorer"),
    ("📈", "Benchmark Comparison", "Naive baseline vs full ensemble — precision, recall, F1.", "5_Benchmark_Comparison"),
    ("🧾", "Audit Log", "Every detection run: dataset, parameters, who, when.", "6_Audit_Log"),
    ("ℹ️", "About & Methodology", "Scope, data sources, and the compliance answer.", "7_About_Methodology"),
]
cols = st.columns(3)
for i, (icon, title, desc, page_file) in enumerate(cards):
    with cols[i % 3]:
        with st.container(border=True):
            st.markdown(f"#### {icon} {title}")
            st.caption(desc)
            st.page_link(f"pages/{page_file}.py", label=f"Open {title} →")