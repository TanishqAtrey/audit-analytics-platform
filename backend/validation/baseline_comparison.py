import pandas as pd

from backend.core.scorer import combine_results
from backend.validation.metrics import compute_prf

NAIVE_BASELINE_TEST_NAME = {
    "ledger": "benford_ensemble",             # the classic single audit test
    "financial_statement": "altman_z_score",  # the classic single formula
}


def compare_baseline_vs_ensemble(
    df: pd.DataFrame, all_tests: list, domain: str,
    config_by_test: dict, labels: dict[str, int], score_threshold: float = 0.5,
) -> dict:
    naive_name = NAIVE_BASELINE_TEST_NAME[domain]
    naive_test = next(t for t in all_tests if t.name == naive_name)

    naive_exceptions = combine_results({naive_test.name: naive_test.run(df, config_by_test.get(naive_test.name, {}))})
    ensemble_exceptions = combine_results({t.name: t.run(df, config_by_test.get(t.name, {})) for t in all_tests})

    all_ids = df["record_id"].tolist()
    naive_scores = {e["source_record_id"]: e["ensemble_score"] for e in naive_exceptions}
    ensemble_scores = {e["source_record_id"]: e["ensemble_score"] for e in ensemble_exceptions}

    y_true = [labels.get(rid, 0) for rid in all_ids]
    naive_pred = [int(naive_scores.get(rid, 0.0) >= score_threshold) for rid in all_ids]
    ensemble_pred = [int(ensemble_scores.get(rid, 0.0) >= score_threshold) for rid in all_ids]

    return {
        "domain": domain, "baseline_test": naive_name,
        "baseline": compute_prf(y_true, naive_pred),
        "ensemble": compute_prf(y_true, ensemble_pred),
    }