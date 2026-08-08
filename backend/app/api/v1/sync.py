from typing import List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.sync_service import SyncService

router = APIRouter()


# Validation Schemas
class BedSyncItem(BaseModel):
    bed_type: str = Field(..., description="Category label, e.g. ICU, WARD, VENTILATOR")
    total_beds: int = Field(..., ge=0, description="Total designated beds capacity")
    occupied_beds: int = Field(..., ge=0, description="Current occupied beds count")


class HISSyncRequest(BaseModel):
    registration_number: str = Field(..., description="Unique hospital registration identifier")
    api_key: str = Field(..., description="SHA256 signature token")
    bed_inventories: List[BedSyncItem] = Field(..., description="List of bed inventories to synchronize")


@router.post("/", status_code=status.HTTP_200_OK)
async def sync_hospital_inventory(
    sync_in: HISSyncRequest,
    db: Session = Depends(get_db)
):
    """
    Automated HIS Integration API.
    Updates hospital inventories using secure cryptographic API key signatures.
    """
    # Map pydantic list items to list of dicts for service consumption
    updates = [item.model_dump() for item in sync_in.bed_inventories]
    
    await SyncService.sync_external_inventory(
        db=db,
        registration_number=sync_in.registration_number,
        api_key=sync_in.api_key,
        bed_inventories=updates
    )
    
    return {
        "success": True,
        "message": "Hospital inventories successfully synchronized."
    }
