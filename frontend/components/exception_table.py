import streamlit as st
from frontend import api_client
from frontend.components.reason_code_badge import render_reason_codes
from frontend.components.charts import score_gauge

STATUS_LABELS = {"unreviewed": "🕓 Unreviewed", "confirmed": "✅ Confirmed",
                  "false_positive": "🚫 False Positive", "needs_review": "🔎 Needs Review"}
STATUS_COLORS = {"unreviewed": "#94A3B8", "confirmed": "#22C55E",
                  "false_positive": "#64748B", "needs_review": "#F59E0B"}


def render_exception_table(exceptions: list[dict], key_prefix: str) -> None:
    if not exceptions:
        st.info("No exceptions match the current filters.")
        return

    for exc in exceptions:
        with st.container(border=True):
            header = st.columns([3, 2, 2, 3])
            header[0].markdown(f"**Record:** `{exc['source_record_id']}`")
            header[1].markdown(f"**Score:** {exc['ensemble_score']:.2f}")
            status = exc["status"]
            header[2].markdown(f"<span style='color:{STATUS_COLORS[status]};font-weight:600'>{STATUS_LABELS[status]}</span>",
                                unsafe_allow_html=True)

            with header[3]:
                new_status = st.selectbox("Update status", options=list(STATUS_LABELS.keys()),
                                           format_func=lambda s: STATUS_LABELS[s],
                                           index=list(STATUS_LABELS.keys()).index(status),
                                           key=f"{key_prefix}_status_{exc['id']}", label_visibility="collapsed")
                if new_status != status:
                    reviewer = st.session_state.get("reviewer_name", "demo_user")
                    result = api_client.update_case_status(exc["id"], new_status, reviewer)
                    if "error" in result:
                        st.error(f"Failed to update status: {result['error']}")
                    else:
                        st.success("Status updated.")
                        st.rerun()

            detail_col, gauge_col = st.columns([3, 1])
            with detail_col:
                render_reason_codes(exc["reason_codes"])
            with gauge_col:
                st.plotly_chart(score_gauge(exc["ensemble_score"]), use_container_width=True,
                                 key=f"{key_prefix}_gauge_{exc['id']}")