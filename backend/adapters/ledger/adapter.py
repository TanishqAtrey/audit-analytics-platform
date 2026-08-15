# backend/adapters/ledger/adapter.py
"""Ledger domain adapter — reshapes raw transaction data into the core's contract."""

import pandas as pd

from backend.core.registry import register_test
from backend.adapters.ledger.benford import BenfordEnsembleTest
from backend.adapters.ledger.duplicate_detection import DuplicateDetectionTest
from backend.adapters.ledger.three_way_match import ThreeWayMatchTest
from backend.adapters.ledger.transaction_anomaly import TransactionAnomalyTest

register_test(BenfordEnsembleTest)
register_test(DuplicateDetectionTest)
register_test(ThreeWayMatchTest)
register_test(TransactionAnomalyTest)

REQUIRED_COLUMNS = ["record_id", "vendor", "amount"]


def reshape_transactions(raw_df: pd.DataFrame) -> pd.DataFrame:
    df = raw_df.copy()

    if "id" in df.columns:
        df["record_id"] = df["id"].astype(str)
    elif "record_id" not in df.columns:
        df["record_id"] = df.index.astype(str)

    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df["vendor"] = df["vendor"].astype(str).str.strip()

    if "invoice_date" in df.columns:
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce")
    else:
        df["invoice_date"] = pd.NaT

    if "invoice_number" not in df.columns:
        df["invoice_number"] = ""

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Ledger adapter: missing required columns {missing}")

    before = len(df)
    df = df.dropna(subset=["amount"])
    dropped = before - len(df)
    if dropped:
        df.attrs["dropped_rows_no_amount"] = dropped

    return df