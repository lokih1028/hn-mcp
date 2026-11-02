// Every daily template shares one timeline: a hook, then per story a
// transition ("travel") followed by a pause on the story ("hold"), then an outro.

export type Timing = { hookFrames: number; travelFrames: number; holdFrames: number; outroFrames: number };

export const totalFrames = (t: Timing, stories: number) =>
  t.hookFrames + stories * (t.travelFrames + t.holdFrames) + t.outroFrames;

export type Phase =
  | { kind: "hook"; local: number }
  | { kind: "travel"; index: number; local: number }
  | { kind: "hold"; index: number; local: number }
  | { kind: "outro"; local: number };

export const phaseAt = (frame: number, t: Timing, stories: number): Phase => {
  if (frame < t.hookFrames) return { kind: "hook", local: frame };
  let f = frame - t.hookFrames;
  const seg = t.travelFrames + t.holdFrames;
  const index = Math.floor(f / seg);
  if (index >= stories) return { kind: "outro", local: f - stories * seg };
  f -= index * seg;
  return f < t.travelFrames
    ? { kind: "travel", index, local: f }
    : { kind: "hold", index, local: f - t.travelFrames };
};

// First frame of story i's segment (its travel), for placing media sequences.
export const storyStart = (t: Timing, i: number) => t.hookFrames + i * (t.travelFrames + t.holdFrames);

// Which story the stage is showing: the one being travelled to or held, the
// first during the hook and the last during the outro.
export const activeIndex = (p: Phase, stories: number) =>
  p.kind === "hook" ? 0 : p.kind === "outro" ? stories - 1 : p.index;
