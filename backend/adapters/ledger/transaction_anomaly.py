# backend/adapters/ledger/transaction_anomaly.py
"""Unsupervised ML Anomaly Detection (Isolation Forest + LOF) on ledger transactions."""

import numpy as np
import pandas as pd

from backend.core.base import DetectionTest, TestResult
from backend.ml.isolation_forest import run_isolation_forest
from backend.ml.lof import run_lof
from backend.ml.model_utils import build_feature_matrix
from backend.config import get_settings

settings = get_settings()

class TransactionAnomalyTest(DetectionTest):
    name = "ledger_transaction_anomaly"
    domain = "ledger"

    def run(self, df: pd.DataFrame, config: dict) -> list[TestResult]:
        if len(df) < settings.min_ml_sample_size:
            return []

        work_df = df.copy()
        work_df["log_amount"] = np.log1p(work_df["amount"].abs().clip(lower=1.0))
        vendor_counts = work_df["vendor"].value_counts()
        work_df["vendor_freq"] = work_df["vendor"].map(vendor_counts)

        feature_cols = ["log_amount", "vendor_freq"]
        X, record_ids = build_feature_matrix(work_df, feature_cols, "record_id")

        if_contamination = config.get("isolation_forest_contamination", settings.default_isolation_forest_contamination)
        lof_contamination = config.get("lof_contamination", settings.default_lof_contamination)

        if_scores = run_isolation_forest(X, contamination=if_contamination)
        lof_scores = run_lof(X, contamination=lof_contamination)

        results = []
        for rid, if_s, lof_s in zip(record_ids, if_scores, lof_scores):
            combined = float((if_s + lof_s) / 2.0)
            if combined < settings.ml_combined_score_floor:
                continue
            results.append(
                TestResult(
                    record_id=str(rid),
                    score=min(1.0, combined),
                    detail={
                        "isolation_forest_score": round(float(if_s), 3),
                        "lof_score": round(float(lof_s), 3),
                        "features_used": feature_cols,
                    },
                )
            )
        return results