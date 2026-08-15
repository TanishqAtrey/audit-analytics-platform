# backend/tests/test_scorer.py
from backend.core.base import TestResult
from backend.core.scorer import combine_results

def test_ensemble_averages_across_tests():
    results_by_test = {"test_a": [TestResult(record_id="r1", score=0.8, detail={})],
                        "test_b": [TestResult(record_id="r1", score=0.4, detail={})]}
    exceptions = combine_results(results_by_test)
    assert exceptions[0]["ensemble_score"] == 0.6

def test_records_are_ranked_highest_first():
    results_by_test = {"test_a": [TestResult(record_id="low", score=0.2, detail={}),
                                   TestResult(record_id="high", score=0.9, detail={})]}
    exceptions = combine_results(results_by_test)
    assert [e["source_record_id"] for e in exceptions] == ["high", "low"]