"""
Backtesting against real outcomes:
  - Kaggle credit-card fraud: a *different* domain (card-transaction fraud,
    not vendor/invoice fraud). NOT used to validate ledger/3-way-match logic
    — used only to show the same Isolation Forest core generalizes across
    domains, and every result from this function says so explicitly.
  - SEC AAER: real enforcement-action outcomes — the strongest real
    validation source for the financial-statement domain.
  - USASpending.gov: real procurement data, used similarly via debarment
    records as a ledger-adjacent labeled outcome.
"""

import pandas as pd

from backend.ml.isolation_forest import run_isolation_forest
from backend.ml.model_utils import build_feature_matrix
from backend.validation.metrics import compute_prf, scores_to_labels


def cross_domain_isolation_forest_check(kaggle_df: pd.DataFrame, feature_cols: list[str],
                                          label_col: str = "Class", threshold: float = 0.5) -> dict:
    X, ids = build_feature_matrix(kaggle_df.reset_index(), feature_cols, "index")
    scores = run_isolation_forest(X, contamination=kaggle_df[label_col].mean())
    score_map = dict(zip(ids, scores))
    y_true = kaggle_df[label_col].tolist()
    y_pred = [scores_to_labels(score_map, threshold)[i] for i in ids]
    return {
        "note": ("Cross-domain generalization check only — card-transaction "
                 "fraud is a different domain from vendor/invoice fraud; "
                 "these results do not validate ledger detection logic."),
        **compute_prf(y_true, y_pred),
    }


def backtest_against_labels(scores: dict[str, float], labels: dict[str, int],
                             threshold: float = 0.5, source: str = "sec_aaer") -> dict:
    """Shared shape for both SEC AAER (financial_statement domain) and
    USASpending-derived labels (ledger domain)."""
    common_ids = [rid for rid in scores if rid in labels]
    y_true = [labels[rid] for rid in common_ids]
    y_pred = [int(scores[rid] >= threshold) for rid in common_ids]
    return {"source": source, "n_labeled_records": len(common_ids), **compute_prf(y_true, y_pred)}