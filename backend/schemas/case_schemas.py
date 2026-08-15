from datetime import datetime
from typing import Literal
from pydantic import BaseModel

CaseStatus = Literal["unreviewed", "confirmed", "false_positive", "needs_review"]


class CaseStatusUpdateRequest(BaseModel):
    status: CaseStatus
    reviewer: str
    note: str | None = None


class CaseStatusUpdateResponse(BaseModel):
    exception_id: int
    status: CaseStatus
    reviewer: str
    updated_at: datetime