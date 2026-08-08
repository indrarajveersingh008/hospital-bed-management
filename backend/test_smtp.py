import smtplib
import os
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

def test_smtp_connection():
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM") or smtp_username

    print("--- SMTP Diagnostics Config ---")
    print(f"Host: {smtp_host}")
    print(f"Port: {smtp_port}")
    print(f"Username: {smtp_username}")
    print(f"Sender (From): {smtp_from}")
    print(f"Password set: {'Yes' if smtp_password else 'No'}")
    print("--------------------------------")

    if not all([smtp_host, smtp_port, smtp_username, smtp_password]):
        print("Error: Missing SMTP configuration environment variables.")
        return

    try:
        msg = MIMEText("This is a diagnostic SMTP test from HospBed.")
        msg["Subject"] = "HospBed SMTP Diagnostic Test"
        msg["From"] = smtp_from
        msg["To"] = smtp_from  # Send to yourself

        port = int(smtp_port)
        print("Connecting to SMTP server...")
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=10)
            server.set_debuglevel(1)  # ENABLE FULL VERBOSE PROTOCOL DEBUGGING
            print("Sending STARTTLS command...")
            server.starttls()

        print("Logging in...")
        server.login(smtp_username, smtp_password)
        print("Sending message...")
        server.sendmail(smtp_from, [smtp_from], msg.as_string())
        server.quit()
        print("\nSUCCESS: SMTP connected and sent verification mail successfully!")
    except Exception as e:
        print(f"\nFAILURE: Connection failed with error:\n{e}")

if __name__ == "__main__":
    test_smtp_connection()
