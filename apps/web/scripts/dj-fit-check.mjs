// Run with a dev server on :3111 (PORT=3111 npx next dev): node scripts/dj-fit-check.mjs — exits 1 if a label is cramped in its button.
// Text fit: each button's label must sit comfortably inside it.
//  pill (wider than tall): side padding ≥ 0.42 × height each side
//  round: label width ≤ 0.6 × diameter
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let bad = 0;
for (const [w, h] of [[844, 390], [667, 375]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:3111/kakunin-5798f28713/dj', { waitUntil: 'networkidle', timeout: 120000 });
  await p.click('text=はじめる');
  await p.waitForTimeout(2000);
  await p.evaluate(() => document.fonts.ready);
  const res = await p.evaluate(() => {
    const out = [];
    const font = getComputedStyle(document.querySelector('[data-circle] button span') ?? document.body).fontFamily;
    for (const btn of document.querySelectorAll('[data-circle] button')) {
      const face = btn.querySelector(':scope > span') ?? btn;
      const r = face.getBoundingClientRect();
      if (!r.width) continue;
      const svg = face.querySelector('svg');
      const range = document.createRange();
      range.selectNodeContents(face);
      const t = svg && !face.textContent.trim() ? svg.getBoundingClientRect() : range.getBoundingClientRect();
      const label = face.textContent.trim().slice(0, 10) || '(icon)';
      const round = Math.abs(r.width - r.height) < 2;
      if (round) {
        const ratio = t.width / r.width;
        if (ratio > 0.6) out.push(`${label}: round, text ${ratio.toFixed(2)} of diameter`);
      } else {
        const pad = (r.width - t.width) / 2 / r.height;
        if (pad < 0.42) out.push(`${label}: pill, side padding ${pad.toFixed(2)} × height`);
      }
    }
    return { font, out: [...new Set(out)] };
  });
  bad += res.out.length;
  console.log(`${w}x${h} (font ${res.font.split(',')[0]}):`, res.out.length ? '\n  ' + res.out.join('\n  ') : 'all fit');
  await p.close();
}
await b.close();
process.exit(bad ? 1 : 0);
