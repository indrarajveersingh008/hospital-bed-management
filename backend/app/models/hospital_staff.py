import enum
from sqlalchemy import Column, BigInteger, String, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class StaffStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class HospitalStaff(Base):
    __tablename__ = "hospital_staff"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    hospital_id = Column(BigInteger, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    position = Column(String(100), nullable=True)
    
    status = Column(
        Enum(StaffStatus),
        nullable=False,
        default=StaffStatus.ACTIVE,
        server_default="ACTIVE"
    )
    
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    hospital = relationship("Hospital", foreign_keys=[hospital_id])

    __table_args__ = (
        UniqueConstraint("user_id", "hospital_id", name="uq_user_hospital"),
    )
