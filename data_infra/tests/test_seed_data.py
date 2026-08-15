# test_seed_data.py — synthetic ledger generator is pure dataframe logic,
# no live DB needed.
from data_infra.ingestion.synthetic_ledger_generator import generate_synthetic_ledger

def test_generates_requested_row_count():
    assert len(generate_synthetic_ledger(n_rows=1000, seed=1)) == 1000

def test_every_violation_type_appears():
    df = generate_synthetic_ledger(n_rows=5000, seed=1)
    assert df["po_reference"].isna().any()
    assert df["gr_reference"].isna().any()
    assert (df["po_reference"].notna() & df["gr_reference"].notna()).any()

def test_overbilled_pairs_share_a_po_and_exceed_it():
    df = generate_synthetic_ledger(n_rows=5000, seed=1)
    totals = df.dropna(subset=["po_reference"]).groupby("po_reference").agg(
        invoiced=("amount", "sum"), po_amount=("po_amount", "first"))
    assert (totals["invoiced"] > totals["po_amount"]).any()

def test_same_seed_is_reproducible():
    a = generate_synthetic_ledger(n_rows=200, seed=7)
    b = generate_synthetic_ledger(n_rows=200, seed=7)
    assert a["amount"].tolist() == b["amount"].tolist()