// Welt von Kaltenbruch: Kachelkarte, prozedurale Pixeltexturen, Objekte.

export const TILE = 16;
export const MAP_W = 56;
export const MAP_H = 72;

export const T = {
  MUD: 0, COBBLE: 1, WATER: 2, PIER: 3, WALL: 4, ROOF: 5, FLOOR: 6, GRAVE: 7,
  FENCE: 8, GATE: 9, TREE: 11, BARREL: 12, CRATE: 13, TOWER: 14, TDOOR: 15,
  GRASS: 16, SHORE: 17,
};

const SOLID = new Set([T.WATER, T.WALL, T.ROOF, T.GRAVE, T.FENCE, T.GATE, T.TREE, T.BARREL, T.CRATE, T.TOWER, T.TDOOR]);

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- Karte

// Gebäude-Rechtecke für die 3D-Darstellung (werden von buildMap gefüllt)
export const HOUSES = [];
export const BLOCKS = [];

export function buildMap() {
  HOUSES.length = 0; BLOCKS.length = 0;
  const m = new Uint8Array(MAP_W * MAP_H);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) m[y * MAP_W + x] = t; };
  const rect = (x, y, w, h, t) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, t); };

  // Begehbares Haus: Mauern, Dielenboden, Türlücken
  const house = (x, y, w, h, doors) => {
    HOUSES.push({ x, y, w, h });
    rect(x, y, w, h, T.WALL);
    rect(x + 1, y + 1, w - 2, h - 2, T.FLOOR);
    for (const [dx, dy] of doors) set(x + dx, y + dy, T.FLOOR);
  };
  // Geschlossenes Haus: Dach mit Fassade
  const block = (x, y, w, h) => { BLOCKS.push({ x, y, w, h }); rect(x, y, w, h - 1, T.ROOF); rect(x, y + h - 1, w, 1, T.WALL); };

  rect(0, 0, MAP_W, MAP_H, T.MUD);
  const r = rng(9);
  for (let i = 0; i < 260; i++) set((r() * MAP_W) | 0, (r() * MAP_H) | 0, T.GRASS);

  // Schwarzsee im Westen und Süden, Ufer
  rect(0, 0, 8, MAP_H, T.WATER);
  rect(8, 64, MAP_W - 8, 4, T.SHORE);
  rect(0, 68, MAP_W, 4, T.WATER);
  for (let x = 8; x < MAP_W; x++) if (hash(x, 0, 3) < 0.5) set(x, 67, T.WATER);

  // Straßen
  rect(8, 30, 48, 3, T.COBBLE);
  rect(26, 4, 3, 48, T.COBBLE);
  rect(18, 22, 20, 13, T.COBBLE);
  rect(26, 4, 22, 3, T.COBBLE);

  // Hafen
  rect(8, 16, 8, 19, T.PIER);
  rect(2, 20, 6, 2, T.PIER);
  rect(1, 28, 7, 2, T.PIER);
  rect(8, 30, 8, 3, T.PIER);
  for (const [x, y] of [[9, 17], [10, 17], [14, 18], [9, 33], [14, 33], [15, 25]]) set(x, y, T.BARREL);
  for (const [x, y] of [[13, 17], [15, 22], [9, 26]]) set(x, y, T.CRATE);

  // Turm auf dem Felsen
  rect(42, 2, 12, 2, T.GRASS);
  rect(44, 7, 8, 7, T.TOWER);
  set(47, 7, T.TDOOR);

  // Häuser mit Innenraum
  house(30, 12, 10, 9, [[4, 8], [5, 8]]);        // Gasthaus „Zum Nassen Hund"
  rect(33, 21, 4, 1, T.COBBLE);
  house(14, 11, 9, 8, [[4, 7]]);                 // Kontor der Trangilde
  rect(17, 19, 3, 3, T.COBBLE);
  house(11, 38, 12, 10, [[11, 4], [11, 5]]);     // Lagerhaus der Gilde
  rect(23, 42, 3, 2, T.COBBLE);
  for (const [x, y] of [[12, 39], [12, 46], [21, 46], [16, 39], [17, 39]]) set(x, y, T.BARREL);
  for (const [x, y] of [[12, 44], [15, 46], [19, 42]]) set(x, y, T.CRATE);
  house(42, 21, 9, 8, [[4, 7]]);                 // Wachstube
  rect(45, 29, 3, 1, T.COBBLE);
  house(29, 40, 7, 6, [[0, 2]]);                 // Werkstatt des Lampenträgers

  // Geschlossene Häuser
  block(17, 4, 6, 5);
  block(40, 15, 4, 4);
  block(40, 34, 6, 5);
  block(47, 34, 6, 6);
  block(37, 41, 5, 5);
  block(44, 41, 6, 5);
  block(9, 52, 5, 5);
  block(31, 47, 4, 4);                           // Finks Hütte

  // Friedhof
  rect(16, 52, 27, 1, T.FENCE);
  rect(16, 63, 27, 1, T.FENCE);
  rect(16, 52, 1, 12, T.FENCE);
  rect(42, 52, 1, 12, T.FENCE);
  rect(26, 52, 3, 1, T.GATE);
  rect(27, 63, 2, 1, T.MUD);
  for (let y = 54; y < 62; y += 2) for (let x = 18; x < 41; x += 3) {
    if (x >= 25 && x <= 29) continue;
    if (hash(x, y, 7) < 0.8) set(x, y, T.GRAVE);
  }

  // Tote Bäume
  for (let i = 0; i < 400; i++) {
    const x = (r() * MAP_W) | 0, y = (r() * MAP_H) | 0;
    const t = m[y * MAP_W + x];
    if ((t === T.MUD || t === T.GRASS) && r() < 0.25 && !nearCobble(m, x, y)) set(x, y, T.TREE);
  }
  // Wege freihalten
  rect(25, 46, 1, 6, T.MUD);
  return m;
}

function nearCobble(m, x, y) {
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const xx = x + i, yy = y + j;
    if (xx < 0 || yy < 0 || xx >= MAP_W || yy >= MAP_H) continue;
    const t = m[yy * MAP_W + xx];
    if (t !== T.MUD && t !== T.GRASS && t !== T.TREE) return true;
  }
  return false;
}

export function tileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return T.WATER;
  return map[y * MAP_W + x];
}

export function solidAt(map, px, py) {
  return SOLID.has(tileAt(map, Math.floor(px / TILE), Math.floor(py / TILE)));
}

// ---------------------------------------------------------------- Texturen

const C = {
  mud: ['#29231b', '#2e271e', '#241e17', '#322a20'],
  grass: ['#323421', '#2a2e1c', '#3b3a24'],
  cob: ['#47474a', '#525255', '#3f4043', '#4c4a47'],
  water: '#0b1216',
};

function px(ctx, x, y, c, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
const pick = (arr, v) => arr[Math.floor(v * arr.length) % arr.length];

function drawMud(ctx, ox, oy, s) {
  px(ctx, ox, oy, C.mud[0], TILE, TILE);
  for (let i = 0; i < 40; i++) {
    const v = hash(i, s, 1);
    px(ctx, ox + ((hash(i, s, 2) * TILE) | 0), oy + ((hash(i, s, 3) * TILE) | 0), pick(C.mud, v));
  }
  if (hash(s, 1, 4) < 0.12) px(ctx, ox + 4, oy + 9, '#1a2026', 6, 2);
}

function drawGrass(ctx, ox, oy, s) {
  drawMud(ctx, ox, oy, s);
  for (let i = 0; i < 14; i++) {
    const x = ox + ((hash(i, s, 5) * 15) | 0), y = oy + 3 + ((hash(i, s, 6) * 12) | 0);
    px(ctx, x, y, pick(C.grass, hash(i, s, 7)), 1, 2 + ((hash(i, s, 8) * 2) | 0));
  }
}

function drawCobble(ctx, ox, oy, s) {
  px(ctx, ox, oy, '#232325', TILE, TILE);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 2 : 0;
    for (let col = -1; col < 4; col++) {
      const x = ox + col * 5 + off, y = oy + row * 4;
      const w = 4, h = 3;
      const c = pick(C.cob, hash(col + 9, row + s * 7, 9));
      const x0 = Math.max(x, ox), x1 = Math.min(x + w, ox + TILE);
      if (x1 > x0) {
        px(ctx, x0, y, c, x1 - x0, h);
        if (hash(col, row, s) < 0.3) px(ctx, x0, y, '#5e5e60', 1, 1);
      }
    }
  }
}

function drawPier(ctx, ox, oy, s) {
  for (let row = 0; row < 4; row++) {
    const c = row % 2 ? '#43341f' : '#4b3a24';
    px(ctx, ox, oy + row * 4, c, TILE, 3);
    px(ctx, ox, oy + row * 4 + 3, '#1c140c', TILE, 1);
    if (hash(row, s, 2) < 0.6) px(ctx, ox + ((hash(row, s, 3) * 14) | 0), oy + row * 4 + 1, '#2a1f13', 2, 1);
  }
  px(ctx, ox + 1, oy + 1, '#6b5c45');
  px(ctx, ox + 14, oy + 9, '#6b5c45');
}

function drawWall(ctx, ox, oy, s) {
  px(ctx, ox, oy, '#25221e', TILE, TILE);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 4 : 0;
    for (let col = -1; col < 3; col++) {
      const x = ox + col * 8 + off;
      const x0 = Math.max(x, ox), x1 = Math.min(x + 7, ox + TILE);
      if (x1 > x0) px(ctx, x0, oy + row * 4, hash(col, row, s) < 0.5 ? '#4a443c' : '#423d36', x1 - x0, 3);
    }
  }
  px(ctx, ox, oy + 13, '#1a1815', TILE, 3);
}

function drawRoof(ctx, ox, oy, s) {
  for (let row = 0; row < 5; row++) {
    const off = row % 2 ? 3 : 0;
    px(ctx, ox, oy + row * 3, '#2c1915', TILE, 3);
    for (let col = -1; col < 4; col++) {
      const x = ox + col * 5 + off;
      const x0 = Math.max(x, ox), x1 = Math.min(x + 4, ox + TILE);
      if (x1 > x0) px(ctx, x0, oy + row * 3, hash(col, row + s, 4) < 0.5 ? '#4a2b22' : '#3d241d', x1 - x0, 2);
    }
  }
  if (hash(s, 2, 9) < 0.15) px(ctx, ox + 6, oy + 4, '#5a5048', 3, 4); // Schornstein
}

function drawFloor(ctx, ox, oy, s) {
  for (let col = 0; col < 4; col++) {
    px(ctx, ox + col * 4, oy, col % 2 ? '#35281b' : '#3d2e1f', 3, TILE);
    px(ctx, ox + col * 4 + 3, oy, '#1a120b', 1, TILE);
    if (hash(col, s, 1) < 0.5) px(ctx, ox + col * 4 + 1, oy + ((hash(col, s, 2) * 14) | 0), '#2a1f14', 1, 2);
  }
}

function drawGrave(ctx, ox, oy, s) {
  drawMud(ctx, ox, oy, s);
  px(ctx, ox + 3, oy + 12, '#1a1712', 10, 3);
  if (hash(s, 3, 3) < 0.5) {
    px(ctx, ox + 7, oy + 2, '#6a6862', 2, 11);
    px(ctx, ox + 4, oy + 5, '#6a6862', 8, 2);
    px(ctx, ox + 9, oy + 2, '#4b4a46', 1, 11);
  } else {
    px(ctx, ox + 4, oy + 4, '#5f5d58', 8, 9);
    px(ctx, ox + 5, oy + 3, '#5f5d58', 6, 1);
    px(ctx, ox + 11, oy + 4, '#46443f', 1, 9);
    px(ctx, ox + 6, oy + 6, '#3a3935', 4, 1);
    px(ctx, ox + 6, oy + 8, '#3a3935', 3, 1);
  }
}

function drawFence(ctx, ox, oy, s, gate) {
  drawMud(ctx, ox, oy, s);
  px(ctx, ox, oy + 5, '#1b1b1d', TILE, 1);
  px(ctx, ox, oy + 11, '#1b1b1d', TILE, 1);
  const step = gate ? 2 : 4;
  for (let x = 1; x < TILE; x += step) {
    px(ctx, ox + x, oy + 2, '#2b2b2f', 1, 12);
    px(ctx, ox + x, oy + 1, '#4a4a50', 1, 1);
  }
  if (gate) px(ctx, ox + 7, oy + 7, '#6a5a32', 2, 3);
}

function drawTreeBase(ctx, ox, oy, s) {
  drawGrass(ctx, ox, oy, s);
  px(ctx, ox + 4, oy + 13, '#141110', 9, 2);
  px(ctx, ox + 6, oy + 4, '#221a14', 4, 11);
  px(ctx, ox + 6, oy + 4, '#2e241b', 1, 11);
}

function drawTreeCrown(ctx, ox, oy, s) {
  const r = rng(s * 13 + 7);
  ctx.strokeStyle = '#1d1712';
  ctx.lineWidth = 1;
  const branch = (x, y, a, len, d) => {
    if (d > 4 || len < 2) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    branch(x2, y2, a - 0.5 - r() * 0.4, len * 0.7, d + 1);
    branch(x2, y2, a + 0.4 + r() * 0.4, len * 0.65, d + 1);
  };
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ox + 8, oy + 6); ctx.lineTo(ox + 8, oy - 6); ctx.stroke();
  ctx.lineWidth = 1;
  branch(ox + 8, oy - 4, -Math.PI / 2 - 0.3, 8, 0);
  branch(ox + 8, oy - 2, -Math.PI / 2 + 0.5, 7, 1);
}

function drawBarrel(ctx, ox, oy, s, base) {
  base(ctx, ox, oy, s);
  px(ctx, ox + 2, oy + 13, '#120d08', 12, 2);
  px(ctx, ox + 3, oy + 3, '#4d3520', 10, 11);
  px(ctx, ox + 3, oy + 3, '#5c4128', 10, 3);
  px(ctx, ox + 3, oy + 7, '#2a2a2a', 10, 1);
  px(ctx, ox + 3, oy + 11, '#2a2a2a', 10, 1);
  px(ctx, ox + 5, oy + 4, '#3a2716', 6, 1);
}

function drawCrate(ctx, ox, oy, s, base) {
  base(ctx, ox, oy, s);
  px(ctx, ox + 1, oy + 13, '#120d08', 14, 2);
  px(ctx, ox + 2, oy + 3, '#5a4630', 12, 11);
  px(ctx, ox + 2, oy + 3, '#2d2116', 12, 1);
  px(ctx, ox + 2, oy + 8, '#2d2116', 12, 1);
  px(ctx, ox + 2, oy + 13, '#2d2116', 12, 1);
  px(ctx, ox + 2, oy + 3, '#2d2116', 1, 11);
  px(ctx, ox + 13, oy + 3, '#2d2116', 1, 11);
}

function drawTower(ctx, ox, oy, s) {
  px(ctx, ox, oy, '#2b2925', TILE, TILE);
  for (let row = 0; row < 3; row++) for (let col = -1; col < 2; col++) {
    const off = row % 2 ? 5 : 0;
    const x = ox + col * 10 + off, x0 = Math.max(x, ox), x1 = Math.min(x + 9, ox + TILE);
    if (x1 > x0) px(ctx, x0, oy + row * 5, hash(col, row, s) < 0.5 ? '#5a554c' : '#4f4a42', x1 - x0, 4);
  }
}

function drawTowerDoor(ctx, ox, oy, s) {
  drawTower(ctx, ox, oy, s);
  px(ctx, ox + 3, oy + 3, '#120d09', 10, 13);
  px(ctx, ox + 4, oy + 2, '#120d09', 8, 1);
  px(ctx, ox + 4, oy + 4, '#3a2817', 8, 12);
  px(ctx, ox + 8, oy + 4, '#1f150c', 1, 12);
  px(ctx, ox + 10, oy + 10, '#8a7a4a', 1, 1);
}

function drawShore(ctx, ox, oy, s) {
  px(ctx, ox, oy, '#2d2a25', TILE, TILE);
  for (let i = 0; i < 26; i++) {
    const c = hash(i, s, 3) < 0.5 ? '#3e3a33' : '#24221e';
    px(ctx, ox + ((hash(i, s, 1) * 15) | 0), oy + ((hash(i, s, 2) * 15) | 0), c, 2, 1);
  }
}

function drawWater(ctx, ox, oy, s) {
  px(ctx, ox, oy, C.water, TILE, TILE);
  for (let i = 0; i < 6; i++) {
    px(ctx, ox + ((hash(i, s, 1) * 13) | 0), oy + ((hash(i, s, 2) * 15) | 0), '#0f1a20', 3, 1);
  }
}

export function renderStatic(map) {
  const ground = document.createElement('canvas');
  ground.width = MAP_W * TILE; ground.height = MAP_H * TILE;
  const over = document.createElement('canvas');
  over.width = ground.width; over.height = ground.height;
  const g = ground.getContext('2d'), o = over.getContext('2d');
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) paintTile(g, o, map, x, y);
  return { ground, over };
}

// Einzelne Kacheltextur (für Wände, Dächer und Kisten in 3D)
export function tileCanvas(t, s = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const g = c.getContext('2d');
  const fn = { [T.WALL]: drawWall, [T.ROOF]: drawRoof, [T.TOWER]: drawTower, [T.FLOOR]: drawFloor, [T.PIER]: drawPier, [T.MUD]: drawMud }[t] || drawMud;
  fn(g, 0, 0, s);
  return c;
}

export function paintTile(g, o, map, x, y) {
  const t = map[y * MAP_W + x];
  const ox = x * TILE, oy = y * TILE, s = x * 131 + y * 17;
  switch (t) {
    case T.MUD: drawMud(g, ox, oy, s); break;
    case T.GRASS: drawGrass(g, ox, oy, s); break;
    case T.COBBLE: drawCobble(g, ox, oy, s); break;
    case T.WATER: drawWater(g, ox, oy, s); break;
    case T.PIER: drawPier(g, ox, oy, s); break;
    case T.WALL: drawWall(g, ox, oy, s); break;
    case T.ROOF: drawRoof(g, ox, oy, s); break;
    case T.FLOOR: drawFloor(g, ox, oy, s); break;
    case T.GRAVE: drawGrave(g, ox, oy, s); break;
    case T.FENCE: drawFence(g, ox, oy, s, false); break;
    case T.GATE: drawFence(g, ox, oy, s, true); break;
    case T.TREE: drawTreeBase(g, ox, oy, s); drawTreeCrown(o, ox, oy, s); break;
    case T.BARREL: drawBarrel(g, ox, oy, s, tileBase(map, x, y)); break;
    case T.CRATE: drawCrate(g, ox, oy, s, tileBase(map, x, y)); break;
    case T.TOWER: drawTower(g, ox, oy, s); break;
    case T.TDOOR: drawTowerDoor(g, ox, oy, s); break;
    case T.SHORE: drawShore(g, ox, oy, s); break;
  }
  // Wasserkante: dunkler Saum am Ufer
  if (t !== T.WATER && t !== T.PIER && tileAt(map, x, y + 1) === T.WATER) {
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(ox, oy + TILE - 2, TILE, 2);
  }
  // Schatten unter Dächern
  if (t !== T.ROOF && t !== T.WALL && tileAt(map, x, y - 1) === T.WALL) {
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(ox, oy, TILE, 3);
  }
}

function tileBase(map, x, y) {
  const n = [tileAt(map, x - 1, y), tileAt(map, x + 1, y), tileAt(map, x, y - 1), tileAt(map, x, y + 1)];
  if (n.includes(T.FLOOR)) return drawFloor;
  if (n.includes(T.PIER)) return drawPier;
  return drawMud;
}

// Nebeltextur, kachelbar
export function makeFog(size = 128, seed = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rng(seed);
  for (let i = 0; i < 90; i++) {
    const x = r() * size, y = r() * size, rad = 10 + r() * 34, a = 0.05 + r() * 0.08;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      const gr = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, `rgba(170,180,185,${a})`);
      gr.addColorStop(1, 'rgba(170,180,185,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  return c;
}

// ---------------------------------------------------------------- Figuren

export function drawHuman(ctx, x, y, look, dir, phase, alpha = 1) {
  x = Math.round(x); y = Math.round(y);
  ctx.globalAlpha = alpha;
  px(ctx, x - 4, y - 1, 'rgba(0,0,0,.45)', 9, 2);
  const step = Math.sin(phase) > 0 ? 1 : 0;
  // Beine
  px(ctx, x - 2, y - 4, '#1b1712', 2, 3 + step);
  px(ctx, x + 1, y - 4, '#1b1712', 2, 4 - step);
  // Umhang
  px(ctx, x - 4, y - 11, look.cloak, 9, 8);
  px(ctx, x - 3, y - 12, look.cloak, 7, 1);
  px(ctx, x - 4, y - 4, look.trim || shade(look.cloak), 9, 1);
  if (look.belt) px(ctx, x - 4, y - 7, look.belt, 9, 1);
  // Arme
  const sx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  px(ctx, x - 5 + (sx > 0 ? 1 : 0), y - 10, shade(look.cloak), 1, 5);
  px(ctx, x + 5 - (sx < 0 ? 1 : 0), y - 10, shade(look.cloak), 1, 5);
  // Kopf
  const hx = x - 2 + sx;
  px(ctx, hx, y - 16, look.skin, 5, 4);
  if (look.hood) {
    px(ctx, hx - 1, y - 17, look.hood, 7, 2);
    px(ctx, hx - 1, y - 15, look.hood, 1, 3);
    px(ctx, hx + 5, y - 15, look.hood, 1, 3);
  } else if (look.hair) {
    px(ctx, hx, y - 17, look.hair, 5, 2);
    if (look.long) { px(ctx, hx - 1, y - 16, look.hair, 1, 5); px(ctx, hx + 5, y - 16, look.hair, 1, 5); }
  }
  if (dir === 'up') {
    px(ctx, hx, y - 16, look.hood || look.hair || look.skin, 5, 3);
  } else {
    const ex = dir === 'left' ? hx : dir === 'right' ? hx + 2 : hx + 1;
    px(ctx, ex, y - 15, look.eyes || '#120f0c', 1, 1);
    if (dir === 'down') px(ctx, ex + 2, y - 15, look.eyes || '#120f0c', 1, 1);
    if (look.beard) px(ctx, hx, y - 13, look.beard, 5, 2);
  }
  ctx.globalAlpha = 1;
}

export function drawLantern(ctx, x, y, dir, lit, t) {
  const lx = Math.round(x + (dir === 'left' ? -6 : 5));
  const ly = Math.round(y - 7);
  px(ctx, lx, ly - 1, '#2a2620', 3, 1);
  px(ctx, lx, ly, lit ? '#f2c169' : '#3a332a', 3, 3);
  if (lit && Math.sin(t * 13) > 0.6) px(ctx, lx + 1, ly + 1, '#fff2c4', 1, 1);
}

export function drawPale(ctx, x, y, t, alpha) {
  x = Math.round(x); y = Math.round(y);
  const wob = Math.sin(t * 3 + x) * 1.5;
  ctx.globalAlpha = alpha * (0.65 + Math.sin(t * 7 + y) * 0.1);
  px(ctx, x - 4, y - 1, 'rgba(0,0,0,.3)', 9, 2);
  px(ctx, x - 3 + wob, y - 17, '#c9d2d6', 6, 5);
  px(ctx, x - 4, y - 12, '#b4bec3', 8, 8);
  for (let i = 0; i < 4; i++) px(ctx, x - 4 + i * 2, y - 4, '#9aa5aa', 1, 2 + ((t * 6 + i) | 0) % 3);
  px(ctx, x - 6 + wob, y - 11, '#a7b2b7', 2, 6);
  px(ctx, x + 4 + wob, y - 11, '#a7b2b7', 2, 6);
  px(ctx, x - 2 + wob, y - 15, '#050506', 1, 2);
  px(ctx, x + 1 + wob, y - 15, '#050506', 1, 2);
  px(ctx, x - 1 + wob, y - 13, '#2b3033', 2, 1);
  ctx.globalAlpha = 1;
}

export function drawRat(ctx, x, y, t, dir) {
  x = Math.round(x); y = Math.round(y);
  const f = dir === 'left' ? -1 : 1;
  px(ctx, x - 4, y - 1, 'rgba(0,0,0,.4)', 9, 1);
  px(ctx, x - 3, y - 4, '#4a3b2e', 7, 3);
  px(ctx, x + f * 3, y - 4, '#4a3b2e', 2, 2);
  px(ctx, x + f * 4, y - 4, '#c06060', 1, 1);
  px(ctx, x - f * 4 - (f < 0 ? 0 : 2), y - 2 + ((t * 8) | 0) % 2, '#6a4b40', 3, 1);
}

export function drawLampPost(ctx, x, y, lit, t, sick) {
  x = Math.round(x); y = Math.round(y);
  px(ctx, x - 3, y - 1, 'rgba(0,0,0,.5)', 7, 2);
  px(ctx, x - 1, y - 22, '#25221e', 2, 22);
  px(ctx, x - 3, y - 2, '#25221e', 6, 2);
  px(ctx, x - 3, y - 27, '#1a1815', 6, 1);
  const flick = sick ? (Math.sin(t * 23) > 0.2 ? 1 : 0.4) : 1;
  const c = lit ? (flick > 0.5 ? '#f3c46e' : '#a06a2c') : '#2b2a28';
  px(ctx, x - 2, y - 26, c, 4, 4);
  px(ctx, x - 3, y - 22, '#1a1815', 6, 1);
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * 0.7, g = ((n >> 8) & 255) * 0.7, b = (n & 255) * 0.7;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
