from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api import deps
from app.models.user import User
from app.schemas.hospital import HospitalOut, HospitalDocumentOut
from app.schemas.admin import AdminDashboardStats, HospitalRejectRequest, AuditLogOut
from app.schemas.report import ReportOut
from app.services.admin_service import AdminService

router = APIRouter()


@router.get("/dashboard", response_model=AdminDashboardStats)
def read_admin_dashboard_stats(
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Retrieves system aggregate statistics for the admin dashboard.
    """
    return AdminService.get_dashboard_stats(db)


@router.get("/hospitals/pending", response_model=List[HospitalOut])
def list_pending_verification_hospitals(
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Lists all registered hospitals currently awaiting verification.
    """
    return AdminService.list_pending_hospitals(db)


@router.get("/hospitals", response_model=List[HospitalOut])
def list_all_registered_hospitals(
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Lists all registered hospitals (active, inactive, suspended).
    """
    return AdminService.list_all_hospitals(db)


@router.post("/hospitals/{hospital_id}/verify", response_model=HospitalOut)
def verify_hospital_registration(
    hospital_id: int,
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Verifies and activates a hospital registration request.
    """
    return AdminService.verify_hospital(db, hospital_id, current_admin.id)


@router.post("/hospitals/{hospital_id}/reject", response_model=HospitalOut)
def reject_hospital_registration(
    hospital_id: int,
    reject_in: HospitalRejectRequest,
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Rejects a hospital registration request with a reason.
    """
    return AdminService.reject_hospital(db, hospital_id, reject_in.rejection_reason, current_admin.id)


@router.post("/hospitals/{hospital_id}/suspend", response_model=HospitalOut)
def suspend_hospital_service(
    hospital_id: int,
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Suspends a verified hospital, revoking its active state.
    """
    return AdminService.suspend_hospital(db, hospital_id, current_admin.id)


@router.post("/hospitals/{hospital_id}/activate", response_model=HospitalOut)
def activate_suspended_hospital_service(
    hospital_id: int,
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Re-activates a suspended hospital to status ACTIVE.
    """
    return AdminService.activate_suspended_hospital(db, hospital_id, current_admin.id)


@router.get("/audit-logs", response_model=List[AuditLogOut])
def list_system_audit_logs(
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Lists security audit logs.
    """
    return AdminService.list_audit_logs(db)


@router.get("/reports", response_model=List[ReportOut])
def list_discrepancy_reports(
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Lists submitted discrepancy reports.
    """
    return AdminService.list_reports(db)


@router.post("/reports/{report_id}/resolve", response_model=ReportOut)
def resolve_discrepancy_report(
    report_id: int,
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Resolves a discrepancy report.
    """
    return AdminService.resolve_report(db, report_id, current_admin.id)


@router.get("/hospitals/{hospital_id}/documents", response_model=List[HospitalDocumentOut])
def list_hospital_documents_for_admin(
    hospital_id: int,
    current_admin: User = Depends(deps.get_current_active_admin),
    db: Session = Depends(get_db)
):
    """
    Enables administrators to view a hospital's uploaded verification documents.
    """
    from app.models.document import HospitalDocument
    return db.query(HospitalDocument).filter(HospitalDocument.hospital_id == hospital_id).all()

