import uuid
import numpy as np
import pandas as pd

from data_infra.db.connection import bulk_copy_dataframe

VENDORS = [f"Vendor {chr(65 + i)} Supplies Inc." for i in range(15)]
VIOLATION_MIX = {
    "clean": 0.70, "missing_po": 0.08, "missing_gr": 0.08,
    "price_variance": 0.07, "quantity_variance": 0.05, "po_overbilled": 0.02,
}


def generate_synthetic_ledger(n_rows: int = 5000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dataset_id = f"synthetic_3wm_{uuid.uuid4().hex[:8]}"

    overbilled_share = VIOLATION_MIX["po_overbilled"]
    n_overbilled_pairs = int(n_rows * overbilled_share / 2)  # each pair = 2 rows
    n_base_rows = n_rows - (n_overbilled_pairs * 2)

    base_mix = {k: v for k, v in VIOLATION_MIX.items() if k != "po_overbilled"}
    types, probs = list(base_mix.keys()), np.array(list(base_mix.values()))
    probs = probs / probs.sum()
    violation_types = rng.choice(types, size=n_base_rows, p=probs)

    rows = []
    for i, violation in enumerate(violation_types):
        vendor = rng.choice(VENDORS)
        base_amount = round(float(rng.uniform(50, 25000)), 2)
        po_ref, gr_ref = f"PO-{100000 + i}", f"GR-{100000 + i}"
        po_qty = int(rng.integers(1, 500))
        po_amount, gr_qty, invoice_amount = base_amount, po_qty, base_amount

        if violation == "missing_po":
            po_ref, po_amount, po_qty = None, None, None
        elif violation == "missing_gr":
            gr_ref, gr_qty = None, None
        elif violation == "price_variance":
            invoice_amount = round(base_amount * float(rng.uniform(1.05, 1.30)), 2)
        elif violation == "quantity_variance":
            gr_qty = max(0, po_qty - int(rng.integers(5, 50)))

        rows.append({
            "vendor": vendor, "amount": invoice_amount, "invoice_number": f"INV-{200000 + i}",
            "invoice_date": pd.Timestamp("2025-01-01") + pd.Timedelta(days=int(rng.integers(0, 365))),
            "po_reference": po_ref, "po_amount": po_amount, "po_quantity": po_qty,
            "gr_reference": gr_ref, "gr_quantity": gr_qty, "source_dataset": dataset_id,
        })

    # Overbilling needs two invoices against one PO whose combined total
    # exceeds it — the per-row loop above can't produce that alone.
    for j in range(n_overbilled_pairs):
        vendor = rng.choice(VENDORS)
        po_amount = round(float(rng.uniform(500, 25000)), 2)
        po_ref, gr_ref = f"PO-{300000 + j}", f"GR-{300000 + j}"
        po_qty = int(rng.integers(1, 500))
        split = float(rng.uniform(0.55, 0.70))

        for k, fraction in enumerate((split, 1.0 - split + 0.15)):  # +0.15 guarantees overshoot
            rows.append({
                "vendor": vendor, "amount": round(po_amount * fraction, 2),
                "invoice_number": f"INV-{400000 + j * 2 + k}",
                "invoice_date": pd.Timestamp("2025-01-01") + pd.Timedelta(days=int(rng.integers(0, 365))),
                "po_reference": po_ref, "po_amount": po_amount, "po_quantity": po_qty,
                "gr_reference": gr_ref, "gr_quantity": po_qty, "source_dataset": dataset_id,
            })

    return pd.DataFrame(rows)


def generate_and_persist_synthetic_ledger(n_rows: int = 5000) -> tuple[str, int]:
    df = generate_synthetic_ledger(n_rows)
    columns = ["vendor", "amount", "invoice_number", "invoice_date", "po_reference",
               "po_amount", "po_quantity", "gr_reference", "gr_quantity", "source_dataset"]
    n_written = bulk_copy_dataframe(df, "transactions", columns)
    return df["source_dataset"].iloc[0], n_written