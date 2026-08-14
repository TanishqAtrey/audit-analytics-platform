# backend/api/routes_cases.py
"""Case-management status updates — the one write endpoint reviewers hit
directly from the UI's status buttons."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from data_infra.db.connection import get_db_session
from data_infra.db import models
from backend.schemas.case_schemas import CaseStatusUpdateRequest, CaseStatusUpdateResponse

router = APIRouter()


@router.patch("/{exception_id}/status", response_model=CaseStatusUpdateResponse)
def update_case_status(exception_id: int, request: CaseStatusUpdateRequest, db: Session = Depends(get_db_session)):
    exc_row = db.query(models.Exception).filter(models.Exception.id == exception_id).first()
    if exc_row is None:
        raise HTTPException(status_code=404, detail=f"Exception {exception_id} not found.")

    exc_row.status = request.status
    exc_row.reviewer = request.reviewer
    exc_row.updated_at = datetime.now(timezone.utc)
    if request.note:
        exc_row.reviewer_note = request.note

    db.commit()
    db.refresh(exc_row)

    return CaseStatusUpdateResponse(
        exception_id=exc_row.id,
        status=exc_row.status,
        reviewer=exc_row.reviewer,
        updated_at=exc_row.updated_at,
    )