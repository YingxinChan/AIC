import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid

from core.config import settings


def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> dict:
    if not settings.gmail_user or not settings.gmail_app_password:
        return {
            "status": "not_configured",
            "message": "Email sending requires GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env.",
        }

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.gmail_user
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="gmail.com")
    # Plain-text part first, HTML second — clients that support HTML render
    # the last part; older/text-only clients fall back to the first.
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as server:
            server.starttls()
            server.login(settings.gmail_user, settings.gmail_app_password)
            server.sendmail(settings.gmail_user, [to_email], msg.as_string())
        return {"status": "sent"}
    except smtplib.SMTPAuthenticationError:
        return {"status": "error", "message": "Gmail rejected the credentials — check GMAIL_USER/GMAIL_APP_PASSWORD."}
    except Exception as e:
        return {"status": "error", "message": f"Failed to send email: {e}"}
