import sys
import os
from fastapi.testclient import TestClient

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.mfa_secret import MfaSecret
from app.core.totp import TOTP

client = TestClient(app)


def cleanup_test_user(email: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            db.query(MfaSecret).filter(MfaSecret.user_id == user.id).delete()
            db.delete(user)
            db.commit()
            print(f"Cleaned up existing test user: {email}")
    finally:
        db.close()


def test_mfa_workflow():
    test_email = "test_mfa_user@example.com"
    test_password = "securePassword123"
    test_name = "Test MFA User"
    
    # 1. Cleanup
    cleanup_test_user(test_email)

    print("\n1. Registering test user...")
    reg_payload = {
        "name": test_name,
        "email": test_email,
        "password": test_password,
        "phone": "9876543210"
    }
    res = client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201
    print("Success: Registered.")

    print("\n2. Logging in to get initial access token...")
    login_payload = {
        "email": test_email,
        "password": test_password
    }
    res = client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200
    login_data = res.json()
    assert not login_data["mfa_required"]
    token = login_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Success: Logged in (MFA currently disabled).")

    print("\n3. Enrolling in MFA (Step 1)...")
    res = client.post("/api/v1/auth/mfa/enroll", headers=headers)
    assert res.status_code == 200
    enroll_data = res.json()
    assert "secret" in enroll_data
    assert "provisioning_uri" in enroll_data
    assert len(enroll_data["recovery_codes"]) == 5
    secret_key = enroll_data["secret"]
    print(f"Success: MFA secret generated -> {secret_key}")

    print("\n4. Generating and verifying active TOTP code (Step 2)...")
    # Generate TOTP code using our custom module
    # Clean secret padding and decode manually to emulate OTP client apps
    import base64
    secret_bytes = base64.b32decode(secret_key, casefold=True)
    import time
    current_step = int(time.time()) // 30
    code = TOTP._hotp(secret_bytes, current_step)
    
    verify_payload = {"code": code}
    res = client.post("/api/v1/auth/mfa/verify", json=verify_payload, headers=headers)
    assert res.status_code == 200
    print("Success: MFA is now enabled.")

    print("\n5. Testing login with MFA enabled (should return mfa_required)...")
    res = client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200
    mfa_req_data = res.json()
    assert mfa_req_data["mfa_required"]
    assert "mfa_token" in mfa_req_data
    mfa_token = mfa_req_data["mfa_token"]
    print("Success: Login blocked, mfa_token returned.")

    print("\n6. Completing login with MFA step 2 verification...")
    # Re-calculate code for current step
    current_step = int(time.time()) // 30
    code = TOTP._hotp(secret_bytes, current_step)
    
    mfa_login_payload = {
        "mfa_token": mfa_token,
        "code": code
    }
    res = client.post("/api/v1/auth/mfa/login", json=mfa_login_payload)
    assert res.status_code == 200
    mfa_login_data = res.json()
    assert "access_token" in mfa_login_data
    token2 = mfa_login_data["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}
    print("Success: MFA Login complete. Final access token issued.")

    print("\n7. Disabling MFA using code...")
    current_step = int(time.time()) // 30
    code = TOTP._hotp(secret_bytes, current_step)
    res = client.post("/api/v1/auth/mfa/disable", json={"code": code}, headers=headers2)
    assert res.status_code == 200
    print("Success: MFA disabled.")

    print("\n8. Logging in again (should not require MFA)...")
    res = client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200
    final_login_data = res.json()
    assert not final_login_data["mfa_required"]
    print("Success: Verified account is back to standard credentials mode.")

    # Cleanup
    cleanup_test_user(test_email)
    print("\nMFA Integration testing successfully finished!")


if __name__ == "__main__":
    test_mfa_workflow()
