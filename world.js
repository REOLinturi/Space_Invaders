import * as T from "./vendor/three/three.module.min.js";
import { Model, interceptor, raider } from "./models.js";
import { paintSky } from "./sky.js";

function createWorld(canvas) {
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(1.65, window.devicePixelRatio || 1));
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(53, 2, 0.2, 1350);
  scene.fog = new T.FogExp2(0x846b67, 0.0055);
  camera.position.set(0, 29, 52);
  camera.lookAt(0, 1, -37);
  camera.updateMatrixWorld();
  const ambient = new T.HemisphereLight(0xd7e9f1, 0x7b5346, 1.75);
  const sun = new T.DirectionalLight(0xffcc92, 2.65);
  sun.position.set(-45, 75, -38);
  const rim = new T.DirectionalLight(0x72c6ce, 1.05);
  rim.position.set(50, 18, 46);
  scene.add(ambient, sun, rim);
  const metal = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.64,
    metalness: 0.25,
    side: T.DoubleSide,
  });

  // Basalt ridges flank a mined valley. Repeatable mesh generation keeps the route stable.
  let seed = 915;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const landscape = new Model(),
    colors = [0x63524f, 0x55454a, 0x70554f, 0x43444b, 0x735b56];
  for (let row = 0; row < 31; row++)
    for (let col = -22; col <= 22; col++) {
      const z = 72 - row * 15,
        x = col * 14;
      const height = (a, b) => {
        const edge = Math.max(0, Math.min(1, (Math.abs(a) - 41) / 68));
        return (
          -3 +
          edge *
            (9 +
              10 * Math.sin(a * 0.029 + b * 0.019) +
              9 * Math.cos(b * 0.058 - a * 0.018) +
              7 * Math.sin(a * 0.081 + b * 0.028))
        );
      };
      const point = (a, b) => [a, height(a, b), b];
      const a = point(x, z),
        b = point(x + 14, z),
        c = point(x + 14, z - 15),
        d = point(x, z - 15);
      for (const face of [
        [a, b, d],
        [b, c, d],
      ]) {
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(face.flat(), 3));
        landscape.piece(g, Math.abs(x) < 42 ? 0x293237 : colors[Math.floor(rnd() * colors.length)]);
      }
    }
  const road = 0x243238;
  landscape.box(0, -2.9, -65, 68, 0.9, 225, road);
  for (let z = -165; z < 48; z += 9) {
    landscape.box(0, -2.38, z, 68, 0.06, 0.09, 0x566366);
    for (const side of [-1, 1]) {
      landscape.box(side * 31, -2.22, z, 0.23, 0.17, 5, 0x91b7ad);
      landscape.box(side * 33, -2.12, z, 0.75, 0.25, 1.35, 0xf3a56b);
    }
  }
  for (let i = 0; i < 80; i++) {
    const side = i % 2 ? 1 : -1,
      z = -180 + rnd() * 207,
      x = side * (38 + rnd() * 48);
    const w = 2 + rnd() * 5,
      h = 2 + rnd() * 7;
    landscape.box(x, h * 0.5 - 2, z, w, h, w * 0.8, 0x37444a);
    landscape.box(x, h - 1.85, z, w * 1.14, 0.45, w * 0.94, 0x68726f);
    if (i % 3 === 0) {
      landscape.box(x, h - 0.25, z, 0.2, 3.3, 0.2, 0x7c8986);
      landscape.box(x, h + 1.44, z, 0.4, 0.32, 0.4, 0xffb56d);
    }
    landscape.box(x, h * 0.65 - 2, z + w * 0.405, w * 0.67, 0.2, 0.1, 0xf2bc84);
  }
  // Relay masts with open crossarms, dish reflectors and runway service lights.
  for (const [x, z, h] of [
    [-49, -68, 24],
    [53, -98, 30],
    [-38, -148, 19],
    [43, -23, 15],
  ]) {
    landscape.piece(new T.CylinderGeometry(1.5, 3.4, 5, 8), 0x435052, x, 0.5, z);
    landscape.piece(new T.CylinderGeometry(0.42, 1.05, h, 6), 0x697276, x, h * 0.5 + 2, z);
    for (let j = 0; j < 4; j++) {
      landscape.box(x, h + 1 - j * 2.7, z, 6 - j * 0.95, 0.27, 0.62, 0xc1a68b);
      landscape.box(x - 2.9 + j * 0.48, h + 1.23 - j * 2.7, z, 0.32, 0.35, 0.4, 0xf4af70);
    }
    landscape.piece(new T.SphereGeometry(3.2, 18, 5, 0, 2 * Math.PI, 0, 0.69), 0xa3a39a, x, h + 1.6, z, 0.55);
    landscape.box(x, h + 4.8, z, 0.14, 2.7, 0.14, 0xf6c498);
  }
  scene.add(new T.Mesh(landscape.bake(), metal));
  const airborne = new T.Scene();
  airborne.add(ambient.clone(), sun.clone(), rim.clone());
  const fighter = new T.Mesh(interceptor(), metal);
  airborne.add(fighter);
  const engines = new T.Group();
  fighter.add(engines);
  const flameGeometry = new T.ConeGeometry(0.22, 1.6, 12);
  flameGeometry.rotateX(Math.PI / 2);
  const exhaust = new T.MeshBasicMaterial({
    color: 0x8effed,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  for (const s of [-1, 1]) {
    const jet = new T.Mesh(flameGeometry, exhaust);
    jet.position.set(s * 0.89, 0.085, 3.27);
    engines.add(jet);
  }
  const glowMap = document.createElement("canvas");
  glowMap.width = glowMap.height = 64;
  const gc = glowMap.getContext("2d"),
    glow = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(0.18, "#ffffffbc");
  glow.addColorStop(0.5, "#ffffff38");
  glow.addColorStop(1, "#ffffff00");
  gc.fillStyle = glow;
  gc.fillRect(0, 0, 64, 64);
  const soft = new T.CanvasTexture(glowMap);
  const glowMaterial = new T.SpriteMaterial({
    map: soft,
    color: 0x66ffeb,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
  for (const s of [-1, 1]) {
    const light = new T.Sprite(glowMaterial);
    light.position.set(s * 0.89, 0.09, 2.59);
    light.scale.setScalar(1.2);
    fighter.add(light);
  }
  function batch(geometry, material, capacity) {
    const m = new T.InstancedMesh(geometry, material, capacity);
    m.count = 0;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(T.DynamicDrawUsage);
    airborne.add(m);
    return m;
  }
  const fleets = [0, 1, 2].map((i) => batch(raider(i), metal, 64));
  const cube = new T.BoxGeometry(1, 1, 1);
  const shields = batch(
    cube,
    new T.MeshStandardMaterial({ color: 0x58c6ad, metalness: 0.25, roughness: 0.48 }),
    1000,
  );
  const plasma = (color) => new T.MeshBasicMaterial({ color, fog: false });
  const allied = batch(cube, plasma(0x9affee), 64),
    hostile = batch(cube, plasma(0xff9264), 180);
  const debris = batch(new T.OctahedronGeometry(1), plasma(0xffffff), 900);
  const markings = batch(cube, plasma(0x80b5aa), 48);
  const shadow = new T.Mesh(
    new T.PlaneGeometry(),
    new T.MeshBasicMaterial({
      map: soft,
      color: 0x101317,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  const allBatches = [...fleets, shields, allied, hostile, debris, markings];
  const tmp = new T.Object3D(),
    ray = new T.Raycaster(),
    ndc = new T.Vector2();
  const air = new T.Plane(new T.Vector3(0, 1, 0), -2),
    point = new T.Vector3(),
    right = new T.Vector3(),
    front = new T.Vector3();
  // Map each point on the simulation plane to the same flight deck, including collision geometry.
  function ground(x, y, out) {
    const v = y / 600;
    ndc.set((x / 450 - 1) * (0.77 + 0.21 * v), 0.54 - v * 1.44);
    ray.setFromCamera(ndc, camera);
    ray.ray.intersectPlane(air, out);
    return out;
  }
  function footprint(x, y, w, h) {
    ground(x, y, point);
    ground(x + w, y, right);
    ground(x, y + h, front);
    return [Math.abs(right.x - point.x), Math.abs(front.z - point.z)];
  }
  function put(m, x, y, z, w, h, l, angle = 0) {
    if (m.count >= m.instanceMatrix.count) return;
    tmp.position.set(x, y, z);
    tmp.rotation.set(0, angle, 0);
    tmp.scale.set(w, h, l);
    tmp.updateMatrix();
    m.setMatrixAt(m.count++, tmp.matrix);
  }
  const tint = new T.Color(),
    sectorColors = [
      0xffcc92, 0xffbd81, 0xf3c5aa, 0xc8d6e6, 0xffb784, 0xe6b4a4, 0xbadadd, 0xfab486, 0xe6a9a0, 0xffa773,
    ];
  let width = 0,
    height = 0;
  return (state, time, steering) => {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    if (w !== width || h !== height) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    allBatches.forEach((b) => (b.count = 0));
    sun.color.setHex(sectorColors[state.stage - 1]);
    const hangar = state.mode === "intro";
    fighter.visible = true;
    if (hangar) {
      ground(682, 362, point);
      fighter.position.copy(point);
      fighter.position.y += Math.sin(time * 0.63) * 0.27;
      fighter.rotation.set(0.16, -0.76 + 0.08 * Math.sin(time * 0.25), -0.2);
      const scale = Math.min((w / h) * 2.45, 5.8);
      fighter.scale.setScalar(scale);
    } else {
      const p = state.player;
      const [wx, lz] = footprint(p.x + p.width / 2, p.y + p.height / 2, p.width, p.height);
      fighter.position.copy(point);
      fighter.scale.set(wx / 6.6, wx / 7, lz / 6.4);
      fighter.rotation.set(0, 0, -steering * 0.15);
      fighter.visible = p.invulnerable === 0 || Math.floor(time * 16) % 2 === 0;
      for (let x = 0; x < 900; x += 36) {
        const [lineWidth] = footprint(x + 16, 594, 31, 1);
        put(markings, point.x, point.y - 0.18, point.z, lineWidth, 0.04, 0.1);
      }
      for (let y = 65; y < p.y; y += 32) {
        ground(p.x + p.width / 2, y, point);
        put(markings, point.x, point.y - 0.42, point.z, 0.065, 0.035, 0.55);
      }
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const [ew, el] = footprint(e.x + e.width / 2, e.y + e.height / 2, e.width, e.height);
        put(fleets[e.row % 3], point.x, point.y, point.z, ew / 2.7, ew / 3, el / 2.25);
      }
      for (const s of state.shields) {
        for (let j = 0; j < s.mask.length; j++)
          for (let i = 0; i < s.mask[j].length; i++)
            if (s.mask[j][i]) {
              const [cw, cl] = footprint(
                s.x + (i + 0.5) * s.cellSize,
                s.y + (j + 0.5) * s.cellSize,
                s.cellSize,
                s.cellSize,
              );
              put(shields, point.x, point.y - 0.15, point.z, cw * 0.96, 0.48, cl * 0.96);
            }
      }
      for (const [list, mesh] of [
        [state.playerBullets, allied],
        [state.enemyBullets, hostile],
      ]) {
        for (const b of list) {
          const [bw, bl] = footprint(b.x + b.width / 2, b.y + b.height / 2, b.width, b.height);
          put(mesh, point.x, point.y + 0.13, point.z, bw, 0.24, bl);
        }
      }
      for (const p of state.particles) {
        if (debris.count >= debris.instanceMatrix.count) break;
        const [size] = footprint(p.x, p.y, p.size * 1.8, p.size);
        debris.setColorAt(debris.count, tint.set(p.color));
        put(debris, point.x, point.y + 0.5, point.z, size, size, size, time);
      }
    }
    exhaust.opacity = 0.69 + 0.22 * Math.sin(time * 27);
    shadow.position.set(fighter.position.x + 1.3, -2.27, fighter.position.z + 1);
    shadow.scale.set(fighter.scale.x * 9, fighter.scale.z * 9, 1);
    for (const b of allBatches) {
      b.instanceMatrix.needsUpdate = true;
      if (b.instanceColor) b.instanceColor.needsUpdate = true;
    }
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(airborne, camera);
  };
}

paintSky(document.querySelector("#skyCanvas"));
const view = document.querySelector("#worldCanvas");
try {
  const draw = createWorld(view);
  view.hidden = false;
  canvas.hidden = true;
  window.drawFlightWorld = draw;
  render();
  view.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    window.drawFlightWorld = null;
    view.hidden = true;
    canvas.hidden = false;
    render();
  });
} catch (error) {
  console.warn("Using the arcade renderer.", error);
}
