"""
Pydantic contracts for /api/ingest/*.
These are the shapes the frontend's api_client.py codes against — defined
early and kept stable so Person 2 is never blocked waiting on real logic.
"""

from datetime import date
from typing import Literal
from pydantic import BaseModel, Field


class LedgerUploadResponse(BaseModel):
    dataset_id: str
    rows_ingested: int
    vendors_detected: int
    date_range: tuple[date, date] | None = None
    warnings: list[str] = Field(default_factory=list)


class CuratedCompany(BaseModel):
    ticker: str
    company_name: str = ""
    name: str | None = None
    is_aaer_fraud_case: bool = False
    sector: str | None = None

    def model_post_init(self, __context):
        if not self.company_name and self.name:
            self.company_name = self.name
        if not self.name and self.company_name:
            self.name = self.company_name



class CuratedCompanyListResponse(BaseModel):
    companies: list[CuratedCompany]


class FinancialStatementSelectRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=1)
    fiscal_years: list[int] | None = None  # None = all available years


class FinancialStatementSelectResponse(BaseModel):
    dataset_id: str
    rows_loaded: int
    tickers_loaded: list[str]
    tickers_missing: list[str] = Field(default_factory=list)