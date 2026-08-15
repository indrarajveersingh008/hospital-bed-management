from typing import List, Optional
from fastapi import APIRouter, Depends, Header, Request, status, HTTPException, Form, File, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api import deps
from app.models.user import User
from app.models.hospital import Hospital, VerificationStatus
from app.models.document import DocumentType
from app.schemas.hospital import HospitalCreate, HospitalOut, HospitalStaffCreate, HospitalStaffOut, HospitalDocumentOut
from app.schemas.bed import BedInventoryUpdate, BedInventoryOut, BedUpdateOut
from app.services.hospital_service import HospitalService

router = APIRouter()


@router.get("/", response_model=List[HospitalOut])
def search_hospitals(
    city: Optional[str] = None,
    state: Optional[str] = None,
    hospital_type: Optional[str] = None,
    bed_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Public search endpoint to locate verified hospitals.
    Can be filtered by city, state, hospital type, or available bed category.
    """
    query = db.query(Hospital).filter(
        Hospital.verification_status == VerificationStatus.VERIFIED
    )
    if city and city.strip():
        query = query.filter(Hospital.city.ilike(f"%{city.strip()}%"))
    if state and state.strip() and state != "All States":
        query = query.filter(Hospital.state.ilike(f"%{state.strip()}%"))
    if hospital_type and hospital_type.strip():
        query = query.filter(Hospital.hospital_type == hospital_type.strip())
    if bed_type and bed_type.strip():
        from app.models.bed_inventory import BedInventory
        from app.models.bed_type import BedType
        query = query.join(
            BedInventory, BedInventory.hospital_id == Hospital.id
        ).join(
            BedType, BedType.id == BedInventory.bed_type_id
        ).filter(
            BedType.name.ilike(f"%{bed_type.strip()}%"),
            BedInventory.available_beds > 0
        )
    return query.all()


@router.post("/register", response_model=HospitalOut, status_code=status.HTTP_201_CREATED)
def register_hospital(
    hospital_in: HospitalCreate,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Registers a new hospital account. The user will be promoted to HOSPITAL_ADMIN
    and linked as the administrator of the pending hospital.
    """
    return HospitalService.register_hospital(db, hospital_in, current_user)


@router.get("/me", response_model=HospitalOut)
def read_my_hospital_profile(
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the hospital profile linked to the logged-in staff member.
    """
    return HospitalService.get_hospital_by_staff_user(db, current_user.id)


@router.get("/beds", response_model=List[BedInventoryOut])
def read_my_bed_inventory(
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the live bed inventory list of the logged-in user's hospital.
    """
    hospital = HospitalService.get_hospital_by_staff_user(db, current_user.id)
    return HospitalService.get_bed_inventory(db, hospital.id)


@router.put("/beds/{inventory_id}", response_model=BedInventoryOut)
async def update_bed_inventory(
    inventory_id: int,
    update_data: BedInventoryUpdate,
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the total and occupied bed count for a specific bed type line.
    Requires an Idempotency-Key header to prevent duplicate writes from retries.
    """
    hospital = HospitalService.get_hospital_by_staff_user(db, current_user.id)
    endpoint = f"PUT /api/v1/hospital/beds/{inventory_id}"
    return await HospitalService.update_bed_inventory(
        db=db,
        hospital_id=hospital.id,
        inventory_id=inventory_id,
        update_data=update_data,
        user_id=current_user.id,
        idempotency_key=idempotency_key,
        endpoint=endpoint
    )



@router.get("/beds/{inventory_id}/history", response_model=List[BedUpdateOut])
def read_bed_inventory_history(
    inventory_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves all historical update logs for a specific bed inventory item.
    """
    hospital = HospitalService.get_hospital_by_staff_user(db, current_user.id)
    return HospitalService.get_bed_history(db, hospital.id, inventory_id)


@router.get("/staff", response_model=List[HospitalStaffOut])
def list_hospital_staff(
    current_user: User = Depends(deps.get_current_active_hospital_admin),
    db: Session = Depends(get_db)
):
    """
    Lists all staff members linked to the logged-in user's hospital.
    """
    hospital = HospitalService.get_hospital_by_staff_user(db, current_user.id)
    return HospitalService.list_staff(db, hospital.id)


@router.post("/staff", response_model=HospitalStaffOut, status_code=status.HTTP_201_CREATED)
def add_hospital_staff(
    staff_in: HospitalStaffCreate,
    current_user: User = Depends(deps.get_current_active_hospital_admin),
    db: Session = Depends(get_db)
):
    """
    Adds a new staff user by email to manage the logged-in user's hospital.
    """
    hospital = HospitalService.get_hospital_by_staff_user(db, current_user.id)
    return HospitalService.add_staff(db, hospital.id, staff_in)


@router.delete("/staff/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_hospital_staff(
    staff_id: int,
    current_user: User = Depends(deps.get_current_active_hospital_admin),
    db: Session = Depends(get_db)
):
    """
    Removes a staff member's administrative access to the hospital.
    """
    hospital = HospitalService.get_hospital_by_staff_user(db, current_user.id)
    HospitalService.remove_staff(db, hospital.id, staff_id)


@router.post("/documents", response_model=HospitalDocumentOut)
async def upload_verification_document(
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Hospital staff uploads validation credentials. Checked via mock ClamAV scanning.
    """
    import os
    import secrets
    from app.models.hospital_staff import HospitalStaff
    from app.models.document import HospitalDocument

    # 1. Verify staff role
    staff = db.query(HospitalStaff).filter(HospitalStaff.user_id == current_user.id).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only registered hospital staff can submit verification documents."
        )

    # 2. Validate file type
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".pdf", ".png", ".jpg", ".jpeg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file extension. Only PDF, PNG, and JPG files are allowed."
        )

    # 3. Read content and run virus check
    file_bytes = await file.read()
    
    from app.services.file_scan_service import FileScanService
    checksum = FileScanService.calculate_checksum(file_bytes)
    scan_status = FileScanService.scan_file(file_bytes)

    # 4. Save file
    os.makedirs("uploads", exist_ok=True)
    stored_name = f"{secrets.token_hex(8)}_{filename}"
    file_path = f"uploads/{stored_name}"
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # 5. Save database entry
    doc = HospitalDocument(
        hospital_id=staff.hospital_id,
        document_type=document_type,
        file_path=file_path,
        checksum_sha256=checksum,
        scan_status=scan_status
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/documents", response_model=List[HospitalDocumentOut])
def list_own_verification_documents(
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists own uploaded hospital verification documents.
    """
    from app.models.hospital_staff import HospitalStaff
    from app.models.document import HospitalDocument

    staff = db.query(HospitalStaff).filter(HospitalStaff.user_id == current_user.id).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only registered hospital staff can view documents."
        )
    return db.query(HospitalDocument).filter(HospitalDocument.hospital_id == staff.hospital_id).all()


@router.get("/{hospital_id}", response_model=HospitalOut)
def read_hospital_details(hospital_id: int, db: Session = Depends(get_db)):
    """
    Public details endpoint for a specific hospital.
    """
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital not found."
        )
    return hospital


@router.get("/{hospital_id}/beds", response_model=List[BedInventoryOut])
def read_hospital_beds_availability(hospital_id: int, db: Session = Depends(get_db)):
    """
    Public availability endpoint for a specific hospital's bed inventory.
    """
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital not found."
        )
    return HospitalService.get_bed_inventory(db, hospital_id)
