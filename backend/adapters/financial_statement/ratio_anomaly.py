# backend/adapters/financial_statement/ratio_anomaly.py
"""Financial statement ratio outlier detection via Isolation Forest and LOF."""

import pandas as pd
from backend.core.base import DetectionTest, TestResult
from backend.ml.isolation_forest import run_isolation_forest
from backend.ml.lof import run_lof
from backend.ml.model_utils import build_feature_matrix

RATIO_FEATURES = [
    "current_ratio", "debt_to_equity", "gross_margin",
    "asset_turnover", "receivables_turnover",
]


def _derive_ratios(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["current_ratio"] = out["current_assets"] / out["current_liabilities"].replace(0, pd.NA)
    out["debt_to_equity"] = out["total_liabilities"] / (out["total_assets"] - out["total_liabilities"]).replace(0, pd.NA)
    out["gross_margin"] = (out["revenue"] - out["cogs"]) / out["revenue"].replace(0, pd.NA)
    out["asset_turnover"] = out["revenue"] / out["total_assets"].replace(0, pd.NA)
    out["receivables_turnover"] = out["revenue"] / out["receivables"].replace(0, pd.NA)
    return out


class RatioAnomalyTest(DetectionTest):
    name = "ratio_anomaly"
    domain = "financial_statement"

    def run(self, df: pd.DataFrame, config: dict) -> list[TestResult]:
        ratios_df = _derive_ratios(df).dropna(subset=RATIO_FEATURES)
        if len(ratios_df) < 5:
            return []

        X, record_ids = build_feature_matrix(ratios_df, RATIO_FEATURES, "record_id")
        if_scores = run_isolation_forest(X, contamination=config.get("isolation_forest_contamination", 0.05))
        lof_scores = run_lof(X, contamination=config.get("lof_contamination", 0.05))

        results = []
        for record_id, if_s, lof_s in zip(record_ids, if_scores, lof_scores):
            combined = float((if_s + lof_s) / 2.0)
            if combined <= 0.25:
                continue
            results.append(
                TestResult(
                    record_id=str(record_id),
                    score=min(1.0, combined),
                    detail={
                        "isolation_forest_score": round(float(if_s), 3),
                        "lof_score": round(float(lof_s), 3),
                        "features_used": RATIO_FEATURES,
                    },
                )
            )
        return results