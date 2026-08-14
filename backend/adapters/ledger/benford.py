# backend/adapters/ledger/benford.py
"""Benford's Law ensemble: 1st-digit, 2nd-digit, and 1st-two-digit tests with
Nigrini's MAD conformity and chi-square goodness-of-fit statistics."""

import numpy as np
import pandas as pd
from scipy import stats

from backend.core.base import DetectionTest, TestResult

MIN_SAMPLE_SIZE = 30  # statistical noise floor

MAD_THRESHOLDS = {
    "first_digit": [
        (0.000, 0.006, "close conformity"),
        (0.006, 0.012, "acceptable conformity"),
        (0.012, 0.015, "marginal"),
        (0.015, float("inf"), "nonconformity"),
    ],
    "second_digit": [
        (0.000, 0.008, "close conformity"),
        (0.008, 0.010, "acceptable conformity"),
        (0.010, 0.012, "marginal"),
        (0.012, float("inf"), "nonconformity"),
    ],
    "first_two_digits": [
        (0.0000, 0.0012, "close conformity"),
        (0.0012, 0.0018, "acceptable conformity"),
        (0.0018, 0.0022, "marginal"),
        (0.0022, float("inf"), "nonconformity"),
    ],
}


def _mad_label(test_key: str, mad: float) -> str:
    for lo, hi, label in MAD_THRESHOLDS[test_key]:
        if lo <= mad < hi:
            return label
    return "nonconformity"


def _clean_digit_strings(amounts: pd.Series) -> pd.Series:
    """Extract clean numeric digits from positive amounts, preserving Series index."""
    abs_amounts = amounts.abs()
    return abs_amounts.apply(lambda x: f"{x:.10g}".replace(".", "").lstrip("0") if (pd.notna(x) and x > 0) else "")


def _extract_digits(digit_strs: pd.Series, mode: str) -> pd.Series:
    """Extract target digits based on mode ('first', 'second', 'first_two')."""
    if mode == "first":
        return digit_strs.apply(lambda s: int(s[0]) if len(s) >= 1 else -1)
    elif mode == "second":
        return digit_strs.apply(lambda s: int(s[1]) if len(s) >= 2 else -1)
    elif mode == "first_two":
        return digit_strs.apply(lambda s: int(s[:2]) if len(s) >= 2 else -1)
    raise ValueError(f"Unknown mode: {mode}")


def _expected_first_digit_probs() -> np.ndarray:
    d = np.arange(1, 10)
    return np.log10(1 + 1 / d)


def _expected_second_digit_probs() -> np.ndarray:
    probs = np.zeros(10)
    for d1 in range(1, 10):
        for d2 in range(0, 10):
            probs[d2] += np.log10(1 + 1 / (10 * d1 + d2))
    return probs


def _expected_first_two_digit_probs() -> np.ndarray:
    n = np.arange(10, 100)
    return np.log10(1 + 1 / n)


def _run_one_digit_test(
    extracted_digits: pd.Series,
    expected: np.ndarray,
    categories: np.ndarray,
    mad_key: str,
) -> dict:
    valid_digits = extracted_digits[extracted_digits.isin(categories)]
    n = len(valid_digits)
    if n == 0:
        return {
            "mad": 0.0,
            "p_value": 1.0,
            "conformity": "acceptable conformity",
            "observed_probs": pd.Series(0.0, index=categories),
            "expected_probs": pd.Series(expected, index=categories),
        }

    observed_counts = valid_digits.value_counts().reindex(categories, fill_value=0).sort_index()
    observed_probs = observed_counts / n
    expected_counts = expected * n

    chi2_stat, p_value = stats.chisquare(f_obs=observed_counts.values, f_exp=expected_counts)
    mad = float(np.mean(np.abs(observed_probs.values - expected)))

    return {
        "mad": mad,
        "p_value": float(p_value) if not np.isnan(p_value) else 1.0,
        "conformity": _mad_label(mad_key, mad),
        "observed_probs": observed_probs,
        "expected_probs": pd.Series(expected, index=categories),
    }


class BenfordEnsembleTest(DetectionTest):
    name = "benford_ensemble"
    domain = "ledger"

    def run(self, df: pd.DataFrame, config: dict) -> list[TestResult]:
        sensitivity = config.get("benford_sensitivity", 0.5)
        # Sensitivity 0..1 maps alpha from 0.10 (permissive) to 0.01 (strict)
        alpha = 0.10 - (0.09 * sensitivity)

        results: list[TestResult] = []
        for vendor, group in df.groupby("vendor"):
            if len(group) < MIN_SAMPLE_SIZE:
                continue

            digit_strs = _clean_digit_strings(group["amount"])
            first_digits = _extract_digits(digit_strs, "first")
            second_digits = _extract_digits(digit_strs, "second")
            first_two_digits = _extract_digits(digit_strs, "first_two")

            first = _run_one_digit_test(first_digits, _expected_first_digit_probs(), np.arange(1, 10), "first_digit")
            second = _run_one_digit_test(second_digits, _expected_second_digit_probs(), np.arange(0, 10), "second_digit")
            first_two = _run_one_digit_test(first_two_digits, _expected_first_two_digit_probs(), np.arange(10, 100), "first_two_digits")

            sub_scores = []
            for sub in (first, second, first_two):
                if sub["p_value"] < alpha:
                    extremity = 1.0 - (sub["p_value"] / max(alpha, 1e-6))
                    sub_scores.append(0.5 + 0.5 * extremity)
                else:
                    sub_scores.append(0.0)

            vendor_score = float(np.mean(sub_scores))
            if vendor_score <= 0.0:
                continue

            detail = {
                "group_key": f"vendor '{vendor}' (n={len(group)})",
                "chi_square_p_value": min(first["p_value"], second["p_value"], first_two["p_value"]),
                "mad": second["mad"],
                "mad_conformity": second.get("conformity", "n/a"),
            }

            # Higher anomaly score for digits heavily overrepresented vs expected
            overrep_digits = set(second["observed_probs"][second["observed_probs"] > 1.5 * second["expected_probs"]].index)

            for record_id, sd in zip(group["record_id"], second_digits):
                boost = 0.15 if sd in overrep_digits else 0.0
                score = min(1.0, vendor_score + boost)
                results.append(TestResult(record_id=str(record_id), score=score, detail=detail))

        return results