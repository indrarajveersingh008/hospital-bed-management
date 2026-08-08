import sys
import os
import io

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.notification_service import NotificationService


def test_notification_templates():
    print("\n1. Testing notification template dispatch outputs...")

    # Redirect stdout
    captured_output = io.StringIO()
    sys.stdout = captured_output

    try:
        # Trigger approval
        NotificationService.notify_verification_approval("admin@test.com", "Grace Hospital")
        
        # Trigger rejection
        NotificationService.notify_verification_rejection("admin@test.com", "Mercy Hospital", "Missing license scan")
        
        # Trigger reports warning
        NotificationService.notify_discrepancy_report("staff@test.com", "Grace Hospital", "INCORRECT_AVAILABILITY")
        
        # Trigger security alert
        NotificationService.notify_mfa_update("user@test.com", "John Doe", "activated")
    finally:
        # Restore stdout
        sys.stdout = sys.__stdout__

    # Read captured stdout logs
    output_text = captured_output.getvalue()
    
    # Assert email dispatches are present in stdout logs
    assert "[MOCK EMAIL DISPATCH]" in output_text
    assert "To: admin@test.com" in output_text
    assert "Verification Approved - Grace Hospital" in output_text
    assert "'Grace Hospital' has been verified and approved" in output_text
    
    assert "Registration Request Review Update - Mercy Hospital" in output_text
    assert "Missing license scan" in output_text
    
    assert "Alert: Discrepancy Report Filed for Grace Hospital" in output_text
    assert "INCORRECT_AVAILABILITY" in output_text
    
    assert "Security Alert: Two-Factor Authentication activated" in output_text
    assert "ACTIVATED on your account" in output_text
    
    print("Success: Verification, security update, and discrepancy warning templates verified.")


if __name__ == "__main__":
    test_notification_templates()
    print("\nNotification engine checks completed successfully!")
