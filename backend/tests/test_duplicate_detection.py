# backend/tests/test_duplicate_detection.py
import pandas as pd
from backend.adapters.ledger.duplicate_detection import DuplicateDetectionTest

def test_exact_duplicate_is_flagged():
    df = pd.DataFrame({
        "record_id": ["a", "b", "c"], "vendor": ["Acme Corp", "Acme Corp", "Zenith Ltd"],
        "invoice_number": ["INV-1001", "INV-1001", "INV-9999"], "amount": [4821.00, 4821.00, 300.00],
        "invoice_date": pd.to_datetime(["2026-01-05", "2026-01-06", "2026-01-05"]),
    })
    results = DuplicateDetectionTest().run(df, {"duplicate_similarity_threshold": 85.0})
    assert {"a", "b"}.issubset({r.record_id for r in results})
    assert "c" not in {r.record_id for r in results}

def test_different_vendors_never_compared():
    df = pd.DataFrame({
        "record_id": ["a", "b"], "vendor": ["Acme Corp", "Totally Different Vendor Inc"],
        "invoice_number": ["INV-1001", "INV-1001"], "amount": [4821.00, 4821.00],
        "invoice_date": pd.to_datetime(["2026-01-05", "2026-01-05"]),
    })
    assert DuplicateDetectionTest().run(df, {"duplicate_similarity_threshold": 85.0}) == []