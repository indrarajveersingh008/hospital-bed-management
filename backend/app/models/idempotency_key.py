from sqlalchemy import Column, BigInteger, String, JSON, ForeignKey, Index
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    idempotency_key = Column(String(100), nullable=False, unique=True)
    hospital_id = Column(BigInteger, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    
    endpoint = Column(String(200), nullable=False)
    response_snapshot = Column(JSON, nullable=True)
    
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )

    # Relationships
    hospital = relationship("Hospital", foreign_keys=[hospital_id])

    __table_args__ = (
        Index("idx_idem_hospital", "hospital_id"),
    )
