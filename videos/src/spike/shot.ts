import { Easing, interpolate } from "remotion";

// One continuous camera move, as keyframes of an orbit around a target
// point on the phone (object space). Values between keys follow a smooth
// cubic spline so the camera never stops dead on a key.

export type CamKey = {
  t: number; // seconds
  yaw: number;
  pitch: number;
  roll: number;
  dist: number;
  target: [number, number, number];
  fov: number;
  focusRange: number;
  bokeh: number;
};

export const KEYS: CamKey[] = [
  // tight on the lit screen, the 2017 front page
  { t: 0, yaw: 0.22, pitch: -0.42, roll: 0.06, dist: 7.5, target: [-0.6, 3.3, 0.3], fov: 22, focusRange: 1.4, bokeh: 3.0 },
  { t: 2.4, yaw: 0.14, pitch: -0.55, roll: 0.03, dist: 13, target: [-0.3, 2.4, 0.3], fov: 22, focusRange: 3, bokeh: 2.4 },
  // pull back: the whole phone on the mat
  { t: 4.0, yaw: -0.05, pitch: -0.82, roll: 0.0, dist: 34, target: [0, 0.3, 0.6], fov: 24, focusRange: 10, bokeh: 1.6 },
  // the display swings open, the insides lift; push in past the boards
  { t: 6.6, yaw: -0.36, pitch: -1.0, roll: -0.02, dist: 26, target: [1.0, 1.6, 4.4], fov: 24, focusRange: 7, bokeh: 2.0 },
  { t: 8.4, yaw: -0.46, pitch: -1.08, roll: -0.03, dist: 31, target: [0.6, 0.6, 3.8], fov: 24, focusRange: 10, bokeh: 1.6 },
  // settle on the full teardown
  { t: 10.4, yaw: -0.36, pitch: -1.08, roll: 0, dist: 56, target: [1.45, -1.0, 3.0], fov: 24, focusRange: 30, bokeh: 0.8 },
  { t: 14, yaw: -0.3, pitch: -1.05, roll: 0, dist: 54, target: [1.45, -1.0, 3.0], fov: 24, focusRange: 30, bokeh: 0.8 },
];

const vec = (k: CamKey) => [k.yaw, k.pitch, k.roll, Math.log(k.dist), ...k.target, k.fov, k.focusRange, k.bokeh];

// Cubic Hermite through the keys with Catmull-Rom tangents (zero at the ends).
export const cameraAt = (seconds: number) => {
  const ks = KEYS;
  const t = Math.min(Math.max(seconds, ks[0].t), ks[ks.length - 1].t);
  let i = 0;
  while (i < ks.length - 2 && t > ks[i + 1].t) i++;
  const p0 = vec(ks[i]);
  const p1 = vec(ks[i + 1]);
  const tangent = (j: number) => {
    if (j <= 0 || j >= ks.length - 1) return p0.map(() => 0);
    const a = vec(ks[j - 1]);
    const b = vec(ks[j + 1]);
    return a.map((v, n) => (b[n] - v) / (ks[j + 1].t - ks[j - 1].t));
  };
  const m0 = tangent(i);
  const m1 = tangent(i + 1);
  const h = ks[i + 1].t - ks[i].t;
  const s = (t - ks[i].t) / h;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
  const h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2;
  const h11 = s ** 3 - s ** 2;
  const v = p0.map((a, n) => h00 * a + h10 * h * m0[n] + h01 * p1[n] + h11 * h * m1[n]);
  return {
    yaw: v[0],
    pitch: v[1],
    roll: v[2],
    dist: Math.exp(v[3]),
    target: [v[4], v[5], v[6]] as [number, number, number],
    fov: v[7],
    focusRange: v[8],
    bokeh: v[9],
  };
};

const ease = Easing.bezier(0.65, 0, 0.25, 1);
const span = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

// How far each layer has lifted, in seconds: the display first, the coil last.
export const explodeAt = (t: number) => ({
  display: span(t, 4.0, 6.2),
  upper: span(t, 4.9, 6.9),
  lower: span(t, 5.3, 7.3),
  coil: span(t, 5.7, 7.7),
});

export const SHOT_SECONDS = 14;
