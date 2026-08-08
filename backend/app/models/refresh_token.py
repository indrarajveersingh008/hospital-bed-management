from sqlalchemy import Column, BigInteger, String, ForeignKey, Index
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True)
    
    device_label = Column(String(200), nullable=True)
    ip_address = Column(String(45), nullable=True)
    
    expires_at = Column(TIMESTAMP, nullable=False)
    revoked_at = Column(TIMESTAMP, nullable=True)
    
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("idx_refresh_user", "user_id"),
    )
