# data_infra/ingestion/synthetic_ledger_generator.py
"""Generates synthetic PO/Invoice/Goods Receipt data for 3-way-match testing.
All data is clearly labeled as synthetic."""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from backend.config import get_settings

settings = get_settings()


def generate_synthetic_ledger(n_records: int = 500, seed: int = 42) -> pd.DataFrame:
    """Generate a synthetic ledger DataFrame with PO, invoice, and GR fields."""
    rng = np.random.default_rng(seed)
    base_date = datetime(2024, 1, 1)
    vendors = ["Alpha Supply Co", "Beta Logistics", "Gamma Materials",
               "Delta Services", "Epsilon Parts"]
    records = []
    for i in range(n_records):
        vendor = rng.choice(vendors)
        amount = round(float(np.exp(rng.uniform(np.log(50), np.log(50000)))), 2)
        po_amount = round(amount * rng.uniform(0.98, 1.02), 2)
        qty = int(rng.integers(1, 100))
        records.append({
            "vendor": vendor,
            "amount": amount,
            "invoice_number": f"INV-{i:05d}",
            "invoice_date": base_date + timedelta(days=int(rng.integers(0, 365))),
            "po_reference": f"PO-{i:04d}" if rng.random() > 0.1 else None,
            "po_amount": po_amount if rng.random() > 0.1 else None,
            "po_quantity": qty,
            "gr_reference": f"GR-{i:04d}" if rng.random() > 0.1 else None,
            "gr_quantity": qty if rng.random() > 0.05 else int(qty * 0.8),
            "currency": settings.default_currency,
        })
    return pd.DataFrame(records)
