import io
import pandas as pd

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25MB — generous for a laptop demo, not unbounded
MAX_ROWS = 200_000
LEDGER_REQUIRED_COLUMNS = {"vendor", "amount"}
FORMULA_INJECTION_PREFIXES = ("=", "+", "-", "@")


def _neutralize_formula_injection(value):
    if isinstance(value, str) and value.startswith(FORMULA_INJECTION_PREFIXES):
        return "'" + value  # leading apostrophe forces Excel/Sheets to treat it as text
    return value


def validate_uploaded_csv(raw_bytes: bytes, expected_kind: str = "ledger") -> tuple[pd.DataFrame | None, list[str]]:
    warnings: list[str] = []

    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        return None, [f"File exceeds the {MAX_FILE_SIZE_BYTES // (1024*1024)}MB upload limit."]

    try:
        df = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as exc:
        return None, [f"Could not parse file as CSV: {exc}"]

    if len(df) > MAX_ROWS:
        warnings.append(f"File has {len(df)} rows; only the first {MAX_ROWS} were kept.")
        df = df.head(MAX_ROWS)

    # Normalize column names to lowercase so backend lookups never fail
    # due to mixed-case CSV headers (e.g. "Vendor" vs "vendor")
    df.columns = df.columns.str.strip().str.lower()

    if expected_kind == "ledger":
        missing = LEDGER_REQUIRED_COLUMNS - set(df.columns)
        if missing:
            return None, [f"Missing required column(s): {', '.join(sorted(missing))}"]

    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].map(_neutralize_formula_injection)

    return df, warnings


def validate_ticker(ticker: str) -> str | None:
    """Returns the normalized ticker, or None on basic format failure.
    Doesn't check the curated allowlist — that lives in
    backend/api/routes_ingest.py (Section 3: curated list only)."""
    cleaned = ticker.strip().upper()
    if not (1 <= len(cleaned) <= 6) or not cleaned.isalpha():
        return None
    return cleaned