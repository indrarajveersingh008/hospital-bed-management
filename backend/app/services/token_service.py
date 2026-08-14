import hashlib
import secrets
import os
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.tokens import EmailVerificationToken, PasswordResetToken
from app.core.security import get_password_hash


class TokenService:

    @classmethod
    def send_real_email(cls, to_email: str, subject: str, body: str) -> bool:
        """
        Sends a real email using SMTP if configured. Otherwise logs it.
        """
        smtp_host = os.getenv("SMTP_HOST").strip() if os.getenv("SMTP_HOST") else None
        smtp_port = os.getenv("SMTP_PORT").strip() if os.getenv("SMTP_PORT") else None
        smtp_username = os.getenv("SMTP_USERNAME").strip() if os.getenv("SMTP_USERNAME") else None
        smtp_password = os.getenv("SMTP_PASSWORD").strip().replace("\n", "").replace("\r", "") if os.getenv("SMTP_PASSWORD") else None
        smtp_from = os.getenv("SMTP_FROM").strip() if os.getenv("SMTP_FROM") else smtp_username
        if smtp_from:
            smtp_from = smtp_from.strip()

        if not all([smtp_host, smtp_port, smtp_username, smtp_password]):
            print(f"\n==================================================")
            print(f"[MOCK EMAIL] To: {to_email}")
            print(f"Subject: {subject}")
            print(f"Body:\n{body}")
            print(f"==================================================\n")
            return False

        try:
            msg = MIMEText(body)
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = to_email

            port = int(smtp_port)
            if port == 465:
                server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, port, timeout=10)
                server.starttls()

            server.login(smtp_username, smtp_password)
            server.sendmail(smtp_from, [to_email], msg.as_string())
            server.quit()
            print(f"Real verification email sent to {to_email} successfully!")
            return True
        except Exception as e:
            print(f"SMTP Error sending email to {to_email}: {e}")
            return False

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

    # In-memory store for registration email verification OTPs
    _active_otps = {}  # email -> {"code": str, "expires_at": datetime, "verified": bool}

    @classmethod
    def is_valid_email_domain(cls, email: str) -> bool:
        """
        Validates syntax and rejects known disposable/dummy email domains.
        """
        if not email or "@" not in email:
            return False
        
        domain = email.split("@")[-1].strip().lower()
        blocked_domains = {
            "mailinator.com", "yopmail.com", "tempmail.com", 
            "dummy.com", "10minutemail.com", "dispostable.com", 
            "guerrillamail.com", "sharklasers.com", "getairmail.com"
        }
        return domain not in blocked_domains

    @classmethod
    def generate_email_otp(cls, email: str) -> str:
        """
        Generates a 6-digit email verification OTP expiring in 10 minutes.
        """
        clean_email = email.strip().lower()
        if not cls.is_valid_email_domain(clean_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Disposable or invalid email domains are not allowed."
            )

        # Generate a 6-digit numeric OTP code
        otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        # Save to our active memory store
        cls._active_otps[clean_email] = {
            "code": otp_code,
            "expires_at": expires_at,
            "verified": False
        }

        # Send OTP code via email
        subject = "TrackBed Registration OTP Code"
        body = f"Hello,\n\nYour 6-digit email verification code is: {otp_code}\n\nThis OTP will expire in 10 minutes."
        email_sent = cls.send_real_email(clean_email, subject, body)

        if os.getenv("SMTP_HOST") and not email_sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Mail server failed to deliver the OTP. Please verify your SMTP configurations."
            )

        return otp_code

    @classmethod
    def verify_email_otp(cls, email: str, code: str) -> bool:
        """
        Verifies the 6-digit OTP code submitted for an email.
        """
        clean_email = email.strip().lower()
        otp_record = cls._active_otps.get(clean_email)

        if not otp_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verification OTP was requested for this email."
            )

        # Check expiration
        if datetime.now(timezone.utc) > otp_record["expires_at"]:
            # Clean up expired record
            cls._active_otps.pop(clean_email, None)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification OTP has expired. Please request a new one."
            )

        # Validate code
        if otp_record["code"] != code.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification OTP code."
            )

        # Mark as verified
        otp_record["verified"] = True
        return True

    @classmethod
    def check_and_consume_verified_email(cls, email: str) -> bool:
        """
        Confirms email was successfully verified via OTP, and consumes the state.
        """
        clean_email = email.strip().lower()
        otp_record = cls._active_otps.get(clean_email)

        if not otp_record or not otp_record["verified"]:
            return False

        # Consume the verified state (delete it to prevent re-use)
        cls._active_otps.pop(clean_email, None)
        return True

