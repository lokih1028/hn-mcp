import { Easing, interpolate } from "remotion";
import { phaseAt, Timing } from "../episode/timeline";

// Camera flies down -z. Story i has its portal at portalZ(i); the camera
// warps in from the previous portal, then hovers in front of this one while
// the story's text is on screen.

export const SPACING = 44; // world units between portals
export const HOLD_NEAR = 11; // camera distance from the portal at the end of a hold (portal ~80% of the frame)
export const HOLD_FAR = 13.5; // ... and at its start
export const FOV = 52;
export const PORTAL_W = 4.6;
export const PORTAL_H = (PORTAL_W * 16) / 9;

export const portalZ = (i: number) => -(i + 1) * SPACING;

const warp = Easing.inOut(Easing.cubic);
const drift = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const cameraZ = (frame: number, t: Timing, stories: number): number => {
  const p = phaseAt(frame, t, stories);
  const holdStart = (i: number) => portalZ(i) + HOLD_FAR;
  const holdEnd = (i: number) => portalZ(i) + HOLD_NEAR;
  switch (p.kind) {
    case "hook":
      return interpolate(p.local, [0, t.hookFrames], [SPACING * 0.6, 12], drift);
    case "travel": {
      const from = p.index === 0 ? 12 : holdEnd(p.index - 1);
      return from + (holdStart(p.index) - from) * warp(p.local / t.travelFrames);
    }
    case "hold":
      return interpolate(p.local, [0, t.holdFrames], [holdStart(p.index), holdEnd(p.index)], {
        ...drift,
        easing: Easing.out(Easing.quad),
      });
    case "outro": {
      const from = holdEnd(stories - 1);
      return from - SPACING * 1.5 * Easing.in(Easing.cubic)(Math.min(1, p.local / t.outroFrames));
    }
  }
};

// Where the camera is and what it looks at; shared by the 3D scene and by the
// 2D video layer that has to line up with a portal on screen.
export const cameraPose = (frame: number, t: Timing, stories: number) => {
  const z = cameraZ(frame, t, stories);
  const sway = frame / 40;
  return {
    position: [Math.sin(sway) * 0.25, Math.cos(sway * 0.7) * 0.18, z] as const,
    target: [0, 0, z - 10] as const,
  };
};

// World units per frame, used to stretch stars into warp streaks.
export const cameraSpeed = (frame: number, t: Timing, stories: number) =>
  Math.abs(cameraZ(frame + 1, t, stories) - cameraZ(frame, t, stories));
