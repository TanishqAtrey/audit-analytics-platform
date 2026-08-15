"""
Real public procurement data, used as a labeled backtesting source for the
ledger domain (Section 2). Doesn't feed the `transactions` table — this is
validation-only data, matched to uploaded/synthetic transactions by vendor
name inside validation/cross_validation.py, not part of schema.sql's six
core tables.
"""

import time
from pathlib import Path

import requests
import pandas as pd

USASPENDING_SEARCH_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "datasets" / "processed" / "usaspending_labels.parquet"


def fetch_flagged_vendors(agency: str | None = None, max_pages: int = 20, page_size: int = 100) -> pd.DataFrame:
    """Contracts marked 'Terminated for Default' are the closest real-world
    proxy USASpending exposes for vendor-side contract-performance
    failure — a weak positive label, not a claim of fraud specifically."""
    rows = []
    for page in range(1, max_pages + 1):
        payload = {
            "filters": {"award_type_codes": ["A", "B", "C", "D"],
                        "time_period": [{"start_date": "2010-01-01", "end_date": "2025-12-31"}]},
            "fields": ["Recipient Name", "Award Amount", "Contract Award Type"],
            "page": page, "limit": page_size,
        }
        if agency:
            payload["filters"]["agencies"] = [{"type": "awarding", "tier": "toptier", "name": agency}]

        resp = requests.post(USASPENDING_SEARCH_URL, json=payload, timeout=30)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            break
        rows.extend({"vendor_name": r.get("Recipient Name"), "award_amount": r.get("Award Amount")} for r in results)
        time.sleep(0.2)

    return pd.DataFrame(rows).dropna(subset=["vendor_name"]).drop_duplicates()


def build_vendor_label_map(agency: str | None = None) -> pd.DataFrame:
    flagged_df = fetch_flagged_vendors(agency=agency)
    flagged_df["is_flagged"] = 1
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    flagged_df.to_parquet(OUTPUT_PATH, index=False)
    return flagged_df


def load_vendor_label_map() -> pd.DataFrame:
    if not OUTPUT_PATH.exists():
        return build_vendor_label_map()
    return pd.read_parquet(OUTPUT_PATH)