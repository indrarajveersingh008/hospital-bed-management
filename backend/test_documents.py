import sys
import os
import io
from fastapi.testclient import TestClient

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.hospital import Hospital, VerificationStatus
from app.models.hospital_staff import HospitalStaff
from app.models.document import HospitalDocument
from app.services.file_scan_service import FileScanService

client = TestClient(app)


def cleanup_test_data():
    db = SessionLocal()
    try:
        staff = db.query(User).filter(User.email == "doc_staff@example.com").first()
        if staff:
            db.query(HospitalStaff).filter(HospitalStaff.user_id == staff.id).delete()
            db.query(HospitalDocument).filter(HospitalDocument.verified_by == staff.id).update({HospitalDocument.verified_by: None})
            db.delete(staff)

        admin = db.query(User).filter(User.email == "doc_admin@example.com").first()
        if admin:
            db.delete(admin)

        hosp = db.query(Hospital).filter(Hospital.registration_number == "DOC-REG-999").first()
        if hosp:
            db.query(HospitalDocument).filter(HospitalDocument.hospital_id == hosp.id).delete()
            db.delete(hosp)

        db.commit()
    finally:
        db.close()


def test_document_security_and_scanning():
    cleanup_test_data()

    db = SessionLocal()
    try:
        print("\n1. Registering test hospital and staff account...")
        # Create staff user
        from app.core.security import get_password_hash
        staff = User(
            name="Doc Staff",
            email="doc_staff@example.com",
            password_hash=get_password_hash("password123"),
            role=UserRole.HOSPITAL_ADMIN
        )
        db.add(staff)
        db.flush()

        # Create admin user
        admin = User(
            name="Doc Admin",
            email="doc_admin@example.com",
            password_hash=get_password_hash("password123"),
            role=UserRole.ADMIN
        )
        db.add(admin)
        db.flush()

        # Create hospital
        hosp = Hospital(
            name="Document Test Hospital",
            registration_number="DOC-REG-999",
            hospital_type="PRIVATE",
            address="123 Verification St",
            city="Pune",
            state="Maharashtra",
            pincode="411001",
            verification_status=VerificationStatus.PENDING
        )
        db.add(hosp)
        db.flush()

        # Link staff to hospital
        link = HospitalStaff(
            user_id=staff.id,
            hospital_id=hosp.id,
            position="Manager"
        )
        db.add(link)
        db.commit()
        
        hospital_id = hosp.id
        print("Success: Registered.")
    finally:
        db.close()

    # Get staff token
    res = client.post("/api/v1/auth/login", json={"email": "doc_staff@example.com", "password": "password123"})
    assert res.status_code == 200
    staff_token = res.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Get admin token
    res = client.post("/api/v1/auth/login", json={"email": "doc_admin@example.com", "password": "password123"})
    assert res.status_code == 200
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    print("\n2. Testing CLEAN file upload...")
    clean_file_content = b"This is a clean verification certificate. Registration details check out."
    clean_file = io.BytesIO(clean_file_content)
    
    res = client.post(
        "/api/v1/hospital/documents",
        headers=staff_headers,
        data={"document_type": "REGISTRATION"},
        files={"file": ("registration_cert.pdf", clean_file, "application/pdf")}
    )
    assert res.status_code == 200
    clean_doc_data = res.json()
    assert clean_doc_data["scan_status"] == "CLEAN"
    assert "checksum_sha256" in clean_doc_data
    print("Success: Clean file uploaded. Scan status is CLEAN.")

    print("\n3. Testing INFECTED file upload (EICAR check)...")
    infected_file_content = FileScanService.EICAR_SIGNATURE + b" extra virus padding"
    infected_file = io.BytesIO(infected_file_content)
    
    res = client.post(
        "/api/v1/hospital/documents",
        headers=staff_headers,
        data={"document_type": "LICENSE"},
        files={"file": ("malicious_license.png", infected_file, "image/png")}
    )
    assert res.status_code == 200
    infected_doc_data = res.json()
    assert infected_doc_data["scan_status"] == "INFECTED"
    print("Success: Infected file detected. scan_status correctly set to INFECTED.")

    print("\n4. Listing own uploaded documents...")
    res = client.get("/api/v1/hospital/documents", headers=staff_headers)
    assert res.status_code == 200
    docs_list = res.json()
    assert len(docs_list) == 2
    print("Success: Both documents listed for staff.")

    print("\n5. Accessing documents list as system administrator...")
    res = client.get(f"/api/v1/admin/hospitals/{hospital_id}/documents", headers=admin_headers)
    assert res.status_code == 200
    admin_docs = res.json()
    assert len(admin_docs) == 2
    print("Success: Admin verified files access workflow.")

    cleanup_test_data()
    print("\nDocument Upload and Virus Scanning integration tests successfully finished!")


if __name__ == "__main__":
    test_document_security_and_scanning()
