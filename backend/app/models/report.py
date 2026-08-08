import enum
from sqlalchemy import Column, BigInteger, Enum, Text, ForeignKey
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class ReportReason(str, enum.Enum):
    INCORRECT_AVAILABILITY = "INCORRECT_AVAILABILITY"
    HOSPITAL_NOT_FOUND = "HOSPITAL_NOT_FOUND"
    WRONG_CONTACT = "WRONG_CONTACT"
    OTHER = "OTHER"


class ReportStatus(str, enum.Enum):
    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"


class Report(Base):
    __tablename__ = "reports"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    hospital_id = Column(BigInteger, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    inventory_id = Column(BigInteger, ForeignKey("bed_inventory.id", ondelete="SET NULL"), nullable=True)
    
    reason = Column(Enum(ReportReason), nullable=False)
    description = Column(Text, nullable=True)
    
    status = Column(
        Enum(ReportStatus),
        nullable=False,
        default=ReportStatus.OPEN,
        server_default="OPEN"
    )
    
    reviewed_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(TIMESTAMP, nullable=True)
    
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    hospital = relationship("Hospital", foreign_keys=[hospital_id])
    inventory = relationship("BedInventory", foreign_keys=[inventory_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])

    @property
    def hospital_name(self) -> str:
        return self.hospital.name if self.hospital else None

    @property
    def hospital_location(self) -> str:
        return f"{self.hospital.city}, {self.hospital.state}" if self.hospital else None

    @property
    def reporter_email(self) -> str:
        return self.user.email if self.user else None
