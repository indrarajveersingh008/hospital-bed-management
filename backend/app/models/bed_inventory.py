from sqlalchemy import Column, BigInteger, Integer, ForeignKey, UniqueConstraint, Index
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class BedInventory(Base):
    __tablename__ = "bed_inventory"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    hospital_id = Column(BigInteger, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    bed_type_id = Column(Integer, ForeignKey("bed_types.id", ondelete="RESTRICT"), nullable=False)
    
    total_beds = Column(Integer, nullable=False, default=0, server_default="0")
    occupied_beds = Column(Integer, nullable=False, default=0, server_default="0")
    available_beds = Column(Integer, nullable=False, default=0, server_default="0")
    
    last_updated = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )
    
    updated_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    hospital = relationship("Hospital", foreign_keys=[hospital_id])
    bed_type = relationship("BedType", foreign_keys=[bed_type_id])
    updater = relationship("User", foreign_keys=[updated_by])

    __table_args__ = (
        UniqueConstraint("hospital_id", "bed_type_id", name="uq_hospital_bed_type"),
        Index("idx_inventory_hospital", "hospital_id"),
        Index("idx_inventory_bed_type", "bed_type_id"),
        Index("idx_inventory_available", "available_beds"),
    )
