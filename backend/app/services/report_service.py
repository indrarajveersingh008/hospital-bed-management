from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.hospital import Hospital
from app.models.bed_inventory import BedInventory
from app.models.report import Report, ReportStatus
from app.models.audit_log import AuditLog
from app.schemas.report import ReportCreate


class ReportService:

    @classmethod
    def submit_report(cls, db: Session, report_in: ReportCreate, user_id: int) -> Report:
        """
        Submits a report claiming incorrect hospital or bed availability details.
        """
        # Validate hospital exists
        hospital = db.query(Hospital).filter(Hospital.id == report_in.hospital_id).first()
        if not hospital:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hospital not found."
            )

        # Validate inventory exists and matches hospital if supplied
        if report_in.inventory_id:
            inventory = db.query(BedInventory).filter(
                BedInventory.id == report_in.inventory_id,
                BedInventory.hospital_id == report_in.hospital_id
            ).first()
            if not inventory:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bed inventory item not found or does not belong to specified hospital."
                )

        # Create report
        report = Report(
            user_id=user_id,
            hospital_id=report_in.hospital_id,
            inventory_id=report_in.inventory_id,
            reason=report_in.reason,
            description=report_in.description,
            status=ReportStatus.OPEN,
            reviewed_by=None,
            reviewed_at=None
        )
        db.add(report)

        # Create audit log entry
        audit = AuditLog(
            user_id=user_id,
            hospital_id=report_in.hospital_id,
            action="SUBMIT_REPORT",
            entity_type="reports",
            new_values={"reason": report_in.reason.value, "description": report_in.description}
        )
        db.add(audit)

        db.commit()
        db.refresh(report)
        return report
