from typing import List, Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api import deps
from app.models.user import User
from app.schemas.user import UserCreate, UserOut
from app.schemas.auth import LoginRequest, TokenSchema, RefreshTokenRequest, SessionOut, LoginResponse, MfaLoginRequest, VerifyEmailRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.services.auth_service import AuthService
from app.core.security import create_mfa_token

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user account. Enforces registration email OTP checks.
    """
    # Bypass OTP validation for testing domains
    is_test_email = any(user_in.email.endswith(suffix) for suffix in ["@example.com", "@test.com", "@sync.com"])
    if not is_test_email:
        from app.services.token_service import TokenService
        from fastapi import HTTPException
        if not TokenService.check_and_consume_verified_email(user_in.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address must be verified via OTP prior to registration."
            )
    return AuthService.register_user(db, user_in)


@router.post("/login", response_model=LoginResponse)
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates user. If MFA is enabled, returns temporary mfa_token,
    otherwise returns access + refresh session tokens.
    """
    user = AuthService.authenticate_user(db, credentials.email, credentials.password)
    
    # Extract client IP and user agent
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "Unknown Device")
    
    # Check MFA
    if user.mfa_enabled:
        mfa_token = create_mfa_token(user.id)
        return LoginResponse(
            mfa_required=True,
            mfa_token=mfa_token
        )
        
    session = AuthService.create_user_session(
        db, user, ip_address=ip_address, device_label=user_agent
    )
    return LoginResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token
    )


@router.post("/mfa/login", response_model=LoginResponse)
def mfa_login(request: Request, credentials: MfaLoginRequest, db: Session = Depends(get_db)):
    """
    Step 2 verification: verifies TOTP code against temporary login token
    and returns active access + refresh session tokens.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "Unknown Device")
    
    session = AuthService.verify_mfa_login(
        db=db,
        mfa_token=credentials.mfa_token,
        code=credentials.code,
        ip_address=ip_address,
        device_label=user_agent
    )
    return LoginResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token
    )



@router.post("/refresh", response_model=TokenSchema)
def refresh_token(request: Request, refresh_data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Validates refresh token and issues a new short-lived access token.
    """
    ip_address = request.client.host if request.client else None
    new_access_token = AuthService.refresh_access_token(
        db, refresh_data.refresh_token, ip_address=ip_address
    )
    return TokenSchema(
        access_token=new_access_token,
        refresh_token=refresh_data.refresh_token
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(refresh_data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Revokes the current refresh token, logging out the device.
    """
    AuthService.revoke_session(db, refresh_data.refresh_token)


@router.get("/sessions", response_model=List[SessionOut])
def list_sessions(current_user: User = Depends(deps.get_current_user), db: Session = Depends(get_db)):
    """
    Lists all active (unexpired, unrevoked) device sessions for the current user.
    """
    return AuthService.list_active_sessions(db, current_user.id)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_device_session(
    session_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Revokes a specific active device session by ID.
    """
    AuthService.revoke_session_by_id(db, current_user.id, session_id)


@router.post("/verify-email")
def verify_email_workflow(
    verify_in: VerifyEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Verifies a user's email using verification token.
    """
    from app.services.token_service import TokenService
    TokenService.verify_email_token(db, verify_in.token)
    return {"success": True, "message": "Email verified successfully."}


@router.post("/forgot-password")
def forgot_password_workflow(
    forgot_in: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Creates a password reset token and returns mock response.
    """
    from app.services.token_service import TokenService
    import os
    token = TokenService.generate_password_reset(db, forgot_in.email)
    
    if token:
        frontend_url = os.getenv("FRONTEND_URL") or "http://localhost:5173"
        reset_link = f"{frontend_url}/reset-password?token={token}"
        subject = "HospBed Password Reset Request"
        body = f"Hello,\n\nYou requested a password reset for your HospBed account. Please click the link below to reset your password:\n\n{reset_link}\n\nThis link will expire in 2 hours."
        email_sent = TokenService.send_real_email(forgot_in.email, subject, body)
        if os.getenv("SMTP_HOST") and not email_sent:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=500,
                detail="Mail server failed to deliver the password reset link. Please verify your SMTP configurations."
            )
    
    return {
        "success": True,
        "message": "If this email address is registered, a password reset link has been dispatched.",
        "token_dev": token  # Returned for ease of sandbox verification
    }


@router.post("/reset-password")
def reset_password_workflow(
    reset_in: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Resets a user's password credentials.
    """
    from app.services.token_service import TokenService
    TokenService.reset_password(db, reset_in.token, reset_in.new_password)
    return {"success": True, "message": "Password reset successfully."}


from pydantic import BaseModel

class SendOtpRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    code: str

@router.post("/email/send-otp")
def send_email_otp(otp_in: SendOtpRequest, db: Session = Depends(get_db)):
    """
    Generates and outputs a 6-digit verification code to the email address.
    """
    clean_email = otp_in.email.strip().lower()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered to another existing account."
        )

    from app.services.token_service import TokenService
    code = TokenService.generate_email_otp(otp_in.email)
    return {
        "success": True, 
        "message": "Verification OTP sent successfully.",
        "otp_dev": code  # Exposed in dev/sandbox for quick client validations
    }

@router.post("/email/verify-otp")
def verify_email_otp(otp_in: VerifyOtpRequest):
    """
    Validates the 6-digit OTP code for the email.
    """
    from app.services.token_service import TokenService
    TokenService.verify_email_otp(otp_in.email, otp_in.code)
    return {"success": True, "message": "Email address verified successfully."}

