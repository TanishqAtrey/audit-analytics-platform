# backend/api/routes_benchmark.py
"""Naive-baseline vs full-ensemble comparison — powers the benchmark
chart. Results are computed and cached in `benchmark_results`; GET reads that back."""

import logging
logger = logging.getLogger(__name__)

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from data_infra.db.connection import get_db_session
from data_infra.db import models
from backend.validation.baseline_comparison import DEFAULT_THRESHOLDS
from backend.core.registry import tests_for_domain
from backend.validation.baseline_comparison import compare_baseline_vs_ensemble
from backend.adapters.ledger.adapter import reshape_transactions
from backend.adapters.financial_statement.adapter import reshape_with_prior_year

router = APIRouter()


def _clean_rows(rows: list) -> list[dict]:
    return [{k: v for k, v in r.__dict__.items() if not k.startswith("_")} for r in rows]


@router.get("/{domain}")
def get_benchmark(domain: str, db: Session = Depends(get_db_session)):
    row = (
        db.query(models.BenchmarkResult)
        .filter(models.BenchmarkResult.domain == domain)
        .order_by(models.BenchmarkResult.computed_at.desc())
        .first()
    )
    if row is None:
        try:
            has_data = False
            if domain == "ledger":
                has_data = db.query(models.Transaction.id).first() is not None
            elif domain == "financial_statement":
                has_data = db.query(models.FinancialStatement.id).first() is not None
            if has_data:
                run_benchmark(domain=domain, dataset_id=None, db=db)
                row = (
                    db.query(models.BenchmarkResult)
                    .filter(models.BenchmarkResult.domain == domain)
                    .order_by(models.BenchmarkResult.computed_at.desc())
                    .first()
                )
        except Exception:
            logger.exception("Failed to auto-compute benchmark for domain: %s", domain)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"No benchmark computed yet for '{domain}'. POST /api/benchmark/{domain}/run first.",
        )
    return {
        "domain": row.domain,
        "thresholds": DEFAULT_THRESHOLDS,
        "baseline": {"precision": row.baseline_precision, "recall": row.baseline_recall, "f1": row.baseline_f1},
        "ensemble": {"precision": row.ensemble_precision, "recall": row.ensemble_recall, "f1": row.ensemble_f1},
        "computed_at": row.computed_at,
    }


@router.post("/{domain}/run")
def run_benchmark(
    domain: str,
    dataset_id: str | None = Query(None, description="Optional dataset_id filter"),
    db: Session = Depends(get_db_session),
):
    if domain == "ledger":
        q = db.query(models.Transaction)
        if dataset_id:
            rows = q.filter(models.Transaction.source_dataset == dataset_id).all()
            if not rows:
                rows = q.all()
        else:
            rows = q.all()
        if not rows:
            raise HTTPException(status_code=404, detail="No ledger transactions found.")
        df = reshape_transactions(pd.DataFrame(_clean_rows(rows)))
        confirmed_ids = set(
            str(r[0]) for r in db.query(models.AuditException.source_record_id)
            .filter(models.AuditException.domain == "ledger", models.AuditException.status == "confirmed")
            .all() if r[0]
        )
        has_3way = any(t.po_reference for t in rows[:50])
        def _is_anomaly(t):
            if str(t.id) in confirmed_ids:
                return 1
            if has_3way:
                if t.po_amount and abs(float(t.po_amount) - float(t.amount)) > 0.01:
                    return 1
                if t.po_quantity and t.gr_quantity and t.po_quantity != t.gr_quantity:
                    return 1
                if not t.po_reference or not t.gr_reference:
                    return 1
            return 0
        labels = {str(t.id): _is_anomaly(t) for t in rows}
        if sum(labels.values()) == 0:
            exc_ids = set(
                str(r[0]) for r in db.query(models.AuditException.source_record_id)
                .filter(models.AuditException.domain == "ledger", models.AuditException.ensemble_score >= 0.5)
                .all() if r[0]
            )
            labels = {str(t.id): (1 if str(t.id) in exc_ids else 0) for t in rows}
    elif domain == "financial_statement":
        rows = db.query(models.FinancialStatement).all()
        if not rows:
            raise HTTPException(status_code=404, detail="No financial statements loaded.")
        df = reshape_with_prior_year(pd.DataFrame(_clean_rows(rows)))
        labels = {f"{r.ticker}_{r.fiscal_year}": int(getattr(r, "is_aaer_fraud_case", False)) for r in rows}
    else:
        raise HTTPException(status_code=400, detail="Domain must be 'ledger' or 'financial_statement'.")

    all_tests = [t() for t in tests_for_domain(domain)]
    result = compare_baseline_vs_ensemble(df, all_tests, domain, config_by_test={}, labels=labels)

    bench_record = models.BenchmarkResult(
        domain=domain,
        baseline_precision=result["baseline"]["precision"],
        baseline_recall=result["baseline"]["recall"],
        baseline_f1=result["baseline"]["f1"],
        ensemble_precision=result["ensemble"]["precision"],
        ensemble_recall=result["ensemble"]["recall"],
        ensemble_f1=result["ensemble"]["f1"],
    )
    db.add(bench_record)
    db.commit()
    return result