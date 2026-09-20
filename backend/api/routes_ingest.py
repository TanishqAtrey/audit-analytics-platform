# backend/api/routes_ingest.py
"""Upload/select dataset endpoints. Persists ledger CSV uploads and financial statement selections."""

import logging
logger = logging.getLogger(__name__)

import uuid
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from data_infra.db.connection import get_db_session
from data_infra.db import models
from data_infra.security.input_sanitization import validate_uploaded_csv
from data_infra.ingestion.sec_edgar_loader import CURATED_COMPANIES, get_curated_statements

from backend.schemas.ingest_schemas import (
    LedgerUploadResponse, CuratedCompanyListResponse, CuratedCompany,
    FinancialStatementSelectRequest, FinancialStatementSelectResponse,
)
from backend.config import get_settings

settings = get_settings()

router = APIRouter()


@router.post("/ledger/upload", response_model=LedgerUploadResponse)
async def upload_ledger_csv(
    file: UploadFile = File(...),
    replace_existing: bool = True,
    db: Session = Depends(get_db_session)
):
    raw_bytes = b""
    max_size = settings.max_upload_size_mb * 1024 * 1024
    while chunk := await file.read(1024 * 1024):
        raw_bytes += chunk
        if len(raw_bytes) > max_size:
            raise HTTPException(status_code=413, detail="File too large.")

    validated_df, warnings = validate_uploaded_csv(raw_bytes, expected_kind="ledger")
    if validated_df is None:
        raise HTTPException(status_code=400, detail="Uploaded file failed validation.")
    if validated_df.empty:
        raise HTTPException(status_code=400, detail="CSV contained no valid rows after validation.")

    # If replace_existing is True, clean previous ledger transactions
    # NOTE: No commit here — deletion and insertion must be one atomic transaction
    if replace_existing:
        try:
            ledger_exc_ids = [e[0] for e in db.query(models.AuditException.id).filter(models.AuditException.domain == "ledger").all()]
            if ledger_exc_ids:
                db.query(models.ReasonCode).filter(models.ReasonCode.exception_id.in_(ledger_exc_ids)).delete(synchronize_session=False)
            db.query(models.AuditException).filter(models.AuditException.domain == "ledger").delete(synchronize_session=False)
            db.query(models.Transaction).delete(synchronize_session=False)
            db.query(models.BenchmarkResult).filter(models.BenchmarkResult.domain == "ledger").delete(synchronize_session=False)
        except Exception:
            logger.exception("Failed to clear existing ledger data")
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to clear existing ledger data.")

    dataset_id = str(uuid.uuid4())
    
    # Vectorized conversion for instant sub-second database insertion
    df_clean = validated_df.copy()
    if "currency" not in df_clean.columns:
        df_clean["currency"] = settings.default_currency
    else:
        df_clean["currency"] = df_clean["currency"].fillna(settings.default_currency).astype(str).str.strip().str.upper()
        df_clean.loc[df_clean["currency"] == "", "currency"] = settings.default_currency

    df_clean["source_dataset"] = dataset_id
    if "invoice_date" in df_clean.columns:
        df_clean["invoice_date"] = pd.to_datetime(df_clean["invoice_date"], errors="coerce").dt.date
    
    # Convert dataframe into clean dictionary list
    records_dict = df_clean.replace({np.nan: None, pd.NaT: None}).to_dict(orient="records")

    try:
        # Fast bulk insert in chunks of 10,000
        chunk_size = 10000
        for i in range(0, len(records_dict), chunk_size):
            chunk = records_dict[i : i + chunk_size]
            db.bulk_insert_mappings(models.Transaction, chunk)
        db.commit()
        
        upload_log = models.AuditLog(
            dataset_used=dataset_id,
            modules_run=["ledger_upload"],
            parameters={"rows": len(records_dict), "filename": file.filename},
            run_by="system",
        )
        db.add(upload_log)
        db.commit()
    except Exception as e:
        logger.exception("Database insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database insert error: {str(e)}")

    date_col = pd.to_datetime(validated_df["invoice_date"], errors="coerce").dropna()
    date_range = (date_col.min().date(), date_col.max().date()) if not date_col.empty else None

    return LedgerUploadResponse(
        dataset_id=dataset_id,
        rows_ingested=len(records_dict),
        vendors_detected=int(validated_df["vendor"].nunique()),
        date_range=date_range,
        warnings=warnings,
    )


@router.post("/reset")
def reset_all_data(db: Session = Depends(get_db_session)):
    try:
        db.query(models.ReasonCode).delete()
        db.query(models.AuditException).delete()
        db.query(models.Transaction).delete()
        db.query(models.FinancialStatement).delete()
        db.query(models.AuditLog).delete()
        db.query(models.BenchmarkResult).delete()
        db.commit()
        return {"status": "ok", "message": "All database records reset to 0"}
    except Exception as e:
        logger.exception("Reset error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Reset error: {str(e)}")


@router.get("/companies", response_model=CuratedCompanyListResponse)
def list_curated_companies():
    return CuratedCompanyListResponse(companies=[CuratedCompany(**c) for c in CURATED_COMPANIES])


@router.post("/financial-statements/select", response_model=FinancialStatementSelectResponse)
def select_financial_statements(request: FinancialStatementSelectRequest, db: Session = Depends(get_db_session)):
    known_tickers = {c["ticker"] for c in CURATED_COMPANIES}
    requested = set(request.tickers)
    missing = sorted(requested - known_tickers)
    valid = sorted(requested & known_tickers)
    if not valid:
        raise HTTPException(status_code=400, detail="None of the requested tickers are in the curated list.")

    # Clean previous FS exceptions and benchmarks to prevent stale data
    try:
        fs_exc_ids = [e[0] for e in db.query(models.AuditException.id).filter(models.AuditException.domain == "financial_statement").all()]
        if fs_exc_ids:
            db.query(models.ReasonCode).filter(models.ReasonCode.exception_id.in_(fs_exc_ids)).delete(synchronize_session=False)
        db.query(models.AuditException).filter(models.AuditException.domain == "financial_statement").delete(synchronize_session=False)
        db.query(models.BenchmarkResult).filter(models.BenchmarkResult.domain == "financial_statement").delete(synchronize_session=False)
    except Exception:
        logger.exception("Failed to clean previous FS exceptions")
        db.rollback()

    # Ensure curated statements are present in database for valid tickers
    existing_records = db.query(models.FinancialStatement).filter(models.FinancialStatement.ticker.in_(valid)).all()
    existing_keys = {(r.ticker, r.fiscal_year) for r in existing_records}

    # Retrieve curated statements
    curated_data = get_curated_statements(tickers=valid, years=None)
    to_insert = [s for s in curated_data if (s["ticker"], s["fiscal_year"]) not in existing_keys]

    if to_insert:
        try:
            db.bulk_insert_mappings(models.FinancialStatement, to_insert)
            db.commit()
            
            upload_log = models.AuditLog(
                dataset_used="financial_statements",
                modules_run=["fs_select"],
                parameters={"rows": len(to_insert), "tickers": valid},
                run_by="system",
            )
            db.add(upload_log)
            db.commit()
        except Exception as exc:
            logger.exception("Failed to load financial statements")
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to load financial statements: {str(exc)}")

    # Query loaded statements
    query = db.query(models.FinancialStatement).filter(models.FinancialStatement.ticker.in_(valid))
    if request.fiscal_years:
        query = query.filter(models.FinancialStatement.fiscal_year.in_(request.fiscal_years))
    rows = query.all()

    return FinancialStatementSelectResponse(
        dataset_id=str(uuid.uuid4()),
        rows_loaded=len(rows),
        tickers_loaded=sorted({r.ticker for r in rows}),
        tickers_missing=missing,
    )


@router.post("/financial-statements/upload")
async def upload_financial_statements_csv(
    file: UploadFile = File(...),
    replace_existing: bool = True,
    db: Session = Depends(get_db_session)
):
    raw_bytes = b""
    max_size = settings.max_upload_size_mb * 1024 * 1024
    while chunk := await file.read(1024 * 1024):
        raw_bytes += chunk
        if len(raw_bytes) > max_size:
            raise HTTPException(status_code=413, detail="File too large.")

    validated_df, warnings = validate_uploaded_csv(raw_bytes, expected_kind="financial_statement")
    if validated_df is None:
        raise HTTPException(status_code=400, detail=warnings[0] if warnings else "Uploaded file failed validation.")
    if validated_df.empty:
        raise HTTPException(status_code=400, detail="CSV contained no valid rows after validation.")

    dataset_id = str(uuid.uuid4())
    records_dict = validated_df.replace({np.nan: None}).to_dict(orient="records")

    if replace_existing:
        try:
            fs_exc_ids = [e[0] for e in db.query(models.AuditException.id).filter(models.AuditException.domain == "financial_statement").all()]
            if fs_exc_ids:
                db.query(models.ReasonCode).filter(models.ReasonCode.exception_id.in_(fs_exc_ids)).delete(synchronize_session=False)
            db.query(models.AuditException).filter(models.AuditException.domain == "financial_statement").delete(synchronize_session=False)
            db.query(models.FinancialStatement).delete(synchronize_session=False)
            db.query(models.BenchmarkResult).filter(models.BenchmarkResult.domain == "financial_statement").delete(synchronize_session=False)
        except Exception:
            logger.exception("Failed to clear existing financial statements")
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to clear existing financial statements.")
    else:
        try:
            for r in records_dict:
                tkr = r.get("ticker")
                yr = r.get("fiscal_year")
                if tkr and yr:
                    db.query(models.FinancialStatement).filter(
                        models.FinancialStatement.ticker == tkr,
                        models.FinancialStatement.fiscal_year == yr,
                    ).delete(synchronize_session=False)
            db.commit()
        except Exception:
            logger.exception("Failed to clean conflicting financial statements")
            db.rollback()

    try:
        db.bulk_insert_mappings(models.FinancialStatement, records_dict)
        db.commit()

        upload_log = models.AuditLog(
            dataset_used=dataset_id,
            modules_run=["fs_upload"],
            parameters={"rows": len(records_dict), "filename": file.filename},
            run_by="system",
        )
        db.add(upload_log)
        db.commit()
    except Exception as e:
        logger.exception("Database insert error for financial statements")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database insert error: {str(e)}")

    tickers_list = sorted(validated_df["ticker"].unique().tolist())
    years_list = sorted([int(y) for y in validated_df["fiscal_year"].unique().tolist()])

    return {
        "dataset_id": dataset_id,
        "rows_ingested": len(records_dict),
        "companies_detected": len(tickers_list),
        "vendors_detected": len(tickers_list),
        "tickers": tickers_list,
        "years": years_list,
        "warnings": warnings,
    }