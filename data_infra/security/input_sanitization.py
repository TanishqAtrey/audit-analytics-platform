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

    elif expected_kind in ("financial_statement", "statements"):
        required = [
            "ticker", "fiscal_year", "revenue", "cogs", "receivables",
            "current_assets", "ppe", "total_assets", "depreciation",
            "sga_expense", "current_liabilities", "long_term_debt",
            "net_income", "cash_flow_ops", "retained_earnings",
            "market_value_equity", "total_liabilities",
        ]
        missing = [col for col in required if col not in df.columns]
        if missing:
            return None, [f"Critical error: Missing mandatory financial statement columns: {', '.join(missing)}"]

        if "company" not in df.columns:
            df["company"] = df["ticker"]
        if "is_aaer_fraud_case" not in df.columns:
            df["is_aaer_fraud_case"] = False
        else:
            df["is_aaer_fraud_case"] = df["is_aaer_fraud_case"].fillna(False).astype(bool)

        numeric_cols = [c for c in required if c not in ("ticker", "fiscal_year")]
        for c in numeric_cols:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)

        if "ebit" in df.columns:
            df["ebit"] = pd.to_numeric(df["ebit"], errors="coerce").fillna(
                (df["revenue"] - df["cogs"] - df["sga_expense"] - df["depreciation"]).round(2)
            )
        else:
            df["ebit"] = (df["revenue"] - df["cogs"] - df["sga_expense"] - df["depreciation"]).round(2)

        df["fiscal_year"] = pd.to_numeric(df["fiscal_year"], errors="coerce").fillna(0).astype(int)
        df["ticker"] = df["ticker"].astype(str).str.strip().str.upper()
        df["company"] = df["company"].astype(str).str.strip()

        ratio_float_cols = [
            "altman_x1_wc_ta", "altman_x2_re_ta", "altman_x3_ebit_ta", "altman_x4_mve_tl", "altman_x5_sales_ta", "altman_z_score",
            "beneish_dsri", "beneish_gmi", "beneish_aqi", "beneish_sgi", "beneish_depi", "beneish_sgai", "beneish_lvgi", "beneish_tata", "beneish_m_score"
        ]
        for rc in ratio_float_cols:
            if rc in df.columns:
                df[rc] = pd.to_numeric(df[rc], errors="coerce")
        if "beneish_manipulator" in df.columns:
            df["beneish_manipulator"] = df["beneish_manipulator"].map(lambda x: True if str(x).lower() in ('true', '1') else False if str(x).lower() in ('false', '0') else None)
        if "altman_zone" in df.columns:
            df["altman_zone"] = df["altman_zone"].astype(str).str.strip().str.lower()

    return df, warnings
