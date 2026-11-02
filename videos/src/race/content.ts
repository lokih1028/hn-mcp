import raceData from "../data/race.json";
import { FPS } from "../theme";
import type { RaceFrame } from "./RaceChart";
import type { TechRaceProps } from "./TechRace";

// Editorial copy for the language race; the numbers come from
// src/data/race.json (scripts/export_data.py race).

const frames: RaceFrame[] = raceData.frames.map((f) => ({ label: f.label, values: f.values }));
const thisYear = String(new Date().getUTCFullYear());
const labelled = frames.map((f) => (f.label === thisYear ? { ...f, label: `${f.label}*` } : f));

const leaderOf = (f: RaceFrame) => Object.entries(f.values).sort((a, b) => b[1] - a[1])[0][0];
const last = frames[frames.length - 1];
const leader = leaderOf(last);
let streakStart = frames.length - 1;
while (streakStart > 0 && leaderOf(frames[streakStart - 1]) === leader) streakStart--;
const streak = frames.length - streakStart;

const ranking = Object.entries(last.values)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([name, value]) => ({ name, value }));

const storyCount = raceData.frames.reduce((sum, f) => sum + f.stories, 0);
const wan = Math.round(storyCount / 1e4); // 万 = 10,000

export const techRaceProps: TechRaceProps = {
  titleFrames: 3 * FPS,
  podiumFrames: 4 * FPS,
  hook: {
    kicker: `Hacker News · ${frames[0].label}–${last.label}`,
    title: "编程语言兴衰史",
    subtitle: `${wan} 万条帖子，谁被提到最多？`,
  },
  chart: {
    heading: "HN 顶流语言",
    metric: "每千条帖子中，标题提到该语言的条数",
    frames: labelled,
    framesPerStep: Math.round(1.6 * FPS),
    top: 10,
    events: [
      { label: "2007", text: "HN 本身就是用 Lisp 方言 Arc 写的" },
      { label: "2009", text: "Go 发布" },
      { label: "2012", text: "TypeScript 发布" },
      { label: "2014", text: "Swift 发布" },
      { label: "2015", text: "Rust 1.0 发布" },
    ],
  },
  podium: {
    kicker: `${frames[streakStart].label} 年首次登顶`,
    title: `${leader}\n连续 ${streak} 年第一`,
    ranking,
    note: last.label === thisYear ? `* ${thisYear} 年数据截至今天` : `数据截至 ${last.label} 年`,
  },
  outro: {
    kicker: "数据：Hacker News 全量帖子",
    title: "下一个顶流是谁？",
    subtitle: "评论区说说你在用什么语言",
  },
};
