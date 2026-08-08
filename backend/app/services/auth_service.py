import hashlib
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, UserRole, UserStatus
from app.models.refresh_token import RefreshToken
from app.schemas.user import UserCreate
from app.schemas.auth import TokenSchema, SessionOut
from app.core import security


class AuthService:
    
    @staticmethod
    def hash_refresh_token(token: str) -> str:
        """
        Hash a refresh token using SHA-256 before storing it in the database
        to prevent database leak access attacks.
        """
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @classmethod
    def register_user(cls, db: Session, user_in: UserCreate) -> User:
        """
        Register a new user account.
        """
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == user_in.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists."
            )
        
        # Check if phone number already exists if provided
        if user_in.phone:
            existing_phone = db.query(User).filter(User.phone == user_in.phone).first()
            if existing_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A user with this phone number already exists."
                )

        hashed_password = security.get_password_hash(user_in.password)
        db_user = User(
            name=user_in.name,
            email=user_in.email,
            phone=user_in.phone,
            password_hash=hashed_password,
            role=UserRole.USER,
            status=UserStatus.ACTIVE,  # Set Active by default for simplicity in MVP
            email_verified=False,
            mfa_enabled=False
        )
        
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @classmethod
    def authenticate_user(cls, db: Session, email: str, password: str) -> User:
        """
        Authenticate user credentials.
        """
        user = db.query(User).filter(User.email == email).first()
        if not user or not security.verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if user.status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User account is {user.status.value.lower()}.",
            )
            
        return user

    @classmethod
    def create_user_session(
        cls, db: Session, user: User, ip_address: Optional[str] = None, device_label: Optional[str] = None
    ) -> TokenSchema:
        """
        Generate access and refresh tokens, hashing and storing the refresh token.
        """
        # Create tokens
        access_token = security.create_access_token(subject=user.id)
        refresh_token = security.create_refresh_token(subject=user.id)
        
        # Hash and store refresh token in db
        token_hash = cls.hash_refresh_token(refresh_token)
        expires_at = datetime.now(timezone.utc) + timedelta(days=security.REFRESH_TOKEN_EXPIRE_DAYS)
        
        db_refresh_token = RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            device_label=device_label,
            ip_address=ip_address,
            expires_at=expires_at,
            revoked_at=None
        )
        
        db.add(db_refresh_token)
        db.commit()
        
        return TokenSchema(
            access_token=access_token,
            refresh_token=refresh_token
        )

    @classmethod
    def refresh_access_token(
        cls, db: Session, refresh_token: str, ip_address: Optional[str] = None
    ) -> str:
        """
        Validate refresh token, check database, and issue a new access token.
        """
        try:
            payload = security.decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type."
                )
            user_id = int(payload.get("sub"))
        except security.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token."
            )
            
        # Hash token and look up in database
        token_hash = cls.hash_refresh_token(refresh_token)
        db_token = db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id
        ).first()
        
        if not db_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token session not found."
            )
            
        if db_token.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been revoked."
            )
            
        # Verify expiration
        # Ensure dates are timezone-aware for comparison
        expires_at = db_token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
            
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token session expired."
            )
            
        # Update connection info
        if ip_address:
            db_token.ip_address = ip_address
            db.commit()
            
        # Issue new access token
        return security.create_access_token(subject=user_id)

    @classmethod
    def revoke_session(cls, db: Session, refresh_token: str) -> None:
        """
        Revoke a specific refresh token session (logout).
        """
        token_hash = cls.hash_refresh_token(refresh_token)
        db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
        if db_token and db_token.revoked_at is None:
            db_token.revoked_at = datetime.now(timezone.utc)
            db.commit()

    @classmethod
    def list_active_sessions(cls, db: Session, user_id: int) -> List[SessionOut]:
        """
        List all unexpired, unrevoked refresh token sessions for a user.
        """
        now = datetime.now(timezone.utc)
        return db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now
        ).all()

    @classmethod
    def revoke_session_by_id(cls, db: Session, user_id: int, session_id: int) -> None:
        """
        Revoke a specific session by its database ID (e.g. revoking a single device).
        """
        db_token = db.query(RefreshToken).filter(
            RefreshToken.id == session_id,
            RefreshToken.user_id == user_id
        ).first()
        
        if not db_token:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found."
            )
            
        if db_token.revoked_at is None:
            db_token.revoked_at = datetime.now(timezone.utc)
            db.commit()

    @classmethod
    def verify_mfa_login(
        cls,
        db: Session,
        mfa_token: str,
        code: str,
        ip_address: Optional[str] = None,
        device_label: Optional[str] = None
    ) -> TokenSchema:
        """
        Verify a short-lived MFA login token and the submitted 6-digit TOTP code,
        returning the final access and refresh tokens.
        """
        try:
            payload = security.decode_token(mfa_token)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired login session token."
            )

        if payload.get("type") != "mfa_temp":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid login token type."
            )

        user_id = int(payload.get("sub", 0))
        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive or not found."
            )

        # Retrieve secret
        from app.models.mfa_secret import MfaSecret
        mfa_record = db.query(MfaSecret).filter(MfaSecret.user_id == user.id).first()
        if not mfa_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Multi-factor authentication record missing."
            )

        # Decrypt secret
        from app.api.v1.mfa import decrypt_secret
        from app.core.totp import TOTP
        secret_key = decrypt_secret(mfa_record.secret_encrypted)

        is_valid = TOTP.verify_totp(secret_key, code)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid MFA verification code."
            )

        # Success: generate full session access and refresh tokens
        return cls.create_user_session(db, user, ip_address, device_label)

