// The distant sky is baked once. The planet uses spherical lighting and distorted cloud belts.
function noise(x, y) {
  const hash = (a, b) => {
    const n = Math.imul(a, 374761393) + Math.imul(b, 668265263);
    return (Math.imul(n ^ (n >>> 13), 1274126177) >>> 0) / 4294967296;
  };
  const i = Math.floor(x),
    j = Math.floor(y);
  let u = x - i,
    v = y - j;
  u *= u * (3 - 2 * u);
  v *= v * (3 - 2 * v);
  const a = hash(i, j),
    b = hash(i, j + 1);
  return (a + (hash(i + 1, j) - a) * u) * (1 - v) + (b + (hash(i + 1, j + 1) - b) * u) * v;
}
function clouds(x, y) {
  return (
    noise(x, y) * 0.52 +
    noise(x * 2.1, y * 2.1) * 0.27 +
    noise(x * 4.3, y * 4.3) * 0.14 +
    noise(x * 9, y * 9) * 0.07
  );
}
export function paintSky(canvas) {
  const w = (canvas.width = 1500),
    h = (canvas.height = 780);
  const g = canvas.getContext("2d");
  const image = g.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x / w,
        v = y / h;
      const dust = clouds(u * 5 + 4, v * 4),
        grain = noise(x * 0.6, y * 0.6) * 3;
      const band = Math.exp(-Math.pow((v - 0.29 + 0.22 * u + (0.48 - dust) * 0.37) * 4, 2));
      const glow = Math.max(0, dust - 0.27) * band * 1.6;
      const haze = Math.max(0, 1 - Math.abs(v - 0.42) * 2.45);
      const i = (y * w + x) * 4;
      image.data[i] = 9 + 42 * haze + 91 * glow + grain;
      image.data[i + 1] = 17 + 22 * haze + 57 * glow + grain;
      image.data[i + 2] = 25 + 20 * haze + 41 * glow + grain;
      image.data[i + 3] = 255;
    }
  g.putImageData(image, 0, 0);
  let seed = 83;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 1400; i++) {
    const x = rand() * w,
      y = rand() * h,
      s = 0.5 + rand() ** 5 * 2.5;
    g.fillStyle = "rgba(255,242,215," + (0.15 + rand() * 0.7) + ")";
    g.fillRect(x, y, s, s);
    if (s > 2.6) {
      g.fillRect(x - s, y + s * 0.35, s * 3, 1);
      g.fillRect(x + s * 0.35, y - s, 1, s * 3);
    }
  }
  const cx = 1055,
    cy = 130,
    r = 119;
  const halo = g.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.6);
  halo.addColorStop(0, "#ffc99555");
  halo.addColorStop(0.17, "#ee945d22");
  halo.addColorStop(1, "#d86f4300");
  g.fillStyle = halo;
  g.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  function rings(front) {
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.24);
    for (let i = 0; i < 95; i++) {
      const rad = r * (1.29 + i * 0.009);
      const a = 0.075 + (0.5 + 0.5 * Math.sin(i * 2.3)) * 0.24;
      if (i > 50 && i < 56) continue;
      g.strokeStyle = "rgba(247,194,145," + (front ? a : a * 0.75) + ")";
      g.lineWidth = 1.3;
      g.beginPath();
      g.ellipse(0, 0, rad, rad * 0.185, 0, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI);
      g.stroke();
    }
    g.restore();
  }
  rings(false);
  const d = r * 2,
    planet = document.createElement("canvas");
  planet.width = planet.height = d;
  const p = planet.getContext("2d"),
    pix = p.createImageData(d, d);
  for (let y = 0; y < d; y++)
    for (let x = 0; x < d; x++) {
      const nx = (x - r) / r,
        ny = (y - r) / r,
        sq = 1 - nx * nx - ny * ny;
      if (sq <= 0) continue;
      const nz = Math.sqrt(sq),
        lat = ny * 0.92 + nx * 0.33,
        lon = Math.atan2(nx, nz);
      const warp = clouds(lon * 4 + 3, lat * 12);
      const belt = 0.5 + 0.5 * Math.sin(lat * 48 + warp * 4 + Math.sin(lat * 13) * 2);
      const fine = clouds(lon * 9, lat * 85 + warp * 3);
      const light = Math.max(0, -nx * 0.75 - ny * 0.46 + nz * 0.29);
      const limb = Math.pow(1 - nz, 3) * Math.max(0.12, light);
      const i = (y * d + x) * 4;
      pix.data[i] = 51 + (156 + belt * 42 + fine * 43) * light + 73 * limb;
      pix.data[i + 1] = 47 + (91 + belt * 45 + fine * 35) * light + 51 * limb;
      pix.data[i + 2] = 52 + (48 + belt * 32 + fine * 26) * light + 36 * limb;
      pix.data[i + 3] = Math.min(255, sq * r * 190);
    }
  p.putImageData(pix, 0, 0);
  g.drawImage(planet, cx - r, cy - r);
  rings(true);
}
