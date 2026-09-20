# backend/adapters/ledger/duplicate_detection.py
"""Near-duplicate invoice detection with RapidFuzz and blocking."""

from collections import defaultdict
import pandas as pd
from rapidfuzz import fuzz

from backend.core.base import DetectionTest, TestResult
from backend.config import get_settings

settings = get_settings()
AMOUNT_BUCKET_WIDTH = settings.duplicate_amount_bucket_width
DATE_PROXIMITY_DAYS = settings.duplicate_date_proximity_days


def _normalize_vendor(vendor: str) -> str:
    s = "".join(ch for ch in str(vendor).lower() if ch.isalnum())
    return s[:6] if len(s) >= 6 else s


def _amount_bucket(amount: float) -> int:
    return int(amount // AMOUNT_BUCKET_WIDTH)


def _build_blocks(df: pd.DataFrame) -> dict[tuple, list[int]]:
    blocks: dict[tuple, list[int]] = defaultdict(list)
    for pos, (vendor, amount) in enumerate(zip(df["vendor"], df["amount"])):
        key_vendor = _normalize_vendor(vendor)
        bucket = _amount_bucket(amount)
        for b in (bucket - 1, bucket, bucket + 1):
            blocks[(key_vendor, b)].append(pos)
    return blocks


def _pair_similarity(row_a: pd.Series, row_b: pd.Series) -> tuple[float, list[str]]:
    matched_fields = []

    vendor_sim = fuzz.token_sort_ratio(str(row_a["vendor"]), str(row_b["vendor"]))
    if vendor_sim > settings.duplicate_vendor_sim_threshold:
        matched_fields.append("vendor")

    inv_a = row_a.get("invoice_number")
    inv_b = row_b.get("invoice_number")
    # Skip invoice similarity when either value is missing to avoid false inflation
    if inv_a and inv_b and str(inv_a).lower() not in ("", "nan", "none") and str(inv_b).lower() not in ("", "nan", "none"):
        invoice_sim = fuzz.ratio(str(inv_a), str(inv_b))
        if invoice_sim > settings.duplicate_invoice_sim_threshold:
            matched_fields.append("invoice_number")
    else:
        invoice_sim = 0.0

    amount_a, amount_b = float(row_a["amount"]), float(row_b["amount"])
    denom = max(abs(amount_a), abs(amount_b), 1e-6)
    amount_sim = max(0.0, 100.0 - (abs(amount_a - amount_b) / denom) * 100.0)
    if amount_sim > settings.duplicate_amount_sim_threshold:
        matched_fields.append("amount")

    date_a, date_b = row_a.get("invoice_date"), row_b.get("invoice_date")
    if pd.isna(date_a) or pd.isna(date_b):
        date_sim = 50.0
    else:
        days_apart = abs((pd.to_datetime(date_a) - pd.to_datetime(date_b)).days)
        date_sim = max(0.0, 100.0 - (days_apart / DATE_PROXIMITY_DAYS) * 100.0)
        if days_apart <= settings.duplicate_date_proximity_match_days:
            matched_fields.append("date")

    composite = settings.duplicate_vendor_weight * vendor_sim + settings.duplicate_invoice_weight * invoice_sim + settings.duplicate_amount_weight * amount_sim + settings.duplicate_date_weight * date_sim
    return composite, matched_fields


class DuplicateDetectionTest(DetectionTest):
    name = "duplicate_detection"
    domain = "ledger"

    def run(self, df: pd.DataFrame, config: dict) -> list[TestResult]:
        threshold = config.get("duplicate_similarity_threshold", settings.default_duplicate_similarity_threshold)
        df = df.reset_index(drop=True)
        blocks = _build_blocks(df)

        best_match: dict[int, tuple[float, int, list[str]]] = {}
        seen_pairs = set()

        for candidates in blocks.values():
            if len(candidates) < 2:
                continue

            # For large candidate buckets, sort by amount and compare with nearest 25 neighbors
            if len(candidates) > 40:
                sorted_candidates = sorted(candidates, key=lambda p: float(df.iloc[p]["amount"]))
                for i in range(len(sorted_candidates)):
                    max_j = min(len(sorted_candidates), i + 25)
                    for j in range(i + 1, max_j):
                        pos_a, pos_b = sorted_candidates[i], sorted_candidates[j]
                        pair_key = (min(pos_a, pos_b), max(pos_a, pos_b))
                        if pair_key in seen_pairs:
                            continue
                        seen_pairs.add(pair_key)

                        composite, fields = _pair_similarity(df.iloc[pos_a], df.iloc[pos_b])
                        if composite < threshold:
                            continue

                        for src, other in ((pos_a, pos_b), (pos_b, pos_a)):
                            current_best = best_match.get(src)
                            if current_best is None or composite > current_best[0]:
                                best_match[src] = (composite, other, fields)
            else:
                for i in range(len(candidates)):
                    for j in range(i + 1, len(candidates)):
                        pos_a, pos_b = candidates[i], candidates[j]
                        pair_key = (min(pos_a, pos_b), max(pos_a, pos_b))
                        if pair_key in seen_pairs:
                            continue
                        seen_pairs.add(pair_key)

                        composite, fields = _pair_similarity(df.iloc[pos_a], df.iloc[pos_b])
                        if composite < threshold:
                            continue

                        for src, other in ((pos_a, pos_b), (pos_b, pos_a)):
                            current_best = best_match.get(src)
                            if current_best is None or composite > current_best[0]:
                                best_match[src] = (composite, other, fields)

        results = []
        for pos, (composite, other_pos, fields) in best_match.items():
            results.append(
                TestResult(
                    record_id=str(df.iloc[pos]["record_id"]),
                    score=min(1.0, composite / 100.0),
                    detail={
                        "matched_record_id": str(df.iloc[other_pos]["record_id"]),
                        "composite_similarity": composite,
                        "matched_fields": fields,
                    },
                )
            )
        return results