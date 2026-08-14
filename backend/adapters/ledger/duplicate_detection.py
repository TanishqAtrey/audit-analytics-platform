# backend/adapters/ledger/duplicate_detection.py
"""Near-duplicate invoice detection with RapidFuzz and blocking."""

from collections import defaultdict
import pandas as pd
from rapidfuzz import fuzz

from backend.core.base import DetectionTest, TestResult

AMOUNT_BUCKET_WIDTH = 50.0
DATE_PROXIMITY_DAYS = 10


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
    if vendor_sim > 85:
        matched_fields.append("vendor")

    invoice_sim = fuzz.ratio(str(row_a["invoice_number"]), str(row_b["invoice_number"]))
    if invoice_sim > 80:
        matched_fields.append("invoice_number")

    amount_a, amount_b = float(row_a["amount"]), float(row_b["amount"])
    denom = max(abs(amount_a), abs(amount_b), 1e-6)
    amount_sim = max(0.0, 100.0 - (abs(amount_a - amount_b) / denom) * 100.0)
    if amount_sim > 95:
        matched_fields.append("amount")

    date_a, date_b = row_a.get("invoice_date"), row_b.get("invoice_date")
    if pd.isna(date_a) or pd.isna(date_b):
        date_sim = 50.0
    else:
        days_apart = abs((pd.to_datetime(date_a) - pd.to_datetime(date_b)).days)
        date_sim = max(0.0, 100.0 - (days_apart / DATE_PROXIMITY_DAYS) * 100.0)
        if days_apart <= 2:
            matched_fields.append("date")

    composite = 0.35 * vendor_sim + 0.25 * invoice_sim + 0.30 * amount_sim + 0.10 * date_sim
    return composite, matched_fields


class DuplicateDetectionTest(DetectionTest):
    name = "duplicate_detection"
    domain = "ledger"

    def run(self, df: pd.DataFrame, config: dict) -> list[TestResult]:
        threshold = config.get("duplicate_similarity_threshold", 85.0)
        df = df.reset_index(drop=True)
        blocks = _build_blocks(df)

        best_match: dict[int, tuple[float, int, list[str]]] = {}
        seen_pairs = set()

        for candidates in blocks.values():
            if len(candidates) < 2:
                continue
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