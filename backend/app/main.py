import re
import subprocess

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import gmail, github, jira, notion_kb, send, store
from .config import settings
from .llm import classify_email, draft_reply
from .swytchcode import SwytchcodeError

app = FastAPI(title="Support Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/health")
def health_bare():
    return {"status": "ok"}


@app.get("/api/status")
def status():
    tracked = ["gmail", "notion", "jira", "resend", "github"]
    result = {name: False for name in tracked}
    try:
        output = subprocess.run(
            ["swytchcode", "auth", "connect"], capture_output=True, text=True, timeout=15
        ).stdout
    except (subprocess.SubprocessError, OSError):
        return result

    for line in output.splitlines():
        match = re.match(r"^(\w+)\s+\S+\s+(connected|missing)", line.strip())
        if match and match.group(1) in result:
            result[match.group(1)] = match.group(2) == "connected"
    return result


@app.get("/api/inbox")
def inbox(query: str = "", max_results: int = 10):
    try:
        refs = gmail.list_inbox(query=query, max_results=max_results)
    except SwytchcodeError as e:
        raise HTTPException(status_code=502, detail={"error": e.message, "category": e.category})

    messages = []
    for ref in refs:
        try:
            messages.append(gmail.get_message(ref["id"]))
        except (SwytchcodeError, KeyError, TypeError) as e:
            error_message = e.message if isinstance(e, SwytchcodeError) else f"{type(e).__name__}: {e}"
            messages.append(
                {
                    "id": ref["id"],
                    "thread_id": ref.get("threadId"),
                    "subject": "(failed to load)",
                    "from": "",
                    "to": "",
                    "date": "",
                    "snippet": error_message,
                    "body": "",
                    "load_error": True,
                }
            )
    return messages


@app.get("/api/email/{email_id}")
def get_email(email_id: str):
    try:
        return gmail.get_message(email_id)
    except SwytchcodeError as e:
        raise HTTPException(status_code=502, detail={"error": e.message, "category": e.category})


class ClassifyRequest(BaseModel):
    email_id: str
    subject: str
    body: str


@app.post("/api/classify")
def classify(req: ClassifyRequest):
    result = classify_email(req.subject, req.body)
    store.add_event(req.email_id, "classify", "done", result)
    return result


class KbSearchRequest(BaseModel):
    email_id: str
    query_text: str


@app.post("/api/kb-search")
def kb_search(req: KbSearchRequest):
    try:
        hits = notion_kb.search_kb(req.query_text)
        status = "found" if hits else "not_found"
        store.add_event(req.email_id, "kb_search", status, {"hits": hits})
        return {"hits": hits, "status": status}
    except SwytchcodeError as e:
        store.add_event(req.email_id, "kb_search", "error", {"error": e.message})
        raise HTTPException(status_code=502, detail={"error": e.message, "category": e.category})


class DraftRequest(BaseModel):
    email_id: str
    subject: str
    body: str
    kb_hits: list[dict] = []


@app.post("/api/draft")
def draft(req: DraftRequest):
    reply = draft_reply(req.subject, req.body, req.kb_hits)
    store.add_event(req.email_id, "draft", "done", {"reply": reply})
    return {"reply": reply}


class EscalateRequest(BaseModel):
    email_id: str
    summary: str
    description: str
    entities: dict = {}
    search_duplicates: bool = True


@app.post("/api/escalate")
def escalate(req: EscalateRequest):
    existing = store.get_ticket(req.email_id)
    if existing:
        return {"ticket": existing, "reused": True}

    duplicates = []
    if req.search_duplicates:
        try:
            duplicates = github.search_duplicate_issues(req.summary)
        except SwytchcodeError:
            duplicates = []

    try:
        ticket = jira.create_issue(req.summary, req.description, req.entities)
    except SwytchcodeError as e:
        store.add_event(req.email_id, "escalate", "failed", {"error": e.message, "category": e.category})
        return {
            "ticket": {"key": None, "url": None, "self": None},
            "duplicates": duplicates,
            "reused": False,
            "error": e.message,
            "error_category": e.category,
        }

    store.set_ticket(req.email_id, ticket)
    store.add_event(req.email_id, "escalate", "done", {"ticket": ticket, "duplicates": duplicates})
    return {"ticket": ticket, "duplicates": duplicates, "reused": False}


class SendRequest(BaseModel):
    email_id: str
    to: str
    subject: str
    body: str


@app.post("/api/send")
def send_update(req: SendRequest):
    result = send.send_customer_update(req.to, req.subject, req.body)
    store.add_event(req.email_id, "send", result["status"], result)
    return result


@app.get("/api/timeline")
def timeline(email_id: str | None = None):
    return store.get_events(email_id)
