import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.hospital import Hospital, VerificationStatus, HospitalStatus
from app.models.hospital_staff import HospitalStaff, StaffStatus
from app.models.bed_type import BedType
from app.models.bed_inventory import BedInventory
from app.models.bed_update import BedUpdate, UpdateSource
from app.models.audit_log import AuditLog
from app.models.idempotency_key import IdempotencyKey
from app.models.user import User, UserRole
from app.schemas.hospital import HospitalCreate, HospitalStaffCreate
from app.schemas.bed import BedInventoryUpdate, BedInventoryOut


class HospitalService:

    @classmethod
    def register_hospital(cls, db: Session, hospital_in: HospitalCreate, user: User) -> Hospital:
        """
        Register a new hospital. The hospital will be created in PENDING status.
        The registering user is automatically linked as a HOSPITAL_ADMIN.
        """
        # Check duplicate registration number
        existing = db.query(Hospital).filter(
            Hospital.registration_number == hospital_in.registration_number
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A hospital with this registration number already exists."
            )

        # Create hospital
        db_hospital = Hospital(
            name=hospital_in.name,
            registration_number=hospital_in.registration_number,
            hospital_type=hospital_in.hospital_type,
            email=hospital_in.email,
            phone=hospital_in.phone,
            emergency_phone=hospital_in.emergency_phone,
            address=hospital_in.address,
            city=hospital_in.city,
            state=hospital_in.state,
            pincode=hospital_in.pincode,
            latitude=hospital_in.latitude,
            longitude=hospital_in.longitude,
            verification_status=VerificationStatus.PENDING,
            status=HospitalStatus.INACTIVE,
            verified_by=None,
            verified_at=None,
            rejection_reason=None
        )
        db.add(db_hospital)
        db.commit()
        db.refresh(db_hospital)

        # Link registering user as hospital admin staff
        staff_link = HospitalStaff(
            user_id=user.id,
            hospital_id=db_hospital.id,
            position="Hospital Administrator",
            status=StaffStatus.ACTIVE
        )
        db.add(staff_link)
        
        # Promote user role to HOSPITAL_ADMIN if not already an ADMIN
        if user.role == UserRole.USER:
            user.role = UserRole.HOSPITAL_ADMIN
            db.add(user)

        # Pre-initialize bed inventory records for all active bed types with 0 count
        active_bed_types = db.query(BedType).filter(BedType.is_active == True).all()
        for bed_type in active_bed_types:
            inventory = BedInventory(
                hospital_id=db_hospital.id,
                bed_type_id=bed_type.id,
                total_beds=0,
                occupied_beds=0,
                available_beds=0,
                updated_by=user.id
            )
            db.add(inventory)

        db.commit()
        db.refresh(db_hospital)
        return db_hospital

    @classmethod
    def get_hospital_by_staff_user(cls, db: Session, user_id: int) -> Hospital:
        """
        Retrieve the hospital associated with a staff user.
        """
        staff = db.query(HospitalStaff).filter(
            HospitalStaff.user_id == user_id,
            HospitalStaff.status == StaffStatus.ACTIVE
        ).first()
        
        if not staff:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not registered as active staff of any hospital."
            )
            
        hospital = db.query(Hospital).filter(Hospital.id == staff.hospital_id).first()
        if not hospital:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated hospital not found."
            )
        return hospital

    @classmethod
    def check_hospital_staff_access(cls, db: Session, user_id: int, hospital_id: int) -> None:
        """
        Verifies that a user is registered staff of a specific hospital.
        """
        staff = db.query(HospitalStaff).filter(
            HospitalStaff.user_id == user_id,
            HospitalStaff.hospital_id == hospital_id,
            HospitalStaff.status == StaffStatus.ACTIVE
        ).first()
        if not staff:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to manage this hospital."
            )

    @classmethod
    def list_staff(cls, db: Session, hospital_id: int) -> List[HospitalStaff]:
        """
        List all staff members for a hospital.
        """
        return db.query(HospitalStaff).filter(HospitalStaff.hospital_id == hospital_id).all()

    @classmethod
    def add_staff(cls, db: Session, hospital_id: int, staff_in: HospitalStaffCreate) -> HospitalStaff:
        """
        Add a new staff member to a hospital.
        """
        user = db.query(User).filter(User.email == staff_in.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User with this email not found. Staff must register a user account first."
            )
            
        # Check if already staff somewhere
        existing = db.query(HospitalStaff).filter(
            HospitalStaff.user_id == user.id,
            HospitalStaff.status == StaffStatus.ACTIVE
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already registered as active staff of a hospital."
            )

        staff = HospitalStaff(
            user_id=user.id,
            hospital_id=hospital_id,
            position=staff_in.position,
            status=StaffStatus.ACTIVE
        )
        db.add(staff)
        
        # Update user role to HOSPITAL_ADMIN if standard user
        if user.role == UserRole.USER:
            user.role = UserRole.HOSPITAL_ADMIN
            db.add(user)
            
        db.commit()
        db.refresh(staff)
        return staff

    @classmethod
    def remove_staff(cls, db: Session, hospital_id: int, staff_id: int) -> None:
        """
        Remove staff member from a hospital.
        """
        staff = db.query(HospitalStaff).filter(
            HospitalStaff.id == staff_id,
            HospitalStaff.hospital_id == hospital_id
        ).first()
        
        if not staff:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff record not found."
            )
            
        db.delete(staff)
        db.commit()

    @classmethod
    def get_bed_inventory(cls, db: Session, hospital_id: int) -> List[Dict[str, Any]]:
        """
        Retrieve live bed counts for a hospital, including type names.
        """
        inventories = db.query(BedInventory).filter(BedInventory.hospital_id == hospital_id).all()
        results = []
        for inv in inventories:
            results.append({
                "id": inv.id,
                "hospital_id": inv.hospital_id,
                "bed_type_id": inv.bed_type_id,
                "bed_type_name": inv.bed_type.name if inv.bed_type else "Unknown",
                "total_beds": inv.total_beds,
                "occupied_beds": inv.occupied_beds,
                "available_beds": inv.available_beds,
                "last_updated": inv.last_updated,
                "updated_by": inv.updated_by
            })
        return results

    @classmethod
    async def update_bed_inventory(
        cls,
        db: Session,
        hospital_id: int,
        inventory_id: int,
        update_data: BedInventoryUpdate,
        user_id: int,
        idempotency_key: Optional[str] = None,
        endpoint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update hospital bed inventory. Enforces availability calculations,
        database row-locking, history logs, and idempotency checks.
        """
        # 1. Idempotency Check
        if idempotency_key:
            idem_record = db.query(IdempotencyKey).filter(
                IdempotencyKey.idempotency_key == idempotency_key,
                IdempotencyKey.hospital_id == hospital_id
            ).first()
            if idem_record:
                # Return snapshot response from DB
                return json.loads(idem_record.response_snapshot)

        # 2. Database Row Locking & Retrieval
        # Use with_for_update to prevent race conditions during concurrently executed updates
        inventory = db.query(BedInventory).filter(
            BedInventory.id == inventory_id
        ).with_for_update().first()

        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bed inventory record not found."
            )

        if inventory.hospital_id != hospital_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot update inventory belonging to another hospital."
            )

        # 3. Validation
        if update_data.occupied_beds > update_data.total_beds:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Occupied beds cannot exceed total beds."
            )

        # 4. Old values snapshot
        old_total = inventory.total_beds
        old_occupied = inventory.occupied_beds
        old_available = inventory.available_beds

        # 5. Calculation
        new_available = update_data.total_beds - update_data.occupied_beds

        # 6. Apply updates
        inventory.total_beds = update_data.total_beds
        inventory.occupied_beds = update_data.occupied_beds
        inventory.available_beds = new_available
        inventory.updated_by = user_id
        inventory.last_updated = datetime.now(timezone.utc)
        db.add(inventory)

        # 7. Insert bed update history
        history = BedUpdate(
            inventory_id=inventory.id,
            hospital_id=hospital_id,
            updated_by=user_id,
            old_total=old_total,
            old_occupied=old_occupied,
            old_available=old_available,
            new_total=update_data.total_beds,
            new_occupied=update_data.occupied_beds,
            new_available=new_available,
            update_source=UpdateSource.HOSPITAL_DASHBOARD
        )
        db.add(history)

        # 8. Create security audit log
        audit = AuditLog(
            user_id=user_id,
            hospital_id=hospital_id,
            action="UPDATE_BED_INVENTORY",
            entity_type="bed_inventory",
            entity_id=inventory.id,
            old_values={"total": old_total, "occupied": old_occupied, "available": old_available},
            new_values={"total": update_data.total_beds, "occupied": update_data.occupied_beds, "available": new_available}
        )
        db.add(audit)

        # Prepare response dict
        response_data = {
            "id": inventory.id,
            "hospital_id": inventory.hospital_id,
            "bed_type_id": inventory.bed_type_id,
            "bed_type_name": inventory.bed_type.name if inventory.bed_type else "Unknown",
            "total_beds": inventory.total_beds,
            "occupied_beds": inventory.occupied_beds,
            "available_beds": inventory.available_beds,
            "last_updated": inventory.last_updated.isoformat(),
            "updated_by": inventory.updated_by
        }

        # 9. Store Idempotency Key Snapshot Response
        if idempotency_key:
            new_idem = IdempotencyKey(
                idempotency_key=idempotency_key,
                hospital_id=hospital_id,
                endpoint=endpoint or "update_bed_inventory",
                response_snapshot=json.dumps(response_data)
            )
            db.add(new_idem)

        db.commit()

        # 10. Publish event to Redis / WebSockets
        try:
            from app.websocket.websocket_manager import manager
            await manager.publish_bed_update(hospital_id, response_data)
        except Exception:
            pass

        return response_data

    @classmethod
    def get_bed_history(cls, db: Session, hospital_id: int, inventory_id: int) -> List[BedUpdate]:
        """
        Retrieve change logs for a specific bed inventory line.
        """
        # Verify access
        inventory = db.query(BedInventory).filter(BedInventory.id == inventory_id).first()
        if not inventory or inventory.hospital_id != hospital_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot query history for this inventory item."
            )
            
        return db.query(BedUpdate).filter(
            BedUpdate.inventory_id == inventory_id
        ).order_by(BedUpdate.created_at.desc()).all()
