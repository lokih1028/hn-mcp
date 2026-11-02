import { Easing, interpolate } from "remotion";

// One continuous camera move, as keyframes of an orbit around a target point
// (in the subject's own coordinates). Values between keys follow a cubic
// Hermite spline with Catmull-Rom tangents, so the camera never stops dead on
// a key; distance is interpolated in log space so zooms feel even.

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

export type CamPose = Omit<CamKey, "t">;

const vec = (k: CamKey) => [k.yaw, k.pitch, k.roll, Math.log(k.dist), ...k.target, k.fov, k.focusRange, k.bokeh];

export const cameraPath = (keys: CamKey[]) => (seconds: number): CamPose => {
  const t = Math.min(Math.max(seconds, keys[0].t), keys[keys.length - 1].t);
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const p0 = vec(keys[i]);
  const p1 = vec(keys[i + 1]);
  const tangent = (j: number) => {
    if (j <= 0 || j >= keys.length - 1) return p0.map(() => 0);
    const a = vec(keys[j - 1]);
    const b = vec(keys[j + 1]);
    return a.map((v, n) => (b[n] - v) / (keys[j + 1].t - keys[j - 1].t));
  };
  const m0 = tangent(i);
  const m1 = tangent(i + 1);
  const h = keys[i + 1].t - keys[i].t;
  const s = (t - keys[i].t) / h;
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
    target: [v[4], v[5], v[6]],
    fov: v[7],
    focusRange: v[8],
    bokeh: v[9],
  };
};

const ease = Easing.bezier(0.65, 0, 0.25, 1);

// 0 before a, 1 after b, eased in between.
export const span = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
