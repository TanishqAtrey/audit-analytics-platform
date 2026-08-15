from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Column, Date, DateTime,
    ForeignKey, Integer, Numeric, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(BigInteger, primary_key=True)
    vendor = Column(Text, nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    invoice_number = Column(Text)
    invoice_date = Column(Date)
    po_reference = Column(Text)
    po_amount = Column(Numeric(14, 2))
    po_quantity = Column(Numeric(12, 2))
    gr_reference = Column(Text)
    gr_quantity = Column(Numeric(12, 2))
    source_dataset = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class FinancialStatement(Base):
    __tablename__ = "financial_statements"
    __table_args__ = (UniqueConstraint("ticker", "fiscal_year", "fiscal_period"),)

    id = Column(BigInteger, primary_key=True)
    ticker = Column(Text, nullable=False)
    company_name = Column(Text)
    sector = Column(Text)
    fiscal_year = Column(Integer, nullable=False)
    fiscal_period = Column(Text, nullable=False, default="FY")
    is_aaer_fraud_case = Column(Boolean, nullable=False, default=False)

    revenue = Column(Numeric(18, 2))
    cogs = Column(Numeric(18, 2))
    receivables = Column(Numeric(18, 2))
    current_assets = Column(Numeric(18, 2))
    ppe = Column(Numeric(18, 2))
    total_assets = Column(Numeric(18, 2))
    depreciation = Column(Numeric(18, 2))
    sga_expense = Column(Numeric(18, 2))
    current_liabilities = Column(Numeric(18, 2))
    long_term_debt = Column(Numeric(18, 2))
    net_income = Column(Numeric(18, 2))
    cash_flow_ops = Column(Numeric(18, 2))
    retained_earnings = Column(Numeric(18, 2))
    market_value_equity = Column(Numeric(18, 2))
    total_liabilities = Column(Numeric(18, 2))

    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class Exception(Base):  # noqa: A001 — intentional; always accessed as models.Exception
    __tablename__ = "exceptions"
    __table_args__ = (
        CheckConstraint("domain IN ('ledger', 'financial_statement')", name="ck_exceptions_domain"),
        CheckConstraint(
            "status IN ('unreviewed', 'confirmed', 'false_positive', 'needs_review')",
            name="ck_exceptions_status",
        ),
    )

    id = Column(BigInteger, primary_key=True)
    domain = Column(Text, nullable=False)
    source_record_id = Column(Text, nullable=False)
    ensemble_score = Column(Numeric(5, 4), nullable=False)
    individual_scores = Column(JSONB, nullable=False, default=dict)

    status = Column(Text, nullable=False, default="unreviewed")
    reviewer = Column(Text)
    reviewer_note = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True))

    reason_codes = relationship("ReasonCode", back_populates="exception", cascade="all, delete-orphan")


class ReasonCode(Base):
    __tablename__ = "reason_codes"

    id = Column(BigInteger, primary_key=True)
    exception_id = Column(BigInteger, ForeignKey("exceptions.id", ondelete="CASCADE"), nullable=False)
    test_name = Column(Text, nullable=False)
    contribution_score = Column(Numeric(5, 4), nullable=False)
    explanation = Column(Text, nullable=False)

    exception = relationship("Exception", back_populates="reason_codes")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(BigInteger, primary_key=True)
    run_timestamp = Column(DateTime(timezone=True), server_default=text("now()"))
    dataset_used = Column(Text, nullable=False)
    modules_run = Column(JSONB, nullable=False, default=list)
    parameters = Column(JSONB, nullable=False, default=dict)
    run_by = Column(Text, nullable=False)


class BenchmarkResult(Base):
    __tablename__ = "benchmark_results"
    __table_args__ = (
        CheckConstraint("domain IN ('ledger', 'financial_statement')", name="ck_benchmark_domain"),
    )

    id = Column(BigInteger, primary_key=True)
    domain = Column(Text, nullable=False)
    baseline_precision = Column(Numeric(5, 4), nullable=False)
    baseline_recall = Column(Numeric(5, 4), nullable=False)
    baseline_f1 = Column(Numeric(5, 4), nullable=False)
    ensemble_precision = Column(Numeric(5, 4), nullable=False)
    ensemble_recall = Column(Numeric(5, 4), nullable=False)
    ensemble_f1 = Column(Numeric(5, 4), nullable=False)
    computed_at = Column(DateTime(timezone=True), server_default=text("now()"))