import streamlit as st
from frontend import api_client
from frontend.theme import inject_theme, render_hero, PALETTE
from frontend.components.charts import benchmark_comparison_chart

st.set_page_config(page_title="Benchmark Comparison · Audit Analytics", page_icon="📈", layout="wide")
inject_theme()
render_hero("Benchmark", "Comparison", "Naive single-test baseline vs the full ensemble.")

domain = st.radio("Domain", ["ledger", "financial_statement"], horizontal=True, key="benchmark_domain")
dataset_id = st.session_state.get("ledger_dataset_id" if domain == "ledger" else "fs_dataset_id")

if st.button("🔁 Recompute Benchmark", type="primary", disabled=not dataset_id):
    with st.spinner("Running baseline and ensemble, scoring against labeled outcomes..."):
        result = api_client.run_benchmark(domain, dataset_id)
    if "error" in result:
        st.error(f"Benchmark run failed: {result['error']}")
    else:
        st.session_state[f"benchmark_{domain}"] = result
        st.toast("Benchmark recomputed and saved.", icon="📊")

if not dataset_id:
    st.caption(f"Load a {domain.replace('_', ' ')} dataset on **Upload Data** to recompute. You can still view the last saved benchmark below.")

cached = api_client.get_benchmark(domain)
result = st.session_state.get(f"benchmark_{domain}", cached if "error" not in cached else None)

if result is None:
    st.info(f"No benchmark computed yet for `{domain}`. Click **Recompute Benchmark** once a dataset is loaded.")
else:
    baseline, ensemble = result["baseline"], result["ensemble"]
    st.plotly_chart(benchmark_comparison_chart(baseline, ensemble, baseline_label=f"Naive: {result.get('baseline_test', 'single test')}"),
                     use_container_width=True, key=f"benchmark_chart_{domain}")
    f1_lift = (ensemble["f1"] - baseline["f1"]) / baseline["f1"] * 100 if baseline["f1"] else 0
    st.markdown(f"<div style='text-align:center;font-size:1.3rem;font-weight:700;color:{PALETTE['green']};'>F1 improved {f1_lift:+.1f}% by ensembling</div>",
                unsafe_allow_html=True)