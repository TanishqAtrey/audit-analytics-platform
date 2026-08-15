"""
Kaggle credit-card fraud dataset — a *different* domain (card-transaction
fraud, not vendor/invoice fraud). Used only by validation/cross_validation.py
to show the Isolation Forest core generalizes across domains — never used
to validate ledger or 3-way-match logic (Section 2 is explicit on this).

Requires Kaggle API credentials (~/.kaggle/kaggle.json) to auto-download;
falls back to a committed sample so the demo runs cold without them.
"""

from pathlib import Path
import pandas as pd

RAW_PATH = Path(__file__).resolve().parents[1] / "datasets" / "raw" / "creditcard.csv"
SAMPLE_PATH = Path(__file__).resolve().parents[1] / "datasets" / "sample" / "creditcard_sample.csv"
KAGGLE_DATASET = "mlg-ulb/creditcardfraud"


def download_full_dataset() -> Path:
    """Only called explicitly (e.g. from seed_demo_data.py with a flag) —
    never a silent fallback, since it needs credentials the demo laptop
    may not have."""
    import kaggle  # imported lazily so this module loads without the package installed

    RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
    kaggle.api.dataset_download_files(KAGGLE_DATASET, path=RAW_PATH.parent, unzip=True)
    return RAW_PATH


def load_kaggle_fraud_data(use_sample_if_missing: bool = True) -> pd.DataFrame:
    if RAW_PATH.exists():
        return pd.read_csv(RAW_PATH)
    if use_sample_if_missing and SAMPLE_PATH.exists():
        return pd.read_csv(SAMPLE_PATH)
    raise FileNotFoundError(
        f"Neither {RAW_PATH} nor the committed sample at {SAMPLE_PATH} exist. "
        f"Run download_full_dataset() first, or commit a small sample."
    )