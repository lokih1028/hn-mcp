import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { flatRect, rng, slab } from "../../spike/geometry";
import type { FrontPageItem } from "../../spike/textures";
import { span } from "../common/camera";
import { studioLights } from "../common/stage";
import {
  CARDS,
  CHROME_H,
  cardCanvas,
  clearCard,
  drawChrome,
  drawCursor,
  googlePage,
  hnLink,
  hnPage,
  hnRow,
  S,
  SCREEN_H,
  SCREEN_W,
  VIEW_H,
} from "./page";

// A 2011 desk at night: a glossy 22" 16:10 monitor running Chrome, keyboard,
// mouse, a mug. Units: 1 = 1 cm, desk top at y = 0, the screen faces +z.

export const SCREEN_CM = 47.4;
export const PX = SCREEN_CM / SCREEN_W; // cm per screen pixel
const SCREEN_Y = 36;
const SCREEN_Z = 1.24;

// timeline, seconds
export const T = {
  cursorFrom: 0.4,
  cursorAt: 1.9,
  press: 2.25,
  load: 2.55,
  rollFrom: 4.3,
  rollTo: 6.2,
  cardsFrom: 6.4,
  cardStep: 0.22,
  cardFly: 1.7,
};

const CARD_W = 25; // width of every card once it has lined up, cm

// screen pixel -> local position on the screen surface
const onScreen = (sx: number, sy: number, z = SCREEN_Z) => new THREE.Vector3((sx - SCREEN_W / 2) * PX, SCREEN_Y + (SCREEN_H / 2 - sy) * PX, z);

const canvasTex = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
};

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, shadows = true) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = shadows;
  o.receiveShadow = true;
  return o;
};

// A flat slab lying on the desk (x across, z towards the viewer).
const lying = (w: number, d: number, h: number, r: number, m: THREE.Material, x: number, y: number, z: number) => {
  const o = mesh(slab(w, d, h, r, Math.min(0.3, h / 3)), m);
  o.rotation.x = -Math.PI / 2;
  o.position.set(x, y, z);
  return o;
};

const woodTexture = () => {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 1024;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#3b2618";
  ctx.fillRect(0, 0, 2048, 1024);
  const rand = rng(4);
  for (let i = 0; i < 260; i++) {
    const y = rand() * 1024;
    const a = 0.04 + rand() * 0.1;
    ctx.strokeStyle = rand() < 0.5 ? `rgba(20,10,4,${a})` : `rgba(120,80,48,${a})`;
    ctx.lineWidth = 1 + rand() * 4;
    ctx.beginPath();
    for (let x = 0; x <= 2048; x += 32) ctx.lineTo(x, y + Math.sin(x / (180 + rand() * 40) + i) * 6 + Math.sin(x / 37) * 1.5);
    ctx.stroke();
  }
  const t = canvasTex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

const keyboard = (root: THREE.Group) => {
  const g = new THREE.Group();
  const base = new THREE.MeshPhysicalMaterial({ color: "#121214", roughness: 0.42, clearcoat: 0.4 });
  g.add(lying(31, 12.6, 1.6, 0.8, base, 0, 0.8, 0));
  const U = 1.9;
  const rows: (number | [number, string])[][] = [
    [[1, "Esc"], 0.6, [1, "F1"], [1, "F2"], [1, "F3"], [1, "F4"], 0.4, [1, "F5"], [1, "F6"], [1, "F7"], [1, "F8"], 0.4, [1, "F9"], [1, "F10"], [1, "F11"], [1, "F12"]],
    [..."`1234567890-=".split("").map((k) => [1, k] as [number, string]), [2, "⌫"]],
    [[1.5, "Tab"], ..."QWERTYUIOP[]".split("").map((k) => [1, k] as [number, string]), [1.5, "\\"]],
    [[1.75, "Caps"], ..."ASDFGHJKL;'".split("").map((k) => [1, k] as [number, string]), [2.25, "Enter"]],
    [[2.25, "Shift"], ..."ZXCVBNM,./".split("").map((k) => [1, k] as [number, string]), [2.75, "Shift"]],
    [[1.25, "Ctrl"], [1.25, "⊞"], [1.25, "Alt"], [6.25, ""], [1.25, "Alt"], [1.25, "⊞"], [1.25, "▤"], [1.25, "Ctrl"]],
  ];
  const keys: { x: number; z: number; w: number; label: string }[] = [];
  rows.forEach((row, r) => {
    let x = -14.25;
    const z = -5.2 + r * U + (r > 0 ? 0.35 : 0);
    for (const k of row) {
      if (typeof k === "number") {
        x += k * U;
        continue;
      }
      const [w, label] = k;
      keys.push({ x: x + (w * U) / 2, z, w: w * U - 0.25, label });
      x += w * U;
    }
  });
  const cap = new THREE.MeshPhysicalMaterial({ color: "#19191b", roughness: 0.55, clearcoat: 0.15 });
  for (const k of keys) g.add(lying(k.w, 1.6, 0.75, 0.25, cap, k.x, 1.95, k.z));
  // legends: one transparent sheet floating on the key tops
  const c = document.createElement("canvas");
  c.width = 3100;
  c.height = 1260;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(225,225,230,0.88)";
  ctx.textAlign = "center";
  for (const k of keys) {
    ctx.font = `${k.label.length > 1 ? 34 : 50}px 'Segoe UI', Arial`;
    ctx.fillText(k.label, ((k.x + 15.5) / 31) * 3100, ((k.z + 6.3) / 12.6) * 1260 + 16);
  }
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(31, 12.6), new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, opacity: 0.85 }));
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = 2.34;
  g.add(sheet);
  g.position.set(-3, 0, 26);
  g.rotation.y = 0.04;
  root.add(g);
};

const props = (root: THREE.Group) => {
  // mouse
  const mouse = mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshPhysicalMaterial({ color: "#141416", roughness: 0.25, clearcoat: 1 }));
  mouse.scale.set(3.1, 1.9, 5.6);
  mouse.position.set(26, 0.4, 29);
  mouse.rotation.y = -0.15;
  root.add(mouse);
  const wheel = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 24).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#3a3a3e", roughness: 0.6 }));
  wheel.position.set(25.6, 2.3, 26.6);
  root.add(wheel);
  // mug
  const ceramic = new THREE.MeshPhysicalMaterial({ color: "#efece6", roughness: 0.2, clearcoat: 1 });
  const mug = mesh(new THREE.CylinderGeometry(4, 3.8, 9.5, 64, 1, true), ceramic);
  mug.position.set(-33, 4.75, 12);
  root.add(mug);
  const bottom = mesh(new THREE.CircleGeometry(3.8, 48), ceramic);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.set(-33, 0.05, 12);
  root.add(bottom);
  const coffee = mesh(new THREE.CircleGeometry(3.85, 48), new THREE.MeshPhysicalMaterial({ color: "#2a160b", roughness: 0.1, clearcoat: 1 }), false);
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(-33, 8.2, 12);
  root.add(coffee);
  const handle = mesh(new THREE.TorusGeometry(2.6, 0.55, 16, 40, Math.PI * 1.2), ceramic);
  handle.rotation.set(0, 0, -Math.PI * 0.6);
  handle.position.set(-37.6, 5, 12);
  root.add(handle);
};

const monitor = (root: THREE.Group) => {
  const gloss = new THREE.MeshPhysicalMaterial({ color: "#09090b", roughness: 0.35, clearcoat: 0.45, clearcoatRoughness: 0.12 });
  const matte = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.6 });
  const bezel = mesh(slab(51.6, 34.6, 2.4, 0.9, 0.3), gloss);
  bezel.position.set(0, 35.5, 0);
  root.add(bezel);
  const back = mesh(slab(42, 27, 4.5, 3, 1.2), matte);
  back.position.set(0, 35.5, -3.2);
  root.add(back);
  const neck = mesh(slab(7, 22, 2.2, 0.8, 0.3), matte);
  neck.position.set(0, 13, -6.2);
  neck.rotation.x = -0.08;
  root.add(neck);
  root.add(lying(25, 18, 1.2, 6, gloss, 0, 0.6, -4.5));
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), new THREE.MeshBasicMaterial({ color: "#5aa8ff" }));
  led.position.set(23.6, 19.6, 1.22);
  root.add(led);
  // sticky note: the day's #3 story
  const note = document.createElement("canvas");
  note.width = 512;
  note.height = 512;
  const nctx = note.getContext("2d")!;
  nctx.fillStyle = "#f7e35c";
  nctx.fillRect(0, 0, 512, 512);
  nctx.fillStyle = "rgba(0,0,0,0.06)";
  nctx.fillRect(0, 0, 512, 70);
  nctx.fillStyle = "#1d2b6b";
  nctx.font = "64px 'Segoe Print', 'Comic Sans MS', cursive";
  nctx.fillText("jQuery 1.7", 50, 210);
  nctx.fillText("is out!", 80, 320);
  const sticky = mesh(flatRect(7, 7, 0.1), new THREE.MeshStandardMaterial({ map: canvasTex(note), roughness: 0.8 }), false);
  sticky.position.set(21.5, 21.5, 1.3);
  sticky.rotation.z = -0.12;
  root.add(sticky);
};

export type Desk = ReturnType<typeof buildDesk>;

export const buildDesk = (items: FrontPageItem[]) => {
  RectAreaLightUniformsLib.init();
  const root = new THREE.Group();
  const anchors: Record<string, THREE.Object3D> = {};

  // room
  const wood = woodTexture();
  wood.repeat.set(1.5, 1);
  const desk = mesh(new THREE.BoxGeometry(180, 3, 95), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.2 }));
  desk.position.set(0, -1.5, 12);
  desk.castShadow = false;
  root.add(desk);
  const wall = mesh(new THREE.PlaneGeometry(500, 300), new THREE.MeshStandardMaterial({ color: "#1d2027", roughness: 0.95 }), false);
  wall.position.set(0, 100, -40);
  root.add(wall);

  monitor(root);
  keyboard(root);
  props(root);

  // the screen: redrawn every frame
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = SCREEN_W * S;
  screenCanvas.height = SCREEN_H * S;
  const sctx = screenCanvas.getContext("2d")!;
  const screenTex = canvasTex(screenCanvas);
  const screenMat = new THREE.MeshPhysicalMaterial({ color: "#000", emissiveMap: screenTex, emissive: "#fff", emissiveIntensity: 0.62, roughness: 0.9, clearcoat: 1, clearcoatRoughness: 0.04 });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_CM, SCREEN_H * PX),
    screenMat,
  );
  screen.position.set(0, SCREEN_Y, SCREEN_Z);
  root.add(screen);
  // the screen lights the desk and keyboard
  const glow = new THREE.RectAreaLight("#dfe7ff", 3.2, SCREEN_CM, SCREEN_H * PX);
  glow.position.set(0, SCREEN_Y, SCREEN_Z + 0.2);
  glow.lookAt(0, SCREEN_Y, 30);
  root.add(glow);
  studioLights(root, {
    key: ["#ffd2a1", 1.6, [-70, 95, 80]],
    rim: ["#8fb0ff", 1.4, [80, 50, -50]],
    fill: ["#ffb070", 0.25, [-60, 10, 40]],
    shadowSize: 70,
  });

  const hn = hnPage(items);
  const google = googlePage();

  // cards that fly out of the page
  const cards = CARDS.map((card) => {
    const w = card.rect.w * PX;
    const h = card.rect.h * PX;
    const g = new THREE.Group();
    const edge = mesh(slab(w, h, 0.12, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: "#d9dbe0", roughness: 0.5 }));
    g.add(edge);
    const tex = canvasTex(cardCanvas(card, google));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ color: "#000", emissiveMap: tex, emissive: "#fff", emissiveIntensity: 0.7, roughness: 0.9, clearcoat: 1, clearcoatRoughness: 0.05 }));
    face.position.z = 0.065;
    g.add(face);
    const a = new THREE.Object3D();
    a.position.set(w / 2, 0, 0.07);
    g.add(a);
    anchors[card.name] = a;
    const left = new THREE.Object3D();
    left.position.set(-w / 2, 0, 0.07);
    g.add(left);
    anchors[`${card.name}-left`] = left;
    g.visible = false;
    root.add(g);
    const from = onScreen(card.rect.x + card.rect.w / 2, CHROME_H + card.rect.y + card.rect.h / 2, SCREEN_Z + 0.08);
    return { card, g, w, h, from, scale: CARD_W / w };
  });
  // where they line up: a column in front of the monitor, top to bottom
  const gap = 2.6;
  const total = cards.reduce((s, c) => s + c.h * c.scale, 0) + gap * (cards.length - 1);
  let y = SCREEN_Y + total / 2;
  const dest = cards.map((c, i) => {
    const hh = c.h * c.scale;
    const p = new THREE.Vector3((i % 2 ? 1.2 : -1.2) + (c.card.src === "code" ? 4 : 0), y - hh / 2, 14 + i * 1.3);
    y -= hh + gap;
    return p;
  });

  const cardProgress = (t: number, i: number) => span(t, T.cardsFrom + i * T.cardStep, T.cardsFrom + i * T.cardStep + T.cardFly);

  const cursorAt = (t: number) => {
    const k = span(t, T.cursorFrom, T.cursorAt);
    const a = { x: 1060, y: 420 };
    const b = hnLink;
    // a slight curve, like a hand on a mouse
    return { x: a.x + (b.x - a.x) * k + Math.sin(k * Math.PI) * 40, y: a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 60 };
  };

  const drawScreen = (t: number) => {
    const ctx = sctx;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    const cur = cursorAt(t);
    if (t < T.load) {
      drawChrome(ctx, "Hacker News", "news.ycombinator.com", "hn");
      ctx.drawImage(hn, 0, CHROME_H, SCREEN_W, VIEW_H);
      const hl = span(t, 0.15, 0.8);
      const r = hnRow(0);
      ctx.fillStyle = `rgba(255,102,0,${0.16 * hl})`;
      ctx.fillRect(r.x, CHROME_H + r.y, r.w, r.h);
    } else {
      drawChrome(ctx, "do a barrel roll - Google Search", "www.google.com/search?q=do+a+barrel+roll", "google");
      const angle = Math.PI * 2 * span(t, T.rollFrom, T.rollTo);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, CHROME_H, SCREEN_W, VIEW_H);
      ctx.clip();
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, CHROME_H, SCREEN_W, VIEW_H);
      ctx.translate(SCREEN_W / 2, CHROME_H + VIEW_H / 2);
      ctx.rotate(angle);
      ctx.translate(-SCREEN_W / 2, -VIEW_H / 2);
      ctx.drawImage(google, 0, 0, SCREEN_W, VIEW_H);
      ctx.restore();
      cards.forEach((c, i) => {
        if (cardProgress(t, i) > 0) clearCard(ctx, c.card);
      });
    }
    const pressed = t > T.press && t < T.press + 0.18;
    drawCursor(ctx, cur.x, CHROME_H + cur.y, pressed);
    screenTex.needsUpdate = true;
  };

  const poseCards = (t: number) => {
    cards.forEach((c, i) => {
      const p = cardProgress(t, i);
      c.g.visible = p > 0;
      if (!c.g.visible) return;
      const d = dest[i];
      c.g.position.lerpVectors(c.from, d, p);
      c.g.position.z += Math.sin(Math.PI * p) * 10;
      c.g.scale.setScalar(1 + (c.scale - 1) * p);
      c.g.rotation.set(0, Math.sin(Math.PI * p) * 0.35, Math.PI * 2 * p);
    });
  };

  const pose = (t: number) => {
    // once the page has flown out, the empty screen dims so the cards stand out
    const empty = span(t, T.cardsFrom + 0.6, T.cardsFrom + 2.6);
    screenMat.emissiveIntensity = 0.62 - 0.4 * empty;
    glow.intensity = 3.2 - 2.0 * empty;
    drawScreen(t);
    poseCards(t);
  };

  return { root, anchors, pose };
};
