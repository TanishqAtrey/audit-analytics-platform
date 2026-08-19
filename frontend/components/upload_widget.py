import streamlit as st
from frontend import api_client


def render_ledger_upload_widget() -> None:
    st.markdown("##### 📤 Upload Ledger CSV")
    st.caption("Required columns: `vendor`, `amount`. Optional: `invoice_number`, `invoice_date`, `po_reference`, `gr_reference`.")
    uploaded_file = st.file_uploader("Choose a CSV file", type=["csv"], key="ledger_csv_uploader")

    if uploaded_file is not None and st.button("Ingest into Postgres", key="ingest_ledger_btn", type="primary"):
        with st.spinner("Uploading and validating..."):
            result = api_client.upload_ledger_csv(uploaded_file.getvalue(), uploaded_file.name)

        if "error" in result:
            st.error(f"Upload failed: {result['error']}")
            return

        st.session_state["ledger_dataset_id"] = result["dataset_id"]
        st.success(f"Ingested {result['rows_ingested']} rows across {result['vendors_detected']} vendors.")
        for w in result.get("warnings", []):
            st.warning(w)
        if result.get("date_range"):
            st.caption(f"Date range: {result['date_range'][0]} → {result['date_range'][1]}")
        st.code(f'dataset_id = "{result["dataset_id"]}"', language="text")


def render_company_selector_widget() -> None:
    st.markdown("##### 🏢 Select Curated SEC EDGAR Companies")
    companies_result = api_client.list_curated_companies()
    if "error" in companies_result:
        st.error(f"Could not load curated company list: {companies_result['error']}")
        return

    companies = companies_result["companies"]
    labels = {f"{c['ticker']} — {c['company_name']}" + (" ⚠️ AAER" if c["is_aaer_fraud_case"] else ""): c["ticker"]
              for c in companies}
    selected_labels = st.multiselect("Companies", options=list(labels.keys()), key="fs_company_multiselect")
    fiscal_years = st.multiselect("Fiscal years (leave empty for all)", options=list(range(2010, 2026)), key="fs_fiscal_years")

    if st.button("Load Financial Statements", key="load_fs_btn", type="primary", disabled=not selected_labels):
        tickers = [labels[l] for l in selected_labels]
        with st.spinner("Loading from Postgres..."):
            result = api_client.select_financial_statements(tickers, fiscal_years or None)

        if "error" in result:
            st.error(f"Failed to load: {result['error']}")
            return

        st.session_state["fs_dataset_id"] = result["dataset_id"]
        st.success(f"Loaded {result['rows_loaded']} statement-years for {len(result['tickers_loaded'])} companies.")
        if result.get("tickers_missing"):
            st.warning(f"Not in curated list: {', '.join(result['tickers_missing'])}")