import type { FrontPageItem } from "../../spike/textures";

// The 2011 desktop: a 1680 x 1050 screen showing Chrome (Windows 7 era) with
// either the HN front page or Google's results for "do a barrel roll".
// Everything is drawn in logical screen pixels and rasterised at S x.

export const S = 2;
export const SCREEN_W = 1680;
export const SCREEN_H = 1050;
export const CHROME_H = 64; // tab strip + toolbar
export const VIEW_H = SCREEN_H - CHROME_H;

type Ctx = CanvasRenderingContext2D;
type Rect = { x: number; y: number; w: number; h: number }; // viewport px

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(w * S);
  c.height = Math.round(h * S);
  const ctx = c.getContext("2d")!;
  ctx.scale(S, S);
  return { c, ctx };
};

const text = (ctx: Ctx, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") => {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
};

// ---------------------------------------------------------------- browser

export const drawChrome = (ctx: Ctx, tab: string, url: string, favicon: "hn" | "google") => {
  const g = ctx.createLinearGradient(0, 0, 0, 30);
  g.addColorStop(0, "#b9cde5");
  g.addColorStop(1, "#a9bfdc");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCREEN_W, 30);
  // tab
  ctx.fillStyle = "#f3f6fb";
  ctx.beginPath();
  ctx.moveTo(8, 30);
  ctx.bezierCurveTo(18, 30, 18, 6, 30, 6);
  ctx.lineTo(240, 6);
  ctx.bezierCurveTo(252, 6, 252, 30, 262, 30);
  ctx.fill();
  if (favicon === "hn") {
    ctx.fillStyle = "#ff6600";
    ctx.fillRect(34, 11, 16, 16);
    text(ctx, "Y", 38, 24, "bold 13px Verdana", "#fff");
  } else {
    text(ctx, "g", 36, 25, "bold 17px Georgia", "#3369e8");
  }
  text(ctx, tab, 58, 23, "12px 'Segoe UI', Arial", "#222");
  ctx.fillStyle = "#c5d5ea";
  ctx.beginPath();
  ctx.roundRect(258, 12, 26, 15, 3);
  ctx.fill();
  // window buttons
  ctx.fillStyle = "#c94a3d";
  ctx.beginPath();
  ctx.roundRect(SCREEN_W - 48, 0, 44, 20, [0, 0, 5, 5]);
  ctx.fill();
  text(ctx, "x", SCREEN_W - 26, 15, "bold 13px Arial", "#fff", "center");
  ctx.fillStyle = "#c7d7ec";
  ctx.fillRect(SCREEN_W - 108, 0, 58, 18);
  // toolbar
  const tb = ctx.createLinearGradient(0, 30, 0, CHROME_H);
  tb.addColorStop(0, "#f6f8fb");
  tb.addColorStop(1, "#e6ebf2");
  ctx.fillStyle = tb;
  ctx.fillRect(0, 30, SCREEN_W, CHROME_H - 30);
  ctx.fillStyle = "#b8c4d4";
  ctx.fillRect(0, CHROME_H - 1, SCREEN_W, 1);
  ctx.strokeStyle = "#7a8798";
  ctx.lineWidth = 2;
  for (const [x, d] of [[18, -1], [44, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + 6 * d, 40);
    ctx.lineTo(x - 2 * d, 47);
    ctx.lineTo(x + 6 * d, 54);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(76, 47, 7, 0.4, Math.PI * 1.8);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#a9b6c8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(98, 36, SCREEN_W - 150, 23, 3);
  ctx.fill();
  ctx.stroke();
  const [host, ...rest] = url.split("/");
  const w = text(ctx, host, 110, 52, "14px 'Segoe UI', Arial", "#000");
  if (rest.length) text(ctx, "/" + rest.join("/"), 110 + w, 52, "14px 'Segoe UI', Arial", "#888");
  // wrench
  ctx.strokeStyle = "#6c7889";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(SCREEN_W - 34, 54);
  ctx.lineTo(SCREEN_W - 22, 42);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(SCREEN_W - 20, 40, 4, 0, Math.PI * 2);
  ctx.stroke();
};

// ---------------------------------------------------------------- HN, 2011

const HN_X = Math.round((SCREEN_W * 0.15) / 2);
const HN_W = Math.round(SCREEN_W * 0.85);
export const HN_ROW0 = 52; // baseline of the first title, viewport px
const HN_PITCH = 31;

export const hnPage = (items: FrontPageItem[]) => {
  const { c, ctx } = canvas(SCREEN_W, VIEW_H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SCREEN_W, VIEW_H);
  ctx.fillStyle = "#f6f6ef";
  ctx.fillRect(HN_X, 8, HN_W, VIEW_H);
  ctx.fillStyle = "#ff6600";
  ctx.fillRect(HN_X, 8, HN_W, 24);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(HN_X + 3.5, 11.5, 17, 17);
  text(ctx, "Y", HN_X + 8, 25, "bold 13px Verdana", "#fff");
  const w = text(ctx, "Hacker News", HN_X + 27, 25, "bold 13.3px Verdana", "#000");
  text(ctx, "  new | comments | ask | jobs | submit", HN_X + 27 + w, 25, "13.3px Verdana", "#000");
  text(ctx, "login", HN_X + HN_W - 8, 25, "13.3px Verdana", "#000", "right");
  items.forEach((it, i) => {
    const y = HN_ROW0 + i * HN_PITCH;
    text(ctx, `${i + 1}.`, HN_X + 30, y, "13.3px Verdana", "#828282", "right");
    ctx.fillStyle = "#9a9a9a";
    ctx.beginPath();
    ctx.moveTo(HN_X + 36, y - 2);
    ctx.lineTo(HN_X + 41, y - 10);
    ctx.lineTo(HN_X + 46, y - 2);
    ctx.fill();
    const tw = text(ctx, it.title.trim(), HN_X + 52, y, "13.3px Verdana", "#000");
    if (it.domain) text(ctx, ` (${it.domain})`, HN_X + 52 + tw, y, "10.7px Verdana", "#828282");
    text(ctx, `${it.score} points by ${it.author} ${it.hours} hours ago | ${it.comments} comments`, HN_X + 52, y + 13, "9.3px Verdana", "#828282");
  });
  return c;
};

// where the first story's title sits, for the cursor and the highlight
export const hnRow = (i: number): Rect => ({ x: HN_X + 30, y: HN_ROW0 + i * HN_PITCH - 15, w: 560, h: 30 });
export const hnLink = { x: HN_X + 52 + 120, y: HN_ROW0 - 5 };

// ---------------------------------------------------------------- Google, Nov 2011

const LOGO = [
  ["G", "#3369e8"],
  ["o", "#d50f25"],
  ["o", "#eeb211"],
  ["g", "#3369e8"],
  ["l", "#009925"],
  ["e", "#d50f25"],
] as const;

const RESULTS = [
  {
    title: "Barrel roll - Wikipedia, the free encyclopedia",
    url: "en.wikipedia.org/wiki/Barrel_roll",
    snippet: ["A barrel roll is an aerial maneuver in which an airplane makes a complete", "rotation on both its longitudinal and lateral axes, causing it to follow a ..."],
  },
  {
    title: "Do a Barrel Roll | Know Your Meme",
    url: "knowyourmeme.com/memes/do-a-barrel-roll",
    snippet: ["Do a Barrel Roll is a catchphrase from the 1997 Nintendo 64 game Star Fox 64,", "shouted by Peppy Hare as advice to the player ..."],
  },
  {
    title: "Aileron roll - Wikipedia, the free encyclopedia",
    url: "en.wikipedia.org/wiki/Aileron_roll",
    snippet: ["An aileron roll is an aerobatic maneuver in which an aircraft does a full 360°", "revolution about its longitudinal axis. Often confused with the barrel roll ..."],
  },
  {
    title: "Star Fox 64 - Do a barrel roll! - YouTube",
    url: "www.youtube.com/watch",
    snippet: ["Peppy Hare tells Fox McCloud to do a barrel roll. Over and over again.", "1 min"],
  },
];

export const RESULT_Y0 = 150;
const RESULT_PITCH = 96;

const drawGoogleLogo = (ctx: Ctx, x: number, y: number, size: number) => {
  ctx.font = `bold ${size}px Georgia`;
  ctx.textAlign = "left";
  let cx = x;
  for (const [ch, col] of LOGO) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillText(ch, cx + 1, y + 1);
    ctx.fillStyle = col;
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width - size * 0.02;
  }
};

export const googlePage = () => {
  const { c, ctx } = canvas(SCREEN_W, VIEW_H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SCREEN_W, VIEW_H);
  // black bar (June 2011)
  ctx.fillStyle = "#2d2d2d";
  ctx.fillRect(0, 0, SCREEN_W, 30);
  let x = 14;
  for (const [label, on] of [["+You", false], ["Search", true], ["Images", false], ["Videos", false], ["Maps", false], ["News", false], ["Gmail", false], ["More ▾", false]] as const) {
    if (on) {
      ctx.fillStyle = "#dd4b39";
      ctx.fillRect(x - 6, 0, ctx.measureText(label).width + 30, 2);
    }
    x += text(ctx, label, x, 20, `${on ? "bold " : ""}13px Arial`, on ? "#fff" : "#ccc") + 22;
  }
  text(ctx, "Sign in", SCREEN_W - 60, 20, "bold 13px Arial", "#ccc", "right");
  // header
  drawGoogleLogo(ctx, 18, 76, 34);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#d9d9d9";
  ctx.lineWidth = 1;
  ctx.strokeRect(170.5, 50.5, 560, 29);
  ctx.strokeStyle = "#c0c0c0";
  ctx.beginPath();
  ctx.moveTo(170.5, 50.5);
  ctx.lineTo(730.5, 50.5);
  ctx.stroke();
  text(ctx, "do a barrel roll", 180, 71, "16px Arial", "#000");
  ctx.fillStyle = "#4d90fe";
  ctx.beginPath();
  ctx.roundRect(738, 50, 72, 30, 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(771, 63, 6, 0, Math.PI * 2);
  ctx.moveTo(775, 67);
  ctx.lineTo(781, 73);
  ctx.stroke();
  ctx.fillStyle = "#e5e5e5";
  ctx.fillRect(0, 104, SCREEN_W, 1);
  // left navigation
  text(ctx, "Everything", 30, 150, "bold 13px Arial", "#dd4b39");
  ["Images", "Maps", "Videos", "News", "Shopping", "More"].forEach((s, i) => text(ctx, s, 30, 178 + i * 26, "13px Arial", "#222"));
  ["Any time", "Past hour", "Past 24 hours", "Past week", "All results", "Related searches"].forEach((s, i) => text(ctx, s, 30, 370 + i * 24, "12px Arial", i === 0 || i === 4 ? "#dd4b39" : "#666"));
  // results
  text(ctx, "About 7,890,000 results (0.21 seconds)", 180, 126, "13px Arial", "#999");
  RESULTS.forEach((r, i) => {
    const y = RESULT_Y0 + i * RESULT_PITCH;
    const tw = text(ctx, r.title, 180, y + 16, "16px Arial", "#1122cc");
    ctx.fillStyle = "#1122cc";
    ctx.fillRect(180, y + 18, tw, 1);
    text(ctx, r.url, 180, y + 36, "13px Arial", "#009933");
    r.snippet.forEach((s, k) => text(ctx, s, 180, y + 55 + k * 17, "13px Arial", "#222"));
  });
  return c;
};

// ---------------------------------------------------------------- the pieces that fly out

export type Card = { name: string; rect: Rect; src: "page" | "code" };

export const CARDS: Card[] = [
  { name: "bar", rect: { x: 0, y: 0, w: 640, h: 30 }, src: "page" },
  { name: "header", rect: { x: 0, y: 34, w: 820, h: 66 }, src: "page" },
  ...RESULTS.map((_, i) => ({ name: `r${i}`, rect: { x: 170, y: RESULT_Y0 + i * RESULT_PITCH - 6, w: 620, h: 90 }, src: "page" as const })),
  { name: "code", rect: { x: 900, y: 420, w: 620, h: 150 }, src: "code" },
];

// One card's picture: a crop of the Google page, or the CSS behind the trick.
export const cardCanvas = (card: Card, page: HTMLCanvasElement) => {
  const { c, ctx } = canvas(card.rect.w, card.rect.h);
  if (card.src === "page") {
    ctx.drawImage(page, card.rect.x * S, card.rect.y * S, card.rect.w * S, card.rect.h * S, 0, 0, card.rect.w, card.rect.h);
    return c;
  }
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, card.rect.w, card.rect.h);
  ctx.fillStyle = "#2c2c2c";
  ctx.fillRect(0, 0, card.rect.w, 24);
  text(ctx, "Elements    Resources    Network    Scripts", 12, 17, "12px 'Segoe UI', Arial", "#aaa");
  const lines: [string, string][] = [
    ["body {", "#d7ba7d"],
    ["  -webkit-transition: -webkit-transform 4s;", "#9cdcfe"],
    ["  -webkit-transform: rotate(360deg);", "#9cdcfe"],
    ["}", "#d7ba7d"],
  ];
  lines.forEach(([s, col], i) => text(ctx, s, 18, 54 + i * 24, "17px Consolas, 'Courier New', monospace", col));
  return c;
};

// White-out where a card used to be, once it has left the page.
export const clearCard = (ctx: Ctx, card: Card) => {
  ctx.fillStyle = "#fff";
  ctx.fillRect(card.rect.x, CHROME_H + card.rect.y, card.rect.w, card.rect.h);
};

// The 2011 Windows arrow cursor, tip at (x, y).
export const drawCursor = (ctx: Ctx, x: number, y: number, pressed: boolean) => {
  const k = pressed ? 0.9 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k * 1.6, k * 1.6);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 17);
  ctx.lineTo(4, 13);
  ctx.lineTo(7, 20);
  ctx.lineTo(10, 19);
  ctx.lineTo(7, 12);
  ctx.lineTo(12, 12);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
};
