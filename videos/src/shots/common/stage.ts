import {
  BlendFunction,
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
} from "postprocessing";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { CamPose } from "./camera";

// Every shot is landscape from now on (the first two were portrait).
export const LANDSCAPE = { width: 1920, height: 1080, fps: 30 };
export const PORTRAIT = { width: 1080, height: 1920, fps: 30 };
export type Size = { width: number; height: number };

// The rig every shot uses: subject -> tilt -> yaw, camera on +z looking at a
// target point given in the subject's coordinates. Lights should be added to
// `subject` so they move with it and the camera seems to move instead.
export const makeRig = (subject: THREE.Object3D, { width, height }: Size) => {
  const yaw = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.add(subject);
  yaw.add(tilt);
  const camera = new THREE.PerspectiveCamera(24, width / height, 0.5, 2000);
  const pose = (p: CamPose) => {
    yaw.rotation.y = p.yaw;
    tilt.rotation.set(p.pitch, 0, p.roll);
    yaw.updateMatrixWorld(true);
    const target = subject.localToWorld(new THREE.Vector3(...p.target));
    camera.fov = p.fov;
    camera.position.copy(target).add(new THREE.Vector3(0, 0, p.dist));
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  };
  // screen position (px) of an object's origin
  const project = (o: THREE.Object3D) => {
    const v = o.getWorldPosition(new THREE.Vector3()).project(camera);
    return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height] as const;
  };
  return { root: yaw, camera, pose, project };
};

export type StageOptions = Size & {
  ss?: number; // supersampling factor
  environment?: number; // RoomEnvironment intensity
  bloom?: number;
};

// Renderer, environment light and post (depth of field, bloom, grain) on a
// canvas; renders once per frame after the scene has been posed.
export const useStage = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  frame: number,
  pose: CamPose,
  { width, height, ss = 2, environment = 0.55, bloom = 0.2 }: StageOptions,
) => {
  const gl = useRef<{
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    dof: DepthOfFieldEffect;
  } | null>(null);

  useLayoutEffect(() => {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current!,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width * ss, height * ss, false);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    scene.environmentIntensity = environment;

    const composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 0,
    });
    composer.addPass(new RenderPass(scene, camera));
    const dof = new DepthOfFieldEffect(camera, {
      focusDistance: 10,
      focusRange: 5,
      bokehScale: 2,
      resolutionScale: 0.5,
    });
    const glow = new BloomEffect({
      intensity: bloom,
      luminanceThreshold: 0.93,
      luminanceSmoothing: 0.15,
      mipmapBlur: true,
    });
    const noise = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
      premultiply: false,
    });
    noise.blendMode.opacity.value = 0.09;
    composer.addPass(new EffectPass(camera, dof));
    composer.addPass(new EffectPass(camera, glow, noise));
    composer.setSize(width * ss, height * ss);
    gl.current = { renderer, composer, dof };
    return () => {
      composer.dispose();
      renderer.dispose();
      gl.current = null;
    };
  }, [canvasRef, scene, camera, width, height, ss, environment, bloom]);

  useLayoutEffect(() => {
    const g = gl.current;
    if (!g) return;
    g.dof.cocMaterial.focusDistance = pose.dist;
    g.dof.cocMaterial.focusRange = pose.focusRange;
    g.dof.bokehScale = pose.bokeh;
    g.composer.render();
  }, [frame, pose.dist, pose.focusRange, pose.bokeh]);
};

// Key, rim and fill lights with soft shadows, attached to the subject.
export const studioLights = (
  subject: THREE.Object3D,
  {
    key = ["#fff3e2", 3.4, [-14, 16, 30]],
    rim = ["#9fbcff", 2.2, [18, -10, 14]],
    fill = ["#ffb070", 0.5, [-20, -16, 8]],
    shadowSize = 16,
  } = {} as {
    key?: [string, number, [number, number, number]];
    rim?: [string, number, [number, number, number]];
    fill?: [string, number, [number, number, number]];
    shadowSize?: number;
  },
) => {
  const k = new THREE.DirectionalLight(key[0], key[1]);
  k.position.set(...key[2]);
  k.castShadow = true;
  k.shadow.mapSize.set(4096, 4096);
  const sc = k.shadow.camera;
  sc.left = sc.bottom = -shadowSize;
  sc.right = sc.top = shadowSize;
  sc.near = 1;
  sc.far = Math.hypot(...key[2]) * 2.5;
  k.shadow.bias = -0.0004;
  k.shadow.normalBias = 0.02;
  k.shadow.radius = 9;
  k.shadow.blurSamples = 20;
  const r = new THREE.DirectionalLight(rim[0], rim[1]);
  r.position.set(...rim[2]);
  const f = new THREE.DirectionalLight(fill[0], fill[1]);
  f.position.set(...fill[2]);
  subject.add(k, k.target, r, f);
  return { key: k, rim: r, fill: f };
};
