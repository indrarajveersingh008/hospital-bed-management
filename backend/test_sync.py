import sys
import os
import hashlib
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.hospital import Hospital, HospitalType, VerificationStatus, HospitalStatus
from app.models.bed_type import BedType
from app.models.bed_inventory import BedInventory
from app.models.bed_update import BedUpdate

client = TestClient(app)
db: Session = SessionLocal()


def setup_mock_hospital() -> Hospital:
    # Cleanup existing if any
    db.query(Hospital).filter(Hospital.registration_number == "REG-SYNC-999").delete()
    db.commit()

    # Ensure required BedType rows exist
    for name in ["ICU", "VENTILATOR"]:
        record = db.query(BedType).filter(BedType.name == name).first()
        if not record:
            record = BedType(name=name, description=f"{name} description", is_active=True)
            db.add(record)
    db.commit()

    hospital = Hospital(
        name="Sync Test Hospital",
        registration_number="REG-SYNC-999",
        hospital_type=HospitalType.PRIVATE,
        email="sync-admin@test.com",
        address="123 Sync Road",
        city="Pune",
        state="Maharashtra",
        pincode="411001",
        verification_status=VerificationStatus.VERIFIED,
        status=HospitalStatus.ACTIVE
    )
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    return hospital


def test_his_sync_workflows():
    print("\n1. Running HIS sync verification tests...")
    
    hospital = setup_mock_hospital()
    reg_num = hospital.registration_number

    # Generate cryptographically matching HIS key
    raw_key = f"{reg_num}{settings.JWT_SECRET_KEY}".encode()
    correct_api_key = hashlib.sha256(raw_key).hexdigest()
    incorrect_api_key = "invalid_secret_key"

    # A. Test sync with incorrect API key -> should fail with 401
    res = client.post(
        "/api/v1/sync/",
        json={
            "registration_number": reg_num,
            "api_key": incorrect_api_key,
            "bed_inventories": [
                {"bed_type": "ICU", "total_beds": 15, "occupied_beds": 8}
            ]
        }
    )
    assert res.status_code == 401
    assert "Invalid HIS sync API credentials" in res.json()["detail"]
    print("Success: Unauthorized sync request rejected.")

    # B. Test sync with invalid bed types -> should fail with 400
    res = client.post(
        "/api/v1/sync/",
        json={
            "registration_number": reg_num,
            "api_key": correct_api_key,
            "bed_inventories": [
                {"bed_type": "INVALID_TYPE", "total_beds": 10, "occupied_beds": 5}
            ]
        }
    )
    assert res.status_code == 400
    assert "Unsupported bed type" in res.json()["detail"]
    print("Success: Invalid bed category payloads rejected.")

    # C. Test sync with occupied > total -> should fail with 400
    res = client.post(
        "/api/v1/sync/",
        json={
            "registration_number": reg_num,
            "api_key": correct_api_key,
            "bed_inventories": [
                {"bed_type": "ICU", "total_beds": 10, "occupied_beds": 15}
            ]
        }
    )
    assert res.status_code == 400
    assert "exceeds total beds" in res.json()["detail"]
    print("Success: Out-of-bounds capacity allocations rejected.")

    # D. Test successful sync operation -> should succeed with 200
    res = client.post(
        "/api/v1/sync/",
        json={
            "registration_number": reg_num,
            "api_key": correct_api_key,
            "bed_inventories": [
                {"bed_type": "ICU", "total_beds": 20, "occupied_beds": 11},
                {"bed_type": "VENTILATOR", "total_beds": 8, "occupied_beds": 3}
            ]
        }
    )
    assert res.status_code == 200
    assert res.json()["success"] is True
    print("Success: Hospital inventories synchronized successfully.")

    # E. Verify database side-effects
    db.rollback()  # Clear repeatable read snapshot cache
    
    icu_type = db.query(BedType).filter(BedType.name == "ICU").first()
    vent_type = db.query(BedType).filter(BedType.name == "VENTILATOR").first()

    icu_inv = db.query(BedInventory).filter(
        BedInventory.hospital_id == hospital.id,
        BedInventory.bed_type_id == icu_type.id
    ).first()
    
    assert icu_inv is not None
    assert icu_inv.total_beds == 20
    assert icu_inv.occupied_beds == 11

    vent_inv = db.query(BedInventory).filter(
        BedInventory.hospital_id == hospital.id,
        BedInventory.bed_type_id == vent_type.id
    ).first()
    
    assert vent_inv is not None
    assert vent_inv.total_beds == 8
    assert vent_inv.occupied_beds == 3

    # Check update history logs
    log = db.query(BedUpdate).filter(BedUpdate.inventory_id == icu_inv.id).order_by(BedUpdate.id.desc()).first()
    assert log is not None
    assert log.new_total == 20
    assert log.new_occupied == 11
    assert log.update_source == "HOSPITAL_API"
    assert log.updated_by is None
    print("Success: Database states updates, logs, and relationships verified.")

    # Cleanup
    db.query(BedUpdate).filter(BedUpdate.inventory_id.in_([icu_inv.id, vent_inv.id])).delete()
    db.query(BedInventory).filter(BedInventory.hospital_id == hospital.id).delete()
    db.query(Hospital).filter(Hospital.id == hospital.id).delete()
    db.commit()


if __name__ == "__main__":
    try:
        test_his_sync_workflows()
        print("\nHIS API Integration tests completed successfully!")
    finally:
        db.close()
