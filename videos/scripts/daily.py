"""Daily "HN on this day" video: prepare candidates, then validate and render.

    python scripts/daily.py prepare [--date 2026-11-03]   # sync index, write candidates.json
    (an editor - person or Claude - writes curated.json next to it)
    python scripts/daily.py images  [--date 2026-11-03]   # one Grok image per story (cached)
    python scripts/daily.py render  [--date 2026-11-03]   # validate, merge, render the MP4

Everything for one day lives in videos/out/daily/<date>/. curated.json only names
story ids, Chinese titles and image prompts; scores, comments and domains are
merged in from candidates.json so they cannot drift from the data. `render`
makes the 3D TimeTunnel video; `render --classic` the flat TimeMachine one.
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
IMG_STYLE = ("warm orange and deep teal lighting, cinematic volumetric light, subtle film grain, "
             "no text, no logos, no people")
TUNNEL_TIMING = {"hookFrames": 3 * FPS, "travelFrames": round(1.2 * FPS), "holdFrames": round(3.4 * FPS),
                 "outroFrames": 3 * FPS}


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
        img = (pick.get("img") or "").strip()
        if not img:
            problems.append(f"{src['year']}: img (image prompt) is empty")
        elif len(img) > 400:
            problems.append(f"{src['year']}: img prompt is {len(img)} characters (max 400)")
        stories.append({"year": src["year"], "title": src["title"], "zh": zh, "score": src["score"],
                        "comments": src["comments"], "domain": src["domain"], "img": img})

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


def load_props(date: dt.date) -> dict:
    folder = day_dir(date)
    candidates = json.loads((folder / "candidates.json").read_text(encoding="utf-8"))
    curated = json.loads((folder / "curated.json").read_text(encoding="utf-8"))
    props, problems = build_props(date, candidates, curated)
    if problems:
        sys.exit("curated.json needs fixes:\n- " + "\n- ".join(problems))
    return props


def images(date: dt.date) -> Path:
    """Generate one 9:16 Grok image per story; existing images are kept."""
    folder = day_dir(date) / "img"
    folder.mkdir(exist_ok=True)
    failed = []
    for story in load_props(date)["stories"]:
        out = folder / f"{story['year']}.png"
        for _ in range(2):  # one retry
            if out.exists():
                break
            result = subprocess.run(
                [shutil.which("grok-cli") or "grok-cli", "image", "--json", "--prompt",
                 f"{story['img']}, {IMG_STYLE}", "--aspect-ratio", "9:16", "--response-format", "b64_json",
                 "--output-file", str(out)],
                capture_output=True, text=True, encoding="utf-8")
            if not out.exists():
                print(f"{story['year']}: {result.stdout.strip() or result.stderr.strip()}", flush=True)
        if not out.exists():
            failed.append(story["year"])
    if failed:
        print(f"no image for {failed}; those portals stay dark. Fix the error and run images again.")
    return folder


def render(date: dt.date, classic: bool = False) -> Path:
    folder = day_dir(date)
    props = load_props(date)
    if classic:
        composition, out = "TimeMachine", folder / f"hn-time-machine-{date.strftime('%m-%d')}.mp4"
    else:
        # Remotion serves images from public/ and bundles it on every render: keep only today's.
        public = VIDEOS / "public" / "daily"
        shutil.rmtree(public, ignore_errors=True)
        (public / date.isoformat()).mkdir(parents=True)
        for story in props["stories"]:
            src = folder / "img" / f"{story['year']}.png"
            story["image"] = None
            if src.exists():
                shutil.copy(src, public / date.isoformat() / src.name)
                story["image"] = f"daily/{date.isoformat()}/{src.name}"
        props = {k: v for k, v in props.items() if k not in ("titleFrames", "cardFrames")}
        props["timing"] = TUNNEL_TIMING
        composition, out = "TimeTunnel", folder / f"hn-time-tunnel-{date.strftime('%m-%d')}.mp4"
    (folder / "props.json").write_text(json.dumps(props, ensure_ascii=False, indent=2), encoding="utf-8")
    subprocess.run([shutil.which("npx") or "npx", "remotion", "render", composition, str(out),
                    f"--props={folder / 'props.json'}", "--gl=angle", "--log=error"], cwd=VIDEOS, check=True)
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["prepare", "images", "render"])
    p.add_argument("--date", type=dt.date.fromisoformat, default=dt.date.today(),
                   help="local calendar date, default today")
    p.add_argument("--classic", action="store_true", help="render: flat TimeMachine instead of the 3D tunnel")
    args = p.parse_args()
    if args.command == "prepare":
        print(prepare(args.date))
    elif args.command == "images":
        print(images(args.date))
    else:
        print(render(args.date, classic=args.classic))


if __name__ == "__main__":
    main()
