# data_infra/tests/test_seed_data.py
"""Basic tests for the seed data script."""
import pytest
from data_infra.ingestion.sec_edgar_loader import CURATED_STATEMENTS


def test_curated_statements_have_all_financial_fields():
    required = ['ticker', 'company', 'fiscal_year', 'revenue', 'cogs',
                'receivables', 'current_assets', 'ppe', 'total_assets',
                'depreciation', 'sga_expense', 'current_liabilities',
                'long_term_debt', 'net_income', 'cash_flow_ops',
                'retained_earnings', 'market_value_equity', 'total_liabilities']
    for stmt in CURATED_STATEMENTS:
        for field in required:
            assert field in stmt, f"Missing '{field}' in {stmt['ticker']} FY{stmt['fiscal_year']}"
