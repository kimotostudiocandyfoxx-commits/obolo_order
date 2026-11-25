// R17 songs: the normal song flow (sung on Runware — fast: the spell, the yes, the song card in ~25 s) and the secret
// spell (a member says its passphrase → {bati}'s small surprise, the talismans glow gold, the confirm shows its mana).
// Run with `next start -p 3113` (demo mode) and playwright-core resolvable:
//   node docs/review/r17-songs/shots.mjs docs/review/r17-songs
// The passphrase is not in this file: PASS="…" node … (the demo knows only its digest).
import { chromium } from 'playwright-core';
const OUT = process.argv[2] ?? '.';
const PORT = process.env.PORT ?? '3113';
const PASS = process.env.PASS ?? '';
const U = '11111111-2222-4333-8444-555555555555';
const T = 'a'.repeat(64);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
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
      voices: { self: false, bati: false }, look: null, puniPic: null, butterfly: null, invitedByName: null, invitedByMessage: null, createdAt: day(10),
      birthYear: 2000, consent: { version: '2026-11-22.2', at: now, media: true }, story: { 'sys.consent': '1', 'd3.f_d04_bluena': 'true', 'sys.star_tip': '1' },
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

// 1. the normal song: the spell (blue 光符), the yes, the song quickly there
{
  console.log('normal song');
  const p = await page();
  await say(p, '夏の海の明るい曲を作って');
  check(await until(p, async () => (await p.locator('[data-floating-spell="hikari"]').count()) > 0 && (await p.locator('[data-testid="spell-mana"]').count()) > 0), 'the song spell floats');
  await until(p, async () => (await p.locator('[data-testid="bati-place"]').innerText()).includes('このスペルで作る'), 20000);
  await p.waitForTimeout(1500);
  check((await p.locator('[data-gold-spell]').count()) === 0, 'not gold');
  check(!(await p.locator('[data-testid="spell-mana"]').innerText()).includes('上級'), 'no secret spell word');
  await p.screenshot({ path: `${OUT}/ipad-1-normal-spell.png` });
  await say(p, 'OK');
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${OUT}/ipad-2-normal-singing.png` });
  check(await until(p, async () => (await p.locator('[data-testid="work-thumb"], [data-testid="work-card"]').filter({ hasNotText: '作っている' }).count()) > 0 && (await p.locator('[data-testid="bati-place"]').innerText()).includes('いじりたい'), 45000), 'the song is there in under a minute');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/ipad-3-normal-song-ready.png` });
  await p.close();
}

// 2. the secret spell: the passphrase → the surprise, gold talismans, its own mana
if (PASS) {
  console.log('secret spell');
  const p = await page();
  await say(p, `${PASS}、夏の海の明るい曲を唱えて`);
  check(await until(p, async () => (await p.locator('[data-testid="bati-place"]').innerText()).includes('その魔法、知ってる')), 'Bati is surprised');
  check(await until(p, async () => (await p.locator('[data-gold-spell]').count()) > 0), 'the talismans glow gold');
  await until(p, async () => (await p.locator('[data-testid="bati-place"]').innerText()).includes('このスペルで作る'), 20000);
  await p.waitForTimeout(1800);
  const mana = await p.locator('[data-testid="spell-mana"]').innerText();
  check(mana.includes('上級魔法・使うマナ'), `the confirm says the secret spell's mana (${mana.replace(/\s+/g, ' ')})`);
  await p.screenshot({ path: `${OUT}/ipad-4-secret-gold-confirm.png` });
  await p.close();
  // a non-member saying it: nothing special
}
console.log(fails.length ? `FAILED: ${fails.join('; ')}` : 'all ok');
await b.close();
process.exit(fails.length ? 1 : 0);
