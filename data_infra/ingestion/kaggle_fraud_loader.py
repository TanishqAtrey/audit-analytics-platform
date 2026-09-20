# data_infra/ingestion/kaggle_fraud_loader.py
"""Kaggle credit-card fraud dataset loader.
Used ONLY for cross-domain Isolation Forest generalization check —
not for validating ledger/3-way-match logic."""

import pandas as pd


def load_kaggle_fraud_csv(file_path: str) -> pd.DataFrame:
    """Load the Kaggle credit-card fraud CSV and return a clean DataFrame."""
    df = pd.read_csv(file_path)
    required = {"Time", "Amount", "Class"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Kaggle fraud CSV missing required columns: {missing}")
    return df
