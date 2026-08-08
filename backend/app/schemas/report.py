from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.report import ReportReason, ReportStatus


class ReportCreate(BaseModel):
    hospital_id: int
    inventory_id: Optional[int] = None
    reason: ReportReason
    description: Optional[str] = Field(default=None, max_length=1000)


class ReportOut(BaseModel):
    id: int
    user_id: int
    hospital_id: int
    inventory_id: Optional[int] = None
    reason: ReportReason
    description: Optional[str] = None
    status: ReportStatus
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    # UI Meta representation attributes
    hospital_name: Optional[str] = None
    hospital_location: Optional[str] = None
    reporter_email: Optional[str] = None

    class Config:
        from_attributes = True
