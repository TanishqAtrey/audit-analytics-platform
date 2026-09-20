# data_infra/security/input_sanitization.py
"""Sanitization and verification helpers for uploaded ledger csv data.
Confirms required headers exist, cleans white spaces, and converts data types."""

import io
import pandas as pd
from typing import Tuple, List, Optional
from backend.config import get_settings


def validate_uploaded_csv(raw_bytes: bytes, expected_kind: str = "ledger") -> Tuple[Optional[pd.DataFrame], List[str]]:
    """Validates the input CSV stream for proper structure, required columns, and types.
    Returns (cleaned_dataframe, list_of_warning_strings). If critical errors are found, returns (None, errors)."""
    warnings = []

    # Guard against oversized uploads
    settings = get_settings()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(raw_bytes) > max_bytes:
        return None, [f"File too large: {len(raw_bytes) / (1024*1024):.1f} MB exceeds the {settings.max_upload_size_mb} MB limit."]
    
    try:
        # Load CSV using pandas
        csv_file = io.BytesIO(raw_bytes)
        df = pd.read_csv(csv_file)
    except Exception as e:
        return None, [f"Failed to parse CSV: {str(e)}"]

    if expected_kind == "ledger":
        # Required columns check
        required = ["vendor", "amount"]
        missing = [col for col in required if col not in df.columns]
        if missing:
            return None, [f"Critical error: Missing mandatory columns: {', '.join(missing)}"]
        
        # Optional columns warning
        recommended = ["invoice_number", "invoice_date", "po_reference", "gr_reference"]
        for col in recommended:
            if col not in df.columns:
                warnings.append(f"Recommended column missing: '{col}' (detection fidelity might be lower)")
                df[col] = None
        
        # Clean amount column
        try:
            df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
            # If any amount is null, notify the analyst and drop it
            null_amt_count = df["amount"].isna().sum()
            if null_amt_count > 0:
                warnings.append(f"Dropped {null_amt_count} rows with invalid or missing 'amount' values.")
                df = df.dropna(subset=["amount"])
        except Exception as e:
            return None, [f"Amount conversion error: {str(e)}"]

        # Clean string columns (preserve NaN as None, don't convert to literal "nan")
        df["vendor"] = df["vendor"].apply(lambda x: str(x).strip() if pd.notna(x) else None)
        
        # Format dates
        if "invoice_date" in df.columns:
            df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce")
            invalid_dates = df["invoice_date"].isna().sum()
            if invalid_dates > 0:
                warnings.append(f"Found {invalid_dates} invalid or missing dates (reverting to null).")
            df["invoice_date"] = df["invoice_date"].where(df["invoice_date"].notna(), other=None)
        else:
            df["invoice_date"] = None

    return df, warnings
