# backend/adapters/financial_statement/beneish.py
"""Beneish M-Score 8-variable earnings manipulation detection model."""

import numpy as np
import pandas as pd

from backend.core.base import DetectionTest, TestResult

M_SCORE_THRESHOLD = -2.22

COEFFICIENTS = {
    "DSRI": 0.920,
    "GMI": 0.528,
    "AQI": 0.404,
    "SGI": 0.892,
    "DEPI": 0.115,
    "SGAI": -0.172,
    "LVGI": -0.327,
    "TATA": 4.679,
}
INTERCEPT = -4.84


def _safe_div(a: float, b: float) -> float:
    if pd.isna(a) or pd.isna(b) or b == 0:
        return np.nan
    try:
        val = float(a) / float(b)
        return val if not (np.isinf(val) or np.isnan(val)) else np.nan
    except ZeroDivisionError:
        return np.nan


def _compute_variables(row: pd.Series) -> dict[str, float]:
    dsr_curr = _safe_div(row["receivables"], row["revenue"])
    dsr_prior = _safe_div(row["receivables_prior"], row["revenue_prior"])
    dsri = _safe_div(dsr_curr, dsr_prior)

    gm_prior = _safe_div(row["revenue_prior"] - row["cogs_prior"], row["revenue_prior"])
    gm_curr = _safe_div(row["revenue"] - row["cogs"], row["revenue"])
    gmi = _safe_div(gm_prior, gm_curr)

    nca_curr = 1.0 - _safe_div(row["current_assets"] + row["ppe"], row["total_assets"])
    nca_prior = 1.0 - _safe_div(row["current_assets_prior"] + row["ppe_prior"], row["total_assets_prior"])
    aqi = _safe_div(nca_curr, nca_prior)

    sgi = _safe_div(row["revenue"], row["revenue_prior"])

    dep_prior = _safe_div(row["depreciation_prior"], row["ppe_prior"] + row["depreciation_prior"])
    dep_curr = _safe_div(row["depreciation"], row["ppe"] + row["depreciation"])
    depi = _safe_div(dep_prior, dep_curr)

    sgai_curr = _safe_div(row["sga_expense"], row["revenue"])
    sgai_prior = _safe_div(row["sga_expense_prior"], row["revenue_prior"])
    sgai = _safe_div(sgai_curr, sgai_prior)

    lvgi_curr = _safe_div(row["current_liabilities"] + row["long_term_debt"], row["total_assets"])
    lvgi_prior = _safe_div(row["current_liabilities_prior"] + row["long_term_debt_prior"], row["total_assets_prior"])
    lvgi = _safe_div(lvgi_curr, lvgi_prior)

    tata = _safe_div(row["net_income"] - row["cash_flow_ops"], row["total_assets"])

    return {
        "DSRI": dsri, "GMI": gmi, "AQI": aqi, "SGI": sgi,
        "DEPI": depi, "SGAI": sgai, "LVGI": lvgi, "TATA": tata,
    }


class BeneishMScoreTest(DetectionTest):
    name = "beneish_m_score"
    domain = "financial_statement"

    def run(self, df: pd.DataFrame, config: dict) -> list[TestResult]:
        threshold = config.get("beneish_threshold", M_SCORE_THRESHOLD)
        results = []

        for _, row in df.iterrows():
            if pd.isna(row.get("revenue_prior")):
                continue

            variables = _compute_variables(row)
            if any(pd.isna(v) for v in variables.values()):
                continue

            m_score = INTERCEPT + sum(COEFFICIENTS[k] * float(variables[k]) for k in COEFFICIENTS)
            if m_score < threshold:
                continue

            score = min(1.0, max(0.0, (m_score - threshold) / (0.0 - threshold)))
            top_drivers = sorted(
                COEFFICIENTS,
                key=lambda k: abs(COEFFICIENTS[k] * float(variables[k])),
                reverse=True,
            )[:2]

            results.append(
                TestResult(
                    record_id=str(row["record_id"]),
                    score=score,
                    detail={
                        "m_score": round(float(m_score), 3),
                        "top_drivers": top_drivers,
                        "variables": {k: round(float(v), 3) for k, v in variables.items()},
                    },
                )
            )
        return results