import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { phaseAt, totalFrames } from "../episode/timeline";
import type { EpisodeProps } from "../episode/types";
import { clamp, colors, mono, sans } from "../theme";
import { BandTexture, BurnBand, makeBandTexture } from "./BurnBand";
import { arcPoint, burnProgress, cameraPose, FIRST_YEAR, layoutArcs, R, ringRadius } from "./layout";
import { PostFX } from "./PostFX";
import { WoodDisc } from "./WoodDisc";

export const ringsDuration = (p: EpisodeProps) => totalFrames(p.timing, p.stories.length);

const FOV = 40;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// The side of the log and the floor it stands on, so nothing beyond the
// cut face is empty black.
const LogBody: React.FC = () => (
  <>
    <mesh position={[0, -1.5, 0]}>
      <cylinderGeometry args={[R + 0.4, R + 0.55, 3, 256, 1, true]} />
      <meshBasicMaterial color="#1a0f08" />
    </mesh>
    <mesh position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial color="#070504" />
    </mesh>
  </>
);

const Camera: React.FC<{ pose: ReturnType<typeof cameraPose> }> = ({ pose }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    (camera as THREE.PerspectiveCamera).fov = FOV;
    camera.updateProjectionMatrix();
  }, [camera, pose]);
  return null;
};

// Builds every burned text texture once the web fonts are available to canvas.
const useBandTextures = (texts: Parameters<typeof makeBandTexture>[0][]) => {
  const [bands, setBands] = useState<BandTexture[] | null>(null);
  const [handle] = useState(() => delayRender("band textures"));
  const key = JSON.stringify(texts);
  useEffect(() => {
    Promise.all([document.fonts.load(`900 88px ${sans}`), document.fonts.load(`700 42px ${mono}`)])
      .then(() => setBands(texts.map(makeBandTexture)))
      .catch(cancelRender);
    // texts is captured through key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (bands) continueRender(handle);
  }, [bands, handle]);
  return bands;
};

// "HN on this day" as a single shot over a tree's cross-section: one growth
// ring per HN year, the bark is today. The camera follows a burn that writes
// each year's story into its ring, spiralling in towards 2006, then rises.
export const Rings: React.FC<EpisodeProps> = ({ currentYear, hook, stories: picked, outro, timing }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const stories = useMemo(() => [...picked].sort((a, b) => b.year - a.year), [picked]); // into the past
  const n = stories.length;

  const texts = useMemo(
    () => [
      { lines: [{ text: `${hook.kicker ?? ""}  ${hook.title}`, font: `900 ${sans}`, size: 88 }] },
      ...stories.map((s) => ({
        lines: [
          { text: String(s.year), font: `700 ${mono}`, size: 64 },
          ...s.zh.split("\n").map((line) => ({ text: line, font: `900 ${sans}`, size: 84 })),
          { text: `${clip(s.title, 34)}  ▲${s.score}`, font: `500 ${mono}`, size: 36 },
        ],
      })),
      { lines: [{ text: outro.title, font: `900 ${sans}`, size: 88 }] },
    ],
    [hook, stories, outro],
  );
  const bands = useBandTextures(texts);

  const arcs = useMemo(() => {
    if (!bands) return null;
    const radii = [R - 0.85, ...stories.map((s) => ringRadius(s.year, currentYear))];
    const lead = bands.slice(0, n + 1);
    const chain = layoutArcs(
      radii,
      lead.map((b) => b.length),
      lead.map((b) => b.width),
      Math.PI * 0.62,
    );
    const coreR = ringRadius(FIRST_YEAR + 0.6, currentYear) + 0.45;
    const sweep = bands[n + 1].length / coreR;
    return {
      hook: chain[0],
      stories: chain.slice(1),
      outro: { r: coreR, start: Math.PI / 2 + sweep / 2, sweep, width: bands[n + 1].width },
    };
  }, [bands, stories, n, currentYear]);

  if (!bands || !arcs) return <AbsoluteFill style={{ backgroundColor: colors.bg }} />;

  const phase = phaseAt(frame, timing, n);
  const pose = cameraPose(frame, timing, arcs.hook, arcs.stories);

  // burn progress of every band at this frame
  const segment = timing.travelFrames + timing.holdFrames;
  const storyProgress = stories.map((_, i) => {
    const local = frame - timing.hookFrames - i * segment - timing.travelFrames;
    return local < 0 ? 0 : burnProgress(local, timing.holdFrames);
  });
  const hookProgress = burnProgress(frame, timing.hookFrames);
  const outroLocal = phase.kind === "outro" ? phase.local : -1;
  const outroProgress = outroLocal < 0 ? 0 : interpolate(outroLocal, [timing.outroFrames * 0.35, timing.outroFrames * 0.85], [0, 1], clamp);
  const afterglow = outroLocal < 0 ? 0 : interpolate(outroLocal, [timing.outroFrames * 0.2, timing.outroFrames * 0.6], [0, 1], clamp);

  // the active burn front lights the wood around it
  let front = arcPoint(arcs.hook, hookProgress);
  let glow = hookProgress < 1 ? 1 : 0;
  if (phase.kind === "hold") {
    const p = storyProgress[phase.index];
    front = arcPoint(arcs.stories[phase.index], p);
    glow = p < 1 ? 1 : 0;
  } else if (phase.kind === "travel") {
    glow = 0;
  } else if (phase.kind === "outro") {
    front = arcPoint(arcs.outro, outroProgress);
    glow = outroProgress > 0 && outroProgress < 1 ? 1 : 0;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas width={width} height={height} gl={{ antialias: true }}>
        <color attach="background" args={["#050403"]} />
        <Camera pose={pose} />
        <WoodDisc years={currentYear - FIRST_YEAR + 1} front={front} frontGlow={glow} focus={pose.target} />
        <BurnBand arc={arcs.hook} texture={bands[0].texture} progress={hookProgress} afterglow={afterglow} />
        {arcs.stories.map((arc, i) => (
          <BurnBand key={i} arc={arc} texture={bands[i + 1].texture} progress={storyProgress[i]} afterglow={afterglow} />
        ))}
        <BurnBand arc={arcs.outro} texture={bands[n + 1].texture} progress={outroProgress} afterglow={0} />
        <LogBody />
        <PostFX />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
