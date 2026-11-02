import {
  BlendFunction,
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
} from "postprocessing";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mono, sans } from "../theme";
import { buildPhone } from "./phone";
import { cameraAt, explodeAt } from "./shot";
import type { FrontPageItem } from "./textures";

const SS = 2; // supersampling factor
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type TeardownShotProps = { items: FrontPageItem[] };

type Label = { key: string; zh: string; sub: string; dx: number; dy: number };

// dx, dy: where the label sits relative to its anchor on screen (px).
const LABELS: Label[] = [
  { key: "truedepth", zh: "原深感摄像头", sub: "30,000 个红外点", dx: -170, dy: -40 },
  { key: "a11", zh: "A11 仿生", sub: "双层堆叠主板", dx: -250, dy: 0 },
  { key: "battery", zh: "L 形双电芯", sub: "2716 mAh", dx: -170, dy: -10 },
  { key: "display", zh: "OLED 全面屏", sub: "像翻书一样打开", dx: 20, dy: 210 },
]
const LABEL_START = 9.4;
const LABEL_STEP = 0.32;

const scene3d = (items: FrontPageItem[]) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b0f12");
  const phone = buildPhone(items);
  const yaw = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.add(phone.root);
  yaw.add(tilt);
  scene.add(yaw);

  // lights live with the phone, so the camera moves and the lighting holds
  const key = new THREE.DirectionalLight("#fff3e2", 3.4);
  key.position.set(-14, 16, 30);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -16;
  sc.right = sc.top = 16;
  sc.near = 1;
  sc.far = 90;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 9;
  key.shadow.blurSamples = 20;
  const rim = new THREE.DirectionalLight("#9fbcff", 2.2);
  rim.position.set(18, -10, 14);
  const fill = new THREE.DirectionalLight("#ffb070", 0.5);
  fill.position.set(-20, -16, 8);
  phone.root.add(key, key.target, rim, fill);

  const camera = new THREE.PerspectiveCamera(24, 1080 / 1920, 0.5, 400);
  return { scene, phone, yaw, tilt, camera };
};

export const TeardownShot: React.FC<TeardownShotProps> = ({ items }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gl = useRef<{ renderer: THREE.WebGLRenderer; composer: EffectComposer; dof: DepthOfFieldEffect } | null>(null);
  const world = useMemo(() => scene3d(items), [items]);
  const { scene, phone, yaw, tilt, camera } = world;

  // pose everything for this frame
  const cam = cameraAt(t);
  phone.setExplode(explodeAt(t));
  const hl = interpolate(t, [0.15, 0.7, 2.6, 3.6], [0, 0.3, 0.3, 0], clamp);
  (phone.highlight.material as THREE.MeshBasicMaterial).opacity = hl * (0.85 + 0.15 * Math.sin(t * 5));
  yaw.rotation.y = cam.yaw;
  tilt.rotation.set(cam.pitch, 0, cam.roll);
  scene.updateMatrixWorld(true);
  const target = phone.root.localToWorld(new THREE.Vector3(...cam.target));
  camera.fov = cam.fov;
  camera.position.copy(target).add(new THREE.Vector3(0, 0, cam.dist));
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const project = (o: THREE.Object3D) => {
    const v = o.getWorldPosition(new THREE.Vector3()).project(camera);
    return [((v.x + 1) / 2) * 1080, ((1 - v.y) / 2) * 1920] as const;
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(1);
    renderer.setSize(1080 * SS, 1920 * SS, false);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    scene.environmentIntensity = 0.55;

    const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(scene, camera));
    const dof = new DepthOfFieldEffect(camera, { focusDistance: 10, focusRange: 5, bokehScale: 2, resolutionScale: 0.5 });
    const bloom = new BloomEffect({ intensity: 0.2, luminanceThreshold: 0.93, luminanceSmoothing: 0.15, mipmapBlur: true });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = 0.09;
    composer.addPass(new EffectPass(camera, dof));
    composer.addPass(new EffectPass(camera, bloom, noise));
    composer.setSize(1080 * SS, 1920 * SS);
    gl.current = { renderer, composer, dof };
    return () => {
      composer.dispose();
      renderer.dispose();
      gl.current = null;
    };
  }, [scene, camera]);

  useLayoutEffect(() => {
    const g = gl.current;
    if (!g) return;
    g.dof.cocMaterial.focusDistance = cam.dist;
    g.dof.cocMaterial.focusRange = cam.focusRange;
    g.dof.bokehScale = cam.bokeh;
    g.composer.render();
  }, [frame, cam.dist, cam.focusRange, cam.bokeh]);

  const titleIn = interpolate(t, [3.1, 3.8], [0, 1], clamp);
  const subIn = interpolate(t, [4.4, 5.0], [0, 1], clamp);
  const statsIn = interpolate(t, [8.6, 9.2], [0, 1], clamp);
  const capIn = interpolate(t, [0.3, 0.8, 2.6, 3.1], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0f12" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }} />
      <AbsoluteFill style={{ background: "radial-gradient(85% 65% at 50% 55%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,7,9,0.85) 0%, rgba(5,7,9,0.45) 16%, rgba(5,7,9,0) 26%)", opacity: titleIn }} />

      {/* labels */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {LABELS.map((l, i) => {
          const a = phone.anchors[l.key];
          if (!a) return null;
          const p = interpolate(t, [LABEL_START + i * LABEL_STEP, LABEL_START + i * LABEL_STEP + 0.45], [0, 1], clamp);
          if (p <= 0) return null;
          const [ax, ay] = project(a);
          const lx = ax + l.dx;
          const ly = ay + l.dy;
          const len = Math.hypot(l.dx, l.dy);
          return (
            <g key={l.key} opacity={Math.min(1, p * 2)}>
              <line x1={ax} y1={ay} x2={lx} y2={ly} stroke="rgba(255,255,255,0.75)" strokeWidth={1.8} strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
              <circle cx={ax} cy={ay} r={5 * Math.min(1, p * 3)} fill="#fff" />
              <circle cx={ax} cy={ay} r={13 * p} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.4} />
            </g>
          );
        })}
      </svg>
      {LABELS.map((l, i) => {
        const a = phone.anchors[l.key];
        const p = interpolate(t, [LABEL_START + i * LABEL_STEP + 0.25, LABEL_START + i * LABEL_STEP + 0.6], [0, 1], clamp);
        if (!a || p <= 0) return null;
        const [ax, ay] = project(a);
        const right = l.dx > 0;
        const x = ax + l.dx + (right ? 12 : -12);
        const y = ay + l.dy;
        return (
          <div
            key={l.key}
            style={{
              position: "absolute",
              top: y - 30,
              ...(right ? { left: Math.min(x, 1080 - 40 - 230) } : { right: Math.min(1080 - x, 1080 - 40 - 230) }),
              width: 230,
              textAlign: right ? "left" : "right",
              color: "#f4f2ec",
              opacity: p,
              transform: `translateY(${(1 - p) * 10}px)`,
              textShadow: "0 2px 10px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 32, lineHeight: 1.1 }}>{l.zh}</div>
            <div style={{ fontFamily: sans, fontWeight: 400, fontSize: 21, marginTop: 6, color: "rgba(244,242,236,0.7)" }}>{l.sub}</div>
          </div>
        );
      })}

      {/* opening caption */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 210,
          display: "flex",
          justifyContent: "center",
          opacity: capIn,
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: "0.12em",
            color: "#fff",
            background: "rgba(10,10,12,0.82)",
            padding: "16px 30px",
            borderRadius: 999,
          }}
        >
          2017.11.03 · HACKER NEWS
        </div>
      </div>

      {/* title block */}
      <div style={{ position: "absolute", left: 60, top: 96, right: 60, color: "#f4f2ec" }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: "0.14em", color: "#ff6a1a", opacity: titleIn }}>
          HN 上的今天 · 2017.11.03
          <span style={{ color: "rgba(244,242,236,0.6)", fontWeight: 500, opacity: statsIn }}>  ▲407 · 362 评论</span>
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 900,
            fontSize: 92,
            lineHeight: 1.05,
            marginTop: 16,
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 24}px)`,
          }}
        >
          iPhone X 拆解
        </div>
        <div style={{ fontFamily: sans, fontWeight: 400, fontSize: 34, marginTop: 14, color: "rgba(244,242,236,0.78)", opacity: subIn }}>
          开售当天，iFixit 就把它拆成了这样
        </div>
      </div>
    </AbsoluteFill>
  );
};
