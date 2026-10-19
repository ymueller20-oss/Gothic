// Rauchtest: startet das Spiel im Handy-Hochformat, spielt die Hauptgeschichte per Test-API durch
// und meldet JavaScript-Fehler. Aufruf: node tests/smoke.mjs (Server auf Port 8123 muss laufen)
import { chromium } from 'playwright';

const out = process.argv[2] || 'tests/shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:8123/index.html');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/0-title.png` });
await page.click('#btn-new');
await page.waitForTimeout(300);
for (let i = 0; i < 5; i++) await page.click('#pg-next');
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/1-start.png` });

const tp = (x, y) => page.evaluate(([x, y]) => { __ll.player.x = x * 16 + 8; __ll.player.y = y * 16 + 10; }, [x, y]);
const use = async () => { await page.waitForTimeout(120); await page.evaluate(() => __ll.interact()); await page.waitForTimeout(120); };
// Dialog bis zum Ende durchklicken, dabei Antworten nach Text wählen
async function talk(picks = []) {
  for (let guard = 0; guard < 80; guard++) {
    const open = await page.evaluate(() => !!__ll.dialog);
    if (!open) return;
    const btns = await page.$$eval('#dlg-choices button', (bs) => bs.map((b) => ({ t: b.textContent, d: b.disabled })));
    if (btns.length === 1 && /Weiter|Ende/.test(btns[0].t)) { await page.click('#dlg-choices button'); await page.click('#dlg-choices button').catch(() => {}); continue; }
    const want = picks.find((p) => btns.some((b) => !b.d && b.t.includes(p)));
    if (want) { picks.splice(picks.indexOf(want), 1); await page.click(`#dlg-choices button:has-text("${want}")`); continue; }
    // sonst letzte Option (Abschied)
    await page.click('#dlg-choices button:last-child');
  }
}

// Notizbuch
await tp(31, 42); await use(); await page.click('#ov-close');
await tp(33, 43); await page.evaluate(() => { __ll.player.x = 34 * 16 + 8; __ll.player.y = 44 * 16 + 6; }); await use();
// Hedda
await tp(34, 16); await use(); await talk(['Was hat er gesagt?', 'Du siehst traurig aus.', 'Ich rede mit Fink']);
await page.screenshot({ path: `${out}/2-inn.png` });
await tp(34, 16); await use(); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/2b-dialog.png` }); await talk(['Ich hab Hunger', 'Fischsuppe kaufen', 'Nichts mehr']);
// Öl kaufen bei Kassian
await page.evaluate(() => { __ll.state.player.coins += 30; });
await tp(18, 15); await use(); await talk(['Ich brauche Öl.', 'Gestrecktes Öl kaufen', 'Gestrecktes Öl kaufen', 'Zurück.']);
// Lampen
for (const [x, y] of [[21, 27], [12, 32], [25, 48]]) {
  await tp(x, y); await use(); await talk(['reinem Öl', 'gestrecktem Öl']);
}
await page.screenshot({ path: `${out}/3-lamp.png` });
console.log('lit', await page.evaluate(() => __ll.g.questLampsLit()));
// Lagerhaus: Ratten bekämpfen, Kiste holen
await tp(20, 43);
for (let i = 0; i < 30; i++) { await page.evaluate(() => __ll.attack()); await page.waitForTimeout(160); }
await page.screenshot({ path: `${out}/4-warehouse.png` });
await page.evaluate(() => { __ll.state.player.hp = __ll.state.player.maxHp; });
await tp(14, 41); await use();
await tp(3, 27); await use(); await talk(['Hier ist deine Kiste', 'Was weißt du']);
// Fink
await tp(30, 50); await use(); await talk(['Lass mich durch', 'Hedda möchte', 'Hier sind zehn']);
await tp(27, 51); await use();
await page.screenshot({ path: `${out}/5-gate.png` });
// Friedhof / Ufer
await page.evaluate(() => { __ll.state.player.hp = 999; __ll.state.player.maxHp = 999; });
await tp(30, 65); await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/6-shore.png` });
await tp(33, 66); await use(); await talk(['Hast du einen Matthis']);
await tp(30, 67); await use(); await talk(['Ohm hat dich', 'Reines Öl']);
await page.waitForTimeout(500);
for (let i = 0; i < 25; i++) { await page.evaluate(() => __ll.attack()); await page.waitForTimeout(150); }
// Hedda Wahrheit
await tp(34, 16); await use(); await talk(['Ich war unten am Wasser', 'Er ist ins Wasser gegangen']);
// Turm
await page.evaluate(() => __ll.g.give('oel_rein'));
await tp(47, 6); await use(); await talk(['Reines Öl']);
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/7-ending.png` });
for (let i = 0; i < 15; i++) { const b = await page.$('#pg-next'); if (!b || !(await b.isVisible())) break; await b.click(); }
await tp(46, 5); await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/8-tower.png` });
const st = await page.evaluate(() => ({ flags: __ll.state.flags, log: Object.keys(__ll.state.log), inv: __ll.state.inv, p: __ll.state.player }));
console.log(JSON.stringify(st));
console.log('ERRORS', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
