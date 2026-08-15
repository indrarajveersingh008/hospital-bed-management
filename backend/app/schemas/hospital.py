from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.hospital import HospitalType, VerificationStatus, HospitalStatus


class HospitalBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    registration_number: str = Field(..., min_length=2, max_length=100)
    hospital_type: HospitalType
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    emergency_phone: Optional[str] = Field(default=None, max_length=20)
    address: str = Field(..., min_length=5, max_length=500)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., min_length=4, max_length=10)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class HospitalCreate(HospitalBase):
    pass


class HospitalOut(HospitalBase):
    id: int
    verification_status: VerificationStatus
    status: HospitalStatus
    verified_by: Optional[int] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HospitalStaffCreate(BaseModel):
    email: str = Field(..., max_length=255)
    position: Optional[str] = Field(default=None, max_length=100)


class HospitalStaffOut(BaseModel):
    id: int
    user_id: int
    hospital_id: int
    position: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


from app.models.document import DocumentType, ScanStatus, DocumentVerificationStatus

class HospitalDocumentOut(BaseModel):
    id: int
    hospital_id: int
    document_type: DocumentType
    file_path: str
    checksum_sha256: Optional[str] = None
    scan_status: ScanStatus
    verification_status: DocumentVerificationStatus
    verified_by: Optional[int] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

