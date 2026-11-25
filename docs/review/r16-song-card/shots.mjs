// R16 song card: today's {bati} talk opened from the ≡ history (the past-day replay) — a song saved while it was being
// made whose job is now done (opens as the player: ▶, lyrics with labels), one still being made (its count), one failed.
// Run with `next start -p 3111` (demo mode; another port: PORT=…): node docs/review/r16-song-card/shots.mjs docs/review/r16-song-card
import { chromium } from 'playwright-core';
const OUT = process.argv[2] ?? '.';
const U = '11111111-2222-4333-8444-555555555555';
const T = 'a'.repeat(64);
const DAY = new Date().toISOString().slice(0, 10);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 });
await p.addInitScript(([U, T]) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const ago = (ms) => new Date(Date.now() - ms).toISOString();
  const day = (n) => ago(n * 86400_000);
  const now = day(0);
  const me = {
    id: U, email: 'tester@example.com', handle: 'order_tester', displayName: 'テスト', bio: '', country: 'JP', locale: 'ja',
    subscriptionStatus: 'demo', journeyDay: 6, journeyCompletedAt: null, neoForm: null, avatarUrl: null, bati: null, orderedAt: null,
    voices: { self: false, bati: false }, look: null, puniPic: null, butterfly: null, invitedByName: null, invitedByMessage: null, createdAt: day(8),
    birthYear: 2000, consent: { version: '2026-11-22.2', at: now, media: true }, story: { 'sys.consent': '1', 'd3.f_d04_bluena': 'true' },
  };
  const t = Date.now();
  // the slow song asked for ~6 minutes ago is done on the server; another is still being sung (4 minutes)
  const job = (start, seconds, done) => ({ owner: U, seconds, lateBy: 0, failTimes: 0, start, attempts: 1, eta: start + seconds * 1000, late: false, retrying: false, createdAt: new Date(start).toISOString(), ...(done ? { done: true } : {}) });
  const djobs = { 'job-done': job(t - 360_000, 240, true), 'job-run': job(t - 20_000, 260, false) };
  localStorage.setItem('obolo.demo.v2', JSON.stringify({ users: { [U]: me }, sessions: { [T]: U }, wallets: { [U]: { mana: 88, lastActivity: now, entries: [] } }, buddy: {}, posts: [], quota: {}, pendingCodes: {}, dachiAt: day(5), djobs }));
  localStorage.setItem('obolo.token', T);
  const lyrics = {
    title: 'よるのステップ',
    blocks: [
      { section: 'verse', hints: ['quiet'], lines: ['よるのまちを ひとりで', 'あるいてく'] },
      { section: 'chorus', hints: ['euphoric'], lines: ['ステップ ふんで', 'ひかりのほうへ'] },
      { section: 'outro', hints: ['fade'], lines: ['また あした'] },
    ],
  };
  // as the device saved them: the first two while they were being made (no sound yet), the third after it failed
  const song = { id: 'w-song', kind: 'song', prompt: 'よるに歩くときのゆっくりした曲', status: 'making', title: 'よるのステップ', lyrics, job: { id: 'job-done', long: true } };
  const song2 = { id: 'w-song2', kind: 'song', prompt: 'あさのコーヒーの曲', status: 'making', title: 'あさのコーヒー', job: { id: 'job-run', long: true } };
  const song3 = { id: 'w-song3', kind: 'song', prompt: 'あめの日の曲', status: 'failed', title: 'あめのひ', settled: { job: 'job-x', failed: true }, note: 'うまく、できなかった……。つかったマナは、もどしてあるよ' };
  const msg = (id, who, text) => ({ id, who, text });
  localStorage.setItem('obolo.atelier.talks.v1', JSON.stringify([
    { id: 't-today', at: ago(600_000), msgs: [
      msg('a1', 'me', 'よるに歩くときの、ゆっくりした曲を作って'),
      msg('a2', 'bati', 'できたころに、このトークに戻ってきてね'),
      { id: 'm-w-song', who: 'work', work: song },
      msg('a3', 'me', 'あさのコーヒーの曲も'),
      { id: 'm-w-song2', who: 'work', work: song2 },
      msg('a4', 'me', 'あめの日の曲も'),
      { id: 'm-w-song3', who: 'work', work: song3 },
    ] },
  ]));
}, [U, T]);
// each card opened at its message (the day up to it, as Bluena opens a work: ?at=)
const open = async (title, file, at) => {
  await p.goto(`http://localhost:${process.env.PORT ?? 3111}/moon/atelier?thread=bati&day=${DAY}&at=${at}`, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(3500);
  console.log('thumb:', (await p.locator('[data-testid="work-thumb"]').last().innerText()).replace(/\n+/g, ' / '));
  await p.locator('[data-testid="work-thumb"]', { hasText: title }).last().click();
  await p.waitForTimeout(1200);
  const card = p.locator('[data-testid="work-card"]').last();
  console.log(file, '→', (await card.innerText()).replace(/\n+/g, ' / '));
  await p.screenshot({ path: `${OUT}/${file}` });
  await p.locator('button', { hasText: 'とじる' }).last().click();
  await p.waitForTimeout(600);
};
await open('よるのステップ', 'ipad-1-finished-song-player.png', 'm-w-song');
await open('あさのコーヒー', 'ipad-2-making-song.png', 'm-w-song2');
await open('あめのひ', 'ipad-3-failed-song.png', 'm-w-song3');
// the device's copy was updated: the saved talk now has the finished song
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('obolo.atelier.talks.v1'))[0].msgs.filter((m) => m.who === 'work').map((m) => `${m.work.title}:${m.work.status}:${m.work.audio ?? '-'}`));
console.log('saved talk:', saved.join(' , '));
await b.close();
