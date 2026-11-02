"""Local story index built from the open-index/hacker-news Parquet archive.

Each archive month is reduced to its stories (title, url, score, ...) and
cached as one small Parquet file, so analytics run offline in DuckDB.
Days after the archive, and the recent months whose archived scores were
captured at posting time, come from Algolia as one file per day in stories/live/.
"""

from __future__ import annotations

import datetime as dt
import os
import re
import threading
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import duckdb
import httpx

DATASET = "open-index/hacker-news"
HF_TREE = f"https://huggingface.co/api/datasets/{DATASET}/tree/main/data"
HF_FILE = f"hf://datasets/{DATASET}/data"

DOMAIN_RE = r"^https?://(?:www\.)?([^/:?#]+)"

# From here on the archive stores each story's score and comment count as of
# posting time (Jan-Jul 2026 average ~2 points vs ~19 before), so live days
# from Algolia replace it.
ARCHIVE_STALE_FROM = dt.date(2025, 12, 1)

SCHEMA = """id UINTEGER, author VARCHAR, time TIMESTAMP, title VARCHAR, url VARCHAR,
            domain VARCHAR, score INTEGER, comments INTEGER, text VARCHAR"""


def data_dir() -> Path:
    path = Path(os.environ.get("HN_MCP_DATA", Path.home() / ".hn-mcp")).expanduser()
    path.mkdir(parents=True, exist_ok=True)
    return path


def stories_dir() -> Path:
    path = data_dir() / "stories"
    path.mkdir(parents=True, exist_ok=True)
    return path


def live_dir() -> Path:
    path = stories_dir() / "live"
    path.mkdir(parents=True, exist_ok=True)
    return path


SNAPSHOT_URL = os.environ.get(
    "HN_MCP_SNAPSHOT_URL",
    "https://github.com/lokih1028/hn-mcp/releases/latest/download/hn-index.zip")


def pack(out: Path) -> int:
    """Zip the whole story index (archive months + live days) for a release."""
    files = sorted(stories_dir().rglob("*.parquet"))
    with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as zf:  # Parquet is already zstd
        for f in files:
            zf.write(f, f.relative_to(data_dir()).as_posix())
    return len(files)


def download_snapshot(url: str = SNAPSHOT_URL, log=print) -> int:
    """Fetch a prebuilt index zip and unpack it into the data folder."""
    tmp = data_dir() / "snapshot.zip.part"
    with httpx.stream("GET", url, follow_redirects=True, timeout=60) as resp:
        resp.raise_for_status()
        size, done, shown = int(resp.headers.get("content-length", 0)), 0, -1
        with open(tmp, "wb") as fh:
            for chunk in resp.iter_bytes(1 << 20):
                fh.write(chunk)
                done += len(chunk)
                pct = done * 100 // size if size else -1
                if pct // 10 != shown:
                    shown = pct // 10
                    log(f"[snapshot] {done >> 20} MB" + (f" ({pct}%)" if size else ""))
    root = data_dir().resolve()
    with zipfile.ZipFile(tmp) as zf:
        names = [n for n in zf.namelist() if n.startswith("stories/") and n.endswith(".parquet")]
        for name in names:
            if not (root / name).resolve().is_relative_to(root):  # zip-slip guard
                raise ValueError(f"Unsafe path in snapshot: {name}")
        zf.extractall(root, members=names)
    tmp.unlink()
    return len(names)


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


def write_day(day: dt.date, rows: list[tuple]) -> None:
    out = live_dir() / f"{day.isoformat()}.parquet"
    tmp = out.with_suffix(".tmp")
    con = duckdb.connect()
    con.execute(f"CREATE TABLE day ({SCHEMA})")
    if rows:
        con.executemany("INSERT INTO day VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
    con.execute(f"COPY (SELECT * FROM day ORDER BY id) TO '{tmp.as_posix()}' "
                "(FORMAT parquet, COMPRESSION zstd)")
    con.close()
    os.replace(tmp, out)


def sync_live(overlap_days: int = 7, refresh_days: int = 3, log=print) -> dict:
    """Fill the days after the archive from Algolia, one file per UTC day.

    The first run starts `overlap_days` before the archive ends; later runs
    re-fetch the last `refresh_days` days so recent scores keep settling.
    """
    from .live import fetch_stories

    today = dt.datetime.now(dt.UTC).date()
    if any(stories_dir().glob("*.parquet")):
        last = duckdb.connect().execute(
            f"SELECT max(time) FROM read_parquet('{stories_dir().as_posix()}/*.parquet')"
        ).fetchone()[0]
        first = min(last.date() - dt.timedelta(days=overlap_days), ARCHIVE_STALE_FROM)
    else:
        first = today - dt.timedelta(days=30)

    # Fetch every missing day from `first` on, plus the most recent days again.
    have = {dt.date.fromisoformat(p.stem) for p in live_dir().glob("*.parquet")}
    refresh_from = max(have) - dt.timedelta(days=refresh_days) if have else first
    todo = [first + dt.timedelta(days=i) for i in range((today - first).days + 1)]
    todo = [d for d in todo if d not in have or d >= refresh_from]

    total = 0
    for day in todo:
        start = int(dt.datetime.combine(day, dt.time(), dt.UTC).timestamp())
        # A busy day tops Algolia's 1000-hit cap, so ask for half days up front.
        rows = fetch_stories(start, start + 43200) + fetch_stories(start + 43200, start + 86400)
        write_day(day, rows)
        total += len(rows)
        log(f"[live] {day}: {len(rows)} stories")
    return {"live_from": first.isoformat(), "live_to": today.isoformat(),
            "days_fetched": len(todo), "stories": total}


class Index:
    """Read-only query handle over the cached stories."""

    def __init__(self, path: Path | None = None):
        self.path = path or stories_dir()
        self.con = duckdb.connect()
        archive = f"read_parquet('{self.path.as_posix()}/*.parquet')"
        live = f"read_parquet('{self.path.as_posix()}/live/*.parquet')"
        has_archive = any(self.path.glob("*.parquet"))
        has_live = any(self.path.glob("live/*.parquet"))
        if not has_archive and not has_live:
            raise FileNotFoundError(
                f"No story index in {self.path}. Run `hn-mcp sync` first.")
        # HN ids grow with time, so live days replace every archived story from
        # the first live id on (the overlap week has fresher scores there).
        parts = []
        if has_archive:
            cutoff = (f"WHERE id < (SELECT coalesce(min(id), 4294967295) FROM {live})"
                      if has_live else "")
            parts.append(f"SELECT * FROM {archive} {cutoff}")
        if has_live:
            parts.append(f"SELECT * FROM {live}")
        self.con.execute(f"CREATE VIEW stories AS {' UNION ALL BY NAME '.join(parts)}")
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
