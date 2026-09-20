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


def compute_altman_metrics(row: pd.Series | dict) -> dict:
    total_assets = row.get("total_assets")
    if not total_assets or pd.isna(total_assets) or float(total_assets) <= 0:
        return {}

    tot_assets = float(total_assets)
    ca = float(row.get("current_assets") or 0.0)
    cl = float(row.get("current_liabilities") or 0.0)
    re = float(row.get("retained_earnings") or 0.0)
    mve = float(row.get("market_value_equity") or 0.0)
    rev = float(row.get("revenue") or 0.0)
    tl = float(row.get("total_liabilities") or 0.0)
    if tl <= 0:
        return {}

    ebit_val = row.get("ebit")
    if ebit_val is not None and not pd.isna(ebit_val):
        ebit = float(ebit_val)
    else:
        cogs = float(row.get("cogs") or 0.0)
        sga = float(row.get("sga_expense") or 0.0)
        dep = float(row.get("depreciation") or 0.0)
        if rev > 0 and (cogs > 0 or sga > 0):
            ebit = rev - cogs - sga - dep
        else:
            ebit = float(row.get("net_income") or 0.0)

    x1 = (ca - cl) / tot_assets
    x2 = re / tot_assets
    x3 = ebit / tot_assets
    x4 = mve / tl
    x5 = rev / tot_assets

    z = (
        settings.altman_coeff_a * x1
        + settings.altman_coeff_b * x2
        + settings.altman_coeff_c * x3
        + settings.altman_coeff_d * x4
        + settings.altman_coeff_e * x5
    )
    zone = _zone(z, settings.altman_safe_threshold, settings.altman_grey_threshold)

    return {
        "x1_wc_ta": round(x1, 4),
        "x2_re_ta": round(x2, 4),
        "x3_ebit_ta": round(x3, 4),
        "x4_mve_tl": round(x4, 4),
        "x5_sales_ta": round(x5, 4),
        "z_score": round(float(z), 4),
        "zone": zone,
    }


class AltmanZScoreTest(DetectionTest):
    name = "altman_z_score"
    domain = "financial_statement"

    def run(self, df: pd.DataFrame, config: dict) -> list[TestResult]:
        results = []
        for _, row in df.iterrows():
            metrics = compute_altman_metrics(row)
            if not metrics:
                continue

            zone = metrics["zone"]
            if zone == "safe":
                continue

            score = settings.altman_distress_score if zone == "distress" else settings.altman_grey_score
            results.append(
                TestResult(
                    record_id=str(row["record_id"]),
                    score=score,
                    detail={
                        "z_score": round(metrics["z_score"], 3),
                        "zone": zone,
                        "components": {
                            "x1_working_capital_ratio": metrics["x1_wc_ta"],
                            "x2_retained_earnings_ratio": metrics["x2_re_ta"],
                            "x3_ebit_ratio": metrics["x3_ebit_ta"],
                            "x4_market_leverage_ratio": metrics["x4_mve_tl"],
                            "x5_asset_turnover": metrics["x5_sales_ta"],
                            # Backward compatible keys
                            "working_capital_ratio": metrics["x1_wc_ta"],
                            "retained_earnings_ratio": metrics["x2_re_ta"],
                            "ebit_proxy_ratio": metrics["x3_ebit_ta"],
                            "market_leverage_ratio": metrics["x4_mve_tl"],
                            "asset_turnover": metrics["x5_sales_ta"],
                        },
                    },
                )
            )
        return results