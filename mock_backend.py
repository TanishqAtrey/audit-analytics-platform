"""
Mock backend — returns realistic dummy data for every frontend endpoint.
Run this instead of the real backend to preview the UI.

Usage:
    uvicorn mock_backend:app --port 8000
"""

from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Mock Audit Analytics API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Dummy data ──

MOCK_REASON_CODES = [
    {"test_name": "benford_ensemble", "contribution_score": 0.82,
     "explanation": "Benford's Law: very high deviation for vendor 'Shady Consulting LLC' (n=50) — chi-square p < 0.001, MAD = 0.018 (nonconformity)."},
    {"test_name": "duplicate_detection", "contribution_score": 0.91,
     "explanation": "Near-duplicate invoice: very high similarity (93.4/100) to record TXN-0346 on vendor 'Shady Consulting LLC', matched on: vendor, amount, invoice_number."},
    {"test_name": "three_way_match", "contribution_score": 0.65,
     "explanation": "Three-way match violation: invoice amount $12,450.00 exceeds PO amount $8,300.00 by 50.0% (tolerance: 2%)."},
    {"test_name": "ledger_transaction_anomaly", "contribution_score": 0.47,
     "explanation": "Isolation Forest + LOF outlier: transaction amount and frequency are statistical outliers within vendor group."},
]

MOCK_FS_REASON_CODES = [
    {"test_name": "beneish_m_score", "contribution_score": 0.88,
     "explanation": "Beneish M-Score: very high earnings-manipulation risk M-Score=0.25; largest contributor: DSRI (Days Sales in Receivables Index) = 3.50."},
    {"test_name": "altman_z_score", "contribution_score": 0.75,
     "explanation": "Altman Z-Score: very high distress/bankruptcy risk, Z=1.72 (distress zone)."},
    {"test_name": "ratio_anomaly", "contribution_score": 0.62,
     "explanation": "Ratio anomaly (Isolation Forest + LOF): very high outlier across current_ratio, debt_to_equity, gross_margin."},
]

NOW = datetime.utcnow()

def _make_ledger_exceptions():
    names = ["TXN-0306", "TXN-0346", "TXN-0321", "TXN-0334", "TXN-0311",
             "TXN-0315", "TXN-0326", "TXN-0337", "TXN-0339", "TXN-0349",
             "TXN-0390", "TXN-0391", "TXN-0128", "TXN-0055", "TXN-0412"]
    scores = [0.698, 0.698, 0.611, 0.611, 0.598, 0.598, 0.598, 0.598, 0.520, 0.510,
              0.480, 0.450, 0.390, 0.320, 0.280]
    statuses = ["unreviewed"] * 10 + ["confirmed", "false_positive", "needs_review", "unreviewed", "unreviewed"]
    return [
        {"id": i + 1, "domain": "ledger", "source_record_id": names[i],
         "ensemble_score": scores[i], "individual_scores": {"benford_ensemble": scores[i] * 0.9, "duplicate_detection": scores[i] * 0.8},
         "status": statuses[i], "reason_codes": MOCK_REASON_CODES[:2 + (i % 3)],
         "created_at": (NOW - timedelta(hours=i)).isoformat()}
        for i in range(len(names))
    ]

def _make_fs_exceptions():
    names = ["TYCO_2024", "ENRN_2024", "WRLD_2024", "FAIL_2025", "FAIL_2024",
             "BKRP_2023", "BKRP_2024", "FAIL_2023", "BKRP_2025", "TYCO_2025"]
    scores = [0.763, 0.755, 0.725, 0.617, 0.609, 0.606, 0.599, 0.593, 0.569, 0.493]
    return [
        {"id": 100 + i, "domain": "financial_statement", "source_record_id": names[i],
         "ensemble_score": scores[i], "individual_scores": {"beneish_m_score": scores[i] * 0.95, "altman_z_score": scores[i] * 0.85},
         "status": "unreviewed", "reason_codes": MOCK_FS_REASON_CODES[:2 + (i % 2)],
         "created_at": (NOW - timedelta(hours=i * 2)).isoformat()}
        for i in range(len(names))
    ]

LEDGER_EXCEPTIONS = _make_ledger_exceptions()
FS_EXCEPTIONS = _make_fs_exceptions()


# ── Routes ──

@app.get("/health")
def health():
    return {"status": "ok", "env": "mock-preview"}


@app.post("/api/ingest/ledger/upload")
async def upload_ledger():
    return {
        "dataset_id": "mock-ledger-001",
        "rows_ingested": 5000,
        "vendors_detected": 15,
        "date_range": ["2025-01-01", "2025-12-31"],
        "warnings": [],
    }


@app.get("/api/ingest/companies")
def list_companies():
    return {"companies": [
        {"ticker": "AAPL", "company_name": "Apple Inc.", "sector": "Technology", "is_aaer_fraud_case": False},
        {"ticker": "MSFT", "company_name": "Microsoft Corporation", "sector": "Technology", "is_aaer_fraud_case": False},
        {"ticker": "JNJ", "company_name": "Johnson & Johnson", "sector": "Healthcare", "is_aaer_fraud_case": False},
        {"ticker": "GE", "company_name": "General Electric Company", "sector": "Industrials", "is_aaer_fraud_case": True},
        {"ticker": "KHC", "company_name": "The Kraft Heinz Company", "sector": "Consumer Staples", "is_aaer_fraud_case": True},
        {"ticker": "UAA", "company_name": "Under Armour, Inc.", "sector": "Consumer Discretionary", "is_aaer_fraud_case": True},
        {"ticker": "PG", "company_name": "Procter & Gamble Co.", "sector": "Consumer Staples", "is_aaer_fraud_case": False},
        {"ticker": "KO", "company_name": "The Coca-Cola Company", "sector": "Consumer Staples", "is_aaer_fraud_case": False},
        {"ticker": "V", "company_name": "Visa Inc.", "sector": "Financials", "is_aaer_fraud_case": False},
        {"ticker": "HD", "company_name": "The Home Depot, Inc.", "sector": "Consumer Discretionary", "is_aaer_fraud_case": False},
    ]}


@app.post("/api/ingest/financial-statements/select")
def select_fs():
    return {
        "dataset_id": "mock-fs-001",
        "rows_loaded": 48,
        "tickers_loaded": ["AAPL", "MSFT", "GE", "KHC"],
        "tickers_missing": [],
    }


@app.post("/api/detect/run")
def run_detection(body: dict):
    domain = body.get("domain", "ledger")
    if domain == "ledger":
        excs = LEDGER_EXCEPTIONS
    else:
        excs = FS_EXCEPTIONS
    return {
        "run_id": 42,
        "domain": domain,
        "dataset_id": body.get("dataset_id", "mock"),
        "total_records_scanned": 5000 if domain == "ledger" else 51,
        "total_exceptions": len(excs),
        "exceptions": excs,
    }


@app.get("/api/detect/exceptions")
def list_exceptions(domain: str = None, status: str = None, min_score: float = None,
                    limit: int = 100, offset: int = 0):
    if domain == "financial_statement":
        excs = FS_EXCEPTIONS
    else:
        excs = LEDGER_EXCEPTIONS
    if status:
        excs = [e for e in excs if e["status"] == status]
    if min_score is not None:
        excs = [e for e in excs if e["ensemble_score"] >= min_score]
    return excs[offset:offset + limit]


@app.patch("/api/cases/{exception_id}/status")
def update_case(exception_id: int, body: dict):
    return {
        "exception_id": exception_id,
        "status": body.get("status", "confirmed"),
        "reviewer": body.get("reviewer", "demo_user"),
        "updated_at": NOW.isoformat(),
    }


@app.get("/api/audit/logs")
def audit_logs(start_date: str = None, end_date: str = None, module: str = None, limit: int = 200):
    entries = [
        {"id": 1, "run_timestamp": (NOW - timedelta(hours=1)).isoformat(), "dataset_used": "mock-ledger-001",
         "modules_run": ["benford_ensemble", "duplicate_detection", "three_way_match", "ledger_transaction_anomaly"],
         "parameters": {"benford_sensitivity": 0.5, "duplicate_similarity_threshold": 85.0}, "run_by": "demo_user"},
        {"id": 2, "run_timestamp": (NOW - timedelta(hours=3)).isoformat(), "dataset_used": "mock-fs-001",
         "modules_run": ["beneish_m_score", "altman_z_score", "ratio_anomaly"],
         "parameters": {"isolation_forest_contamination": 0.05, "lof_contamination": 0.05}, "run_by": "alice"},
        {"id": 3, "run_timestamp": (NOW - timedelta(days=1)).isoformat(), "dataset_used": "mock-ledger-001",
         "modules_run": ["benford_ensemble", "duplicate_detection"],
         "parameters": {"benford_sensitivity": 0.7}, "run_by": "threshold_explorer"},
    ]
    if module:
        entries = [e for e in entries if module in e["modules_run"]]
    return {"entries": entries[:limit], "total": len(entries)}


@app.get("/api/benchmark/{domain}")
def get_benchmark(domain: str):
    if domain == "ledger":
        return {
            "domain": "ledger", "baseline_test": "benford_ensemble",
            "baseline": {"precision": 0.42, "recall": 0.65, "f1": 0.51},
            "ensemble": {"precision": 0.97, "recall": 0.56, "f1": 0.71},
            "computed_at": NOW.isoformat(),
        }
    return {
        "domain": "financial_statement", "baseline_test": "beneish_m_score",
        "baseline": {"precision": 0.55, "recall": 0.60, "f1": 0.57},
        "ensemble": {"precision": 1.00, "recall": 0.75, "f1": 0.86},
        "computed_at": NOW.isoformat(),
    }


@app.post("/api/benchmark/{domain}/run")
def run_benchmark(domain: str):
    return get_benchmark(domain)