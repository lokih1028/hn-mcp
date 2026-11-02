import { useMemo } from "react";
import * as THREE from "three";
import { CORE, R } from "./layout";

// Procedural end grain: growth rings at the real year radii, fine rings,
// pores, medial rays, darker heartwood, bark, one radial check, plus a pool
// of light where the camera looks and the warm glow of the burn front.
const fragment = /* glsl */ `
uniform float uR, uCore, uYears, uFrontGlow;
uniform vec3 uFront, uFocus;
varying vec3 vPos;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = vPos.xz;
  float r = length(p);
  float ang = atan(p.y, p.x);
  // rings are never perfect circles
  float rr = r + (fbm(vec2(ang * 2.5 + 3.0, r * 0.35)) - 0.5) * 0.45 + (fbm(p * 0.6) - 0.5) * 0.25;

  float yr = (rr - uCore) / (uR - uCore) * uYears;
  float f = fract(yr);
  float late = smoothstep(0.80, 0.95, f) * (1.0 - smoothstep(0.975, 1.0, f));
  float fine = smoothstep(0.86, 1.0, fract(rr * 7.0 + fbm(p * 2.5) * 0.6)) * 0.16
             + smoothstep(0.9, 1.0, fract(rr * 23.0 + fbm(p * 5.0))) * 0.08;
  float yearHue = hash(vec2(floor(yr), 7.0));

  vec3 early = mix(vec3(0.66, 0.40, 0.19), vec3(0.58, 0.32, 0.14), yearHue);
  vec3 lateC = vec3(0.24, 0.11, 0.04);
  vec3 col = mix(early, lateC, clamp(late * 0.9 + fine, 0.0, 1.0));
  col *= 0.9 + 0.14 * fbm(p * 42.0);                                      // pores
  col *= 0.93 + 0.1 * noise(vec2(rr * 70.0, ang * 3.0));                  // fibres along the ring
  col *= 1.0 - 0.22 * smoothstep(0.93, 1.0, noise(vec2(ang * 140.0, r * 0.6))); // medial rays
  col *= mix(0.72, 1.0, smoothstep(0.0, uR * 0.55, rr));                  // heartwood

  float check = abs(sin(ang - 2.3)) * r - 0.025 * fbm(vec2(r * 4.0, 1.0)) * r;
  float crackOff = clamp(smoothstep(0.0, 0.045, check) + step(0.0, -cos(ang - 2.3)) + step(r, uR * 0.35), 0.0, 1.0);
  col *= mix(0.25, 1.0, crackOff);

  float bark = smoothstep(uR - 0.45, uR - 0.2, rr);
  vec3 barkC = vec3(0.16, 0.10, 0.06) * (0.55 + 0.9 * fbm(vec2(ang * 45.0, r * 5.0)));
  col = mix(col, barkC, bark);
  col *= 1.0 - smoothstep(uR - 0.05, uR + 0.05, r);

  vec2 dF = p - uFocus.xz;
  float pool = 0.07 + 1.0 * exp(-dot(dF, dF) / 11.0);
  vec2 dE = p - uFront.xz;
  vec3 ember = vec3(1.0, 0.38, 0.08) * uFrontGlow * 0.7 * exp(-dot(dE, dE) * 3.0);

  col = pow(col, vec3(1.25)); // a little more contrast and depth in the grain
  // colours above are authored in sRGB; the composer expects linear light
  gl_FragColor = vec4(pow(col * pool + ember * (0.6 + col), vec3(2.2)), 1.0);
}`;

const vertex = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
}`;

export const WoodDisc: React.FC<{
  years: number;
  front: readonly [number, number, number];
  frontGlow: number;
  focus: readonly [number, number, number];
}> = ({ years, front, frontGlow, focus }) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uR: { value: R },
          uCore: { value: CORE },
          uYears: { value: years },
          uFront: { value: new THREE.Vector3() },
          uFrontGlow: { value: 0 },
          uFocus: { value: new THREE.Vector3() },
        },
      }),
    [years],
  );
  material.uniforms.uFront.value.set(...front);
  material.uniforms.uFrontGlow.value = frontGlow;
  material.uniforms.uFocus.value.set(...focus);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <circleGeometry args={[R + 0.4, 256]} />
    </mesh>
  );
};
