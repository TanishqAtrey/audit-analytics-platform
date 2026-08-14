# backend/adapters/financial_statement/altman.py
"""Altman Z-Score bankruptcy / financial distress prediction model."""

import numpy as np
import pandas as pd

from backend.core.base import DetectionTest, TestResult


def _zone(z: float) -> str:
    if z > 2.99:
        return "safe"
    if z >= 1.81:
        return "grey"
    return "distress"


class AltmanZScoreTest(DetectionTest):
    name = "altman_z_score"
    domain = "financial_statement"

    def run(self, df: pd.DataFrame, config: dict) -> list[TestResult]:
        results = []
        for _, row in df.iterrows():
            total_assets = row.get("total_assets")
            if not total_assets or pd.isna(total_assets) or float(total_assets) <= 0:
                continue

            total_assets = float(total_assets)
            working_capital = float(row["current_assets"]) - float(row["current_liabilities"])
            a = working_capital / total_assets
            b = float(row["retained_earnings"]) / total_assets
            c = float(row["net_income"]) / total_assets

            tot_liab = float(row.get("total_liabilities", 0.0))
            if tot_liab <= 0:
                continue
            d = float(row["market_value_equity"]) / tot_liab
            e = float(row["revenue"]) / total_assets

            z = 1.2 * a + 1.4 * b + 3.3 * c + 0.6 * d + 1.0 * e
            zone = _zone(z)
            if zone == "safe":
                continue

            score = 0.85 if zone == "distress" else 0.50
            results.append(
                TestResult(
                    record_id=str(row["record_id"]),
                    score=score,
                    detail={
                        "z_score": round(float(z), 3),
                        "zone": zone,
                        "components": {
                            "working_capital_ratio": round(a, 3),
                            "retained_earnings_ratio": round(b, 3),
                            "ebit_proxy_ratio": round(c, 3),
                            "market_leverage_ratio": round(d, 3),
                            "asset_turnover": round(e, 3),
                        },
                    },
                )
            )
        return results