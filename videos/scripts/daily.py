"""Daily "HN on this day" video: prepare candidates, then validate and render.

    python scripts/daily.py prepare [--date 2026-11-03]   # sync index, write candidates.json
    (an editor - person or Claude - writes curated.json next to it)
    python scripts/daily.py render  [--date 2026-11-03]   # validate, merge, render the MP4

Everything for one day lives in videos/out/daily/<date>/. curated.json only names
story ids and Chinese titles; scores, comments and domains are merged in from
candidates.json so they cannot drift from the data.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

VIDEOS = Path(__file__).resolve().parent.parent
os.environ.setdefault("HN_MCP_DATA", str(VIDEOS.parent / "data"))

FPS = 30
ZH_LINE_EM = 11.5  # 72px title in the 796px card
MIN_STORIES, MAX_STORIES = 6, 10


def day_dir(date: dt.date) -> Path:
    path = VIDEOS / "out" / "daily" / date.isoformat()
    path.mkdir(parents=True, exist_ok=True)
    return path


def em_width(text: str) -> float:
    """Approximate rendered width in ems for Noto Sans SC bold."""
    width = 0.0
    for ch in text:
        if unicodedata.east_asian_width(ch) in "WF":
            width += 1.0
        elif ch == " ":
            width += 0.25
        elif ch.isupper() or ch.isdigit():
            width += 0.6
        else:
            width += 0.5
    return width


def prepare(date: dt.date) -> Path:
    from hn_mcp.index import sync_live
    from hn_mcp import server

    print(sync_live(log=lambda m: None), flush=True)
    rows = server.on_this_day(date.strftime("%m-%d"), per_year=3)
    stories = [
        {**r, "title": r["title"].replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')}
        for r in rows if r["year"] < date.year
    ]
    out = day_dir(date) / "candidates.json"
    out.write_text(json.dumps({"date": date.isoformat(), "currentYear": date.year, "stories": stories},
                              ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def build_props(date: dt.date, candidates: dict, curated: dict) -> tuple[dict, list[str]]:
    """Merge curated picks with candidate data; returns (props, problems)."""
    problems: list[str] = []
    by_id = {s["id"]: s for s in candidates["stories"]}
    stories = []
    for pick in curated.get("stories", []):
        src = by_id.get(pick.get("id"))
        if src is None:
            problems.append(f"story id {pick.get('id')} is not in candidates.json")
            continue
        zh = (pick.get("zh") or "").strip()
        lines = zh.split("\n")
        if not zh:
            problems.append(f"{src['year']}: zh is empty")
        elif len(lines) > 3:
            problems.append(f"{src['year']}: zh has {len(lines)} lines (max 3)")
        for line in lines:
            if em_width(line) > ZH_LINE_EM:
                problems.append(f"{src['year']}: line too wide ({em_width(line):.1f} > {ZH_LINE_EM} em), "
                                f"add a \\n: {line!r}")
        stories.append({"year": src["year"], "title": src["title"], "zh": zh, "score": src["score"],
                        "comments": src["comments"], "domain": src["domain"]})

    years = [s["year"] for s in stories]
    if not MIN_STORIES <= len(stories) <= MAX_STORIES:
        problems.append(f"{len(stories)} stories picked, need {MIN_STORIES}-{MAX_STORIES}")
    if years != sorted(set(years)):
        problems.append(f"years must be distinct and oldest first, got {years}")

    span = date.year - min(years) if years else 0
    hook = {"kicker": f"{date.month} 月 {date.day} 日", "title": "HN 上的今天",
            "subtitle": f"{span} 年来的这一天，HN 在聊什么？", **curated.get("hook", {})}
    outro = {"kicker": "数据：Hacker News 历史存档", "title": "你最怀念哪一年？",
             "subtitle": "明天同一时间，继续翻 HN 的老黄历", **curated.get("outro", {})}
    for name, card in (("hook", hook), ("outro", outro)):
        if em_width(card["title"]) > 8:
            problems.append(f"{name}.title too wide for one line: {card['title']!r}")
        if em_width(card.get("subtitle", "")) > 16.5:
            problems.append(f"{name}.subtitle too wide for one line: {card['subtitle']!r}")

    props = {"currentYear": date.year, "hook": hook, "stories": stories, "outro": outro,
             "titleFrames": 3 * FPS, "cardFrames": round(3.5 * FPS)}
    return props, problems


def render(date: dt.date) -> Path:
    folder = day_dir(date)
    candidates = json.loads((folder / "candidates.json").read_text(encoding="utf-8"))
    curated = json.loads((folder / "curated.json").read_text(encoding="utf-8"))
    props, problems = build_props(date, candidates, curated)
    if problems:
        sys.exit("curated.json needs fixes:\n- " + "\n- ".join(problems))
    (folder / "props.json").write_text(json.dumps(props, ensure_ascii=False, indent=2), encoding="utf-8")
    out = folder / f"hn-time-machine-{date.strftime('%m-%d')}.mp4"
    subprocess.run([shutil.which("npx") or "npx", "remotion", "render", "TimeMachine", str(out),
                    f"--props={folder / 'props.json'}", "--log=error"], cwd=VIDEOS, check=True)
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["prepare", "render"])
    p.add_argument("--date", type=dt.date.fromisoformat, default=dt.date.today(),
                   help="local calendar date, default today")
    args = p.parse_args()
    print(prepare(args.date) if args.command == "prepare" else render(args.date))


if __name__ == "__main__":
    main()
