import hashlib
import logging
from typing import List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.hospital import Hospital, VerificationStatus, HospitalStatus
from app.models.bed_type import BedType
from app.models.bed_inventory import BedInventory
from app.models.bed_update import BedUpdate
from app.websocket.websocket_manager import manager

logger = logging.getLogger("sync_service")


class SyncService:
    """
    Service layer handling automated HIS synchronizations from external hospital systems.
    Authenticates external nodes using HMAC keys and updates inventory records securely.
    """

    @classmethod
    async def sync_external_inventory(
        cls,
        db: Session,
        registration_number: str,
        api_key: str,
        bed_inventories: List[Dict[str, Any]]
    ) -> Hospital:
        # Validate target hospital existence
        hospital = db.query(Hospital).filter(
            Hospital.registration_number == registration_number
        ).first()
        
        if not hospital:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hospital facility not registered."
            )

        # Enforce administrative status requirements
        if hospital.verification_status != VerificationStatus.VERIFIED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Hospital facility verification is pending."
            )
            
        if hospital.status != HospitalStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Hospital account status is inactive or suspended."
            )

        # Cryptographically verify the HIS API key signature
        raw_key_material = f"{registration_number}{settings.JWT_SECRET_KEY}".encode()
        expected_key = hashlib.sha256(raw_key_material).hexdigest()
        
        if api_key != expected_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid HIS sync API credentials."
            )

        # Process each bed update sequentially using row locking
        for item in bed_inventories:
            bed_type_name = item["bed_type"].upper()
            bed_type_record = db.query(BedType).filter(BedType.name == bed_type_name).first()
            if not bed_type_record:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported bed type: {item.get('bed_type')}"
                )

            total_beds = item.get("total_beds", 0)
            occupied_beds = item.get("occupied_beds", 0)

            if occupied_beds > total_beds:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Occupied beds ({occupied_beds}) exceeds total beds ({total_beds})."
                )

            # Query and lock target bed line
            inventory = db.query(BedInventory).filter(
                BedInventory.hospital_id == hospital.id,
                BedInventory.bed_type_id == bed_type_record.id
            ).with_for_update().first()

            old_total = 0
            old_occupied = 0

            if not inventory:
                # Create row if missing
                inventory = BedInventory(
                    hospital_id=hospital.id,
                    bed_type_id=bed_type_record.id,
                    total_beds=total_beds,
                    occupied_beds=occupied_beds,
                    available_beds=total_beds - occupied_beds
                )
                db.add(inventory)
                db.flush()  # Generate inventory.id for the log entry
            else:
                old_total = inventory.total_beds
                old_occupied = inventory.occupied_beds
                inventory.total_beds = total_beds
                inventory.occupied_beds = occupied_beds
                inventory.available_beds = total_beds - occupied_beds

            # Record sync change to update history logs
            update_log = BedUpdate(
                inventory_id=inventory.id,
                hospital_id=hospital.id,
                updated_by=None,  # Null represents automated API action
                old_total=old_total,
                old_occupied=old_occupied,
                old_available=old_total - old_occupied,
                new_total=total_beds,
                new_occupied=occupied_beds,
                new_available=total_beds - occupied_beds,
                update_source="HOSPITAL_API"
            )
            db.add(update_log)

        db.commit()
        db.refresh(hospital)

        # Broadcast update trigger to active WebSocket clients
        await manager.publish_bed_update(hospital.id, {
            "hospital_id": hospital.id,
            "hospital_name": hospital.name
        })

        logger.info(f"Successfully synced HIS bed inventories for hospital: {hospital.name}")
        return hospital
