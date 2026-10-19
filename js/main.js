import { TILE, MAP_W, T, buildMap, renderStatic, paintTile, solidAt, tileAt, makeFog, drawLampPost } from './world.js';
import * as R from './render3d.js';
import { PLAYER_NAME, INTRO, ITEMS, NOTEBOOK, QUESTS, LAMPS, GLOWS, OBJECTS, NPCS, ENEMIES, DIALOGS, endingText } from './story.js';
import { startAudio, sfx, setWhisper, toggleAudio, audioEnabled } from './audio.js';

const SAVE_KEY = 'letzteslicht.save.v1';
const VIEW_W = 176;
const $ = (id) => document.getElementById(id);

const canvas = $('game');
let VIEW_H = 240;

const map = buildMap();
const statics = renderStatic(map);
const fogA = makeFog(128, 3), fogB = makeFog(160, 8);

let S = null;               // gespeicherter Spielzustand
let player, npcs, enemies, lamps;
let running = false, paused = true, dialog = null, pendingEnding = null;
let time = 0, saveTimer = 0, spawnTimer = 0, barkTimer = 0, oilWarned = false;
let hurtFlash = 0, currentRegion = '', focus = null;
const sparks = [];
let quality = 0.5;           // Renderauflösung: grobe Pixel wie 2004 und schnell auf dem Handy
try { quality = parseFloat(localStorage.getItem('letzteslicht.gfx')) || 0.5; } catch (e) { /* egal */ }

// ------------------------------------------------------------ Zustand

function newState() {
  return {
    player: { x: 32 * TILE + 8, y: 43 * TILE + 8, hp: 40, maxHp: 40, str: 5, dex: 5, lvl: 1, xp: 0, lp: 0, coins: 12, oil: 70, weapon: 'haken' },
    inv: { haken: 1, brot: 1 },
    flags: {},
    lamps: {},
    dead: {},
    log: {},
  };
}

function save() {
  if (!S) return;
  S.player.x = player.x; S.player.y = player.y;
  S.lamps = Object.fromEntries(lamps.map((l) => [l.id, { lit: l.lit, sick: l.sick, timer: l.timer }]));
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* Speicher nicht verfügbar */ }
}

function loadSaved() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

function initWorld(state) {
  S = state;
  player = { x: S.player.x, y: S.player.y, dir: 'down', fx: 0, fy: 1, phase: 0, atkCd: 0, atkT: 0, moving: false,
    look: { skin: '#c9a487', cloak: '#46382a', hair: '#3a2a1c', belt: '#2a2016' } };
  npcs = NPCS.map((n) => ({ ...n, px: n.x * TILE + 8, py: n.y * TILE + 12, dir: 'down', hidden: false }));
  const amb = npcs.find((n) => n.id === 'ambros');
  if (S.flags.ambros_saved) { amb.px = 31 * TILE + 8; amb.py = 43 * TILE + 10; amb.look = { ...amb.look, skin: '#c9a487' }; }
  else if (S.flags.ambros_done) amb.hidden = true;
  enemies = ENEMIES.filter((e) => !S.dead[e.id]).map((e) => spawnEnemy(e.type, e.x * TILE + 8, e.y * TILE + 8, e.id));
  lamps = LAMPS.map((l) => {
    const st = S.lamps[l.id];
    return { ...l, px: l.x * TILE + 8, py: l.y * TILE + 12, lit: st ? st.lit : !!l.lit, sick: st ? st.sick : false, timer: st ? st.timer : 0 };
  });
  if (S.flags.gate_open) openGate(false);
  sparks.length = 0;
  currentRegion = '';
  updateHud();
}

function spawnEnemy(type, x, y, id = null) {
  const pale = type === 'pale';
  return { id, type, x, y, hp: pale ? 18 : 8, maxHp: pale ? 18 : 8, dmg: pale ? 5 : 2, speed: pale ? 30 : 40,
    xp: pale ? 18 : 8, cd: 0, hurtT: 0, kx: 0, ky: 0, dir: 'down', aggro: false, homeX: x, homeY: y, wander: Math.random() * 6 };
}

// ------------------------------------------------------------ Spiel-API für Dialoge

const g = {
  get s() { return S; },
  f: (k) => S.flags[k],
  set: (k, v = true) => { S.flags[k] = v; },
  has: (id, n = 1) => (S.inv[id] || 0) >= n,
  give(id, n = 1) {
    S.inv[id] = (S.inv[id] || 0) + n;
    if (id === 'fahlstaub') S.flags.seen_dust = true;
    toast(`${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''} erhalten`);
    sfx.pickup();
  },
  take(id, n = 1) { S.inv[id] = Math.max(0, (S.inv[id] || 0) - n); if (!S.inv[id]) delete S.inv[id]; },
  coins(n) { S.player.coins += n; if (n > 0) toast(`${n} Münzen erhalten`); updateHud(); },
  xp(n) {
    const p = S.player;
    p.xp += n;
    while (p.xp >= p.lvl * 50) {
      p.xp -= p.lvl * 50; p.lvl++; p.lp += 2; p.maxHp += 6; p.hp = p.maxHp;
      toast(`Stufe ${p.lvl} erreicht. +2 Lernpunkte.`);
    }
    updateHud();
  },
  log(q, text, status) {
    const e = S.log[q] || (S.log[q] = { status: 'open', entries: [] });
    if (!e.entries.includes(text)) e.entries.push(text);
    if (status) e.status = status;
    toast(status === 'done' ? `Erledigt: ${QUESTS[q]}` : `Tagebuch: ${QUESTS[q]}`);
  },
  toast: (t) => toast(t),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  questLampsLit: () => lamps.filter((l) => l.quest && l.lit).length,
  litLamps: () => lamps.filter((l) => l.lit).length,
  totalLamps: () => lamps.length,
  ambrosHome() {
    const a = npcs.find((n) => n.id === 'ambros');
    a.homeTarget = { x: 31 * TILE + 8, y: 43 * TILE + 10 };
  },
  ambrosGone() { npcs.find((n) => n.id === 'ambros').fading = 1; },
  paleRise() {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const x = player.x + Math.cos(a) * 60, y = player.y - 30 + Math.sin(a) * 30;
      if (!solidAt(map, x, y)) enemies.push({ ...spawnEnemy('pale', x, y), aggro: true });
    }
  },
  ending(kind) { pendingEnding = kind; S.flags.ending_seen = true; S.flags.ending_kind = kind; },
};

// ------------------------------------------------------------ Darstellung

function resize() {
  const v = $('view');
  const w = v.clientWidth || 1, h = v.clientHeight || 1;
  VIEW_H = Math.round(VIEW_W * h / w);
  R.resize(w, h, quality);
}

// Lichtquellen in Pixeln; h = Höhe in Einheiten, i = Stärke, r = Reichweite in Einheiten
function lights() {
  const L = [];
  for (const l of lamps) if (l.lit) {
    const f = l.sick ? 0.6 + Math.sin(time * 17 + l.x) * 0.25 : 1 + Math.sin(time * 7 + l.x) * 0.04;
    L.push({ x: l.px, y: l.py - 4, h: 2.1, r: 10, i: 6 * f, c: [255, 180, 90] });
  }
  for (const gl of GLOWS) L.push({ x: gl.x * TILE + 8, y: gl.y * TILE + 8, h: 1.4, r: gl.r / 8, i: 4 * (1 + Math.sin(time * 5 + gl.x) * 0.06), c: gl.c });
  if (S.flags.ending_kind === 'pure') L.push({ x: 48 * TILE, y: 10.5 * TILE, h: 16, r: 40, i: 30, c: [255, 220, 150] });
  else if (S.flags.ending_kind === 'sick') L.push({ x: 48 * TILE, y: 10.5 * TILE, h: 16, r: 26, i: 12 + Math.sin(time * 11) * 4, c: [210, 210, 180] });
  return L;
}

function render() {
  R.render({ player, S, npcs, enemies, lamps, lights: lights(), sparks, time, dt: frameDt, hurtFlash });
  positionBarks();
}

// ------------------------------------------------------------ Bewegung & Kollision

function blocked(x, y, r) {
  return solidAt(map, x - r, y - 3) || solidAt(map, x + r, y - 3) || solidAt(map, x - r, y + 2) || solidAt(map, x + r, y + 2);
}

function move(e, dx, dy, r = 4) {
  if (dx && !blocked(e.x + dx, e.y, r)) e.x += dx;
  if (dy && !blocked(e.x, e.y + dy, r)) e.y += dy;
}

function pushOut(px, py, r) {
  if (Math.abs(player.x - px) < r && Math.abs(player.y - py) < r) {
    const dx = player.x - px, dy = player.y - py, d = Math.hypot(dx, dy) || 1;
    const nx = px + (dx / d) * r, ny = py + (dy / d) * r;
    if (!blocked(nx, ny, 4)) { player.x = nx; player.y = ny; }
  }
}

const dirOf = (x, y) => (Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : y < 0 ? 'up' : 'down');

// ------------------------------------------------------------ Eingabe

const input = { x: 0, y: 0, keys: new Set(), hitHeld: false };
const stick = $('stick'), knob = $('knob');
let stickId = null;

stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); startAudio(); });
stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = (e) => { if (e.pointerId !== stickId) return; stickId = null; input.x = input.y = 0; knob.style.transform = 'translate(-50%,-50%)'; };
stick.addEventListener('pointerup', stickEnd);
stick.addEventListener('pointercancel', stickEnd);

function stickMove(e) {
  const r = stick.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const max = r.width / 2, d = Math.hypot(dx, dy);
  if (d > max) { dx = dx / d * max; dy = dy / d * max; }
  input.x = dx / max; input.y = dy / max;
  if (Math.hypot(input.x, input.y) < 0.18) input.x = input.y = 0;
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

addEventListener('keydown', (e) => {
  input.keys.add(e.key.toLowerCase());
  startAudio();
  if (dialog) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advanceDialog(); } return; }
  if (e.key === 'e' || e.key === 'Enter') interact();
  if (e.key === ' ') { e.preventDefault(); attack(); }
  if (e.key === 'i') openInventory();
  if (e.key === 'j') openLog();
  if (e.key === 'c') openChar();
  if (e.key === 'Escape') { if (!$('overlay').classList.contains('hidden')) closeOverlay(); else openMenu(); }
});
addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));

$('btn-use').addEventListener('pointerdown', (e) => { e.preventDefault(); startAudio(); interact(); });
$('btn-hit').addEventListener('pointerdown', (e) => { e.preventDefault(); startAudio(); input.hitHeld = true; attack(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('btn-hit').addEventListener(ev, () => { input.hitHeld = false; });

// ------------------------------------------------------------ Spielschleife

function update(dt) {
  time += dt;
  const p = S.player;

  // Bewegung
  let mx = input.x, my = input.y;
  const k = input.keys;
  if (k.has('a') || k.has('arrowleft')) mx = -1;
  if (k.has('d') || k.has('arrowright')) mx = 1;
  if (k.has('w') || k.has('arrowup')) my = -1;
  if (k.has('s') || k.has('arrowdown')) my = 1;
  // Eingabe relativ zur Kamera: oben = von der Kamera weg
  const fwd = -my, side = mx, yaw = R.view.yaw;
  mx = -Math.sin(yaw) * fwd + Math.cos(yaw) * side;
  my = -Math.cos(yaw) * fwd - Math.sin(yaw) * side;
  const len = Math.hypot(mx, my);
  player.moving = len > 0.05;
  if (player.moving) {
    if (len > 1) { mx /= len; my /= len; }
    if (fwd > 0.6 && Math.abs(side) < 0.4 && !camDrag) R.view.yaw += angleDiff(Math.atan2(-mx, -my), yaw) * Math.min(1, dt * 1.5);
    const sp = 52 * dt;
    move(player, mx * sp, my * sp);
    player.fx = mx / Math.max(len, 1e-3); player.fy = my / Math.max(len, 1e-3);
    player.dir = dirOf(mx, my);
    const before = Math.sin(player.phase);
    player.phase += dt * 11;
    if (before <= 0 && Math.sin(player.phase) > 0) sfx.step();
  }
  for (const n of npcs) if (!n.hidden) pushOut(n.px, n.py, 8);
  for (const l of lamps) pushOut(l.px, l.py, 6);

  player.atkCd -= dt; player.atkT -= dt;
  if (input.hitHeld && player.atkCd <= 0) attack();

  // Laterne verbraucht Öl
  if (p.oil > 0) {
    p.oil = Math.max(0, p.oil - dt / 2.4);
    if (p.oil < 15 && !oilWarned) { oilWarned = true; toast('Die Laterne flackert. Das Öl geht zur Neige.'); }
    if (p.oil === 0) toast('Die Laterne ist erloschen. Die Dunkelheit rückt näher.');
  }
  if (p.oil > 20) oilWarned = false;

  // Lampen mit gestrecktem Öl verlöschen
  for (const l of lamps) if (l.lit && l.sick) {
    l.timer -= dt;
    if (l.timer <= 0) { l.lit = false; l.sick = false; toast(`${l.name} ist erloschen. Gestrecktes Öl hält nicht lange.`); }
  }

  updateNpcs(dt);
  updateEnemies(dt);

  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.h += s.vh * dt; s.vh -= 6 * dt; s.t -= dt;
    if (s.t <= 0) sparks.splice(i, 1);
  }
  hurtFlash = Math.max(0, hurtFlash - dt * 2);

  updateRegion();
  updateFocus();

  saveTimer += dt;
  if (saveTimer > 25 && !enemies.some((e) => e.aggro)) { saveTimer = 0; save(); }

  barkTimer -= dt;
  if (barkTimer <= 0) { barkTimer = 3; tryBark(); }
  updateHud();
}

function updateNpcs(dt) {
  for (const n of npcs) {
    if (n.hidden) continue;
    if (n.fading !== undefined) {
      n.py += dt * 6; n.fading -= dt * 0.25;
      if (n.fading <= 0) { n.hidden = true; delete n.fading; }
      continue;
    }
    if (n.homeTarget) {
      // Ambros geht langsam heim (wird beim nächsten Laden direkt dort sein)
      const dx = n.homeTarget.x - n.px, dy = n.homeTarget.y - n.py;
      const d = Math.hypot(dx, dy);
      if (d < 2 || Math.hypot(n.px - player.x, n.py - player.y) > 140) { n.px = n.homeTarget.x; n.py = n.homeTarget.y; delete n.homeTarget; n.look = { ...n.look, skin: '#c9a487' }; continue; }
      continue;
    }
    const d = Math.hypot(player.x - n.px, player.y - n.py);
    if (d < 40) n.dir = dirOf(player.x - n.px, player.y - n.py);
  }
}

function inLampLight(x, y) {
  for (const l of lamps) if (l.lit && Math.hypot(l.px - x, l.py - 20 - y) < 56) return l;
  return null;
}

function updateEnemies(dt) {
  const p = S.player;
  let nearest = 999;
  for (const e of enemies) {
    e.cd -= dt; e.hurtT -= dt;
    if (e.spawnA !== undefined) e.spawnA = Math.min(1, e.spawnA + dt);
    const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy);
    if (e.type === 'pale') nearest = Math.min(nearest, d);
    if (e.kx || e.ky) { move(e, e.kx * dt, e.ky * dt, 3); e.kx *= 0.85; e.ky *= 0.85; if (Math.abs(e.kx) + Math.abs(e.ky) < 2) e.kx = e.ky = 0; }

    // Licht verbrennt Fahle
    if (e.type === 'pale') {
      const l = inLampLight(e.x, e.y);
      if (l) {
        e.hp -= 10 * dt;
        const ax = e.x - l.px, ay = e.y - l.py, ad = Math.hypot(ax, ay) || 1;
        move(e, (ax / ad) * 40 * dt, (ay / ad) * 40 * dt, 3);
        if (Math.random() < 0.3) spark(e.x, e.y, '#cfd8dc', 1, 1.2);
        if (e.hp <= 0) killEnemy(e, false);
        continue;
      }
    }

    if (d < (e.type === 'pale' ? 100 : 70)) e.aggro = true;
    if (d > 180) e.aggro = false;
    if (e.aggro) {
      if (d > 9) {
        const sp = e.speed * dt * (e.type === 'pale' && p.oil > 0 ? 0.85 : 1.15);
        move(e, (dx / d) * sp, (dy / d) * sp, 3);
        e.dir = dirOf(dx, dy);
      } else if (e.cd <= 0) {
        e.cd = e.type === 'pale' ? 1.1 : 0.8;
        hurtPlayer(e.dmg);
      }
    } else {
      e.wander -= dt;
      const hx = e.homeX - e.x, hy = e.homeY - e.y;
      const t = time * 0.7 + e.homeX;
      move(e, (Math.cos(t) * 6 + hx * 0.4) * dt, (Math.sin(t * 1.3) * 6 + hy * 0.4) * dt, 3);
    }
  }
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].hp <= 0) enemies.splice(i, 1);
  setWhisper(nearest < 120 ? (1 - nearest / 120) * 0.5 : 0);

  // In völliger Dunkelheit kommen sie
  const indoor = tileAt(map, Math.floor(player.x / TILE), Math.floor(player.y / TILE)) === T.FLOOR;
  if (p.oil <= 0 && !indoor && !inLampLight(player.x, player.y)) {
    spawnTimer += dt;
    if (spawnTimer > 7 && enemies.filter((e) => !e.id && e.type === 'pale').length < 4) {
      spawnTimer = 0;
      const a = Math.random() * Math.PI * 2, x = player.x + Math.cos(a) * 85, y = player.y + Math.sin(a) * 85;
      if (!blocked(x, y, 3) && !inLampLight(x, y)) { const e = spawnEnemy('pale', x, y); e.aggro = true; e.spawnA = 0; enemies.push(e); }
    }
  } else spawnTimer = 0;
}

function hurtPlayer(n) {
  const p = S.player;
  if (Math.random() < p.dex * 0.015) { spark(player.x, player.y, '#ffffff', 4, 1.2); return; } // ausgewichen
  p.hp -= n; hurtFlash = 1; sfx.hurt();
  if (p.hp <= 0) { p.hp = 0; die(); }
}

// Funken: x/y in Pixeln, h = Höhe in Einheiten
function spark(x, y, c, n = 1, h = 1) {
  for (let i = 0; i < n && sparks.length < 300; i++) {
    sparks.push({ x, y, h, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, vh: 1 + Math.random() * 2, t: 0.4 + Math.random() * 0.3, c });
  }
}

function attack() {
  if (paused || dialog || player.atkCd > 0) return;
  player.atkCd = 0.45; player.atkT = 0.15; sfx.swing();
  const p = S.player;
  // Zielhilfe: zum nächsten Gegner drehen
  let target = null, best = 26;
  for (const e of enemies) { const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < best) { best = d; target = e; } }
  if (target) {
    const dx = target.x - player.x, dy = target.y - player.y, d = Math.hypot(dx, dy) || 1;
    player.fx = dx / d; player.fy = dy / d; player.dir = dirOf(dx, dy);
  }
  for (const e of enemies) {
    const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy);
    if (d > 24) continue;
    if (d > 6 && (dx * player.fx + dy * player.fy) / d < 0.2) continue;
    let dmg = ITEMS[p.weapon].weapon + Math.floor(p.str / 2);
    const crit = Math.random() < p.dex * 0.03;
    if (crit) dmg *= 2;
    e.hp -= dmg; e.hurtT = 0.2; e.aggro = true;
    e.kx = (dx / (d || 1)) * 140; e.ky = (dy / (d || 1)) * 140;
    sfx.hit();
    spark(e.x, e.y, e.type === 'pale' ? '#dfe8ec' : '#8a2a20', crit ? 10 : 5, e.type === 'pale' ? 1.2 : 0.2);
    if (e.hp <= 0) killEnemy(e, true);
  }
}

function killEnemy(e, byPlayer) {
  e.hp = 0;
  if (e.id) S.dead[e.id] = true;
  spark(e.x, e.y, e.type === 'pale' ? '#e8f0f2' : '#6a4b40', 14, e.type === 'pale' ? 1.2 : 0.2);
  if (byPlayer || e.type === 'pale') g.xp(e.xp);
  if (e.type === 'pale' && Math.random() < 0.6) g.give('fahlstaub');
  if (e.type === 'rat' && Math.random() < 0.5) g.coins(1 + (Math.random() * 3 | 0));
}

function die() {
  paused = true;
  showOverlay('Der Nebel nimmt dich', `<p class="prose">Es wird kalt. Dann wird es still.\nDann wird es freundlich.</p>
    <button class="menu-btn" id="btn-wake">Erwachen (letzter Spielstand)</button>`);
  $('ov-close').classList.add('hidden');
  $('btn-wake').onclick = () => {
    $('ov-close').classList.remove('hidden');
    closeOverlay();
    const s = loadSaved();
    initWorld(s || newState());
    if (S.player.hp <= 0) S.player.hp = Math.ceil(S.player.maxHp / 2);
    paused = false;
  };
}

// ------------------------------------------------------------ Gebiete

const REGIONS = [
  ['Gasthaus „Zum Nassen Hund"', 31, 13, 8, 7], ['Kontor der Trangilde', 15, 12, 7, 6], ['Lagerhaus der Gilde', 12, 39, 10, 8],
  ['Wachstube', 43, 22, 7, 6], ['Werkstatt des Lampenträgers', 30, 41, 5, 4], ['Friedhof', 17, 53, 25, 10],
  ['Südufer', 8, 63, 48, 6], ['Turmfelsen', 38, 1, 18, 13], ['Hafen', 0, 14, 16, 22], ['Marktplatz', 18, 22, 20, 13],
];

function updateRegion() {
  const tx = player.x / TILE, ty = player.y / TILE;
  const r = REGIONS.find(([, x, y, w, h]) => tx >= x && ty >= y && tx < x + w && ty < y + h);
  const name = r ? r[0] : 'Gassen von Kaltenbruch';
  if (name !== currentRegion) { if (currentRegion) toast(name); currentRegion = name; }
}

// ------------------------------------------------------------ Interaktion

function objectAvailable(o) {
  const f = S.flags;
  switch (o.id) {
    case 'shelf': return !f.shelf_taken;
    case 'gate': return !f.gate_open;
    case 'crate': return !f.crate_taken;
    case 'sabre': return !f.sabre_taken;
    default: return true;
  }
}

function updateFocus() {
  let best = null, bd = 24;
  for (const n of npcs) {
    if (n.hidden || n.fading !== undefined || n.homeTarget) continue;
    const d = Math.hypot(n.px - player.x, n.py - player.y);
    if (d < bd) { bd = d; best = { kind: 'npc', ref: n, label: 'Sprechen', name: n.name }; }
  }
  for (const l of lamps) if (l.quest && !l.lit) {
    const d = Math.hypot(l.px - player.x, l.py - player.y);
    if (d < bd) { bd = d; best = { kind: 'lamp', ref: l, label: 'Anzünden', name: l.name }; }
  }
  for (const o of OBJECTS) {
    if (!objectAvailable(o)) continue;
    const d = Math.hypot(o.x * TILE + 8 - player.x, o.y * TILE + 8 - player.y);
    if (d < (o.id === 'gate' || o.id === 'tower' ? 26 : 20) && d < bd) { bd = d; best = { kind: 'obj', ref: o, label: objLabel(o), name: objName(o) }; }
  }
  focus = best;
  $('btn-use').textContent = best ? best.label : 'Benutzen';
  $('btn-use').classList.toggle('disabled', !best);
  $('hint').textContent = best ? best.name : currentRegion;
}

function objName(o) {
  return { desk: 'Ambros\' Schreibtisch', shelf: 'Regal', bed: 'Pritsche', gate: 'Friedhofstor', crate: 'Kiste mit Gildensiegel', sabre: 'Säbel an der Wand', tower: 'Turmtür' }[o.id];
}
function objLabel(o) {
  if (o.id === 'desk') return S.flags.desk_taken ? 'Lesen' : 'Untersuchen';
  if (o.id === 'gate') return 'Öffnen';
  if (o.id === 'tower') return 'Öffnen';
  return o.label;
}

function interact() {
  if (paused || dialog || !focus) return;
  if (focus.kind === 'npc') return talk(focus.ref);
  if (focus.kind === 'lamp') return lampDialog(focus.ref);
  const o = focus.ref, f = S.flags;
  switch (o.id) {
    case 'desk':
      if (!f.desk_taken) { f.desk_taken = true; g.give('notizbuch'); g.log('runde', 'Meister Ambros ist von seiner Runde nicht zurückgekehrt. In seinem Notizbuch steht: „Heute Nacht: Hedda. Dann die Runde." Hedda führt das Gasthaus nördlich des Marktes.'); }
      readNotebook();
      break;
    case 'shelf': f.shelf_taken = true; g.give('oel_rein'); toast('Ambros\' Notvorrat. Reines Öl.'); break;
    case 'bed':
      fade(() => { S.player.hp = S.player.maxHp; save(); toast('Du schläfst schlecht. Aber du schläfst.'); });
      break;
    case 'gate':
      if (g.has('schluessel_friedhof')) { openGate(true); save(); }
      else toast('Verschlossen. Fink, der Totengräber, hat den Schlüssel.');
      break;
    case 'crate': f.crate_taken = true; g.give('kiste'); save(); break;
    case 'sabre': f.sabre_taken = true; g.give('saebel'); S.player.weapon = 'saebel'; toast('Wachsäbel ausgerüstet.'); save(); break;
    case 'tower':
      if (!g.has('schluessel_turm')) toast('Verschlossen. Das Schloss trägt Ambros\' Zeichen.');
      else if (S.flags.ending_seen) toast('Oben brennt das Wachfeuer. Es gibt dort nichts mehr zu tun. Heute nicht.');
      else openDialog(DIALOGS.tower, 'Wachturm');
      break;
  }
}

function openGate(sound) {
  S.flags.gate_open = true;
  const gc = statics.ground.getContext('2d'), oc = statics.over.getContext('2d');
  for (let x = 26; x <= 28; x++) { map[52 * MAP_W + x] = T.MUD; paintTile(gc, oc, map, x, 52); }
  R.openGate();
  if (sound) { toast('Das Tor quietscht. Irgendwo dahinter antwortet etwas.'); sfx.bell(); }
}

function lampDialog(l) {
  const def = {
    start: () => 'a',
    nodes: {
      a: {
        say: ['*Die Lampe ist kalt. Im Glas klebt ein grauer, milchiger Film.'],
        choices: [
          { t: 'Mit reinem Öl füllen und anzünden.', need: (gg) => gg.has('oel_rein'), do: () => lightLamp(l, 'oel_rein'), go: null },
          { t: 'Mit gestrecktem Öl füllen und anzünden.', need: (gg) => gg.has('oel_trueb'), do: () => lightLamp(l, 'oel_trueb'), go: null },
          { t: 'Später.', go: null },
        ],
      },
    },
  };
  openDialog(def, l.name);
}

function lightLamp(l, item) {
  g.take(item);
  l.lit = true; l.sick = item === 'oel_trueb'; l.timer = l.sick ? 240 : 0;
  sfx.ignite();
  spark(l.px, l.py - 4, '#f3c46e', 12, 2.2);
  const key = 'lit_' + l.id;
  if (!S.flags[key]) { S.flags[key] = true; g.xp(10); }
  toast(l.sick ? `${l.name} brennt. Blass und unruhig.` : `${l.name} brennt wieder.`);
  if (g.questLampsLit() >= 3 && !S.flags.all_lit) {
    S.flags.all_lit = true;
    g.log('runde', 'Alle drei Lichter auf Ambros\' Runde brennen wieder. Fink, der Totengräber am Friedhofstor, sollte mich jetzt durchlassen.');
  }
  save();
}

function talk(n) {
  n.dir = dirOf(player.x - n.px, player.y - n.py);
  openDialog(DIALOGS[n.id], n.name);
}

// ------------------------------------------------------------ Dialogsystem

function openDialog(def, name) {
  dialog = { def, name, lines: [], li: 0, typing: null, node: null };
  $('dialog').classList.remove('hidden');
  input.x = input.y = 0; knob.style.transform = 'translate(-50%,-50%)';
  runNode(def.start(g));
}

function runNode(id) {
  if (!id) return closeDialog();
  const node = dialog.def.nodes[id];
  dialog.node = node;
  if (node.do) node.do(g);
  const say = typeof node.say === 'function' ? node.say(g) : node.say || [];
  dialog.lines = say; dialog.li = 0;
  if (say.length) showLine(); else showChoices();
}

function showLine() {
  const line = dialog.lines[dialog.li];
  let who = dialog.name, text = line, cls = '';
  if (line.startsWith('@')) { who = PLAYER_NAME; text = line.slice(1); cls = 'me'; }
  else if (line.startsWith('*')) { who = ''; text = line.slice(1); cls = 'me'; }
  $('dlg-name').textContent = who;
  const el = $('dlg-text');
  el.innerHTML = '';
  const span = document.createElement('span');
  if (cls) span.className = cls;
  el.appendChild(span);
  const box = $('dlg-choices');
  box.innerHTML = '';
  const cont = document.createElement('button');
  cont.className = 'cont'; cont.textContent = 'Weiter ▸';
  cont.onclick = advanceDialog;
  box.appendChild(cont);
  let i = 0;
  clearInterval(dialog.typing);
  dialog.typing = setInterval(() => {
    i += 2; span.textContent = text.slice(0, i);
    if (i >= text.length) { clearInterval(dialog.typing); dialog.typing = null; }
  }, 22);
  dialog.full = () => { span.textContent = text; };
}

function advanceDialog() {
  if (!dialog) return;
  if (dialog.typing) { clearInterval(dialog.typing); dialog.typing = null; dialog.full(); return; }
  if (dialog.li < dialog.lines.length - 1) { dialog.li++; showLine(); return; }
  if (dialog.lines.length) dialog.lines = [];
  showChoices();
}

$('dlg-text').addEventListener('pointerdown', () => advanceDialog());
$('dlg-name').addEventListener('pointerdown', () => advanceDialog());

function showChoices() {
  const node = dialog.node;
  const box = $('dlg-choices');
  box.innerHTML = '';
  const choices = (node.choices || []).filter((c) => !c.if || c.if(g));
  if (!choices.length) {
    if (node.go) { const next = typeof node.go === 'function' ? node.go(g) : node.go; return runNode(next); }
    const b = document.createElement('button');
    b.className = 'cont'; b.textContent = 'Ende';
    b.onclick = closeDialog;
    box.appendChild(b);
    return;
  }
  for (const c of choices) {
    const b = document.createElement('button');
    const ok = !c.need || c.need(g);
    b.innerHTML = (typeof c.t === 'function' ? c.t(g) : c.t) + (ok ? '' : ' <span class="tag">(nicht möglich)</span>');
    b.disabled = !ok;
    if (!ok) b.style.opacity = 0.45;
    b.onclick = () => {
      if (c.do) c.do(g);
      updateHud();
      const next = typeof c.go === 'function' ? c.go(g) : c.go;
      if (next) runNode(next); else closeDialog();
    };
    box.appendChild(b);
  }
}

function closeDialog() {
  if (!dialog) return;
  clearInterval(dialog.typing);
  dialog = null;
  $('dialog').classList.add('hidden');
  save();
  if (pendingEnding) { const k = pendingEnding; pendingEnding = null; showEnding(k); }
}

// ------------------------------------------------------------ Oberfläche

let toastTimer = null;
const toastQueue = [];
function toast(t) {
  toastQueue.push(t);
  if (!toastTimer) nextToast();
}
function nextToast() {
  const el = $('toast');
  if (!toastQueue.length) { el.classList.remove('show'); toastTimer = null; return; }
  el.textContent = toastQueue.shift();
  el.classList.add('show');
  toastTimer = setTimeout(() => { el.classList.remove('show'); toastTimer = setTimeout(nextToast, 350); }, 2300);
}

function updateHud() {
  if (!S) return;
  const p = S.player;
  $('hpfill').style.width = `${(p.hp / p.maxHp) * 100}%`;
  $('hptext').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('oilfill').style.width = `${p.oil}%`;
  $('oiltext').textContent = p.oil > 0 ? `Öl ${Math.ceil(p.oil)}` : 'Laterne leer';
}

function tryBark() {
  if (dialog || paused) return;
  for (const n of npcs) {
    if (n.hidden || !n.barks) continue;
    const d = Math.hypot(n.px - player.x, n.py - player.y);
    if (d < 80 && d > 22 && Math.random() < 0.18) { bark(n, g.pick(n.barks)); return; }
  }
}

const barks = [];
function bark(n, text) {
  const el = document.createElement('div');
  el.className = 'bark'; el.textContent = text;
  $('barks').appendChild(el);
  const b = { n, el };
  barks.push(b);
  setTimeout(() => { el.style.opacity = 0; }, 3200);
  setTimeout(() => { el.remove(); barks.splice(barks.indexOf(b), 1); }, 3800);
}

function positionBarks() {
  const v = $('view');
  for (const b of barks) {
    const p = R.project(b.n.px, b.n.py, 2.1, v.clientWidth, v.clientHeight);
    b.el.style.left = `${p.x}px`;
    b.el.style.top = `${p.y}px`;
    b.el.style.visibility = p.visible ? 'visible' : 'hidden';
  }
}

function showOverlay(title, html) {
  paused = true;
  $('ov-title').textContent = title;
  $('ov-body').innerHTML = html;
  $('overlay').classList.remove('hidden');
}
function closeOverlay() {
  $('overlay').classList.add('hidden');
  if (running && !dialog) paused = false;
}
$('ov-close').onclick = closeOverlay;

function openLog() {
  const qs = Object.entries(S.log).sort((a, b) => (a[1].status === 'done') - (b[1].status === 'done'));
  const html = qs.length ? qs.map(([id, q]) => `<h3 class="${q.status === 'done' ? 'done' : ''}">${QUESTS[id]}</h3>` +
    q.entries.map((e) => `<div class="entry">${e}</div>`).join('')).join('') : '<p class="prose">Noch keine Einträge.</p>';
  showOverlay('Tagebuch', html);
}

function openInventory() {
  const p = S.player;
  const rows = Object.entries(S.inv).map(([id, n]) => {
    const it = ITEMS[id];
    let btn = '';
    if (it.use === 'fill') btn = `<button data-use="${id}">Nachfüllen</button>`;
    if (it.use === 'heal') btn = `<button data-use="${id}">Essen</button>`;
    if (it.use === 'read') btn = `<button data-use="${id}">Lesen</button>`;
    if (it.weapon) btn = p.weapon === id ? '<small>ausgerüstet</small>' : `<button data-use="${id}">Ausrüsten</button>`;
    return `<div class="item"><div>${it.name}${n > 1 ? ` ×${n}` : ''}<small>${it.desc}</small></div>${btn}</div>`;
  }).join('');
  showOverlay('Inventar', `<div class="stat"><span>Münzen</span><span>${p.coins}</span></div>${rows}`);
  $('ov-body').querySelectorAll('[data-use]').forEach((b) => { b.onclick = () => useItem(b.dataset.use); });
}

function useItem(id) {
  const it = ITEMS[id], p = S.player;
  if (it.use === 'fill') {
    if (p.oil >= 99) return toast('Die Laterne ist voll.');
    g.take(id); p.oil = Math.min(100, p.oil + it.oil); toast(id === 'oel_rein' ? 'Die Flamme wird hell und ruhig.' : 'Die Flamme spuckt. Aber sie brennt.');
  } else if (it.use === 'heal') {
    if (p.hp >= p.maxHp) return toast('Du bist nicht hungrig.');
    g.take(id); p.hp = Math.min(p.maxHp, p.hp + it.heal);
  } else if (it.use === 'read') return readNotebook();
  else if (it.weapon) { p.weapon = id; toast(`${it.name} ausgerüstet.`); }
  updateHud();
  openInventory();
}

function readNotebook() {
  showOverlay('Ambros\' Notizbuch', `<p class="prose">${NOTEBOOK}</p>`);
}

function openChar() {
  const p = S.player;
  const row = (a, b) => `<div class="stat"><span>${a}</span><span>${b}</span></div>`;
  showOverlay(PLAYER_NAME, row('Stufe', p.lvl) + row('Erfahrung', `${p.xp} / ${p.lvl * 50}`) + row('Lernpunkte', p.lp) +
    row('Lebenskraft', `${Math.ceil(p.hp)} / ${p.maxHp}`) + row('Stärke', p.str) + row('Geschick', p.dex) +
    row('Waffe', `${ITEMS[p.weapon].name} (${ITEMS[p.weapon].weapon + Math.floor(p.str / 2)} Schaden)`) + row('Münzen', p.coins) +
    '<p class="prose">Lernpunkte setzt du bei Lehrern ein: Hauptmann Reutter lehrt Stärke, Lene vielleicht Geschick – wenn sie dir traut.</p>');
}

function openMenu() {
  showOverlay('Menü', `
    <button class="menu-btn" id="m-sound">Ton: ${audioEnabled() ? 'an' : 'aus'}</button>
    <button class="menu-btn" id="m-gfx">Grafik: ${quality >= 1 ? 'scharf' : quality >= 0.75 ? 'mittel' : 'grob (schnell)'}</button>
    <button class="menu-btn" id="m-save">Spiel speichern</button>
    <button class="menu-btn" id="m-title">Zum Titelbildschirm</button>
    <p class="prose">Linker Kreis: gehen. Auf der Spielwelt wischen: Kamera drehen. Schlag: angreifen (gedrückt halten). Benutzen: sprechen, anzünden, aufheben.
Licht hält die Fahlen fern. Behalte das Öl deiner Laterne im Auge.</p>`);
  $('m-sound').onclick = () => { toggleAudio(); openMenu(); };
  $('m-gfx').onclick = () => { quality = quality >= 1 ? 0.5 : quality >= 0.75 ? 1 : 0.75; try { localStorage.setItem('letzteslicht.gfx', quality); } catch (e) { /* egal */ } resize(); openMenu(); };
  $('m-save').onclick = () => { save(); toast('Gespeichert.'); closeOverlay(); };
  $('m-title').onclick = () => { save(); closeOverlay(); running = false; paused = true; showTitle(); };
}

$('btn-log').onclick = () => S && openLog();
$('btn-inv').onclick = () => S && openInventory();
$('btn-char').onclick = () => S && openChar();
$('btn-menu').onclick = () => S && openMenu();

function fade(mid) {
  const f = $('fade');
  paused = true; f.classList.add('on');
  setTimeout(() => { mid(); f.classList.remove('on'); setTimeout(() => { if (!dialog) paused = false; }, 600); }, 900);
}

// ------------------------------------------------------------ Erzählsequenzen

function storyPages(title, pages, finalLabel, onDone) {
  let i = 0;
  const show = () => {
    showOverlay(title, `<p class="prose" id="pg">${pages.slice(0, i + 1).join('\n\n')}</p>
      <button class="menu-btn" id="pg-next">${i < pages.length - 1 ? 'Weiter' : finalLabel}</button>`);
    $('ov-close').classList.add('hidden');
    $('ov-body').scrollTop = 1e6;
    $('pg-next').onclick = () => {
      if (i < pages.length - 1) { i++; show(); }
      else { $('ov-close').classList.remove('hidden'); closeOverlay(); onDone && onDone(); }
    };
  };
  show();
}

function showEnding(kind) {
  const pages = endingText(S.flags, kind);
  pages.push('— Ende des ersten Kapitels —');
  save();
  storyPages('Das Wachfeuer', pages, 'Weiterspielen', () => { paused = false; toast('Kaltenbruch wartet. Die Nacht ist noch lang.'); });
}

// ------------------------------------------------------------ Titel & Start

const tfx = $('title-fx'), tctx = tfx.getContext('2d');
let titleOn = true;
function titleLoop(t) {
  if (!titleOn) return;
  const w = tfx.width = 180, h = tfx.height = Math.round(180 * innerHeight / innerWidth);
  tctx.fillStyle = '#050507'; tctx.fillRect(0, 0, w, h);
  const s = t / 1000;
  const x = w / 2, y = h * 0.72, r = 50 + Math.sin(s * 7) * 2 + Math.sin(s * 19) * 1.5;
  const gr = tctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, 'rgba(255,170,80,.45)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
  tctx.fillStyle = gr; tctx.fillRect(0, 0, w, h);
  drawLampPost(tctx, x, y + 26, true, s, false);
  tctx.globalAlpha = 0.35;
  for (const [img, sp, oy] of [[fogA, 5, 0], [fogB, -3, 40]]) {
    const ox = ((s * sp) % img.width + img.width) % img.width;
    for (let yy = -oy % img.height - img.height; yy < h; yy += img.height) for (let xx = -ox; xx < w; xx += img.width) tctx.drawImage(img, xx, yy);
  }
  tctx.globalAlpha = 1;
  requestAnimationFrame(titleLoop);
}

function showTitle() {
  titleOn = true;
  $('title').classList.remove('hidden');
  $('btn-continue').classList.toggle('hidden', !loadSaved());
  requestAnimationFrame(titleLoop);
}

function startGame(state, intro) {
  startAudio();
  titleOn = false;
  $('title').classList.add('hidden');
  resize();
  initWorld(state);
  R.snapCamera(player.x, player.y);
  running = true;
  if (intro) {
    storyPages('Kaltenbruch', INTRO, 'Aufstehen', () => {
      paused = false;
      g.log('runde', 'Meister Ambros ist von seiner Runde nicht zurückgekehrt. Vielleicht verrät sein Schreibtisch, wohin er wollte.');
      save();
    });
  } else paused = false;
}

$('btn-new').onclick = () => {
  if (!worldReady) return;
  if (loadSaved() && !confirm('Den bisherigen Spielstand überschreiben?')) return;
  startGame(newState(), true);
};
$('btn-continue').onclick = () => { if (!worldReady) return; const s = loadSaved(); if (s) startGame(s, false); };

let last = performance.now(), frameDt = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  frameDt = dt;
  last = now;
  if (running) {
    if (!paused && !dialog) update(dt);
    else time += dt;
    render();
  }
  requestAnimationFrame(loop);
}

addEventListener('resize', () => running && resize());
document.addEventListener('visibilitychange', () => { if (document.hidden && running) save(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

// Testzugriff
window.__ll = { get ready() { return worldReady; }, view: R.view, snap: () => R.snapCamera(player.x, player.y), get state() { return S; }, get player() { return player; }, get enemies() { return enemies; }, get lamps() { return lamps; }, g, interact, attack, get focus() { return focus; }, get dialog() { return dialog; } };

// Welt laden, dann erst Start erlauben
let worldReady = false;
$('btn-new').disabled = $('btn-continue').disabled = true;
R.load((f) => { $('loading').textContent = `Lade Welt … ${Math.round(f * 100)} %`; }).then(() => {
  R.init(canvas, map);
  worldReady = true;
  $('loading').textContent = '';
  $('btn-new').disabled = $('btn-continue').disabled = false;
});

// Kamera drehen: auf der Spielwelt wischen
let camDrag = null;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
canvas.addEventListener('pointerdown', (e) => { camDrag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); startAudio(); });
canvas.addEventListener('pointermove', (e) => {
  if (!camDrag || e.pointerId !== camDrag.id) return;
  R.view.yaw -= (e.clientX - camDrag.x) * 0.008;
  R.view.pitch = Math.max(0.2, Math.min(1.1, R.view.pitch + (e.clientY - camDrag.y) * 0.004));
  camDrag.x = e.clientX; camDrag.y = e.clientY;
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { camDrag = null; });
addEventListener('keydown', (e) => { if (e.key === 'q') R.view.yaw += 0.15; if (e.key === 'r') R.view.yaw -= 0.15; });

showTitle();
requestAnimationFrame(loop);
