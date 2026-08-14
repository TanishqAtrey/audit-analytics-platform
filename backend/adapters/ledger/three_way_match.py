# backend/adapters/ledger/three_way_match.py
"""PO–Invoice–Goods Receipt (3-way match) rule-based verification."""

import pandas as pd
from backend.core.base import DetectionTest, TestResult

RULE_WEIGHTS = {
    "missing_po": 0.9,
    "missing_goods_receipt": 0.7,
    "price_variance": 0.6,
    "quantity_variance": 0.6,
    "po_overbilled": 0.85,
}


class ThreeWayMatchTest(DetectionTest):
    name = "three_way_match"
    domain = "ledger"

    def run(self, df: pd.DataFrame, config: dict) -> list[TestResult]:
        tolerance_pct = config.get("three_way_match_tolerance_pct", 0.02)
        results = []

        has_po_amount = "po_amount" in df.columns
        has_po_qty = "po_quantity" in df.columns
        has_gr_qty = "gr_quantity" in df.columns

        overbilled_pos = set()
        if has_po_amount:
            valid_pos = df.dropna(subset=["po_reference", "po_amount"])
            if not valid_pos.empty:
                po_totals = (
                    valid_pos.groupby("po_reference")
                    .agg(invoiced_total=("amount", "sum"), po_amount=("po_amount", "first"))
                    .reset_index()
                )
                overbilled_pos = set(
                    po_totals.loc[
                        po_totals["invoiced_total"] > po_totals["po_amount"] * (1 + tolerance_pct),
                        "po_reference",
                    ]
                )

        for _, row in df.iterrows():
            violations, weights = [], []

            if pd.isna(row.get("po_reference")) or str(row.get("po_reference", "")).strip() in ("", "None", "nan"):
                violations.append("no matching PO on file")
                weights.append(RULE_WEIGHTS["missing_po"])

            if pd.isna(row.get("gr_reference")) or str(row.get("gr_reference", "")).strip() in ("", "None", "nan"):
                violations.append("no matching goods receipt on file")
                weights.append(RULE_WEIGHTS["missing_goods_receipt"])

            if has_po_amount:
                po_amount = row.get("po_amount")
                if pd.notna(po_amount) and float(po_amount) > 0:
                    variance_pct = abs(float(row["amount"]) - float(po_amount)) / float(po_amount)
                    if variance_pct > tolerance_pct:
                        violations.append(f"invoice amount differs from PO by {variance_pct:.1%}")
                        weights.append(RULE_WEIGHTS["price_variance"])

            if has_po_qty and has_gr_qty:
                po_qty, gr_qty = row.get("po_quantity"), row.get("gr_quantity")
                if pd.notna(po_qty) and pd.notna(gr_qty) and float(po_qty) > 0:
                    qty_variance = abs(float(po_qty) - float(gr_qty)) / float(po_qty)
                    if qty_variance > tolerance_pct:
                        violations.append(f"goods receipt quantity differs from PO by {qty_variance:.1%}")
                        weights.append(RULE_WEIGHTS["quantity_variance"])

            if row.get("po_reference") in overbilled_pos:
                violations.append("cumulative invoices against this PO exceed authorized amount")
                weights.append(RULE_WEIGHTS["po_overbilled"])

            if not violations:
                continue

            score = min(1.0, max(weights) + 0.05 * (len(weights) - 1))
            results.append(
                TestResult(
                    record_id=str(row["record_id"]),
                    score=score,
                    detail={"violations": violations, "note": "synthetic-data-validated"},
                )
            )

        return results