"""Export video data from the hn-mcp story index into src/data/*.json.

Run with the hn-mcp environment (HN_MCP_DATA pointing at the index):
    ../.venv/Scripts/python.exe scripts/export_data.py race
    ../.venv/Scripts/python.exe scripts/export_data.py onthisday --date 11-02
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

from hn_mcp import server

OUT = Path(__file__).resolve().parent.parent / "src" / "data"

# Name -> RE2 regex over lower(title). Plain "go" is mostly the verb, so Go
# only counts unambiguous forms; Swift keeps some noise (Taylor Swift, SWIFT).
LANGUAGES = {
    "Python": r"(^|[^a-z0-9])python([^a-z0-9]|$)",
    "JavaScript": r"(^|[^a-z0-9])(javascript|js|node\.?js)([^a-z0-9]|$)",
    "TypeScript": r"(^|[^a-z0-9])typescript([^a-z0-9]|$)",
    "Rust": r"(^|[^a-z0-9])rust([^a-z0-9]|$)",
    "Go": r"(^|[^a-z0-9])(golang|in go|go 1\.[0-9]+|go generics|go modules?)([^a-z0-9]|$)",
    "Java": r"(^|[^a-z0-9])java([^a-z0-9]|$)",
    "C++": r"(^|[^a-z0-9])c\+\+([^a-z0-9]|$)",
    "Ruby": r"(^|[^a-z0-9])(ruby|rails)([^a-z0-9]|$)",
    "PHP": r"(^|[^a-z0-9])php([^a-z0-9]|$)",
    "Swift": r"(^|[^a-z0-9])swift(ui)?([^a-z0-9]|$)",
    "Haskell": r"(^|[^a-z0-9])haskell([^a-z0-9]|$)",
    "Clojure": r"(^|[^a-z0-9])clojure([^a-z0-9]|$)",
    "Erlang/Elixir": r"(^|[^a-z0-9])(erlang|elixir)([^a-z0-9]|$)",
    "Zig": r"(^|[^a-z0-9])zig([^a-z0-9]|$)",
    "Kotlin": r"(^|[^a-z0-9])kotlin([^a-z0-9]|$)",
    "Lisp": r"(^|[^a-z0-9])(lisp|racket)([^a-z0-9]|$)",  # not "scheme": Ponzi/color scheme
}


def race(first_year: int, last_year: int) -> dict:
    names = list(LANGUAGES)
    counts = ", ".join(f"count_if(regexp_matches(lower(title), ?)) AS c{i}" for i in range(len(names)))
    rows = server.index().query(
        f"""SELECT year(time) AS year, count(*) AS stories, {counts}
            FROM stories WHERE year(time) BETWEEN ? AND ?
            GROUP BY 1 ORDER BY 1""",
        list(LANGUAGES.values()) + [first_year, last_year])
    frames = []
    for r in rows:
        frames.append({
            "label": str(r["year"]),
            "stories": r["stories"],
            "values": {n: round(1000 * r[f"c{i}"] / r["stories"], 2) for i, n in enumerate(names)},
            "counts": {n: r[f"c{i}"] for i, n in enumerate(names)},
        })
    return {"metric": "每千条 HN 帖子中标题提到该语言的条数", "frames": frames}


def onthisday(date: str, per_year: int) -> dict:
    this_year = dt.datetime.now(dt.UTC).year
    rows = [r for r in server.on_this_day(date, per_year=per_year) if r["year"] < this_year]
    for r in rows:  # the CJK font sets curly quotes full-width: "Musk’ s"
        r["title"] = r["title"].replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return {"date": date, "stories": rows}


def main() -> None:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("race")
    r.add_argument("--from", dest="first", type=int, default=2007)
    r.add_argument("--to", dest="last", type=int, default=dt.datetime.now(dt.UTC).year)
    o = sub.add_parser("onthisday")
    o.add_argument("--date", default=dt.datetime.now(dt.UTC).strftime("%m-%d"))
    o.add_argument("--per-year", type=int, default=3)
    args = p.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    if args.cmd == "race":
        out, data = OUT / "race.json", race(args.first, args.last)
    else:
        out, data = OUT / "onthisday-raw.json", onthisday(args.date, args.per_year)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
