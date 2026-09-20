# backend/api/routes_audit.py
"""Audit log query endpoints — provides immutable visibility into all detection runs,
parameters used, timestamps, and reviewer identities."""

from datetime import datetime, time, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from data_infra.db.connection import get_db_session
from data_infra.db import models
from backend.schemas.audit_schemas import AuditLogEntry, AuditLogResponse

router = APIRouter()


@router.get("/logs", response_model=AuditLogResponse)
def get_audit_logs(
    start_date: str | None = Query(None, description="YYYY-MM-DD start filter"),
    end_date: str | None = Query(None, description="YYYY-MM-DD end filter"),
    module: str | None = Query(None, description="Filter by module run"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db_session),
):
    query = db.query(models.AuditLog)

    if start_date:
        try:
            start_dt = datetime.combine(datetime.strptime(start_date, "%Y-%m-%d").date(), time.min).replace(tzinfo=timezone.utc)
            query = query.filter(models.AuditLog.run_timestamp >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid start_date format: '{start_date}'. Expected YYYY-MM-DD.")

    if end_date:
        try:
            end_dt = datetime.combine(datetime.strptime(end_date, "%Y-%m-%d").date(), time.max).replace(tzinfo=timezone.utc)
            query = query.filter(models.AuditLog.run_timestamp <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid end_date format: '{end_date}'. Expected YYYY-MM-DD.")

    if module:
        rows = query.order_by(models.AuditLog.run_timestamp.desc()).all()
        entries = []
        for r in rows:
            modules = r.modules_run if isinstance(r.modules_run, list) else []
            if module in modules:
                entries.append(
                    AuditLogEntry(
                        id=r.id,
                        run_timestamp=r.run_timestamp,
                        dataset_used=r.dataset_used,
                        modules_run=modules,
                        parameters=r.parameters or {},
                        run_by=r.run_by,
                    )
                )
        total = len(entries)
        entries = entries[offset : offset + limit]
    else:
        total = query.count()
        rows = query.order_by(models.AuditLog.run_timestamp.desc()).offset(offset).limit(limit).all()
        entries = [
            AuditLogEntry(
                id=r.id,
                run_timestamp=r.run_timestamp,
                dataset_used=r.dataset_used,
                modules_run=r.modules_run if isinstance(r.modules_run, list) else [],
                parameters=r.parameters or {},
                run_by=r.run_by,
            ) for r in rows
        ]

    return AuditLogResponse(entries=entries, total=total)