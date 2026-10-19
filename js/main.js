import { TILE, MAP_W, MAP_H, T, buildMap, renderStatic, paintTile, solidAt, tileAt, hash, makeFog,
  drawHuman, drawLantern, drawPale, drawRat, drawLampPost } from './world.js';
import { PLAYER_NAME, INTRO, ITEMS, NOTEBOOK, QUESTS, LAMPS, GLOWS, OBJECTS, NPCS, ENEMIES, DIALOGS, endingText } from './story.js';
import { startAudio, sfx, setWhisper, toggleAudio, audioEnabled } from './audio.js';

const SAVE_KEY = 'letzteslicht.save.v1';
const VIEW_W = 176;
const $ = (id) => document.getElementById(id);

const canvas = $('game');
const ctx = canvas.getContext('2d');
const dark = document.createElement('canvas');
const dctx = dark.getContext('2d');
let VIEW_H = 240, vignette = null;

const map = buildMap();
const statics = renderStatic(map);
const fogA = makeFog(128, 3), fogB = makeFog(160, 8);

let S = null;               // gespeicherter Spielzustand
let player, npcs, enemies, lamps;
let running = false, paused = true, dialog = null, pendingEnding = null;
let time = 0, saveTimer = 0, spawnTimer = 0, barkTimer = 0, oilWarned = false;
let hurtFlash = 0, currentRegion = '', focus = null;
const sparks = [];
const rain = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.6 }));

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
  player = { x: S.player.x, y: S.player.y, dir: 'down', fx: 0, fy: 1, phase: 0, atkCd: 0, atkT: 0, moving: false };
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
  VIEW_H = Math.max(120, Math.round(VIEW_W * h / w));
  canvas.width = dark.width = VIEW_W;
  canvas.height = dark.height = VIEW_H;
  ctx.imageSmoothingEnabled = false;
  vignette = document.createElement('canvas');
  vignette.width = VIEW_W; vignette.height = VIEW_H;
  const vc = vignette.getContext('2d');
  const gr = vc.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.25, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.75)');
  vc.fillStyle = gr; vc.fillRect(0, 0, VIEW_W, VIEW_H);
}

function camera() {
  let cx = Math.round(player.x - VIEW_W / 2), cy = Math.round(player.y - 8 - VIEW_H / 2);
  cx = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, cx));
  cy = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, cy));
  return { cx, cy };
}

function lights() {
  const L = [];
  const p = S.player;
  const fl = 1 + Math.sin(time * 9) * 0.03 + Math.sin(time * 23) * 0.02;
  L.push({ x: player.x, y: player.y - 8, r: (p.oil > 0 ? 58 + Math.min(10, p.oil / 10) : 16) * fl, c: [255, 170, 80], a: p.oil > 0 ? 0.22 : 0.05 });
  for (const l of lamps) if (l.lit) {
    const f = l.sick ? 0.75 + Math.sin(time * 17 + l.x) * 0.15 : 1 + Math.sin(time * 7 + l.x) * 0.03;
    L.push({ x: l.px, y: l.py - 24, r: 72 * f, c: [255, 180, 90], a: 0.2 });
  }
  for (const gl of GLOWS) L.push({ x: gl.x * TILE + 8, y: gl.y * TILE + 8, r: gl.r * (1 + Math.sin(time * 5 + gl.x) * 0.04), c: gl.c, a: 0.18 });
  if (S.flags.ending_kind === 'pure') L.push({ x: 48 * TILE, y: 9 * TILE, r: 170, c: [255, 220, 150], a: 0.25 });
  else if (S.flags.ending_kind === 'sick') L.push({ x: 48 * TILE, y: 9 * TILE, r: 90 + Math.sin(time * 11) * 15, c: [200, 200, 170], a: 0.15 });
  return L;
}

function render() {
  const { cx, cy } = camera();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(statics.ground, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

  // Wasser glitzert
  const tx0 = Math.floor(cx / TILE), ty0 = Math.floor(cy / TILE);
  const step = Math.floor(time * 2);
  for (let ty = ty0; ty <= ty0 + Math.ceil(VIEW_H / TILE); ty++) for (let tx = tx0; tx <= tx0 + 12; tx++) {
    if (tileAt(map, tx, ty) !== T.WATER) continue;
    if (hash(tx, ty, step) < 0.35) {
      ctx.fillStyle = '#1c2a31';
      ctx.fillRect(tx * TILE - cx + ((hash(tx, ty, step + 1) * 13) | 0), ty * TILE - cy + ((hash(tx, ty, step + 2) * 15) | 0), 3, 1);
    }
  }

  // Figuren nach Tiefe sortiert
  const list = [];
  for (const l of lamps) list.push({ y: l.py, draw: () => drawLampPost(ctx, l.px - cx, l.py - cy, l.lit, time, l.sick) });
  for (const n of npcs) if (!n.hidden) list.push({ y: n.py, draw: () => drawHuman(ctx, n.px - cx, n.py - cy, n.look, n.dir, n.walk || 0, n.fading ?? 1) });
  for (const e of enemies) list.push({ y: e.y, draw: () => {
    if (e.hurtT > 0 && Math.floor(time * 30) % 2) return;
    if (e.type === 'pale') drawPale(ctx, e.x - cx, e.y - cy, time, e.spawnA ?? 1);
    else drawRat(ctx, e.x - cx, e.y - cy, time, e.dir);
  } });
  list.push({ y: player.y, draw: () => {
    drawHuman(ctx, player.x - cx, player.y - cy, { skin: '#c9a487', cloak: '#46382a', hair: '#3a2a1c', belt: '#2a2016' }, player.dir, player.phase);
    drawLantern(ctx, player.x - cx, player.y - cy, player.dir, S.player.oil > 0, time);
    if (player.atkT > 0) {
      const a = Math.atan2(player.fy, player.fx), k = 1 - player.atkT / 0.15;
      ctx.strokeStyle = 'rgba(220,210,190,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(player.x - cx, player.y - 7 - cy, 13, a - 1 + k * 0.6, a + 0.2 + k * 0.8); ctx.stroke();
    }
  } });
  list.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

  ctx.drawImage(statics.over, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

  for (const s of sparks) { ctx.fillStyle = s.c; ctx.fillRect(Math.round(s.x - cx), Math.round(s.y - cy), 1, 1); }

  const indoor = tileAt(map, Math.floor(player.x / TILE), Math.floor(player.y / TILE)) === T.FLOOR;

  // Nebel, der im Licht sichtbar wird
  if (!indoor) drawFog(fogA, cx * 1.0 + time * 6, cy + time * 2, 0.55);

  // Dunkelheit
  const L = lights();
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, VIEW_W, VIEW_H);
  dctx.fillStyle = indoor ? 'rgba(4,4,7,.9)' : 'rgba(3,4,9,.94)';
  dctx.fillRect(0, 0, VIEW_W, VIEW_H);
  dctx.globalCompositeOperation = 'destination-out';
  for (const l of L) {
    const x = l.x - cx, y = l.y - cy;
    if (x < -l.r || y < -l.r || x > VIEW_W + l.r || y > VIEW_H + l.r) continue;
    const gr = dctx.createRadialGradient(x, y, 0, x, y, l.r);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = gr; dctx.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
  }
  ctx.drawImage(dark, 0, 0);

  // Warmes Leuchten
  ctx.globalCompositeOperation = 'lighter';
  for (const l of L) {
    const x = l.x - cx, y = l.y - cy;
    if (x < -l.r || y < -l.r || x > VIEW_W + l.r || y > VIEW_H + l.r) continue;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, l.r * 0.8);
    gr.addColorStop(0, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},${l.a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Fahle leuchten schwach im Dunkeln
  for (const e of enemies) if (e.type === 'pale') {
    const x = e.x - cx, y = e.y - 10 - cy;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, 14);
    gr.addColorStop(0, 'rgba(180,200,210,.18)'); gr.addColorStop(1, 'rgba(180,200,210,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#d8e4ea';
    ctx.fillRect(Math.round(x - 2), Math.round(y - 5), 1, 1); ctx.fillRect(Math.round(x + 1), Math.round(y - 5), 1, 1);
    ctx.globalAlpha = 1;
  }

  if (!indoor) {
    drawFog(fogB, cx * 1.3 - time * 4, cy * 1.3, 0.13);
    ctx.fillStyle = 'rgba(150,165,175,.18)';
    for (const r of rain) {
      const x = ((r.x * VIEW_W - cx * 0.2 + time * 18 * r.s) % VIEW_W + VIEW_W) % VIEW_W;
      const y = ((r.y * VIEW_H + time * 140 * r.s) % VIEW_H + VIEW_H) % VIEW_H;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 3);
    }
  }

  ctx.drawImage(vignette, 0, 0);
  if (hurtFlash > 0) { ctx.fillStyle = `rgba(120,10,5,${hurtFlash * 0.5})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (S.player.oil <= 0) { ctx.fillStyle = `rgba(0,0,0,${0.15 + Math.sin(time * 2) * 0.05})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }

  positionBarks(cx, cy);
}

function drawFog(img, ox, oy, alpha) {
  const w = img.width;
  ctx.globalAlpha = alpha;
  const sx = ((ox % w) + w) % w, sy = ((oy % w) + w) % w;
  for (let y = -sy; y < VIEW_H; y += w) for (let x = -sx; x < VIEW_W; x += w) ctx.drawImage(img, Math.round(x), Math.round(y));
  ctx.globalAlpha = 1;
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
  const len = Math.hypot(mx, my);
  player.moving = len > 0.05;
  if (player.moving) {
    if (len > 1) { mx /= len; my /= len; }
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
    const s = sparks[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * dt; s.t -= dt;
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
        if (Math.random() < 0.3) spark(e.x, e.y - 8, '#cfd8dc');
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
  if (Math.random() < p.dex * 0.015) { spark(player.x, player.y - 10, '#ffffff'); return; } // ausgewichen
  p.hp -= n; hurtFlash = 1; sfx.hurt();
  if (p.hp <= 0) { p.hp = 0; die(); }
}

function spark(x, y, c, n = 1) {
  for (let i = 0; i < n; i++) sparks.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 50, t: 0.4 + Math.random() * 0.3, c });
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
    spark(e.x, e.y - 8, e.type === 'pale' ? '#dfe8ec' : '#8a2a20', crit ? 10 : 5);
    if (e.hp <= 0) killEnemy(e, true);
  }
}

function killEnemy(e, byPlayer) {
  e.hp = 0;
  if (e.id) S.dead[e.id] = true;
  spark(e.x, e.y - 8, e.type === 'pale' ? '#e8f0f2' : '#6a4b40', 14);
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
  spark(l.px, l.py - 24, '#f3c46e', 12);
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

function positionBarks(cx, cy) {
  const scale = $('view').clientWidth / VIEW_W;
  for (const b of barks) {
    b.el.style.left = `${(b.n.px - cx) * scale}px`;
    b.el.style.top = `${(b.n.py - 20 - cy) * (($('view').clientHeight) / VIEW_H)}px`;
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
    <button class="menu-btn" id="m-save">Spiel speichern</button>
    <button class="menu-btn" id="m-title">Zum Titelbildschirm</button>
    <p class="prose">Linker Kreis: gehen. Schlag: angreifen (gedrückt halten). Benutzen: sprechen, anzünden, aufheben.
Licht hält die Fahlen fern. Behalte das Öl deiner Laterne im Auge.</p>`);
  $('m-sound').onclick = () => { toggleAudio(); openMenu(); };
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
  if (loadSaved() && !confirm('Den bisherigen Spielstand überschreiben?')) return;
  startGame(newState(), true);
};
$('btn-continue').onclick = () => { const s = loadSaved(); if (s) startGame(s, false); };

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
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
window.__ll = { get state() { return S; }, get player() { return player; }, get enemies() { return enemies; }, get lamps() { return lamps; }, g, interact, attack, get focus() { return focus; }, get dialog() { return dialog; } };

showTitle();
requestAnimationFrame(loop);
