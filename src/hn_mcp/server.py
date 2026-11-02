"""MCP tools over the local HN story index plus live HN APIs."""

from __future__ import annotations

import datetime as dt
import functools
import re
import shlex
from typing import Literal

import duckdb
import httpx
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from . import live
from .index import Index

INSTRUCTIONS = """\
Hacker News knowledge base: ~4.8M stories from 2006-10 onward in a local index
(search_stories, topic_trend, domain_report, on_this_day, run_sql), plus live
APIs for comment threads and anything newer than the index (get_thread,
search_recent). Call index_status to see where the local index ends. Cite
stories with their hn_url.
"""

mcp = MCPServer("hn-mcp", instructions=INSTRUCTIONS)


def tool(fn):
    """Register a tool whose expected failures (bad SQL, missing index, network)
    reach the model as a readable error instead of a bare "Error executing tool"."""

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except (ValueError, duckdb.Error, FileNotFoundError, httpx.HTTPError) as exc:
            raise ToolError(str(exc)) from exc

    return mcp.tool()(wrapper)

HN_URL = "'https://news.ycombinator.com/item?id=' || id"
STORY_COLS = f"""id, title, url, domain, author, score, comments,
    strftime(time, '%Y-%m-%d %H:%M') AS time, {HN_URL} AS hn_url"""
SORTS = {"score": "score DESC", "comments": "comments DESC", "new": "time DESC", "old": "time ASC"}

_index: Index | None = None


def index() -> Index:
    global _index
    if _index is None:
        _index = Index()
    return _index


def _bounds(since: str | None, until: str | None) -> tuple[dt.datetime, dt.datetime]:
    """'2020', '2020-05' or '2020-05-17' -> [start, end) timestamps."""

    def parse(value: str, end: bool) -> dt.datetime:
        parts = [int(p) for p in value.strip().split("-")]
        if len(parts) == 1:
            return dt.datetime(parts[0] + end, 1, 1)
        if len(parts) == 2:
            y, m = parts[0], parts[1] + end
            return dt.datetime(y + (m > 12), (m - 1) % 12 + 1, 1)
        day = dt.datetime(*parts[:3])
        return day + dt.timedelta(days=1) if end else day

    start = parse(since, False) if since else dt.datetime(2006, 1, 1)
    stop = parse(until, True) if until else dt.datetime(2100, 1, 1)
    return start, stop


def _term_regex(term: str) -> str:
    """Whole-word match on a lowercased title that also works for 'c++' or '.net'.

    A trailing '*' makes it a prefix match: 'agent*' also finds 'agents', 'agentic'.
    """
    term = term.lower()
    if term.endswith("*"):
        return r"(^|[^a-z0-9])" + re.escape(term.rstrip("*"))
    return r"(^|[^a-z0-9])" + re.escape(term) + r"([^a-z0-9]|$)"


def _jsonable(rows: list[dict]) -> list[dict]:
    for row in rows:
        for key, value in row.items():
            if isinstance(value, (dt.datetime, dt.date)):
                row[key] = value.isoformat()
    return rows


@tool
def search_stories(
    query: str = "",
    since: str | None = None,
    until: str | None = None,
    min_score: int = 0,
    domain: str | None = None,
    include_text: bool = False,
    sort: Literal["score", "comments", "new", "old"] = "score",
    limit: int = 20,
) -> list[dict]:
    """Search archived HN stories by title words (all must match, case-insensitive).

    query: space-separated whole words; quote phrases, e.g. 'rust "memory safety"';
      end a word with * for prefix match ('agent*'). Empty query lists top
      stories for the period.
    since/until: 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' (inclusive).
    include_text: also match the body of Ask/Show HN posts.
    """
    start, stop = _bounds(since, until)
    where, params = ["time >= ?", "time < ?", "score >= ?"], [start, stop, min_score]
    for term in shlex.split(query):
        pattern = _term_regex(term)
        if include_text:
            where.append("(regexp_matches(lower(title), ?) OR regexp_matches(lower(text), ?))")
            params += [pattern, pattern]
        else:
            where.append("regexp_matches(lower(title), ?)")
            params.append(pattern)
    if domain:
        domain = domain.lower().removeprefix("www.")
        where.append("(domain = ? OR domain LIKE ?)")
        params += [domain, f"%.{domain}"]
    sql = f"""SELECT {STORY_COLS} FROM stories WHERE {' AND '.join(where)}
              ORDER BY {SORTS[sort]} LIMIT {min(max(limit, 1), 200)}"""
    return index().query(sql, params)


@tool
def topic_trend(
    terms: list[str],
    granularity: Literal["year", "month"] = "year",
    since: str | None = None,
    until: str | None = None,
) -> dict:
    """How often each term appears in story titles over time (whole-word match,
    trailing * for prefix match).

    Returns per-period story totals and, for each term, the number of matching
    stories and that count per 1,000 stories, so periods are comparable.
    Good for "rise and fall" charts, e.g. terms=["rust", "go", "zig"].
    """
    terms = [t for t in terms if t.strip()][:8]
    if not terms:
        raise ValueError("Give at least one term.")
    start, stop = _bounds(since, until)
    fmt = "%Y" if granularity == "year" else "%Y-%m"
    counts = ", ".join(
        f"count_if(regexp_matches(lower(title), ?)) AS t{i}" for i in range(len(terms)))
    rows = index().query(
        f"""SELECT strftime(date_trunc('{granularity}', time), '{fmt}') AS period,
                   count(*) AS stories, {counts}
            FROM stories WHERE time >= ? AND time < ?
            GROUP BY 1 ORDER BY 1""",
        [_term_regex(t) for t in terms] + [start, stop])
    series = []
    for row in rows:
        entry = {"period": row["period"], "stories": row["stories"]}
        for i, term in enumerate(terms):
            n = row[f"t{i}"]
            entry[term] = {"count": n, "per_1000": round(1000 * n / row["stories"], 2)}
        series.append(entry)
    summary = {}
    for term in terms:
        peak = max(series, key=lambda e: e[term]["per_1000"], default=None)
        summary[term] = {
            "total": sum(e[term]["count"] for e in series),
            "peak_period": peak and peak["period"],
            "peak_per_1000": peak and peak[term]["per_1000"],
        }
    return {"summary": summary, "series": series}


@tool
def domain_report(domain: str, top: int = 10) -> dict:
    """Track record of a website on HN: volume per year, score stats, best stories.

    Subdomains are included (e.g. 'github.com' also counts 'gist.github.com').
    Useful to judge a source, blog, product or competitor.
    """
    domain = re.sub(r"^https?://", "", domain.lower()).removeprefix("www.").split("/")[0]
    match, params = "(domain = ? OR domain LIKE ?)", [domain, f"%.{domain}"]
    ix = index()
    stats = ix.query(f"""
        SELECT count(*) AS stories,
               round(avg(score), 1) AS avg_score,
               median(score) AS median_score,
               round(100.0 * count_if(score >= 100) / greatest(count(*), 1), 1) AS pct_over_100,
               sum(comments) AS total_comments,
               strftime(min(time), '%Y-%m-%d') AS first_seen,
               strftime(max(time), '%Y-%m-%d') AS last_seen
        FROM stories WHERE {match}""", params)[0]
    by_year = ix.query(f"""
        SELECT year(time) AS year, count(*) AS stories, round(avg(score), 1) AS avg_score
        FROM stories WHERE {match} GROUP BY 1 ORDER BY 1""", params)
    best = ix.query(f"""SELECT {STORY_COLS} FROM stories WHERE {match}
                        ORDER BY score DESC LIMIT {min(max(top, 1), 50)}""", params)
    return {"domain": domain, **stats, "by_year": by_year, "top_stories": best}


@tool
def on_this_day(date: str | None = None, per_year: int = 1, min_score: int = 0) -> list[dict]:
    """The top stories posted on this calendar day in every year of HN history.

    date: 'MM-DD' (defaults to today, UTC). per_year: how many stories per year.
    Handy for "10 years ago today" content.
    """
    month, day = (map(int, date.split("-")) if date
                  else (dt.datetime.now(dt.UTC).month, dt.datetime.now(dt.UTC).day))
    return index().query(f"""
        SELECT year(time) AS year, {STORY_COLS} FROM stories
        WHERE month(time) = ? AND day(time) = ? AND score >= ?
        QUALIFY row_number() OVER (PARTITION BY year(time) ORDER BY score DESC) <= ?
        ORDER BY year, score DESC""", [month, day, min_score, min(max(per_year, 1), 10)])


@tool
def run_sql(sql: str, limit: int = 200) -> list[dict]:
    """Run one read-only DuckDB SELECT over the `stories` table for custom analysis.

    Columns: id UINTEGER, author VARCHAR, time TIMESTAMP (UTC), title VARCHAR,
    url VARCHAR, domain VARCHAR (no 'www.'), score INTEGER, comments INTEGER
    (total descendants), text VARCHAR (HTML body of Ask/Show HN posts, else NULL).
    Comments themselves are not in the index; use get_thread for those.
    """
    return _jsonable(index().select_only(sql, min(max(limit, 1), 1000)))


@tool
def get_thread(story_id: int, max_comments: int = 150, max_depth: int = 4,
               max_chars: int = 600) -> dict:
    """Fetch a story and its comment tree live from HN, in HN's ranking order.

    Each comment has its depth (0 = top level), author, direct reply count and
    plain text cut to max_chars. Use it to summarize a discussion or find the
    strongest arguments on each side.
    """
    return live.get_thread(story_id, max_comments=max_comments, max_depth=max_depth,
                           max_chars=max_chars)


@tool
def search_recent(query: str, days: int = 7, min_points: int = 0, limit: int = 20,
                  sort: Literal["points", "comments", "new"] = "points") -> list[dict]:
    """Search stories from the last N days live (Algolia HN Search).

    Use for anything newer than the local index (see index_status).
    """
    return live.search_recent(query, days=days, min_points=min_points,
                              limit=min(max(limit, 1), 100), sort=sort)


@tool
def index_status() -> dict:
    """What the local index covers: story count, first and last story time, data folder."""
    ix = index()
    row = ix.query("""SELECT count(*) AS stories,
                             strftime(min(time), '%Y-%m-%d %H:%M') AS first_story,
                             strftime(max(time), '%Y-%m-%d %H:%M') AS last_story
                      FROM stories""")[0]
    months = sorted(p.stem for p in ix.path.glob("*.parquet"))
    return {**row, "months": len(months), "data_dir": str(ix.path),
            "note": "Newer stories: use search_recent. Refresh with `hn-mcp sync`."}
