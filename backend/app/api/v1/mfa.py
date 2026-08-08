import base64
import hashlib
from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.config import settings
from app.core.totp import TOTP
from app.core.security import get_password_hash
from app.api import deps
from app.models.user import User
from app.models.mfa_secret import MfaSecret
from app.models.audit_log import AuditLog

router = APIRouter()


# Schemas
class MfaEnrollOut(BaseModel):
    secret: str
    provisioning_uri: str
    recovery_codes: List[str]


class MfaCodeRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


# Cryptography helpers
def _get_fernet() -> Fernet:
    key = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_secret(secret: str) -> bytes:
    return _get_fernet().encrypt(secret.encode())


def decrypt_secret(secret_encrypted: bytes) -> str:
    return _get_fernet().decrypt(secret_encrypted).decode()


@router.post("/enroll", response_model=MfaEnrollOut)
def enroll_mfa(
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 1: Enrolls user in MFA by generating a Base32 secret key,
    provisioning URI, and recovery codes. The secret is saved in database encrypted.
    """
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled on your account."
        )

    # Clean existing secret if any (re-enrollment fallback)
    db.query(MfaSecret).filter(MfaSecret.user_id == current_user.id).delete()

    secret_key = TOTP.generate_secret()
    uri = TOTP.generate_provisioning_uri(secret_key, current_user.email)

    # Generate 5 recovery codes
    recovery_codes = [TOTP.generate_secret()[:8] for _ in range(5)]
    recovery_hashes = [get_password_hash(code) for code in recovery_codes]

    # Save encrypted secret
    mfa_record = MfaSecret(
        user_id=current_user.id,
        secret_encrypted=encrypt_secret(secret_key),
        recovery_codes_hash=recovery_hashes
    )
    db.add(mfa_record)

    # Log audit entry
    audit = AuditLog(
        user_id=current_user.id,
        action="ENROLL_MFA_REQUEST",
        entity_type="users",
        entity_id=current_user.id
    )
    db.add(audit)

    db.commit()

    return MfaEnrollOut(
        secret=secret_key,
        provisioning_uri=uri,
        recovery_codes=recovery_codes
    )


@router.post("/verify")
def verify_mfa(
    verify_in: MfaCodeRequest,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 2: Verifies a 6-digit TOTP verification code to enable MFA on user profile.
    """
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled on your account."
        )

    mfa_record = db.query(MfaSecret).filter(MfaSecret.user_id == current_user.id).first()
    if not mfa_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MFA enrollment record not found. Please enroll first."
        )

    # Decrypt secret and verify
    secret_key = decrypt_secret(mfa_record.secret_encrypted)
    is_valid = TOTP.verify_totp(secret_key, verify_in.code)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA verification code."
        )

    # Enable MFA
    current_user.mfa_enabled = True
    db.add(current_user)

    # Log audit entry
    audit = AuditLog(
        user_id=current_user.id,
        action="ENABLE_MFA",
        entity_type="users",
        entity_id=current_user.id
    )
    db.add(audit)

    db.commit()

    # Notify user via email
    if current_user.email:
        from app.services.notification_service import NotificationService
        NotificationService.notify_mfa_update(current_user.email, current_user.name, "activated")

    return {"success": True, "message": "Multi-Factor Authentication enabled successfully."}


@router.post("/disable")
def disable_mfa(
    verify_in: MfaCodeRequest,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disables MFA on user account by verifying active code and cleaning MfaSecret record.
    """
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled on your account."
        )

    mfa_record = db.query(MfaSecret).filter(MfaSecret.user_id == current_user.id).first()
    if not mfa_record:
        # Fallback if database is out of sync
        current_user.mfa_enabled = False
        db.add(current_user)
        db.commit()
        return {"success": True, "message": "MFA state cleaned."}

    secret_key = decrypt_secret(mfa_record.secret_encrypted)
    is_valid = TOTP.verify_totp(secret_key, verify_in.code)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA verification code."
        )

    # Disable MFA
    current_user.mfa_enabled = False
    db.add(current_user)
    db.delete(mfa_record)

    # Log audit entry
    audit = AuditLog(
        user_id=current_user.id,
        action="DISABLE_MFA",
        entity_type="users",
        entity_id=current_user.id
    )
    db.add(audit)

    db.commit()

    # Notify user via email
    if current_user.email:
        from app.services.notification_service import NotificationService
        NotificationService.notify_mfa_update(current_user.email, current_user.name, "deactivated")

    return {"success": True, "message": "Multi-Factor Authentication disabled successfully."}
