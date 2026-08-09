import json
from datetime import datetime, timezone
from pathlib import Path

_STATE_FILE = Path(__file__).resolve().parent.parent / "data" / "state.json"


def _load() -> dict:
    if not _STATE_FILE.exists():
        return {"events": [], "tickets": {}, "cases": {}}
    with open(_STATE_FILE) as f:
        state = json.load(f)
    state.setdefault("events", [])
    state.setdefault("tickets", {})
    state.setdefault("cases", {})
    return state


def _save(state: dict) -> None:
    _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def add_event(email_id: str, step: str, status: str, detail: dict | None = None) -> dict:
    state = _load()
    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "email_id": email_id,
        "step": step,
        "status": status,
        "detail": detail or {},
    }
    state["events"].append(event)
    _save(state)
    return event


def get_events(email_id: str | None = None) -> list[dict]:
    state = _load()
    events = state["events"]
    if email_id:
        events = [e for e in events if e["email_id"] == email_id]
    return events


def get_ticket(email_id: str) -> dict | None:
    state = _load()
    return state["tickets"].get(email_id)


def set_ticket(email_id: str, ticket: dict) -> None:
    state = _load()
    state["tickets"][email_id] = ticket
    _save(state)


def update_case(email_id: str, **fields) -> dict:
    state = _load()
    case = state["cases"].setdefault(email_id, {"email_id": email_id})
    case.update(fields)
    case["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save(state)
    return case


def get_cases() -> list[dict]:
    state = _load()
    cases = list(state["cases"].values())
    cases.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    return cases
