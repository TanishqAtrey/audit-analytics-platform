# data_infra/tests/test_schema_integrity.py
"""Verify ORM models match schema.sql column definitions."""
import pytest
from data_infra.db.models import Transaction, FinancialStatement, AuditException, ReasonCode, AuditLog, BenchmarkResult


def test_transaction_columns():
    cols = {c.name for c in Transaction.__table__.columns}
    expected = {'id', 'vendor', 'amount', 'invoice_number', 'invoice_date',
                'po_reference', 'gr_reference', 'po_amount', 'po_quantity',
                'gr_quantity', 'currency', 'source_dataset', 'created_at'}
    assert expected <= cols


def test_exception_columns():
    cols = {c.name for c in AuditException.__table__.columns}
    expected = {'id', 'domain', 'source_record_id', 'ensemble_score',
                'individual_scores', 'status', 'reviewer', 'reviewer_note',
                'created_at', 'updated_at'}
    assert expected <= cols
