import enum
from sqlalchemy import Column, BigInteger, String, Enum, Numeric, Text, ForeignKey, Index
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class HospitalType(str, enum.Enum):
    GOVERNMENT = "GOVERNMENT"
    PRIVATE = "PRIVATE"
    TRUST = "TRUST"
    OTHER = "OTHER"


class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class HospitalStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    registration_number = Column(String(100), nullable=False, unique=True)
    hospital_type = Column(Enum(HospitalType), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    emergency_phone = Column(String(20), nullable=True)
    address = Column(String(500), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    pincode = Column(String(10), nullable=False)
    
    # Coordinates
    latitude = Column(Numeric(10, 8), nullable=True)
    longitude = Column(Numeric(11, 8), nullable=True)
    
    verification_status = Column(
        Enum(VerificationStatus),
        nullable=False,
        default=VerificationStatus.PENDING,
        server_default="PENDING"
    )
    
    status = Column(
        Enum(HospitalStatus),
        nullable=False,
        default=HospitalStatus.INACTIVE,
        server_default="INACTIVE"
    )
    
    # Verification details
    verified_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(TIMESTAMP, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )
    
    updated_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )

    # Relationships
    verifier = relationship("User", foreign_keys=[verified_by])


# Indexes as defined in Section 8.4
Index("idx_hospital_city", Hospital.city)
Index("idx_hospital_state", Hospital.state)
Index("idx_hospital_status", Hospital.status)
Index("idx_hospital_verification", Hospital.verification_status)
