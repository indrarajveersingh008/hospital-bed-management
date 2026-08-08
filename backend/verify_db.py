import sys
import os

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import engine, Base, SessionLocal
from app.models.bed_type import BedType

# Import all models to ensure they are registered on the Base.metadata
from app.models.user import User
from app.models.hospital import Hospital
from app.models.hospital_staff import HospitalStaff
from app.models.bed_inventory import BedInventory
from app.models.bed_update import BedUpdate
from app.models.document import HospitalDocument
from app.models.report import Report
from app.models.audit_log import AuditLog
from app.models.refresh_token import RefreshToken
from app.models.tokens import EmailVerificationToken, PasswordResetToken
from app.models.mfa_secret import MfaSecret
from app.models.idempotency_key import IdempotencyKey


def verify_and_seed():
    print("Connecting to the database and creating tables...")
    try:
        # Create all tables defined in models
        Base.metadata.create_all(bind=engine)
        print("Success: Database tables created successfully!")
    except Exception as e:
        print(f"Error: Failed to create database tables: {e}", file=sys.stderr)
        sys.exit(1)

    print("\nSeeding initial Bed Types if not already present...")
    db: Session = SessionLocal()
    try:
        default_bed_types = [
            ("ICU", "Intensive Care Unit bed"),
            ("GENERAL", "General ward bed"),
            ("EMERGENCY", "Emergency department bed"),
            ("VENTILATOR", "Bed equipped with ventilator"),
            ("ISOLATION", "Isolation bed"),
            ("PEDIATRIC", "Pediatric bed"),
        ]

        for name, description in default_bed_types:
            existing = db.query(BedType).filter(BedType.name == name).first()
            if not existing:
                bed_type = BedType(name=name, description=description)
                db.add(bed_type)
                print(f"Adding BedType: {name} - {description}")
            else:
                print(f"BedType already exists: {name}")
        
        db.commit()
        print("Success: Default bed types verified/seeded successfully!")

        print("\nVerifying database query operations...")
        count = db.query(BedType).count()
        print(f"Found {count} bed types in database.")
        
        print("\n--- Created Database Tables ---")
        for table_name in Base.metadata.tables.keys():
            print(f"- {table_name}")
            
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()

    print("\nDatabase foundation is completely set up and verified successfully!")


if __name__ == "__main__":
    verify_and_seed()
