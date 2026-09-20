# data_infra/tests/test_sec_edgar_loader.py
"""Tests for the SEC EDGAR curated company loader."""
import pytest
from data_infra.ingestion.sec_edgar_loader import CURATED_COMPANIES, get_curated_statements


def test_curated_companies_not_empty():
    assert len(CURATED_COMPANIES) > 0


def test_curated_companies_have_required_fields():
    for c in CURATED_COMPANIES:
        assert 'ticker' in c
        assert 'company_name' in c
        assert 'is_aaer_fraud_case' in c


def test_get_curated_statements_filters_by_ticker():
    results = get_curated_statements(tickers=['AAPL'])
    assert all(r['ticker'] == 'AAPL' for r in results)
    assert len(results) > 0


def test_get_curated_statements_filters_by_year():
    results = get_curated_statements(years=[2023])
    assert all(r['fiscal_year'] == 2023 for r in results)
