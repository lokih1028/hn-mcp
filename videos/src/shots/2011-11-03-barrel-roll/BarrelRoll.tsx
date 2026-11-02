import { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { FrontPageItem } from "../../spike/textures";
import { CamKey, cameraPath } from "../common/camera";
import { Callout, Callouts, TitleBlock } from "../common/Overlay";
import { makeRig, useStage } from "../common/stage";
import { buildDesk } from "./desk";

export const SECONDS = 14;

// Target points are in desk coordinates (cm): the screen's centre is at
// (0, 36, 1.2); the first HN title sits near (-15, 47.6).
const KEYS: CamKey[] = [
  // the 2011 front page, close: "1. Do a barrel roll"
  { t: 0, yaw: 0.2, pitch: -0.04, roll: 0.03, dist: 30, target: [-17.5, 47.2, 1.2], fov: 24, focusRange: 4, bokeh: 2.6 },
  { t: 2.3, yaw: 0.12, pitch: -0.05, roll: 0.01, dist: 36, target: [-13.5, 47, 1.2], fov: 24, focusRange: 6, bokeh: 2.2 },
  // the click loads Google; pull back to the whole desk
  { t: 3.7, yaw: 0.06, pitch: -0.14, roll: 0, dist: 265, target: [0, 30, 8], fov: 24, focusRange: 60, bokeh: 1.2 },
  // in on the screen while the page rolls
  { t: 4.6, yaw: 0.02, pitch: -0.08, roll: 0, dist: 175, target: [0, 35, 2], fov: 24, focusRange: 60, bokeh: 1.0 },
  { t: 6.3, yaw: -0.04, pitch: -0.08, roll: 0, dist: 165, target: [0, 35, 4], fov: 24, focusRange: 60, bokeh: 1.0 },
  // the page comes apart and lines up in front of the monitor
  { t: 8.2, yaw: -0.36, pitch: -0.1, roll: 0, dist: 172, target: [-3, 36, 15], fov: 24, focusRange: 50, bokeh: 1.2 },
  { t: 10.2, yaw: -0.5, pitch: -0.1, roll: 0, dist: 178, target: [-7, 37, 16], fov: 24, focusRange: 50, bokeh: 1.2 },
  { t: 14, yaw: -0.45, pitch: -0.09, roll: 0, dist: 172, target: [-7, 37, 16], fov: 24, focusRange: 50, bokeh: 1.2 },
];
const cameraAt = cameraPath(KEYS);

// all on the left, in one column; the cards sit on the right
const LX = 330;
const CALLOUTS: Callout[] = [
  { key: "bar-left", title: "黑色导航栏", sub: "2011 年 6 月上线", dx: 0, dy: -40, x: LX, at: 9.6 },
  { key: "header-left", title: "搜这一句", sub: "整个页面就会转一圈", dx: 0, dy: 45, x: LX, at: 9.95 },
  { key: "r1-left", title: "1997 年的游戏梗", sub: "出自任天堂《星际火狐 64》", dx: 0, dy: 0, x: LX, at: 10.3 },
  { key: "r2-left", title: "其实是副翼滚转", sub: "aileron roll，不是 barrel roll", dx: 0, dy: 0, x: LX, at: 10.65 },
  { key: "code-left", title: "一行 CSS3 实现", sub: "transform: rotate(360deg)", dx: 0, dy: 0, x: LX, at: 11.0, mono: true },
]

export const BarrelRoll: React.FC<{ items: FrontPageItem[] }> = ({ items }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useMemo(() => {
    const desk = buildDesk(items);
    const rig = makeRig(desk.root, { width, height });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0d0f13");
    scene.add(rig.root);
    return { desk, rig, scene };
  }, [items, width, height]);
  const { desk, rig, scene } = world;

  const cam = cameraAt(t);
  desk.pose(t);
  rig.pose(cam);
  useStage(canvasRef, scene, rig.camera, frame, cam, { width, height, environment: 0.3 });

  const callouts = CALLOUTS.filter((c) => desk.anchors[c.key]).map((c) => {
    const [ax, ay] = rig.project(desk.anchors[c.key]);
    return { ...c, ax, ay };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0f13" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width, height }} />
      <AbsoluteFill style={{ background: "radial-gradient(85% 65% at 50% 55%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)" }} />
      <Callouts t={t} items={callouts} />
      <TitleBlock
        t={t}
        date="2011.11.03"
        points={486}
        comments={104}
        title="Do a barrel roll"
        sub="在 Google 搜这句话，整个页面会翻滚一圈"
        titleAt={3.3}
        subAt={3.9}
        statsAt={9.0}
        captionUntil={3.0}
      />
    </AbsoluteFill>
  );
};
