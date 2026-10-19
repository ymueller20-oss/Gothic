// 3D-Darstellung: echte Texturen (Poly Haven, CC0), Fachwerkhäuser, Modelle, Laternenlicht, Nebel.
// Spiellogik rechnet in Pixeln (16 pro Kachel); hier gilt 1 Kachel = 1 Einheit.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/meshopt_decoder.module.js';
import { TILE, MAP_W, MAP_H, T, HOUSES, BLOCKS, tileAt, hash, makeFog } from './world.js';

const U = (px) => px / TILE;
const WALL_H = 2.6;
const TALL = new Set([T.WALL, T.ROOF, T.TOWER, T.TDOOR]);

let renderer, scene, camera, map, waterTex;
let lantern, pool = [], mistA, mistB, rain, rainPos, sparkPts, sparkPos, flashEl, darkEl;
let post = null, gate, towerFire, towerGlow, crateProp, sabreProp, playerLantern;
const roofs = [];             // { group, r }
const lampFx = new Map();     // id -> { core, halo }
const actors = new Map();     // Spielobjekt -> Modell
const models = {};            // Name -> geladene Szene
export const view = { yaw: 0.0, dist: 3.6, pitch: 0.36 };

// ------------------------------------------------------------ Laden

const MODEL_LIST = ['large_iron_gate', 'street_lamp_01', 'street_lamp_02', 'wooden_lantern_01', 'wine_barrel_01', 'wooden_barrels_01',
  'wooden_crate_01', 'wooden_crate_02', 'dead_tree_trunk', 'dead_tree_trunk_02', 'tree_stump_01', 'rock_moss_set_01', 'boulder_01',
  'modular_wooden_pier', 'dutch_ship_medium', 'GothicBed_01', 'WoodenTable_01', 'WoodenChair_01', 'wooden_stool_01', 'treasure_chest',
  'wooden_handle_saber', 'stone_fire_pit', 'root_cluster_01', 'vintage_oil_lamp', 'wooden_bucket_01', 'street_rat',
  'dry_branches_medium_01', 'shrub_02'];
const TEX_LIST = ['mossy_cobblestone', 'muddy_tracks', 'mud_forest', 'weathered_planks', 'beam_wall_01', 'plastered_stone_wall',
  'thatch_roof_angled', 'roof_slates_02', 'castle_wall_slates', 'old_wood_floor', 'rock_wall_08', 'medieval_wall_01',
  'forest_leaves_02', 'bark_brown_02'];

const texs = {};
const M = {};                 // Materialien

export async function load(onProgress) {
  const total = MODEL_LIST.length + TEX_LIST.length;
  let done = 0;
  const tick = () => onProgress && onProgress(++done / total);
  const tl = new THREE.TextureLoader();
  const gl = new GLTFLoader();
  gl.setMeshoptDecoder(MeshoptDecoder);
  const loadTex = (f, srgb) => new Promise((res) => tl.load(f, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    res(t);
  }, undefined, () => res(null)));
  await Promise.all([
    ...TEX_LIST.map(async (n) => {
      texs[n] = { map: await loadTex(`assets/tex/${n}_diff.webp`, true), normalMap: await loadTex(`assets/tex/${n}_nor.webp`, false) };
      tick();
    }),
    ...MODEL_LIST.map((n) => new Promise((res) => gl.load(`assets/models/${n}.glb`, (g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.material.envMapIntensity = 0; } });
      models[n] = g.scene; tick(); res();
    }, undefined, () => { tick(); res(); }))),
  ]);
}

function mat(name, extra = {}) {
  const t = texs[name] || {};
  return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.92, metalness: 0, ...extra });
}

// Modell auf Zielgröße bringen: size = Höhe (axis 'y') oder größte Grundfläche ('xz')
function prop(name, size, axis = 'y') {
  const src = models[name];
  if (!src) return new THREE.Group();
  const o = src.clone(true);
  const box = new THREE.Box3().setFromObject(o);
  const s = box.getSize(new THREE.Vector3());
  const k = size / (axis === 'y' ? s.y : Math.max(s.x, s.z));
  o.scale.setScalar(k);
  const c = box.getCenter(new THREE.Vector3());
  o.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  const g = new THREE.Group();
  g.add(o);
  return g;
}

function place(name, size, x, z, rot = 0, axis = 'y', y = 0) {
  const g = prop(name, size, axis);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  scene.add(g);
  return g;
}

// Viele Kopien eines Modells mit wenigen Draw-Calls
function instanced(name, size, list, axis = 'y') {
  if (!list.length || !models[name]) return;
  const tpl = prop(name, size, axis);
  tpl.updateMatrixWorld(true);
  const o = new THREE.Object3D();
  tpl.traverse((m) => {
    if (!m.isMesh) return;
    const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
    list.forEach(([x, z, rot = 0, s = 1, y = 0], i) => {
      o.position.set(x, y, z); o.rotation.set(0, rot, 0); o.scale.setScalar(s); o.updateMatrix();
      im.setMatrixAt(i, o.matrix.clone().multiply(m.matrixWorld));
    });
    scene.add(im);
  });
}

// ------------------------------------------------------------ Geometrie-Baukasten (Welt-UVs)

class Builder {
  constructor(scale = 2) { this.p = []; this.n = []; this.uv = []; this.s = scale; }
  quad(a, b, c, d, n) {
    const s = this.s;
    const uvOf = (v) => (Math.abs(n[1]) > 0.5 ? [v[0] / s, v[2] / s] : Math.abs(n[0]) > 0.5 ? [v[2] / s, v[1] / s] : [v[0] / s, v[1] / s]);
    for (const v of [a, b, c, a, c, d]) { this.p.push(...v); this.n.push(...n); this.uv.push(...uvOf(v)); }
  }
  box(x, y, z, w, h, d, top = true, bottom = false) {
    const x1 = x + w, y1 = y + h, z1 = z + d;
    this.quad([x, y1, z1], [x, y, z1], [x1, y, z1], [x1, y1, z1], [0, 0, 1]);
    this.quad([x1, y1, z], [x1, y, z], [x, y, z], [x, y1, z], [0, 0, -1]);
    this.quad([x, y1, z], [x, y, z], [x, y, z1], [x, y1, z1], [-1, 0, 0]);
    this.quad([x1, y1, z1], [x1, y, z1], [x1, y, z], [x1, y1, z], [1, 0, 0]);
    if (top) this.quad([x, y1, z], [x, y1, z1], [x1, y1, z1], [x1, y1, z], [0, 1, 0]);
    if (bottom) this.quad([x, y, z1], [x, y, z], [x1, y, z], [x1, y, z1], [0, -1, 0]);
  }
  tri(a, b, c, n) {
    const s = this.s;
    const uvOf = (v) => (Math.abs(n[0]) > 0.5 ? [v[2] / s, v[1] / s] : [v[0] / s, v[1] / s]);
    for (const v of [a, b, c]) { this.p.push(...v); this.n.push(...n); this.uv.push(...uvOf(v)); }
  }
  // Satteldach: Dachflächen mit eigenen UVs (Ziegel laufen die Schräge hinab)
  roof(x, y, z, w, d, rh, over = 0.45) {
    x -= over; z -= over; w += over * 2; d += over * 2;
    const y1 = y + rh, s = this.s;
    const slope = (a, b, c, e, n, len, run) => {
      const uvs = [[0, 0], [run / s, 0], [run / s, len / s], [0, len / s]];
      for (const i of [0, 1, 2, 0, 2, 3]) { this.p.push(...[a, b, c, e][i]); this.n.push(...n); this.uv.push(...uvs[i]); }
    };
    if (w >= d) {
      const zm = z + d / 2, sl = Math.hypot(d / 2, rh);
      slope([x, y1, zm], [x + w, y1, zm], [x + w, y, z], [x, y, z], norm([0, d / 2, -rh]), sl, w);
      slope([x + w, y1, zm], [x, y1, zm], [x, y, z + d], [x + w, y, z + d], norm([0, d / 2, rh]), sl, w);
    } else {
      const xm = x + w / 2, sl = Math.hypot(w / 2, rh);
      slope([xm, y1, z + d], [xm, y1, z], [x, y, z], [x, y, z + d], norm([-rh, w / 2, 0]), sl, d);
      slope([xm, y1, z], [xm, y1, z + d], [x + w, y, z + d], [x + w, y, z], norm([rh, w / 2, 0]), sl, d);
    }
  }
  gable(x, y, z, w, d, rh, out) {
    // Giebeldreiecke in Wandtextur
    if (w >= d) {
      const zm = z + d / 2;
      out.tri([x, y, z + d], [x, y, z], [x, y + rh, zm], [-1, 0, 0]);
      out.tri([x + w, y, z], [x + w, y, z + d], [x + w, y + rh, zm], [1, 0, 0]);
    } else {
      const xm = x + w / 2;
      out.tri([x, y, z], [x + w, y, z], [xm, y + rh, z], [0, 0, -1]);
      out.tri([x + w, y, z + d], [x, y, z + d], [xm, y + rh, z + d], [0, 0, 1]);
    }
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return new THREE.Mesh(g, material);
  }
}

function norm(v) { const l = Math.hypot(...v); return v.map((a) => a / l); }

// ------------------------------------------------------------ Welt aufbauen

export function init(canvas, worldMap) {
  map = worldMap;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.7;
  renderer.setClearColor(0x080b0f);
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x12150f, 0.07);
  scene.background = new THREE.Color(0x12150f);
  camera = new THREE.PerspectiveCamera(72, 1, 0.1, 90);

  for (const [k, n] of [['cobble', 'mossy_cobblestone'], ['mud', 'mud_forest'], ['tracks', 'muddy_tracks'], ['planks', 'weathered_planks'],
    ['timber', 'beam_wall_01'], ['plaster', 'plastered_stone_wall'], ['thatch', 'thatch_roof_angled'], ['slate', 'roof_slates_02'],
    ['tower', 'castle_wall_slates'], ['floor', 'old_wood_floor'], ['rock', 'rock_wall_08'], ['stone', 'medieval_wall_01'],
    ['leaves', 'forest_leaves_02'], ['bark', 'bark_brown_02']]) M[k] = mat(n);
  M.thatch.side = M.slate.side = THREE.DoubleSide;
  M.wood = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.9, map: texs.weathered_planks?.map });
  M.iron = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.55, metalness: 0.6 });
  M.windowLit = new THREE.MeshBasicMaterial({ color: 0xffa24a });
  M.windowDark = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.3 });

  scene.add(new THREE.HemisphereLight(0x4a5866, 0x1c1810, 1.1));
  const moon = new THREE.DirectionalLight(0x8090b0, 0.35);
  moon.position.set(-20, 30, 10);
  scene.add(moon);

  lantern = new THREE.PointLight(0xffa850, 14, 11, 1.6);
  scene.add(lantern);
  for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffb060, 0, 12, 1.6); scene.add(l); pool.push(l); }

  buildGround();
  buildOuterLand();
  buildWater();
  buildBuildings();
  buildProps();
  buildInteriors();
  buildAtmosphere();

  flashEl = document.getElementById('flash');
  darkEl = document.getElementById('dark');
}

// Leichte Bodenwellen und unregelmäßige Kachelkanten
const jitter = (x, z) => [(hash(x, z, 21) - 0.5) * 0.45, (hash(x, z, 22) - 0.5) * 0.45];
const bump = (x, z) => (hash(x, z, 23) - 0.5) * 0.12;

function buildGround() {
  const groups = { cobble: new Builder(2.2), mud: new Builder(3), tracks: new Builder(3), planks: new Builder(1.6), floor: new Builder(1.8), shore: new Builder(2.5) };
  const side = new Builder(1.5);
  const pick = (t, x, y) => {
    if (t === T.COBBLE) return 'cobble';
    if (t === T.PIER) return 'planks';
    if (t === T.FLOOR || t === T.WALL) return 'floor';
    if (t === T.SHORE) return 'shore';
    return hash(x, y, 31) < 0.25 ? 'tracks' : 'mud';
  };
  const vtx = (vx, vz, h, soft) => {
    const [jx, jz] = soft ? jitter(vx, vz) : [0, 0];
    return [vx + jx, h + (soft ? bump(vx, vz) : 0), vz + jz];
  };
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = tileAt(map, x, y);
    if (t === T.WATER) continue;
    const k = pick(t, x, y);
    const h = k === 'planks' ? 0.14 : k === 'cobble' ? 0.03 : 0;
    const soft = k === 'mud' || k === 'tracks' || k === 'shore';
    // Kanten zum Wasser nicht verschieben, sonst klaffen Lücken
    const nearWater = [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1], [1, 1], [-1, 1], [1, -1]].some(([dx, dy]) => tileAt(map, x + dx, y + dy) === T.WATER);
    const s = soft && !nearWater;
    groups[k].quad(vtx(x, y, h, s), vtx(x, y + 1, h, s), vtx(x + 1, y + 1, h, s), vtx(x + 1, y, h, s), [0, 1, 0]);
    const edge = (dx, dy) => tileAt(map, x + dx, y + dy) === T.WATER;
    const lo = -0.7;
    if (edge(0, 1)) side.quad([x, h, y + 1], [x, lo, y + 1], [x + 1, lo, y + 1], [x + 1, h, y + 1], [0, 0, 1]);
    if (edge(0, -1)) side.quad([x + 1, h, y], [x + 1, lo, y], [x, lo, y], [x, h, y], [0, 0, -1]);
    if (edge(1, 0)) side.quad([x + 1, h, y + 1], [x + 1, lo, y + 1], [x + 1, lo, y], [x + 1, h, y], [1, 0, 0]);
    if (edge(-1, 0)) side.quad([x, h, y], [x, lo, y], [x, lo, y + 1], [x, h, y + 1], [-1, 0, 0]);
  }
  scene.add(groups.cobble.mesh(M.cobble));
  scene.add(groups.mud.mesh(M.mud));
  scene.add(groups.tracks.mesh(M.tracks));
  scene.add(groups.planks.mesh(M.planks));
  scene.add(groups.floor.mesh(M.floor));
  scene.add(groups.shore.mesh(mat('mud_forest', { color: 0x8a8278 })));
  scene.add(side.mesh(M.rock));

  // Stegpfähle
  const posts = new Builder(1);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < 8; x++) {
    if (tileAt(map, x, y) === T.PIER && tileAt(map, x, y + 1) === T.WATER && x % 2 === 0) posts.box(x + 0.4, -1, y + 0.8, 0.2, 1.5, 0.2);
  }
  scene.add(posts.mesh(M.wood));
}

// Hügel im Norden und Osten, damit die Welt nicht abrupt endet
function buildOuterLand() {
  const N = 40, x0 = -10, z0 = -24, x1 = MAP_W + 24, z1 = MAP_H;
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, N, N);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const dx = Math.max(0, x - MAP_W), dz = Math.max(0, -z);
    const inside = x > 7 && z > 0 && x < MAP_W && z < MAP_H;
    const d = Math.hypot(dx, dz);
    p.setY(i, inside ? -2 : d * 0.9 + (hash(Math.round(x), Math.round(z), 4) - 0.2) * d * 0.25 - 0.05);
    uv.setXY(i, x / 4, z / 4);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M.rock);
  m.position.y = -0.01;
  scene.add(m);
  // tote Bäume auf den Hügeln
  const trees = [];
  for (let i = 0; i < 80; i++) {
    const x = MAP_W - 2 + hash(i, 1, 9) * 22, z = -20 + hash(i, 2, 9) * (MAP_H + 20);
    const z2 = -20 + hash(i, 3, 9) * 20, x2 = -6 + hash(i, 4, 9) * (MAP_W + 10);
    for (const [tx, tz] of [[x, z], [x2, z2]]) {
      const dx = Math.max(0, tx - MAP_W), dz = Math.max(0, -tz), d = Math.hypot(dx, dz);
      if (d > 1.5) trees.push([tx, tz, d]);
    }
  }
  const g = deadTreeGeometry();
  const im = new THREE.InstancedMesh(g, M.bark, trees.length);
  const o = new THREE.Object3D();
  trees.forEach(([x, z, d], i) => {
    o.position.set(x, d * 0.9 - 0.2, z); o.rotation.set(0, hash(i, 5, 9) * 6, 0); o.scale.setScalar(1 + hash(i, 6, 9) * 0.8); o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  scene.add(im);
}

function buildWater() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) {
    const v = 110 + ((hash(i, 1, 5) * 40) | 0);
    g.fillStyle = `rgb(${v},${v},255)`;
    g.fillRect((hash(i, 2, 5) * 128) | 0, (hash(i, 3, 5) * 128) | 0, 6 + ((hash(i, 4, 5) * 14) | 0), 2);
  }
  waterTex = new THREE.CanvasTexture(c);
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(40, 50);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W + 120, MAP_H + 120),
    new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.08, metalness: 0.2, normalMap: waterTex, normalScale: new THREE.Vector2(0.4, 0.4) }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(MAP_W / 2 - 30, -0.4, MAP_H / 2 + 30);
  scene.add(m);
}

// ------------------------------------------------------------ Häuser

function windowAt(x, y, z, axis, lit, out) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.08), M.wood);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), lit ? M.windowLit : M.windowDark);
  pane.position.z = 0.045;
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.03), M.wood); cross1.position.z = 0.06;
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.03), M.wood); cross2.position.z = 0.06;
  g.add(frame, pane, cross1, cross2);
  if (!lit) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.04), M.wood);
    sh.position.set(-0.46, 0, 0.04); sh.rotation.y = 0.5; g.add(sh);
  }
  g.position.set(x, y, z);
  g.rotation.y = axis;
  out.add(g);
  if (lit) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xff9a40, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(1.6, 1.6, 1);
    halo.position.set(x + Math.sin(axis) * 0.2, y, z + Math.cos(axis) * 0.2);
    out.add(halo);
  }
}

function doorAt(x, z, axis, out) {
  const g = new THREE.Group();
  const d = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.1), M.wood);
  d.position.y = 0.8;
  const fr = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.06), new THREE.MeshStandardMaterial({ color: 0x1a120b, roughness: 0.9 }));
  fr.position.set(0, 0.9, -0.03);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 8), M.iron);
  ring.position.set(0.25, 0.8, 0.07);
  g.add(fr, d, ring);
  g.position.set(x, 0.02, z);
  g.rotation.y = axis;
  out.add(g);
}

function buildBuildings() {
  const stone = new Builder(2), timber = new Builder(2.6), plaster = new Builder(2.2);
  const thatch = new Builder(2.4), slate = new Builder(1.8), chimney = new Builder(1.4);
  const deco = new THREE.Group();
  scene.add(deco);

  // Geschlossene Fachwerkhäuser
  for (const r of BLOCKS) {
    const big = r.w * r.h >= 20;
    const top = big ? 4.3 : WALL_H;
    stone.box(r.x, 0, r.y, r.w, 0.55, r.h, false);
    timber.box(r.x + 0.02, 0.55, r.y + 0.02, r.w - 0.04, WALL_H - 0.55, r.h - 0.04, false);
    if (big) timber.box(r.x - 0.18, WALL_H, r.y - 0.18, r.w + 0.36, top - WALL_H, r.h + 0.36, false, true);
    const rh = Math.min(r.w, r.h) * 0.62 + 0.6;
    const ov = big ? 0.18 : 0;
    const roofB = hash(r.x, r.y, 8) < 0.6 ? thatch : slate;
    roofB.roof(r.x - ov, top, r.y - ov, r.w + ov * 2, r.h + ov * 2, rh);
    roofB.gable(r.x - ov, top, r.y - ov, r.w + ov * 2, r.h + ov * 2, rh, plaster);
    if (hash(r.x, r.y, 9) < 0.6) chimney.box(r.x + r.w * 0.7, top, r.y + r.h * 0.3, 0.5, rh + 0.6, 0.5);
    // Front (Süden): Tür und Fenster
    const fz = r.y + r.h + 0.03;
    doorAt(r.x + r.w / 2, fz, 0, deco);
    const lit = hash(r.x, r.y, 5) < 0.45;
    if (r.w >= 4) { windowAt(r.x + 0.9, 1.5, fz, 0, lit, deco); windowAt(r.x + r.w - 0.9, 1.5, fz, 0, !lit && hash(r.x, 2, 5) < 0.5, deco); }
    if (big) windowAt(r.x + r.w / 2, 3.4, fz + 0.18, 0, hash(r.x, r.y, 6) < 0.5, deco);
    windowAt(r.x - 0.03, 1.5, r.y + r.h / 2, -Math.PI / 2, false, deco);
    windowAt(r.x + r.w + 0.03, 1.5, r.y + r.h / 2, Math.PI / 2, hash(r.y, r.x, 5) < 0.3, deco);
  }

  // Begehbare Häuser: Mauern pro Kachel, Dach wird ausgeblendet, wenn man drin ist
  for (const r of HOUSES) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (tileAt(map, x, y) !== T.WALL) continue;
      stone.box(x, 0, y, 1, 0.55, 1, false);
      timber.box(x + 0.01, 0.55, y + 0.01, 0.98, WALL_H - 0.55, 0.98);
    }
    const g = new THREE.Group();
    const rb = new Builder(2.4), gb = new Builder(2.2);
    const rh = Math.min(r.w, r.h) * 0.55 + 0.6;
    rb.roof(r.x, WALL_H, r.y, r.w, r.h, rh);
    rb.gable(r.x, WALL_H, r.y, r.w, r.h, rh, gb);
    g.add(rb.mesh(r.w * r.h > 60 ? M.slate : M.thatch), gb.mesh(M.plaster));
    scene.add(g);
    roofs.push({ group: g, r });
    // Fenster an den Außenseiten
    windowAt(r.x + 1.5, 1.5, r.y + r.h + 0.03, 0, true, deco);
    windowAt(r.x + r.w - 1.5, 1.5, r.y - 0.03, Math.PI, true, deco);
  }

  scene.add(stone.mesh(M.stone), timber.mesh(M.timber), plaster.mesh(M.plaster), thatch.mesh(M.thatch), slate.mesh(M.slate), chimney.mesh(M.stone));

  // Wandlaternen an Haustüren
  for (const r of BLOCKS) if (hash(r.x, r.y, 12) < 0.5) {
    const l = place('street_lamp_02', 0.9, r.x + r.w / 2 + 0.7, r.y + r.h + 0.15, Math.PI, 'y', 1.6);
    l.rotation.y = 0;
  }

  // Turm mit Wachfeuer
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.9, 14, 14, 1, true), M.tower);
  M.tower.map && (M.tower.map = M.tower.map.clone(), M.tower.map.repeat.set(8, 6), M.tower.map.needsUpdate = true);
  M.tower.normalMap && (M.tower.normalMap = M.tower.normalMap.clone(), M.tower.normalMap.repeat.set(8, 6), M.tower.normalMap.needsUpdate = true);
  tower.position.set(48, 7, 10.5);
  scene.add(tower);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.3, 0.7, 14), M.stone);
  ring.position.set(48, 14.2, 10.5);
  scene.add(ring);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const mer = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.5), M.stone);
    mer.position.set(48 + Math.cos(a) * 3.6, 14.9, 10.5 + Math.sin(a) * 3.6);
    mer.rotation.y = -a;
    scene.add(mer);
  }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.8, 0.9, 10), M.iron);
  bowl.position.set(48, 15, 10.5);
  scene.add(bowl);
  towerFire = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 9), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  towerFire.position.set(48, 16.6, 10.5);
  towerFire.visible = false;
  scene.add(towerFire);
  towerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffb060, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  towerGlow.scale.set(14, 14, 1);
  towerGlow.position.set(48, 16.5, 10.5);
  towerGlow.visible = false;
  scene.add(towerGlow);
  const tdoor = new THREE.Group();
  doorAt(0, 0, Math.PI, tdoor);
  tdoor.scale.set(1.3, 1.3, 1.3);
  tdoor.position.set(47.5, 0, 7.0);
  scene.add(tdoor);
  for (let i = 0; i < 5; i++) windowAt(48 + Math.cos(1.2 + i) * 3.45, 4 + i * 2, 10.5 + Math.sin(1.2 + i) * 3.45, Math.PI / 2 - (1.2 + i), false, deco);
}

// ------------------------------------------------------------ Bäume, Requisiten

function deadTreeGeometry() {
  const parts = [];
  const r = (i) => hash(i, 3, 11);
  const branch = (base, dir, len, rad, depth, seed) => {
    const g = new THREE.CylinderGeometry(rad * 0.62, rad, len, 6, 1, true);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyQuaternion(q);
    g.translate(base.x, base.y, base.z);
    parts.push(g);
    if (depth > 3) return;
    const tip = base.clone().add(dir.clone().multiplyScalar(len));
    const n = depth === 0 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const a = r(seed * 7 + k) * Math.PI * 2;
      const tilt = 0.45 + r(seed * 13 + k) * 0.5;
      const nd = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)).lerp(dir, 0.35).normalize();
      branch(tip, nd, len * (0.55 + r(seed + k) * 0.2), rad * 0.62, depth + 1, seed * 3 + k + 1);
    }
  };
  branch(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0.05, 1, 0.02).normalize(), 2.2, 0.2, 0, 1);
  return mergeGeos(parts);
}

function mergeGeos(list) {
  let n = 0;
  for (const g of list) n += g.index ? g.index.count : g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

function buildProps() {
  const trees = [], barrels = [], crates = [], crosses = [], slabs = [], rocks = [], stumps = [], branches = [], shrubs = [];
  const fence = new Builder(1);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = tileAt(map, x, y);
    const cx = x + 0.5, cz = y + 0.5, h = hash(x, y, 1);
    if (t === T.TREE) trees.push([cx + (h - 0.5) * 0.3, cz, h * 6.28, 0.9 + hash(x, y, 2) * 0.6]);
    else if (t === T.BARREL) barrels.push([cx, cz, h * 6]);
    else if (t === T.CRATE) crates.push([cx, cz, (h - 0.5) * 0.5]);
    else if (t === T.GRAVE) (hash(x * 131 + y * 17, 3, 3) < 0.5 ? crosses : slabs).push([cx, cz, (h - 0.5) * 0.3]);
    else if (t === T.FENCE) {
      const horiz = [T.FENCE, T.GATE].includes(tileAt(map, x - 1, y)) || [T.FENCE, T.GATE].includes(tileAt(map, x + 1, y));
      for (let i = 0.1; i < 1; i += 0.2) {
        if (horiz) { fence.box(x + i, 0, y + 0.47, 0.05, 1.4, 0.05); fence.box(x + i - 0.02, 1.4, y + 0.45, 0.09, 0.12, 0.09); }
        else { fence.box(x + 0.47, 0, y + i, 0.05, 1.4, 0.05); fence.box(x + 0.45, 1.4, y + i - 0.02, 0.09, 0.12, 0.09); }
      }
      if (horiz) { fence.box(x, 0.3, y + 0.45, 1, 0.06, 0.09); fence.box(x, 1.2, y + 0.45, 1, 0.06, 0.09); }
      else { fence.box(x + 0.45, 0.3, y, 0.09, 0.06, 1); fence.box(x + 0.45, 1.2, y, 0.09, 0.06, 1); }
      if ((x + y) % 4 === 0) fence.box(x + 0.38, 0, y + 0.38, 0.24, 1.7, 0.24);
    } else if ((t === T.MUD || t === T.GRASS || t === T.SHORE) && !nearPath(x, y)) {
      if (h < 0.03) rocks.push([cx, cz, h * 200, 0.6 + hash(x, y, 4) * 0.8]);
      else if (h < 0.05) stumps.push([cx, cz, h * 200, 0.8]);
      else if (h < 0.12) branches.push([cx, cz, h * 60, 1]);
      else if (h < 0.17 && t !== T.SHORE) shrubs.push([cx, cz, h * 60, 0.7 + hash(x, y, 5) * 0.5]);
    }
  }
  scene.add(fence.mesh(M.iron));

  const tg = deadTreeGeometry();
  const tm = new THREE.InstancedMesh(tg, M.bark, trees.length);
  const o = new THREE.Object3D();
  trees.forEach(([x, z, rot, s], i) => { o.position.set(x, 0, z); o.rotation.set(0, rot, 0); o.scale.set(s, s * (0.9 + hash(i, 7) * 0.4), s); o.updateMatrix(); tm.setMatrixAt(i, o.matrix); });
  scene.add(tm);

  instanced('wine_barrel_01', 0.95, barrels);
  instanced('wooden_crate_01', 0.85, crates);
  instanced('rock_moss_set_01', 1.0, rocks, 'xz');
  instanced('tree_stump_01', 0.9, stumps, 'xz');
  instanced('dry_branches_medium_01', 1.3, branches, 'xz');
  instanced('shrub_02', 0.9, shrubs);

  // Grabsteine
  const cb = new Builder(1.2); cb.box(-0.08, 0, -0.08, 0.16, 1.15, 0.16); cb.box(-0.34, 0.7, -0.07, 0.68, 0.15, 0.14);
  const sb = new Builder(1.2); sb.box(-0.32, 0, -0.09, 0.64, 0.85, 0.18); sb.box(-0.36, 0, 0.12, 0.72, 0.1, 0.9);
  const gm = mat('medieval_wall_01', { color: 0x9a968e });
  for (const [geoB, list] of [[cb, crosses], [sb, slabs]]) {
    const m = geoB.mesh(gm);
    const im = new THREE.InstancedMesh(m.geometry, gm, list.length);
    list.forEach(([x, z, rot], i) => { o.position.set(x, 0, z); o.rotation.set((hash(i, 1, 2) - 0.5) * 0.15, rot, (hash(i, 2, 2) - 0.5) * 0.2); o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    scene.add(im);
  }

  // Friedhofstor
  gate = place('large_iron_gate', 3, 27.5, 52.5, 0, 'xz');

  // Hafen: Steg, Schiff, Fässer
  place('modular_wooden_pier', 7, 4.5, 23.5, Math.PI / 2, 'xz', -0.25);
  place('dutch_ship_medium', 13, -4, 36, Math.PI * 0.55, 'xz', -0.6);
  place('wooden_barrels_01', 1.6, 13.5, 26.5, 0.4, 'xz', 0.14);
  place('wooden_bucket_01', 0.4, 10.6, 21.4, 0, 'y', 0.14);
  place('dead_tree_trunk', 3.5, 20, 66.2, 0.3, 'xz');
  place('dead_tree_trunk_02', 3.5, 44, 3, 1.2, 'xz');
  place('root_cluster_01', 2.2, 52, 66, 0.5, 'xz');
  place('boulder_01', 2.5, 41, 2.5, 0.3, 'xz');
  place('boulder_01', 2.0, 53, 12, 2.1, 'xz');
}

function nearPath(x, y) {
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const t = tileAt(map, x + i, y + j);
    if (t === T.COBBLE || t === T.PIER || t === T.FLOOR || t === T.WALL || t === T.FENCE || t === T.GATE) return true;
  }
  return false;
}

function buildInteriors() {
  // Gasthaus
  place('stone_fire_pit', 1.3, 32.5, 14.5, 0, 'xz');
  for (const [x, z] of [[35.5, 15.5], [37, 18]]) {
    place('WoodenTable_01', 0.8, x, z, 0.1);
    place('wooden_stool_01', 0.5, x - 0.9, z, 0); place('wooden_stool_01', 0.5, x + 0.9, z + 0.2, 1);
  }
  place('wine_barrel_01', 0.95, 38.5, 13.5); place('wine_barrel_01', 0.95, 37.6, 13.4, 1);
  // Kontor
  place('WoodenTable_01', 0.8, 18.5, 13.2); place('WoodenChair_01', 1.0, 18.5, 12.4, 0);
  place('vintage_oil_lamp', 0.35, 18.9, 13.1, 0, 'y', 0.8);
  place('treasure_chest', 0.9, 21, 12.3, Math.PI, 'xz');
  // Werkstatt
  place('GothicBed_01', 2.0, 34.3, 41.6, Math.PI / 2, 'xz');
  place('WoodenTable_01', 0.8, 31.3, 41.4); place('WoodenChair_01', 1.0, 31.3, 42.2, Math.PI);
  place('vintage_oil_lamp', 0.35, 31.6, 41.3, 0, 'y', 0.8);
  place('wooden_bucket_01', 0.4, 34.5, 44.4);
  place('wooden_crate_02', 0.7, 33.6, 44.5, 0.3);
  // Wachstube
  place('WoodenTable_01', 0.8, 46.5, 22.5, Math.PI / 2);
  place('wooden_stool_01', 0.5, 45.6, 22.5); place('wooden_stool_01', 0.5, 47.4, 22.8, 1);
  place('wine_barrel_01', 0.95, 49.4, 22.4);
  // Lagerhaus: Gildenkiste und Säbel
  crateProp = place('wooden_crate_02', 0.75, 14.5, 40.5, 0.2);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0x8a1a12, roughness: 0.5 }));
  seal.rotation.x = Math.PI / 2; seal.position.set(0, 0.45, 0.39); crateProp.add(seal);
  sabreProp = place('wooden_handle_saber', 1.0, 20.5, 44.5, 0.4, 'xz', 0.86);
  place('wooden_crate_01', 0.85, 20.5, 44.5, 0.4);
}

// ------------------------------------------------------------ Atmosphäre

let _halo = null;
function haloTex() {
  if (_halo) return _halo;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _halo = new THREE.CanvasTexture(c);
  return _halo;
}

function buildAtmosphere() {
  const fogTex = new THREE.CanvasTexture(makeFog(128, 5));
  fogTex.wrapS = fogTex.wrapT = THREE.RepeatWrapping;
  const mk = (h, op) => {
    const t = fogTex.clone(); t.needsUpdate = true; t.repeat.set(5, 5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshLambertMaterial({ map: t, color: 0xa0aab0, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = h;
    scene.add(m);
    return m;
  };
  mistA = mk(0.3, 0.85); mistB = mk(1.2, 0.5);

  const N = 600;
  rainPos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) resetDrop(i, Math.random() * 10, 0, 0);
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9aa6b0, transparent: true, opacity: 0.3 }));
  rain.frustumCulled = false;
  scene.add(rain);

  sparkPos = new Float32Array(300 * 3);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(300 * 3), 3));
  sparkPts = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, fog: false, blending: THREE.AdditiveBlending, transparent: true }));
  sparkPts.frustumCulled = false;
  scene.add(sparkPts);
}

function resetDrop(i, y, cx, cz) {
  const x = cx + (Math.random() - 0.5) * 26, z = cz + (Math.random() - 0.5) * 26;
  rainPos.set([x, y, z, x + 0.03, y + 0.4, z], i * 6);
}

// ------------------------------------------------------------ Figuren

let _blob = null;
function shadow(size) {
  if (!_blob) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    _blob = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: _blob, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.035;
  return m;
}

// Kantige Flächen statt glatter Rundungen
const cloth = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });

function seg(rTop, rBot, len, material, sides = 6) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, sides);
  g.translate(0, -len / 2, 0);
  return new THREE.Mesh(g, material);
}

// Figur mit Proportionen eines Erwachsenen (ca. 7,5 Kopflängen), Gelenke an Hüfte, Knie, Schulter, Ellbogen.
// Größe 1,25 Einheiten. Wird ersetzt, sobald echte Figurenmodelle eingebunden sind.
export function makeHuman(look, opts = {}) {
  const H = 1.25;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const cm = cloth(look.cloak), sm = cloth(look.skin), pants = cloth(0x2a241c), boot = cloth(0x17130f);
  const trim = cloth(look.trim || look.belt || look.cloak);

  // Beine: Oberschenkel -> Knie -> Unterschenkel -> Fuß
  const hipY = H * 0.53, thigh = H * 0.25, shin = H * 0.24;
  const legs = [-1, 1].map((sx) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.07, hipY, 0);
    const up = seg(0.06, 0.045, thigh, pants); hip.add(up);
    const knee = new THREE.Group(); knee.position.y = -thigh; hip.add(knee);
    const low = seg(0.045, 0.04, shin, boot); knee.add(low);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.16), boot); foot.position.set(0, -shin - 0.01, 0.04); knee.add(foot);
    body.add(hip);
    return { hip, knee };
  });

  // Rumpf: Becken, Taille, Brustkorb
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.12, 7), cm); pelvis.position.y = hipY + 0.04; pelvis.scale.z = 0.75;
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.125, 0.16, 7), cm); waist.position.y = hipY + 0.17; waist.scale.z = 0.7;
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.2, 7), cm); chest.position.y = hipY + 0.34; chest.scale.z = 0.68;
  const shoulderY = H * 0.82;
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 0.07, 7), cm); yoke.position.y = shoulderY + 0.005; yoke.scale.z = 0.68;
  // Rock / Mantelschoß bis übers Knie
  const skirtMat = cm.clone(); skirtMat.side = THREE.DoubleSide;
  const skirtLen = look.long ? H * 0.42 : H * 0.3;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.2, skirtLen, 8, 1, true), skirtMat);
  skirt.position.y = hipY + 0.06 - skirtLen / 2; skirt.scale.z = 0.8;
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 3, 8), trim); hem.rotation.x = Math.PI / 2; hem.position.y = hipY + 0.06 - skirtLen; hem.scale.y = 0.8;
  body.add(pelvis, waist, chest, yoke, skirt, hem);
  if (look.belt) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.015, 3, 8), cloth(look.belt)); b.rotation.x = Math.PI / 2; b.position.y = hipY + 0.1; b.scale.y = 0.72; body.add(b); }

  // Arme: Schulter -> Ellbogen -> Hand
  const upper = H * 0.19, fore = H * 0.17;
  const arms = [-1, 1].map((sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.19, shoulderY - 0.02, 0); sh.rotation.z = sx * 0.08;
    const up = seg(0.045, 0.038, upper, cm); sh.add(up);
    const elbow = new THREE.Group(); elbow.position.y = -upper; sh.add(elbow);
    const lo = seg(0.038, 0.03, fore, cm); elbow.add(lo);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.035), sm); hand.position.y = -fore - 0.035; elbow.add(hand);
    body.add(sh);
    return { sh, elbow, hand };
  });

  // Kopf: Hals, Schädel, Kiefer, Nase, Augenhöhlen
  const head = new THREE.Group(); head.position.set(0, shoulderY + 0.02, 0);
  const neck = seg(0.035, 0.04, 0.06, sm); neck.position.y = 0.06; head.add(neck);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), sm); skull.position.y = 0.12; skull.scale.set(0.92, 1.08, 1); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.09), sm); jaw.position.set(0, 0.065, 0.02); head.add(jaw);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 3), sm); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.115, 0.075); head.add(nose);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.015, 0.02), sm); brow.position.set(0, 0.14, 0.065); head.add(brow);
  const eyeMat = new THREE.MeshBasicMaterial({ color: look.eyes || 0x0e0c0a });
  for (const ex of [-0.026, 0.026]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.01), eyeMat); e.position.set(ex, 0.128, 0.068); head.add(e); }
  if (look.hood) {
    const hm = cloth(look.hood); hm.side = THREE.DoubleSide;
    const hood = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), hm); hood.position.set(0, 0.13, -0.018); hood.scale.set(1.05, 1.2, 1.15);
    const cut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.02), cloth(0x0b0a09)); cut.position.set(0, 0.11, 0.098);
    head.add(hood);
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.08, 7, 1, true), hm); cowl.position.y = 0.0; head.add(cowl);
    skull.scale.multiplyScalar(0.98);
  } else if (look.hair) {
    const hm = cloth(look.hair);
    const hair = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), hm); hair.position.set(0, 0.145, -0.012); hair.scale.set(0.98, 0.8, 1.02); head.add(hair);
    if (look.long) { const back = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.035), hm); back.position.set(0, 0.07, -0.06); head.add(back); }
  }
  if (look.beard) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 5), cloth(look.beard)); b.rotation.x = Math.PI; b.position.set(0, 0.04, 0.05); head.add(b); }
  body.add(head);

  if (opts.weapon) {
    const w = seg(0.012, 0.012, 0.5, M.iron, 4); w.position.set(0, -0.02, 0.03); w.rotation.x = Math.PI / 2 + 0.2; arms[1].hand.add(w);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 3, 6, Math.PI), M.iron); hook.position.set(0, -0.02, 0.53); arms[1].hand.add(hook);
  }
  if (opts.lantern) {
    const lg = prop('wooden_lantern_01', 0.2);
    lg.position.set(0, -0.22, 0.01);
    arms[0].hand.add(lg);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffb060, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(0.6, 0.6, 1); glow.position.y = -0.12; arms[0].hand.add(glow);
    root.userData.glow = glow;
  }
  root.add(shadow(0.8));
  root.userData.parts = { legs, arms, head, body };
  return root;
}

function makePale() {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb4c0c6, emissive: 0x4a5a62, roughness: 1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 1.35, 9, 3, true), mat); robe.position.y = 0.85;
  const p = robe.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.6) p.setY(i, p.getY(i) + (hash(i, 1, 3) - 0.5) * 0.3);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 7), mat); head.position.y = 1.65; head.scale.set(0.85, 1.15, 0.9);
  const eye = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const ex of [-0.055, 0.055]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), eye); e.position.set(ex, 1.68, 0.12); root.add(e); }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), eye); mouth.scale.set(1, 1.8, 0.5); mouth.position.set(0, 1.57, 0.13); root.add(mouth);
  const aL = seg(0.04, 0.025, 0.75, mat), aR = seg(0.04, 0.025, 0.75, mat);
  aL.position.set(-0.24, 1.4, 0.05); aR.position.set(0.24, 1.4, 0.05);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0x9ab0c0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(2.2, 2.8, 1); glow.position.y = 1.1;
  root.add(robe, head, aL, aR, glow);
  root.userData.parts = { aL, aR };
  root.userData.mat = mat;
  return root;
}

function makeRat() {
  const root = new THREE.Group();
  const r = prop('street_rat', 0.5, 'xz');
  root.add(r, shadow(0.6));
  return root;
}

function makeLamp(l) {
  const g = prop('street_lamp_01', 2.9);
  g.position.set(U(l.px), 0, U(l.py) - 0.25);
  scene.add(g);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd07a }));
  core.position.set(U(l.px), 2.5, U(l.py) - 0.25);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffb060, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(2.2, 2.2, 1);
  halo.position.copy(core.position);
  scene.add(core, halo);
  lampFx.set(l.id, { core, halo });
}

// ------------------------------------------------------------ Nachbearbeitung: roher, verwaschener Look
// Kanten aus dem Tiefenpuffer, entsättigt, flache Kontraste, leichter Weichzeichner, Filmkorn

const POST_FS = `
precision highp float;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform vec2 texel; uniform float time; uniform float near; uniform float far;
varying vec2 vUv;
float lin(float d) { float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
float D(vec2 o) { return lin(texture2D(tDepth, vUv + o * texel).r); }
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  // leicht verwaschen: weiches Kreuz-Sampling untermischen
  vec3 b = (texture2D(tColor, vUv + vec2(1.5, 0.0) * texel).rgb + texture2D(tColor, vUv - vec2(1.5, 0.0) * texel).rgb
          + texture2D(tColor, vUv + vec2(0.0, 1.5) * texel).rgb + texture2D(tColor, vUv - vec2(0.0, 1.5) * texel).rgb) * 0.25;
  c = mix(c, b, 0.38);
  // Kanten: Sprünge in der Tiefe werden zu dunklen, rauen Linien
  float d0 = D(vec2(0.0));
  float e = abs(D(vec2(1.0, 0.0)) - d0) + abs(D(vec2(-1.0, 0.0)) - d0) + abs(D(vec2(0.0, 1.0)) - d0) + abs(D(vec2(0.0, -1.0)) - d0);
  float edge = smoothstep(0.06, 0.35, e / max(d0, 0.5) * 6.0) * (1.0 - smoothstep(14.0, 30.0, d0));
  c *= 1.0 - edge * 0.55;
  // Farbe: entsättigt, in Richtung Moder und Lehm
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 0.55);
  c *= vec3(1.0, 0.97, 0.86);
  // flache Kontraste: Schwarz anheben, Lichter dämpfen
  c = c * 0.82 + vec3(0.06, 0.062, 0.052);
  c = c / (1.0 + c * 0.25);
  // Filmkorn und Vignette
  float g = fract(sin(dot(vUv * 913.0 + time * 7.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (g - 0.5) * 0.035;
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.9;
  gl_FragColor = vec4(c, 1.0);
}`;

function setupPost(w, h) {
  if (post) { post.rt.dispose(); }
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
  rt.depthTexture = new THREE.DepthTexture(w, h);
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const material = post ? post.material : new THREE.ShaderMaterial({
    uniforms: { tColor: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() }, time: { value: 0 }, near: { value: 0.1 }, far: { value: 90 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: POST_FS,
    depthTest: false, depthWrite: false,
  });
  material.uniforms.tColor.value = rt.texture;
  material.uniforms.tDepth.value = rt.depthTexture;
  material.uniforms.texel.value.set(1 / w, 1 / h);
  const quad = post ? post.quad : new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const cam = post ? post.cam : new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const sc = post ? post.scene : new THREE.Scene();
  if (!post) sc.add(quad);
  post = { rt, material, quad, cam, scene: sc };
}

// ------------------------------------------------------------ Laufzeit

export function openGate() { if (gate) gate.visible = false; }

export function resize(w, h, quality) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * quality);
  renderer.setSize(w, h, false);
  const pr = renderer.getPixelRatio();
  setupPost(Math.max(1, Math.round(w * pr)), Math.max(1, Math.round(h * pr)));
  camera.aspect = w / h;
  camera.fov = w < h ? 76 : 58;
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

// Gehen: Hüfte schwingt, Knie beugt sich in der Schwungphase, Arme pendeln gegengleich mit leicht gebeugtem Ellbogen
function animateHuman(a, moving, phase, atk, t) {
  const { legs, arms, body } = a.userData.parts;
  const sw = moving ? Math.sin(phase) : 0;
  legs[0].hip.rotation.x = sw * 0.55; legs[1].hip.rotation.x = -sw * 0.55;
  legs[0].knee.rotation.x = moving ? Math.max(0, -Math.cos(phase)) * 0.9 : 0.02;
  legs[1].knee.rotation.x = moving ? Math.max(0, Math.cos(phase)) * 0.9 : 0.02;
  const lantern = !!a.userData.glow;
  arms[0].sh.rotation.x = lantern ? -0.35 - sw * 0.15 : -sw * 0.45;
  arms[0].elbow.rotation.x = lantern ? -0.9 : -0.25 - Math.max(0, sw) * 0.3;
  if (atk > 0) {
    const k = 1 - atk / 0.15;
    arms[1].sh.rotation.x = -2.4 + k * 2.6; arms[1].elbow.rotation.x = -0.6 + k * 0.5;
  } else { arms[1].sh.rotation.x = sw * 0.45; arms[1].elbow.rotation.x = -0.25 - Math.max(0, -sw) * 0.3; }
  body.position.y = moving ? -Math.abs(Math.sin(phase)) * 0.025 + 0.012 : Math.sin(t * 1.5) * 0.004;
  body.rotation.y = sw * 0.08;
  body.rotation.x = moving ? 0.06 : 0;
}

function isIndoor(px, py) { return tileAt(map, Math.floor(U(px)), Math.floor(U(py))) === T.FLOOR; }

function placeCamera(px, py, dt) {
  const x = U(px), z = U(py);
  const indoor = isIndoor(px, py);
  const pitch = indoor ? 1.22 : view.pitch;
  let dist = indoor ? 3.1 : view.dist;
  const dirx = Math.sin(view.yaw), dirz = Math.cos(view.yaw);
  if (!indoor) {
    for (let d = 0.4; d < dist; d += 0.2) {
      const t = tileAt(map, Math.floor(x + dirx * d * Math.cos(pitch)), Math.floor(z + dirz * d * Math.cos(pitch)));
      if (TALL.has(t) && 1.4 + d * Math.sin(pitch) < WALL_H + 2.5) { dist = Math.max(1.2, d - 0.3); break; }
    }
  }
  const tx = x + dirx * dist * Math.cos(pitch), ty = 1.15 + dist * Math.sin(pitch), tz = z + dirz * dist * Math.cos(pitch);
  const k = Math.min(1, dt * 8);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(x, 1.0, z);
  return indoor;
}

export function snapCamera(px, py) {
  camera.position.set(U(px) + Math.sin(view.yaw) * 4, 3, U(py) + Math.cos(view.yaw) * 4);
}

// w = { player, S, npcs, enemies, lamps, lights, sparks, time, dt, hurtFlash }
export function render(w) {
  const { player, S, time, dt } = w;
  const indoor = placeCamera(player.x, player.y, dt);
  const tx = U(player.x), ty = U(player.y);
  for (const { group, r } of roofs) group.visible = !(tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
  if (crateProp) crateProp.visible = !S.flags.crate_taken;
  if (sabreProp) sabreProp.visible = !S.flags.sabre_taken;

  for (const a of actors.values()) a.userData.seen = false;

  const pa = actorFor(player, 'player');
  pa.position.set(tx, 0, ty);
  pa.rotation.y = Math.atan2(player.fx, player.fy);
  animateHuman(pa, player.moving, player.phase, player.atkT, time);
  pa.userData.glow.visible = S.player.oil > 0;

  for (const n of w.npcs) {
    const a = actorFor(n, 'npc');
    a.visible = !n.hidden;
    if (n.hidden) continue;
    a.position.set(U(n.px), 0, U(n.py) - 0.2);
    const ang = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[n.dir] ?? 0;
    a.rotation.y += angleTo(a.rotation.y, ang) * Math.min(1, dt * 5);
    animateHuman(a, false, 0, 0, time + n.x);
    a.userData.parts.head.rotation.y = Math.sin(time * 0.5 + n.x) * 0.25;
    if (n.fading !== undefined) a.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = n.fading; } });
  }

  for (const e of w.enemies) {
    const a = actorFor(e, e.type);
    a.position.set(U(e.x), 0, U(e.y));
    a.rotation.y = Math.atan2(player.x - e.x, player.y - e.y);
    a.visible = !(e.hurtT > 0 && Math.floor(time * 30) % 2);
    if (e.type === 'pale') {
      a.position.y = 0.12 + Math.sin(time * 2 + e.homeX) * 0.08;
      a.userData.mat.opacity = 0.6 * (e.spawnA ?? 1) * (0.85 + Math.sin(time * 7 + e.homeY) * 0.12);
      const p = a.userData.parts;
      p.aL.rotation.x = -1.2 + Math.sin(time * 3) * 0.25; p.aR.rotation.x = -1.2 - Math.sin(time * 3) * 0.25;
    } else a.position.y = Math.abs(Math.sin(time * 18)) * 0.03;
  }
  for (const [obj, a] of actors) if (!a.userData.seen) { scene.remove(a); actors.delete(obj); }

  for (const l of w.lamps) {
    if (!lampFx.has(l.id)) makeLamp(l);
    const fx = lampFx.get(l.id);
    const flick = l.sick ? (Math.sin(time * 23 + l.x) > 0.2 ? 1 : 0.35) : 1 + Math.sin(time * 9 + l.x) * 0.05;
    fx.core.visible = fx.halo.visible = l.lit;
    fx.halo.material.opacity = 0.7 * flick;
    fx.halo.material.color.setHex(l.sick ? 0xc8c0a0 : 0xffb060);
  }

  // Licht: Laterne des Spielers + die nächsten Quellen
  const oil = S.player.oil;
  const fl = 1 + Math.sin(time * 9) * 0.05 + Math.sin(time * 23) * 0.03;
  lantern.position.set(tx + player.fx * 0.35, 1.0, ty + player.fy * 0.35);
  lantern.intensity = (oil > 0 ? 18 + Math.min(5, oil / 20) : 1.5) * fl;
  lantern.distance = oil > 0 ? 11 : 3;
  const srcs = w.lights.map((l) => ({ ...l, d: Math.hypot(U(l.x) - tx, U(l.y) - ty) })).sort((a, b) => a.d - b.d);
  pool.forEach((pl, i) => {
    const s = srcs[i];
    if (!s || s.d > 28) { pl.intensity = 0; return; }
    pl.position.set(U(s.x), s.h, U(s.y));
    pl.color.setRGB(s.c[0] / 255, s.c[1] / 255, s.c[2] / 255);
    pl.intensity = s.i * 2.2;
    pl.distance = s.r * 1.3;
  });

  const ek = S.flags.ending_kind;
  towerFire.visible = towerGlow.visible = !!ek;
  if (ek) {
    towerFire.scale.set(1, 0.8 + Math.sin(time * 9) * 0.15, 1);
    const c = ek === 'pure' ? 0xffc070 : 0xc8d0b0;
    towerFire.material.color.setHex(c); towerGlow.material.color.setHex(c);
    towerGlow.material.opacity = ek === 'pure' ? 0.8 : 0.35 + Math.sin(time * 11) * 0.1;
  }

  scene.fog.density = indoor ? 0.04 : 0.07;
  const rx = Math.round(tx), rz = Math.round(ty);
  mistA.position.set(rx, 0.3, rz); mistB.position.set(rx, 1.2, rz);
  mistA.material.map.offset.set(time * 0.006 + rx / 8.8, time * 0.002 + rz / 8.8);
  mistB.material.map.offset.set(-time * 0.004 + rx / 8.8, rz / 8.8);
  mistA.visible = mistB.visible = !indoor;
  waterTex.offset.set(time * 0.01, time * 0.004);
  for (let i = 0; i < rainPos.length / 6; i++) {
    const o = i * 6;
    rainPos[o + 1] -= dt * 14; rainPos[o + 4] -= dt * 14;
    if (rainPos[o + 1] < 0 || Math.abs(rainPos[o] - tx) > 14 || Math.abs(rainPos[o + 2] - ty) > 14) resetDrop(i, 6 + Math.random() * 4, tx, ty);
  }
  rain.geometry.attributes.position.needsUpdate = true;
  rain.visible = !indoor;

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

  post.material.uniforms.time.value = time;
  renderer.setRenderTarget(post.rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(post.scene, post.cam);
}

const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

const tmp = new THREE.Vector3();
export function project(px, py, h, w, hgt) {
  tmp.set(U(px), h, U(py)).project(camera);
  return { x: (tmp.x + 1) / 2 * w, y: (1 - tmp.y) / 2 * hgt, visible: tmp.z < 1 };
}
