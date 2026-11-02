import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { cancelRender, continueRender, delayRender, random, staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { colors } from "../theme";
import type { Timing } from "../episode/timeline";
import { cameraPose, cameraSpeed, FOV, PORTAL_H, PORTAL_W, portalZ, SPACING } from "./timeline";

const STARS = 1400;

// Loads every portal image before the 3D canvas mounts (null until all are
// ready), so the first frame Remotion captures already has them.
export const usePortalTextures = (images: (string | null)[]) => {
  const [textures, setTextures] = useState<(THREE.Texture | null)[] | null>(null);
  const [handle] = useState(() => delayRender("portal textures"));
  const key = images.join("|");
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    Promise.all(
      images.map((src) =>
        src
          ? loader.loadAsync(staticFile(src)).then((t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              return t;
            })
          : Promise.resolve(null),
      ),
    ).then(setTextures, cancelRender);
    // images is captured through key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (textures) continueRender(handle);
  }, [textures, handle]);
  return textures;
};

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

// Glowing rings every few units make the tunnel; they brighten near the camera.
const Rings: React.FC<{ length: number; camZ: number; frame: number }> = ({ length, camZ, frame }) => {
  const rings = useMemo(() => Array.from({ length: Math.ceil(length / 5) }, (_, i) => -i * 5 + 10), [length]);
  return (
    <>
      {rings.map((z, i) => {
        const near = Math.max(0, 1 - Math.abs(z - camZ) / 40);
        const pulse = 0.55 + 0.45 * Math.sin(frame / 9 - i * 0.6);
        return (
          <mesh key={z} position={[0, 0, z]} rotation={[0, 0, (i * Math.PI) / 12]}>
            <torusGeometry args={[6.2, 0.025 + 0.02 * near, 8, 96]} />
            <meshBasicMaterial
              color={i % 3 === 0 ? colors.accent : "#1ec8c8"}
              transparent
              opacity={(0.15 + 0.6 * near) * pulse}
            />
          </mesh>
        );
      })}
    </>
  );
};

// Stars streak along z in proportion to the camera speed.
const Stars: React.FC<{ length: number; speed: number }> = ({ length, speed }) => {
  const base = useMemo(
    () =>
      Array.from({ length: STARS }, (_, i) => {
        const a = random(`a${i}`) * Math.PI * 2;
        const r = 1.5 + random(`r${i}`) * 9;
        return [Math.cos(a) * r, Math.sin(a) * r, 20 - random(`z${i}`) * (length + 60)] as const;
      }),
    [length],
  );
  const geometry = useMemo(() => {
    const streak = 0.08 + speed * 3.2;
    const pos = new Float32Array(STARS * 6);
    base.forEach(([x, y, z], i) => pos.set([x, y, z, x, y, z + streak], i * 6));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [base, speed]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#ffd9b8" transparent opacity={0.75} />
    </lineSegments>
  );
};

const Portal: React.FC<{ index: number; texture: THREE.Texture | null; glow: number }> = ({
  index,
  texture,
  glow,
}) => {
  const z = portalZ(index);
  return (
    <group position={[0, 0, z]}>
      {/* soft glow halo behind the frame */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[PORTAL_W * 1.35, PORTAL_H * 1.2]} />
        <meshBasicMaterial color={colors.accent} transparent opacity={0.12 + 0.25 * glow} />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[PORTAL_W + 0.14, PORTAL_H + 0.14]} />
        <meshBasicMaterial color={colors.accent} />
      </mesh>
      <mesh>
        <planeGeometry args={[PORTAL_W, PORTAL_H]} />
        {texture ? <meshBasicMaterial map={texture} /> : <meshBasicMaterial color="#1b1b22" />}
      </mesh>
    </group>
  );
};

export const World: React.FC<{ timing: Timing; textures: (THREE.Texture | null)[] }> = ({ timing, textures }) => {
  const frame = useCurrentFrame();
  const n = textures.length;
  const camZ = cameraPose(frame, timing, n).position[2];
  const speed = cameraSpeed(frame, timing, n);
  const length = (n + 2) * SPACING;
  return (
    <>
      <color attach="background" args={[colors.bg]} />
      <fog attach="fog" args={[colors.bg, 8, 70]} />
      <ambientLight intensity={0.6} />
      <Camera pose={cameraPose(frame, timing, n)} />
      <Rings length={length} camZ={camZ} frame={frame} />
      <Stars length={length} speed={speed} />
      {textures.map((texture, i) => (
        <Portal key={i} index={i} texture={texture} glow={Math.max(0, 1 - Math.abs(portalZ(i) - camZ) / 20)} />
      ))}
    </>
  );
};
