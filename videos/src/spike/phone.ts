import * as THREE from "three";
import { flatRect, ribbon, rng, roundedRectPath, slab } from "./geometry";
import {
  batteryTexture,
  chipTexture,
  coilTexture,
  FrontPageItem,
  matTexture,
  meshTexture,
  panelBackTexture,
  screenTexture,
  housingTexture,
  shieldTexture,
  stickerTexture,
} from "./textures";

// iPhone X, exploded. Units: 1 = 10 mm. Local axes: x across the phone, y
// along it (top = +y), z out of the display.
export const W = 7.09;
export const H = 14.36;
export const T = 0.77;
const R = 1.0;

// How far each layer floats above the rear case.
export const LAYERS = { coil: 1.7, lower: 3.5, upper: 5.6 };

const mats = () => ({
  steel: new THREE.MeshPhysicalMaterial({ color: "#d9dadd", metalness: 1, roughness: 0.14 }),
  backGlass: new THREE.MeshPhysicalMaterial({ color: "#e8e6e0", roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 }),
  inner: new THREE.MeshStandardMaterial({ color: "#45474c", metalness: 0.75, roughness: 0.42 }),
  innerDark: new THREE.MeshStandardMaterial({ color: "#26272b", metalness: 0.6, roughness: 0.5 }),
  plastic: new THREE.MeshStandardMaterial({ color: "#141416", roughness: 0.55 }),
  antenna: new THREE.MeshStandardMaterial({ color: "#9a9ba0", roughness: 0.5 }),
  board: new THREE.MeshPhysicalMaterial({ color: "#0e1a22", roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
  boardEdge: new THREE.MeshStandardMaterial({ color: "#6a5a32", roughness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: "#e0aa48", metalness: 1, roughness: 0.28 }),
  flex: new THREE.MeshPhysicalMaterial({
    color: "#c8701a",
    roughness: 0.3,
    clearcoat: 0.6,
    side: THREE.DoubleSide,
  }),
  flexBlack: new THREE.MeshStandardMaterial({ color: "#1b1b1d", roughness: 0.5, side: THREE.DoubleSide }),
  lens: new THREE.MeshPhysicalMaterial({
    color: "#05050a",
    roughness: 0.02,
    metalness: 0,
    clearcoat: 1,
    iridescence: 1,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [250, 600],
  }),
  brushed: new THREE.MeshPhysicalMaterial({ color: "#aeb0b4", metalness: 1, roughness: 0.48 }),
  capTan: new THREE.MeshStandardMaterial({ color: "#a8875a", roughness: 0.5 }),
  capDark: new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.5 }),
  copper: new THREE.MeshStandardMaterial({ color: "#c9824a", metalness: 1, roughness: 0.3 }),
  foam: new THREE.MeshStandardMaterial({ color: "#2c2c2f", roughness: 0.9 }),
});
type Mats = ReturnType<typeof mats>;

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};

const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, r = 0.03) =>
  mesh(slab(w, h, d, Math.min(r, w / 2, h / 2), Math.min(0.012, d / 3)), m, x, y, z);

// A textured decal lying on a surface (top face at z).
const decal = (w: number, h: number, r: number, map: THREE.Texture, z: number, opts: THREE.MeshStandardMaterialParameters = {}, x = 0, y = 0) => {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.4, ...opts });
  const o = mesh(flatRect(w, h, r), m, x, y, z + 0.002);
  o.castShadow = false;
  return o;
};

const anchor = (parent: THREE.Object3D, name: string, x: number, y: number, z: number, anchors: Record<string, THREE.Object3D>) => {
  const a = new THREE.Object3D();
  a.position.set(x, y, z);
  parent.add(a);
  anchors[name] = a;
};

const rearCase = (m: Mats, anchors: Record<string, THREE.Object3D>) => {
  const g = new THREE.Group();
  const wall = 0.11;
  // stainless steel band
  g.add(mesh(slab(W, H, T, R, 0.06, [roundedRectPath(W - 2 * wall, H - 2 * wall, R - wall)]), m.steel));
  // glass back, fused into the band
  g.add(mesh(slab(W - 0.06, H - 0.06, 0.09, R - 0.03, 0.03), m.backGlass, 0, 0, -T / 2 + 0.05));
  // inner housing floor
  g.add(mesh(slab(W - 2 * wall, H - 2 * wall, 0.05, R - wall, 0.01), m.inner, 0, 0, -T / 2 + 0.13));
  g.add(decal(W - 2 * wall - 0.05, H - 2 * wall - 0.05, R - wall, housingTexture(), -T / 2 + 0.155, { metalness: 0.7, roughness: 0.5 }));
  // antenna flex running up the right side of the housing
  g.add(mesh(ribbon([new THREE.Vector3(2.95, -6.4, -T / 2 + 0.2), new THREE.Vector3(3.05, -2, -T / 2 + 0.2), new THREE.Vector3(2.95, 3.6, -T / 2 + 0.2)], 0.22), m.flex));
  // ribs, standoffs and screw bosses moulded into the housing
  const floor = -T / 2 + 0.16;
  for (const [x, y, w, h] of [
    [0, 4.2, W - 0.4, 0.06],
    [0, -4.85, W - 0.4, 0.06],
    [0.28, 0, 0.06, 9.0],
  ] as const)
    g.add(box(w, h, 0.12, m.innerDark, x, y, floor + 0.06, 0.02));
  for (const [x, y] of [
    [-3.05, 6.6], [3.05, 6.6], [-3.05, -6.6], [3.05, -6.6], [0.28, 4.2], [3.0, 4.2], [-3.0, -4.85], [3.0, -4.85], [0.28, -1.2],
  ])
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 20).rotateX(Math.PI / 2), m.gold, x, y, floor + 0.1));
  // camera window in the housing
  g.add(mesh(slab(1.15, 2.35, 0.03, 0.5, 0.01), m.plastic, 2.15, 5.45, floor + 0.01));
  // antenna lines across the band
  for (const y of [5.9, -5.9])
    for (const x of [-W / 2 + 0.005, W / 2 - 0.005]) g.add(box(0.03, 0.09, T - 0.1, m.antenna, x, y, 0, 0.01));
  for (const y of [H / 2 - 0.005, -H / 2 + 0.005]) for (const x of [-2.6, 2.6]) g.add(box(0.09, 0.03, T - 0.1, m.antenna, x, y, 0, 0.01));
  // side button, volume buttons, ring/silent switch
  const button = (side: number, y: number, len: number) => g.add(box(0.1, len, 0.3, m.steel, side * (W / 2 + 0.03), y, 0.02, 0.05));
  button(1, 2.9, 1.95);
  button(-1, 3.35, 1.05);
  button(-1, 2.05, 1.05);
  button(-1, 4.75, 0.5);
  // Lightning port and speaker grilles on the bottom edge
  g.add(box(0.85, 0.06, 0.26, m.plastic, 0, -H / 2 + 0.01, 0.0, 0.03));
  for (const s of [-1, 1])
    for (let i = 0; i < 6; i++)
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12), m.plastic, s * (0.85 + i * 0.17), -H / 2 + 0.01, 0));
  anchor(g, "frame", W / 2, -2.5, T / 2, anchors);
  return g;
};

const coil = (m: Mats, anchors: Record<string, THREE.Object3D>) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.04, 96).rotateX(Math.PI / 2), m.foam, 0, -0.6, 0));
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 96),
    new THREE.MeshStandardMaterial({ map: coilTexture(), metalness: 0.75, roughness: 0.35 }),
  );
  top.position.set(0, -0.6, 0.022);
  top.receiveShadow = true;
  g.add(top);
  // tail running up to the logic board connector
  g.add(mesh(ribbon([new THREE.Vector3(0, 1.5, 0.03), new THREE.Vector3(0.4, 2.4, 0.03), new THREE.Vector3(1.4, 2.8, 0.03)], 0.32), m.copper));
  anchor(g, "coil", -1.6, -1.8, 0.03, anchors);
  return g;
};

const passives = (m: Mats, rand: () => number, x0: number, x1: number, y0: number, y1: number, keepOut: number[][], count: number, z: number) => {
  const g = new THREE.Group();
  const tan = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.032, 0.03), m.capTan, count);
  const dark = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.025, 0.022), m.capDark, count);
  const o = new THREE.Object3D();
  let a = 0;
  let b = 0;
  for (let i = 0; i < count * 6 && (a < count || b < count); i++) {
    const x = x0 + rand() * (x1 - x0);
    const y = y0 + rand() * (y1 - y0);
    if (keepOut.some(([kx, ky, kw, kh]) => Math.abs(x - kx) < kw / 2 + 0.05 && Math.abs(y - ky) < kh / 2 + 0.05)) continue;
    o.position.set(x, y, z + 0.015);
    o.rotation.set(0, 0, rand() < 0.5 ? 0 : Math.PI / 2);
    o.updateMatrix();
    if (rand() < 0.62 && a < count) tan.setMatrixAt(a++, o.matrix);
    else if (b < count) dark.setMatrixAt(b++, o.matrix);
  }
  tan.count = a;
  dark.count = b;
  tan.castShadow = dark.castShadow = true;
  g.add(tan, dark);
  return g;
};

// One half of the stacked logic board.
const board = (m: Mats, upper: boolean, anchors: Record<string, THREE.Object3D>) => {
  const g = new THREE.Group();
  const bw = 2.75;
  const bh = 5.1;
  const cx = 1.77;
  const cy = 1.5;
  const t = 0.1;
  g.add(mesh(slab(bw, bh, t, 0.18, 0.012), m.board, cx, cy, 0));
  const z = t / 2;
  const rand = rng(upper ? 11 : 23);
  const chips: number[][] = [];
  const chip = (x: number, y: number, w: number, h: number, d: number, lines: string[]) => {
    chips.push([x, y, w, h]);
    g.add(box(w, h, d, m.plastic, x, y, z + d / 2, 0.02));
    g.add(decal(w - 0.02, h - 0.02, 0.02, chipTexture(lines), z + d, { roughness: 0.3 }, x, y));
  };
  const shield = (x: number, y: number, w: number, h: number) => {
    chips.push([x, y, w, h]);
    g.add(box(w, h, 0.14, m.brushed, x, y, z + 0.07, 0.03));
    g.add(decal(w - 0.06, h - 0.06, 0.02, shieldTexture(), z + 0.14, { metalness: 1, roughness: 0.3 }, x, y));
  };
  const connector = (x: number, y: number, w: number, h: number) => {
    chips.push([x, y, w, h]);
    g.add(box(w, h, 0.08, m.plastic, x, y, z + 0.04, 0.01));
    const pins = Math.floor(w / 0.06);
    for (let i = 0; i < pins; i++) g.add(box(0.025, h * 0.7, 0.012, m.gold, x - w / 2 + 0.05 + i * 0.06, y, z + 0.085, 0.004));
  };
  if (upper) {
    chip(1.55, 2.6, 1.45, 1.45, 0.12, ["APL1W72", "339S00434", "1739"]);
    chip(1.5, 0.75, 1.25, 1.6, 0.1, ["TOSHIBA", "THGBX7G8D4K", "LDXG"]);
    chip(2.75, 0.45, 0.5, 0.5, 0.06, ["338S", "00306"]);
    chip(2.75, 1.25, 0.45, 0.6, 0.06, ["USI", "170821"]);
    connector(2.0, 3.75, 1.2, 0.26);
    connector(0.95, -0.55, 0.9, 0.24);
    anchor(g, "a11", 1.55, 2.6, z + 0.12, anchors);
  } else {
    shield(1.45, 2.4, 1.7, 1.9);
    chip(2.0, 0.35, 1.15, 1.15, 0.1, ["QUALCOMM", "MDM9655"]);
    shield(1.05, 0.0, 0.7, 1.1);
    chip(2.85, 3.6, 0.6, 0.6, 0.06, ["338S", "00341"]);
    connector(1.0, 3.75, 0.9, 0.24);
    connector(2.4, -0.7, 1.0, 0.24);
  }
  // gold annular rings where the halves bolt together, and edge pads
  for (const [x, y] of [
    [0.55, 3.9], [3.0, 3.9], [0.55, -0.9], [3.0, -0.9],
  ])
    g.add(mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 20), m.gold, x, y, z));
  for (let i = 0; i < 22; i++) g.add(box(0.07, 0.035, 0.008, m.gold, 0.55 + i * 0.115, cy - bh / 2 + 0.08, z + 0.004, 0.005));
  g.add(passives(m, rand, cx - bw / 2 + 0.1, cx + bw / 2 - 0.1, cy - bh / 2 + 0.2, cy + bh / 2 - 0.12, chips, 340, z));
  if (!upper) {
    // interposer ring that sandwiches the two halves
    g.add(mesh(slab(bw - 0.1, bh - 0.1, 0.22, 0.16, 0.01, [roundedRectPath(bw - 0.42, bh - 0.42, 0.06)]), m.boardEdge, cx, cy, z + 0.11));
  }
  return g;
};

const battery = (m: Mats, anchors: Record<string, THREE.Object3D>) => {
  const g = new THREE.Group();
  const d = 0.42;
  const blank = new THREE.MeshPhysicalMaterial({ color: "#17181a", roughness: 0.4, clearcoat: 0.4 });
  // long cell
  g.add(mesh(slab(3.2, 9.9, d, 0.12, 0.05), blank, -1.55, -0.2, 0));
  g.add(decal(3.1, 9.8, 0.1, batteryTexture(true), d / 2, { roughness: 0.4 }, -1.55, -0.2));
  // short cell
  g.add(mesh(slab(2.75, 3.3, d, 0.12, 0.05), blank, 1.77, -3.0, 0));
  g.add(decal(2.65, 3.2, 0.1, batteryTexture(false), d / 2, { roughness: 0.4 }, 1.77, -3.0));
  // battery flex
  g.add(mesh(ribbon([new THREE.Vector3(0.0, 4.4, d / 2 + 0.02), new THREE.Vector3(0.45, 4.75, d / 2 + 0.05), new THREE.Vector3(0.9, 4.6, 0.32)], 0.42), m.flexBlack));
  anchor(g, "battery", -1.55, 1.8, d / 2, anchors);
  return g;
};

const rearCamera = (m: Mats, anchors: Record<string, THREE.Object3D>) => {
  const g = new THREE.Group();
  g.add(box(1.05, 2.25, 0.5, m.brushed, 0, 0, 0, 0.12));
  for (const y of [0.55, -0.55]) {
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.34, 48).rotateX(Math.PI / 2), m.plastic, 0, y, 0.38));
    g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 48).rotateX(Math.PI / 2), m.steel, 0, y, 0.56));
    g.add(mesh(new THREE.SphereGeometry(0.3, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2.6).rotateX(Math.PI / 2), m.lens, 0, y, 0.48));
  }
  anchor(g, "camera", 0.5, 0, 0.5, anchors);
  return g;
};

const trueDepth = (m: Mats, anchors: Record<string, THREE.Object3D>) => {
  const g = new THREE.Group();
  g.add(box(3.4, 0.62, 0.32, m.brushed, 0, 0, 0, 0.1));
  const parts: [number, number, "round" | "square"][] = [
    [-1.3, 0.2, "round"], // infrared camera
    [-0.55, 0.13, "square"], // flood illuminator
    [0.25, 0.12, "round"], // proximity
    [0.85, 0.2, "round"], // front camera
    [1.4, 0.18, "square"], // dot projector
  ];
  for (const [x, r, kind] of parts) {
    const geo = kind === "round" ? new THREE.CylinderGeometry(r, r, 0.08, 40).rotateX(Math.PI / 2) : slab(r * 2, r * 2, 0.08, 0.03, 0.01);
    g.add(mesh(geo, m.plastic, x, 0, 0.2));
    const lens = kind === "round" ? new THREE.CircleGeometry(r * 0.72, 40) : flatRect(r * 1.4, r * 1.4, 0.02);
    g.add(mesh(lens, m.lens, x, 0, 0.245));
  }
  // earpiece speaker
  g.add(decal(0.9, 0.12, 0.05, meshTexture(), 0.17, {}, -0.1, -0.24));
  anchor(g, "truedepth", 1.4, 0.0, 0.25, anchors);
  return g;
};

const lowerModules = (m: Mats, anchors: Record<string, THREE.Object3D>) => {
  const g = new THREE.Group();
  // Taptic Engine
  g.add(box(2.6, 1.35, 0.38, m.brushed, -1.75, -5.75, 0, 0.1));
  g.add(decal(1.4, 0.5, 0.04, stickerTexture(["TAPTIC", "ENGINE"], "#1c1c1e", "#ddd"), 0.19, {}, -1.95, -5.75));
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16).rotateX(Math.PI / 2), m.gold, -0.6, -5.3, 0.2));
  // loudspeaker
  g.add(box(2.5, 1.35, 0.42, m.plastic, 1.8, -5.75, 0, 0.18));
  g.add(decal(1.9, 0.75, 0.1, meshTexture(), 0.21, {}, 1.8, -5.75));
  // Lightning connector flex along the bottom
  g.add(mesh(ribbon([new THREE.Vector3(-0.35, -6.75, 0), new THREE.Vector3(0.05, -6.6, 0.1), new THREE.Vector3(0.25, -5.3, 0.25), new THREE.Vector3(0.6, -4.0, 0.3)], 0.36), m.flex));
  anchor(g, "taptic", -2.6, -5.75, 0.19, anchors);
  return g;
};

const display = (m: Mats, items: FrontPageItem[], anchors: Record<string, THREE.Object3D>) => {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: "#050506", roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 });
  g.add(mesh(slab(W - 0.04, H - 0.04, 0.32, R - 0.02, 0.06), glass));
  const scr = screenTexture(items);
  const face = new THREE.Mesh(
    flatRect(W - 0.34, H - 0.34, R - 0.17),
    // a lit panel: its brightness comes from itself, not from the lights;
    // the clearcoat is the cover glass reflecting the room
    new THREE.MeshPhysicalMaterial({
      color: "#000000",
      emissiveMap: scr,
      emissive: "#ffffff",
      emissiveIntensity: 0.78,
      roughness: 0.9,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    }),
  );
  face.position.z = 0.162;
  face.receiveShadow = true;
  g.add(face);
  // a soft diagonal reflection across the cover glass
  const sheen = document.createElement("canvas");
  sheen.width = 256;
  sheen.height = 512;
  const sc = sheen.getContext("2d")!;
  const grad = sc.createLinearGradient(0, 512, 256, 0);
  grad.addColorStop(0.0, "rgba(255,255,255,0)");
  grad.addColorStop(0.42, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.62, "rgba(255,255,255,0.12)");
  grad.addColorStop(1.0, "rgba(255,255,255,0)");
  sc.fillStyle = grad;
  sc.fillRect(0, 0, 256, 512);
  const glare = new THREE.Mesh(
    flatRect(W - 0.1, H - 0.1, R - 0.05),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sheen), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glare.position.z = 0.17;
  g.add(glare);
  // the back of the panel, seen once the display swings open
  const back = new THREE.Mesh(flatRect(W - 0.3, H - 0.3, R - 0.15), new THREE.MeshStandardMaterial({ map: panelBackTexture(), roughness: 0.55, metalness: 0.35 }));
  back.position.z = -0.162;
  back.rotation.y = Math.PI;
  back.scale.x = -1;
  back.receiveShadow = true;
  g.add(back);
  // display flex cables, folded under the hinge edge; they straighten as it opens
  const flex = new THREE.Group();
  flex.position.set(W / 2 - 0.15, 0, -0.17);
  for (const [y, w] of [[2.2, 0.6], [0.9, 0.42]] as const)
    flex.add(mesh(ribbon([new THREE.Vector3(-1.4, y, -0.02), new THREE.Vector3(-0.5, y + 0.1, -0.03), new THREE.Vector3(0.05, y + 0.15, -0.16), new THREE.Vector3(-0.3, y + 0.2, -0.4)], w, new THREE.Vector3(0, 0, 1)), m.flex));
  g.add(flex);
  // highlight over one story on the screen
  const rows: [number, number][] = scr.userData.rows;
  const sw = W - 0.34;
  const sh = H - 0.34;
  const [r0, r1] = rows[1];
  const highlight = new THREE.Mesh(
    new THREE.PlaneGeometry(sw - 0.3, ((r1 - r0) / 2436) * sh),
    new THREE.MeshBasicMaterial({ color: "#ff6a00", transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending }),
  );
  highlight.position.set(0.05, sh / 2 - (((r0 + r1) / 2) / 2436) * sh, 0.165);
  g.add(highlight);
  anchor(g, "display", 0.0, -4.5, 0.17, anchors);
  anchor(g, "story", -0.5, highlight.position.y, 0.17, anchors);
  return { g, flex, highlight };
};

const MAT = 60; // the mat is MAT x MAT world units

// The repair mat the phone lies on, with tools and screws on it.
const bench = (m: Mats) => {
  const g = new THREE.Group();
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(MAT, MAT),
    new THREE.MeshStandardMaterial({ map: matTexture(MAT), roughness: 0.85, metalness: 0 }),
  );
  mat.receiveShadow = true;
  g.add(mat);
  const rand = rng(9);
  const onMat = (o: THREE.Object3D, x: number, y: number, rot: number, z = 0) => {
    o.position.set(x, y, z);
    o.rotation.z = rot;
    g.add(o);
    return o;
  };
  // screws: in the numbered trays and a few loose
  const screw = () => {
    const s = new THREE.Group();
    s.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 24).rotateX(Math.PI / 2), m.steel, 0, 0, 0.11));
    s.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.32, 12), m.steel, 0, 0.18, 0.05));
    s.rotation.x = 0.0;
    return s;
  };
  for (let tray = 0; tray < 4; tray++)
    for (let k = 0; k < 2 + (tray % 3); k++) onMat(screw(), 6.1 + rand() * 1.4, 5.6 - tray * 2.4 - rand() * 1.0, rand() * 6.28);
  for (const [x, y] of [[-5.1, -3.2], [4.4, -8.6], [-4.6, 8.4]]) onMat(screw(), x, y, rand() * 6.28);
  // spudger
  const spudger = new THREE.Group();
  spudger.add(mesh(slab(0.42, 12.5, 0.28, 0.2, 0.08), new THREE.MeshStandardMaterial({ color: "#121214", roughness: 0.6 }), 0, 0, 0.14));
  onMat(spudger, -6.6, -1.0, 0.16);
  // opening picks, translucent coloured plastic
  const pick = (color: string) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.6);
    shape.quadraticCurveTo(1.3, 0.2, 0.9, -1.1);
    shape.quadraticCurveTo(0, -1.5, -0.9, -1.1);
    shape.quadraticCurveTo(-1.3, 0.2, 0, 1.6);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.02, bevelSegments: 2 });
    return mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, transmission: 0.6, thickness: 0.2, transparent: true, opacity: 0.9 }));
  };
  onMat(pick("#3c7bff"), -6.2, 7.2, 0.7, 0.01);
  onMat(pick("#b45cff"), -7.4, 5.8, -0.4, 0.06);
  // suction handle
  const suction = new THREE.Group();
  suction.add(mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.18, 64).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: "#2f74e0", roughness: 0.4, transmission: 0.3, thickness: 0.5 }), 0, 0, 0.09));
  suction.add(mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.6, 32).rotateX(Math.PI / 2), m.plastic, 0, 0, 0.45));
  suction.add(mesh(new THREE.TorusGeometry(0.7, 0.12, 16, 48), m.plastic, 0, 0, 1.0));
  onMat(suction, 7.2, 8.6, 0);
  // precision screwdriver
  const driver = new THREE.Group();
  driver.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.6, 6).rotateZ(Math.PI / 2), m.plastic, 0, 0, 0.42));
  driver.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 16).rotateZ(Math.PI / 2), m.steel, 3.9, 0, 0.42));
  driver.add(mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.5, 32).rotateZ(Math.PI / 2), m.brushed, -2.5, 0, 0.42));
  onMat(driver, 4.8, -10.6, 0.35);
  return g;
};

// Closed (assembled) and exploded heights of each moving layer.
const CLOSED = { coil: -0.2, lower: 0.0, upper: 0.18 };
const DISPLAY_Z = 0.24;
const OPEN_ANGLE = (104 * Math.PI) / 180;

export type Phone = ReturnType<typeof buildPhone>;

export const buildPhone = (items: FrontPageItem[]) => {
  const m = mats();
  const anchors: Record<string, THREE.Object3D> = {};
  const root = new THREE.Group();
  const add = (o: THREE.Object3D) => {
    root.add(o);
    return o;
  };
  add(rearCase(m, anchors));
  const b = bench(m);
  b.position.z = -T / 2 - 0.002;
  add(b);
  const coilLayer = add(coil(m, anchors));
  const lower = new THREE.Group();
  lower.add(battery(m, anchors));
  lower.add(board(m, false, anchors));
  const cam = rearCamera(m, anchors);
  cam.position.set(2.15, 5.45, 0.1);
  lower.add(cam);
  lower.add(lowerModules(m, anchors));
  add(lower);
  const upper = new THREE.Group();
  const upperBoard = board(m, true, anchors);
  anchor(upperBoard, "board", 3.1, 2.5, 0.05, anchors);
  upper.add(upperBoard);
  const td = trueDepth(m, anchors);
  td.position.set(-0.4, 6.55, 0);
  upper.add(td);
  add(upper);
  // the display opens like a book on a hinge along its right edge
  const disp = display(m, items, anchors);
  const hinge = new THREE.Group();
  hinge.position.set(W / 2 + 0.02, 0, DISPLAY_Z);
  disp.g.position.x = -(W / 2 + 0.02);
  hinge.add(disp.g);
  add(hinge);

  const layers = { coil: coilLayer, lower, upper };
  // e: how far each layer has come apart, 0 = assembled, 1 = exploded
  const setExplode = (e: Record<keyof typeof LAYERS | "display", number>) => {
    for (const k of Object.keys(LAYERS) as (keyof typeof LAYERS)[]) layers[k].position.z = CLOSED[k] + (LAYERS[k] - CLOSED[k]) * e[k];
    hinge.rotation.y = OPEN_ANGLE * e.display;
    hinge.position.z = DISPLAY_Z + 0.35 * Math.sin(Math.PI * e.display);
    disp.flex.scale.set(1, 1, Math.max(0.05, e.display));
    // until the display lifts, nothing inside should show through the band
    lower.visible = upper.visible = coilLayer.visible = e.display > 0.002;
  };
  return { root, anchors, setExplode, highlight: disp.highlight };
};
