import base64
from email.message import EmailMessage
from email.utils import parsedate_to_datetime

from .swytchcode import exec_tool


def list_inbox(query: str = "", max_results: int = 10) -> list[dict]:
    args = {"userId": "me", "maxResults": max_results}
    if query:
        args["q"] = query
    result = exec_tool("gmail.user.messages.get", args)
    return result.get("messages", []) or []


def _header(headers: list[dict], name: str) -> str:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _decode_body(payload: dict) -> str:
    if payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"] + "==").decode("utf-8", errors="replace")

    for part in payload.get("parts", []) or []:
        if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
            return base64.urlsafe_b64decode(part["body"]["data"] + "==").decode("utf-8", errors="replace")

    for part in payload.get("parts", []) or []:
        if part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
            return base64.urlsafe_b64decode(part["body"]["data"] + "==").decode("utf-8", errors="replace")

    return ""


def _parse_date(raw_date: str) -> str:
    if not raw_date:
        return ""
    try:
        return parsedate_to_datetime(raw_date).isoformat()
    except (TypeError, ValueError):
        return raw_date


def get_message(message_id: str) -> dict:
    raw = exec_tool("gmail.user.messages.get1", {"userId": "me", "id": message_id, "format": "full"})
    headers = raw.get("payload", {}).get("headers", [])
    return {
        "id": raw["id"],
        "thread_id": raw.get("threadId"),
        "subject": _header(headers, "Subject"),
        "from": _header(headers, "From"),
        "to": _header(headers, "To"),
        "date": _parse_date(_header(headers, "Date")),
        "snippet": raw.get("snippet", ""),
        "body": _decode_body(raw.get("payload", {})),
    }


def send_email(to: str, subject: str, body_text: str, from_addr: str) -> dict:
    msg = EmailMessage()
    msg["To"] = to
    msg["From"] = from_addr
    msg["Subject"] = subject
    msg.set_content(body_text)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
    return exec_tool("gmail.user.send.create1", {"userId": "me", "body": {"raw": raw}})
