/**
 * The mic's ways in the web app's demo mode (docs/mic.md), in a phone-sized Chromium with a fake microphone: the
 * バティ talk and the ダチ voice message with the mic allowed / not allowed, a browser with no speech recognition
 * (iPhone Chrome), a recogniser that refuses, one that works, and 〔マイクをためす〕. 390×844 screenshots go to OUT.
 *
 *   pnpm --filter @obolo/web dev -p 3111     (NEXT_PUBLIC_API_URL empty: the demo)
 *   BASE=http://localhost:3111 OUT=shots/mic node apps/web/scripts/mic-e2e.cjs [part of a scenario name]
 *
 * Needs Playwright (NODE_PATH to a global install is fine). Exits 1 when a check fails.
 */
const { chromium } = require('playwright');
const OUT = (process.env.OUT || 'shots/mic').replace(/\/?$/, '/');
require('node:fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:3111';

const UA_IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1';
const UA_IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

/** a signed-in demo member past the first journey (written straight into the demo's localStorage) */
async function seed(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('input', { timeout: 120000 });
  await page.evaluate(() => {
    const KEY = 'obolo.demo.v2';
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') || { users: {}, sessions: {}, wallets: {}, buddy: {}, posts: [], quota: {}, pendingCodes: {} };
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    s.users[id] = {
      id, email: 'mic-test@example.com', handle: 'order_mic', displayName: 'ネオ', bio: '', country: 'JP', locale: 'ja', subscriptionStatus: 'demo',
      journeyDay: 9, journeyCompletedAt: null, neoForm: null, avatarUrl: null, bati: null, orderedAt: now, voices: { self: false, bati: false }, look: null,
      puniPic: null, butterfly: null, invitedByName: 'MIKIE⭐︎DRILL', invitedByMessage: null, createdAt: now,
      consent: { version: '2026-11-22.2', at: now, media: true }, birthYear: 2000, mediaOk: true, story: {},
    };
    s.wallets[id] = { mana: 500, lastActivity: now, entries: [] };
    const token = 'tok' + id.replace(/-/g, '');
    s.sessions[token] = id;
    localStorage.setItem(KEY, JSON.stringify(s));
    localStorage.setItem('obolo.token', token);
    localStorage.setItem('obolo.consent', '2026-11-22.2');
    localStorage.setItem('obolo.consent.year', '2000');
  });
}

/**
 * kind: 'granted' (fake mic with a tone), 'denied' (no permission), 'nospeech' (granted, no recogniser)
 * ua: the user agent to wear
 */
async function open(kind, ua, extraInit) {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, userAgent: ua, permissions: kind === 'denied' ? [] : ['microphone'] });
  if (kind === 'denied') {
    // a context without the permission: getUserMedia rejects as on a phone that said no
    await ctx.addInitScript(() => {
      const md = navigator.mediaDevices;
      if (md) md.getUserMedia = () => Promise.reject(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));
    });
  }
  if (kind === 'nospeech' || /CriOS|FxiOS/.test(ua)) {
    await ctx.addInitScript(() => {
      try { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; } catch {}
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
    });
  }
  if (extraInit) await ctx.addInitScript(extraInit);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  return { browser, ctx, page, errors };
}

const text = (page) => page.evaluate(() => document.body.innerText);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const only = process.argv[2];
const run = async (name, fn) => {
  if (only && !name.includes(only)) return;
  console.log(`\n## ${name}`);
  try {
    await fn();
  } catch (e) {
    check(`${name}: ran to the end`, false, String(e).slice(0, 400));
  }
};
const goto = async (page, path, sel) => {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector(sel, { timeout: 120000 });
  await page.waitForTimeout(1200);
};
const diag = (page) => page.evaluate(() => window.__micDiag || []);

/** a recogniser that refuses, as a browser without the speech service does */
const REFUSING_RECOGNISER = () => {
  class R {
    start() {
      setTimeout(() => this.onerror && this.onerror({ error: 'service-not-allowed' }), 120);
      setTimeout(() => this.onend && this.onend(), 160);
    }
    stop() {}
    abort() {}
  }
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: R, configurable: true });
  Object.defineProperty(window, 'SpeechRecognition', { value: R, configurable: true });
};
/** a recogniser that hears, as Chrome on Android / Safari do */
const WORKING_RECOGNISER = () => {
  class R {
    start() {
      window.__recStarts = (window.__recStarts || 0) + 1;
      setTimeout(() => this.onspeechstart && this.onspeechstart(), 300);
      setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'きょうは' } }] }), 500);
      setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'きょうはいい天気' } }] }), 900);
    }
    stop() {
      setTimeout(() => this.onend && this.onend(), 50);
    }
    abort() {}
  }
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: R, configurable: true });
  Object.defineProperty(window, 'SpeechRecognition', { value: R, configurable: true });
};

(async () => {
  /* ───────── バティ chat (the Moon): iPhone Chrome, the mic allowed ───────── */
  await run('bati chat / iPhone Chrome / allowed', async () => {
    const { browser, page, errors } = await open('granted', UA_IOS_CHROME);
    await seed(page);
    await goto(page, '/moon', '[data-testid=talk-mic]');
    check('no speech recognition on this browser (as on iPhone Chrome)', await page.evaluate(() => !window.webkitSpeechRecognition && !window.SpeechRecognition));
    await page.click('[data-testid=talk-mic]');
    await page.waitForSelector('[data-testid=mic-phase]', { timeout: 8000 });
    const engine = await page.getAttribute('[data-testid=mic-phase]', 'data-engine');
    check('the mic listens with the recorder (not the keyboard, not silence)', engine === 'record', `engine=${engine}`);
    check('the keyboard did not open by itself', (await page.locator('form input[placeholder]').count()) === 0);
    check('a loudness ring shows around the mic', (await page.locator('[data-testid=mic-ring]').count()) === 1);
    // the fake microphone beeps: the phase turns to "hearing"
    const heard = await page.waitForSelector('[data-testid=mic-phase][data-phase=hearing]', { timeout: 6000 }).then(() => true, () => false);
    check('it shows that it hears a sound (聞こえているよ)', heard, await page.locator('[data-testid=mic-phase]').innerText().catch(() => ''));
    const ring = await page.locator('[data-testid=mic-ring]').evaluate((e) => e.style.transform).catch(() => '');
    await page.screenshot({ path: OUT + '01-bati-listening-iphone-chrome.png' });
    console.log('   ring transform:', ring);
    // tap again: the take is turned into words
    if (await page.locator('[data-testid=mic-phase]').count()) await page.click('[data-testid=talk-mic]');
    await page.waitForSelector('text=（デモ）こんにちは', { timeout: 8000 }).then(() => check('the words come back and wait with 〔送る〕', true), () => check('the words come back and wait with 〔送る〕', false));
    check('〔送る〕 is there', (await page.locator('button:has-text("送る")').count()) > 0);
    await page.screenshot({ path: OUT + '02-bati-heard-iphone-chrome.png' });
    const mime = await page.evaluate(() => (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'));
    console.log('   this Chromium records:', mime, '(an iPhone records audio/mp4)');
    await page.locator('button:has-text("送る")').first().click();
    await page.waitForTimeout(2500);
    check('sent: it is in the talk', (await text(page)).includes('（デモ）こんにちは'));
    check('no mic failure was reported', (await diag(page)).length === 0, JSON.stringify(await diag(page)));
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
  });

  /* ───────── バティ chat: the mic not allowed ───────── */
  await run('bati chat / iPhone Chrome / denied', async () => {
    const { browser, page } = await open('denied', UA_IOS_CHROME);
    await seed(page);
    await goto(page, '/moon', '[data-testid=talk-mic]');
    await page.click('[data-testid=talk-mic]');
    await page.waitForSelector('[data-testid=mic-notice]', { timeout: 8000 });
    const notice = await page.locator('[data-testid=mic-notice]').innerText();
    check('the line says the mic is not allowed and names Chrome (not Safari)', notice.includes('許可されていない') && notice.includes('「Chrome」') && !notice.includes('Safari'), notice.replace(/\n/g, ' '));
    check('〔マイクをためす〕 is beside the line', (await page.locator('[data-testid=mic-notice-check]').count()) === 1);
    check('the keyboard did not open by itself', (await page.locator('form input[placeholder]').count()) === 0);
    await page.screenshot({ path: OUT + '03-bati-denied-iphone-chrome.png' });
    const d = await diag(page);
    check('the failure was reported with the browser family only', d.length === 1 && d[0].fault === 'denied' && d[0].os === 'ios' && d[0].browser === 'chrome' && d[0].path === 'bati' && d[0].name === 'NotAllowedError' && !('userAgent' in d[0]), JSON.stringify(d));
    await page.click('[data-testid=mic-notice-check]');
    await page.waitForSelector('[data-testid=mic-check]');
    await page.click('[data-testid=mic-check-run]');
    await page.waitForSelector('[data-testid=mic-check-result]', { timeout: 8000 });
    const res = await page.locator('[data-testid=mic-check-result]').innerText();
    check('the mic check says it cannot be used', (await page.getAttribute('[data-testid=mic-check-result]', 'data-ok')) === '0' && res.includes('マイクが使えないよ'), res.replace(/\n/g, ' '));
    const steps = await page.locator('[data-testid=mic-check-steps]').innerText();
    check('and shows the steps for Chrome on iPhone', steps.includes('Chrome') && steps.includes('設定'), steps.replace(/\n/g, ' / '));
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + '04-mic-check-denied-iphone-chrome.png' });
    await browser.close();
  });

  /* ───────── the mic check from the settings ───────── */
  await run('mic check / settings / allowed', async () => {
    const { browser, page, errors } = await open('granted', UA_IOS_CHROME);
    await seed(page);
    await goto(page, '/settings', '[data-testid=settings-mic]');
    await page.locator('[data-testid=settings-mic]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: OUT + '05-settings-mic-row.png' });
    await page.click('[data-testid=open-mic-check]');
    await page.waitForSelector('[data-testid=mic-check]');
    check('it names the browser', (await page.locator('[data-testid=mic-check-env]').innerText()).includes('Chrome'), await page.locator('[data-testid=mic-check-env]').innerText());
    check('it says how the words are heard here (recorded, then made into words)', (await page.locator('[data-testid=mic-check-engine]').innerText()).includes('録音'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: OUT + '06-mic-check-open.png' });
    await page.click('[data-testid=mic-check-run]');
    // the live bar moves while the fake mic beeps
    let top = 0;
    for (let k = 0; k < 25; k++) {
      await page.waitForTimeout(80);
      const v = Number(await page.getAttribute('[data-testid=mic-check-level]', 'aria-valuenow').catch(() => 0));
      if (v > top) {
        top = v;
        if (v > 8) await page.screenshot({ path: OUT + '07-mic-check-listening.png' });
      }
      if (await page.locator('[data-testid=mic-check-result]').count()) break;
    }
    check('the loudness bar moves while it listens', top > 3, `peak ${top}%`);
    await page.waitForSelector('[data-testid=mic-check-result]', { timeout: 9000 });
    const res = await page.locator('[data-testid=mic-check-result]').innerText();
    check('the result in words: 聞こえているよ', res.includes('聞こえているよ'), res.replace(/\n/g, ' '));
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + '08-mic-check-ok.png' });
    const live = await page.evaluate(() => navigator.mediaDevices.enumerateDevices().then(() => true));
    check('no page errors', errors.length === 0 && live, errors.join(' | '));
    await browser.close();
  });

  /* ───────── the Moon's own settings sheet ───────── */
  await run('mic check / moon settings', async () => {
    const { browser, page } = await open('granted', UA_IOS_CHROME);
    await seed(page);
    await goto(page, '/moon', '[data-testid=talk-mic]');
    const opener = page.locator('button[aria-label*="一覧"], button[aria-label*="リスト"], button[aria-label*="メニュー"]').first();
    if (await opener.count()) await opener.click();
    const gear = page.locator('button:has-text("設定")').first();
    const found = await gear.waitFor({ timeout: 4000 }).then(() => true, () => false);
    if (found) {
      await gear.click();
      await page.waitForSelector('[data-testid=open-mic-check]', { timeout: 5000 });
      check('〔マイクをためす〕 is in the Moon talk’s settings', true);
      await page.locator('[data-testid=open-mic-check]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: OUT + '09-moon-settings-mic-row.png' });
    } else check('〔マイクをためす〕 is in the Moon talk’s settings', false, 'the drawer button was not found');
    await browser.close();
  });

  /* ───────── a browser with no recogniser at all (the task's addInitScript delete) ───────── */
  await run('bati chat / no SpeechRecognition / allowed', async () => {
    const { browser, page } = await open('nospeech', UA_ANDROID);
    await seed(page);
    await goto(page, '/moon', '[data-testid=talk-mic]');
    await page.click('[data-testid=talk-mic]');
    await page.waitForSelector('[data-testid=mic-phase]', { timeout: 8000 });
    check('falls back to record + words', (await page.getAttribute('[data-testid=mic-phase]', 'data-engine')) === 'record');
    await page.waitForTimeout(1500);
    if (await page.locator('[data-testid=mic-phase]').count()) await page.click('[data-testid=talk-mic]');
    const ok = await page.waitForSelector('text=（デモ）こんにちは', { timeout: 8000 }).then(() => true, () => false);
    check('the words come back', ok);
    await browser.close();
  });

  /* ───────── a recogniser that refuses (service-not-allowed): the same tap goes on with the recorder ───────── */
  await run('bati chat / recogniser refuses / allowed', async () => {
    const { browser, page } = await open('granted', UA_ANDROID, REFUSING_RECOGNISER);
    await seed(page);
    await goto(page, '/moon', '[data-testid=talk-mic]');
    await page.click('[data-testid=talk-mic]');
    await page.waitForSelector('[data-testid=mic-phase][data-engine=record]', { timeout: 8000 }).then(() => check('one tap: the recogniser refused and the recorder took over', true), () => check('one tap: the recogniser refused and the recorder took over', false));
    check('no notice about a keyboard setting', !(await text(page)).includes('音声入力'));
    await page.waitForTimeout(1500);
    if (await page.locator('[data-testid=mic-phase]').count()) await page.click('[data-testid=talk-mic]');
    const ok = await page.waitForSelector('text=（デモ）こんにちは', { timeout: 8000 }).then(() => true, () => false);
    check('the words come back', ok);
    const d = await diag(page);
    check('the fall back was reported (fallback / service-not-allowed)', d.some((x) => x.fault === 'fallback' && x.name === 'service-not-allowed' && x.engine === 'speech'), JSON.stringify(d));
    await browser.close();
  });

  /* ───────── a recogniser that works (Chrome on Android / Safari) is still used ───────── */
  await run('bati chat / recogniser works', async () => {
    const { browser, page } = await open('granted', UA_ANDROID, WORKING_RECOGNISER);
    await seed(page);
    await goto(page, '/moon', '[data-testid=talk-mic]');
    await page.click('[data-testid=talk-mic]');
    await page.waitForSelector('[data-testid=mic-phase][data-engine=speech]', { timeout: 8000 }).then(() => check('the browser’s own recogniser is used', true), () => check('the browser’s own recogniser is used', false));
    await page.waitForSelector('[data-testid=mic-phase][data-phase=hearing]', { timeout: 5000 }).then(() => check('it shows that it hears', true), () => check('it shows that it hears', false));
    await page.waitForSelector('text=きょうはいい天気', { timeout: 5000 });
    await page.click('[data-testid=talk-mic]');
    await page.waitForSelector('button:has-text("送る")', { timeout: 5000 });
    check('the words wait with 〔送る〕', (await text(page)).includes('きょうはいい天気'));
    await browser.close();
  });

  /* ───────── ダチ chat: the held voice message ───────── */
  const toDachi = async (page) => {
    await goto(page, '/moon/atelier', '[data-testid=moon-tabs]');
    await page.locator('[data-testid=moon-tabs] button').nth(0).click();
    await page.waitForTimeout(1500);
    if (!(await page.locator('[data-testid=hold-mic]').count())) {
      // the list of ダチ: open the first talk
      const first = page.locator('button[aria-label*="と話す"]').last();
      if (await first.count()) await first.click();
    }
    await page.waitForSelector('[data-testid=hold-mic]', { timeout: 15000 });
    await page.waitForTimeout(800);
  };
  const hold = async (page, ms) => {
    const box = await page.locator('[data-testid=hold-mic]').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(ms);
  };

  await run('dachi chat / iPhone Chrome / allowed', async () => {
    const { browser, page, errors } = await open('granted', UA_IOS_CHROME);
    await seed(page);
    await toDachi(page);
    await hold(page, 1800);
    const note = await page.locator('[data-testid=holdmic-note]').innerText().catch(() => '');
    check('while held it says it is recording', note.includes('録音中'), note);
    check('a loudness ring shows around the mic', (await page.locator('[data-testid=mic-ring]').count()) >= 1);
    const t1 = await page.locator('[data-testid=mic-ring]').first().evaluate((e) => e.style.transform);
    await page.screenshot({ path: OUT + '10-dachi-recording-iphone-chrome.png' });
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForSelector('button:has-text("けす")', { timeout: 6000 }).then(() => check('released: the take can be heard back, sent or thrown away', true), () => check('released: the take can be heard back, sent or thrown away', false));
    console.log('   ring transform while recording:', t1);
    await page.screenshot({ path: OUT + '11-dachi-take-iphone-chrome.png' });
    const before = (await text(page)).length;
    await page.locator('button[aria-label="送る"]').first().click();
    await page.waitForTimeout(3000);
    check('sent: the mic is back for the next one', (await page.locator('[data-testid=hold-mic]').count()) === 1, `text ${before} → ${(await text(page)).length}`);
    check('no mic failure was reported', (await diag(page)).length === 0, JSON.stringify(await diag(page)));
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
  });

  await run('dachi chat / iPhone Chrome / denied', async () => {
    const { browser, page } = await open('denied', UA_IOS_CHROME);
    await seed(page);
    await toDachi(page);
    await hold(page, 900);
    await page.mouse.up();
    await page.waitForSelector('[data-testid=mic-notice]', { timeout: 8000 });
    const notice = await page.locator('[data-testid=mic-notice]').innerText();
    check('the line says the mic is not allowed and names Chrome (it used to say Safari)', notice.includes('許可されていない') && notice.includes('「Chrome」') && !notice.includes('Safari'), notice.replace(/\n/g, ' '));
    check('〔マイクをためす〕 is beside the line', (await page.locator('[data-testid=mic-notice-check]').count()) === 1);
    await page.screenshot({ path: OUT + '12-dachi-denied-iphone-chrome.png' });
    const d = await diag(page);
    check('reported as dachi-voice / denied', d.some((x) => x.path === 'dachi-voice' && x.fault === 'denied'), JSON.stringify(d));
    await browser.close();
  });

  await run('dachi chat / Android Chrome / denied', async () => {
    const { browser, page } = await open('denied', UA_ANDROID);
    await seed(page);
    await toDachi(page);
    await hold(page, 900);
    await page.mouse.up();
    await page.waitForSelector('[data-testid=mic-notice]', { timeout: 8000 });
    const notice = await page.locator('[data-testid=mic-notice]').innerText();
    check('on Android the line points at the address bar’s 権限, not at Safari', notice.includes('権限') && !notice.includes('Safari'), notice.replace(/\n/g, ' '));
    await browser.close();
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})();
