import * as THREE from "three";

// Rounded rectangle centred on the origin.
export const roundedRect = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

export const roundedRectPath = (w: number, h: number, r: number) => {
  const s = roundedRect(w, h, r);
  return new THREE.Path(s.getPoints(32));
};

// A slab of the given outer size and thickness, centred on z = 0, with a
// small bevel that stays inside the outline.
export const slab = (w: number, h: number, depth: number, r: number, bevel = 0.02, holes: THREE.Path[] = []) => {
  const b = Math.min(bevel, depth / 2 - 0.001, w / 4, h / 4);
  const shape = roundedRect(w - 2 * b, h - 2 * b, Math.max(0.001, r - b));
  shape.holes.push(...holes);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - 2 * b),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 20,
  });
  g.translate(0, 0, -(depth - 2 * b) / 2);
  g.computeVertexNormals();
  return g;
};

// Flat rounded rectangle whose UVs span 0..1 over its bounds.
export const flatRect = (w: number, h: number, r: number) => {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 24);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
};

// A flat ribbon (flex cable) following a curve; `up` sets which way it faces.
export const ribbon = (points: THREE.Vector3[], width: number, up = new THREE.Vector3(0, 0, 1), segments = 64) => {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const side = new THREE.Vector3().crossVectors(tan, up).normalize().multiplyScalar(width / 2);
    const n = new THREE.Vector3().crossVectors(side, tan).normalize();
    for (const s of [-1, 1]) {
      pos.push(p.x + side.x * s, p.y + side.y * s, p.z + side.z * s);
      nor.push(n.x, n.y, n.z);
    }
    if (i < segments) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
};

// Deterministic random numbers so every render is identical.
export const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
