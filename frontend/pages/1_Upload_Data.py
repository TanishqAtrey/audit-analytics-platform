import streamlit as st
from frontend.theme import inject_theme, render_hero
from frontend.components.upload_widget import render_ledger_upload_widget, render_company_selector_widget

st.set_page_config(page_title="Upload Data · Audit Analytics", page_icon="📤", layout="wide")
inject_theme()
render_hero("Upload", "Data", "Ledger CSVs and curated SEC EDGAR company-facts — the two domains' raw inputs.")

st.info("All data sources are public. No PII is collected or stored — see **About & Methodology** for the full compliance statement.", icon="🔒")

ledger_tab, fs_tab = st.tabs(["📒 Ledger (Transactions)", "📊 Financial Statements"])
with ledger_tab:
    render_ledger_upload_widget()
    if st.session_state.get("ledger_dataset_id"):
        st.success(f"Active ledger dataset: `{st.session_state['ledger_dataset_id']}` — head to **Ledger Exceptions**.")
with fs_tab:
    render_company_selector_widget()
    if st.session_state.get("fs_dataset_id"):
        st.success(f"Active financial-statement dataset: `{st.session_state['fs_dataset_id']}` — head to **Financial Statement Exceptions**.")