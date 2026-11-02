"""Live Hacker News access (Algolia search + official Firebase API).

The Parquet archive stops at its last commit, so threads and anything newer
than the index come from these public APIs.
"""

from __future__ import annotations

import html
import re
import time

import httpx

ALGOLIA = "https://hn.algolia.com/api/v1"
FIREBASE = "https://hacker-news.firebaseio.com/v0"
ITEM_URL = "https://news.ycombinator.com/item?id={}"

_client = httpx.Client(timeout=30, follow_redirects=True,
                       headers={"User-Agent": "hn-mcp (+https://github.com/lokih1028/hn-mcp)"})


def clean_html(text: str | None) -> str:
    """HN comment HTML -> plain text."""
    if not text:
        return ""
    text = re.sub(r"<p>", "\n\n", text)
    text = re.sub(r'<a href="([^"]+)"[^>]*>[^<]*</a>', r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).strip()


def _ranked_kids(story_id: int) -> list[int]:
    try:
        item = _client.get(f"{FIREBASE}/item/{story_id}.json").json() or {}
        return item.get("kids") or []
    except httpx.HTTPError:
        return []


def get_thread(story_id: int, max_comments: int = 150, max_depth: int = 4,
               max_chars: int = 600) -> dict:
    item = _client.get(f"{ALGOLIA}/items/{story_id}").raise_for_status().json()
    rank = {kid: i for i, kid in enumerate(_ranked_kids(story_id))}
    children = sorted(item.get("children") or [], key=lambda c: rank.get(c["id"], len(rank)))

    comments: list[dict] = []
    total = 0

    def walk(nodes: list[dict], depth: int) -> None:
        nonlocal total
        for node in nodes:
            if node.get("type") != "comment" or not node.get("text"):
                walk(node.get("children") or [], depth)
                continue
            total += 1
            if depth <= max_depth and len(comments) < max_comments:
                text = clean_html(node["text"])
                if len(text) > max_chars:
                    text = text[:max_chars].rstrip() + " …"
                comments.append({
                    "id": node["id"],
                    "depth": depth,
                    "author": node.get("author"),
                    "replies": len(node.get("children") or []),
                    "text": text,
                })
            walk(node.get("children") or [], depth + 1)

    walk(children, 0)
    return {
        "id": item["id"],
        "title": item.get("title"),
        "url": item.get("url"),
        "author": item.get("author"),
        "points": item.get("points"),
        "created_at": item.get("created_at"),
        "text": clean_html(item.get("text")),
        "hn_url": ITEM_URL.format(item["id"]),
        "comments_total": total,
        "comments_returned": len(comments),
        "comments": comments,
    }


def search_recent(query: str, days: int = 7, min_points: int = 0, limit: int = 20,
                  sort: str = "points") -> list[dict]:
    since = int(time.time()) - days * 86400
    filters = [f"created_at_i>{since}"]
    if min_points:
        filters.append(f"points>={min_points}")
    endpoint = "search_by_date" if sort == "new" else "search"
    hits = _client.get(f"{ALGOLIA}/{endpoint}", params={
        "query": query,
        "tags": "story",
        "numericFilters": ",".join(filters),
        "hitsPerPage": min(max(limit, 1), 100) if sort == "new" else 100,
    }).raise_for_status().json()["hits"]
    if sort == "points":
        hits.sort(key=lambda h: h.get("points") or 0, reverse=True)
    elif sort == "comments":
        hits.sort(key=lambda h: h.get("num_comments") or 0, reverse=True)
    return [{
        "id": int(h["objectID"]),
        "title": h.get("title"),
        "url": h.get("url"),
        "author": h.get("author"),
        "points": h.get("points"),
        "comments": h.get("num_comments"),
        "created_at": h.get("created_at"),
        "hn_url": ITEM_URL.format(h["objectID"]),
    } for h in hits[:limit]]
