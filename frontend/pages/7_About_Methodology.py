import streamlit as st
from frontend import api_client
from frontend.theme import inject_theme, render_hero

st.set_page_config(page_title="About & Methodology · Audit Analytics", page_icon="ℹ️", layout="wide")
inject_theme()
render_hero("About &", "Methodology", "Scope, data sources, and the honest limitations — read before the demo.")

health = api_client.health_check()
st.error(f"🔴 Backend unreachable: {health['error']}") if "error" in health else st.success(f"🟢 Backend online (env: `{health.get('env', 'unknown')}`)")

st.markdown("""
### Architecture: one shared core, two thin adapters
Both the **ledger domain** and the **financial-statement domain** feed a single detection engine.
Each domain only supplies a small adapter that reshapes its data and registers its own tests —
ensembling, scoring, reason-code generation, and parallel execution are written exactly once.

### What's real data vs. synthetic
- **Benford's Law, duplicate detection** — run against whatever ledger data you upload.
- **3-way match** — runs on **synthetic** data only; every reason code is labeled `synthetic-data-validated`.
- **Beneish, Altman, ratio anomalies** — real SEC EDGAR XBRL data for a **curated list** of companies, not a generic parser.
- **Kaggle credit-card fraud data** — shows the Isolation Forest core generalizes across domains; never used to validate ledger results.
- **USASpending.gov / SEC AAER** — real outcomes used for backtesting precision/recall where labels exist.

### Explicitly out of scope
No enterprise auth/RBAC, no encryption-at-rest, no PII pipeline, no generic SEC-EDGAR parser,
no SHAP-based explainability, no microservices or cloud deployment.

### Compliance stance
Every data source is **public**. **No personally identifiable information is collected, stored, or
processed.** Every detection run is written to the audit trail — see **Audit Log**.
""")