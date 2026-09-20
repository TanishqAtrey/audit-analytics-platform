# data_infra/ingestion/sec_aaer_loader.py
"""SEC Accounting and Auditing Enforcement Releases (AAER) loader.
Provides ground-truth fraud labels for financial statement backtesting."""


AAER_FRAUD_TICKERS = [
    "ENRN", "WCOM", "TYCO", "HLTH",
]


def get_aaer_labels(tickers: list[str] | None = None) -> dict[str, int]:
    """Returns {ticker: 1} for known AAER fraud cases, {ticker: 0} for clean baselines."""
    fraud_set = set(AAER_FRAUD_TICKERS)
    if tickers is None:
        tickers = list(fraud_set)
    return {t: int(t in fraud_set) for t in tickers}
