# backend/tests/test_beneish.py
import pandas as pd
from backend.adapters.financial_statement.beneish import BeneishMScoreTest


def _row(**overrides):
    base = dict(
        record_id="ACME_2025", receivables=100, receivables_prior=100, revenue=1000, revenue_prior=1000,
        cogs=600, cogs_prior=600, current_assets=200, current_assets_prior=200, ppe=500, ppe_prior=500,
        total_assets=1000, total_assets_prior=1000, depreciation=50, depreciation_prior=50,
        sga_expense=100, sga_expense_prior=100, current_liabilities=150, current_liabilities_prior=150,
        long_term_debt=200, long_term_debt_prior=200, net_income=100, cash_flow_ops=100,
    )
    base.update(overrides)
    return base


def test_flat_year_over_year_is_not_flagged():
    assert BeneishMScoreTest().run(pd.DataFrame([_row()]), {}) == []


def test_receivables_spike_raises_score():
    results = BeneishMScoreTest().run(pd.DataFrame([_row(receivables=500, revenue=800)]), {})
    assert len(results) == 1 and results[0].detail["m_score"] > -2.22


def test_zero_division_guard():
    # Should safely compute without throwing ZeroDivisionError
    row_with_zeros = _row(revenue=0, revenue_prior=0, total_assets=0)
    results = BeneishMScoreTest().run(pd.DataFrame([row_with_zeros]), {})
    assert results == []