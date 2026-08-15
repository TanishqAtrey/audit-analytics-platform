# test_sec_edgar_loader.py — doesn't hit the real SEC API in CI (flaky +
# slow); _extract_annual_series is tested against a hand-built fixture.
from data_infra.ingestion.sec_edgar_loader import CURATED_COMPANIES, _extract_annual_series

def test_curated_company_list_has_required_fields():
    for c in CURATED_COMPANIES:
        assert {"ticker", "company_name", "sector", "is_aaer_fraud_case"} <= c.keys()
        assert c["ticker"].isupper()

def test_curated_list_includes_both_clean_and_flagged_companies():
    assert any(c["is_aaer_fraud_case"] for c in CURATED_COMPANIES)
    assert any(not c["is_aaer_fraud_case"] for c in CURATED_COMPANIES)

def test_extract_annual_series_picks_first_matching_alias():
    fake_facts = {"facts": {"us-gaap": {"Revenues": {"units": {"USD": [
        {"fy": 2023, "fp": "FY", "form": "10-K", "val": 1000},
        {"fy": 2024, "fp": "FY", "form": "10-K", "val": 1200},
    ]}}}}}
    assert _extract_annual_series(fake_facts, "revenue") == {2023: 1000, 2024: 1200}

def test_extract_annual_series_returns_empty_when_concept_missing():
    assert _extract_annual_series({"facts": {"us-gaap": {}}}, "revenue") == {}