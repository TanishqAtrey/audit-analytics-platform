from data_infra.ingestion.sec_edgar_loader import CURATED_COMPANIES
from data_infra.db.connection import SessionLocal
from data_infra.db import models


def build_aaer_labels() -> dict[str, int]:
    """
    {record_id: 0/1}, keyed the same way financial_statements' record_id
    is built in backend/adapters/financial_statement/adapter.py
    ("TICKER_FISCALYEAR"). A company is labeled 1 for every fiscal year on
    file once flagged (a conservative simplification — the real AAER may
    cover a narrower period, so treat this as a coarse label).
    """
    aaer_tickers = {c["ticker"] for c in CURATED_COMPANIES if c["is_aaer_fraud_case"]}
    with SessionLocal() as db:
        rows = (db.query(models.FinancialStatement.ticker, models.FinancialStatement.fiscal_year)
                  .filter(models.FinancialStatement.ticker.in_(aaer_tickers)).all())
    return {f"{ticker}_{year}": 1 for ticker, year in rows}


def sync_aaer_flags_to_db() -> int:
    """Re-applies is_aaer_fraud_case from the curated list — useful after
    a fresh sec_edgar_loader run inserted rows before this flag was set."""
    aaer_tickers = [c["ticker"] for c in CURATED_COMPANIES if c["is_aaer_fraud_case"]]
    with SessionLocal() as db:
        updated = (db.query(models.FinancialStatement)
                     .filter(models.FinancialStatement.ticker.in_(aaer_tickers))
                     .update({models.FinancialStatement.is_aaer_fraud_case: True}, synchronize_session=False))
        db.commit()
    return updated