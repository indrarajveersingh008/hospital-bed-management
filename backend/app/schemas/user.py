from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr
from app.models.user import UserRole, UserStatus


class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)


class UserOut(UserBase):
    id: int
    role: UserRole
    status: UserStatus
    email_verified: bool
    mfa_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
