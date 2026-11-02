import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { EpisodeChrome } from "../episode/Overlays";
import { StoryMedia } from "../episode/StoryMedia";
import { phaseAt, totalFrames } from "../episode/timeline";
import type { EpisodeProps } from "../episode/types";
import { clamp } from "../theme";
import { cameraPose, FOV, PORTAL_H, PORTAL_W, portalZ } from "./timeline";
import { usePortalTextures, World } from "./World";

export const episodeDuration = (p: EpisodeProps) => totalFrames(p.timing, p.stories.length);

// Screen rectangle of portal i for the current camera, so a story's video can
// sit exactly over the portal image drawn in 3D.
const portalRect = (pose: ReturnType<typeof cameraPose>, i: number, width: number, height: number) => {
  const cam = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 1000);
  cam.position.set(...pose.position);
  cam.lookAt(...pose.target);
  cam.updateMatrixWorld();
  const toScreen = (x: number, y: number) => {
    const v = new THREE.Vector3(x, y, portalZ(i)).project(cam);
    return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
  };
  const [left, top] = toScreen(-PORTAL_W / 2, PORTAL_H / 2);
  const [right, bottom] = toScreen(PORTAL_W / 2, -PORTAL_H / 2);
  return { left, top, width: right - left, height: bottom - top };
};

// "HN on this day" as a flight down a time tunnel: each past year is a portal
// showing an era image; the camera stops at each one while its story is shown.
export const TimeTunnel: React.FC<EpisodeProps> = (episode) => {
  const { stories, timing } = episode;
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const n = stories.length;
  const phase = phaseAt(frame, timing, n);
  const pose = cameraPose(frame, timing, n);
  const camZ = pose.position[2];
  const textures = usePortalTextures(stories.map((s) => s.image));

  // Brightest when the camera passes through the portal it just left.
  const crossed = phase.kind === "travel" && phase.index > 0 ? portalZ(phase.index - 1) : null;
  const outroCross = phase.kind === "outro" ? portalZ(n - 1) : null;
  const plane = crossed ?? outroCross;
  const flash = plane === null ? 0 : Math.max(0, 1 - Math.abs(camZ - plane) / 2.5) * 0.85;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {textures ? (
        <ThreeCanvas width={width} height={height}>
          <World timing={timing} textures={textures} />
        </ThreeCanvas>
      ) : null}

      {stories.map((story, i) => {
        const dist = camZ - portalZ(i);
        if (!story.video || dist < 0.5 || dist > 25) return null;
        const rect = portalRect(pose, i, width, height);
        return (
          <div
            key={story.year}
            style={{ position: "absolute", ...rect, opacity: interpolate(dist, [0.5, 1.5, 20, 25], [0, 1, 1, 0], clamp) }}
          >
            <StoryMedia story={story} index={i} episode={episode} />
          </div>
        );
      })}

      <EpisodeChrome episode={episode} flash={flash} />
    </AbsoluteFill>
  );
};
