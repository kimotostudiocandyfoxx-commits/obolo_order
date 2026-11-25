// R18 君の声にする魔法: a song finished → {bati}'s post-song line with the invitation (no price) → 「自分の声にして」 → the
// price question → 「唱えて」 → 「君の声になったよ！」 with the card's 〔元の声｜君の声〕 switch.
// Run with `next start -p 3113` (demo mode) and playwright-core resolvable:
//   node docs/review/r18-voice/shots.mjs docs/review/r18-voice
import { chromium } from 'playwright-core';
const OUT = process.argv[2] ?? '.';
const PORT = process.env.PORT ?? '3113';
const U = '11111111-2222-4333-8444-555555555555';
const T = 'a'.repeat(64);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const fails = [];
const check = (ok, what) => (ok ? console.log('  ok', what) : (fails.push(what), console.log('  FAIL', what)));

async function page() {
  const p = await b.newPage({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 });
  await p.addInitScript(([U, T]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const day = (n) => new Date(Date.now() - n * 86400_000).toISOString();
    const now = day(0);
    const me = {
      id: U, email: 'tester@example.com', handle: 'order_tester', displayName: 'テスト', bio: '', country: 'JP', locale: 'ja',
      subscriptionStatus: 'demo', journeyDay: 9, journeyCompletedAt: day(1), neoForm: null, avatarUrl: null, bati: null, orderedAt: day(9),
      // a registered voice (it sings) and media consent: the invitation may come
      voices: { self: true, bati: false, selfSings: true }, look: null, puniPic: null, butterfly: null, invitedByName: null, invitedByMessage: null, createdAt: day(10),
      birthYear: 2000, mediaOk: true, consent: { version: '2026-11-22.2', at: now, media: true }, story: { 'sys.consent': '1', 'd3.f_d04_bluena': 'true', 'sys.star_tip': '1' },
    };
    localStorage.setItem('obolo.demo.v2', JSON.stringify({ users: { [U]: me }, sessions: { [T]: U }, wallets: { [U]: { mana: 300, lastActivity: now, entries: [] } }, buddy: {}, posts: [], quota: {}, pendingCodes: {}, dachiAt: day(5) }));
    localStorage.setItem('obolo.token', T);
    localStorage.setItem('obolo.atelier.taught', JSON.stringify({ song: 1, art: 1, video: 1, voice: 1, radio: 1 }));
  }, [U, T]);
  await p.goto(`http://localhost:${PORT}/moon/atelier?thread=bati`, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(500);
    const ok = p.locator('button', { hasText: 'わかった' });
    if (await ok.count()) await ok.first().click().catch(() => undefined);
  }
  return p;
}
async function say(p, text) {
  const typed = p.locator('[data-testid="bati-place"] input:not(.sr-only)').first();
  if (!(await typed.isVisible().catch(() => false))) {
    await p.locator('[data-testid="bati-place"] button[aria-label="文字で答える"]').first().click();
    await p.waitForTimeout(300);
  }
  await p.locator('[data-testid="bati-place"] input:not(.sr-only)').first().fill(text);
  await p.locator('[data-testid="bati-place"] button[aria-label="送る"]').first().click();
}
const until = async (p, fn, ms = 30000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn().catch(() => false)) return true;
    await p.waitForTimeout(400);
  }
  return false;
};
const talk = (p) => p.locator('[data-testid="bati-place"]').innerText();

const p = await page();
console.log('a song, then the voice spell');
await say(p, '夏の海の明るい曲を作って');
await until(p, async () => (await talk(p)).includes('このスペルで作る'), 30000);
await p.waitForTimeout(1200);
await say(p, 'OK');
check(await until(p, async () => (await talk(p)).includes('いじりたい'), 60000), 'the song is finished');
// 1. the post-song line, with the invitation (the first finished song) — no price in it
check(await until(p, async () => (await talk(p)).includes('君の声にする魔法も、唱えられるよ。'), 20000), 'Bati invites to the voice spell after the first song');
check(!/君の声にする魔法も[^。]*マナ/.test(await talk(p)), 'no price in the invitation');
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/ipad-1-invite-after-song.png` });

// 2. asked: the mana and the question
await say(p, '自分の声にして');
check(await until(p, async () => /君の声にする魔法は、[\d.]+マナだよ。唱える？/.test(await talk(p)), 15000), 'Bati tells the mana and asks');
await p.waitForTimeout(3000);
await p.screenshot({ path: `${OUT}/ipad-2-price-question.png` });

// 3. yes → cast → done, the card keeps both voices (the switch)
await say(p, '唱えて');
check(await until(p, async () => (await talk(p)).includes('君の声になったよ'), 60000), 'done: 君の声になったよ！');
const thumb = p.locator('[data-testid="work-thumb"]').last();
if (!(await p.locator('[data-testid="voice-toggle"]').count()) && (await thumb.count())) await thumb.click().catch(() => undefined);
check(await until(p, async () => (await p.locator('[data-testid="voice-toggle"]').count()) > 0, 8000), 'the card shows the voice switch');
const own = p.locator('[data-testid="voice-toggle"] [data-voice="own"]').first();
check((await own.getAttribute('aria-pressed').catch(() => null)) === 'true', '君の声 is the one heard');
await p.waitForTimeout(3000);
await p.screenshot({ path: `${OUT}/ipad-3-done-voice-toggle.png` });
await p.close();
console.log(fails.length ? `FAILED: ${fails.join('; ')}` : 'all ok');
await b.close();
process.exit(fails.length ? 1 : 0);
