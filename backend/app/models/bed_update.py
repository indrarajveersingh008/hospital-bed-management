import enum
from sqlalchemy import Column, BigInteger, Integer, ForeignKey, Enum, Index
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class UpdateSource(str, enum.Enum):
    HOSPITAL_DASHBOARD = "HOSPITAL_DASHBOARD"
    HOSPITAL_API = "HOSPITAL_API"
    ADMIN = "ADMIN"
    SYSTEM = "SYSTEM"


class BedUpdate(Base):
    __tablename__ = "bed_updates"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    inventory_id = Column(BigInteger, ForeignKey("bed_inventory.id", ondelete="CASCADE"), nullable=False)
    hospital_id = Column(BigInteger, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    updated_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    old_total = Column(Integer, nullable=False)
    old_occupied = Column(Integer, nullable=False)
    old_available = Column(Integer, nullable=False)
    
    new_total = Column(Integer, nullable=False)
    new_occupied = Column(Integer, nullable=False)
    new_available = Column(Integer, nullable=False)
    
    update_source = Column(
        Enum(UpdateSource),
        nullable=False,
        default=UpdateSource.HOSPITAL_DASHBOARD,
        server_default="HOSPITAL_DASHBOARD"
    )
    
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )

    # Relationships
    inventory = relationship("BedInventory", foreign_keys=[inventory_id])
    hospital = relationship("Hospital", foreign_keys=[hospital_id])
    updater = relationship("User", foreign_keys=[updated_by])

    __table_args__ = (
        Index("idx_updates_inventory", "inventory_id"),
        Index("idx_updates_hospital", "hospital_id"),
        Index("idx_updates_created", "created_at"),
    )
