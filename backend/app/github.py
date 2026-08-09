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
