# backend/api/routes_detect.py
"""Trigger a detection run and fetch ranked exceptions. Each registered test
for the domain runs (in parallel where the dataset is large enough), then
core.scorer.combine_results ensembles them and core.reason_codes explains
each hit. Results persist to `exceptions`/`reason_codes`, and the run is
logged to `audit_log`."""

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from data_infra.db.connection import get_db_session
from data_infra.db import models

from backend.core.registry import tests_for_domain, get_test
from backend.core.scorer import combine_results
from backend.core.parallel_runner import run_test_parallel
from backend.adapters.ledger.adapter import reshape_transactions
from backend.adapters.financial_statement.adapter import reshape_with_prior_year
from backend.schemas.detect_schemas import (
    DetectionRunRequest, DetectionRunResponse, ExceptionOut, ReasonCodeOut, ExceptionListQuery,
)

router = APIRouter()

PARTITION_COLUMN_BY_DOMAIN = {"ledger": "vendor", "financial_statement": "ticker"}


def _clean_orm_rows(rows: list) -> list[dict]:
    """Extract clean dicts without SQLAlchemy internal _sa_instance_state."""
    cleaned = []
    for r in rows:
        d = {k: v for k, v in r.__dict__.items() if not k.startswith("_")}
        cleaned.append(d)
    return cleaned


def _load_dataframe(domain: str, dataset_id: str, db: Session) -> pd.DataFrame:
    if domain == "ledger":
        rows = db.query(models.Transaction).filter(models.Transaction.source_dataset == dataset_id).all()
        if not rows:
            raise HTTPException(status_code=404, detail=f"No ledger data found for dataset_id '{dataset_id}'.")
        return reshape_transactions(pd.DataFrame(_clean_orm_rows(rows)))

    rows = db.query(models.FinancialStatement).all()
    if not rows:
        raise HTTPException(status_code=404, detail="No financial statement data loaded in database.")
    return reshape_with_prior_year(pd.DataFrame(_clean_orm_rows(rows)))


def _config_by_test(thresholds) -> dict[str, dict]:
    t = thresholds
    return {
        "benford_ensemble": {"benford_sensitivity": t.benford_sensitivity},
        "duplicate_detection": {"duplicate_similarity_threshold": t.duplicate_similarity_threshold},
        "three_way_match": {"three_way_match_tolerance_pct": t.three_way_match_tolerance_pct},
        "ledger_transaction_anomaly": {
            "isolation_forest_contamination": t.isolation_forest_contamination,
            "lof_contamination": t.lof_contamination,
        },
        "ratio_anomaly": {
            "isolation_forest_contamination": t.isolation_forest_contamination,
            "lof_contamination": t.lof_contamination,
        },
    }


@router.post("/run", response_model=DetectionRunResponse)
def run_detection(request: DetectionRunRequest, db: Session = Depends(get_db_session)):
    df = _load_dataframe(request.domain, request.dataset_id, db)

    test_classes = (
        [get_test(name) for name in request.tests]
        if request.tests
        else tests_for_domain(request.domain)
    )
    if not test_classes:
        raise HTTPException(status_code=400, detail=f"No detection tests registered for domain '{request.domain}'.")

    config_by_test = _config_by_test(request.thresholds)
    partition_col = PARTITION_COLUMN_BY_DOMAIN.get(request.domain, "vendor")

    results_by_test = {}
    for test_cls in test_classes:
        test_instance = test_cls()
        results_by_test[test_instance.name] = run_test_parallel(
            test_instance, df, config_by_test.get(test_instance.name, {}), partition_col,
        )

    exceptions = combine_results(results_by_test, total_domain_tests=len(test_classes))

    saved_exceptions = []
    try:
        for e in exceptions:
            exc_row = models.Exception(
                domain=request.domain,
                source_record_id=e["source_record_id"],
                ensemble_score=e["ensemble_score"],
                individual_scores=e["individual_scores"],
                status="unreviewed",
            )
            db.add(exc_row)
            db.flush()
            for rc in e["reason_codes"]:
                db.add(models.ReasonCode(
                    exception_id=exc_row.id,
                    test_name=rc["test_name"],
                    contribution_score=rc["contribution_score"],
                    explanation=rc["explanation"],
                ))
            saved_exceptions.append((exc_row, e["reason_codes"]))

        audit_entry = models.AuditLog(
            dataset_used=request.dataset_id,
            modules_run=list(results_by_test.keys()),
            parameters=request.thresholds.model_dump(),
            run_by=request.run_by,
        )
        db.add(audit_entry)
        db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database persistence error: {str(exc)}")

    return DetectionRunResponse(
        run_id=audit_entry.id,
        domain=request.domain,
        dataset_id=request.dataset_id,
        total_records_scanned=len(df),
        total_exceptions=len(saved_exceptions),
        exceptions=[
            ExceptionOut(
                id=exc.id,
                domain=exc.domain,
                source_record_id=exc.source_record_id,
                ensemble_score=exc.ensemble_score,
                individual_scores=exc.individual_scores,
                status=exc.status,
                reason_codes=[ReasonCodeOut(**rc) for rc in rcs],
                created_at=exc.created_at,
            )
            for exc, rcs in saved_exceptions
        ],
    )


@router.get("/exceptions", response_model=list[ExceptionOut])
def list_exceptions(query: ExceptionListQuery = Depends(), db: Session = Depends(get_db_session)):
    q = db.query(models.Exception)
    if query.domain:
        q = q.filter(models.Exception.domain == query.domain)
    if query.status:
        q = q.filter(models.Exception.status == query.status)
    if query.min_score is not None:
        q = q.filter(models.Exception.ensemble_score >= query.min_score)

    rows = q.order_by(models.Exception.ensemble_score.desc()).offset(query.offset).limit(query.limit).all()

    return [
        ExceptionOut(
            id=r.id,
            domain=r.domain,
            source_record_id=r.source_record_id,
            ensemble_score=r.ensemble_score,
            individual_scores=r.individual_scores or {},
            status=r.status,
            reason_codes=[
                ReasonCodeOut(
                    test_name=rc.test_name,
                    contribution_score=rc.contribution_score,
                    explanation=rc.explanation,
                )
                for rc in (r.reason_codes or [])
            ],
            created_at=r.created_at,
        )
        for r in rows
    ]