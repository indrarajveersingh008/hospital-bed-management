import enum
from sqlalchemy import Column, BigInteger, String, Enum, ForeignKey, Text
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class DocumentType(str, enum.Enum):
    REGISTRATION = "REGISTRATION"
    LICENSE = "LICENSE"
    AUTHORIZATION = "AUTHORIZATION"
    OTHER = "OTHER"


class ScanStatus(str, enum.Enum):
    PENDING = "PENDING"
    CLEAN = "CLEAN"
    INFECTED = "INFECTED"


class DocumentVerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class HospitalDocument(Base):
    __tablename__ = "hospital_documents"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    hospital_id = Column(BigInteger, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    
    document_type = Column(Enum(DocumentType), nullable=False)
    file_path = Column(String(500), nullable=False)
    checksum_sha256 = Column(String(64), nullable=True)  # Store 64-character SHA-256 hash
    
    scan_status = Column(
        Enum(ScanStatus),
        nullable=False,
        default=ScanStatus.PENDING,
        server_default="PENDING"
    )
    
    verification_status = Column(
        Enum(DocumentVerificationStatus),
        nullable=False,
        default=DocumentVerificationStatus.PENDING,
        server_default="PENDING"
    )
    
    verified_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(TIMESTAMP, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )

    # Relationships
    hospital = relationship("Hospital", foreign_keys=[hospital_id])
    verifier = relationship("User", foreign_keys=[verified_by])
