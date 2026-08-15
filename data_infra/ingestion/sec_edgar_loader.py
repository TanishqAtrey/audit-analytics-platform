"""
NOTE: the AAER flags and company list below are a starter list for demo
purposes. Verify each ticker's actual SEC AAER release/enforcement action
against https://www.sec.gov/divisions/enforce/friactions before citing
specifics in front of an audience — don't present unverified details as
confirmed fact.
"""

import time
import requests
import pandas as pd

from data_infra.db.connection import bulk_copy_dataframe

SEC_HEADERS = {"User-Agent": "Audit Analytics Platform (hackathon-demo; contact@example.com)"}
TICKER_CIK_MAP_URL = "https://www.sec.gov/files/company_tickers.json"
COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"

# Starter curated list — extend to 30-50 following this pattern.
CURATED_COMPANIES = [
    {"ticker": "AAPL", "company_name": "Apple Inc.", "sector": "Technology", "is_aaer_fraud_case": False},
    {"ticker": "MSFT", "company_name": "Microsoft Corporation", "sector": "Technology", "is_aaer_fraud_case": False},
    {"ticker": "JNJ",  "company_name": "Johnson & Johnson", "sector": "Healthcare", "is_aaer_fraud_case": False},
    {"ticker": "PG",   "company_name": "Procter & Gamble Co.", "sector": "Consumer Staples", "is_aaer_fraud_case": False},
    {"ticker": "KO",   "company_name": "The Coca-Cola Company", "sector": "Consumer Staples", "is_aaer_fraud_case": False},
    {"ticker": "PEP",  "company_name": "PepsiCo, Inc.", "sector": "Consumer Staples", "is_aaer_fraud_case": False},
    {"ticker": "WMT",  "company_name": "Walmart Inc.", "sector": "Consumer Staples", "is_aaer_fraud_case": False},
    {"ticker": "HD",   "company_name": "The Home Depot, Inc.", "sector": "Consumer Discretionary", "is_aaer_fraud_case": False},
    {"ticker": "V",    "company_name": "Visa Inc.", "sector": "Financials", "is_aaer_fraud_case": False},
    {"ticker": "MA",   "company_name": "Mastercard Incorporated", "sector": "Financials", "is_aaer_fraud_case": False},
    {"ticker": "UNH",  "company_name": "UnitedHealth Group Inc.", "sector": "Healthcare", "is_aaer_fraud_case": False},
    {"ticker": "XOM",  "company_name": "Exxon Mobil Corporation", "sector": "Energy", "is_aaer_fraud_case": False},
    {"ticker": "CVX",  "company_name": "Chevron Corporation", "sector": "Energy", "is_aaer_fraud_case": False},
    {"ticker": "VZ",   "company_name": "Verizon Communications Inc.", "sector": "Telecom", "is_aaer_fraud_case": False},
    {"ticker": "INTC", "company_name": "Intel Corporation", "sector": "Technology", "is_aaer_fraud_case": False},
    {"ticker": "CSCO", "company_name": "Cisco Systems, Inc.", "sector": "Technology", "is_aaer_fraud_case": False},
    {"ticker": "COST", "company_name": "Costco Wholesale Corporation", "sector": "Consumer Staples", "is_aaer_fraud_case": False},
    {"ticker": "MCD",  "company_name": "McDonald's Corporation", "sector": "Consumer Discretionary", "is_aaer_fraud_case": False},
    {"ticker": "NKE",  "company_name": "Nike, Inc.", "sector": "Consumer Discretionary", "is_aaer_fraud_case": False},
    {"ticker": "ADBE", "company_name": "Adobe Inc.", "sector": "Technology", "is_aaer_fraud_case": False},
    # -- AAER-flagged (public SEC enforcement actions; verify release
    #    numbers/fiscal years before citing specifics — see module docstring) --
    {"ticker": "GE",   "company_name": "General Electric Company", "sector": "Industrials", "is_aaer_fraud_case": True},
    {"ticker": "KHC",  "company_name": "The Kraft Heinz Company", "sector": "Consumer Staples", "is_aaer_fraud_case": True},
    {"ticker": "UAA",  "company_name": "Under Armour, Inc.", "sector": "Consumer Discretionary", "is_aaer_fraud_case": True},
    {"ticker": "WBA",  "company_name": "Walgreens Boots Alliance, Inc.", "sector": "Healthcare", "is_aaer_fraud_case": True},
]

CONCEPT_ALIASES = {
    "revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax"],
    "cogs": ["CostOfGoodsAndServicesSold", "CostOfRevenue"],
    "receivables": ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent"],
    "current_assets": ["AssetsCurrent"],
    "ppe": ["PropertyPlantAndEquipmentNet"],
    "total_assets": ["Assets"],
    "depreciation": ["DepreciationDepletionAndAmortization", "Depreciation"],
    "sga_expense": ["SellingGeneralAndAdministrativeExpense"],
    "current_liabilities": ["LiabilitiesCurrent"],
    "long_term_debt": ["LongTermDebtNoncurrent", "LongTermDebt"],
    "net_income": ["NetIncomeLoss"],
    "cash_flow_ops": ["NetCashProvidedByUsedInOperatingActivities"],
    "retained_earnings": ["RetainedEarningsAccumulatedDeficit"],
    "market_value_equity": ["StockholdersEquity"],
    "total_liabilities": ["Liabilities"],
}


def _load_cik_map() -> dict[str, int]:
    resp = requests.get(TICKER_CIK_MAP_URL, headers=SEC_HEADERS, timeout=30)
    resp.raise_for_status()
    raw = resp.json()
    # cik_str comes from the JSON as a string — cast to int so the
    # COMPANY_FACTS_URL format specifier ({cik:010d}) doesn't crash
    return {row["ticker"].upper(): int(row["cik_str"]) for row in raw.values()}


def _fetch_company_facts(cik: int) -> dict:
    resp = requests.get(COMPANY_FACTS_URL.format(cik=cik), headers=SEC_HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _extract_annual_series(facts: dict, field: str) -> dict[int, float]:
    """{fiscal_year: value} for one line item's annual (10-K, 'FY')
    datapoints, trying each alias in order."""
    us_gaap = facts.get("facts", {}).get("us-gaap", {})
    for concept in CONCEPT_ALIASES[field]:
        if concept not in us_gaap:
            continue
        usd_points = us_gaap[concept].get("units", {}).get("USD", [])
        by_year = {p["fy"]: p["val"] for p in usd_points
                   if p.get("fp") == "FY" and p.get("form") == "10-K" and "fy" in p}
        if by_year:
            return by_year
    return {}


def load_curated_companies(min_fiscal_year: int = 2010, max_years: int = 6) -> pd.DataFrame:
    """Fetches + reshapes companyfacts for every curated ticker. Kept
    separate from the DB write so it's independently testable."""
    cik_map = _load_cik_map()
    rows = []

    for company in CURATED_COMPANIES:
        cik = cik_map.get(company["ticker"])
        if cik is None:
            continue  # skip silently rather than guess a CIK

        facts = _fetch_company_facts(cik)
        series_by_field = {f: _extract_annual_series(facts, f) for f in CONCEPT_ALIASES}
        all_years = sorted({y for s in series_by_field.values() for y in s if y >= min_fiscal_year})

        for year in all_years[-max_years:]:
            row = {"ticker": company["ticker"], "company_name": company["company_name"],
                   "sector": company["sector"], "fiscal_year": year, "fiscal_period": "FY",
                   "is_aaer_fraud_case": company["is_aaer_fraud_case"]}
            row.update({f: s.get(year) for f, s in series_by_field.items()})
            rows.append(row)

        time.sleep(0.15)  # stay well under SEC's fair-access rate limit

    return pd.DataFrame(rows)


def load_and_persist_curated_companies() -> int:
    df = load_curated_companies()
    columns = ["ticker", "company_name", "sector", "fiscal_year", "fiscal_period", "is_aaer_fraud_case",
               "revenue", "cogs", "receivables", "current_assets", "ppe", "total_assets", "depreciation",
               "sga_expense", "current_liabilities", "long_term_debt", "net_income", "cash_flow_ops",
               "retained_earnings", "market_value_equity", "total_liabilities"]
    for col in columns:
        if col not in df.columns:
            df[col] = None
    return bulk_copy_dataframe(df, "financial_statements", columns)