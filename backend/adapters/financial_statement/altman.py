# backend/adapters/financial_statement/altman.py
"""Altman Z-Score bankruptcy / financial distress prediction model."""

import numpy as np
import pandas as pd

from backend.core.base import DetectionTest, TestResult
from backend.config import get_settings

settings = get_settings()

def _zone(z: float, safe_threshold: float, grey_threshold: float) -> str:
    if z > safe_threshold:
        return "safe"
    if z >= grey_threshold:
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

            # Skip rows with NaN in any required field
            required_fields = ["current_assets", "current_liabilities", "retained_earnings",
                               "net_income", "market_value_equity", "revenue", "total_liabilities"]
            if any(pd.isna(row.get(f)) for f in required_fields):
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

            z = settings.altman_coeff_a * a + settings.altman_coeff_b * b + settings.altman_coeff_c * c + settings.altman_coeff_d * d + settings.altman_coeff_e * e
            zone = _zone(z, settings.altman_safe_threshold, settings.altman_grey_threshold)
            if zone == "safe":
                continue

            score = settings.altman_distress_score if zone == "distress" else settings.altman_grey_score
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