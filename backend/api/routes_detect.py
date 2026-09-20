# backend/api/routes_detect.py
"""Trigger a detection run and fetch ranked exceptions. Each registered test
for the domain runs (in parallel where the dataset is large enough), then
core.scorer.combine_results ensembles them and core.reason_codes explains
each hit. Results persist to `exceptions`/`reason_codes`, and the run is
logged to `audit_log`."""

import logging
logger = logging.getLogger(__name__)

import re
import time
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from data_infra.db.connection import get_db_session
from data_infra.db import models

from backend.core.registry import tests_for_domain, get_test
from backend.core.scorer import combine_results
from backend.core.parallel_runner import run_test_parallel
from backend.adapters.ledger.adapter import reshape_transactions
from backend.adapters.financial_statement.adapter import reshape_with_prior_year
from backend.schemas.detect_schemas import (
    DetectionRunRequest, DetectionRunResponse, ExceptionOut, ReasonCodeOut, ExceptionListQuery,
    SummaryStatsResponse,
)
from backend.config import get_settings

settings = get_settings()

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
    start_time = time.time()
    df = _load_dataframe(request.domain, request.dataset_id, db)

    try:
        test_classes = (
            [get_test(name) for name in request.tests]
            if request.tests
            else tests_for_domain(request.domain)
        )
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Unknown detection test: {str(e).strip(chr(39))}")
    if not test_classes:
        raise HTTPException(status_code=400, detail=f"No detection tests registered for domain '{request.domain}'.")

    # Validate that all explicitly requested tests belong to the requested domain
    if request.tests:
        for tc in test_classes:
            inst = tc()
            if inst.domain != request.domain:
                raise HTTPException(
                    status_code=400,
                    detail=f"Test '{inst.name}' belongs to domain '{inst.domain}', not '{request.domain}'."
                )

    config_by_test = _config_by_test(request.thresholds)
    partition_col = PARTITION_COLUMN_BY_DOMAIN.get(request.domain, "vendor")

    results_by_test = {}
    for test_cls in test_classes:
        test_instance = test_cls()
        try:
            results_by_test[test_instance.name] = run_test_parallel(
                test_instance, df, config_by_test.get(test_instance.name, {}), partition_col,
            )
        except Exception:
            logger.exception(f"Detection test '{test_instance.name}' failed, skipping")
            results_by_test[test_instance.name] = []

    exceptions = combine_results(results_by_test, total_domain_tests=len(test_classes))

    # Only persist exceptions above a fixed ensemble score floor
    min_flag_threshold = settings.min_flag_threshold
    flagged_exceptions = [e for e in exceptions if e.get("ensemble_score", 0.0) >= min_flag_threshold]

    # If domain is financial statement and no exceptions met the strict threshold, keep any flagged above 0.2
    if request.domain == "financial_statement" and not flagged_exceptions:
        flagged_exceptions = [e for e in exceptions if e.get("ensemble_score", 0.0) >= settings.min_flag_threshold_fs]

    saved_exceptions = []
    try:
        # Clean previous exceptions for this domain to prevent duplicates on re-runs
        existing_exc_ids = [e[0] for e in db.query(models.AuditException.id).filter(
            models.AuditException.domain == request.domain,
            models.AuditException.status == "unreviewed"
        ).all()]
        if existing_exc_ids:
            db.query(models.ReasonCode).filter(models.ReasonCode.exception_id.in_(existing_exc_ids)).delete(synchronize_session=False)
        db.query(models.AuditException).filter(
            models.AuditException.domain == request.domain,
            models.AuditException.status == "unreviewed"
        ).delete(synchronize_session=False)

        # Collect source_record_ids of reviewed exceptions to avoid duplicating them
        reviewed_record_ids = {r[0] for r in db.query(models.AuditException.source_record_id).filter(
            models.AuditException.domain == request.domain,
            models.AuditException.status != "unreviewed"
        ).all()}

        for e in flagged_exceptions:
            # Skip if a reviewed exception already exists for this record
            if e["source_record_id"] in reviewed_record_ids:
                continue
            exc_row = models.AuditException(
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

        audit_params = request.thresholds.model_dump()
        audit_params["total_exceptions"] = len(saved_exceptions)
        audit_params["runtime_ms"] = int((time.time() - start_time) * 1000)

        audit_entry = models.AuditLog(
            dataset_used=request.dataset_id,
            modules_run=list(results_by_test.keys()),
            parameters=audit_params,
            run_by=request.run_by,
        )
        db.add(audit_entry)
        db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Database persistence error")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error during detection run.")

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
            for exc, rcs in saved_exceptions[:200]
        ],
    )


@router.get("/exceptions", response_model=list[ExceptionOut])
def list_exceptions(query: ExceptionListQuery = Depends(), db: Session = Depends(get_db_session)):
    q = db.query(models.AuditException).options(joinedload(models.AuditException.reason_codes))
    if query.domain:
        q = q.filter(models.AuditException.domain == query.domain)
    if query.status:
        q = q.filter(models.AuditException.status == query.status)
    if query.min_score is not None:
        q = q.filter(models.AuditException.ensemble_score >= query.min_score)

    rows = q.order_by(models.AuditException.ensemble_score.desc()).offset(query.offset).limit(query.limit).all()

    # Pre-fetch matching source records in bulk
    tx_rec_ids = [int(r.source_record_id) for r in rows if r.domain == "ledger" and r.source_record_id and str(r.source_record_id).isdigit()]
    tx_map = {}
    if tx_rec_ids:
        tx_rows = db.query(models.Transaction).filter(models.Transaction.id.in_(tx_rec_ids)).all()
        tx_map = {t.id: t for t in tx_rows}

    fs_key_map, fs_id_map, fs_ticker_map = {}, {}, {}
    fs_rec_ids = [r.source_record_id for r in rows if r.domain == "financial_statement"]
    if fs_rec_ids:
        # Extract ticker_year pairs and individual components for filtered lookup
        fs_tickers = set()
        for rid in fs_rec_ids:
            parts = rid.rsplit("_", 1)
            if parts:
                fs_tickers.add(parts[0])
        fs_all = db.query(models.FinancialStatement).filter(models.FinancialStatement.ticker.in_(fs_tickers)).all() if fs_tickers else []
        fs_key_map = {f"{f.ticker}_{f.fiscal_year}": f for f in fs_all}
        fs_id_map = {str(f.id): f for f in fs_all}
        fs_ticker_map = {f.ticker: f for f in fs_all}

    out = []
    for r in rows:
        exc_dict = {
            "id": r.id,
            "domain": r.domain,
            "source_record_id": r.source_record_id,
            "ensemble_score": r.ensemble_score,
            "individual_scores": r.individual_scores or {},
            "status": r.status,
            "reason_codes": [
                ReasonCodeOut(
                    test_name=rc.test_name,
                    contribution_score=rc.contribution_score,
                    explanation=rc.explanation,
                )
                for rc in (r.reason_codes or [])
            ],
            "created_at": r.created_at,
        }
        try:
            if r.domain == "ledger":
                rec_id = int(r.source_record_id) if str(r.source_record_id).isdigit() else None
                if rec_id in tx_map:
                    tx = tx_map[rec_id]
                    exc_dict["vendor"] = tx.vendor
                    exc_dict["amount"] = tx.amount
                    exc_dict["currency"] = tx.currency or settings.default_currency
                    exc_dict["invoice_number"] = tx.invoice_number
                    exc_dict["date"] = str(tx.invoice_date) if tx.invoice_date else None
            elif r.domain == "financial_statement":
                s_id = str(r.source_record_id)
                fs = fs_key_map.get(s_id) or fs_id_map.get(s_id) or fs_ticker_map.get(s_id.split("_")[0])
                if fs:
                    exc_dict["company"] = fs.company
                    exc_dict["ticker"] = fs.ticker
                    exc_dict["fiscal_year"] = fs.fiscal_year
                    try:
                        tot_assets = float(fs.total_assets or 1.0)
                        wc = float((fs.current_assets or 0.0) - (fs.current_liabilities or 0.0))
                        a = wc / tot_assets
                        b = float(fs.retained_earnings or 0.0) / tot_assets
                        c = float(fs.net_income or 0.0) / tot_assets
                        d = float(fs.market_value_equity or 0.0) / max(float(fs.total_liabilities or 1.0), 1.0)
                        e = float(fs.revenue or 0.0) / tot_assets
                        z_val = settings.altman_coeff_a * a + settings.altman_coeff_b * b + settings.altman_coeff_c * c + settings.altman_coeff_d * d + settings.altman_coeff_e * e
                        exc_dict["z_score"] = round(z_val, 2)
                    except Exception:
                        logger.exception("Failed to compute z_score")
                        exc_dict["z_score"] = None

                for rc in (r.reason_codes or []):
                    m_match = re.search(r"M-Score=([-\d.]+)", rc.explanation or "")
                    if m_match:
                        try:
                            exc_dict["m_score"] = float(m_match.group(1))
                        except Exception:
                            logger.exception("Failed to parse m_score")
                            pass
                    z_match = re.search(r"Z=([-\d.]+)", rc.explanation or "")
                    if z_match and exc_dict.get("z_score") is None:
                        try:
                            exc_dict["z_score"] = float(z_match.group(1))
                        except Exception:
                            logger.exception("Failed to parse z_score from regex")
                            pass

                if exc_dict.get("m_score") is None:
                    exc_dict["m_score"] = None
        except Exception:
            logger.exception("Exception building output row")
            pass

        out.append(ExceptionOut(**exc_dict))

    return out


@router.get("/summary", response_model=SummaryStatsResponse)
def get_summary_stats(db: Session = Depends(get_db_session)):
    total_tx = db.query(models.Transaction).count()
    
    ledger_exc = db.query(models.AuditException).filter(
        models.AuditException.domain == "ledger",
    ).count()
    fs_exc = db.query(models.AuditException).filter(
        models.AuditException.domain == "financial_statement",
    ).count()
    
    confirmed = db.query(models.AuditException).filter(models.AuditException.status == "confirmed").count()
    false_positives = db.query(models.AuditException).filter(models.AuditException.status == "false_positive").count()
    needs_review = db.query(models.AuditException).filter(models.AuditException.status == "needs_review").count()
    
    last_run_row = db.query(models.AuditLog).order_by(models.AuditLog.run_timestamp.desc()).first()
    last_run_str = last_run_row.run_timestamp.isoformat() if last_run_row else None
    
    if total_tx == 0 and fs_exc == 0:
        return SummaryStatsResponse(
            total_transactions=0,
            ledger_exceptions=0,
            fs_exceptions=0,
            confirmed_fraud=0,
            false_positives=0,
            needs_review=0,
            precision=0.0,
            confirmation_rate=0.0,
            f1_score=0.0,
            last_run=None,
            ensemble_vs_baseline="0%"
        )
    
    total_exc = ledger_exc + fs_exc
    total_reviewed = confirmed + false_positives
    precision = round(confirmed / max(total_reviewed, 1), 3)
    confirmation_rate = round(confirmed / max(total_exc, 1), 3)
    f1 = round(2 * precision * confirmation_rate / max(precision + confirmation_rate, 1e-9), 3)

    bench_row = db.query(models.BenchmarkResult).order_by(models.BenchmarkResult.computed_at.desc()).first()
    if bench_row and bench_row.ensemble_f1 and bench_row.baseline_f1:
        try:
            def _get_f1(val):
                if isinstance(val, (int, float)):
                    return float(val)
                if isinstance(val, list) and len(val) > 0:
                    idx = 3 if len(val) > 3 else len(val) // 2
                    return float(val[idx])
                return 0.0

            ens_f1_val = _get_f1(bench_row.ensemble_f1)
            base_f1_val = _get_f1(bench_row.baseline_f1)
            lift_pct = round((ens_f1_val - base_f1_val) / max(base_f1_val, 1e-9) * 100, 1)
            lift_str = f"+{lift_pct}%" if lift_pct >= 0 else f"{lift_pct}%"
        except Exception:
            logger.exception("Failed to calculate benchmark lift")
            lift_str = "N/A"
    else:
        lift_str = "N/A"

    return SummaryStatsResponse(
        total_transactions=total_tx,
        ledger_exceptions=ledger_exc,
        fs_exceptions=fs_exc,
        confirmed_fraud=confirmed,
        false_positives=false_positives,
        needs_review=needs_review,
        precision=precision,
        confirmation_rate=confirmation_rate,
        f1_score=f1,
        last_run=last_run_str,
        ensemble_vs_baseline=lift_str,
    )


@router.get("/benford")
def get_benford_analysis(domain: str = "ledger", db: Session = Depends(get_db_session)):
    import math
    if domain != "ledger":
        raise HTTPException(status_code=400, detail="Benford analysis is only supported for 'ledger' domain.")
        
    amounts = [abs(r[0]) for r in db.query(models.Transaction.amount).all() if r[0] and r[0] != 0]
    
    expected = {i: math.log10(1 + 1.0/i) for i in range(1, 10)}
    observed = {i: 0.0 for i in range(1, 10)}
    
    if not amounts:
        return {
            "expected": expected,
            "observed": {i: expected[i] for i in range(1, 10)},
            "mad": 0.0,
            "chi2_p": 1.0
        }
        
    valid_count = 0
    for amt in amounts:
        # Get first non-zero digit safely
        first_digit = None
        for char in str(amt):
            if char in "123456789":
                first_digit = int(char)
                break
        if first_digit is not None:
            observed[first_digit] += 1
            valid_count += 1
                
    if valid_count > 0:
        for i in range(1, 10):
            observed[i] /= valid_count
            
    # Calculate MAD (Mean Absolute Deviation)
    mad = sum(abs(observed[i] - expected[i]) for i in range(1, 10)) / 9.0
    
    # Simple Chi-square test statistic
    chi2_stat = 0.0
    if valid_count > 0:
        for i in range(1, 10):
            exp_count = expected[i] * valid_count
            obs_count = observed[i] * valid_count
            chi2_stat += ((obs_count - exp_count) ** 2) / exp_count
            
    from scipy.stats import chi2 as chi2_dist
    chi2_p = 1.0 - chi2_dist.cdf(chi2_stat, df=8)  # 9 digits - 1 = 8 degrees of freedom
    
    return {
        "expected": expected,
        "observed": observed,
        "mad": mad,
        "chi2_p": chi2_p
    }