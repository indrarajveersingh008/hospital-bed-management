from sqlalchemy import Column, BigInteger, String, JSON, ForeignKey, Index
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    hospital_id = Column(BigInteger, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True)
    
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(BigInteger, nullable=True)
    
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    hospital = relationship("Hospital", foreign_keys=[hospital_id])

    @property
    def user_email(self) -> str:
        return self.user.email if self.user else None

    @property
    def hospital_name(self) -> str:
        return self.hospital.name if self.hospital else None

    __table_args__ = (
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_hospital", "hospital_id"),
        Index("idx_audit_entity", "entity_type", "entity_id"),
        Index("idx_audit_created", "created_at"),
    )
