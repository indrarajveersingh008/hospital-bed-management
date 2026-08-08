import logging

logger = logging.getLogger("notification_service")


class NotificationService:
    """
    Core notification engine simulating email, SMS, and security alerts.
    Produces formatted template logs for system notifications events.
    """

    @classmethod
    def send_email(cls, to_email: str, subject: str, body_html: str) -> None:
        """
        Base mock email dispatcher.
        """
        print(f"\n--- [MOCK EMAIL DISPATCH] ---")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body:\n{body_html}")
        print(f"-----------------------------\n")
        logger.info(f"Mock email successfully dispatched to: {to_email}")

    @classmethod
    def send_sms(cls, to_phone: str, message: str) -> None:
        """
        Base mock SMS dispatcher.
        """
        print(f"\n--- [MOCK SMS DISPATCH] ---")
        print(f"To: {to_phone}")
        print(f"Message: {message}")
        print(f"---------------------------\n")
        logger.info(f"Mock SMS successfully dispatched to: {to_phone}")

    @classmethod
    def notify_verification_approval(cls, to_email: str, hospital_name: str) -> None:
        """
        Alerts a hospital administrator when their registration request is approved.
        """
        subject = f"Verification Approved - {hospital_name}"
        body = (
            f"Dear Hospital Administrator,\n\n"
            f"We are pleased to inform you that your registration request for '{hospital_name}' "
            f"has been verified and approved by the system administrators.\n"
            f"You can now login and manage your bed availability inventories.\n\n"
            f"Best regards,\n"
            f"Hospital Bed Management System Support"
        )
        cls.send_email(to_email, subject, body)

    @classmethod
    def notify_verification_rejection(cls, to_email: str, hospital_name: str, reason: str) -> None:
        """
        Alerts a hospital administrator when their registration request is rejected.
        """
        subject = f"Registration Request Review Update - {hospital_name}"
        body = (
            f"Dear Hospital Administrator,\n\n"
            f"Thank you for your application to register '{hospital_name}'.\n"
            f"Unfortunately, your request could not be approved at this time for the following reason:\n"
            f"'{reason}'\n\n"
            f"If you believe this was an error or wish to submit additional details, please contact support.\n\n"
            f"Best regards,\n"
            f"Hospital Bed Management System Support"
        )
        cls.send_email(to_email, subject, body)

    @classmethod
    def notify_discrepancy_report(cls, to_email: str, hospital_name: str, reason_category: str) -> None:
        """
        Alerts hospital staff when users submit discrepancy reports.
        """
        subject = f"Alert: Discrepancy Report Filed for {hospital_name}"
        body = (
            f"Dear Hospital Staff,\n\n"
            f"This is an automated alert notifying you that a user has submitted a discrepancy report "
            f"regarding your reported bed availability.\n"
            f"Category reported: '{reason_category}'\n"
            f"Please review your active bed inventories on your dashboard to ensure information accuracy.\n\n"
            f"Best regards,\n"
            f"Hospital Bed Management System Support"
        )
        cls.send_email(to_email, subject, body)

    @classmethod
    def notify_mfa_update(cls, to_email: str, user_name: str, action: str) -> None:
        """
        Alerts a user when MFA features are updated on their account.
        """
        subject = f"Security Alert: Two-Factor Authentication {action}"
        body = (
            f"Hello {user_name},\n\n"
            f"This email confirms that Multi-Factor Authentication (MFA) has been successfully "
            f"{action.upper()} on your account.\n"
            f"If you did not request this security update, please secure your credentials immediately.\n\n"
            f"Best regards,\n"
            f"Security Operations Team"
        )
        cls.send_email(to_email, subject, body)
