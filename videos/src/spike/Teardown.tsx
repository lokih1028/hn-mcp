import { useEffect, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mono, sans } from "../theme";
import { buildPhone } from "./phone";
import type { FrontPageItem } from "./textures";

const SS = 2; // supersampling factor

export type TeardownProps = {
  lang: "zh" | "en";
  items: FrontPageItem[];
  view: { yaw: number; pitch: number; roll: number; fov: number; distance: number; targetY: number };
};

type Label = { key: string; zh: string; en: string; sub: string; side: "l" | "r" };

const LABELS: Label[] = [
  { key: "display", zh: "OLED 全面屏", en: "OLED display", sub: "5.8″ · 2436×1125", side: "r" },
  { key: "truedepth", zh: "原深感摄像头", en: "TrueDepth", sub: "30,000 IR DOTS", side: "l" },
  { key: "camera", zh: "竖排双摄", en: "Dual camera", sub: "WIDE + TELE", side: "r" },
  { key: "a11", zh: "A11 仿生", en: "A11 Bionic", sub: "STACKED BOARD", side: "r" },
  { key: "battery", zh: "L 形双电芯", en: "L-shaped battery", sub: "2716 mAh", side: "l" },
  { key: "coil", zh: "无线充电", en: "Wireless charging", sub: "QI COIL", side: "l" },
  { key: "taptic", zh: "Taptic 马达", en: "Taptic Engine", sub: "LINEAR ACTUATOR", side: "l" },
]

type Placed = Label & { ax: number; ay: number; ly: number };

// Spreads labels on one side so they never overlap, keeping each as close
// to its anchor's height as possible.
const spread = (ls: Placed[], gap: number, top: number, bottom: number) => {
  ls.sort((a, b) => a.ay - b.ay);
  let y = top;
  for (const l of ls) {
    l.ly = Math.max(l.ay, y);
    y = l.ly + gap;
  }
  let over = y - gap - bottom;
  for (let i = ls.length - 1; i >= 0 && over > 0; i--) {
    const next = i === ls.length - 1 ? bottom : ls[i + 1].ly - gap;
    const ny = Math.min(ls[i].ly, next);
    over -= ls[i].ly - ny;
    ls[i].ly = ny;
  }
};

export const Teardown: React.FC<TeardownProps> = ({ lang, items, view }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [labels, setLabels] = useState<Placed[] | null>(null);
  const [handle] = useState(() => delayRender("teardown"));

  useEffect(() => {
    const canvas = ref.current!;
    let renderer: THREE.WebGLRenderer | null = null;
    (async () => {
      await document.fonts.ready;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(1080 * SS, 1920 * SS, false);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.VSMShadowMap;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
      scene.environmentIntensity = 0.75;

      const { root, anchors } = buildPhone(items);
      const yaw = new THREE.Group();
      const tilt = new THREE.Group();
      tilt.rotation.set(view.pitch, 0, view.roll);
      yaw.rotation.y = view.yaw;
      tilt.add(root);
      yaw.add(tilt);
      // centre the exploded stack on the origin
      root.position.set(0, 0, -6.6);
      scene.add(yaw);

      const key = new THREE.DirectionalLight("#fff6ea", 2.4);
      key.position.set(-14, 26, 20);
      key.castShadow = true;
      key.shadow.mapSize.set(4096, 4096);
      const sc = key.shadow.camera;
      sc.left = sc.bottom = -13;
      sc.right = sc.top = 13;
      sc.near = 1;
      sc.far = 80;
      key.shadow.bias = -0.0003;
      key.shadow.normalBias = 0.015;
      key.shadow.radius = 10;
      key.shadow.blurSamples = 24;
      scene.add(key);
      const rim = new THREE.DirectionalLight("#a8c0ff", 1.6);
      rim.position.set(16, 8, -18);
      scene.add(rim);
      const warm = new THREE.DirectionalLight("#ffb36b", 0.6);
      warm.position.set(-18, -6, 6);
      scene.add(warm);

      const camera = new THREE.PerspectiveCamera(view.fov, 1080 / 1920, 1, 400);
      camera.position.set(0, view.targetY, view.distance);
      camera.lookAt(0, view.targetY, 0);
      scene.updateMatrixWorld(true);
      renderer.render(scene, camera);

      const placed: Placed[] = LABELS.filter((l) => anchors[l.key]).map((l) => {
        const v = anchors[l.key].getWorldPosition(new THREE.Vector3()).project(camera);
        return { ...l, ax: ((v.x + 1) / 2) * 1080, ay: ((1 - v.y) / 2) * 1920, ly: 0 };
      });
      spread(placed.filter((p) => p.side === "l"), 118, 560, 1760);
      spread(placed.filter((p) => p.side === "r"), 118, 560, 1760);
      setLabels(placed);
    })().catch(cancelRender);
    return () => renderer?.dispose();
  }, [items, view]);

  useEffect(() => {
    if (labels) continueRender(handle);
  }, [labels, handle]);

  const zh = lang === "zh";
  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 80% at 50% 58%, #26272c 0%, #121215 48%, #060607 100%)" }}>
      <canvas ref={ref} style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {labels?.map((l) => {
          const lx = l.side === "l" ? 236 : 844;
          const ex = l.side === "l" ? 236 : 844;
          return (
            <g key={l.key}>
              <polyline
                points={`${l.ax},${l.ay} ${ex + (l.ax - ex) * 0.25},${l.ly} ${l.side === "l" ? lx : lx},${l.ly}`}
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={1.6}
              />
              <circle cx={l.ax} cy={l.ay} r={5} fill="#fff" />
              <circle cx={l.ax} cy={l.ay} r={11} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.4} />
            </g>
          );
        })}
      </svg>
      {labels?.map((l) => (
        <div
          key={l.key}
          style={{
            position: "absolute",
            top: l.ly - 26,
            ...(l.side === "l" ? { left: 36, textAlign: "left" } : { right: 36, textAlign: "right" }),
            width: 200,
            color: "#f2f0eb",
          }}
        >
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: zh ? 28 : 25, lineHeight: 1.15 }}>{zh ? l.zh : l.en}</div>
          <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 15, letterSpacing: "0.06em", color: "rgba(242,240,235,0.55)", marginTop: 6 }}>{l.sub}</div>
        </div>
      ))}
      <div style={{ position: "absolute", left: 56, top: 92, right: 56, color: "#f2f0eb" }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: "0.18em", color: "#ff6a1a" }}>
          HACKER NEWS · 2017.11.03
        </div>
        <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 104, lineHeight: 1.05, marginTop: 22, letterSpacing: "-0.01em" }}>
          {zh ? "iPhone X 拆解" : "iPhone X Teardown"}
        </div>
        <div style={{ fontFamily: sans, fontWeight: 400, fontSize: 34, marginTop: 18, color: "rgba(242,240,235,0.72)" }}>
          {zh ? "开售当天，iFixit 就把它拆成了这样" : "On launch day, iFixit took it apart"}
        </div>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 22, marginTop: 20, color: "rgba(242,240,235,0.5)", letterSpacing: "0.06em" }}>
          <span style={{ color: "#ff6a1a" }}>▲</span> 407 POINTS · 362 COMMENTS
        </div>
      </div>
      <AbsoluteFill
        style={{ background: "radial-gradient(90% 70% at 50% 55%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)", pointerEvents: "none" }}
      />
    </AbsoluteFill>
  );
};
