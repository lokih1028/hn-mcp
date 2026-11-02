---
name: hn-daily-video
description: Make today's "HN 上的今天" (HN on this day) vertical video - refresh the HN index, pick one top story per past year, write Chinese titles, render the MP4. Use for the daily time-machine video or when asked for the on-this-day video of a given date.
---

# HN 上的今天 - daily video

Produces `videos/out/daily/<date>/hn-time-machine-<MM-DD>.mp4` (1080x1920, ~35 s)
from the hn-mcp story index. Work from the repo root `G:\Hacker\hn-mcp`. The date is
today's local date unless the user names one (`--date YYYY-MM-DD`).

## 1. Prepare

```bash
cd videos && ../.venv/Scripts/python.exe scripts/daily.py prepare
```

This refreshes recent days of the index from Algolia and writes
`out/daily/<date>/candidates.json`: the top 3 stories of this calendar day for every
past year (id, year, title, score, comments, domain). If it fails, stop and report the
error - do not invent stories.

## 2. Curate (your job)

Read `candidates.json` and write `out/daily/<date>/curated.json`:

```json
{
  "stories": [
    {"id": 351367, "zh": "Digg 网站源码里\n藏着一条秘密留言"},
    {"id": 1849022, "zh": "同一局 Pong\n左边 Flash，右边 HTML5"}
  ]
}
```

Picking stories:
- 8 or 9 stories (6-10 allowed), at most one per year, oldest first.
- Spread them over HN's history: include early years (2007-2011), the middle and the
  last few years, so the "N 年前" counter covers a wide range.
- Prefer stories a Chinese developer audience will recognise or find surprising in
  hindsight: product launches, famous people, predictions, industry turning points,
  nostalgic tech (Flash, Digg, early iPhone). Among a year's three, the highest score
  is not always the best pick.
- Skip recurring threads ("Who is hiring?", "Remind HN: Vote"), meta posts about HN,
  and anything tragic, graphic or politically charged.

Writing `zh`:
- A short Chinese headline, not a literal translation: at most ~20 characters, keep
  product and people names in their usual form (MacBook, Linux, 马斯克, SBF).
- State only what the title says. Do not add facts that are not in it.
- Break lines yourself with `\n` at natural phrase boundaries, at most ~11 Chinese
  characters per line and 3 lines. Automatic wrapping would split words.
- No English curly quotes.

Optional overrides (defaults are fine): `"hook": {"subtitle": ...}`,
`"outro": {"title": ..., "subtitle": ...}`, each one short line.

## 3. Render

```bash
cd videos && ../.venv/Scripts/python.exe scripts/daily.py render
```

It validates `curated.json` (ids exist, line widths, years in order), merges scores,
comments and domains from the candidates, and renders. If it prints "curated.json
needs fixes", fix exactly those items and run it again.

## 4. Check and report

- Grab two frames and look at them:
  `ffmpeg -v error -y -i <mp4> -vf "select='eq(n\,45)+eq(n\,400)',scale=360:-1,tile=2x1" -frames:v 1 out/daily/<date>/check.png`
  Look for text running off the card or broken line wraps; fix `zh` and re-render if so.
- Report the MP4 path, its length, and the list of years with their Chinese titles.
  Send the MP4 to the user with SendUserFile when that tool is available.
- Do not publish or upload the video anywhere.
