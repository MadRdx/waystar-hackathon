import asyncio
import re
import smtplib
from email.message import EmailMessage

from app.config import get_settings


TAG_RE = re.compile(r"<[^>]+>")


def strip_html(value: str) -> str:
    return TAG_RE.sub("", value)


def _send_email_sync(*, to_email: str, subject: str, body_html: str) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(strip_html(body_html))
    message.add_alternative(body_html, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_secure:
            server.starttls()
        if settings.smtp_user and settings.smtp_pass:
            server.login(settings.smtp_user, settings.smtp_pass)
        server.send_message(message)


async def deliver_email(*, to_email: str, subject: str, body_html: str) -> tuple[str, str]:
    settings = get_settings()
    if not settings.smtp_enabled:
        return ("preview", "SENT")

    try:
        await asyncio.to_thread(_send_email_sync, to_email=to_email, subject=subject, body_html=body_html)
        return ("smtp", "SENT")
    except Exception:
        return ("smtp", "FAILED")
