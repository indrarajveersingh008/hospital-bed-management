from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.sql import func
from app.models.base import Base


class BedType(Base):
    __tablename__ = "bed_types"

    # Use Integer for unsigned INT in SQLAlchemy
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(255), nullable=True)
    
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1"
    )
    
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp()
    )
