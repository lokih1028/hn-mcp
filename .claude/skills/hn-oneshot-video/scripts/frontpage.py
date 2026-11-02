"""Export the HN front page of a past day as the phone/screen texture data.

Run from the hn-mcp repo root:
    uv run python .claude/skills/hn-oneshot-video/scripts/frontpage.py \
        --date 2017-11-03 --until 21:30 --out videos/src/shots/<slug>/frontpage.json

Writes the day's top stories posted before --until, ranked by score, in the
shape textures.ts expects: title, domain, score, comments, author, hours (ago).
"""

import argparse
import datetime as dt
import json
from pathlib import Path

import duckdb


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", required=True, help="YYYY-MM-DD")
    ap.add_argument("--until", default="21:30", help="HH:MM; the moment the page is viewed")
    ap.add_argument("--limit", type=int, default=12)
    ap.add_argument("--out", required=True)
    ap.add_argument("--stories", default="data/stories", help="local index directory")
    a = ap.parse_args()

    day = dt.date.fromisoformat(a.date)
    now = dt.datetime.combine(day, dt.time.fromisoformat(a.until))
    month = Path(a.stories) / f"{day:%Y-%m}.parquet"
    rows = duckdb.connect().execute(
        "select title, domain, score, comments, author, time from read_parquet(?) "
        "where time between ? and ? order by score desc limit ?",
        [str(month), dt.datetime.combine(day, dt.time()), now, a.limit],
    ).fetchall()
    items = [
        dict(
            title=t,
            domain=d,
            score=s,
            comments=c,
            author=au,
            hours=max(1, round((now - tm).total_seconds() / 3600)),
        )
        for t, d, s, c, au, tm in rows
    ]
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(items)} stories -> {out}")


if __name__ == "__main__":
    main()
