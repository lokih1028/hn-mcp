# hn-mcp videos

Vertical (1080×1920, 30 fps) short videos made with [Remotion](https://www.remotion.dev/)
from the hn-mcp story index.

| Composition | What it shows | Data |
|---|---|---|
| `TechRace` | Bar chart race of programming languages in HN titles, per 1,000 stories, 2007 → today | `src/data/race.json` |
| `TimeMachine` | "HN on this day": the top story of one calendar day in past years | `src/data/onthisday.json` |

Scenes are also registered on their own under the `Scenes` folder in the Studio.

## Setup

```bash
npm i
```

The export script runs with the hn-mcp Python environment (`../.venv`) and reads the
index from `HN_MCP_DATA`.

## Language race

```bash
../.venv/Scripts/python.exe scripts/export_data.py race     # writes src/data/race.json
npx remotion render TechRace out/hn-tech-race.mp4
```

Copy lives in `src/race/content.ts`; the verdict ("X 连续 N 年第一") is computed from the
data. Language patterns are in `scripts/export_data.py` (`LANGUAGES`).

## On this day, daily

Renders pick WebGL on the GPU (`angle`) when there is one and fall back to the CPU
(`swangle`, the same picture, about 15x slower) on a Linux machine without one; set
`HN_GL=angle|swangle` to force either (see `remotion.config.ts`).

The daily video is a one-shot, code-only film of one story's subject: a device, the
interface of the time, a process or a scene (the first one: the iPhone X teardown in
`src/spike/`). The whole process lives in the Claude Code
skill `.claude/skills/hn-oneshot-video/`, so "make today's HN video" in a Claude Code
session in this repo follows it. It starts from the candidates that
`scripts/daily.py` writes:

```bash
../.venv/Scripts/python.exe scripts/daily.py prepare   # refresh index, write out/daily/<date>/candidates.json
```

## On this day, by hand

1. Refresh the index: `../.venv/Scripts/python.exe -m hn_mcp sync --live-only`
2. Export candidates: `../.venv/Scripts/python.exe scripts/export_data.py onthisday --date 11-02`
   (writes `src/data/onthisday-raw.json`, the top 3 stories of that day per year)
3. Curate `src/data/onthisday.json`: pick 8–10 years spread across HN's history, write a
   short Chinese title `zh` for each, set `currentYear` and the hook date. Break `zh`
   by hand with `\n` (at most ~11 CJK characters per line), since automatic wrapping
   splits Chinese words.
4. Preview with `npx remotion studio`, render with
   `npx remotion render TimeMachine out/hn-time-machine-11-02.mp4`.
