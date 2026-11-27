/**
 * The microphone's rules, in one place (client 2026-11-27, phones: 「ダチチャットやバティとの会話で、マイクが反応しないことが
 * 多い。設定を見ても、何を変えたらいいのか分からない」). No DOM imports: the tests drive every decision with fakes.
 *
 * What went wrong before (docs/mic.md has the whole list):
 * - iPhone Chrome / Firefox / Edge and the in-app browsers (LINE, Instagram, TikTok …) run on WebKit's web view, where
 *   the browser's own speech recognition is missing or answers `service-not-allowed`. The talk's mic then either opened
 *   the keyboard without a word or said 「設定 → 一般 → キーボード →「音声入力」をオンに」, which changes nothing there.
 * - every failure of the recorder was called "denied" and pointed at 「設定 → Safari → マイク」, also in Chrome and on Android.
 * - the sound session was "ambient" (silent switch) while the mic was open; iOS records under "play-and-record" only.
 * - the page's one stream was kept alive between recordings: iOS then mutes it after a call / another app / the
 *   recogniser, and the next recording was silent.
 *
 * Now: one way in for every mic (lib/mic/hear.ts for words, lib/micStream.ts for the stream), the engine is chosen here
 * (the browser's recogniser where it really works, else record → POST /voice/dictate), and every failure has its own
 * short line saying what to do.
 */

/* ───────────────────────── which phone, which browser ───────────────────────── */

export type MicOs = 'ios' | 'android' | 'other';
export type MicBrowser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'line' | 'instagram' | 'facebook' | 'tiktok' | 'twitter' | 'google' | 'webview' | 'other';
export type MicEnv = {
  os: MicOs;
  browser: MicBrowser;
  /** a browser inside another app (LINE, Instagram, TikTok …): the mic is often closed there */
  inApp: boolean;
  /** opened from the home screen (iOS 「ホーム画面に追加」 / an installed PWA) */
  standalone: boolean;
};

const IN_APP: [RegExp, MicBrowser][] = [
  [/\bLine\//i, 'line'],
  [/Instagram/i, 'instagram'],
  [/FBAN|FBAV|FB_IAB/i, 'facebook'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'tiktok'],
  [/Twitter/i, 'twitter'],
];

/** the family only (never the full user agent): what the messages and the diagnostics need */
export function micEnv(ua: string, hints: { standalone?: boolean; maxTouchPoints?: number; platform?: string } = {}): MicEnv {
  const standalone = !!hints.standalone;
  // iPadOS says "Macintosh": a Mac with a touch screen is an iPad
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (hints.maxTouchPoints ?? 0) > 1) || (hints.platform === 'MacIntel' && (hints.maxTouchPoints ?? 0) > 1);
  const android = !ios && /Android/i.test(ua);
  const os: MicOs = ios ? 'ios' : android ? 'android' : 'other';
  for (const [re, b] of IN_APP) if (re.test(ua)) return { os, browser: b, inApp: true, standalone };
  if (ios) {
    if (/CriOS/.test(ua)) return { os, browser: 'chrome', inApp: false, standalone };
    if (/FxiOS/.test(ua)) return { os, browser: 'firefox', inApp: false, standalone };
    if (/EdgiOS/.test(ua)) return { os, browser: 'edge', inApp: false, standalone };
    if (/GSA\//.test(ua)) return { os, browser: 'google', inApp: true, standalone };
    // the home-screen app and the web views carry no "Safari/": the first is Safari itself, the others are not
    if (/Safari\//.test(ua) || standalone) return { os, browser: 'safari', inApp: false, standalone };
    return { os, browser: 'webview', inApp: true, standalone };
  }
  if (android) {
    if (/; wv\)/.test(ua)) return { os, browser: 'webview', inApp: true, standalone };
    if (/SamsungBrowser/.test(ua)) return { os, browser: 'samsung', inApp: false, standalone };
    if (/EdgA/.test(ua)) return { os, browser: 'edge', inApp: false, standalone };
    if (/Firefox/.test(ua)) return { os, browser: 'firefox', inApp: false, standalone };
    if (/Chrome\//.test(ua)) return { os, browser: 'chrome', inApp: false, standalone };
    return { os, browser: 'other', inApp: false, standalone };
  }
  if (/Edg\//.test(ua)) return { os, browser: 'edge', inApp: false, standalone };
  if (/Firefox/.test(ua)) return { os, browser: 'firefox', inApp: false, standalone };
  if (/Chrome\//.test(ua)) return { os, browser: 'chrome', inApp: false, standalone };
  if (/Safari\//.test(ua)) return { os, browser: 'safari', inApp: false, standalone };
  return { os, browser: 'other', inApp: false, standalone };
}

const BROWSER_NAME: Record<MicBrowser, string> = {
  safari: 'Safari',
  chrome: 'Chrome',
  firefox: 'Firefox',
  edge: 'Edge',
  samsung: 'Samsung Internet',
  line: 'LINE',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  twitter: 'X',
  google: 'Googleアプリ',
  webview: 'アプリの中のブラウザ',
  other: 'ブラウザ',
};
/** 「iPhoneのChrome」「AndroidのLINE」 — shown in the mic check */
export function envLabel(e: MicEnv): string {
  const os = e.os === 'ios' ? 'iPhone / iPad' : e.os === 'android' ? 'Android' : 'パソコン';
  return `${os}の${e.standalone ? 'ホーム画面のアプリ' : BROWSER_NAME[e.browser]}`;
}

/* ───────────────────────── which engine hears the words ───────────────────────── */

export type HearEngine = 'speech' | 'record';

/**
 * Whether the browser's own recogniser may be tried first. Not on iPhone / iPad outside Safari (Chrome, Firefox, Edge
 * and every in-app browser are WebKit web views: the recogniser is missing or refuses with `service-not-allowed`), not
 * in an Android web view, and not once it failed on this phone (`failedBefore`: remembered for the visit).
 */
export function speechUsable(env: MicEnv, hasRecognizer: boolean, failedBefore = false): boolean {
  if (!hasRecognizer || failedBefore) return false;
  if (env.os === 'ios' && env.browser !== 'safari') return false;
  if (env.inApp) return false;
  return true;
}

/** the engine for the next take: the recogniser where it works, else record → /voice/dictate (null: no mic at all) */
export function pickEngine(env: MicEnv, has: { recognizer: boolean; recorder: boolean }, failedBefore = false): HearEngine | null {
  if (speechUsable(env, has.recognizer, failedBefore)) return 'speech';
  if (has.recorder) return 'record';
  // nothing else to try: a recogniser that failed before is still better than no mic
  return has.recognizer && !(env.os === 'ios' && env.browser !== 'safari') ? 'speech' : null;
}

/**
 * What a recogniser error means for the take: 'ignore' (a pause, our own abort), or 'fallback' — every real error goes
 * on with the recorder (which then says exactly what is wrong: not allowed, no mic, busy), never straight to a notice.
 */
export function speechErrorAction(code: string): 'ignore' | 'fallback' {
  return code === 'no-speech' || code === 'aborted' ? 'ignore' : 'fallback';
}

/** takes that ended with no word at all before the recogniser is given up for the visit (it "listens" but hears nothing) */
export const EMPTY_TAKES_TO_FALL_BACK = 2;
export function afterEmptyTake(emptyInARow: number): 'stay' | 'fallback' {
  return emptyInARow >= EMPTY_TAKES_TO_FALL_BACK ? 'fallback' : 'stay';
}

/**
 * iOS Safari ends the recogniser after every pause: it is started again while the member still wants to talk — but a
 * recogniser that ends at once, again and again, is broken (no service, another app has the mic): three quick ends in
 * a row stop the restarts, so the page never spins on a dead mic.
 */
export const QUICK_END_MS = 700;
export const MAX_QUICK_ENDS = 3;
export function restartPlan(s: { want: boolean; quickEnds: number; ranMs: number; hadError: boolean }): { restart: boolean; quickEnds: number } {
  if (!s.want || s.hadError) return { restart: false, quickEnds: 0 };
  const quick = s.ranMs < QUICK_END_MS ? s.quickEnds + 1 : 0;
  return quick >= MAX_QUICK_ENDS ? { restart: false, quickEnds: quick } : { restart: true, quickEnds: quick };
}

/* ───────────────────────── the recording's container ───────────────────────── */

/** what the API takes (packages/shared VOICE_MIME_TYPES), in the order tried: iPhone records mp4, Chrome / Firefox webm */
export const RECORD_MIMES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'] as const;
/** the container this browser can record (undefined: let the browser choose) */
export function pickMime(isTypeSupported: ((t: string) => boolean) | undefined): string | undefined {
  if (!isTypeSupported) return undefined;
  return RECORD_MIMES.find((c) => {
    try {
      return isTypeSupported(c);
    } catch {
      return false;
    }
  });
}
/** the plain type for the upload (「audio/mp4;codecs=mp4a.40.2」→「audio/mp4」; nothing known: iPhone → mp4, else webm) */
export function blobType(recorded: string | undefined, picked: string | undefined, env?: MicEnv): string {
  const t = (recorded || picked || '').split(';')[0].trim().toLowerCase();
  return t || (env?.os === 'ios' ? 'audio/mp4' : 'audio/webm');
}

/* ───────────────────────── what went wrong ───────────────────────── */

export type MicFault =
  /** the member (or the phone's settings) said no */
  | 'denied'
  /** no microphone on this device */
  | 'no-device'
  /** another app / a call has it, or the phone would not start it */
  | 'busy'
  /** this browser has no way to record (an in-app browser, a very old one, a page not on https) */
  | 'unsupported'
  /** it recorded, but no sound came in */
  | 'silent'
  /** it recorded sound, but no words were heard */
  | 'empty'
  /** the words could not be made on the server now */
  | 'stt'
  /** the network */
  | 'network'
  | 'failed';

/** getUserMedia / MediaRecorder errors → the fault (by the error's name; older WebKit / Chrome names too) */
export function faultOfError(e: unknown): MicFault {
  const name = (e as { name?: string } | null)?.name ?? '';
  const msg = (e as { message?: string } | null)?.message ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no-device';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError' || name === 'InvalidStateError') return 'busy';
  if (name === 'NotSupportedError' || name === 'TypeError' || msg === 'unsupported') return 'unsupported';
  return 'failed';
}

/** the API's answer to POST /voice/dictate → the fault */
export function faultOfApi(e: unknown): MicFault {
  const status = (e as { status?: number } | null)?.status;
  const code = (e as { code?: string } | null)?.code;
  // the server could not read the take (not the member's doing): try again
  if (code === 'BAD_AUDIO' || code === 'EMPTY_UPLOAD' || code === 'UNSUPPORTED_AUDIO') return 'failed';
  if (status === undefined || status === 0) return 'network';
  return 'stt';
}

/** what the member can do about it: 'check' opens 〔マイクをためす〕, 'keys' points at the keyboard */
export type MicAdvice = { text: string; action: 'check' | 'keys' | 'retry' };

const openIn = (env: MicEnv) => (env.os === 'ios' ? 'Safari' : 'Chrome');
/** story chat 2026-11-27: out of an app's own browser (LINE, Instagram …) — iPhone says Safari, every other phone 「ブラウザで開く」 */
const leaveApp = (env: MicEnv) => (env.os === 'ios' ? 'Safariで開く' : 'ブラウザで開く');
/** story chat 2026-11-27: said once, the first time a take is sent to the server to be made into words (POST /voice/dictate keeps nothing) */
export const RECORD_NOTICE = '声は、文字にするためだけに使って、保存しないよ';
/** the same, in the story's polite register */
export const RECORD_NOTICE_POLITE = '声は、文字にするためだけに使います。保存はしません。';
const RECORD_NOTICE_KEY = 'obolo.mic.recordNotice';
/** true the first time on this device (and marks it said) */
export function recordNoticeOnce(store: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  try {
    if (!store || store.getItem(RECORD_NOTICE_KEY)) return false;
    store.setItem(RECORD_NOTICE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

/**
 * PROVISIONAL wording (story chat to confirm): one short line per failure, saying what to do on this phone.
 * やさしい日本語, no emoji.
 */
export function micAdvice(fault: MicFault, env: MicEnv): MicAdvice {
  switch (fault) {
    case 'denied':
      if (env.inApp) return { text: `このアプリの中では、マイクが使えないよ。メニューから「${leaveApp(env)}」をえらんでね`, action: 'check' };
      if (env.os === 'ios') {
        if (env.standalone) return { text: 'マイクが許可されていないよ。iPhoneの「設定」→「Safari」→「マイク」を「許可」にして、アプリを開き直してね', action: 'check' };
        if (env.browser === 'safari') return { text: 'マイクが許可されていないよ。iPhoneの「設定」→「Safari」→「マイク」を「許可」にして、ページを開き直してね', action: 'check' };
        return { text: `マイクが許可されていないよ。iPhoneの「設定」→「${BROWSER_NAME[env.browser]}」→「マイク」をオンにして、ページを開き直してね`, action: 'check' };
      }
      if (env.os === 'android') return { text: 'マイクが許可されていないよ。アドレスバーの左のマーク →「権限」→「マイク」を「許可」にしてね', action: 'check' };
      return { text: 'マイクが許可されていないよ。アドレスバーの左のマークから、マイクを「許可」にしてね', action: 'check' };
    case 'no-device':
      return { text: 'マイクが見つからないよ。イヤホンやマイクのつなぎ方を、たしかめてね', action: 'check' };
    case 'busy':
      return { text: 'マイクを、ほかのアプリが使っているみたい。通話や録音のアプリを閉じて、もう一度ためしてね', action: 'check' };
    case 'unsupported':
      if (env.inApp) return { text: `このアプリの中では、マイクが使えないよ。メニューから「${leaveApp(env)}」をえらんでね`, action: 'keys' };
      return { text: `このブラウザでは、マイクが使えないよ。${openIn(env)}で開くか、キーボードで打ってね`, action: 'keys' };
    case 'silent':
      return { text: '声が入っていなかったよ。マイクに近づいて、もう一度話してね', action: 'check' };
    case 'empty':
      return { text: 'うまく聞き取れなかったよ。もう一度、ゆっくり話してね', action: 'retry' };
    case 'stt':
      return { text: 'いまは、声を文字にできないみたい。キーボードで打ってね', action: 'keys' };
    case 'network':
      return { text: '通信がうまくいかなかったよ。もう一度ためしてね', action: 'retry' };
    default:
      return { text: 'マイクがうまく動かなかったよ。もう一度ためしてね', action: 'check' };
  }
}

/**
 * PROVISIONAL wording: how to allow the microphone on this phone, step by step (the mic check shows it when the mic is
 * not allowed). iOS 18 moved the browsers under 「設定」→「アプリ」.
 */
export function allowSteps(env: MicEnv): string[] {
  if (env.inApp) return ['右上か右下のメニュー（︙ や …）をひらく', `「${leaveApp(env)}」をえらぶ`, 'ひらいたページで、もう一度マイクをためす'];
  if (env.os === 'ios') {
    const app = env.browser === 'safari' ? 'Safari' : BROWSER_NAME[env.browser];
    return ['iPhoneの「設定」をひらく', `「アプリ」→「${app}」をえらぶ（古いiPhoneは「設定」→「${app}」）`, env.browser === 'safari' ? '「マイク」を「許可」にする' : '「マイク」をオンにする', 'このページを開き直して、もう一度ためす'];
  }
  if (env.os === 'android') return ['アドレスバーの左のマークをタップ', '「権限」→「マイク」を「許可」にする', 'だめなら、Androidの「設定」→「アプリ」→「Chrome」→「権限」→「マイク」を「許可」にする', 'このページを開き直して、もう一度ためす'];
  return ['アドレスバーの左のマークをクリック', '「マイク」を「許可」にする', 'このページを開き直して、もう一度ためす'];
}

/** PROVISIONAL wording: the permission as the phone reports it (navigator.permissions; unknown where it cannot be asked) */
export type MicPermission = 'granted' | 'prompt' | 'denied' | 'unknown';
export const PERMISSION_WORDS: Record<MicPermission, string> = {
  granted: '許可されているよ',
  prompt: 'まだ聞かれていないよ（ためすと、聞かれるよ）',
  denied: '許可されていないよ',
  unknown: 'ためすと分かるよ',
};

/* ───────────────────────── loudness: is anything coming in? ───────────────────────── */

/** time-domain samples (-1..1) → 0..1 for the meter (a quiet phone mic speaking at arm's length is about 0.02 RMS) */
export function levelOf(samples: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  return Math.min(1, rms * 8);
}

/** below this the whole take was silence (a muted track gives exact zeros; a live room is never this quiet) */
export const SILENT_PEAK = 0.012;

/**
 * Follows the room's noise and tells speech from it — no fixed loudness a quiet phone mic would never reach: the floor
 * drifts up slowly (a loud room stops counting as a voice after a second or two) and down fast, speech is anything
 * clearly over it. `feed` returns whether a voice is heard now;
 * `quietFor` is how long it has been quiet since the last voice (ms), `spoke` whether any voice came at all.
 */
export function voiceGate(opts: { ratio?: number; min?: number } = {}) {
  const ratio = opts.ratio ?? 2.2;
  const min = opts.min ?? 0.035;
  let floor = 0;
  let primed = false;
  let lastVoice = -1;
  let peak = 0;
  let spoke = false;
  return {
    feed(level: number, now: number): boolean {
      peak = Math.max(peak, level);
      if (!primed) {
        // never primed on a voice: someone who speaks the moment the mic opens is heard at once
        floor = Math.min(level, min);
        primed = true;
      } else floor = level < floor ? floor * 0.7 + level * 0.3 : floor * 0.99 + level * 0.01;
      const on = level > Math.max(min, floor * ratio);
      if (on) {
        lastVoice = now;
        spoke = true;
      }
      return on;
    },
    quietFor: (now: number) => (lastVoice < 0 ? 0 : now - lastVoice),
    get spoke() {
      return spoke;
    },
    get peak() {
      return peak;
    },
  };
}

/** the recorder's take stops by itself: this long quiet after a voice, or this long with no voice at all, or the cap */
export const AUTO_STOP = { afterVoiceMs: 1800, noVoiceMs: 8000, maxMs: 45000 } as const;
export function autoStop(s: { spoke: boolean; quietMs: number; ranMs: number }, o: { afterVoiceMs: number; noVoiceMs: number; maxMs: number } = AUTO_STOP): boolean {
  if (s.ranMs >= o.maxMs) return true;
  if (s.spoke) return s.quietMs >= o.afterVoiceMs;
  return s.ranMs >= o.noVoiceMs;
}

/* ───────────────────────── the mic check's verdict ───────────────────────── */

export type CheckResult = { ok: boolean; title: string; text: string };
/** PROVISIONAL wording: what the mic check says after listening for a few seconds */
export function checkVerdict(r: { fault: MicFault | null; peak: number; spoke: boolean }, env: MicEnv): CheckResult {
  if (r.fault) return { ok: false, title: 'マイクが使えないよ', text: micAdvice(r.fault, env).text };
  if (r.peak < SILENT_PEAK) return { ok: false, title: '音が入っていないよ', text: 'マイクはひらいたけれど、音がとどいていないよ。イヤホンのマイクや、ほかのアプリを、たしかめてね' };
  if (!r.spoke) return { ok: true, title: 'マイクは動いているよ', text: '小さな音はとどいているよ。もう少し近くで、大きめに話してみてね' };
  return { ok: true, title: '聞こえているよ', text: 'マイクは、ちゃんと動いているよ' };
}

/* ───────────────────────── diagnostics ───────────────────────── */

/** the mic's places (for the diagnostics and the tests) */
export type MicPath = 'bati' | 'atelier' | 'dachi' | 'dachi-voice' | 'story' | 'kororin' | 'egg' | 'compose' | 'check' | 'other';

export type MicReport = {
  path: MicPath;
  /** what failed (a MicFault, or 'fallback' when the recogniser was given up) */
  fault: string;
  engine: HearEngine | 'stream';
  /** the browser's error name / the recogniser's code (never a message with words in it) */
  name?: string;
  os: MicOs;
  browser: MicBrowser;
  inApp: boolean;
  standalone: boolean;
  /** the recording's container, when one was made */
  mime?: string;
};

/** at most this many reports from one page in this long (a broken mic is tapped again and again) */
export const REPORT_LIMIT = { max: 6, windowMs: 10 * 60 * 1000 } as const;
/** a small limiter: same fault + path once a minute, REPORT_LIMIT overall */
export function reportGate(limit: { max: number; windowMs: number } = REPORT_LIMIT) {
  const sent: number[] = [];
  const last = new Map<string, number>();
  return (key: string, now: number): boolean => {
    while (sent.length && now - sent[0] > limit.windowMs) sent.shift();
    if (sent.length >= limit.max) return false;
    const prev = last.get(key);
    if (prev !== undefined && now - prev < 60_000) return false;
    last.set(key, now);
    sent.push(now);
    return true;
  };
}
