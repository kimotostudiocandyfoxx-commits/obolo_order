// R16 Bluena: a tap opens the viewer (鑑賞), the kind strip / ★ / search, the song / art / video / book viewers,
// 〔バティといじる〕 → Bati asks 「どういじる？」, the corner player over a ダチ talk, Bati opening a song by words.
// Run with `next start -p 3112` (demo mode) and playwright-core resolvable (e.g. NODE_PATH or a node_modules link):
//   node docs/review/r16-bluena/shots.mjs docs/review/r16-bluena   (checks: tap → viewer, filters, edit → Bati asks, open by words, mini player)
import { chromium } from 'playwright-core';
const OUT = process.argv[2] ?? '.';
const PORT = process.env.PORT ?? '3112';
const U = '11111111-2222-4333-8444-555555555555';
const T = 'a'.repeat(64);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const fails = [];
const check = (ok, what) => (ok ? console.log('  ok', what) : (fails.push(what), console.log('  FAIL', what)));
for (const [w, h, tag] of [[820, 1180, 'ipad'], [390, 844, 'phone']]) {
  console.log(tag);
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.addInitScript(([U, T]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const day = (n) => new Date(Date.now() - n * 86400_000).toISOString();
    const idAt = (n, s) => `${(Date.now() - n * 86400_000).toString(36)}${s}`;
    const now = day(0);
    const me = {
      id: U, email: 'tester@example.com', handle: 'order_tester', displayName: 'テスト', bio: '', country: 'JP', locale: 'ja',
      subscriptionStatus: 'demo', journeyDay: 9, journeyCompletedAt: null, neoForm: null, avatarUrl: null, bati: null, orderedAt: null,
      voices: { self: false, bati: false }, look: null, puniPic: null, butterfly: null, invitedByName: null, invitedByMessage: null, createdAt: day(10),
      birthYear: 2000, consent: { version: '2026-11-22.2', at: now, media: true }, story: { 'sys.consent': '1', 'd3.f_d04_bluena': 'true', 'sys.star_tip': '1' },
    };
    localStorage.setItem('obolo.demo.v2', JSON.stringify({ users: { [U]: me }, sessions: { [T]: U }, wallets: { [U]: { mana: 88, lastActivity: now, entries: [] } }, buddy: {}, posts: [], quota: {}, pendingCodes: {}, dachiAt: day(5) }));
    localStorage.setItem('obolo.token', T);
    const tag = (ja, en, group) => ({ ja, en, group });
    const lyrics = {
      title: '夏の海のうた',
      blocks: [
        { section: 'intro', hints: [], lines: [] },
        { section: 'verse', hints: [], lines: ['波の音が 呼んでいる', 'サンダルのまま 走り出す'] },
        { section: 'pre-chorus', hints: [], lines: ['きらきら光る 水平線'] },
        { section: 'chorus', hints: [], lines: ['夏の海へ いこうよ', 'きみと ふたりで', 'ずっと 忘れない'] },
        { section: 'verse', hints: [], lines: ['夕やけ色の 砂の上', 'ふたりの影が のびていく'] },
        { section: 'chorus', hints: [], lines: ['夏の海へ いこうよ', 'きみと ふたりで'] },
        { section: 'outro', hints: [], lines: [] },
      ],
    };
    const demoSong = (id, title, bpm) => ({ id, title, artist: 'テスト', emoji: '🌊', hue: 200, seconds: 150, preset: { bpm, root: 64, mode: 'major', progression: [0, 4, 5, 3], wave: 'triangle' }, lyrics: ['波の音が 呼んでいる'], genre: 'pop' });
    const song = { id: idAt(1, 'song1'), kind: 'song', prompt: '夏の海の明るい曲', status: 'ready', saved: true, title: '夏の海のうた', audio: 'synth:', ref: { demoSong: demoSong('d-1', '夏の海のうた', 112) }, lyrics, spell: [tag('サマーポップ', 'summer pop', 'genre'), tag('明るい', 'bright', 'mood'), tag('ギター', 'guitar', 'instrument'), tag('女性ボーカル', 'female vocal', 'voice')], tweak: { versions: 3, what: 'テンポを速く', seconds: 150, past: [{ what: undefined }, { what: '2番をカット' }] } };
    const song2 = { id: idAt(3, 'song2'), kind: 'song', prompt: '夜のドライブ', status: 'ready', saved: true, title: '夜のドライブ', audio: 'synth:', ref: { demoSong: demoSong('d-2', '夜のドライブ', 92) } };
    const art = { id: idAt(2, 'art01'), kind: 'art', prompt: '星の木', status: 'ready', saved: true, title: 'ひかる星の木', image: '/onboarding/jupiter-tree.webp', spell: [tag('星の木', 'star tree', 'theme'), tag('夜空', 'night sky', 'light'), tag('水彩', 'watercolor', 'style')] };
    const video = { id: idAt(4, 'vid01'), kind: 'video', prompt: '夏の海のうたのMV', status: 'ready', saved: true, title: '夏の海のうた（MV）', video: '/dj-demo/busan-story.mp4', poster: '/planet-home/bg-jupiter.webp', spell: [tag('海辺', 'seaside', 'theme'), tag('ゆっくり', 'slow', 'camera'), tag('フェード', 'fade', 'transition')] };
    const chapters = [1, 2, 3].map((n) => ({ n, title: ['はじまりの扉', '月のしずく', '星の図書館'][n - 1], text: '夜の図書館には、だれも知らない扉がある。\nその扉をあけると、星の光でできた本が、しずかにならんでいた。\n「ここは、願いがことばになる場所なんだ」と、ちいさな司書は言った。'.repeat(3), createdAt: day(5) }));
    const book = { id: 'book-1', title: '星の図書館', tags: [tag('月の街', 'moon town', 'world'), tag('ちいさな司書', 'little librarian', 'hero'), tag('やさしい', 'gentle', 'mood')], cover: null, chapters, done: false, home: 'pluto', createdAt: day(5), updatedAt: day(5) };
    const novel = { id: idAt(5, 'book1'), kind: 'novel', prompt: '星の図書館', status: 'ready', saved: true, title: '星の図書館', book, ref: {}, spell: book.tags, home: 'pluto' };
    localStorage.setItem('obolo.atelier.shelf.v1', JSON.stringify([song, art, song2, video, novel]));
    localStorage.setItem('obolo.atelier.talks.v1', JSON.stringify([{ id: 't1', at: day(1), msgs: [{ id: 't1-0', who: 'me', text: '夏の海の歌を作って' }, { id: 't1-1', who: 'bati', text: 'いいね！' }] }]));
  }, [U, T]);
  const base = `http://localhost:${PORT}/moon/atelier`;
  await p.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(600);
    const ok = p.locator('button', { hasText: 'わかった' });
    if (await ok.count()) await ok.first().click().catch(() => undefined);
  }
  const device = () => p.locator('[data-testid="bati-place"] [data-testid="bluena-device-button"]').first().click();
  // 1. Bluena with its strip, ★ and search
  await device();
  await p.waitForTimeout(1200);
  const chips = await p.locator('[data-testid="bluena-kinds"] button').allInnerTexts();
  console.log('  kinds:', chips.join(' '));
  check(chips.join(' ') === 'すべて 曲 絵 動画 本', 'strip shows only the kinds there are');
  await p.screenshot({ path: `${OUT}/${tag}-1-bluena-filters.png` });
  await p.locator('[data-testid="bluena-kinds"] button', { hasText: '曲' }).click();
  await p.waitForTimeout(300);
  check((await p.locator('[data-testid="bluena-work"]').count()) === 2, '曲 shows the two songs');
  await p.locator('[data-testid="bluena-search"]').fill('サマー');
  await p.waitForTimeout(300);
  check((await p.locator('[data-testid="bluena-work"]').count()) === 1, 'search by a spell word');
  await p.screenshot({ path: `${OUT}/${tag}-1b-bluena-song-search.png` });
  // 2. a tap opens the viewer (not send)
  let sent = 0;
  await p.exposeFunction('__sent', () => sent++).catch(() => undefined);
  await p.evaluate(() => window.addEventListener('obolo:material', () => window.__sent()));
  await p.locator('[data-testid="bluena-work"]').first().click();
  await p.waitForTimeout(1000);
  check((await p.locator('[data-testid="bluena-view"]').count()) === 1 && sent === 0, 'tap opens the viewer, nothing sent');
  await p.locator('[data-testid="bluena-play"]').click();
  await p.waitForTimeout(2500);
  check((await p.locator('[data-testid="bluena-lyrics"]').count()) === 1, 'song lyrics shown');
  await p.screenshot({ path: `${OUT}/${tag}-2-song-viewer.png` });
  // 6. close: the corner player stays; go to a ダチ talk (KIMORIN) and it is still there
  await p.locator('[data-testid="bluena-view-close"]').click();
  await p.waitForTimeout(400);
  await p.locator('[data-testid="bluena-device"] button[aria-label="とじる"]').last().click();
  await p.waitForTimeout(500);
  check((await p.locator('[data-testid="mini-player"]').count()) === 1, 'mini player after closing');
  await p.goto(`${base}?tab=dachi&dachi=kimorin`, { waitUntil: 'networkidle' }).catch(() => undefined);
  // (a page load starts the page again: the player is put back by playing from the viewer of the Bati chat instead)
  await p.waitForTimeout(1500);
  // 3. art viewer
  await p.goto(base, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  await device();
  await p.waitForTimeout(1000);
  await p.locator('[data-testid="bluena-kinds"] button', { hasText: '絵' }).click();
  await p.locator('[data-testid="bluena-work"]').first().click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/${tag}-3-art-viewer.png` });
  await p.locator('[data-testid="bluena-view-close"]').click();
  // 4. video viewer
  await p.locator('[data-testid="bluena-kinds"] button', { hasText: '動画' }).click();
  await p.locator('[data-testid="bluena-work"]').first().click();
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-testid="bluena-video"] video')?.pause());
  await p.screenshot({ path: `${OUT}/${tag}-4-video-viewer.png` });
  await p.locator('[data-testid="bluena-view-close"]').click();
  // 5. book viewer, then its reader
  await p.locator('[data-testid="bluena-kinds"] button', { hasText: '本' }).click();
  await p.locator('[data-testid="bluena-work"]').first().click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/${tag}-5-book-viewer.png` });
  await p.locator('[data-testid="bluena-read"]').click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/${tag}-5b-book-reader.png` });
  await p.keyboard.press('Escape');
  await p.locator('[data-testid="book-reader"] button[aria-label="とじる"], [data-testid="book-reader"] button:has-text("✕")').first().click().catch(() => undefined);
  await p.waitForTimeout(400);
  await p.locator('[data-testid="bluena-view-close"]').click();
  // 7. 〔バティといじる〕 on the song → Bati asks
  await p.locator('[data-testid="bluena-kinds"] button', { hasText: '曲' }).click();
  await p.locator('[data-testid="bluena-work"]').first().click();
  await p.waitForTimeout(800);
  await p.locator('[data-testid="bluena-edit"]').click();
  await p.waitForTimeout(3500);
  const said = await p.locator('[data-testid="bati-place"]').innerText();
  check(said.includes('どういじる'), 'Bati asks どういじる？');
  await p.screenshot({ path: `${OUT}/${tag}-6-edit-bati-asks.png` });
  // 8. Bati opens a song by words (typed)
  await p.locator('[data-testid="bati-place"] button[aria-label="文字で答える"]').first().click();
  await p.waitForTimeout(300);
  await p.locator('[data-testid="bati-place"] input:not(.sr-only)').first().fill('ブルーナの夜のドライブ流して');
  await p.locator('[data-testid="bati-place"] button[aria-label="送る"]').first().click();
  await p.waitForTimeout(3500);
  check((await p.locator('[data-testid="bluena-view"]').count()) === 1, 'Bati opened the viewer');
  const title = await p.locator('[data-testid="bluena-view"] header b').first().innerText().catch(() => '');
  check(title.includes('夜のドライブ'), `opened the right song (${title})`);
  await p.screenshot({ path: `${OUT}/${tag}-8-bati-opens-song-viewer.png` });
  await p.locator('[data-testid="bluena-view-close"]').click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/${tag}-8b-bati-opens-song-talk.png` });
  // 9. the corner player over a ダチ talk (the tabs keep the page: the song goes on)
  await p.locator('[role="tab"]', { hasText: 'ダチ' }).first().click();
  await p.waitForTimeout(1500);
  const kim = p.locator('button[aria-label*="KIMORIN"]');
  if (await kim.count()) await kim.first().click();
  await p.waitForTimeout(2500);
  check((await p.locator('[data-testid="mini-player"]').count()) === 1, 'mini player over the ダチ talk');
  await p.screenshot({ path: `${OUT}/${tag}-7-mini-player-dachi-talk.png` });
  await p.close();
}
await b.close();
console.log(fails.length ? `FAILS: ${fails.join(' / ')}` : 'all checks ok');
