import * as THREE from "three";

const canvasTexture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
};

const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

export type FrontPageItem = { title: string; domain: string | null; score: number; comments: number; author: string; hours: number };

// The phone's screen at 1125 x 2436: mobile Safari on the HN front page of
// 3 Nov 2017, with the notch and status bar.
// rows: the pixel span of each story, top to bottom, for highlighting.
export const screenTexture = (items: FrontPageItem[]) => {
  const rows: [number, number][] = [];
  const tex = canvasTexture(1125, 2436, (ctx) => {
    const W = 1125;
    const H = 2436;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    // active area with rounded corners
    ctx.save();
    roundRectPath(ctx, 0, 0, W, H, 120);
    ctx.clip();

    // Safari chrome
    ctx.fillStyle = "#f7f7f7";
    ctx.fillRect(0, 0, W, 300);
    ctx.fillStyle = "#e3e3e6";
    roundRectPath(ctx, 40, 168, W - 80, 104, 26);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = "500 44px -apple-system, 'Segoe UI', Arial";
    ctx.textAlign = "center";
    ctx.fillText("\u{1F512} news.ycombinator.com", W / 2, 236);
    ctx.textAlign = "left";

    // HN header
    const top = 300;
    ctx.fillStyle = "#f6f6ef";
    ctx.fillRect(0, top, W, H - top);
    ctx.fillStyle = "#ff6600";
    ctx.fillRect(0, top, W, 92);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;
    ctx.strokeRect(22, top + 16, 60, 60);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 46px Verdana";
    ctx.fillText("Y", 37, top + 64);
    ctx.fillStyle = "#000";
    ctx.font = "bold 40px Verdana";
    ctx.fillText("Hacker News", 104, top + 60);
    ctx.font = "34px Verdana";
    ctx.fillText("new | past | comments | ask | show", 404, top + 60);

    // stories
    let y = top + 160;
    items.forEach((it, i) => {
      ctx.fillStyle = "#828282";
      ctx.font = "38px Verdana";
      ctx.textAlign = "right";
      ctx.fillText(`${i + 1}.`, 86, y);
      ctx.textAlign = "left";
      ctx.fillStyle = "#9a9a9a";
      ctx.beginPath();
      ctx.moveTo(108, y - 10);
      ctx.lineTo(126, y - 34);
      ctx.lineTo(144, y - 10);
      ctx.fill();
      // title, wrapped to two lines
      ctx.fillStyle = "#000";
      ctx.font = "40px Verdana";
      const words = `${it.title}${it.domain ? ` (${it.domain})` : ""}`.split(" ");
      let line = "";
      let ly = y;
      let lines = 0;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > W - 200 && line) {
          ctx.fillText(line, 160, ly);
          line = w;
          ly += 52;
          lines++;
        } else line = test;
      }
      ctx.fillText(line, 160, ly);
      lines++;
      ctx.fillStyle = "#828282";
      ctx.font = "30px Verdana";
      ctx.fillText(`${it.score} points by ${it.author} ${it.hours} hours ago | ${it.comments} comments`, 160, ly + 50);
      rows.push([y - 52, ly + 72]);
      y = ly + 128;
      void lines;
    });
    ctx.restore();

    // notch
    const nw = 628;
    const nx = (W - nw) / 2;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(nx - 40, 0);
    ctx.quadraticCurveTo(nx, 0, nx, 40);
    ctx.lineTo(nx, 52);
    ctx.quadraticCurveTo(nx, 96, nx + 46, 96);
    ctx.lineTo(nx + nw - 46, 96);
    ctx.quadraticCurveTo(nx + nw, 96, nx + nw, 52);
    ctx.lineTo(nx + nw, 40);
    ctx.quadraticCurveTo(nx + nw, 0, nx + nw + 40, 0);
    ctx.fill();

    // status bar
    ctx.fillStyle = "#000";
    ctx.font = "600 46px -apple-system, 'Segoe UI', Arial";
    ctx.fillText("9:41", 104, 82);
    for (let i = 0; i < 4; i++) ctx.fillRect(842 + i * 18, 76 - (i + 1) * 9, 12, (i + 1) * 9);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    roundRectPath(ctx, 948, 48, 74, 34, 9);
    ctx.stroke();
    ctx.fillRect(953, 53, 52, 24);
    ctx.fillRect(1025, 58, 5, 14);

    // home indicator
    ctx.fillStyle = "#111";
    roundRectPath(ctx, W / 2 - 200, H - 40, 400, 14, 7);
    ctx.fill();
  });
  tex.userData.rows = rows;
  return tex;
};

// Printed label on a battery cell.
export const batteryTexture = (big: boolean) =>
  canvasTexture(big ? 640 : 560, big ? 1920 : 480, (ctx) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.fillStyle = "#17181a";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.font = "bold 34px Arial";
    if (big) {
      ctx.save();
      ctx.translate(W / 2 + 40, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.font = "bold 46px Arial";
      ctx.fillText("Li-ion Battery  616-00346", 0, -120);
      ctx.font = "34px Arial";
      ctx.fillText("3.81V  2716mAh  10.35Whr", 0, -60);
      ctx.font = "26px Arial";
      ctx.fillText("Warning: Risk of fire and burns. Do not disassemble,", 0, 10);
      ctx.fillText("puncture, crush, heat, or burn. Use only with designated device.", 0, 46);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 3;
      ctx.strokeRect(90, 520, 90, 90);
      ctx.strokeRect(90, 640, 90, 90);
    } else {
      ctx.textAlign = "center";
      ctx.font = "30px Arial";
      ctx.fillText("Cell 2 of 2", W / 2, H / 2 - 20);
      ctx.fillText("2716mAh total", W / 2, H / 2 + 26);
    }
    // pull tabs
    ctx.fillStyle = "rgba(170,170,166,0.8)";
    if (big) {
      ctx.fillRect(110, H - 120, 160, 120);
      ctx.fillRect(W - 270, H - 120, 160, 120);
    }
  });

export const chipTexture = (lines: string[], logo = false) =>
  canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#0b0b0c";
    ctx.fillRect(0, 0, 512, 512);
    const g = ctx.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, "rgba(255,255,255,0.05)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "rgba(200,200,205,0.75)";
    ctx.textAlign = "center";
    ctx.font = "bold 50px 'Courier New', monospace";
    lines.forEach((l, i) => ctx.fillText(l, 256, 220 + i * 66 - (lines.length - 1) * 33));
    if (logo) {
      ctx.beginPath();
      ctx.arc(60, 60, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  });

// Perforated shield can lid.
export const shieldTexture = () =>
  canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#b9bbbf";
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "rgba(60,62,66,0.85)";
    for (let y = 24; y < 512; y += 38)
      for (let x = 24 + ((y / 38) % 2) * 19; x < 512; x += 38) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
  });

// Wireless charging coil: copper turns on black ferrite.
export const coilTexture = () =>
  canvasTexture(1024, 1024, (ctx) => {
    ctx.fillStyle = "#101012";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let r = 160; r < 500; r += 13) {
      ctx.strokeStyle = r % 2 ? "#c97a3d" : "#b86b33";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(512, 512, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#101012";
    ctx.fillRect(500, 0, 24, 520);
    ctx.fillStyle = "#c97a3d";
    ctx.fillRect(504, 20, 16, 480);
  });

export const stickerTexture = (lines: string[], bg = "#e9e8e4", fg = "#222") =>
  canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = fg;
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    lines.forEach((l, i) => ctx.fillText(l, 256, 110 + i * 56));
  });

export const meshTexture = () =>
  canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = "#0e0e10";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#2b2c30";
    for (let y = 10; y < 256; y += 16) for (let x = 10 + ((y / 16) % 2) * 8; x < 512; x += 16) ctx.fillRect(x, y, 7, 7);
  });

// Bead-blasted aluminium housing floor with etched markings.
export const housingTexture = () =>
  canvasTexture(1024, 2048, (ctx) => {
    ctx.fillStyle = "#4a4c51";
    ctx.fillRect(0, 0, 1024, 2048);
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.03 + r() * 0.05})`;
      ctx.fillRect(r() * 1024, r() * 2048, 1 + r() * 3, 1 + r() * 3);
    }
    // adhesive pads under the battery
    ctx.fillStyle = "#1b1b1d";
    ctx.fillRect(90, 520, 360, 1100);
    ctx.fillRect(560, 1250, 330, 330);
    // etched markings
    ctx.fillStyle = "rgba(220,222,226,0.35)";
    ctx.font = "22px 'Courier New', monospace";
    ["A1865  FCC ID: BCG-E3175A", "IC: 579C-E3175A", "MODEL A1865", "ASSEMBLED IN CHINA"].forEach((l, i) => ctx.fillText(l, 560, 1700 + i * 34));
    ctx.strokeStyle = "rgba(220,222,226,0.25)";
    ctx.lineWidth = 3;
    ctx.strokeRect(70, 500, 400, 1140);
  });

// Repair mat: dark silicone with a centimetre grid, ruler and numbered trays.
export const matTexture = (unitsPerSide: number) =>
  canvasTexture(4096, 4096, (ctx) => {
    const S = 4096;
    const u = S / unitsPerSide; // pixels per world unit (1 cm)
    ctx.fillStyle = "#1c262d";
    ctx.fillRect(0, 0, S, S);
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 60000; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.015 + r() * 0.03})`;
      ctx.fillRect(r() * S, r() * S, 2, 2);
    }
    ctx.lineWidth = 2;
    for (let k = 0; k <= unitsPerSide; k++) {
      ctx.strokeStyle = k % 5 === 0 ? "rgba(200,220,230,0.16)" : "rgba(200,220,230,0.065)";
      ctx.beginPath();
      ctx.moveTo(k * u, 0);
      ctx.lineTo(k * u, S);
      ctx.moveTo(0, k * u);
      ctx.lineTo(S, k * u);
      ctx.stroke();
    }
    // ruler along one side of the work area
    const c = S / 2;
    ctx.strokeStyle = "rgba(225,235,240,0.55)";
    ctx.fillStyle = "rgba(225,235,240,0.55)";
    ctx.font = `${Math.round(u * 0.32)}px 'Courier New', monospace`;
    ctx.textAlign = "center";
    for (let mm = -120; mm <= 120; mm++) {
      const x = c + (mm / 10) * u;
      const len = mm % 10 === 0 ? u * 0.45 : mm % 5 === 0 ? u * 0.3 : u * 0.18;
      ctx.beginPath();
      ctx.moveTo(x, c + 9.6 * u);
      ctx.lineTo(x, c + 9.6 * u - len);
      ctx.stroke();
      if (mm % 10 === 0) ctx.fillText(String(Math.abs(mm / 10)), x, c + 9.6 * u - u * 0.6);
    }
    // numbered screw trays
    ctx.lineWidth = 3;
    ctx.font = `bold ${Math.round(u * 0.5)}px 'Courier New', monospace`;
    ctx.textAlign = "left";
    for (let i = 0; i < 4; i++) {
      const x = c + 5.4 * u;
      const y = c - 6.5 * u + i * 2.4 * u;
      ctx.strokeStyle = "rgba(225,235,240,0.3)";
      ctx.strokeRect(x, y, 2.6 * u, 2.0 * u);
      ctx.fillStyle = "rgba(225,235,240,0.45)";
      ctx.fillText(String(i + 1), x + 0.18 * u, y + 0.62 * u);
    }
  });

// Back of the OLED panel: graphite heat spreader, copper foil, flex pads.
export const panelBackTexture = () =>
  canvasTexture(1125, 2436, (ctx) => {
    const W = 1125;
    const H = 2436;
    ctx.fillStyle = "#0d0d0f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2a2b2e";
    ctx.beginPath();
    ctx.roundRect(60, 120, W - 120, H - 260, 90);
    ctx.fill();
    let seed = 11;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.015 + r() * 0.03})`;
      ctx.fillRect(60 + r() * (W - 120), 120 + r() * (H - 260), 2, 1);
    }
    // copper foil along the hinge side
    const g = ctx.createLinearGradient(W - 330, 0, W - 80, 0);
    g.addColorStop(0, "#9a5a2c");
    g.addColorStop(0.5, "#d08a52");
    g.addColorStop(1, "#8c4f25");
    ctx.fillStyle = g;
    ctx.fillRect(W - 330, 380, 250, 1500);
    ctx.fillStyle = "rgba(240,236,228,0.85)";
    ctx.font = "bold 34px Arial";
    ctx.fillText("OLED  5.8\"  2436x1125", 140, 260);
    ctx.font = "26px 'Courier New', monospace";
    ctx.fillText("C1F7371  0A2B  E3", 140, 310);
    // test pads
    ctx.fillStyle = "#c9a046";
    for (let i = 0; i < 6; i++) ctx.fillRect(160 + i * 64, 2120, 40, 40);
  });
