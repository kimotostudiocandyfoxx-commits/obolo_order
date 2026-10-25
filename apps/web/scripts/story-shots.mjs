#!/usr/bin/env node
/**
 * Phone-width screenshots of a story day (production UI 2, 2026-10-15): opens /kakunin-5798f28713/play, taps through
 * like a visitor (lines, buttons, choices — the first option) and saves a picture each time the screen
 * changes, until `--until` text appears or `--max` pictures.
 *
 *   node apps/web/scripts/story-shots.mjs --base http://localhost:3100 --day 1 --until "門をくぐり" --out shots/day1
 *   options: --at <step type> | --i <index>   start later in the day
 *            --width 390 --height 844        the phone (iPhone 14 size by default)
 *            --webm <dir>                    serve <dir>/m<N>.webm for m<N>.mp4 (a Chromium without H.264)
 *            --wait 1600                     ms to let a scene settle before the picture
 *            --name 'テスト' / --choose 'label,label'   answers to type / choices to prefer
 * Needs Playwright (global or project) and a Chromium (PLAYWRIGHT executable path via --chrome).
 */
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, x, k, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[k + 1]?.startsWith('--') || all[k + 1] === undefined ? 'true' : all[k + 1]]] : a), []),
);
const base = args.base ?? 'http://localhost:3100';
const out = args.out ?? 'shots';
const max = Number(args.max ?? 40);
const wait = Number(args.wait ?? 1600);
const prefer = (args.choose ?? '').split(',').filter(Boolean);
mkdirSync(out, { recursive: true });

const req = createRequire(import.meta.url);
let pw;
for (const p of [process.cwd(), '/opt/node22/lib/node_modules/', '/usr/lib/node_modules/']) {
  try {
    pw = req(req.resolve('playwright', { paths: [p] }));
    break;
  } catch {
    /* next */
  }
}
if (!pw) throw new Error('playwright not found');

const browser = await pw.chromium.launch({ executablePath: args.chrome ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
const page = await browser.newPage({ viewport: { width: Number(args.width ?? 390), height: Number(args.height ?? 844) }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
if (args.webm) {
  await page.route(/\/onboarding\/m[\w-]+\.mp4$/, async (route) => {
    const m = route.request().url().match(/(m[\w-]+)\.mp4$/)[1];
    const f = join(args.webm, `${m}.webm`);
    if (existsSync(f)) await route.fulfill({ status: 200, contentType: 'video/webm', body: readFileSync(f) });
    else await route.continue();
  });
}
const q = new URLSearchParams({ day: args.day ?? '1', ...(args.at ? { at: args.at } : {}), ...(args.i ? { i: args.i } : {}) });
await page.goto(`${base}/kakunin-5798f28713/play?${q}`, { waitUntil: 'networkidle', timeout: 180_000 });
await page.waitForTimeout(800);

let shot = 0;
let last = '';
const snap = async (label) => {
  shot++;
  const f = join(out, `${String(shot).padStart(2, '0')}-${label.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 16) || 'scene'}.png`);
  await page.screenshot({ path: f });
  console.log(f);
};
const text = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
await snap('start');
await page.mouse.click(195, 420); // the start tap (unlocks sound)
for (let k = 0; k < 400 && shot < max; k++) {
  await page.waitForTimeout(wait);
  const t = await text();
  if (t !== last) {
    last = t;
    await snap(t.slice(0, 20));
  }
  if (args.until && t.includes(args.until)) break;
  // a typed answer?
  const field = page.locator('input:visible, textarea:visible').first();
  if ((await field.count()) && !(await field.inputValue())) {
    await field.fill(args.name ?? 'テスト');
    continue;
  }
  // a preferred choice, else the first button that is not a small tool, else a tap on the screen
  let clicked = false;
  for (const p of prefer) {
    const b = page.locator('button:visible', { hasText: p }).first();
    if (await b.count()) {
      await b.click().catch(() => {});
      clicked = true;
      break;
    }
  }
  if (clicked) continue;
  const buttons = page.locator('button[data-reply]:visible, main button:visible, form button:visible, div.flex-col > button:visible');
  const n = await buttons.count();
  if (n > 0 && n < 6) {
    await buttons.first().click().catch(() => {});
    continue;
  }
  await page.mouse.click(195, 420);
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
