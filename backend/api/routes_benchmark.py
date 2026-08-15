# backend/api/routes_benchmark.py
"""Naive-baseline vs full-ensemble comparison — powers the benchmark
chart. Results are computed and cached in `benchmark_results`; GET reads that back."""

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from data_infra.db.connection import get_db_session
from data_infra.db import models
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
        raise HTTPException(
            status_code=404,
            detail=f"No benchmark computed yet for '{domain}'. POST /api/benchmark/{domain}/run first.",
        )
    return {
        "domain": row.domain,
        "baseline": {"precision": row.baseline_precision, "recall": row.baseline_recall, "f1": row.baseline_f1},
        "ensemble": {"precision": row.ensemble_precision, "recall": row.ensemble_recall, "f1": row.ensemble_f1},
        "computed_at": row.computed_at,
    }


@router.post("/{domain}/run")
def run_benchmark(
    domain: str,
    dataset_id: str | None = Query(None, description="Required for ledger domain"),
    db: Session = Depends(get_db_session),
):
    if domain == "ledger":
        if not dataset_id:
            raise HTTPException(status_code=400, detail="dataset_id query parameter is required for ledger domain.")
        rows = db.query(models.Transaction).filter(models.Transaction.source_dataset == dataset_id).all()
        if not rows:
            raise HTTPException(status_code=404, detail="No ledger transactions found for this dataset.")
        df = reshape_transactions(pd.DataFrame(_clean_rows(rows)))
        labels = {str(t.id): 0 for t in rows}
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