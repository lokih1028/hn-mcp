import { useMemo } from "react";
import * as THREE from "three";
import { Arc } from "./layout";

// A text band burned into the wood along an arc. The text is drawn flat on a
// canvas; the band's UVs run along the arc (u) and across it (v), so the
// letters follow the ring. uProg is how far the burn has got along u.

const PX_PER_UNIT = 400; // canvas pixels per world unit

// font is the CSS font shorthand without the size, e.g. `900 'Noto Sans SC'`.
export type BandText = { lines: { text: string; font: string; size: number }[] };

const cssFont = (l: BandText["lines"][number]) => {
  const [weight, ...family] = l.font.split(" ");
  return `${weight} ${l.size}px ${family.join(" ")}`;
};

export type BandTexture = { texture: THREE.CanvasTexture; length: number; width: number }; // world units

export const makeBandTexture = ({ lines }: BandText): BandTexture => {
  const measure = document.createElement("canvas").getContext("2d")!;
  const widths = lines.map((l) => {
    measure.font = cssFont(l);
    return measure.measureText(l.text).width;
  });
  const width = Math.ceil(Math.max(...widths)) + 40;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.ceil(lines.reduce((h, l) => h + l.size * 1.18, 0) + 20);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  let y = 10;
  for (const l of lines) {
    ctx.font = cssFont(l);
    ctx.fillText(l.text, 20, y);
    y += l.size * 1.18;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return { texture, length: width / PX_PER_UNIT, width: canvas.height / PX_PER_UNIT };
};

const bandGeometry = (arc: Arc) => {
  const segments = Math.max(16, Math.ceil(arc.sweep * 60));
  const inner = arc.r - arc.width / 2;
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let k = 0; k <= segments; k++) {
    const u = k / segments;
    const a = arc.start - u * arc.sweep;
    for (const v of [0, 1]) {
      const r = inner + v * arc.width;
      pos.push(r * Math.cos(a), 0.003, r * Math.sin(a));
      uv.push(u, 1 - v); // canvas top (texture v = 1) on the inner edge: letters face the centre
    }
    if (k < segments) {
      const i = k * 2;
      index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
};

const fragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uProg, uAfterglow;
varying vec2 vUv;
void main() {
  float ink = texture2D(uMap, vUv).a;
  // scorch: a soft brown halo around the letters, from a few nearby samples
  vec2 d = vec2(0.0035, 0.012);
  float near = max(max(texture2D(uMap, vUv + vec2(d.x, 0.0)).a, texture2D(uMap, vUv - vec2(d.x, 0.0)).a),
                   max(texture2D(uMap, vUv + vec2(0.0, d.y)).a, texture2D(uMap, vUv - vec2(0.0, d.y)).a));
  float scorch = max(near - ink, 0.0);
  float u = vUv.x;
  float burned = step(u, uProg);
  float age = clamp((uProg - u) * 5.0, 0.0, 1.0);            // 0 at the front, 1 once cooled
  vec3 hot = vec3(2.4, 1.15, 0.35);
  vec3 ember = vec3(0.9, 0.22, 0.03);
  vec3 charred = vec3(0.06, 0.03, 0.015);
  vec3 col = mix(mix(hot, ember, smoothstep(0.0, 0.35, age)), charred, smoothstep(0.3, 1.0, age));
  col += ember * uAfterglow * (0.4 + 0.6 * ink);              // whole band glows again in the finale
  float front = 1.0 - smoothstep(0.0, 0.025, abs(u - uProg));
  col += vec3(3.0, 1.5, 0.5) * front * ink;
  vec3 halo = mix(vec3(0.9, 0.3, 0.05), vec3(0.18, 0.08, 0.03), smoothstep(0.0, 0.5, age));
  float a = max(ink * 0.96, scorch * 0.45) * burned;
  vec3 outCol = ink > 0.02 ? col : halo;
  gl_FragColor = vec4(pow(max(outCol, 0.0), vec3(2.2)), a); // authored in sRGB, output linear
}`;

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const BurnBand: React.FC<{ arc: Arc; texture: THREE.Texture; progress: number; afterglow: number }> = ({
  arc,
  texture,
  progress,
  afterglow,
}) => {
  const geometry = useMemo(() => bandGeometry(arc), [arc]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uMap: { value: texture }, uProg: { value: 0 }, uAfterglow: { value: 0 } },
      }),
    [texture],
  );
  material.uniforms.uProg.value = progress;
  material.uniforms.uAfterglow.value = afterglow;
  return <mesh geometry={geometry} material={material} />;
};
