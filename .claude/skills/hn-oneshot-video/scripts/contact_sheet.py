"""Tile evenly spaced frames of a rendered MP4 into one contact sheet PNG.

    python -I .claude/skills/hn-oneshot-video/scripts/contact_sheet.py <video.mp4> [--count 20] [--cols 10]

Remotion's bundled ffmpeg lacks the fps/select/scale/tile filters, so each frame
is grabbed with -ss and the tiling is done with PIL. Run from the hn-mcp repo
root; ffmpeg/ffprobe are called through `npx remotion` inside videos/.
"""

import argparse
import os
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

VIDEOS = Path(__file__).resolve().parents[4] / "videos"


def remotion(*args: str) -> str:
    return subprocess.run(
        # npx is npx.cmd on Windows, which needs a shell to run
        ["npx", "remotion", *args], cwd=VIDEOS, capture_output=True, text=True, check=True, shell=os.name == "nt"
    ).stdout


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--cols", type=int, default=10)
    ap.add_argument("--out", help="defaults to <video>-sheet.png")
    a = ap.parse_args()

    video = Path(a.video).resolve()
    duration = float(remotion("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(video)).strip())
    times = [duration * (i + 0.5) / a.count for i in range(a.count)]
    w, h = 216, 384
    rows = -(-a.count // a.cols)
    sheet = Image.new("RGB", (a.cols * (w + 4), rows * (h + 4)), "#000")
    with tempfile.TemporaryDirectory() as tmp:
        for i, t in enumerate(times):
            png = Path(tmp) / f"{i}.png"
            remotion("ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1", str(png))
            im = Image.open(png).convert("RGB").resize((w, h))
            ImageDraw.Draw(im).text((4, 4), f"{t:.1f}s", fill="yellow")
            sheet.paste(im, ((i % a.cols) * (w + 4), (i // a.cols) * (h + 4)))
    out = Path(a.out) if a.out else video.with_name(video.stem + "-sheet.png")
    sheet.save(out)
    print(out)


if __name__ == "__main__":
    main()
