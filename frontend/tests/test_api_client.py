"""Tests against mocked HTTP responses — must run without a live backend."""

from unittest.mock import patch, MagicMock
import requests
from frontend import api_client


def _mock_response(json_data, status_code=200):
    mock = MagicMock()
    mock.status_code = status_code
    mock.json.return_value = json_data
    mock.text = str(json_data)
    if status_code >= 400:
        mock.raise_for_status.side_effect = requests.exceptions.HTTPError(f"{status_code} error")
    else:
        mock.raise_for_status.return_value = None
    return mock


@patch("frontend.api_client.requests.get")
def test_health_check_success(mock_get):
    mock_get.return_value = _mock_response({"status": "ok", "env": "development"})
    assert api_client.health_check()["status"] == "ok"


@patch("frontend.api_client.requests.get")
def test_health_check_connection_error(mock_get):
    mock_get.side_effect = requests.exceptions.ConnectionError("refused")
    assert "error" in api_client.health_check()


@patch("frontend.api_client.requests.get")
def test_list_curated_companies(mock_get):
    mock_get.return_value = _mock_response({"companies": [{"ticker": "AAPL", "company_name": "Apple Inc.",
                                                             "is_aaer_fraud_case": False, "sector": "Technology"}]})
    assert api_client.list_curated_companies()["companies"][0]["ticker"] == "AAPL"


@patch("frontend.api_client.requests.post")
def test_run_detection_builds_correct_payload(mock_post):
    mock_post.return_value = _mock_response({"run_id": 1, "total_exceptions": 0, "total_records_scanned": 100, "exceptions": []})
    api_client.run_detection("ledger", "abc-123", {"benford_sensitivity": 0.7})
    sent = mock_post.call_args.kwargs["json"]
    assert sent["domain"] == "ledger" and sent["dataset_id"] == "abc-123"
    assert sent["thresholds"]["benford_sensitivity"] == 0.7


@patch("frontend.api_client.requests.patch")
def test_update_case_status(mock_patch):
    mock_patch.return_value = _mock_response({"exception_id": 5, "status": "confirmed", "reviewer": "alice", "updated_at": "2026-08-19T00:00:00Z"})
    assert api_client.update_case_status(5, "confirmed", "alice")["status"] == "confirmed"


@patch("frontend.api_client.requests.get")
def test_list_exceptions_error_response_returns_error_dict(mock_get):
    mock_get.return_value = _mock_response({"detail": "domain must be ledger or financial_statement"}, status_code=400)
    assert "error" in api_client.list_exceptions(domain="not_a_real_domain")