import sys
import os
from fastapi.testclient import TestClient

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole

client = TestClient(app)


def cleanup_test_user(email: str):
    """
    Remove test user if exists to make tests repeatable.
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            db.delete(user)
            db.commit()
            print(f"Cleaned up existing test user: {email}")
    finally:
        db.close()


def test_authentication_workflow():
    test_email = "test_auth_user@example.com"
    test_password = "securePassword123"
    test_name = "Test Auth User"
    
    # 1. Cleanup
    cleanup_test_user(test_email)

    print("\n1. Testing Health Check Endpoint...")
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    print("Success: Health check OK!")

    print("\n2. Testing User Registration...")
    reg_payload = {
        "name": test_name,
        "email": test_email,
        "password": test_password,
        "phone": "9999988888"
    }
    response = client.post("/api/v1/auth/register", json=reg_payload)
    assert response.status_code == 201
    user_data = response.json()
    assert user_data["email"] == test_email
    assert user_data["name"] == test_name
    assert "id" in user_data
    print(f"Success: Registered user with ID {user_data['id']}!")

    print("\n3. Testing Duplicate User Registration (Should fail)...")
    response = client.post("/api/v1/auth/register", json=reg_payload)
    assert response.status_code == 400
    print("Success: Duplicate registration correctly blocked!")

    print("\n4. Testing User Login...")
    login_payload = {
        "email": test_email,
        "password": test_password
    }
    # Send headers to simulate user agent
    headers = {"User-Agent": "Test-Client-Device"}
    response = client.post("/api/v1/auth/login", json=login_payload, headers=headers)
    assert response.status_code == 200
    tokens = response.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    print("Success: Authenticated and obtained JWT tokens!")

    print("\n5. Testing Profile Endpoint with Access Token...")
    auth_headers = {"Authorization": f"Bearer {access_token}"}
    response = client.get("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == 200
    profile = response.json()
    assert profile["email"] == test_email
    assert profile["role"] == "USER"
    print("Success: Fetched user profile using access token!")

    print("\n6. Testing Active Session List...")
    response = client.get("/api/v1/auth/sessions", headers=auth_headers)
    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) >= 1
    assert any(s["device_label"] == "Test-Client-Device" for s in sessions)
    session_id = sessions[0]["id"]
    print(f"Success: Active session listed (Session ID: {session_id}, Device: Test-Client-Device)!")

    print("\n7. Testing Access Token Refresh...")
    refresh_payload = {
        "refresh_token": refresh_token
    }
    response = client.post("/api/v1/auth/refresh", json=refresh_payload)
    assert response.status_code == 200
    new_tokens = response.json()
    assert "access_token" in new_tokens
    new_access_token = new_tokens["access_token"]
    print("Success: Access token successfully refreshed!")

    print("\n8. Testing Profile Endpoint with Refreshed Access Token...")
    new_auth_headers = {"Authorization": f"Bearer {new_access_token}"}
    response = client.get("/api/v1/users/me", headers=new_auth_headers)
    assert response.status_code == 200
    print("Success: Refreshed token verified!")

    print("\n9. Testing Specific Device Session Revocation...")
    # Revoke session
    response = client.delete(f"/api/v1/auth/sessions/{session_id}", headers=auth_headers)
    assert response.status_code == 204
    print(f"Success: Revoked session ID {session_id}!")

    # Verify session is gone from active list
    response = client.get("/api/v1/auth/sessions", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 0
    print("Success: Confirmed active session list is empty after revocation!")

    # Cleanup the database user
    cleanup_test_user(test_email)
    print("\nAll authentication & session tests completed successfully!")


if __name__ == "__main__":
    test_authentication_workflow()
