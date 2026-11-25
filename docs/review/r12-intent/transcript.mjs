// R12 intent check: the client's day-2 transcript in the demo Moon Bati chat at 390×844.
import { chromium } from 'playwright-core';
const OUT = process.argv[2];
const day = Number(process.argv[3] ?? 2);
const tag = process.argv[4] ?? `day${day}`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const U = '11111111-2222-4333-8444-555555555555';
const T = 'a'.repeat(64);
await p.addInitScript(([U, T, day]) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const now = new Date().toISOString();
  const me = {
    id: U, email: 'tester@example.com', handle: 'order_tester', displayName: 'テスト', bio: '', country: 'JP', locale: 'ja',
    subscriptionStatus: 'demo', journeyDay: day, journeyCompletedAt: null, neoForm: null, avatarUrl: null, bati: null, orderedAt: null,
    voices: { self: false, bati: false }, look: null, puniPic: null, butterfly: null, invitedByName: 'MIKIE', invitedByMessage: null, createdAt: now,
    birthYear: 2000, consent: { version: '2026-11-22.2', at: now, media: true }, story: { 'sys.consent': '1' },
  };
  localStorage.setItem('obolo.demo.v2', JSON.stringify({ users: { [U]: me }, sessions: { [T]: U }, wallets: { [U]: { mana: 88, lastActivity: now, entries: [] } }, buddy: {}, posts: [], quota: {}, pendingCodes: {} }));
  localStorage.setItem('obolo.token', T);
}, [U, T, day]);
const t0 = Date.now();
await p.goto('http://localhost:3111/moon/atelier', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(2500);
for (let i = 0; i < 4; i++) {
  const ok = p.locator('button', { hasText: 'わかった' });
  if (!(await ok.count())) break;
  await ok.first().click();
  await p.waitForTimeout(600);
}
await p.screenshot({ path: `${OUT}/${tag}-0-open.png` });
const typeBtn = p.locator('button[aria-label="文字で答える"]');
if (await typeBtn.count()) await typeBtn.first().click();
const lines = ['ヤッホー画像を作って欲しいんだけど空飛ぶクジラが光々しく舞い降りるような', '魔法で作って欲しい', '画像を作りたい'];
let k = 1;
for (const l of lines) {
  if (!(await p.locator('form input').count())) await p.locator('button[aria-label="文字で答える"]').first().click();
  const input = p.locator('form input').first();
  await input.fill(l);
  const s = Date.now();
  await input.press('Enter');
  await p.waitForTimeout(3500);
  console.log(`sent ${k} (${Date.now() - s} ms waited)`);
  await p.screenshot({ path: `${OUT}/${tag}-${k}.png` });
  k++;
}
const text = await p.evaluate(() => document.body.innerText);
console.log('---- page text ----');
console.log(text.split('\n').filter((x) => x.trim()).slice(-30).join('\n'));
console.log(`total ${Date.now() - t0} ms`);
await b.close();
