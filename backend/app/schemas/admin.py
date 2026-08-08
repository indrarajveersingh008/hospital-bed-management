from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class AdminDashboardStats(BaseModel):
    total_hospitals: int
    verified_hospitals: int
    pending_hospitals: int
    total_beds: int
    occupied_beds: int
    available_beds: int


class HospitalRejectRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=2, max_length=500)


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    hospital_id: Optional[int] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

