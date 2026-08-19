"""
The single seam to the backend — every HTTP call to FastAPI lives here and
nowhere else. Every function returns a plain dict (or list of dicts)
matching backend/schemas/*.py; on any failure it returns {"error": "..."}
instead of raising, so every page shows a friendly st.error() instead of
crashing the whole app on a backend hiccup.
"""

import os
import requests

BACKEND_URL = os.environ.get("BACKEND_API_URL", "http://localhost:8000")
API_PREFIX = f"{BACKEND_URL}/api"
TIMEOUT_SECONDS = 30


def _handle_response(resp: requests.Response):
    try:
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.HTTPError:
        try:
            detail = resp.json().get("detail", resp.text)
        except ValueError:
            detail = resp.text
        return {"error": f"{resp.status_code}: {detail}"}


def _get(path, params=None):
    try:
        resp = requests.get(f"{API_PREFIX}{path}", params=params, timeout=TIMEOUT_SECONDS)
    except requests.exceptions.RequestException as exc:
        return {"error": f"Could not reach backend at {BACKEND_URL}: {exc}"}
    return _handle_response(resp)


def _post(path, json_body=None, params=None, files=None):
    try:
        resp = requests.post(f"{API_PREFIX}{path}", json=json_body, params=params, files=files, timeout=TIMEOUT_SECONDS)
    except requests.exceptions.RequestException as exc:
        return {"error": f"Could not reach backend at {BACKEND_URL}: {exc}"}
    return _handle_response(resp)


def _patch(path, json_body=None):
    try:
        resp = requests.patch(f"{API_PREFIX}{path}", json=json_body, timeout=TIMEOUT_SECONDS)
    except requests.exceptions.RequestException as exc:
        return {"error": f"Could not reach backend at {BACKEND_URL}: {exc}"}
    return _handle_response(resp)


# ---- health ----
def health_check() -> dict:
    try:
        return _handle_response(requests.get(f"{BACKEND_URL}/health", timeout=5))
    except requests.exceptions.RequestException as exc:
        return {"error": str(exc)}


# ---- ingest ----
def upload_ledger_csv(file_bytes: bytes, filename: str) -> dict:
    return _post("/ingest/ledger/upload", files={"file": (filename, file_bytes, "text/csv")})


def list_curated_companies() -> dict:
    return _get("/ingest/companies")


def select_financial_statements(tickers: list[str], fiscal_years: list[int] | None = None) -> dict:
    return _post("/ingest/financial-statements/select",
                 json_body={"tickers": tickers, "fiscal_years": fiscal_years})


# ---- detect ----
def run_detection(domain: str, dataset_id: str, thresholds: dict,
                   tests: list[str] | None = None, run_by: str = "demo_user") -> dict:
    return _post("/detect/run", json_body={
        "domain": domain, "dataset_id": dataset_id, "tests": tests,
        "thresholds": thresholds, "run_by": run_by,
    })


def list_exceptions(domain: str | None = None, status: str | None = None,
                     min_score: float | None = None, limit: int = 100, offset: int = 0):
    params = {"limit": limit, "offset": offset}
    if domain: params["domain"] = domain
    if status: params["status"] = status
    if min_score is not None: params["min_score"] = min_score
    return _get("/detect/exceptions", params=params)


# ---- cases ----
def update_case_status(exception_id: int, status: str, reviewer: str, note: str | None = None) -> dict:
    return _patch(f"/cases/{exception_id}/status", json_body={"status": status, "reviewer": reviewer, "note": note})


# ---- audit ----
def get_audit_log(start_date=None, end_date=None, module=None, limit: int = 200) -> dict:
    params = {"limit": limit}
    if start_date: params["start_date"] = start_date
    if end_date: params["end_date"] = end_date
    if module: params["module"] = module
    return _get("/audit/logs", params=params)


# ---- benchmark ----
def get_benchmark(domain: str) -> dict:
    return _get(f"/benchmark/{domain}")


def run_benchmark(domain: str, dataset_id: str) -> dict:
    return _post(f"/benchmark/{domain}/run", params={"dataset_id": dataset_id})