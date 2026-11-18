import * as T from "./vendor/three/three.module.min.js";

// Bake the pieces of each model into a single vertex-coloured mesh for instanced drawing.
export class Model {
  positions = [];
  colors = [];
  piece(geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    flat.rotateX(rx);
    flat.rotateY(ry);
    flat.rotateZ(rz);
    flat.translate(x, y, z);
    const rgb = new T.Color(color),
      pts = flat.attributes.position;
    for (let i = 0; i < pts.count; i++) {
      this.positions.push(pts.getX(i), pts.getY(i), pts.getZ(i));
      this.colors.push(rgb.r, rgb.g, rgb.b);
    }
    geometry.dispose();
    if (flat !== geometry) flat.dispose();
  }
  box(x, y, z, w, h, l, c, rx = 0, ry = 0, rz = 0) {
    this.piece(new T.BoxGeometry(w, h, l), c, x, y, z, rx, ry, rz);
  }
  pod(x, y, z, r1, r2, length, c) {
    this.piece(new T.CylinderGeometry(r1, r2, length, 12), c, x, y, z, Math.PI / 2);
  }
  // Fuselage stations specify depth, half-width, keel and ridge height.
  hull(stations, color, x = 0) {
    const path = [];
    const rings = stations.map(([z, w, low, high]) => [
      [x - w * 0.62, low, z],
      [x - w, low + (high - low) * 0.46, z],
      [x - w * 0.54, high, z],
      [x + w * 0.54, high, z],
      [x + w, low + (high - low) * 0.46, z],
      [x + w * 0.62, low, z],
    ]);
    const tri = (a, b, c) => path.push(...a, ...b, ...c);
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < 6; i++) {
        const a = rings[j - 1],
          b = rings[j],
          k = (i + 1) % 6;
        tri(a[i], b[i], b[k]);
        tri(a[i], b[k], a[k]);
      }
    for (let i = 1; i < 5; i++) {
      tri(rings[0][0], rings[0][i], rings[0][i + 1]);
      const a = rings.at(-1);
      tri(a[0], a[i + 1], a[i]);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(path, 3));
    this.piece(g, color);
  }
  plate(points, bottom, top, color) {
    const shape = new T.Shape();
    points.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
    shape.closePath();
    const g = new T.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false });
    this.piece(g, color, 0, bottom, 0, -Math.PI / 2);
  }
  bake() {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(this.colors, 3));
    g.computeVertexNormals();
    return g;
  }
}

export function interceptor() {
  const m = new Model(),
    armor = 0xd6c6ac,
    ceramic = 0xf0e5c9,
    frame = 0x384953,
    rust = 0xc25730;
  m.hull(
    [
      [-3.9, 0.025, 0.02, 0.12],
      [-2.15, 0.37, -0.14, 0.38],
      [-0.4, 0.62, -0.28, 0.65],
      [1.55, 0.7, -0.34, 0.52],
      [2.33, 0.42, -0.18, 0.33],
    ],
    armor,
  );
  m.hull(
    [
      [-2.28, 0.03, 0.31, 0.35],
      [-1.37, 0.3, 0.36, 0.74],
      [-0.75, 0.35, 0.42, 0.92],
      [-0.22, 0.31, 0.47, 0.79],
      [0.11, 0.25, 0.47, 0.57],
    ],
    0x153b50,
  );
  m.box(0, 0.88, -0.76, 0.065, 0.048, 0.33, ceramic, -0.12);
  for (const s of [-1, 1]) {
    const wing = (p, lo, hi, c) =>
      m.plate(
        p.map(([x, z]) => [s * x, z]),
        lo,
        hi,
        c,
      );
    wing(
      [
        [0.36, -1.56],
        [0.74, -1.16],
        [3.28, 1.35],
        [3.15, 1.83],
        [1.72, 1.46],
        [0.45, 2.05],
      ],
      -0.11,
      0.09,
      armor,
    );
    wing(
      [
        [1.23, -0.52],
        [1.55, -0.23],
        [2.93, 1.51],
        [2.49, 1.36],
      ],
      0.09,
      0.112,
      rust,
    );
    wing(
      [
        [0.67, -0.9],
        [0.83, -0.72],
        [1.22, 1.46],
        [0.69, 1.77],
      ],
      0.1,
      0.18,
      frame,
    );
    m.hull(
      [
        [-1.78, 0.075, 0.03, 0.12],
        [-0.94, 0.28, -0.15, 0.4],
        [0.61, 0.38, -0.22, 0.48],
        [1.85, 0.35, -0.25, 0.46],
        [2.21, 0.26, -0.16, 0.32],
      ],
      ceramic,
      s * 0.89,
    );
    m.pod(s * 0.89, 0.085, 2.23, 0.3, 0.36, 0.46, frame);
    m.pod(s * 0.89, 0.085, 2.48, 0.218, 0.26, 0.08, 0x87fff0);
    m.pod(s * 2.88, 0.06, 1.0, 0.085, 0.115, 1.59, frame);
    m.pod(s * 2.88, 0.06, 0.16, 0.055, 0.065, 0.28, 0xe8a468);
    m.box(s * 0.9, 0.62, 1.48, 0.11, 0.89, 0.68, frame, -0.38, 0, -s * 0.23);
    m.box(s * 0.98, 1.02, 1.35, 0.13, 0.14, 0.57, rust, -0.38, 0, -s * 0.23);
    for (let i = 0; i < 6; i++) m.box(s * 0.89, 0.47, 0.32 + i * 0.19, 0.43, 0.055, 0.076, frame);
    m.box(s * 2.66, 0.115, 1.19, 0.28, 0.03, 0.09, 0x9effee);
  }
  for (let i = 0; i < 5; i++) m.box(0, 0.56, 0.27 + i * 0.21, 0.47, 0.06, 0.1, frame);
  return m.bake();
}
export function raider(variant) {
  const m = new Model(),
    plating = [0xf99c59, 0xc9cad3, 0xef7255][variant];
  m.hull(
    [
      [-1, 0.24, -0.2, 0.34],
      [0, 0.53, -0.36, 0.65],
      [1.18, 0.09, -0.06, 0.22],
    ],
    plating,
  );
  for (const s of [-1, 1]) {
    m.plate(
      [
        [s * 0.23, -0.56],
        [s * 1.28, -1.05],
        [s * 1.18, 0.64],
        [s * (variant === 1 ? 1.52 : 0.78), 1.1],
        [s * 0.65, 0.32],
      ],
      -0.21,
      0.12,
      plating,
    );
    m.box(s * 0.81, 0.17, -0.13, 0.16, 0.16, 0.88, 0x583d48);
  }
  m.box(0, 0.44, 0.29, 0.56, 0.13, 0.23, 0xffcaa1);
  return m.bake();
}
