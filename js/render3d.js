// 3D-Darstellung im Stil früher 2000er: Low-Poly, grobe Texturen, dichter Nebel, Laternenlicht.
// Spiellogik rechnet in Pixeln (16 pro Kachel); hier gilt 1 Kachel = 1 Einheit.
import * as THREE from '../vendor/three.module.min.js';
import { TILE, MAP_W, MAP_H, T, HOUSES, BLOCKS, tileAt, hash, tileCanvas, makeFog } from './world.js';

const U = (px) => px / TILE;
const WALL_H = 2.4;
const TALL = new Set([T.WALL, T.ROOF, T.TOWER, T.TDOOR]);

let renderer, scene, camera, map, groundTex, waterTex;
let lantern, pool = [], mistA, mistB, rain, rainPos, sparkPts, sparkPos, flashEl, darkEl;
let gateMesh, towerFire;
const roofs = [];             // { mesh, rect }
const lampMeshes = new Map(); // id -> { head, mat }
const actors = new Map();     // Spielobjekt -> Modell
export const view = { yaw: 0.0, dist: 4.4, pitch: 0.5 };

// ------------------------------------------------------------ Texturen

function canvasTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function blobTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function waterCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1418'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = hash(i, 1, 5) < 0.5 ? '#13222a' : '#081014';
    g.fillRect((hash(i, 2, 5) * 64) | 0, (hash(i, 3, 5) * 64) | 0, 4 + ((hash(i, 4, 5) * 8) | 0), 1);
  }
  return c;
}

// ------------------------------------------------------------ Geometrie-Baukasten

class Builder {
  constructor() { this.p = []; this.n = []; this.uv = []; }
  quad(a, b, c, d, n, uw, uh) {
    for (const [v, u] of [[a, [0, 0]], [b, [uw, 0]], [c, [uw, uh]], [a, [0, 0]], [c, [uw, uh]], [d, [0, uh]]]) {
      this.p.push(...v); this.n.push(...n); this.uv.push(...u);
    }
  }
  box(x, y, z, w, h, d, top = true) {
    const x1 = x + w, y1 = y + h, z1 = z + d;
    this.quad([x, y1, z1], [x1, y1, z1], [x1, y, z1], [x, y, z1], [0, 0, 1], w, h);
    this.quad([x1, y1, z], [x, y1, z], [x, y, z], [x1, y, z], [0, 0, -1], w, h);
    this.quad([x, y1, z], [x, y1, z1], [x, y, z1], [x, y, z], [-1, 0, 0], d, h);
    this.quad([x1, y1, z1], [x1, y1, z], [x1, y, z], [x1, y, z1], [1, 0, 0], d, h);
    if (top) this.quad([x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1], [0, 1, 0], w, d);
  }
  // Satteldach über Rechteck, First entlang der längeren Seite
  roof(x, y, z, w, d, rh, over = 0.25) {
    x -= over; z -= over; w += over * 2; d += over * 2;
    const y1 = y + rh;
    if (w >= d) {
      const zm = z + d / 2, sl = Math.hypot(d / 2, rh), n1 = norm([0, d / 2, -rh]), n2 = norm([0, d / 2, rh]);
      this.quad([x, y, z], [x + w, y, z], [x + w, y1, zm], [x, y1, zm], n1, w, sl);
      this.quad([x + w, y, z + d], [x, y, z + d], [x, y1, zm], [x + w, y1, zm], n2, w, sl);
      this.tri([x, y, z + d], [x, y, z], [x, y1, zm], [-1, 0, 0], d);
      this.tri([x + w, y, z], [x + w, y, z + d], [x + w, y1, zm], [1, 0, 0], d);
    } else {
      const xm = x + w / 2, sl = Math.hypot(w / 2, rh), n1 = norm([-rh, w / 2, 0]), n2 = norm([rh, w / 2, 0]);
      this.quad([x, y, z + d], [x, y, z], [xm, y1, z], [xm, y1, z + d], n1, d, sl);
      this.quad([x + w, y, z], [x + w, y, z + d], [xm, y1, z + d], [xm, y1, z], n2, d, sl);
      this.tri([x, y, z], [x + w, y, z], [xm, y1, z], [0, 0, -1], w);
      this.tri([x + w, y, z + d], [x, y, z + d], [xm, y1, z + d], [0, 0, 1], w);
    }
  }
  tri(a, b, c, n, w) {
    this.p.push(...a, ...b, ...c); this.n.push(...n, ...n, ...n); this.uv.push(0, 0, w, 0, w / 2, 1);
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

function norm(v) { const l = Math.hypot(...v); return v.map((a) => a / l); }

const lambert = (o) => new THREE.MeshLambertMaterial(o);

// ------------------------------------------------------------ Welt aufbauen

export function init(canvas, worldMap, groundCanvas) {
  map = worldMap;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x07090c);
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0d11, 0.085);
  camera = new THREE.PerspectiveCamera(72, 1, 0.1, 80);

  scene.add(new THREE.AmbientLight(0x2a3444, 1.1));
  const moon = new THREE.DirectionalLight(0x5a6a80, 0.35);
  moon.position.set(-20, 30, 10);
  scene.add(moon);

  lantern = new THREE.PointLight(0xffb060, 6, 9, 1.4);
  scene.add(lantern);
  for (let i = 0; i < 7; i++) { const l = new THREE.PointLight(0xffb060, 0, 10, 1.4); scene.add(l); pool.push(l); }

  buildGround(groundCanvas);
  buildWater();
  buildBuildings();
  buildProps();
  buildAtmosphere();

  flashEl = document.getElementById('flash');
  darkEl = document.getElementById('dark');
}

function buildGround(groundCanvas) {
  groundTex = canvasTex(groundCanvas, false);
  groundTex.flipY = false;
  groundTex.minFilter = THREE.LinearFilter;
  const p = [], n = [], uv = [];
  const W = MAP_W * TILE, H = MAP_H * TILE;
  const pushQuad = (verts, uvs, nn) => {
    for (const i of [0, 1, 2, 0, 2, 3]) { p.push(...verts[i]); n.push(...nn); uv.push(...uvs[i]); }
  };
  const side = new Builder();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = tileAt(map, x, y);
    if (t === T.WATER) continue;
    const u0 = (x * TILE + 0.5) / W, u1 = ((x + 1) * TILE - 0.5) / W, v0 = (y * TILE + 0.5) / H, v1 = ((y + 1) * TILE - 0.5) / H;
    const h = t === T.PIER ? 0.12 : 0;
    pushQuad([[x, h, y], [x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y]], [[u0, v0], [u0, v1], [u1, v1], [u1, v0]], [0, 1, 0]);
    // Uferkanten
    const edge = (dx, dy) => tileAt(map, x + dx, y + dy) === T.WATER;
    if (edge(0, 1)) side.quad([x, h, y + 1], [x + 1, h, y + 1], [x + 1, -0.6, y + 1], [x, -0.6, y + 1], [0, 0, 1], 1, 0.6);
    if (edge(0, -1)) side.quad([x + 1, h, y], [x, h, y], [x, -0.6, y], [x + 1, -0.6, y], [0, 0, -1], 1, 0.6);
    if (edge(1, 0)) side.quad([x + 1, h, y + 1], [x + 1, h, y], [x + 1, -0.6, y], [x + 1, -0.6, y + 1], [1, 0, 0], 1, 0.6);
    if (edge(-1, 0)) side.quad([x, h, y], [x, h, y + 1], [x, -0.6, y + 1], [x, -0.6, y], [-1, 0, 0], 1, 0.6);
    // Pfähle unter Stegen
    if (t === T.PIER && (x + y) % 2 === 0) side.box(x + 0.4, -0.8, y + 0.4, 0.18, 0.9, 0.18);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  scene.add(new THREE.Mesh(g, lambert({ map: groundTex })));
  scene.add(new THREE.Mesh(side.geo(), lambert({ color: 0x2a2219 })));
}

function buildWater() {
  waterTex = canvasTex(waterCanvas());
  waterTex.repeat.set(30, 36);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W + 60, MAP_H + 60),
    new THREE.MeshPhongMaterial({ color: 0x18262c, map: waterTex, shininess: 90, specular: 0x3a4a55 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(MAP_W / 2, -0.35, MAP_H / 2);
  scene.add(m);
}

function buildBuildings() {
  const wallTex = canvasTex(tileCanvas(T.WALL)); wallTex.repeat.set(1, 1);
  const roofTex = canvasTex(tileCanvas(T.ROOF));
  const towerTex = canvasTex(tileCanvas(T.TOWER));
  const wallMat = lambert({ map: wallTex });
  const roofMat = lambert({ map: roofTex, side: THREE.DoubleSide });

  // Begehbare Häuser: Mauern pro Kachel, abnehmbares Dach
  const walls = new Builder();
  for (const r of HOUSES) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (tileAt(map, x, y) === T.WALL) walls.box(x, 0, y, 1, WALL_H, 1);
    }
    const rb = new Builder();
    rb.roof(r.x, WALL_H, r.y, r.w, r.h, 1.6);
    const mesh = new THREE.Mesh(rb.geo(), roofMat);
    scene.add(mesh);
    roofs.push({ mesh, r });
  }
  // Geschlossene Häuser
  for (const r of BLOCKS) {
    walls.box(r.x, 0, r.y, r.w, WALL_H, r.h);
    const rb = new Builder();
    rb.roof(r.x, WALL_H, r.y, r.w, r.h, 1.4 + (r.w + r.h) * 0.05);
    scene.add(new THREE.Mesh(rb.geo(), roofMat));
    // Tür und Fenster an der Vorderseite
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), lambert({ color: 0x21170e }));
    door.position.set(r.x + r.w / 2, 0.7, r.y + r.h + 0.01);
    scene.add(door);
    if (hash(r.x, r.y, 4) < 0.6) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.45), new THREE.MeshBasicMaterial({ color: 0x8a5a24 }));
      win.position.set(r.x + 0.8, 1.6, r.y + r.h + 0.01);
      scene.add(win);
    }
  }
  scene.add(new THREE.Mesh(walls.geo(), wallMat));

  // Turm mit Wachfeuer
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.8, 13, 10, 1, true), lambert({ map: towerTex }));
  towerTex.repeat.set(10, 10);
  tower.position.set(48, 6.5, 10.5);
  scene.add(tower);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.3, 0.6, 10), lambert({ map: towerTex }));
  cap.position.set(48, 13.2, 10.5);
  scene.add(cap);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.8, 0.9, 8), lambert({ color: 0x1a1816 }));
  bowl.position.set(48, 14, 10.5);
  scene.add(bowl);
  towerFire = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 7), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.85 }));
  towerFire.position.set(48, 15.4, 10.5);
  towerFire.visible = false;
  scene.add(towerFire);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2), lambert({ color: 0x2a1c10 }));
  door.position.set(47.5, 1, 7.05);
  door.rotation.y = Math.PI;
  scene.add(door);
}

function treeGeometry() {
  const b = new Builder();
  const r = (i) => hash(i, 3, 11);
  const branch = (x, y, z, a, tilt, len, th, d, i) => {
    if (d > 3) return;
    const dx = Math.sin(tilt) * Math.cos(a) * len, dz = Math.sin(tilt) * Math.sin(a) * len, dy = Math.cos(tilt) * len;
    const steps = 2;
    for (let s = 0; s < steps; s++) {
      const f = s / steps;
      b.box(x + dx * f - th / 2, y + dy * f, z + dz * f - th / 2, th, len / steps + 0.05, th, false);
    }
    const nx = x + dx, ny = y + dy, nz = z + dz;
    branch(nx, ny, nz, a + 1.3 + r(i) * 0.8, tilt + 0.35, len * 0.65, th * 0.6, d + 1, i * 3 + 1);
    branch(nx, ny, nz, a - 1.1 - r(i + 7) * 0.8, tilt + 0.25, len * 0.6, th * 0.6, d + 1, i * 3 + 2);
  };
  branch(0, 0, 0, 0, 0.08, 2.2, 0.28, 0, 1);
  return b.geo();
}

function buildProps() {
  const trees = [], barrels = [], crates = [], crosses = [], slabs = [];
  const fence = new Builder(), gate = new Builder();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = tileAt(map, x, y);
    if (t === T.TREE) trees.push([x, y]);
    else if (t === T.BARREL) barrels.push([x, y]);
    else if (t === T.CRATE) crates.push([x, y]);
    else if (t === T.GRAVE) (hash(x * 131 + y * 17, 3, 3) < 0.5 ? crosses : slabs).push([x, y]);
    else if (t === T.FENCE || t === T.GATE) {
      const b = t === T.GATE ? gate : fence;
      const horiz = tileAt(map, x - 1, y) === T.FENCE || tileAt(map, x + 1, y) === T.FENCE || tileAt(map, x - 1, y) === T.GATE || tileAt(map, x + 1, y) === T.GATE;
      const step = t === T.GATE ? 0.2 : 0.33;
      for (let i = 0; i < 1; i += step) {
        if (horiz) b.box(x + i, 0, y + 0.45, 0.07, 1.5, 0.07); else b.box(x + 0.45, 0, y + i, 0.07, 1.5, 0.07);
      }
      if (horiz) { b.box(x, 0.4, y + 0.44, 1, 0.07, 0.09); b.box(x, 1.25, y + 0.44, 1, 0.07, 0.09); }
      else { b.box(x + 0.44, 0.4, y, 0.09, 0.07, 1); b.box(x + 0.44, 1.25, y, 0.09, 0.07, 1); }
    }
  }
  const iron = lambert({ color: 0x23242a });
  scene.add(new THREE.Mesh(fence.geo(), iron));
  gateMesh = new THREE.Mesh(gate.geo(), iron);
  scene.add(gateMesh);

  const inst = (geo, mat, list, fn) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    const o = new THREE.Object3D();
    list.forEach(([x, y], i) => { o.position.set(x + 0.5, 0, y + 0.5); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); fn(o, x, y); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.count = list.length;
    scene.add(m);
  };
  inst(treeGeometry(), lambert({ color: 0x241b14 }), trees, (o, x, y) => { o.rotation.y = hash(x, y, 1) * 6.28; const s = 0.8 + hash(x, y, 2) * 0.6; o.scale.set(s, s, s); });

  const barrelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.85, 8); barrelGeo.translate(0, 0.425, 0);
  inst(barrelGeo, lambert({ color: 0x4d3520 }), barrels, (o, x, y) => { o.rotation.y = hash(x, y) * 3; });
  const crateTex = canvasTex(tileCanvas(T.PIER, 3));
  const crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8); crateGeo.translate(0, 0.4, 0);
  inst(crateGeo, lambert({ map: crateTex, color: 0xb09070 }), crates, (o, x, y) => { o.rotation.y = hash(x, y) * 0.6; });

  const stone = lambert({ color: 0x6a6862 });
  const cb = new Builder(); cb.box(-0.07, 0, -0.07, 0.14, 1.1, 0.14); cb.box(-0.32, 0.65, -0.06, 0.64, 0.13, 0.12);
  inst(cb.geo(), stone, crosses, (o, x, y) => { o.rotation.y = (hash(x, y) - 0.5) * 0.4; o.rotation.z = (hash(y, x) - 0.5) * 0.25; });
  const sb = new Builder(); sb.box(-0.3, 0, -0.08, 0.6, 0.8, 0.16); sb.box(-0.32, 0, 0.1, 0.64, 0.08, 0.8);
  inst(sb.geo(), stone, slabs, (o, x, y) => { o.rotation.y = (hash(x, y) - 0.5) * 0.3; });
}

function buildAtmosphere() {
  const fogTex = canvasTex(makeFog(128, 5));
  fogTex.repeat.set(5, 5);
  const mk = (h, op) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), lambert({ map: fogTex.clone(), color: 0x9aa6ad, transparent: true, opacity: op, depthWrite: false }));
    m.material.map.repeat.set(5, 5);
    m.rotation.x = -Math.PI / 2; m.position.y = h;
    scene.add(m);
    return m;
  };
  mistA = mk(0.35, 0.9); mistB = mk(1.3, 0.55);

  const N = 500;
  rainPos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) resetDrop(i, Math.random() * 10, 0, 0);
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x8a96a0, transparent: true, opacity: 0.35 }));
  rain.frustumCulled = false;
  scene.add(rain);

  sparkPos = new Float32Array(300 * 3);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(300 * 3), 3));
  sparkPts = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.08, vertexColors: true, fog: false }));
  sparkPts.frustumCulled = false;
  scene.add(sparkPts);
}

function resetDrop(i, y, cx, cz) {
  const x = cx + (Math.random() - 0.5) * 24, z = cz + (Math.random() - 0.5) * 24;
  rainPos.set([x, y, z, x + 0.03, y + 0.35, z], i * 6);
}

// ------------------------------------------------------------ Figuren

const blob = blobTex();
function shadow(size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02;
  return m;
}

function part(w, h, d, color, pivotTop = true) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (pivotTop) g.translate(0, -h / 2, 0);
  return new THREE.Mesh(g, lambert({ color }));
}

export function makeHuman(look, opts = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const legL = part(0.17, 0.5, 0.18, 0x1b1712), legR = part(0.17, 0.5, 0.18, 0x1b1712);
  legL.position.set(-0.11, 0.5, 0); legR.position.set(0.11, 0.5, 0);
  const torso = part(0.5, 0.55, 0.3, look.cloak); torso.position.set(0, 1.05, 0);
  const skirt = part(0.54, 0.32, 0.34, look.cloak); skirt.position.set(0, 0.62, 0);
  const trim = part(0.55, 0.05, 0.35, look.trim || look.belt || look.cloak); trim.position.set(0, 0.32, 0);
  const armL = part(0.14, 0.52, 0.16, look.cloak), armR = part(0.14, 0.52, 0.16, look.cloak);
  armL.position.set(-0.32, 1.02, 0); armR.position.set(0.32, 1.02, 0);
  const handL = part(0.1, 0.1, 0.1, look.skin), handR = part(0.1, 0.1, 0.1, look.skin);
  handL.position.y = -0.5; handR.position.y = -0.5; armL.add(handL); armR.add(handR);
  const head = new THREE.Group(); head.position.set(0, 1.08, 0);
  const face = part(0.3, 0.32, 0.3, look.skin, false); face.position.y = 0.18; head.add(face);
  const eyeMat = new THREE.MeshBasicMaterial({ color: look.eyes || 0x120f0c });
  for (const ex of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), eyeMat); e.position.set(ex, 0.21, 0.155); head.add(e); }
  if (look.hood) {
    const h1 = part(0.36, 0.14, 0.36, look.hood, false); h1.position.set(0, 0.36, -0.01); head.add(h1);
    const h2 = part(0.36, 0.3, 0.06, look.hood, false); h2.position.set(0, 0.2, -0.17); head.add(h2);
    for (const sx of [-0.17, 0.17]) { const s = part(0.04, 0.3, 0.34, look.hood, false); s.position.set(sx, 0.2, 0); head.add(s); }
  } else if (look.hair) {
    const h1 = part(0.32, 0.1, 0.32, look.hair, false); h1.position.set(0, 0.37, 0); head.add(h1);
    const h2 = part(0.32, look.long ? 0.42 : 0.2, 0.06, look.hair, false); h2.position.set(0, look.long ? 0.16 : 0.26, -0.15); head.add(h2);
  }
  if (look.beard) { const b = part(0.26, 0.12, 0.06, look.beard, false); b.position.set(0, 0.06, 0.15); head.add(b); }
  if (look.belt) { const b = part(0.52, 0.06, 0.32, look.belt); b.position.set(0, 0.66, 0); body.add(b); }
  body.add(legL, legR, torso, skirt, trim, armL, armR, head);
  if (opts.weapon) {
    const w = part(0.05, 0.7, 0.05, 0x5a5550); w.position.set(0, -0.48, 0.05); w.rotation.x = Math.PI / 2 + 0.3; handR.add(w);
  }
  if (opts.lantern) {
    const lg = new THREE.Group(); lg.position.set(0, -0.12, 0.06); handL.add(lg);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.17, 0.13), new THREE.MeshBasicMaterial({ color: 0xf2c169 }));
    glass.position.y = -0.1; lg.add(glass);
    root.userData.glass = glass;
  }
  root.add(shadow(0.9));
  root.userData.parts = { legL, legR, armL, armR, head, body };
  root.scale.setScalar(0.92);
  return root;
}

function makePale() {
  const root = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xb4c0c6, emissive: 0x3a464c, transparent: true, opacity: 0.72, depthWrite: false });
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.3, 7, 1, true), mat); robe.position.y = 0.85; robe.rotation.x = Math.PI;
  robe.scale.set(1, -1, 1);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat); head.position.y = 1.62;
  const eye = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const ex of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.02), eye); e.position.set(ex, 1.64, 0.17); root.add(e); }
  const armGeo = new THREE.BoxGeometry(0.08, 0.6, 0.08); armGeo.translate(0, -0.3, 0);
  const aL = new THREE.Mesh(armGeo, mat), aR = new THREE.Mesh(armGeo, mat);
  aL.position.set(-0.3, 1.35, 0.05); aR.position.set(0.3, 1.35, 0.05);
  aL.rotation.x = aR.rotation.x = -1.1;
  root.add(robe, head, aL, aR);
  root.userData.parts = { aL, aR };
  root.userData.mat = mat;
  return root;
}

function makeRat() {
  const root = new THREE.Group();
  const m = lambert({ color: 0x4a3b2e });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.42), m); b.position.y = 0.1;
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.16), m); h.position.set(0, 0.12, 0.26);
  const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.4), lambert({ color: 0x7a5a50 })); t.position.set(0, 0.08, -0.4);
  const e = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xc04040 })); e.position.set(0, 0.15, 0.33);
  root.add(b, h, t, e, shadow(0.6));
  return root;
}

function makeLamp(l) {
  const g = new THREE.Group();
  const iron = lambert({ color: 0x25221e });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.1), iron); post.position.y = 1.05;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.3), iron); base.position.y = 0.07;
  const capM = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 4), iron); capM.position.y = 2.42; capM.rotation.y = Math.PI / 4;
  const mat = new THREE.MeshBasicMaterial({ color: 0x2b2a28 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), mat); head.position.y = 2.2;
  g.add(post, base, capM, head, shadow(0.8));
  g.position.set(U(l.px), 0, U(l.py) - 0.25);
  scene.add(g);
  lampMeshes.set(l.id, { mat });
}

// ------------------------------------------------------------ Laufzeit

export function openGate() { if (gateMesh) gateMesh.visible = false; groundTex.needsUpdate = true; }

export function resize(w, h, quality) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * quality);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 78 : 60;
  camera.updateProjectionMatrix();
}

function actorFor(obj, kind) {
  let a = actors.get(obj);
  if (!a) {
    if (kind === 'pale') a = makePale();
    else if (kind === 'rat') a = makeRat();
    else a = makeHuman(obj.look, kind === 'player' ? { lantern: true, weapon: true } : {});
    scene.add(a);
    actors.set(obj, a);
  }
  a.userData.seen = true;
  return a;
}

function animateHuman(a, moving, phase, atk) {
  const p = a.userData.parts;
  const sw = moving ? Math.sin(phase) * 0.7 : 0;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw * 0.6 - (a.userData.glass ? 0.5 : 0);
  p.armR.rotation.x = atk > 0 ? -2.4 + (1 - atk / 0.15) * 2.6 : sw * 0.6;
  p.body.position.y = moving ? Math.abs(Math.cos(phase)) * 0.04 : 0;
}

function isIndoor(px, py) { return tileAt(map, Math.floor(U(px)), Math.floor(U(py))) === T.FLOOR; }

function placeCamera(px, py, dt) {
  const x = U(px), z = U(py);
  const indoor = isIndoor(px, py);
  const pitch = indoor ? 0.95 : view.pitch;
  let dist = indoor ? 3.4 : view.dist;
  const dirx = Math.sin(view.yaw), dirz = Math.cos(view.yaw);
  if (!indoor) {
    for (let d = 0.4; d < dist; d += 0.2) {
      const t = tileAt(map, Math.floor(x + dirx * d * Math.cos(pitch)), Math.floor(z + dirz * d * Math.cos(pitch)));
      if (TALL.has(t) && 1.2 + d * Math.sin(pitch) < WALL_H + 1.4) { dist = Math.max(1.2, d - 0.3); break; }
    }
  }
  const tx = x + dirx * dist * Math.cos(pitch), ty = 1.2 + dist * Math.sin(pitch), tz = z + dirz * dist * Math.cos(pitch);
  const k = Math.min(1, dt * 8);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(x, 1.1, z);
  return indoor;
}

export function snapCamera(px, py) {
  camera.position.set(U(px) + Math.sin(view.yaw) * 4, 3, U(py) + Math.cos(view.yaw) * 4);
}

// w = { player, S, npcs, enemies, lamps, lights, sparks, time, dt, hurtFlash }
export function render(w) {
  const { player, S, time, dt } = w;
  const indoor = placeCamera(player.x, player.y, dt);

  // Dächer über dem Spieler ausblenden
  const tx = U(player.x), ty = U(player.y);
  for (const { mesh, r } of roofs) mesh.visible = !(tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);

  for (const a of actors.values()) a.userData.seen = false;

  // Spieler
  const pa = actorFor(player, 'player');
  pa.position.set(tx, 0, ty);
  pa.rotation.y = Math.atan2(player.fx, player.fy);
  animateHuman(pa, player.moving, player.phase, player.atkT);
  pa.userData.glass.material.color.setHex(S.player.oil > 0 ? 0xf2c169 : 0x3a332a);

  for (const n of w.npcs) {
    const a = actorFor(n, 'npc');
    a.visible = !n.hidden;
    if (n.hidden) continue;
    a.position.set(U(n.px), 0, U(n.py) - 0.2);
    const ang = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[n.dir] ?? 0;
    a.rotation.y = n.face ?? ang;
    animateHuman(a, false, 0, 0);
    a.userData.parts.head.rotation.y = Math.sin(time * 0.5 + n.x) * 0.2;
    const fade = n.fading ?? 1;
    a.traverse((o) => { if (o.material && o.material.opacity !== undefined && !o.material.map) { o.material.transparent = fade < 1; o.material.opacity = fade; } });
  }

  for (const e of w.enemies) {
    const a = actorFor(e, e.type);
    a.position.set(U(e.x), 0, U(e.y));
    a.rotation.y = Math.atan2(player.x - e.x, player.y - e.y);
    a.visible = !(e.hurtT > 0 && Math.floor(time * 30) % 2);
    if (e.type === 'pale') {
      a.position.y = 0.1 + Math.sin(time * 2 + e.homeX) * 0.08;
      a.userData.mat.opacity = 0.72 * (e.spawnA ?? 1) * (0.85 + Math.sin(time * 7 + e.homeY) * 0.1);
      const p = a.userData.parts;
      p.aL.rotation.x = -1.1 + Math.sin(time * 3) * 0.2; p.aR.rotation.x = -1.1 - Math.sin(time * 3) * 0.2;
    } else a.position.y = Math.abs(Math.sin(time * 18)) * 0.03;
  }
  for (const [obj, a] of actors) if (!a.userData.seen) { scene.remove(a); actors.delete(obj); }

  // Lampen
  for (const l of w.lamps) {
    if (!lampMeshes.has(l.id)) makeLamp(l);
    const flick = l.sick ? (Math.sin(time * 23 + l.x) > 0.2 ? 1 : 0.4) : 1;
    lampMeshes.get(l.id).mat.color.setHex(l.lit ? (flick > 0.5 ? 0xffd27a : 0xa06a2c) : 0x2b2a28);
  }

  // Licht: Laterne + die nächsten Quellen
  const oil = S.player.oil;
  const fl = 1 + Math.sin(time * 9) * 0.04 + Math.sin(time * 23) * 0.03;
  lantern.position.set(tx + player.fx * 0.3, 1.1, ty + player.fy * 0.3);
  lantern.intensity = (oil > 0 ? 5 + Math.min(2, oil / 40) : 0.7) * fl;
  lantern.distance = oil > 0 ? 9 : 3;
  const srcs = w.lights.map((l) => ({ ...l, d: Math.hypot(U(l.x) - tx, U(l.y) - ty) })).sort((a, b) => a.d - b.d);
  pool.forEach((pl, i) => {
    const s = srcs[i];
    if (!s || s.d > 26) { pl.intensity = 0; return; }
    pl.position.set(U(s.x), s.h, U(s.y));
    pl.color.setRGB(s.c[0] / 255, s.c[1] / 255, s.c[2] / 255);
    pl.intensity = s.i;
    pl.distance = s.r;
  });

  // Turmfeuer
  const ek = S.flags.ending_kind;
  towerFire.visible = !!ek;
  if (ek) { towerFire.scale.set(1, 0.8 + Math.sin(time * 9) * 0.15, 1); towerFire.material.color.setHex(ek === 'pure' ? 0xffd080 : 0xc8d0b0); }

  // Nebel, Regen, Wasser
  scene.fog.density = indoor ? 0.05 : 0.085;
  mistA.position.set(Math.round(tx), 0.35, Math.round(ty)); mistB.position.set(Math.round(tx), 1.3, Math.round(ty));
  mistA.material.map.offset.set(time * 0.006 + Math.round(tx) / 8, time * 0.002 + Math.round(ty) / 8);
  mistB.material.map.offset.set(-time * 0.004 + Math.round(tx) / 8, Math.round(ty) / 8);
  mistA.visible = mistB.visible = !indoor;
  waterTex.offset.set(time * 0.01, time * 0.004);
  for (let i = 0; i < rainPos.length / 6; i++) {
    const o = i * 6;
    rainPos[o + 1] -= dt * 14; rainPos[o + 4] -= dt * 14;
    if (rainPos[o + 1] < 0 || Math.abs(rainPos[o] - tx) > 13 || Math.abs(rainPos[o + 2] - ty) > 13) resetDrop(i, 6 + Math.random() * 4, tx, ty);
  }
  rain.geometry.attributes.position.needsUpdate = true;
  rain.visible = !indoor;

  // Funken
  const col = sparkPts.geometry.attributes.color.array;
  const c = new THREE.Color();
  for (let i = 0; i < 300; i++) {
    const s = w.sparks[i];
    if (s) { sparkPos.set([U(s.x), s.h, U(s.y)], i * 3); c.set(s.c); col.set([c.r, c.g, c.b], i * 3); }
    else sparkPos.set([0, -50, 0], i * 3);
  }
  sparkPts.geometry.attributes.position.needsUpdate = true;
  sparkPts.geometry.attributes.color.needsUpdate = true;

  flashEl.style.opacity = w.hurtFlash * 0.5;
  darkEl.style.opacity = oil <= 0 ? 0.35 + Math.sin(time * 2) * 0.08 : 0;

  renderer.render(scene, camera);
}

// Welt-Pixel -> CSS-Pixel im Sichtfenster (für Sprechblasen)
const tmp = new THREE.Vector3();
export function project(px, py, h, w, hgt) {
  tmp.set(U(px), h, U(py)).project(camera);
  return { x: (tmp.x + 1) / 2 * w, y: (1 - tmp.y) / 2 * hgt, visible: tmp.z < 1 };
}
