"""
Standalone backend validation script.
Generates synthetic data, runs all detection tests, prints results.
No database, no frontend, no server needed.

Usage:
    cd /Users/tanishqatrey/audit-analytics-platform
    source backend_venv/bin/activate
    python -m backend.run_full_validation
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ── Core imports ──
from backend.core.scorer import combine_results
from backend.core.reason_codes import build_reason_codes

# ── Ledger tests ──
from backend.adapters.ledger.benford import BenfordEnsembleTest
from backend.adapters.ledger.duplicate_detection import DuplicateDetectionTest
from backend.adapters.ledger.three_way_match import ThreeWayMatchTest
from backend.adapters.ledger.transaction_anomaly import TransactionAnomalyTest

# ── Financial statement tests ──
from backend.adapters.financial_statement.beneish import BeneishMScoreTest
from backend.adapters.financial_statement.altman import AltmanZScoreTest
from backend.adapters.financial_statement.ratio_anomaly import RatioAnomalyTest

# ── Validation ──
from backend.validation.metrics import compute_prf


# ═══════════════════════════════════════════════════════════════════
#  SYNTHETIC DATA GENERATORS
# ═══════════════════════════════════════════════════════════════════

def generate_ledger_data(n_clean=300, n_suspicious=50, n_duplicates=20, seed=42):
    """
    Generates a ledger DataFrame with:
      - Clean transactions (Benford-conformant, unique invoices, valid POs)
      - Suspicious vendor group (round-number amounts → Benford violation)
      - Duplicate invoices (same vendor, same amount, same invoice number)
      - Missing PO / GR records (three-way match violations)
    Returns (df, labels) where labels[record_id] = 1 if anomalous.
    """
    rng = np.random.default_rng(seed)
    records = []
    labels = {}
    rid = 0
    base_date = datetime(2025, 1, 1)
    vendors_clean = ["Alpha Supply Co", "Beta Logistics", "Gamma Materials",
                     "Delta Services", "Epsilon Parts"]

    # ── Clean transactions ──
    for i in range(n_clean):
        vendor = rng.choice(vendors_clean)
        amount = round(float(np.exp(rng.uniform(np.log(50), np.log(50000)))), 2)
        record_id = f"TXN-{rid:04d}"
        records.append({
            "record_id": record_id,
            "vendor": vendor,
            "amount": amount,
            "invoice_number": f"INV-{rid:05d}",
            "invoice_date": base_date + timedelta(days=int(rng.integers(0, 365))),
            "po_reference": f"PO-{rid:04d}",
            "po_amount": round(amount * rng.uniform(0.99, 1.01), 2),
            "po_quantity": int(rng.integers(1, 100)),
            "gr_reference": f"GR-{rid:04d}",
            "gr_quantity": int(rng.integers(1, 100)),
        })
        labels[record_id] = 0
        rid += 1

    # ── Suspicious vendor (round numbers → Benford violation) ──
    for i in range(n_suspicious):
        record_id = f"TXN-{rid:04d}"
        amount = float(rng.choice([100, 200, 500, 1000, 2000, 5000, 10000]))
        records.append({
            "record_id": record_id,
            "vendor": "Shady Consulting LLC",
            "amount": amount,
            "invoice_number": f"SC-{rid:04d}",
            "invoice_date": base_date + timedelta(days=int(rng.integers(0, 365))),
            "po_reference": f"PO-{rid:04d}",
            "po_amount": amount,
            "po_quantity": 1,
            "gr_reference": f"GR-{rid:04d}",
            "gr_quantity": 1,
        })
        labels[record_id] = 1
        rid += 1

    # ── Duplicate invoices ──
    for i in range(n_duplicates):
        record_id_a = f"TXN-{rid:04d}"
        rid += 1
        record_id_b = f"TXN-{rid:04d}"
        rid += 1
        amount = round(float(rng.uniform(1000, 20000)), 2)
        inv_date = base_date + timedelta(days=int(rng.integers(0, 365)))
        shared = {
            "vendor": "Alpha Supply Co",
            "amount": amount,
            "invoice_number": f"DUP-{i:04d}",
            "invoice_date": inv_date,
            "po_reference": f"PO-DUP-{i:04d}",
            "po_amount": amount,
            "po_quantity": 5,
            "gr_reference": f"GR-DUP-{i:04d}",
            "gr_quantity": 5,
        }
        records.append({"record_id": record_id_a, **shared})
        records.append({"record_id": record_id_b, **shared,
                        "invoice_date": inv_date + timedelta(days=1)})
        labels[record_id_a] = 1
        labels[record_id_b] = 1

    # ── Missing PO / GR (three-way match violations) ──
    for i in range(15):
        record_id = f"TXN-{rid:04d}"
        records.append({
            "record_id": record_id,
            "vendor": rng.choice(vendors_clean),
            "amount": round(float(rng.uniform(500, 10000)), 2),
            "invoice_number": f"NOPO-{i:04d}",
            "invoice_date": base_date + timedelta(days=int(rng.integers(0, 365))),
            "po_reference": None,
            "po_amount": None,
            "po_quantity": None,
            "gr_reference": None,
            "gr_quantity": None,
        })
        labels[record_id] = 1
        rid += 1

    # ── Overbilled PO ──
    for i in range(10):
        record_id = f"TXN-{rid:04d}"
        po_amount = round(float(rng.uniform(1000, 5000)), 2)
        records.append({
            "record_id": record_id,
            "vendor": "Beta Logistics",
            "amount": round(po_amount * 1.5, 2),  # 50% over PO
            "invoice_number": f"OVER-{i:04d}",
            "invoice_date": base_date + timedelta(days=int(rng.integers(0, 365))),
            "po_reference": f"PO-OVER-{i:04d}",
            "po_amount": po_amount,
            "po_quantity": 10,
            "gr_reference": f"GR-OVER-{i:04d}",
            "gr_quantity": 10,
        })
        labels[record_id] = 1
        rid += 1

    df = pd.DataFrame(records)
    df["invoice_date"] = pd.to_datetime(df["invoice_date"])
    df["amount"] = pd.to_numeric(df["amount"])
    return df, labels


def generate_financial_statement_data(seed=42):
    """
    Generates financial statement data for ~20 companies across 3 years.
    Some companies have manipulated financials (Beneish flags) or
    distressed balance sheets (Altman flags).
    Returns (df, labels).
    """
    rng = np.random.default_rng(seed)
    records = []
    labels = {}

    # ── Healthy companies ──
    healthy = ["AAPL", "MSFT", "GOOG", "JNJ", "PG", "KO", "PEP",
               "WMT", "HD", "UNH", "V", "MA"]
    for ticker in healthy:
        base_rev = rng.uniform(5000, 50000)
        for year in [2023, 2024, 2025]:
            rev = base_rev * (1 + rng.uniform(-0.05, 0.10))
            ta = rev * rng.uniform(1.5, 3.0)
            records.append({
                "ticker": ticker, "fiscal_year": year,
                "revenue": round(rev, 2),
                "cogs": round(rev * rng.uniform(0.55, 0.70), 2),
                "receivables": round(rev * rng.uniform(0.08, 0.15), 2),
                "current_assets": round(ta * rng.uniform(0.25, 0.40), 2),
                "ppe": round(ta * rng.uniform(0.20, 0.35), 2),
                "total_assets": round(ta, 2),
                "depreciation": round(ta * rng.uniform(0.02, 0.05), 2),
                "sga_expense": round(rev * rng.uniform(0.10, 0.20), 2),
                "current_liabilities": round(ta * rng.uniform(0.10, 0.20), 2),
                "long_term_debt": round(ta * rng.uniform(0.10, 0.25), 2),
                "net_income": round(rev * rng.uniform(0.08, 0.18), 2),
                "cash_flow_ops": round(rev * rng.uniform(0.10, 0.20), 2),
                "retained_earnings": round(ta * rng.uniform(0.15, 0.40), 2),
                "market_value_equity": round(ta * rng.uniform(2.0, 5.0), 2),
                "total_liabilities": round(ta * rng.uniform(0.30, 0.55), 2),
            })
            rid = f"{ticker}_{year}"
            labels[rid] = 0
            base_rev = rev

    # ── Fraud-pattern companies (receivables spike, revenue inflation) ──
    fraud_tickers = ["ENRN", "WRLD", "TYCO"]
    for ticker in fraud_tickers:
        base_rev = rng.uniform(3000, 15000)
        for yi, year in enumerate([2023, 2024, 2025]):
            rev = base_rev * (1.3 ** yi)  # aggressive revenue growth
            ta = rev * 2.0
            rec_ratio = 0.10 if yi == 0 else 0.35  # receivables spike
            records.append({
                "ticker": ticker, "fiscal_year": year,
                "revenue": round(rev, 2),
                "cogs": round(rev * 0.80, 2),  # thin margins
                "receivables": round(rev * rec_ratio, 2),
                "current_assets": round(ta * 0.30, 2),
                "ppe": round(ta * 0.25, 2),
                "total_assets": round(ta, 2),
                "depreciation": round(ta * 0.03, 2),
                "sga_expense": round(rev * 0.25, 2),
                "current_liabilities": round(ta * 0.20, 2),
                "long_term_debt": round(ta * 0.30, 2),
                "net_income": round(rev * 0.02, 2),
                "cash_flow_ops": round(rev * -0.05, 2),  # negative cash flow
                "retained_earnings": round(ta * 0.05, 2),
                "market_value_equity": round(ta * 1.0, 2),
                "total_liabilities": round(ta * 0.60, 2),
            })
            rid = f"{ticker}_{year}"
            labels[rid] = 1 if yi > 0 else 0
            base_rev = rev

    # ── Distressed companies (Altman flag) ──
    distressed_tickers = ["BKRP", "FAIL"]
    for ticker in distressed_tickers:
        for year in [2023, 2024, 2025]:
            ta = rng.uniform(800, 2000)
            records.append({
                "ticker": ticker, "fiscal_year": year,
                "revenue": round(ta * 0.3, 2),
                "cogs": round(ta * 0.28, 2),
                "receivables": round(ta * 0.05, 2),
                "current_assets": round(ta * 0.10, 2),
                "ppe": round(ta * 0.30, 2),
                "total_assets": round(ta, 2),
                "depreciation": round(ta * 0.04, 2),
                "sga_expense": round(ta * 0.10, 2),
                "current_liabilities": round(ta * 0.40, 2),
                "long_term_debt": round(ta * 0.45, 2),
                "net_income": round(ta * -0.10, 2),
                "cash_flow_ops": round(ta * -0.05, 2),
                "retained_earnings": round(ta * -0.20, 2),
                "market_value_equity": round(ta * 0.05, 2),
                "total_liabilities": round(ta * 0.90, 2),
            })
            rid = f"{ticker}_{year}"
            labels[rid] = 1

    df = pd.DataFrame(records)
    return df, labels


# ═══════════════════════════════════════════════════════════════════
#  RESHAPE (same as adapters but standalone)
# ═══════════════════════════════════════════════════════════════════

def reshape_fs(raw_df):
    """Replicates financial_statement/adapter.reshape_with_prior_year."""
    df = raw_df.sort_values(["ticker", "fiscal_year"]).copy()
    df["record_id"] = df["ticker"] + "_" + df["fiscal_year"].astype(str)
    prior_cols = [c for c in df.columns if c not in ("ticker", "fiscal_year", "record_id")]
    prior = df.groupby("ticker")[prior_cols].shift(1)
    prior.columns = [f"{c}_prior" for c in prior_cols]
    df = pd.concat([df, prior], axis=1)
    return df


# ═══════════════════════════════════════════════════════════════════
#  RUN ALL TESTS
# ═══════════════════════════════════════════════════════════════════

def run_domain(domain_name, df, tests, labels, config_by_test=None):
    config_by_test = config_by_test or {}
    print(f"\n{'='*70}")
    print(f"  DOMAIN: {domain_name.upper()}")
    print(f"  Records: {len(df)}  |  Known anomalies: {sum(labels.values())}")
    print(f"{'='*70}")

    results_by_test = {}
    for test in tests:
        cfg = config_by_test.get(test.name, {})
        results = test.run(df, cfg)
        results_by_test[test.name] = results
        flagged = len(results)
        avg_score = np.mean([r.score for r in results]) if results else 0.0
        print(f"\n  [{test.name}]")
        print(f"    Flagged: {flagged} records")
        print(f"    Avg score: {avg_score:.3f}")
        if results:
            top = sorted(results, key=lambda r: r.score, reverse=True)[:3]
            for r in top:
                print(f"    Top hit: {r.record_id} → {r.score:.3f}")

    # ── Ensemble ──
    exceptions = combine_results(results_by_test, total_domain_tests=len(tests))

    print(f"\n  {'─'*60}")
    print(f"  ENSEMBLE RESULTS")
    print(f"    Total exceptions: {len(exceptions)}")
    if exceptions:
        print(f"    Score range: {exceptions[-1]['ensemble_score']:.4f} – {exceptions[0]['ensemble_score']:.4f}")
        print(f"\n    Top 10 exceptions:")
        for e in exceptions[:10]:
            marker = " ✓ TRUE" if labels.get(e["source_record_id"], 0) == 1 else "   clean"
            print(f"      {e['source_record_id']:>12}  score={e['ensemble_score']:.4f}  {marker}")
            for rc in e["reason_codes"][:2]:
                print(f"          └─ {rc['explanation'][:80]}")

    # ── Precision / Recall / F1 ──
    all_ids = df["record_id"].tolist()
    for threshold in [0.3, 0.5, 0.7]:
        score_map = {e["source_record_id"]: e["ensemble_score"] for e in exceptions}
        y_true = [labels.get(rid, 0) for rid in all_ids]
        y_pred = [int(score_map.get(rid, 0.0) >= threshold) for rid in all_ids]
        prf = compute_prf(y_true, y_pred)
        print(f"\n    @threshold={threshold}: precision={prf['precision']:.3f}  recall={prf['recall']:.3f}  f1={prf['f1']:.3f}")

    return exceptions


# ═══════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║        AUDIT ANALYTICS PLATFORM — BACKEND VALIDATION           ║")
    print("║        No database · No frontend · Pure algorithm check        ║")
    print(f"║        {datetime.now().strftime('%Y-%m-%d %H:%M:%S'):^50}       ║")
    print("╚══════════════════════════════════════════════════════════════════╝")

    # ── LEDGER DOMAIN ──
    ledger_df, ledger_labels = generate_ledger_data()
    ledger_tests = [
        BenfordEnsembleTest(),
        DuplicateDetectionTest(),
        ThreeWayMatchTest(),
        TransactionAnomalyTest(),
    ]
    ledger_config = {
        "benford_ensemble": {"benford_sensitivity": 0.5},
        "duplicate_detection": {"duplicate_similarity_threshold": 85.0},
        "three_way_match": {"three_way_match_tolerance_pct": 0.02},
        "ledger_transaction_anomaly": {
            "isolation_forest_contamination": 0.05,
            "lof_contamination": 0.05,
        },
    }
    run_domain("ledger", ledger_df, ledger_tests, ledger_labels, ledger_config)

    # ── FINANCIAL STATEMENT DOMAIN ──
    fs_raw, fs_labels = generate_financial_statement_data()
    fs_df = reshape_fs(fs_raw)
    fs_tests = [
        BeneishMScoreTest(),
        AltmanZScoreTest(),
        RatioAnomalyTest(),
    ]
    fs_config = {
        "ratio_anomaly": {
            "isolation_forest_contamination": 0.05,
            "lof_contamination": 0.05,
        },
    }
    run_domain("financial_statement", fs_df, fs_tests, fs_labels, fs_config)

    # ── SUMMARY ──
    print(f"\n{'='*70}")
    print("  VALIDATION COMPLETE")
    print(f"{'='*70}")
    print("  If you see exceptions ranked with ✓ TRUE at the top and")
    print("  'clean' records at the bottom, the detection logic is working.")
    print("  Share this full output to review accuracy.\n")


if __name__ == "__main__":
    main()