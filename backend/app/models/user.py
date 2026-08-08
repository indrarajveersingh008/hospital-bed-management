import enum
from sqlalchemy import Column, BigInteger, String, Enum, Boolean, Index
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from app.models.base import Base


class UserRole(str, enum.Enum):
    USER = "USER"
    HOSPITAL_ADMIN = "HOSPITAL_ADMIN"
    ADMIN = "ADMIN"


class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING = "PENDING"


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    phone = Column(String(20), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    
    role = Column(
        Enum(UserRole),
        nullable=False,
        default=UserRole.USER,
        server_default="USER"
    )
    
    status = Column(
        Enum(UserStatus),
        nullable=False,
        default=UserStatus.ACTIVE,
        server_default="ACTIVE"
    )
    
    email_verified = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0"
    )
    
    mfa_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0"
    )
    
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


# Indexes as defined in Section 8.2 of database spec
Index("idx_users_role", User.role)
Index("idx_users_status", User.status)
