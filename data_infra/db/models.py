# data_infra/db/models.py
"""SQLAlchemy model declarations for the Audit Analytics Platform.
Directly maps to schemas defined in data_infra/db/schema.sql."""

from datetime import datetime, date, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, JSON, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship, declarative_base
from backend.config import get_settings

settings = get_settings()
Base = declarative_base()


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    vendor = Column(String(255), nullable=False, index=True)
    amount = Column(Numeric(18, 2), nullable=False)
    invoice_number = Column(String(100), nullable=True)
    invoice_date = Column(Date, nullable=True, index=True)
    po_reference = Column(String(100), nullable=True)
    gr_reference = Column(String(100), nullable=True)
    po_amount = Column(Numeric(18, 2), nullable=True)
    po_quantity = Column(Numeric(18, 4), nullable=True)
    gr_quantity = Column(Numeric(18, 4), nullable=True)
    currency = Column(String(10), nullable=True, default=settings.default_currency)
    source_dataset = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class FinancialStatement(Base):
    __tablename__ = "financial_statements"
    __table_args__ = (UniqueConstraint('ticker', 'fiscal_year', name='uq_ticker_fiscal_year'),)

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), nullable=False, index=True)
    company = Column(String(255), nullable=False)
    fiscal_year = Column(Integer, nullable=False)
    revenue = Column(Numeric(18, 2), nullable=False)
    cogs = Column(Numeric(18, 2), nullable=False)
    receivables = Column(Numeric(18, 2), nullable=False)
    current_assets = Column(Numeric(18, 2), nullable=False)
    ppe = Column(Numeric(18, 2), nullable=False)
    total_assets = Column(Numeric(18, 2), nullable=False)
    depreciation = Column(Numeric(18, 2), nullable=False)
    sga_expense = Column(Numeric(18, 2), nullable=False)
    current_liabilities = Column(Numeric(18, 2), nullable=False)
    long_term_debt = Column(Numeric(18, 2), nullable=False)
    net_income = Column(Numeric(18, 2), nullable=False)
    cash_flow_ops = Column(Numeric(18, 2), nullable=False)
    retained_earnings = Column(Numeric(18, 2), nullable=False)
    market_value_equity = Column(Numeric(18, 2), nullable=False)
    total_liabilities = Column(Numeric(18, 2), nullable=False)
    is_aaer_fraud_case = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AuditException(Base):
    __tablename__ = "exceptions"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(50), nullable=False, index=True)
    source_record_id = Column(String(100), nullable=False, index=True)
    ensemble_score = Column(Numeric(5, 4), nullable=False, index=True)
    individual_scores = Column(JSON, nullable=True)
    status = Column(String(50), nullable=False, default="unreviewed", index=True)
    reviewer = Column(String(100), nullable=True)
    reviewer_note = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=True)

    reason_codes = relationship("ReasonCode", back_populates="audit_exception", cascade="all, delete-orphan")


class ReasonCode(Base):
    __tablename__ = "reason_codes"

    id = Column(Integer, primary_key=True, index=True)
    exception_id = Column(Integer, ForeignKey("exceptions.id", ondelete="CASCADE"), nullable=False)
    test_name = Column(String(100), nullable=False)
    contribution_score = Column(Numeric(5, 4), nullable=False)
    explanation = Column(String(500), nullable=False)

    audit_exception = relationship("AuditException", back_populates="reason_codes")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    run_timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    dataset_used = Column(String(255), nullable=False)
    modules_run = Column(JSON, nullable=False)
    parameters = Column(JSON, nullable=False)
    run_by = Column(String(100), nullable=False)


class BenchmarkResult(Base):
    __tablename__ = "benchmark_results"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(50), nullable=False, index=True)
    baseline_precision = Column(JSON, nullable=False)
    baseline_recall = Column(JSON, nullable=False)
    baseline_f1 = Column(JSON, nullable=False)
    ensemble_precision = Column(JSON, nullable=False)
    ensemble_recall = Column(JSON, nullable=False)
    ensemble_f1 = Column(JSON, nullable=False)
    computed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
