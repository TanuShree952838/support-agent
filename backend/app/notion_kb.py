import re

from .config import settings
from .swytchcode import exec_tool

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "of",
    "in", "on", "for", "with", "my", "i", "we", "you", "your", "it", "this", "that",
    "please", "hi", "hello", "thanks", "regards", "have", "has", "not", "can", "be",
}


def _page_ids() -> list[str]:
    return [p.strip() for p in settings.notion_kb_page_ids.split(",") if p.strip()]


def _tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


def _fetch_page(page_id: str) -> dict:
    result = exec_tool("notion.markdown.get", {"page_id": page_id})
    markdown = result.get("markdown", "")
    lines = [line.strip() for line in markdown.splitlines() if line.strip()]
    title = lines[0].lstrip("#").strip() if lines else page_id
    return {
        "page_id": page_id,
        "title": title,
        "markdown": markdown,
        "url": f"https://www.notion.so/{page_id.replace('-', '')}",
    }


def search_kb(query_text: str, top_n: int = 3) -> list[dict]:
    page_ids = _page_ids()
    if not page_ids:
        return []

    query_tokens = _tokenize(query_text)
    if not query_tokens:
        return []

    scored = []
    for page_id in page_ids:
        page = _fetch_page(page_id)
        title_tokens = _tokenize(page["title"])
        body_tokens = _tokenize(page["markdown"])

        score = 3 * len(query_tokens & title_tokens) + len(query_tokens & body_tokens)
        if score <= 0:
            continue

        matched_tokens = query_tokens & (title_tokens | body_tokens)
        confidence = round(100 * len(matched_tokens) / len(query_tokens))

        excerpt = page["markdown"].strip().splitlines()
        excerpt_text = " ".join(excerpt[1:4]).strip()[:280] if len(excerpt) > 1 else ""

        scored.append(
            {
                "page_id": page["page_id"],
                "title": page["title"],
                "url": page["url"],
                "excerpt": excerpt_text,
                "score": score,
                "confidence": confidence,
            }
        )

    scored.sort(key=lambda h: h["score"], reverse=True)
    return scored[:top_n]


def write_back_comment(page_id: str, text: str) -> dict:
    return exec_tool(
        "notion.comment.create",
        {
            "body": {
                "parent": {"page_id": page_id},
                "rich_text": [{"type": "text", "text": {"content": text}}],
            }
        },
    )
