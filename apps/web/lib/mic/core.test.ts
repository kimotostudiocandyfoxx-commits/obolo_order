import { describe, expect, it } from 'vitest';
import {
  AUTO_STOP,
  MAX_QUICK_ENDS,
  SILENT_PEAK,
  afterEmptyTake,
  allowSteps,
  autoStop,
  blobType,
  checkVerdict,
  envLabel,
  faultOfApi,
  faultOfError,
  levelOf,
  micAdvice,
  micEnv,
  pickEngine,
  pickMime,
  reportGate,
  restartPlan,
  speechErrorAction,
  speechUsable,
  voiceGate,
  type MicEnv,
  type MicFault,
} from './core';

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  iosFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15',
  iosEdge: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.0.2903.68 Mobile/15E148 Safari/605.1.15',
  iosLine: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.19.0',
  iosInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 359.0.0.28.83 (iPhone15,2; iOS 18_1; ja_JP; ja; scale=3.00; 1179x2556; 668297846)',
  iosWebview: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidWebview: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',
  androidLine: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 Line/14.19.1/IAB',
  androidTikTok: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 trill_370005 BytedanceWebview/d8a21c6',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921Q) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  desktopFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
};
const env = (k: keyof typeof UA, hints = {}) => micEnv(UA[k], hints);

describe('which phone and browser', () => {
  it('tells Safari from the other browsers on iPhone (they are all WebKit, but only Safari has the recogniser)', () => {
    expect(env('iosSafari')).toEqual({ os: 'ios', browser: 'safari', inApp: false, standalone: false });
    expect(env('iosChrome')).toMatchObject({ os: 'ios', browser: 'chrome', inApp: false });
    expect(env('iosFirefox')).toMatchObject({ os: 'ios', browser: 'firefox', inApp: false });
    expect(env('iosEdge')).toMatchObject({ os: 'ios', browser: 'edge', inApp: false });
  });
  it('knows the in-app browsers', () => {
    expect(env('iosLine')).toMatchObject({ os: 'ios', browser: 'line', inApp: true });
    expect(env('iosInstagram')).toMatchObject({ os: 'ios', browser: 'instagram', inApp: true });
    expect(env('iosWebview')).toMatchObject({ os: 'ios', browser: 'webview', inApp: true });
    expect(env('androidWebview')).toMatchObject({ os: 'android', browser: 'webview', inApp: true });
    expect(env('androidLine')).toMatchObject({ os: 'android', browser: 'line', inApp: true });
    expect(env('androidTikTok')).toMatchObject({ os: 'android', browser: 'tiktok', inApp: true });
  });
  it('the home-screen app on iPhone is Safari itself, not a web view', () => {
    expect(env('iosWebview', { standalone: true })).toEqual({ os: 'ios', browser: 'safari', inApp: false, standalone: true });
  });
  it('an iPad says "Macintosh": the touch screen gives it away', () => {
    expect(env('ipad', { maxTouchPoints: 5 })).toMatchObject({ os: 'ios', browser: 'safari' });
    expect(env('ipad', { maxTouchPoints: 0 })).toMatchObject({ os: 'other', browser: 'safari' });
  });
  it('Android and the desktop', () => {
    expect(env('androidChrome')).toMatchObject({ os: 'android', browser: 'chrome', inApp: false });
    expect(env('androidFirefox')).toMatchObject({ os: 'android', browser: 'firefox' });
    expect(env('androidSamsung')).toMatchObject({ os: 'android', browser: 'samsung' });
    expect(env('desktopChrome')).toMatchObject({ os: 'other', browser: 'chrome' });
    expect(env('desktopFirefox')).toMatchObject({ os: 'other', browser: 'firefox' });
  });
  it('a label for the mic check', () => {
    expect(envLabel(env('iosChrome'))).toBe('iPhone / iPadのChrome');
    expect(envLabel(env('androidLine'))).toBe('AndroidのLINE');
  });
});

describe('which engine hears the words', () => {
  const both = { recognizer: true, recorder: true };
  it('iPhone Chrome / Firefox / Edge: never the recogniser, even when the object is there — the recorder', () => {
    for (const k of ['iosChrome', 'iosFirefox', 'iosEdge'] as const) {
      expect(speechUsable(env(k), true)).toBe(false);
      expect(pickEngine(env(k), both)).toBe('record');
    }
  });
  it('in-app browsers: the recorder', () => {
    for (const k of ['iosLine', 'iosInstagram', 'iosWebview', 'androidWebview', 'androidLine', 'androidTikTok'] as const) expect(pickEngine(env(k), both)).toBe('record');
  });
  it('Safari on iPhone, the home-screen app, Chrome on Android and the desktop: the recogniser', () => {
    expect(pickEngine(env('iosSafari'), both)).toBe('speech');
    expect(pickEngine(env('iosWebview', { standalone: true }), both)).toBe('speech');
    expect(pickEngine(env('androidChrome'), both)).toBe('speech');
    expect(pickEngine(env('desktopChrome'), both)).toBe('speech');
  });
  it('no recogniser (Firefox): the recorder; neither: no mic', () => {
    expect(pickEngine(env('desktopFirefox'), { recognizer: false, recorder: true })).toBe('record');
    expect(pickEngine(env('desktopFirefox'), { recognizer: false, recorder: false })).toBeNull();
    expect(pickEngine(env('iosChrome'), { recognizer: true, recorder: false })).toBeNull();
  });
  it('a recogniser that failed before on this phone: the recorder from then on (or the recogniser again when there is nothing else)', () => {
    expect(pickEngine(env('iosSafari'), both, true)).toBe('record');
    expect(pickEngine(env('iosSafari'), { recognizer: true, recorder: false }, true)).toBe('speech');
  });
  it('a recogniser error goes on with the recorder; a pause or our own abort is nothing', () => {
    for (const c of ['service-not-allowed', 'not-allowed', 'audio-capture', 'network', 'language-not-supported', 'start-failed']) expect(speechErrorAction(c)).toBe('fallback');
    expect(speechErrorAction('no-speech')).toBe('ignore');
    expect(speechErrorAction('aborted')).toBe('ignore');
  });
  it('two takes without a word: the recogniser is given up', () => {
    expect(afterEmptyTake(1)).toBe('stay');
    expect(afterEmptyTake(2)).toBe('fallback');
  });
});

describe('restarting the recogniser (iOS ends it after every pause)', () => {
  it('starts again while the member still wants to talk', () => {
    expect(restartPlan({ want: true, quickEnds: 0, ranMs: 4000, hadError: false })).toEqual({ restart: true, quickEnds: 0 });
  });
  it('not after a stop, not after an error', () => {
    expect(restartPlan({ want: false, quickEnds: 0, ranMs: 4000, hadError: false }).restart).toBe(false);
    expect(restartPlan({ want: true, quickEnds: 0, ranMs: 4000, hadError: true }).restart).toBe(false);
  });
  it('a recogniser that ends at once again and again is not started for ever', () => {
    let q = 0;
    const seen: boolean[] = [];
    for (let k = 0; k < MAX_QUICK_ENDS; k++) {
      const p = restartPlan({ want: true, quickEnds: q, ranMs: 50, hadError: false });
      q = p.quickEnds;
      seen.push(p.restart);
    }
    expect(seen).toEqual([true, true, false]);
    // a long run in between clears the count
    expect(restartPlan({ want: true, quickEnds: 2, ranMs: 5000, hadError: false })).toEqual({ restart: true, quickEnds: 0 });
  });
});

describe('the recording container', () => {
  it('iPhone: audio/mp4 (WebKit records no webm)', () => {
    expect(pickMime((t) => t === 'audio/mp4')).toBe('audio/mp4');
  });
  it('Chrome on Android: webm with opus; Firefox: the same or ogg', () => {
    expect(pickMime((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickMime((t) => t === 'audio/ogg;codecs=opus')).toBe('audio/ogg;codecs=opus');
  });
  it('nothing known or no way to ask: the browser chooses; a check that throws is a no', () => {
    expect(pickMime(undefined)).toBeUndefined();
    expect(pickMime(() => false)).toBeUndefined();
    expect(
      pickMime((t) => {
        if (t === 'audio/mp4') throw new Error('x');
        return t === 'audio/webm';
      }),
    ).toBe('audio/webm');
  });
  it('the upload type is the plain one the API takes', () => {
    expect(blobType('audio/mp4;codecs=mp4a.40.2', 'audio/mp4')).toBe('audio/mp4');
    expect(blobType('audio/webm;codecs=opus', undefined)).toBe('audio/webm');
    expect(blobType('', 'audio/webm;codecs=opus')).toBe('audio/webm');
    expect(blobType('', undefined, env('iosChrome'))).toBe('audio/mp4');
    expect(blobType('', undefined, env('androidChrome'))).toBe('audio/webm');
  });
});

describe('what went wrong', () => {
  const err = (name: string, message = '') => Object.assign(new Error(message), { name });
  it('names the browser errors', () => {
    expect(faultOfError(err('NotAllowedError'))).toBe('denied');
    expect(faultOfError(err('PermissionDeniedError'))).toBe('denied');
    expect(faultOfError(err('SecurityError'))).toBe('denied');
    expect(faultOfError(err('NotFoundError'))).toBe('no-device');
    expect(faultOfError(err('OverconstrainedError'))).toBe('no-device');
    expect(faultOfError(err('NotReadableError'))).toBe('busy');
    expect(faultOfError(err('AbortError'))).toBe('busy');
    expect(faultOfError(err('NotSupportedError'))).toBe('unsupported');
    expect(faultOfError(new Error('unsupported'))).toBe('unsupported');
    expect(faultOfError(err('Weird'))).toBe('failed');
    expect(faultOfError(null)).toBe('failed');
  });
  it('names the API answers', () => {
    expect(faultOfApi({ status: 0, code: 'NETWORK' })).toBe('network');
    expect(faultOfApi({ status: 503, code: 'STT_OFF' })).toBe('stt');
    expect(faultOfApi({ status: 502, code: 'STT_FAILED' })).toBe('stt');
    expect(faultOfApi({ status: 401, code: 'UNAUTHORIZED' })).toBe('stt');
    expect(faultOfApi({ status: 422, code: 'BAD_AUDIO' })).toBe('failed');
    expect(faultOfApi(new Error('x'))).toBe('network');
  });
});

describe('the line that says what to do', () => {
  const all: MicFault[] = ['denied', 'no-device', 'busy', 'unsupported', 'silent', 'empty', 'stt', 'network', 'failed'];
  const envs: MicEnv[] = [env('iosSafari'), env('iosChrome'), env('iosLine'), env('androidChrome'), env('androidLine'), env('desktopChrome'), env('iosWebview', { standalone: true })];
  it('every fault has a short line on every phone, with no emoji', () => {
    for (const e of envs)
      for (const f of all) {
        const a = micAdvice(f, e);
        expect(a.text.length).toBeGreaterThan(8);
        expect(a.text.length).toBeLessThanOrEqual(70);
        expect(a.text).not.toMatch(/\p{Extended_Pictographic}/u);
      }
  });
  it('not allowed: the phone’s own settings for THIS browser (it used to say Safari everywhere)', () => {
    expect(micAdvice('denied', env('iosSafari')).text).toContain('「Safari」');
    expect(micAdvice('denied', env('iosChrome')).text).toContain('「Chrome」');
    expect(micAdvice('denied', env('iosChrome')).text).not.toContain('Safari');
    expect(micAdvice('denied', env('iosFirefox')).text).toContain('「Firefox」');
    expect(micAdvice('denied', env('androidChrome')).text).toContain('権限');
    expect(micAdvice('denied', env('androidChrome')).text).not.toContain('Safari');
  });
  it('an in-app browser: open it in Safari (iPhone) / Chrome (Android)', () => {
    expect(micAdvice('denied', env('iosLine')).text).toContain('Safariで開く');
    expect(micAdvice('unsupported', env('iosInstagram')).text).toContain('Safariで開く');
    expect(micAdvice('denied', env('androidLine')).text).toContain('Chromeで開く');
  });
  it('the other faults say their own thing', () => {
    expect(micAdvice('no-device', env('iosSafari')).text).toContain('見つからない');
    expect(micAdvice('busy', env('iosSafari')).text).toContain('ほかのアプリ');
    expect(micAdvice('silent', env('iosSafari')).text).toContain('声が入っていなかった');
    expect(micAdvice('stt', env('iosChrome')).action).toBe('keys');
    expect(micAdvice('empty', env('iosChrome')).action).toBe('retry');
    expect(micAdvice('denied', env('iosChrome')).action).toBe('check');
  });
  it('the steps to allow the mic name this browser', () => {
    expect(allowSteps(env('iosChrome')).join(' ')).toContain('Chrome');
    expect(allowSteps(env('iosSafari')).join(' ')).toContain('Safari');
    expect(allowSteps(env('androidChrome')).join(' ')).toContain('権限');
    expect(allowSteps(env('iosLine')).join(' ')).toContain('Safariで開く');
  });
});

describe('loudness', () => {
  it('silence is 0, a quiet voice is clearly over the silent line, loud is capped at 1', () => {
    expect(levelOf(new Float32Array(512))).toBe(0);
    const quiet = Float32Array.from({ length: 512 }, (_, i) => 0.02 * Math.sin(i / 3));
    expect(levelOf(quiet)).toBeGreaterThan(SILENT_PEAK * 5);
    const loud = Float32Array.from({ length: 512 }, (_, i) => Math.sin(i / 3));
    expect(levelOf(loud)).toBe(1);
  });
  it('the gate follows the room: a quiet phone mic is still heard over its own floor', () => {
    const g = voiceGate();
    let t = 0;
    for (let k = 0; k < 20; k++) expect(g.feed(0.01, (t += 60))).toBe(false);
    expect(g.spoke).toBe(false);
    // a quiet voice: 0.06 where the room is 0.01
    expect(g.feed(0.06, (t += 60))).toBe(true);
    expect(g.spoke).toBe(true);
    for (let k = 0; k < 10; k++) g.feed(0.01, (t += 60));
    expect(g.quietFor(t)).toBe(600);
    expect(g.peak).toBeCloseTo(0.06);
  });
  it('a noisy room does not count as a voice by itself', () => {
    const g = voiceGate();
    let t = 0;
    let on = true;
    // the floor comes up to the room within a few seconds: the hum is then no voice
    for (let k = 0; k < 60; k++) on = g.feed(0.12 + (k % 2) * 0.01, (t += 60));
    expect(on).toBe(false);
    expect(g.quietFor(t)).toBeGreaterThan(1000);
    expect(g.feed(0.5, (t += 60))).toBe(true);
  });
  it('someone who speaks the moment the mic opens is heard at once', () => {
    const g = voiceGate();
    expect(g.feed(0.5, 60)).toBe(true);
  });
  it('the take stops after a quiet following a voice, after a long nothing, or at the cap', () => {
    expect(autoStop({ spoke: true, quietMs: AUTO_STOP.afterVoiceMs, ranMs: 3000 })).toBe(true);
    expect(autoStop({ spoke: true, quietMs: 500, ranMs: 3000 })).toBe(false);
    expect(autoStop({ spoke: false, quietMs: 0, ranMs: AUTO_STOP.noVoiceMs })).toBe(true);
    expect(autoStop({ spoke: false, quietMs: 0, ranMs: 2000 })).toBe(false);
    expect(autoStop({ spoke: true, quietMs: 0, ranMs: AUTO_STOP.maxMs })).toBe(true);
  });
});

describe('the mic check', () => {
  const e = env('iosChrome');
  it('a voice came in: 聞こえているよ', () => {
    expect(checkVerdict({ fault: null, peak: 0.4, spoke: true }, e)).toMatchObject({ ok: true, title: '聞こえているよ' });
  });
  it('sound but no voice: it works, speak closer', () => {
    expect(checkVerdict({ fault: null, peak: 0.03, spoke: false }, e)).toMatchObject({ ok: true, title: 'マイクは動いているよ' });
  });
  it('exact silence: the mic opened but nothing arrives', () => {
    expect(checkVerdict({ fault: null, peak: 0, spoke: false }, e)).toMatchObject({ ok: false, title: '音が入っていないよ' });
  });
  it('a fault: what to do on this phone', () => {
    const v = checkVerdict({ fault: 'denied', peak: 0, spoke: false }, e);
    expect(v.ok).toBe(false);
    expect(v.text).toContain('「Chrome」');
  });
});

describe('the diagnostics are limited on the page', () => {
  it('the same fault once a minute, a handful in ten minutes', () => {
    const ok = reportGate({ max: 3, windowMs: 600_000 });
    expect(ok('bati:denied', 0)).toBe(true);
    expect(ok('bati:denied', 1000)).toBe(false);
    expect(ok('bati:denied', 61_000)).toBe(true);
    expect(ok('dachi:silent', 62_000)).toBe(true);
    expect(ok('story:busy', 63_000)).toBe(false);
    // the window moves on
    expect(ok('story:busy', 700_000)).toBe(true);
  });
});
