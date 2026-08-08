import sys
import os
from fastapi.testclient import TestClient

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.tokens import EmailVerificationToken, PasswordResetToken
from app.services.token_service import TokenService

client = TestClient(app)


def cleanup_test_user(email: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete()
            db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
            db.delete(user)
            db.commit()
            print(f"Cleaned up existing test user: {email}")
    finally:
        db.close()


def test_token_workflows():
    test_email = "test_tokens_user@example.com"
    test_password = "securePassword123"
    test_new_password = "evenMoreSecurePassword123!"
    test_name = "Test Tokens User"
    
    # 1. Cleanup
    cleanup_test_user(test_email)

    print("\n1. Registering test user...")
    reg_payload = {
        "name": test_name,
        "email": test_email,
        "password": test_password,
        "phone": "9555544444"
    }
    res = client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201
    user_id = res.json()["id"]
    print("Success: User registered.")

    print("\n2. Testing Email Verification...")
    db = SessionLocal()
    try:
        # Generate token using service
        raw_verify_token = TokenService.generate_email_verification(db, user_id)
        assert raw_verify_token
        print(f"Generated verify token: {raw_verify_token}")
        
        # Verify user state is initially false
        user = db.query(User).filter(User.id == user_id).first()
        assert not user.email_verified
        
        # Call API to verify email
        verify_payload = {"token": raw_verify_token}
        res = client.post("/api/v1/auth/verify-email", json=verify_payload)
        assert res.status_code == 200
        
        # Verify state is updated to True in database
        db.rollback()
        db.refresh(user)
        assert user.email_verified
        print("Success: User email is verified successfully.")

        # Re-verifying with same token should fail
        res = client.post("/api/v1/auth/verify-email", json=verify_payload)
        assert res.status_code == 400
        print("Success: Token reuse correctly blocked.")
    finally:
        db.close()

    print("\n3. Testing Password Reset Workflow...")
    # Call forgot password endpoint
    forgot_payload = {"email": test_email}
    res = client.post("/api/v1/auth/forgot-password", json=forgot_payload)
    assert res.status_code == 200
    forgot_data = res.json()
    assert forgot_data["success"]
    assert "token_dev" in forgot_data
    raw_reset_token = forgot_data["token_dev"]
    print(f"Obtained reset token: {raw_reset_token}")

    # Call reset password endpoint
    reset_payload = {
        "token": raw_reset_token,
        "new_password": test_new_password
    }
    res = client.post("/api/v1/auth/reset-password", json=reset_payload)
    assert res.status_code == 200
    print("Success: Password reset done.")

    # Re-resetting with same token should fail
    res = client.post("/api/v1/auth/reset-password", json=reset_payload)
    assert res.status_code == 400
    print("Success: Password token reuse correctly blocked.")

    print("\n4. Testing login outcomes after credentials update...")
    # Login with old password (should fail)
    login_payload_old = {
        "email": test_email,
        "password": test_password
    }
    res = client.post("/api/v1/auth/login", json=login_payload_old)
    assert res.status_code == 401
    print("Success: Old credentials blocked.")

    # Login with new password (should succeed)
    login_payload_new = {
        "email": test_email,
        "password": test_new_password
    }
    res = client.post("/api/v1/auth/login", json=login_payload_new)
    assert res.status_code == 200
    assert "access_token" in res.json()
    print("Success: Logged in using updated credentials.")

    # Cleanup
    cleanup_test_user(test_email)
    print("\nEmail and Password Token Workflows successfully tested!")


if __name__ == "__main__":
    test_token_workflows()
