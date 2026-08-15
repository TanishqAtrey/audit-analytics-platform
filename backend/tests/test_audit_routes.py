# backend/tests/test_audit_routes.py
from datetime import datetime
from backend.schemas.audit_schemas import AuditLogEntry, AuditLogResponse


def test_audit_log_schema():
    entry = AuditLogEntry(
        id=1,
        run_timestamp=datetime.now(),
        dataset_used="test_dataset_uuid",
        modules_run=["benford_ensemble", "duplicate_detection"],
        parameters={"benford_sensitivity": 0.5},
        run_by="auditor_1",
    )
    resp = AuditLogResponse(entries=[entry], total=1)
    assert resp.total == 1
    assert resp.entries[0].run_by == "auditor_1"