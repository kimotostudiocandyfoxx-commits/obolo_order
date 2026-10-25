// Run with a dev server on :3111 (PORT=3111 npx next dev): node scripts/dj-rim-check.mjs — exits 1 if any control touches a rim.
// Test-only: the demo MVs are mp4; a browser without H.264 needs webm copies next to this script (busan-*.webm).
// Rim clearance: every control's outline (rounded rect) must stay inside its circle's rim (deck well
// 0.93 R, mixer panel 0.935 R, minus a margin) and, on a deck, clear of the mixer's rim (0.955 R).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
let bad = 0;
for (const [w, h] of [[844, 390], [932, 430], [667, 375]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.route('**/dj-demo/*.mp4', (r) => { const n = r.request().url().match(/(busan-[a-z]+)\.mp4/)[1]; r.fulfill({ status: 200, contentType: 'video/webm', body: readFileSync(`${n}.webm`) }); });
  await p.goto('http://localhost:3111/kakunin-5798f28713/dj', { waitUntil: 'networkidle', timeout: 120000 });
  await p.click('text=はじめる');
  await p.waitForTimeout(2000);
  const res = await p.evaluate(() => {
    const M = 0.035; // margin, in R
    const circ = Object.fromEntries([...document.querySelectorAll('[data-circle]')].map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.circle, { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2, el: e }]; }));
    const parts = [];
    for (const [key, c] of Object.entries(circ)) {
      const els = [...c.el.querySelectorAll('button > span, button:not(:has(span)), canvas, [data-part]')].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('.z-30, [style*="z-index: 31"]'));
      for (const e of els) {
        // the jog and its screen are drawn to fit; skip them and anything inside the jog
        if (e.closest('[data-jog]')) continue;
        parts.push({ key, c, e });
      }
    }
    const out = [];
    for (const { key, c, e } of parts) {
      const r = e.getBoundingClientRect();
      const br = Math.min(parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0, r.width / 2, r.height / 2);
      const pts = [];
      // rounded-rect outline
      const cx0 = r.left + br, cx1 = r.right - br, cy0 = r.top + br, cy1 = r.bottom - br;
      for (let a = 0; a < 64; a++) {
        const t = (a / 64) * Math.PI * 2, ux = Math.cos(t), uy = Math.sin(t);
        const cx = ux >= 0 ? cx1 : cx0, cy = uy >= 0 ? cy1 : cy0;
        pts.push([cx + ux * br, cy + uy * br]);
      }
      let worstIn = 0, worstOut = 9;
      for (const [x, y] of pts) {
        worstIn = Math.max(worstIn, Math.hypot(x - c.x, y - c.y) / c.R);
        if (key !== 'm') worstOut = Math.min(worstOut, Math.hypot(x - circ.m.x, y - circ.m.y) / circ.m.R);
      }
      const limIn = (key === 'm' ? 0.935 : 0.93) - M;
      const label = (e.textContent || e.tagName).trim().slice(0, 10);
      if (worstIn > limIn) out.push(`${key}:${label} reaches ${worstIn.toFixed(3)} > ${limIn.toFixed(3)}`);
      if (key !== 'm' && worstOut < 0.955 + M) out.push(`${key}:${label} under mixer rim ${worstOut.toFixed(3)} < ${(0.955 + M).toFixed(3)}`);
    }
    return out;
  });
  bad += res.length;
  console.log(`${w}x${h}:`, res.length ? '\n  ' + res.join('\n  ') : 'clear');
  await p.screenshot({ path: `rim-${w}.png` });
  await p.close();
}
await b.close();
process.exit(bad ? 1 : 0);
