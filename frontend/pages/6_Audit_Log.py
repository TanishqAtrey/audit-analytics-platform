import streamlit as st
from frontend import api_client
from frontend.theme import inject_theme, render_hero, PALETTE

st.set_page_config(page_title="Audit Log · Audit Analytics", page_icon="🧾", layout="wide")
inject_theme()
render_hero("Audit", "Log", "Every detection run: when, on what dataset, with which parameters, by whom.")

c1, c2, c3 = st.columns(3)
start_date = c1.date_input("From", value=None, key="audit_start")
end_date = c2.date_input("To", value=None, key="audit_end")
module_filter = c3.text_input("Filter by module (e.g. benford_ensemble)", key="audit_module")

log = api_client.get_audit_log(start_date=str(start_date) if start_date else None,
                                end_date=str(end_date) if end_date else None, module=module_filter or None)
if "error" in log:
    st.error(f"Could not load audit log: {log['error']}")
    st.stop()

st.metric("Total logged runs (matching filters)", log["total"])
st.divider()

if not log["entries"]:
    st.info("No runs match these filters yet.")

for entry in log["entries"]:
    with st.container(border=True):
        top = st.columns([2, 2, 2])
        top[0].markdown(f"**Run #{entry['id']}** · {entry['run_timestamp']}")
        top[1].markdown(f"👤 {entry['run_by']}")
        top[2].markdown(f"📁 `{entry['dataset_used']}`")
        badges = " ".join(f"<span style='background:{PALETTE['blue']}22;color:{PALETTE['blue']};padding:2px 8px;border-radius:8px;margin-right:4px;font-size:0.8rem;'>{m}</span>"
                           for m in entry["modules_run"])
        st.markdown(badges, unsafe_allow_html=True)
        with st.expander("Parameters used"):
            st.code(str(entry["parameters"]), language="json")