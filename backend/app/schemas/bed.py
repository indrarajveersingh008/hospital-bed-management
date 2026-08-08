from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BedInventoryUpdate(BaseModel):
    total_beds: int = Field(..., ge=0, description="Total beds must be greater than or equal to 0")
    occupied_beds: int = Field(..., ge=0, description="Occupied beds must be greater than or equal to 0")


class BedInventoryOut(BaseModel):
    id: int
    hospital_id: int
    bed_type_id: int
    bed_type_name: Optional[str] = None
    total_beds: int
    occupied_beds: int
    available_beds: int
    last_updated: datetime
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True


class BedUpdateOut(BaseModel):
    id: int
    inventory_id: int
    hospital_id: int
    updated_by: Optional[int] = None
    old_total: int
    old_occupied: int
    old_available: int
    new_total: int
    new_occupied: int
    new_available: int
    update_source: str
    created_at: datetime

    class Config:
        from_attributes = True
