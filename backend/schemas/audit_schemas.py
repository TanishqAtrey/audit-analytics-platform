from datetime import date, datetime
from pydantic import BaseModel


class AuditLogEntry(BaseModel):
    id: int
    run_timestamp: datetime
    dataset_used: str
    modules_run: list[str]
    parameters: dict
    run_by: str


class AuditLogQuery(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    module: str | None = None
    limit: int = 200


class AuditLogResponse(BaseModel):
    entries: list[AuditLogEntry]
    total: int