# backend/tests/test_altman.py
import pandas as pd
from backend.adapters.financial_statement.altman import AltmanZScoreTest

def test_healthy_balance_sheet_is_safe_zone():
    df = pd.DataFrame([{"record_id": "ACME_2025", "current_assets": 800, "current_liabilities": 200,
                         "retained_earnings": 500, "net_income": 300, "market_value_equity": 5000,
                         "total_liabilities": 1000, "revenue": 2000, "total_assets": 2000}])
    assert AltmanZScoreTest().run(df, {}) == []

def test_distressed_balance_sheet_is_flagged():
    df = pd.DataFrame([{"record_id": "TROUBLED_2025", "current_assets": 100, "current_liabilities": 400,
                         "retained_earnings": -200, "net_income": -100, "market_value_equity": 50,
                         "total_liabilities": 900, "revenue": 300, "total_assets": 1000}])
    results = AltmanZScoreTest().run(df, {})
    assert len(results) == 1 and results[0].detail["zone"] == "distress"