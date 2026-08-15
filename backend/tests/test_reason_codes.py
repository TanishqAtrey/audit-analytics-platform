# backend/tests/test_reason_codes.py
from backend.core.reason_codes import build_reason_codes

def test_reason_codes_are_ordered_by_contribution():
    scores = {"benford_ensemble": 0.3, "duplicate_detection": 0.9}
    details = {"benford_ensemble": {"group_key": "vendor 'Acme'"},
               "duplicate_detection": {"matched_record_id": "r2", "composite_similarity": 92.0,
                                        "matched_fields": ["vendor", "amount"]}}
    codes = build_reason_codes(scores, details)
    assert codes[0]["test_name"] == "duplicate_detection" and "r2" in codes[0]["explanation"]

def test_unknown_test_falls_back_to_generic_explanation():
    codes = build_reason_codes({"some_future_test": 0.7}, {"some_future_test": {}})
    assert "anomaly score" in codes[0]["explanation"]