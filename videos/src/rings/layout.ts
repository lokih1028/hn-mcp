import { Easing, interpolate } from "remotion";
import { phaseAt, Timing } from "../episode/timeline";

// The log: a cross-section of radius R in the xz plane. One growth ring per
// HN year: the pith is 2006 (HN's founding), the bark is the current year.

export const R = 10;
export const CORE = 0.55;
export const FIRST_YEAR = 2006;
const GAP = 0.55; // angle (radians) between one story's text and the next

export const ringRadius = (year: number, currentYear: number) =>
  CORE + ((R - CORE) * (year - FIRST_YEAR + 0.55)) / (currentYear - FIRST_YEAR + 1);

// Text is read left to right while the camera looks in from outside, which
// on screen is the direction of decreasing angle, so every arc runs clockwise.
export type Arc = { r: number; start: number; sweep: number; width: number }; // width: radial, world units

export const layoutArcs = (radii: number[], lengths: number[], widths: number[], firstAngle: number): Arc[] => {
  let angle = firstAngle;
  return radii.map((r, i) => {
    const sweep = lengths[i] / r;
    const arc = { r, start: angle, sweep, width: widths[i] };
    angle -= sweep + GAP;
    return arc;
  });
};

export const arcPoint = (arc: Arc, u: number, radius = arc.r) => {
  const a = arc.start - u * arc.sweep;
  return [radius * Math.cos(a), 0, radius * Math.sin(a)] as const;
};

// How far the burn has got along a band during its hold (finishes at 80%).
export const burnProgress = (local: number, holdFrames: number) =>
  interpolate(local, [4, holdFrames * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });

type CamState = { r: number; angle: number; height: number; back: number };

// Camera hovers outside the burn front, looking in and down at it.
const poseFrom = (s: CamState) => {
  const out = [Math.cos(s.angle), 0, Math.sin(s.angle)];
  const target = [s.r * out[0], 0, s.r * out[2]] as const;
  const position = [target[0] + out[0] * s.back, s.height, target[2] + out[2] * s.back] as const;
  return { position, target };
};

const HOLD_CAM = { height: 7.0, back: 1.8 };

// The camera frames the whole band and drifts only slightly while it burns;
// it aims inside the ring so the text sits low and the wood fills the shot.
const holdState = (arc: Arc, u: number): CamState => ({
  r: arc.r - 0.7,
  angle: arc.start - (0.42 + 0.16 * u) * arc.sweep,
  ...HOLD_CAM,
});

const mix = (a: CamState, b: CamState, t: number): CamState => ({
  r: a.r + (b.r - a.r) * t,
  angle: a.angle + (b.angle - a.angle) * t,
  height: a.height + (b.height - a.height) * t,
  back: a.back + (b.back - a.back) * t,
});

// One continuous camera move: follow the hook's burn on the bark, spiral in
// to each story's ring and ride its burn front, then rise to see the whole log.
export const cameraPose = (frame: number, t: Timing, hookArc: Arc, arcs: Arc[]) => {
  const n = arcs.length;
  const p = phaseAt(frame, t, n);
  const glide = Easing.inOut(Easing.cubic);
  switch (p.kind) {
    case "hook":
      return poseFrom(holdState(hookArc, burnProgress(p.local, t.hookFrames)));
    case "travel": {
      const from = holdState(p.index === 0 ? hookArc : arcs[p.index - 1], 1);
      return poseFrom(mix(from, holdState(arcs[p.index], 0), glide(p.local / t.travelFrames)));
    }
    case "hold":
      return poseFrom(holdState(arcs[p.index], burnProgress(p.local, t.holdFrames)));
    case "outro": {
      const from = poseFrom(holdState(arcs[n - 1], 1));
      const k = glide(Math.min(1, p.local / (t.outroFrames * 0.7)));
      const lerp = (a: readonly number[], b: readonly number[]) => a.map((v, i) => v + (b[i] - v) * k);
      return {
        position: lerp(from.position, [0, 30, 4.5]) as unknown as readonly [number, number, number],
        target: lerp(from.target, [0, 0, 0.5]) as unknown as readonly [number, number, number],
      };
    }
  }
};
