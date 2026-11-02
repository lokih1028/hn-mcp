import { useThree } from "@react-three/fiber";
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from "postprocessing";
import { useEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";

// Bloom, vignette and film grain. The composer is built synchronously and
// drawn in an effect that runs after ThreeCanvas has rendered the plain scene
// for this frame, so every captured frame (including a tab's first) has it.
// (@react-three/postprocessing sets up a frame late and leaves black frames.)
export const PostFX: React.FC<{ bloom?: number }> = ({ bloom = 0.9 }) => {
  const { gl, scene, camera, size } = useThree();
  const frame = useCurrentFrame();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType });
    c.addPass(new RenderPass(scene, camera));
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = 0.12;
    c.addPass(
      new EffectPass(
        camera,
        new BloomEffect({ intensity: bloom, luminanceThreshold: 0.9, luminanceSmoothing: 0.15, mipmapBlur: true }),
        new VignetteEffect({ offset: 0.3, darkness: 0.6 }),
        noise,
      ),
    );
    return c;
  }, [gl, scene, camera, bloom]);
  useEffect(() => composer.setSize(size.width, size.height), [composer, size]);
  useEffect(() => {
    composer.render();
  }, [composer, frame]);
  useEffect(() => () => composer.dispose(), [composer]);
  return null;
};
