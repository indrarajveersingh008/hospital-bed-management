from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from fastapi import HTTPException, status

from app.models.hospital import Hospital, VerificationStatus, HospitalStatus
from app.models.bed_inventory import BedInventory
from app.models.audit_log import AuditLog
from app.models.report import Report, ReportStatus
from app.schemas.admin import AdminDashboardStats


class AdminService:

    @classmethod
    def list_pending_hospitals(cls, db: Session) -> List[Hospital]:
        """
        List all hospitals with PENDING verification status.
        """
        return db.query(Hospital).filter(
            Hospital.verification_status == VerificationStatus.PENDING
        ).all()

    @classmethod
    def list_all_hospitals(cls, db: Session) -> List[Hospital]:
        """
        List all registered hospitals.
        """
        return db.query(Hospital).all()

    @classmethod
    def verify_hospital(cls, db: Session, hospital_id: int, admin_id: int) -> Hospital:
        """
        Verify a hospital and set its status to ACTIVE.
        """
        hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if not hospital:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hospital not found."
            )
            
        if hospital.verification_status == VerificationStatus.VERIFIED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hospital is already verified."
            )

        hospital.verification_status = VerificationStatus.VERIFIED
        hospital.status = HospitalStatus.ACTIVE
        hospital.verified_by = admin_id
        hospital.verified_at = datetime.now(timezone.utc)
        
        # Log audit entry
        audit = AuditLog(
            user_id=admin_id,
            hospital_id=hospital_id,
            action="VERIFY_HOSPITAL",
            entity_type="hospital",
            entity_id=hospital_id,
            new_values={"verification_status": "VERIFIED", "status": "ACTIVE"}
        )
        db.add(audit)
        
        db.commit()
        db.refresh(hospital)

        # Notify hospital via registered email
        if hospital.email:
            from app.services.notification_service import NotificationService
            NotificationService.notify_verification_approval(hospital.email, hospital.name)

        return hospital

    @classmethod
    def reject_hospital(cls, db: Session, hospital_id: int, reason: str, admin_id: int) -> Hospital:
        """
        Reject a hospital verification request.
        """
        hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if not hospital:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hospital not found."
            )

        hospital.verification_status = VerificationStatus.REJECTED
        hospital.status = HospitalStatus.INACTIVE
        hospital.rejection_reason = reason
        
        # Log audit entry
        audit = AuditLog(
            user_id=admin_id,
            hospital_id=hospital_id,
            action="REJECT_HOSPITAL",
            entity_type="hospital",
            entity_id=hospital_id,
            new_values={"verification_status": "REJECTED", "rejection_reason": reason}
        )
        db.add(audit)

        db.commit()
        db.refresh(hospital)

        # Notify hospital via registered email
        if hospital.email:
            from app.services.notification_service import NotificationService
            NotificationService.notify_verification_rejection(hospital.email, hospital.name, reason)

        return hospital

    @classmethod
    def suspend_hospital(cls, db: Session, hospital_id: int, admin_id: int) -> Hospital:
        """
        Suspend an active hospital.
        """
        hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if not hospital:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hospital not found."
            )

        if hospital.status == HospitalStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hospital is already suspended."
            )

        hospital.status = HospitalStatus.SUSPENDED
        
        # Log audit entry
        audit = AuditLog(
            user_id=admin_id,
            hospital_id=hospital_id,
            action="SUSPEND_HOSPITAL",
            entity_type="hospital",
            entity_id=hospital_id,
            new_values={"status": "SUSPENDED"}
        )
        db.add(audit)

        db.commit()
        db.refresh(hospital)
        return hospital

    @classmethod
    def activate_suspended_hospital(cls, db: Session, hospital_id: int, admin_id: int) -> Hospital:
        """
        Re-activate a suspended hospital.
        """
        hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if not hospital:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hospital not found."
            )

        if hospital.status != HospitalStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hospital is not suspended."
            )

        hospital.status = HospitalStatus.ACTIVE
        
        # Log audit entry
        audit = AuditLog(
            user_id=admin_id,
            hospital_id=hospital_id,
            action="ACTIVATE_HOSPITAL",
            entity_type="hospital",
            entity_id=hospital_id,
            new_values={"status": "ACTIVE"}
        )
        db.add(audit)

        db.commit()
        db.refresh(hospital)
        return hospital

    @classmethod
    def delete_hospital(cls, db: Session, hospital_id: int, admin_id: int) -> dict:
        """
        Delete a hospital completely from the database including all child tables.
        """
        hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if not hospital:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hospital not found."
            )

        # 1. Delete associated bed inventories & bed updates
        from app.models.bed_inventory import BedInventory
        from app.models.bed_update import BedUpdate
        bed_inventories = db.query(BedInventory).filter(BedInventory.hospital_id == hospital_id).all()
        for bi in bed_inventories:
            db.query(BedUpdate).filter(BedUpdate.bed_inventory_id == bi.id).delete(synchronize_session=False)
        db.query(BedInventory).filter(BedInventory.hospital_id == hospital_id).delete(synchronize_session=False)

        # 2. Delete associated documents
        from app.models.document import HospitalDocument
        db.query(HospitalDocument).filter(HospitalDocument.hospital_id == hospital_id).delete(synchronize_session=False)

        # 3. Delete associated staff
        from app.models.hospital_staff import HospitalStaff
        db.query(HospitalStaff).filter(HospitalStaff.hospital_id == hospital_id).delete(synchronize_session=False)

        # 4. Delete discrepancy reports
        from app.models.report import DiscrepancyReport
        db.query(DiscrepancyReport).filter(DiscrepancyReport.hospital_id == hospital_id).delete(synchronize_session=False)

        # 5. Nullify audits hospital_id references to prevent foreign key issues while maintaining audits history
        from app.models.audit_log import AuditLog
        db.query(AuditLog).filter(AuditLog.hospital_id == hospital_id).update({AuditLog.hospital_id: None}, synchronize_session=False)

        # 6. Delete hospital itself
        db.delete(hospital)

        # Log audit entry
        audit = AuditLog(
            user_id=admin_id,
            action="DELETE_HOSPITAL",
            entity_type="hospital",
            entity_id=hospital_id,
            new_values={"name": hospital.name, "registration_number": hospital.registration_number}
        )
        db.add(audit)

        db.commit()
        return {"success": True, "message": f"Hospital {hospital.name} completely deleted."}

    @classmethod
    def get_dashboard_stats(cls, db: Session) -> AdminDashboardStats:
        """
        Compute dashboard aggregate statistics.
        """
        total_hospitals = db.query(Hospital).count()
        verified_hospitals = db.query(Hospital).filter(
            Hospital.verification_status == VerificationStatus.VERIFIED
        ).count()
        pending_hospitals = db.query(Hospital).filter(
            Hospital.verification_status == VerificationStatus.PENDING
        ).count()

        # Sum of beds
        # Use coalesce to handle empty tables returning None
        total_beds = db.query(func.coalesce(func.sum(BedInventory.total_beds), 0)).scalar()
        occupied_beds = db.query(func.coalesce(func.sum(BedInventory.occupied_beds), 0)).scalar()
        available_beds = db.query(func.coalesce(func.sum(BedInventory.available_beds), 0)).scalar()

        return AdminDashboardStats(
            total_hospitals=total_hospitals,
            verified_hospitals=verified_hospitals,
            pending_hospitals=pending_hospitals,
            total_beds=int(total_beds),
            occupied_beds=int(occupied_beds),
            available_beds=int(available_beds)
        )

    @classmethod
    def list_audit_logs(cls, db: Session) -> List[AuditLog]:
        """
        List all security audit logs, newest first.
        """
        return db.query(AuditLog).order_by(AuditLog.created_at.desc()).all()

    @classmethod
    def list_reports(cls, db: Session) -> List[Report]:
        """
        List all submitted discrepancy reports, newest first.
        """
        return db.query(Report).order_by(Report.created_at.desc()).all()

    @classmethod
    def resolve_report(cls, db: Session, report_id: int, admin_id: int) -> Report:
        """
        Mark a discrepancy report as resolved.
        """
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found."
            )
        report.status = ReportStatus.RESOLVED
        report.reviewed_by = admin_id
        report.reviewed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(report)
        return report
