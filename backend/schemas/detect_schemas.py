from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

Domain = Literal["ledger", "financial_statement"]
CaseStatus = Literal["unreviewed", "confirmed", "false_positive", "needs_review"]

from backend.config import get_settings
settings = get_settings()


class ThresholdConfig(BaseModel):
    """One knob per test; the UI slider maps directly onto these fields.
    Values are 0-1 'sensitivity' — higher = more permissive = more flags."""
    benford_sensitivity: float = Field(0.5, ge=0.0, le=1.0)
    duplicate_similarity_threshold: float = Field(85.0, ge=0.0, le=100.0)
    isolation_forest_contamination: float = Field(0.05, ge=0.001, le=0.5)
    lof_contamination: float = Field(0.05, ge=0.001, le=0.5)
    three_way_match_tolerance_pct: float = Field(0.02, ge=0.0, le=1.0)


class DetectionRunRequest(BaseModel):
    domain: Domain
    dataset_id: str
    tests: list[str] | None = None   # None = run every registered test for this domain
    thresholds: ThresholdConfig = ThresholdConfig()
    run_by: str = "demo_user"        # minimal session identity — see Section 6 of the spec


class ReasonCodeOut(BaseModel):
    test_name: str
    contribution_score: float
    explanation: str


class ExceptionOut(BaseModel):
    id: int
    domain: Domain
    source_record_id: str
    ensemble_score: float
    individual_scores: dict[str, float]
    status: CaseStatus
    reason_codes: list[ReasonCodeOut]
    created_at: datetime

    vendor: str | None = None
    amount: float | None = None
    currency: str | None = settings.default_currency
    invoice_number: str | None = None
    date: str | None = None

    company: str | None = None
    ticker: str | None = None
    fiscal_year: int | None = None
    m_score: float | None = None
    z_score: float | None = None


class DetectionRunResponse(BaseModel):
    run_id: int
    domain: Domain
    dataset_id: str
    total_records_scanned: int
    total_exceptions: int
    exceptions: list[ExceptionOut]


class ExceptionListQuery(BaseModel):
    domain: Domain | None = None
    status: CaseStatus | None = None
    min_score: float | None = None
    limit: int = Field(100, le=1000)
    offset: int = 0


class SummaryStatsResponse(BaseModel):
    total_transactions: int
    ledger_exceptions: int
    fs_exceptions: int
    confirmed_fraud: int
    false_positives: int
    needs_review: int
    precision: float
    confirmation_rate: float
    f1_score: float
    last_run: str | None = None
    ensemble_vs_baseline: str = "N/A"