# backend/adapters/financial_statement/adapter.py
"""Financial statement domain adapter — reshapes SEC EDGAR data with prior-year shifts."""

import pandas as pd

from backend.core.registry import register_test
from backend.adapters.financial_statement.beneish import BeneishMScoreTest
from backend.adapters.financial_statement.altman import AltmanZScoreTest
from backend.adapters.financial_statement.ratio_anomaly import RatioAnomalyTest

register_test(BeneishMScoreTest)
register_test(AltmanZScoreTest)
register_test(RatioAnomalyTest)

REQUIRED_LINE_ITEMS = [
    "ticker", "fiscal_year", "revenue", "cogs", "receivables",
    "current_assets", "ppe", "total_assets", "depreciation",
    "sga_expense", "current_liabilities", "long_term_debt",
    "net_income", "cash_flow_ops", "retained_earnings",
    "market_value_equity", "total_liabilities",
]


def reshape_with_prior_year(raw_df: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in REQUIRED_LINE_ITEMS if c not in raw_df.columns]
    if missing:
        raise ValueError(f"Financial statement adapter: missing required columns {missing}")

    df = raw_df.sort_values(["ticker", "fiscal_year"]).copy()
    if "ebit" not in df.columns:
        df["ebit"] = (df["revenue"] - df["cogs"] - df["sga_expense"] - df["depreciation"]).round(2)

    df["record_id"] = df["ticker"] + "_" + df["fiscal_year"].astype(str)

    shift_cols = [c for c in REQUIRED_LINE_ITEMS if c not in ("ticker",)] + ["ebit"]
    prior = df.groupby("ticker")[shift_cols].shift(1)
    prior.columns = [f"{c}_prior" for c in shift_cols]
    df = pd.concat([df, prior], axis=1)

    # Null out prior-year data where fiscal years are not contiguous
    if "fiscal_year_prior" in df.columns:
        non_contiguous = (df["fiscal_year"] - df["fiscal_year_prior"]) != 1
        prior_col_names = [f"{c}_prior" for c in shift_cols]
        df.loc[non_contiguous, prior_col_names] = pd.NA

    df.attrs["rows_without_prior_year"] = int(df["revenue_prior"].isna().sum())
    return df