from .config import settings
from .swytchcode import exec_tool


def search_duplicate_issues(keywords: str, max_results: int = 5) -> list[dict]:
    if not settings.github_repo:
        return []

    query = f"repo:{settings.github_repo} is:issue {keywords}"
    result = exec_tool("github.issue.list.1", {"q": query, "per_page": max_results})
    return [
        {"number": item["number"], "title": item["title"], "url": item["html_url"], "state": item["state"]}
        for item in result.get("items", [])
    ]


def comment_on_issue(issue_number: int, body: str) -> dict:
    owner, repo = settings.github_repo.split("/", 1)
    return exec_tool(
        "github.issue.comments.create",
        {"owner": owner, "repo": repo, "issue_number": issue_number, "body": {"body": body}},
    )


def create_issue(title: str, body: str) -> dict:
    owner, repo = settings.github_repo.split("/", 1)
    result = exec_tool("github.issue.create", {"owner": owner, "repo": repo, "body": {"title": title, "body": body}})
    return {"number": result.get("number"), "url": result.get("html_url")}
