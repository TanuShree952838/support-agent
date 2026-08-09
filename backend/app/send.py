from . import gmail
from .config import settings
from .swytchcode import SwytchcodeError, exec_tool


def send_customer_update(
    to: str,
    subject: str,
    body: str,
    thread_id: str | None = None,
    in_reply_to: str | None = None,
) -> dict:
    if settings.resend_from_email:
        try:
            result = exec_tool(
                "resend.email.create",
                {"body": {"from": settings.resend_from_email, "to": [to], "subject": subject, "text": body}},
            )
            return {"channel": "resend", "status": "sent", "id": result.get("id")}
        except SwytchcodeError as resend_error:
            fallback = _gmail_fallback(to, subject, body, thread_id, in_reply_to)
            fallback["resend_error"] = resend_error.message
            return fallback

    return _gmail_fallback(to, subject, body, thread_id, in_reply_to)


def _gmail_fallback(
    to: str, subject: str, body: str, thread_id: str | None, in_reply_to: str | None
) -> dict:
    try:
        result = gmail.send_email(to, subject, body, settings.support_from_email, thread_id, in_reply_to)
        return {"channel": "gmail_fallback", "status": "sent", "id": result.get("id")}
    except SwytchcodeError as gmail_error:
        return {"channel": "none", "status": "queued", "error": gmail_error.message}
