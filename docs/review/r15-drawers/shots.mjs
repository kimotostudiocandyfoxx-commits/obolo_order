// R15 drawers: {bati}'s ≡ (only {bati}'s talks), the ダチ tab's ≡ (every ダチ), an old {bati} talk in the temple.
// Run with `next start -p 3111` (demo mode): node docs/review/r15-drawers/shots.mjs docs/review/r15-drawers
import { chromium } from 'playwright-core';
const OUT = process.argv[2] ?? '.';
const U = '11111111-2222-4333-8444-555555555555';
const T = 'a'.repeat(64);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h, tag] of [[820, 1180, 'ipad'], [390, 844, 'phone']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.addInitScript(([U, T]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const day = (n) => new Date(Date.now() - n * 86400_000).toISOString();
    const now = day(0);
    // an account well into the journey (day 6), past D04-S005c with no inviter: MIKIE⭐︎DRILL's welcome thread and KIMORIN⭐︎
    const me = {
      id: U, email: 'tester@example.com', handle: 'order_tester', displayName: 'テスト', bio: '', country: 'JP', locale: 'ja',
      subscriptionStatus: 'demo', journeyDay: 6, journeyCompletedAt: null, neoForm: null, avatarUrl: null, bati: null, orderedAt: null,
      voices: { self: false, bati: false }, look: null, puniPic: null, butterfly: null, invitedByName: null, invitedByMessage: null, createdAt: day(8),
      birthYear: 2000, consent: { version: '2026-11-22.2', at: now, media: true }, story: { 'sys.consent': '1', 'd3.f_d04_bluena': 'true' },
    };
    localStorage.setItem('obolo.demo.v2', JSON.stringify({ users: { [U]: me }, sessions: { [T]: U }, wallets: { [U]: { mana: 88, lastActivity: now, entries: [] } }, buddy: {}, posts: [], quota: {}, pendingCodes: {}, dachiAt: day(5) }));
    localStorage.setItem('obolo.token', T);
    const talk = (id, n, lines) => ({ id, at: day(n), msgs: lines.map(([who, text], k) => ({ id: `${id}-${k}`, who, text })) });
    localStorage.setItem('obolo.atelier.talks.v1', JSON.stringify([
      talk('t1', 1, [['me', '夏の海の歌を作って'], ['bati', 'いいね！ 明るい感じにする？']]),
      talk('t2', 3, [['me', '空飛ぶクジラの絵がほしい'], ['bati', 'じゃあ、こういうスペルになるね。']]),
      talk('t3', 5, [['me', 'こんにちは、バティ'], ['bati', 'やっほー！ 今日はなにを作る？']]),
    ]));
  }, [U, T]);
  await p.goto('http://localhost:3111/moon/atelier', { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(2500);
  // the day's OBOLON card (it comes a moment after the greeting)
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(800);
    const ok = p.locator('button', { hasText: 'わかった' });
    if (await ok.count()) await ok.first().click();
  }
  // {bati}'s ≡
  await p.locator('[data-testid="bati-place"] button[aria-label="会話の一覧を開く"]').first().click();
  await p.waitForTimeout(800);
  const bati = await p.locator('aside').first().innerText();
  console.log(tag, "bati ≡:", bati.replace(/\n+/g, ' | '), bati.includes('MIKIE') ? 'MIKIE LISTED (bad)' : 'no MIKIE (ok)');
  await p.screenshot({ path: `${OUT}/${tag}-bati-drawer.png` });
  // an old {bati} talk (5 days ago) opened from it: in the temple
  await p.locator('aside').getByText('こんにちは、バティ').first().click();
  await p.waitForTimeout(1500);
  const bg = await p.evaluate(() => [...document.querySelectorAll('img, [style*="background"]')].map((e) => e.getAttribute('src') ?? e.getAttribute('style') ?? '').filter((s) => /temple|bg-moon/.test(s)));
  console.log(tag, 'old talk place:', bg.join(' , '));
  await p.screenshot({ path: `${OUT}/${tag}-old-bati-talk.png` });
  // the ダチ tab's ≡
  await p.goto('http://localhost:3111/moon/atelier?tab=dachi', { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(2000);
  await p.locator('[data-testid="dachi-history-button"]').first().click();
  await p.waitForTimeout(1200);
  console.log(tag, 'ダチ ≡:', (await p.locator('[data-testid="dachi-history"]').innerText()).replace(/\n+/g, ' | '));
  await p.screenshot({ path: `${OUT}/${tag}-dachi-drawer.png` });
  await p.close();
}
await b.close();
