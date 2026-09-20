import pandas as pd

from backend.core.scorer import combine_results
from backend.validation.metrics import compute_prf

NAIVE_BASELINE_TEST_NAME = {
    "ledger": "benford_ensemble",
    "financial_statement": "altman_z_score",
}

DEFAULT_THRESHOLDS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]


def compare_baseline_vs_ensemble(
    df: pd.DataFrame, all_tests: list, domain: str,
    config_by_test: dict, labels: dict[str, int],
    thresholds: list[float] | None = None,
) -> dict:
    score_thresholds = thresholds or DEFAULT_THRESHOLDS
    naive_name = NAIVE_BASELINE_TEST_NAME[domain]
    naive_test = next(t for t in all_tests if t.name == naive_name)

    naive_exceptions = combine_results({naive_test.name: naive_test.run(df, config_by_test.get(naive_test.name, {}))})
    ensemble_exceptions = combine_results({t.name: t.run(df, config_by_test.get(t.name, {})) for t in all_tests})

    all_ids = df["record_id"].tolist()
    naive_scores = {e["source_record_id"]: e["ensemble_score"] for e in naive_exceptions}
    ensemble_scores = {e["source_record_id"]: e["ensemble_score"] for e in ensemble_exceptions}
    y_true = [labels.get(rid, 0) for rid in all_ids]

    baseline_p, baseline_r, baseline_f = [], [], []
    ensemble_p, ensemble_r, ensemble_f = [], [], []

    for t in score_thresholds:
        naive_pred = [int(naive_scores.get(rid, 0.0) >= t) for rid in all_ids]
        ens_pred = [int(ensemble_scores.get(rid, 0.0) >= t) for rid in all_ids]

        bp = compute_prf(y_true, naive_pred)
        ep = compute_prf(y_true, ens_pred)

        baseline_p.append(bp["precision"])
        baseline_r.append(bp["recall"])
        baseline_f.append(bp["f1"])
        ensemble_p.append(ep["precision"])
        ensemble_r.append(ep["recall"])
        ensemble_f.append(ep["f1"])

    return {
        "domain": domain,
        "baseline_test": naive_name,
        "thresholds": score_thresholds,
        "baseline": {"precision": baseline_p, "recall": baseline_r, "f1": baseline_f},
        "ensemble": {"precision": ensemble_p, "recall": ensemble_r, "f1": ensemble_f},
    }