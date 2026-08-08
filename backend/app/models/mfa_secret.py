from sqlalchemy import Column, BigInteger, LargeBinary, JSON, ForeignKey
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class MfaSecret(Base):
    __tablename__ = "mfa_secrets"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # LargeBinary(255) maps to VARBINARY(255) in MySQL
    secret_encrypted = Column(LargeBinary(255), nullable=False)
    recovery_codes_hash = Column(JSON, nullable=False)
    
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
