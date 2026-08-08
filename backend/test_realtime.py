import sys
import os
import json
from fastapi.testclient import TestClient

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.hospital import Hospital, VerificationStatus
from app.models.hospital_staff import HospitalStaff
from app.models.bed_inventory import BedInventory
from app.models.bed_update import BedUpdate
from app.models.report import Report
from app.models.idempotency_key import IdempotencyKey

client = TestClient(app)


def cleanup_test_records(user_email: str, admin_email: str, reg_number: str):
    db = SessionLocal()
    try:
        hospital = db.query(Hospital).filter(Hospital.registration_number == reg_number).first()
        if hospital:
            db.query(IdempotencyKey).filter(IdempotencyKey.hospital_id == hospital.id).delete()
            db.query(Report).filter(Report.hospital_id == hospital.id).delete()
            db.query(BedUpdate).filter(BedUpdate.hospital_id == hospital.id).delete()
            db.query(BedInventory).filter(BedInventory.hospital_id == hospital.id).delete()
            db.query(HospitalStaff).filter(HospitalStaff.hospital_id == hospital.id).delete()
            db.delete(hospital)
            db.commit()
            print(f"Deleted test hospital: {reg_number}")

        db.query(User).filter(User.email.in_([user_email, admin_email])).delete()
        db.commit()
        print(f"Deleted test users: {user_email}, {admin_email}")
    finally:
        db.close()


def test_realtime_and_public_features():
    staff_email = "realtime_staff@example.com"
    admin_email = "realtime_admin@example.com"
    password = "securePassword123"
    reg_number = "REG-REALTIME-999"

    # 1. Cleanup
    cleanup_test_records(staff_email, admin_email, reg_number)

    # 2. Register accounts
    client.post("/api/v1/auth/register", json={"name": "RT Staff", "email": staff_email, "password": password})
    client.post("/api/v1/auth/register", json={"name": "RT Admin", "email": admin_email, "password": password})

    db = SessionLocal()
    admin = db.query(User).filter(User.email == admin_email).first()
    admin.role = UserRole.ADMIN
    db.commit()
    db.close()

    # Login
    staff_tokens = client.post("/api/v1/auth/login", json={"email": staff_email, "password": password}).json()
    admin_tokens = client.post("/api/v1/auth/login", json={"email": admin_email, "password": password}).json()

    staff_headers = {"Authorization": f"Bearer {staff_tokens['access_token']}"}
    admin_headers = {"Authorization": f"Bearer {admin_tokens['access_token']}"}

    # Register Hospital
    response = client.post("/api/v1/hospital/register", json={
        "name": "Realtime Mercy Hospital",
        "registration_number": reg_number,
        "hospital_type": "PRIVATE",
        "email": "mercy@example.com",
        "address": "456 Main St",
        "city": "Springfield",
        "state": "Illinois",
        "pincode": "62701"
    }, headers=staff_headers)
    hospital_id = response.json()["id"]

    # Verify Hospital
    client.post(f"/api/v1/admin/hospitals/{hospital_id}/verify", headers=admin_headers)

    print("\n1. Testing Public Search Endpoints...")
    # Search verified hospitals
    response = client.get("/api/v1/hospital/", params={"city": "Springfield"})
    assert response.status_code == 200
    results = response.json()
    assert len(results) >= 1
    assert results[0]["id"] == hospital_id
    print("Success: Public search found the verified hospital!")

    # Get details
    response = client.get(f"/api/v1/hospital/{hospital_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Realtime Mercy Hospital"
    print("Success: Public hospital details retrieved successfully!")

    print("\n2. Testing Incorrect Data Reporting...")
    # File a report
    report_payload = {
        "hospital_id": hospital_id,
        "reason": "INCORRECT_AVAILABILITY",
        "description": "Reported ICU beds count is suspicious."
    }
    response = client.post("/api/v1/reports/", json=report_payload, headers=staff_headers)
    assert response.status_code == 201
    report = response.json()
    assert report["reason"] == "INCORRECT_AVAILABILITY"
    assert report["status"] == "OPEN"
    print(f"Success: Submitted report (ID: {report['id']}, Status: OPEN)!")

    print("\n3. Testing Real-Time WebSocket Event Broadcasts...")
    # Get ICU inventory ID
    beds = client.get("/api/v1/hospital/beds", headers=staff_headers).json()
    icu_inv = next(b for b in beds if b["bed_type_name"] == "ICU")
    icu_inv_id = icu_inv["id"]

    # Open WebSocket connection
    # FastAPI test client supports websocket connection testing!
    with client.websocket_connect(f"/ws/hospitals/{hospital_id}") as websocket:
        print("WebSocket connection established successfully!")
        
        # Trigger an inventory update
        update_payload = {"total_beds": 50, "occupied_beds": 35}
        update_headers = {
            "Authorization": f"Bearer {staff_tokens['access_token']}",
            "Idempotency-Key": "rt-idem-key-001"
        }
        client.put(f"/api/v1/hospital/beds/{icu_inv_id}", json=update_payload, headers=update_headers)
        print("Triggered ICU bed count update (Total: 50, Occupied: 35).")

        # Receive broadcast message from WebSocket
        message = websocket.receive_json()
        print(f"Received WebSocket event payload: {json.dumps(message)}")
        
        # Assert message properties
        assert message["event"] == "BED_AVAILABILITY_UPDATED"
        assert message["hospital_id"] == hospital_id
        assert message["data"]["total_beds"] == 50
        assert message["data"]["occupied_beds"] == 35
        assert message["data"]["available_beds"] == 15

    print("Success: Real-time broadcast successfully verified over WebSocket!")

    # 4. Clean up
    cleanup_test_records(staff_email, admin_email, reg_number)
    print("\nAll public search, reporting, and WebSocket broadcast tests passed successfully!")


if __name__ == "__main__":
    test_realtime_and_public_features()
