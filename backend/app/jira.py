from .config import settings
from .swytchcode import exec_tool


def _adf_doc(text: str) -> dict:
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": line}]}
            for line in text.splitlines()
            if line.strip()
        ]
        or [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
    }


_URGENCY_TO_PRIORITY = {"high": "High", "medium": "Medium", "low": "Low"}


def create_issue(summary: str, description: str, entities: dict | None = None, urgency: str | None = None) -> dict:
    body_text = description
    if entities:
        details = "\n".join(f"{k}: {v}" for k, v in entities.items() if v)
        if details:
            body_text = f"{description}\n\nExtracted details:\n{details}"

    fields = {
        "project": {"key": settings.jira_project_key},
        "summary": summary,
        "issuetype": {"name": "Bug"},
        "description": _adf_doc(body_text),
    }
    priority_name = _URGENCY_TO_PRIORITY.get(urgency or "")
    if priority_name:
        fields["priority"] = {"name": priority_name}

    result = exec_tool("jira.api.issue.create", {"body": {"fields": fields}})
    key = result.get("key")
    url = f"https://{settings.jira_site_domain}/browse/{key}" if settings.jira_site_domain and key else None
    return {"key": key, "url": url, "self": result.get("self")}
