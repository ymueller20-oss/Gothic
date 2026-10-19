// Schnelle Bildschirmfotos an mehreren Orten (Server auf Port 8123)
import { chromium } from 'playwright';
const out = process.argv[2] || 'tests/shots';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.addInitScript((q) => { try { localStorage.setItem('letzteslicht.gfx', q); } catch (e) { /* egal */ } }, process.env.Q || '1');
await page.goto('http://localhost:8123/index.html');
await page.waitForFunction(() => window.__ll && __ll.ready, null, { timeout: 180000 });
await page.click('#btn-new');
for (let i = 0; i < 5; i++) await page.click('#pg-next');
const spots = (process.argv[3] || '32,43,0;28,36,0;24,28,2.4;12,30,1.2;27,50,0;34,16,0;47,9,3.1').split(';');
for (const [i, sp] of spots.entries()) {
  const [x, y, yaw] = sp.split(',').map(Number);
  await page.evaluate(([x, y, yaw]) => { __ll.player.x = x * 16 + 8; __ll.player.y = y * 16 + 8; __ll.view.yaw = yaw; __ll.snap(); }, [x, y, yaw]);
  await page.waitForTimeout(1500);
  const ft = await page.evaluate(() => new Promise((r) => { const t0 = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t0))); }));
  console.log('frame ms', Math.round(ft / 2));
  await page.screenshot({ path: `${out}/s${i}.png`, timeout: 120000 });
}
console.log('ERRORS', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
