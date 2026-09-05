# backend/api/routes_ingest.py
"""Upload/select dataset endpoints. Persists ledger CSV uploads and financial statement selections."""

import uuid
import pandas as pd
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from data_infra.db.connection import get_db_session
from data_infra.db import models
from data_infra.security.input_sanitization import validate_uploaded_csv
from data_infra.ingestion.sec_edgar_loader import CURATED_COMPANIES

from backend.schemas.ingest_schemas import (
    LedgerUploadResponse, CuratedCompanyListResponse, CuratedCompany,
    FinancialStatementSelectRequest, FinancialStatementSelectResponse,
)

router = APIRouter()


@router.post("/ledger/upload", response_model=LedgerUploadResponse)
async def upload_ledger_csv(file: UploadFile = File(...), db: Session = Depends(get_db_session)):
    raw_bytes = await file.read()
    validated_df, warnings = validate_uploaded_csv(raw_bytes, expected_kind="ledger")
    if validated_df is None:
        raise HTTPException(status_code=400, detail="Uploaded file failed validation.")

    dataset_id = str(uuid.uuid4())
    records = []
    for _, row in validated_df.iterrows():
        records.append(
            models.Transaction(
                vendor=str(row["vendor"]).strip(),
                amount=float(row["amount"]),
                invoice_number=str(row["invoice_number"]) if pd.notna(row.get("invoice_number")) else None,
                invoice_date=pd.to_datetime(row.get("invoice_date")).date() if pd.notna(row.get("invoice_date")) else None,
                po_reference=str(row["po_reference"]) if pd.notna(row.get("po_reference")) else None,
                gr_reference=str(row["gr_reference"]) if pd.notna(row.get("gr_reference")) else None,
                po_amount=float(row["po_amount"]) if pd.notna(row.get("po_amount")) else None,
                po_quantity=float(row["po_quantity"]) if pd.notna(row.get("po_quantity")) else None,
                gr_quantity=float(row["gr_quantity"]) if pd.notna(row.get("gr_quantity")) else None,
                source_dataset=dataset_id,
            )
        )

    try:
        db.bulk_save_objects(records)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database insert error: {str(e)}")

    date_col = pd.to_datetime(validated_df["invoice_date"], errors="coerce").dropna()
    date_range = (date_col.min().date(), date_col.max().date()) if not date_col.empty else None

    return LedgerUploadResponse(
        dataset_id=dataset_id,
        rows_ingested=len(records),
        vendors_detected=int(validated_df["vendor"].nunique()),
        date_range=date_range,
        warnings=warnings,
    )


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


FS_REQUIRED_COLUMNS = {
    "ticker", "fiscal_year", "revenue", "cogs", "receivables",
    "current_assets", "ppe", "total_assets", "depreciation",
    "sga_expense", "current_liabilities", "long_term_debt",
    "net_income", "cash_flow_ops", "retained_earnings",
    "market_value_equity", "total_liabilities",
}

FS_NUMERIC_COLUMNS = FS_REQUIRED_COLUMNS - {"ticker", "fiscal_year"}


@router.post("/financial-statements/upload", response_model=LedgerUploadResponse)
async def upload_financial_statement_csv(file: UploadFile = File(...), db: Session = Depends(get_db_session)):
    """Upload a raw CSV of financial statement data. Column names must match
    the schema exactly (case-insensitive). This is the counterpart of
    /ledger/upload for the financial_statement domain."""
    raw_bytes = await file.read()
    validated_df, warnings = validate_uploaded_csv(raw_bytes, expected_kind="financial_statement")
    if validated_df is None:
        raise HTTPException(status_code=400, detail="Uploaded file failed validation.")

    missing = FS_REQUIRED_COLUMNS - set(validated_df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required column(s): {', '.join(sorted(missing))}")

    dataset_id = str(uuid.uuid4())
    records = []
    for _, row in validated_df.iterrows():
        kwargs = {
            "ticker": str(row["ticker"]).strip().upper(),
            "fiscal_year": int(row["fiscal_year"]),
            "fiscal_period": str(row.get("fiscal_period", "FY")).strip(),
            "company_name": str(row["company_name"]).strip() if pd.notna(row.get("company_name")) else None,
            "sector": str(row["sector"]).strip() if pd.notna(row.get("sector")) else None,
            "is_aaer_fraud_case": bool(row.get("is_aaer_fraud_case", False)),
        }
        for col in FS_NUMERIC_COLUMNS:
            kwargs[col] = float(row[col]) if pd.notna(row.get(col)) else None
        records.append(models.FinancialStatement(**kwargs))

    try:
        db.bulk_save_objects(records)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database insert error: {str(e)}")

    return LedgerUploadResponse(
        dataset_id=dataset_id,
        rows_ingested=len(records),
        vendors_detected=int(validated_df["ticker"].nunique()),
        date_range=None,
        warnings=warnings,
    )