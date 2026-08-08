from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api import deps
from app.models.user import User
from app.schemas.report import ReportCreate, ReportOut
from app.services.report_service import ReportService

router = APIRouter()


@router.post("/", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def submit_incorrect_data_report(
    report_in: ReportCreate,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits a user report flagging incorrect bed counts or suspicious details for a hospital.
    """
    report = ReportService.submit_report(db, report_in, current_user.id)
    
    # Notify hospital
    from app.models.hospital import Hospital
    hospital = db.query(Hospital).filter(Hospital.id == report_in.hospital_id).first()
    if hospital and hospital.email:
        from app.services.notification_service import NotificationService
        NotificationService.notify_discrepancy_report(
            to_email=hospital.email,
            hospital_name=hospital.name,
            reason_category=report_in.reason.value
        )
        
    return report
