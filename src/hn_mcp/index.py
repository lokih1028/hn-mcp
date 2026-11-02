"""Local story index built from the open-index/hacker-news Parquet archive.

Each archive month is reduced to its stories (title, url, score, ...) and
cached as one small Parquet file, so analytics run offline in DuckDB.
"""

from __future__ import annotations

import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import duckdb
import httpx

DATASET = "open-index/hacker-news"
HF_TREE = f"https://huggingface.co/api/datasets/{DATASET}/tree/main/data"
HF_FILE = f"hf://datasets/{DATASET}/data"

DOMAIN_RE = r"^https?://(?:www\.)?([^/:?#]+)"


def data_dir() -> Path:
    path = Path(os.environ.get("HN_MCP_DATA", Path.home() / ".hn-mcp")).expanduser()
    path.mkdir(parents=True, exist_ok=True)
    return path


def stories_dir() -> Path:
    path = data_dir() / "stories"
    path.mkdir(parents=True, exist_ok=True)
    return path


def remote_months() -> list[str]:
    """List archive months available on Hugging Face, e.g. ['2006-10', ...]."""
    with httpx.Client(follow_redirects=True, timeout=60) as client:
        years = [e["path"].rsplit("/", 1)[1] for e in client.get(HF_TREE).raise_for_status().json()
                 if e["type"] == "directory"]
        months = []
        for year in sorted(years):
            for e in client.get(f"{HF_TREE}/{year}").raise_for_status().json():
                m = re.search(r"(\d{4}-\d{2})\.parquet$", e["path"])
                if m:
                    months.append(m.group(1))
    return sorted(months)


def _remote_connection() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET TimeZone = 'UTC'; SET enable_progress_bar = false;")
    return con


def sync_month(month: str, con: duckdb.DuckDBPyConnection | None = None) -> int:
    """Extract one month's stories into the local cache; returns the story count."""
    con = con or _remote_connection()
    year = month[:4]
    out = stories_dir() / f"{month}.parquet"
    tmp = out.with_suffix(".tmp")
    con.execute(f"""
        COPY (
            SELECT id, "by" AS author, time::TIMESTAMP AS time, title,
                   nullif(url, '') AS url,
                   nullif(regexp_extract(lower(url), '{DOMAIN_RE}', 1), '') AS domain,
                   coalesce(score, 0) AS score,
                   coalesce(descendants, 0) AS comments,
                   nullif(text, '') AS text
            FROM read_parquet('{HF_FILE}/{year}/{month}.parquet')
            WHERE type = 1 AND coalesce(deleted, 0) = 0 AND coalesce(dead, 0) = 0
              AND title IS NOT NULL AND title <> ''
            ORDER BY id
        ) TO '{tmp.as_posix()}' (FORMAT parquet, COMPRESSION zstd)
    """)
    os.replace(tmp, out)
    return con.execute(f"SELECT count(*) FROM '{out.as_posix()}'").fetchone()[0]


def sync(from_month: str | None = None, workers: int = 4, refresh_latest: bool = True,
         log=print) -> dict:
    """Fetch every missing month (and re-fetch the newest one, which may have been partial)."""
    months = remote_months()
    if from_month:
        months = [m for m in months if m >= from_month]
    cached = {p.stem for p in stories_dir().glob("*.parquet")}
    todo = [m for m in months if m not in cached]
    if refresh_latest and months and months[-1] not in todo:
        todo.append(months[-1])
    log(f"{len(months)} months in archive, {len(todo)} to fetch")

    local = threading.local()
    done, total = 0, 0
    failed: list[str] = []

    def work(month: str) -> int:
        if not hasattr(local, "con"):
            local.con = _remote_connection()
        return sync_month(month, local.con)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(work, m): m for m in todo}
        for fut in as_completed(futures):
            month = futures[fut]
            try:
                n = fut.result()
                total += n
                done += 1
                log(f"[{done}/{len(todo)}] {month}: {n} stories")
            except Exception as exc:  # keep going; a rerun picks up failed months
                failed.append(month)
                log(f"[fail] {month}: {exc}")
    return {"fetched": done, "stories": total, "failed": sorted(failed)}


class Index:
    """Read-only query handle over the cached stories."""

    def __init__(self, path: Path | None = None):
        self.path = path or stories_dir()
        self.con = duckdb.connect()
        files = list(self.path.glob("*.parquet"))
        if not files:
            raise FileNotFoundError(
                f"No story index in {self.path}. Run `hn-mcp sync` first.")
        self.con.execute(f"""
            CREATE VIEW stories AS
            SELECT * FROM read_parquet('{self.path.as_posix()}/*.parquet')
        """)
        # Sandbox: the connection may only read the index, so agent-written SQL
        # cannot touch other files, install extensions or loosen these settings.
        self.con.execute(f"SET allowed_directories = ['{self.path.as_posix()}/']")
        self.con.execute("SET enable_external_access = false")
        self.con.execute("SET lock_configuration = true")
        self.lock = threading.Lock()

    def query(self, sql: str, params: list | None = None) -> list[dict]:
        with self.lock:
            cur = self.con.cursor()
            cur.execute(sql, params or [])
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]

    def select_only(self, sql: str, limit: int) -> list[dict]:
        """Run untrusted SQL: exactly one SELECT statement, row-capped."""
        statements = self.con.extract_statements(sql)
        if len(statements) != 1 or statements[0].type != duckdb.StatementType.SELECT:
            raise ValueError("Only a single SELECT (or WITH ... SELECT) statement is allowed.")
        body = sql.strip().rstrip(";")
        return self.query(f"SELECT * FROM ({body}) LIMIT {int(limit)}")
