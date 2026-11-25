// R18 waiting: while a work is being made, the bowl glows divinely and the arcane clock over it counts down.
// Each scene seeds a talk whose card waits for a demo job (djobs), opened as the toast opens it (?job=).
// Run with `next start -p 3118` (demo mode) and playwright-core resolvable:
//   node docs/review/r18-waiting/shots.mjs docs/review/r18-waiting
import { chromium } from 'playwright-core';
const OUT = process.argv[2] ?? '.';
const PORT = process.env.PORT ?? '3118';
const ONLY = process.env.ONLY ?? '';
const U = '11111111-2222-4333-8444-555555555555';
const T = 'a'.repeat(64);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fails = [];
const check = (ok, what) => (ok ? console.log('  ok', what) : (fails.push(what), console.log('  FAIL', what)));
const SIZES = { ipad: { width: 820, height: 1180 }, 390: { width: 390, height: 844 } };

/** jobs: [{ id, kind, what, title, ago (s since it started), seconds, lateBy }] */
async function open(size, jobs, { day = false, reduced = false, slow = 1 } = {}) {
  const p = await b.newPage({ viewport: SIZES[size], deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  // the burst shot: the scene's own timers (the burst's, the rise's: 1.2–2 s) and its animations run `slow` times slower,
  // so the capture lands in the burst (a capture takes ~1 s)
  if (slow > 1)
    await p.addInitScript((k) => {
      const st = window.setTimeout.bind(window);
      window.__slow = (on) => (window.__slowOn = on);
      window.setTimeout = (fn, ms, ...a) => st(fn, window.__slowOn && ms >= 1200 && ms <= 2000 ? ms * k : ms, ...a);
    }, slow);
  await p.addInitScript(([U, T, jobs]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const t = Date.now();
    const ago = (ms) => new Date(t - ms).toISOString();
    const day = (n) => ago(n * 86400_000);
    const me = {
      id: U, email: 'tester@example.com', handle: 'order_tester', displayName: 'テスト', bio: '', country: 'JP', locale: 'ja',
      subscriptionStatus: 'demo', journeyDay: 9, journeyCompletedAt: day(1), neoForm: null, avatarUrl: null, bati: { food: 'うに', name: 'バティ', imageUrl: '/talk/bati/stand.webp' }, orderedAt: day(9),
      voices: { self: false, bati: false }, look: null, puniPic: null, butterfly: null, invitedByName: null, invitedByMessage: null, createdAt: day(10),
      birthYear: 2000, consent: { version: '2026-11-22.2', at: day(0), media: true }, story: { 'sys.consent': '1', 'd3.f_d04_bluena': 'true', 'sys.star_tip': '1' },
    };
    const djobs = {};
    for (const j of jobs) {
      const start = t - j.ago * 1000;
      djobs[j.id] = { owner: U, seconds: j.seconds, lateBy: j.lateBy ?? 0, failTimes: 0, start, attempts: 1, eta: start + j.seconds * 1000, late: false, retrying: false, createdAt: new Date(start).toISOString() };
    }
    localStorage.setItem('obolo.demo.v2', JSON.stringify({ users: { [U]: me }, sessions: { [T]: U }, wallets: { [U]: { mana: 120, lastActivity: day(0), entries: [] } }, buddy: {}, posts: [], quota: {}, pendingCodes: {}, dachiAt: day(5), djobs }));
    localStorage.setItem('obolo.token', T);
    localStorage.setItem('obolo.atelier.taught', JSON.stringify({ song: 1, art: 1, video: 1, voice: 1, radio: 1 }));
    const cards = jobs.map((j) => ({ id: `w-${j.id}`, kind: j.kind, prompt: j.words, status: 'making', title: j.title, job: { id: j.id, long: true } }));
    const msgs = [{ id: 'a0', who: 'bati', text: 'やっほー！' }];
    jobs.forEach((j, i) => {
      msgs.push({ id: `m${i}a`, who: 'me', text: j.words });
      msgs.push({ id: `m${i}b`, who: 'bati', text: 'よし、作るね！　できたころに、このトークに戻ってきてね' });
      msgs.push({ id: `m-w-${j.id}`, who: 'work', work: cards[i] });
    });
    localStorage.setItem('obolo.atelier.talks.v1', JSON.stringify([{ id: 't-now', at: ago(300_000), msgs }]));
    localStorage.setItem('obolo.atelier.jobs.v1', JSON.stringify(jobs.map((j, i) => ({ jobId: j.id, what: j.what, card: cards[i], talkId: 't-now', toast: true, words: j.words, extra: { songTitle: j.title }, since: t - j.ago * 1000 }))));
  }, [U, T, jobs]);
  const url = day ? `/moon/atelier?thread=bati&day=${new Date().toISOString().slice(0, 10)}` : `/moon/atelier?thread=bati&job=${jobs[0].id}`;
  await p.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) {
    const ok = p.locator('button', { hasText: 'わかった' });
    if (await ok.count()) await ok.first().click().catch(() => undefined);
    await p.waitForTimeout(400);
  }
  await p.waitForTimeout(2200);
  return p;
}
const SONG = { id: 'job-song', kind: 'song', what: 'song', title: '夏のうた', words: '夏の海の明るい曲を作って' };
const VIDEO = { id: 'job-video', kind: 'video', what: 'video', title: '夏のうた（MV）', words: '夏のうたのMVを作って' };
const ART = { id: 'job-art', kind: 'art', what: 'art', title: '月の庭', words: '月の庭の絵を描いて' };

const scenes = [
  ['song-30', [{ ...SONG, ago: 60, seconds: 200 }]],
  ['song-90', [{ ...SONG, ago: 180, seconds: 200 }]],
  ['video', [{ ...VIDEO, ago: 120, seconds: 300 }]],
  ['overdue', [{ ...SONG, ago: 130, seconds: 120, lateBy: 600 }]],
  ['two-jobs', [{ ...SONG, ago: 50, seconds: 150 }, { ...ART, ago: 20, seconds: 400 }]],
];
for (const size of ['ipad', '390']) {
  for (const [name, jobs] of scenes) {
    if (ONLY && !name.includes(ONLY)) continue;
    console.log(size, name);
    const p = await open(size, jobs);
    const clock = p.locator('[data-cast-clock]');
    check((await clock.count()) === 1, `${name}: the clock floats over the bowl`);
    check((await p.locator('[data-bowl="divine"]').count()) === 1, `${name}: the bowl glows divinely`);
    const nums = (await p.locator('[data-testid="cast-numerals"]').innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log('   numerals:', nums, '| state:', await clock.getAttribute('data-cast-state'), '| look:', await clock.getAttribute('data-cast-clock'));
    if (name === 'overdue') check(nums.includes('もうすこし'), 'overdue: もうすこし…');
    if (name === 'two-jobs') check((await p.locator('[data-testid="cast-sigil"]').count()) === 1, 'two jobs: one sigil');
    await p.screenshot({ path: `${OUT}/${size}-${name}.png` });
    await p.close();
  }
  // the finish: the clock collapses into a burst, the work rises out of the bowl
  if (!ONLY || 'burst'.includes(ONLY)) {
    console.log(size, 'burst');
    const SLOW = 5;
    const p = await open(size, [{ ...SONG, ago: 10, seconds: 22 }], { slow: SLOW });
    const anim = await p.context().newCDPSession(p);
    await anim.send('Animation.enable');
    await p.evaluate(() => window.__slow(true));
    await anim.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
    if (process.env.DEBUG) await p.evaluate(() => { const t0 = performance.now(); const log = (window.__log = []); const mo = new MutationObserver(() => { const c = document.querySelector('[data-cast-clock]'); const b = document.querySelector('[data-bowl]'); window.__b0 ??= b; const k = `${c?.getAttribute("data-cast-state") ?? "-"} bowl=${b?.getAttribute("data-bowl")} same=${window.__b0 === b} url=${location.search}`; if (log[log.length - 1]?.k !== k) log.push({ k, t: Math.round(performance.now() - t0) }); }); mo.observe(document.body, { subtree: true, childList: true, attributes: true }); });
    const seen = await p.waitForSelector('[data-cast-state="burst"]', { timeout: 20000, state: 'attached' }).then(() => true, () => false);
    check(seen, 'burst: the clock bursts when the song is done');
    const t0 = Date.now();
    await p.waitForTimeout(Number(process.env.BURST_MS ?? 1200));
    // (a direct capture: the usual screenshot waits too long for a one-second burst)
    const cdp = await p.context().newCDPSession(p);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, ...SIZES[size], scale: 2 } });
    (await import('node:fs')).writeFileSync(`${OUT}/${size}-burst.png`, Buffer.from(data, 'base64'));
    console.log('   burst shot after', Date.now() - t0, 'ms');
    await anim.send('Animation.setPlaybackRate', { playbackRate: 1 });
    await p.evaluate(() => window.__slow(false));
    await p.waitForTimeout(9000);
    if (process.env.DEBUG) console.log(await p.evaluate(() => JSON.stringify(window.__log)));
    check((await p.locator('[data-cast-clock]').count()) === 0, 'burst: then the clock is gone');
    await p.close();
  }
  // the past-day replay: a card still being made there too
  if (!ONLY || 'replay'.includes(ONLY)) {
    console.log(size, 'replay');
    const p = await open(size, [{ ...SONG, ago: 90, seconds: 200 }], { day: true });
    check((await p.locator('[data-cast-clock]').count()) === 1, 'replay: the clock in the past day too');
    await p.screenshot({ path: `${OUT}/${size}-replay.png` });
    await p.close();
  }
}
// reduced motion: static glow, numerals still counting
{
  console.log('reduced');
  const p = await open('390', [{ ...SONG, ago: 60, seconds: 200 }], { reduced: true });
  const a = await p.locator('[data-testid="cast-numerals"]').innerText();
  await p.waitForTimeout(2100);
  const c = await p.locator('[data-testid="cast-numerals"]').innerText();
  check(a !== c, `reduced: the numerals still count (${a.replace(/\s+/g, ' ')} → ${c.replace(/\s+/g, ' ')})`);
  await p.close();
}
console.log(fails.length ? `FAILED: ${fails.join('; ')}` : 'all ok');
await b.close();
process.exit(fails.length ? 1 : 0);
