# backend/tests/test_three_way_match.py
import pandas as pd
from backend.adapters.ledger.three_way_match import ThreeWayMatchTest

def test_missing_po_is_flagged():
    df = pd.DataFrame({"record_id": ["a"], "amount": [1000.0], "po_reference": [None],
                        "po_amount": [None], "po_quantity": [None], "gr_reference": ["GR-1"], "gr_quantity": [10]})
    results = ThreeWayMatchTest().run(df, {"three_way_match_tolerance_pct": 0.02})
    assert len(results) == 1 and "no matching PO" in results[0].detail["violations"][0]

def test_clean_match_is_not_flagged():
    df = pd.DataFrame({"record_id": ["a"], "amount": [1000.0], "po_reference": ["PO-1"],
                        "po_amount": [1000.0], "po_quantity": [10], "gr_reference": ["GR-1"], "gr_quantity": [10]})
    assert ThreeWayMatchTest().run(df, {"three_way_match_tolerance_pct": 0.02}) == []