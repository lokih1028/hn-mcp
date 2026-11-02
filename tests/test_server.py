import datetime as dt
import re

import duckdb
import pytest

from hn_mcp import server
from hn_mcp.index import SCHEMA, Index
from hn_mcp.live import clean_html
from mcp.server.mcpserver.exceptions import ToolError

ROWS = [
    # id, author, time, title, url, domain, score, comments, text
    (1, "a", "2015-03-01 10:00", "Rust 1.0 is out", "https://blog.rust-lang.org/x", "blog.rust-lang.org", 900, 300, None),
    (2, "b", "2015-03-02 10:00", "Can you trust this startup?", "https://example.com/t", "example.com", 50, 10, None),
    (3, "c", "2020-11-02 09:00", "Show HN: My AI agents framework", "https://github.com/c/agents", "github.com", 300, 80, None),
    (4, "d", "2021-11-02 09:00", "Ask HN: Is C++ still worth learning?", None, None, 120, 200, "<p>Asking about memory safety</p>"),
    (5, "e", "2021-11-02 12:00", "Agentic coding with Rust", "https://gist.github.com/e/1", "gist.github.com", 40, 5, None),
]


@pytest.fixture(autouse=True)
def fixture_index(tmp_path):
    con = duckdb.connect()
    con.execute("""CREATE TABLE s (id UINTEGER, author VARCHAR, time TIMESTAMP, title VARCHAR,
                   url VARCHAR, domain VARCHAR, score INTEGER, comments INTEGER, text VARCHAR)""")
    con.executemany("INSERT INTO s VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ROWS)
    con.execute(f"COPY s TO '{(tmp_path / '2015-03.parquet').as_posix()}' (FORMAT parquet)")
    server._index = Index(tmp_path)
    yield
    server._index = None


def ids(rows):
    return [r["id"] for r in rows]


def test_search_matches_whole_words_only():
    assert ids(server.search_stories("rust")) == [1, 5]  # not "trust"


def test_search_prefix_phrase_and_text():
    assert set(ids(server.search_stories("agent*"))) == {3, 5}
    assert ids(server.search_stories('"is c++"')) == [4]
    assert ids(server.search_stories('"memory safety"')) == []
    assert ids(server.search_stories('"memory safety"', include_text=True)) == [4]


def test_search_filters():
    assert ids(server.search_stories(since="2020", until="2020")) == [3]
    assert ids(server.search_stories(domain="www.github.com")) == [3, 5]  # subdomains too
    assert ids(server.search_stories(min_score=500)) == [1]
    assert ids(server.search_stories(sort="new", limit=2)) == [5, 4]
    assert server.search_stories("rust")[0]["hn_url"].endswith("item?id=1")


def test_bounds_month_rollover():
    assert server._bounds("2020-12", "2020-12") == (dt.datetime(2020, 12, 1), dt.datetime(2021, 1, 1))
    assert server._bounds(None, "2021-02-28")[1] == dt.datetime(2021, 3, 1)


def test_topic_trend():
    out = server.topic_trend(["rust", "c++"])
    assert out["summary"]["rust"] == {"total": 2, "peak_period": "2015", "peak_per_1000": 500.0}
    assert out["summary"]["c++"]["total"] == 1
    assert [r[0] for r in out["rows"]] == ["2015", "2020", "2021"]
    assert out["columns"][:4] == ["period", "stories", "rust", "rust per_1000"]
    assert out["rows"][0][:4] == ["2015", 2, 1, 500.0]


def test_domain_report():
    r = server.domain_report("https://github.com/foo")
    assert r["domain"] == "github.com"
    assert r["stories"] == 2
    assert ids(r["top_stories"]) == [3, 5]


def test_on_this_day():
    assert [(r["year"], r["id"]) for r in server.on_this_day("11-02")] == [(2020, 3), (2021, 4)]
    assert len(server.on_this_day("11-02", per_year=2)) == 3


def test_run_sql_is_read_only():
    assert server.run_sql("select count(*) n from stories") == [{"n": 5}]
    assert server.run_sql("select time from stories order by id", limit=1) == [{"time": "2015-03-01T10:00:00"}]
    for bad in ["delete from stories", "select 1; select 2", "copy stories to 'x.csv'"]:
        with pytest.raises(ToolError, match="single SELECT"):
            server.run_sql(bad)
    with pytest.raises(ToolError, match="Permission"):
        server.run_sql("select * from read_csv('pyproject.toml')")


def test_clean_html():
    raw = 'Hi<p>See <a href="https://x.com/a" rel="nofollow">https://x.com/a</a> &amp; <i>more</i>'
    assert clean_html(raw) == "Hi\n\nSee https://x.com/a & more"


def write_live(path, rows):
    con = duckdb.connect()
    con.execute(f"CREATE TABLE t ({SCHEMA})")
    if rows:
        con.executemany("INSERT INTO t VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
    con.execute(f"COPY t TO '{path.as_posix()}' (FORMAT parquet)")


def test_live_days_replace_archive_from_first_live_id(tmp_path):
    (tmp_path / "live").mkdir()
    # Fresher copy of story 4 (score 120 -> 999) plus a story newer than the archive.
    write_live(tmp_path / "live" / "2021-11-02.parquet", [
        (4, "d", "2021-11-02 09:00", "Ask HN: Is C++ still worth learning?", None, None, 999, 250, None),
        (6, "f", "2021-11-03 08:00", "Rust in the kernel", None, None, 10, 1, None),
    ])
    write_live(tmp_path / "live" / "2021-11-04.parquet", [])  # a day with no stories
    server._index = Index(tmp_path)
    assert server.run_sql("select count(*) n from stories") == [{"n": 5}]  # 1-3 archive, 4 & 6 live
    assert ids(server.search_stories("rust")) == [1, 6]  # archived 5 dropped: id >= first live id
    assert server.search_stories('"is c++"')[0]["score"] == 999


def test_empty_live_dir_keeps_archive(tmp_path):
    (tmp_path / "live").mkdir()
    write_live(tmp_path / "live" / "2021-11-04.parquet", [])
    server._index = Index(tmp_path)
    assert server.run_sql("select count(*) n from stories") == [{"n": 5}]


def test_fetch_stories_splits_full_windows(monkeypatch):
    from hn_mcp import live

    calls = []

    class Resp:
        def __init__(self, body):
            self.body = body

        def raise_for_status(self):
            return self

        def json(self):
            return self.body

    def fake_get(url, params):
        lo, hi = map(int, re.findall(r"\d+",params["numericFilters"]))
        calls.append((lo, hi))
        stories = [t for t in range(0, 10_000, 1000) if lo <= t < hi]  # 10 stories
        hits = [{"objectID": str(t + 1), "created_at_i": t, "title": f"s{t}",
                 "url": "https://www.Example.com/x"} for t in stories[:4]]  # cap of 4
        return Resp({"nbHits": len(stories), "hits": hits})

    monkeypatch.setattr(live, "ALGOLIA_MAX_HITS", 4)
    monkeypatch.setattr(live._client, "get", fake_get)
    rows = live.fetch_stories(0, 10_000)
    assert sorted(r[0] for r in rows) == [t + 1 for t in range(0, 10_000, 1000)]
    assert rows[0][5] == "example.com"
    assert len(calls) > 1
