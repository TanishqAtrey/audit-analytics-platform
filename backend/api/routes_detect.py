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
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, cast, String
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
    SummaryStatsResponse, AnomalyDriverOut, TopVendorOut,
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
    min_flag = settings.min_flag_threshold_fs if request.domain == "financial_statement" else settings.min_flag_threshold
    flagged_exceptions = [e for e in exceptions if e.get("ensemble_score", 0.0) >= min_flag]

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
        if request.domain == "financial_statement":
            try:
                from backend.adapters.financial_statement.altman import compute_altman_metrics
                from backend.adapters.financial_statement.beneish import compute_beneish_metrics
                for _, r in df.iterrows():
                    t = str(r.get("ticker", "")).strip().upper()
                    fy = int(r.get("fiscal_year", 0))
                    alt = compute_altman_metrics(r)
                    ben = compute_beneish_metrics(r)

                    update_vals = {}
                    if alt:
                        update_vals.update({
                            "altman_x1_wc_ta": alt.get("x1_wc_ta"),
                            "altman_x2_re_ta": alt.get("x2_re_ta"),
                            "altman_x3_ebit_ta": alt.get("x3_ebit_ta"),
                            "altman_x4_mve_tl": alt.get("x4_mve_tl"),
                            "altman_x5_sales_ta": alt.get("x5_sales_ta"),
                            "altman_z_score": alt.get("z_score"),
                            "altman_zone": alt.get("zone"),
                        })
                    if ben:
                        update_vals.update({
                            "beneish_dsri": ben.get("dsri"),
                            "beneish_gmi": ben.get("gmi"),
                            "beneish_aqi": ben.get("aqi"),
                            "beneish_sgi": ben.get("sgi"),
                            "beneish_depi": ben.get("depi"),
                            "beneish_sgai": ben.get("sgai"),
                            "beneish_lvgi": ben.get("lvgi"),
                            "beneish_tata": ben.get("tata"),
                            "beneish_m_score": ben.get("m_score"),
                            "beneish_manipulator": ben.get("is_manipulator"),
                        })
                    if update_vals:
                        db.query(models.FinancialStatement).filter(
                            models.FinancialStatement.ticker == t,
                            models.FinancialStatement.fiscal_year == fy
                        ).update(update_vals)
            except Exception:
                logger.exception("Failed to update financial statement precomputed ratios")

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
def list_exceptions(response: Response, query: ExceptionListQuery = Depends(), db: Session = Depends(get_db_session)):
    count_q = db.query(func.count(models.AuditException.id))
    if query.domain:
        count_q = count_q.filter(models.AuditException.domain == query.domain)
    if query.status:
        count_q = count_q.filter(models.AuditException.status == query.status)
    if query.min_score is not None:
        count_q = count_q.filter(models.AuditException.ensemble_score >= query.min_score)

    total_count = count_q.scalar() or 0
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    q = db.query(models.AuditException).options(joinedload(models.AuditException.reason_codes))
    if query.domain:
        q = q.filter(models.AuditException.domain == query.domain)
    if query.status:
        q = q.filter(models.AuditException.status == query.status)
    if query.min_score is not None:
        q = q.filter(models.AuditException.ensemble_score >= query.min_score)

    sort_key = (query.sort_by or "score_desc").lower()
    if query.domain == "ledger" and sort_key in (
        "amount_desc", "amount_asc", "date_desc", "date_asc",
        "vendor_asc", "vendor_desc", "invoice_asc", "invoice_desc"
    ):
        q = q.outerjoin(
            models.Transaction,
            cast(models.Transaction.id, String) == models.AuditException.source_record_id,
        )
        if sort_key == "amount_desc":
            q = q.order_by(models.Transaction.amount.desc().nullslast(), models.AuditException.id.desc())
        elif sort_key == "amount_asc":
            q = q.order_by(models.Transaction.amount.asc().nullslast(), models.AuditException.id.asc())
        elif sort_key == "date_desc":
            q = q.order_by(models.Transaction.invoice_date.desc().nullslast(), models.AuditException.id.desc())
        elif sort_key == "date_asc":
            q = q.order_by(models.Transaction.invoice_date.asc().nullslast(), models.AuditException.id.asc())
        elif sort_key == "vendor_asc":
            q = q.order_by(models.Transaction.vendor.asc().nullslast(), models.AuditException.id.asc())
        elif sort_key == "vendor_desc":
            q = q.order_by(models.Transaction.vendor.desc().nullslast(), models.AuditException.id.desc())
        elif sort_key == "invoice_asc":
            q = q.order_by(models.Transaction.invoice_number.asc().nullslast(), models.AuditException.id.asc())
        elif sort_key == "invoice_desc":
            q = q.order_by(models.Transaction.invoice_number.desc().nullslast(), models.AuditException.id.desc())
    elif sort_key == "score_asc":
        q = q.order_by(models.AuditException.ensemble_score.asc(), models.AuditException.id.asc())
    else:
        q = q.order_by(models.AuditException.ensemble_score.desc(), models.AuditException.id.desc())

    rows = q.offset(query.offset).limit(query.limit).all()

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
                    exc_dict["altman_zone"] = fs.altman_zone
                    if fs.altman_z_score is not None:
                        exc_dict["z_score"] = float(fs.altman_z_score)
                    if fs.beneish_m_score is not None:
                        exc_dict["m_score"] = float(fs.beneish_m_score)

                    if fs.altman_x1_wc_ta is not None:
                        exc_dict["altman_ratios"] = {
                            "x1_wc_ta": float(fs.altman_x1_wc_ta),
                            "x2_re_ta": float(fs.altman_x2_re_ta),
                            "x3_ebit_ta": float(fs.altman_x3_ebit_ta),
                            "x4_mve_tl": float(fs.altman_x4_mve_tl),
                            "x5_sales_ta": float(fs.altman_x5_sales_ta),
                            "z_score": float(fs.altman_z_score) if fs.altman_z_score is not None else None,
                            "zone": fs.altman_zone,
                        }

                    if fs.beneish_dsri is not None:
                        exc_dict["beneish_ratios"] = {
                            "dsri": float(fs.beneish_dsri),
                            "gmi": float(fs.beneish_gmi),
                            "aqi": float(fs.beneish_aqi),
                            "sgi": float(fs.beneish_sgi),
                            "depi": float(fs.beneish_depi),
                            "sgai": float(fs.beneish_sgai),
                            "lvgi": float(fs.beneish_lvgi),
                            "tata": float(fs.beneish_tata),
                            "m_score": float(fs.beneish_m_score) if fs.beneish_m_score is not None else None,
                            "manipulator": bool(fs.beneish_manipulator),
                        }

                    if exc_dict.get("z_score") is None:
                        try:
                            from backend.adapters.financial_statement.altman import compute_altman_metrics
                            alt_dyn = compute_altman_metrics(fs.__dict__)
                            if alt_dyn:
                                exc_dict["z_score"] = alt_dyn.get("z_score")
                                exc_dict["altman_zone"] = alt_dyn.get("zone")
                                exc_dict["altman_ratios"] = alt_dyn
                        except Exception:
                            pass

                for rc in (r.reason_codes or []):
                    m_match = re.search(r"M-Score=([-\d.]+)", rc.explanation or "")
                    if m_match and exc_dict.get("m_score") is None:
                        try:
                            exc_dict["m_score"] = float(m_match.group(1))
                        except Exception:
                            pass
                    z_match = re.search(r"Z=([-\d.]+)", rc.explanation or "")
                    if z_match and exc_dict.get("z_score") is None:
                        try:
                            exc_dict["z_score"] = float(z_match.group(1))
                        except Exception:
                            pass

                if exc_dict.get("m_score") is None:
                    exc_dict["m_score"] = None
        except Exception:
            logger.exception("Exception building output row")
            pass

        out.append(ExceptionOut(**exc_dict))

    logger.info(f"list_exceptions: domain={query.domain}, min_score={query.min_score}, total_count={total_count}, returning={len(out)}")
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
            recall=0.0,
            confirmation_rate=0.0,
            reviewer_precision=0.0,
            f1_score=0.0,
            fp_reduction_pct=0.0,
            anomaly_drivers=[],
            top_vendors=[],
            last_run=None,
            ensemble_vs_baseline="0%"
        )
    
    total_exc = ledger_exc + fs_exc
    total_reviewed = confirmed + false_positives
    reviewer_precision = round(confirmed / max(total_reviewed, 1), 3)
    confirmation_rate = round(confirmed / max(total_exc, 1), 3)

    bench_row = db.query(models.BenchmarkResult).order_by(models.BenchmarkResult.computed_at.desc()).first()
    
    # Auto-run benchmark if not yet present and we have transactions
    if not bench_row and total_tx > 0:
        try:
            tx_sample = db.query(models.Transaction.source_dataset).filter(models.Transaction.source_dataset.isnot(None)).first()
            dataset_id = tx_sample[0] if tx_sample else None
            if dataset_id:
                from backend.api.routes_benchmark import run_benchmark
                run_benchmark(domain="ledger", dataset_id=dataset_id, db=db)
                bench_row = db.query(models.BenchmarkResult).order_by(models.BenchmarkResult.computed_at.desc()).first()
        except Exception:
            logger.exception("Failed to auto-compute benchmark for summary stats")

    precision = reviewer_precision
    recall = confirmation_rate
    f1 = round(2 * precision * recall / max(precision + recall, 1e-9), 3)
    fp_reduction_pct = 0.0
    lift_str = "N/A"

    if bench_row and bench_row.ensemble_f1 and bench_row.baseline_f1:
        try:
            def _get_metric(val, idx=2):
                if isinstance(val, (int, float)):
                    return float(val)
                if isinstance(val, list) and len(val) > 0:
                    safe_idx = min(idx, len(val) - 1)
                    return float(val[safe_idx])
                return 0.0

            # Default operational decision threshold is 0.50 (index 2 of [0.3, 0.4, 0.5, ...])
            model_prec = _get_metric(bench_row.ensemble_precision, 2)
            model_rec = _get_metric(bench_row.ensemble_recall, 2)
            model_f1 = _get_metric(bench_row.ensemble_f1, 2)

            base_prec = _get_metric(bench_row.baseline_precision, 2)
            base_f1_val = _get_metric(bench_row.baseline_f1, 2)

            if model_prec > 0 or model_rec > 0 or model_f1 > 0:
                precision = round(model_prec, 3)
                recall = round(model_rec, 3)
                f1 = round(model_f1, 3)

            base_fpr = max(1.0 - base_prec, 0.0)
            ens_fpr = max(1.0 - model_prec, 0.0)
            if base_fpr > 0:
                fp_reduction_pct = round((base_fpr - ens_fpr) / base_fpr * 100.0, 1)

            lift_pct = round((model_f1 - base_f1_val) / max(base_f1_val, 1e-9) * 100, 1)
            lift_str = f"+{lift_pct}%" if lift_pct >= 0 else f"{lift_pct}%"
        except Exception:
            logger.exception("Failed to calculate benchmark lift")
            lift_str = "N/A"

    # Anomaly drivers across ALL exceptions in the database for domain='ledger'
    anomaly_drivers = []
    try:
        driver_rows = (
            db.query(models.ReasonCode.test_name, func.count(models.ReasonCode.id))
            .join(models.AuditException, models.ReasonCode.exception_id == models.AuditException.id)
            .filter(models.AuditException.domain == "ledger")
            .group_by(models.ReasonCode.test_name)
            .order_by(func.count(models.ReasonCode.id).desc())
            .all()
        )
        test_display = {
            "duplicate_detection": "Duplicate Invoice",
            "three_way_match": "3-Way Mismatch",
            "benford_ensemble": "Benford's Law",
            "ledger_transaction_anomaly": "Isolation Forest",
            "transaction_anomaly": "Isolation Forest",
        }
        for tname, cnt in driver_rows:
            label = test_display.get(tname, tname.replace("_", " ").title())
            anomaly_drivers.append(AnomalyDriverOut(name=label, count=int(cnt)))
    except Exception:
        logger.exception("Failed to aggregate anomaly drivers")

    # Top outlier spend by vendor across ALL exceptions with score >= 0.5 in domain='ledger'
    top_vendors = []
    try:
        vendor_rows = (
            db.query(models.Transaction.vendor, func.sum(func.abs(models.Transaction.amount)))
            .join(models.AuditException, cast(models.Transaction.id, String) == models.AuditException.source_record_id)
            .filter(
                models.AuditException.domain == "ledger",
                models.AuditException.ensemble_score >= 0.50,
                models.Transaction.vendor.isnot(None),
            )
            .group_by(models.Transaction.vendor)
            .order_by(func.sum(func.abs(models.Transaction.amount)).desc())
            .limit(5)
            .all()
        )
        top_vendors = [
            TopVendorOut(name=str(r[0]), amount=round(float(r[1] or 0), 2))
            for r in vendor_rows if r[0]
        ]
    except Exception:
        logger.exception("Failed to aggregate top vendors")

    return SummaryStatsResponse(
        total_transactions=total_tx,
        ledger_exceptions=ledger_exc,
        fs_exceptions=fs_exc,
        confirmed_fraud=confirmed,
        false_positives=false_positives,
        needs_review=needs_review,
        precision=precision,
        recall=recall,
        confirmation_rate=confirmation_rate,
        reviewer_precision=reviewer_precision,
        f1_score=f1,
        fp_reduction_pct=fp_reduction_pct,
        anomaly_drivers=anomaly_drivers,
        top_vendors=top_vendors,
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
    chi2_p = float(chi2_dist.sf(chi2_stat, df=8))  # 9 digits - 1 = 8 degrees of freedom, using survival function for precision
    
    return {
        "expected": expected,
        "observed": observed,
        "mad": mad,
        "chi2_p": chi2_p
    }


@router.get("/threshold-metrics")
def get_threshold_metrics(domain: str = "ledger", db: Session = Depends(get_db_session)):
    """Returns all exception scores and benchmark curves for real-time threshold exploration."""
    total_records = (
        db.query(models.Transaction).count()
        if domain == "ledger"
        else db.query(models.FinancialStatement).count()
    )
    
    rows = (
        db.query(models.AuditException.ensemble_score)
        .filter(models.AuditException.domain == domain)
        .all()
    )
    scores = [float(r[0]) for r in rows if r[0] is not None]
    
    bench_row = (
        db.query(models.BenchmarkResult)
        .filter(models.BenchmarkResult.domain == domain)
        .order_by(models.BenchmarkResult.computed_at.desc())
        .first()
    )
    
    if not bench_row and total_records > 0:
        try:
            from backend.api.routes_benchmark import run_benchmark
            run_benchmark(domain=domain, dataset_id=None, db=db)
            bench_row = (
                db.query(models.BenchmarkResult)
                .filter(models.BenchmarkResult.domain == domain)
                .order_by(models.BenchmarkResult.computed_at.desc())
                .first()
            )
        except Exception:
            logger.exception("Failed to auto-compute benchmark for threshold metrics")
    
    benchmark = None
    if bench_row and bench_row.ensemble_precision:
        from backend.validation.baseline_comparison import DEFAULT_THRESHOLDS
        benchmark = {
            "thresholds": DEFAULT_THRESHOLDS,
            "baseline_precision": bench_row.baseline_precision,
            "baseline_recall": bench_row.baseline_recall,
            "baseline_f1": bench_row.baseline_f1,
            "ensemble_precision": bench_row.ensemble_precision,
            "ensemble_recall": bench_row.ensemble_recall,
            "ensemble_f1": bench_row.ensemble_f1,
        }
        
    return {
        "domain": domain,
        "total_records": total_records,
        "total_exceptions": len(scores),
        "scores": scores,
        "benchmark": benchmark,
    }