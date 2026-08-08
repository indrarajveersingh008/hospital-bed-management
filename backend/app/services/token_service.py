import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.tokens import EmailVerificationToken, PasswordResetToken
from app.core.security import get_password_hash


class TokenService:

    @staticmethod
    def _hash_token(token: str) -> str:
        """
        Hash the token using SHA-256 before database storage.
        """
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @classmethod
    def generate_email_verification(cls, db: Session, user_id: int) -> str:
        """
        Generate an email verification token expiring in 24 hours.
        """
        raw_token = secrets.token_urlsafe(32)
        token_hash = cls._hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        db_token = EmailVerificationToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at
        )
        db.add(db_token)
        db.commit()
        return raw_token

    @classmethod
    def verify_email_token(cls, db: Session, raw_token: str) -> None:
        """
        Verify the email token. If valid, set user.email_verified = True.
        """
        token_hash = cls._hash_token(raw_token)
        now = datetime.now(timezone.utc)

        db_token = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.token_hash == token_hash,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.expires_at > now
        ).first()

        if not db_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid, expired, or already used verification token."
            )

        # Mark token as used
        db_token.used_at = now
        db.add(db_token)

        # Update user
        user = db.query(User).filter(User.id == db_token.user_id).first()
        if user:
            user.email_verified = True
            db.add(user)
            
        db.commit()

    @classmethod
    def generate_password_reset(cls, db: Session, email: str) -> Optional[str]:
        """
        Generate a password reset token expiring in 2 hours for the specified user email.
        """
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None

        # Invalidate existing unused tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None)
        ).update({PasswordResetToken.used_at: datetime.now(timezone.utc)}, synchronize_session=False)

        raw_token = secrets.token_urlsafe(32)
        token_hash = cls._hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=2)

        db_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at
        )
        db.add(db_token)
        db.commit()
        return raw_token

    @classmethod
    def reset_password(cls, db: Session, raw_token: str, new_password: str) -> None:
        """
        Verify password reset token, and update user password credentials.
        """
        token_hash = cls._hash_token(raw_token)
        now = datetime.now(timezone.utc)

        db_token = db.query(PasswordResetToken).filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now
        ).first()

        if not db_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid, expired, or already used reset token."
            )

        # Update password
        user = db.query(User).filter(User.id == db_token.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found."
            )

        user.password_hash = get_password_hash(new_password)
        db_token.used_at = now

        db.add(user)
        db.add(db_token)
        db.commit()
