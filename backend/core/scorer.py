# backend/core/scorer.py
"""Combines individual detection sub-test outputs into one ranked exception list."""

from collections import defaultdict
import pandas as pd

from backend.core.base import DetectionTest, TestResult
from backend.core.reason_codes import build_reason_codes


def combine_results(
    results_by_test: dict[str, list[TestResult]],
    total_domain_tests: int | None = None,
) -> list[dict]:
    per_record_scores: dict[str, dict[str, float]] = defaultdict(dict)
    per_record_detail: dict[str, dict[str, dict]] = defaultdict(dict)

    for test_name, results in results_by_test.items():
        for r in results:
            per_record_scores[r.record_id][test_name] = r.score
            per_record_detail[r.record_id][test_name] = r.detail

    num_tests = total_domain_tests or max(len(results_by_test), 1)

    exceptions = []
    for record_id, scores in per_record_scores.items():
        # Average across all domain tests — tests that didn't fire
        # for this record are implicitly scored as 0.
        ens_score = sum(scores.values()) / num_tests
        exceptions.append({
            "source_record_id": str(record_id),
            "ensemble_score": round(float(ens_score), 4),
            "individual_scores": {k: round(float(v), 4) for k, v in scores.items()},
            "reason_codes": build_reason_codes(scores, per_record_detail[record_id]),
        })

    exceptions.sort(key=lambda e: e["ensemble_score"], reverse=True)
    return exceptions


def run_tests_and_score(
    df: pd.DataFrame,
    tests: list[DetectionTest],
    config_by_test: dict[str, dict],
) -> list[dict]:
    results_by_test = {
        test.name: test.run(df, config_by_test.get(test.name, {}))
        for test in tests
    }
    return combine_results(results_by_test, total_domain_tests=len(tests))