import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The mic's whole way with fakes (no browser): which engine a phone gets, the fall back from the browser's recogniser
 * to the recorder, the restart after a pause, the recording's container, and what is said when it fails.
 */
const session: boolean[] = [];
const busy: boolean[] = [];
vi.mock('@/lib/onboarding/audio', () => ({ micSession: (on: boolean) => void session.push(on), micBusy: (on: boolean) => void busy.push(on), unlockAudio: () => null }));
const reports: { fault: string; name?: string; engine: string; path: string; os: string; browser: string }[] = [];
const dictated: Blob[] = [];
let dictateAnswer: () => Promise<{ text: string }> = async () => ({ text: 'こんにちは' });
vi.mock('@/lib/api', () => ({
  getApi: () => ({
    dictate: (b: Blob) => {
      dictated.push(b);
      return dictateAnswer();
    },
    micDiag: async (r: (typeof reports)[number]) => void reports.push(r),
  }),
}));
let meterLevel = 0.5;
let meterLive = true;
const meterOwn: (boolean | undefined)[] = [];
vi.mock('./meter', () => ({
  micMeter: (_s: unknown, o?: { own?: boolean }) => (meterOwn.push(o?.own), { level: () => meterLevel, live: () => meterLive, everLive: () => meterLive, close: () => undefined }),
}));

/** a store that outlives a module reload (the same phone, a later visit) */
const local = new Map<string, string>();

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};

/** a recogniser the test drives by hand */
class FakeRec {
  static made: FakeRec[] = [];
  lang = '';
  interimResults = false;
  continuous = false;
  starts = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRec.made.push(this);
  }
  start() {
    this.starts++;
  }
  stop() {
    setTimeout(() => this.onend?.(), 10);
  }
  abort() {
    /* nothing */
  }
  say(text: string, isFinal = true) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });
  }
}

class FakeTrack {
  readyState = 'live';
  muted = false;
  enabled = true;
  stopped = false;
  stop() {
    this.stopped = true;
    this.readyState = 'ended';
  }
  addEventListener() {
    /* never ends by itself here */
  }
}
class FakeStream {
  track = new FakeTrack();
  getAudioTracks() {
    return [this.track];
  }
  getTracks() {
    return [this.track];
  }
}

class FakeRecorder {
  static made: FakeRecorder[] = [];
  static supports = ['audio/mp4'];
  static isTypeSupported(t: string) {
    return FakeRecorder.supports.includes(t);
  }
  state = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    readonly stream: FakeStream,
    opts?: { mimeType?: string },
  ) {
    this.mimeType = opts?.mimeType ? `${opts.mimeType};codecs=mp4a.40.2` : '';
    FakeRecorder.made.push(this);
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(4000)]) });
    this.onstop?.();
  }
}

let gum: () => Promise<FakeStream>;
let streams: FakeStream[] = [];

function phone(ua: string, o: { recognizer?: boolean; recorder?: boolean } = {}) {
  const store = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  vi.stubGlobal('localStorage', { getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v) });
  vi.stubGlobal('document', { addEventListener: () => undefined, visibilityState: 'visible' });
  vi.stubGlobal('window', {
    ...(o.recognizer === false ? {} : { webkitSpeechRecognition: FakeRec }),
    addEventListener: () => undefined,
    dispatchEvent: () => true,
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal('navigator', {
    userAgent: ua,
    maxTouchPoints: 5,
    platform: '',
    mediaDevices: {
      getUserMedia: () => gum(),
    },
  });
  if (o.recorder === false) vi.stubGlobal('MediaRecorder', undefined);
  else vi.stubGlobal('MediaRecorder', FakeRecorder);
}

async function load() {
  vi.resetModules();
  return (await import('./hear')).hear;
}

type End = { fault: string | null; heard: boolean; engine: string };
function listener() {
  const got = { finals: [] as string[], phases: [] as string[], end: null as End | null };
  return {
    got,
    opts: {
      path: 'bati' as const,
      onFinal: (t: string) => void got.finals.push(t),
      onPhase: (p: string) => void got.phases.push(p),
      onEnd: (r: End) => void (got.end = r),
    },
  };
}
const flush = async (ms = 0) => {
  await vi.advanceTimersByTimeAsync(ms);
};

beforeEach(() => {
  vi.useFakeTimers();
  session.length = 0;
  busy.length = 0;
  local.clear();
  meterOwn.length = 0;
  meterLive = true;
  reports.length = 0;
  dictated.length = 0;
  FakeRec.made = [];
  FakeRecorder.made = [];
  FakeRecorder.supports = ['audio/mp4'];
  streams = [];
  meterLevel = 0.5;
  dictateAnswer = async () => ({ text: 'こんにちは' });
  gum = async () => {
    const s = new FakeStream();
    streams.push(s);
    return s;
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('iPhone Chrome (client 2026-11-27: the mic that did not react)', () => {
  it('never touches the recogniser: it records audio/mp4, sends it to be heard, and the words come back', async () => {
    phone(UA.iosChrome);
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    expect(h.engine()).toBe('record');
    await flush(10);
    expect(FakeRec.made).toHaveLength(0);
    expect(FakeRecorder.made).toHaveLength(1);
    expect(l.got.phases).toContain('listening');
    // the record session is on while it listens
    expect(session[0]).toBe(true);
    await flush(900);
    expect(l.got.phases).toContain('hearing');
    h.stop();
    await flush(10);
    expect(l.got.phases).toContain('thinking');
    expect(dictated).toHaveLength(1);
    // the plain type the API takes (the recorder says 「audio/mp4;codecs=…」)
    expect(dictated[0].type).toBe('audio/mp4');
    expect(l.got.finals).toEqual(['こんにちは']);
    expect(l.got.end).toEqual({ fault: null, heard: true, engine: 'record' });
    expect(reports).toHaveLength(0);
  });

  it('stops by itself after a quiet that follows a voice', async () => {
    phone(UA.iosChrome);
    const hear = await load();
    const l = listener();
    hear(l.opts);
    await flush(10);
    meterLevel = 0.5;
    await flush(900);
    meterLevel = 0.005;
    await flush(2000);
    // a pause to think is not the end (R21 playtest: 2.4 s now)
    expect(dictated).toHaveLength(0);
    await flush(1000);
    expect(dictated).toHaveLength(1);
    expect(l.got.end?.heard).toBe(true);
  });

  it('the mic is not allowed: said as "denied" (for Chrome), reported with the browser family, the session let go', async () => {
    phone(UA.iosChrome);
    gum = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
    const hear = await load();
    const l = listener();
    hear(l.opts);
    await flush(10);
    expect(l.got.end).toEqual({ fault: 'denied', heard: false, engine: 'record' });
    expect(reports[0]).toMatchObject({ path: 'bati', fault: 'denied', name: 'NotAllowedError', os: 'ios', browser: 'chrome', engine: 'record' });
    expect(session[session.length - 1]).toBe(false);
    expect(dictated).toHaveLength(0);
  });

  it('a take with no sound in it at all is not sent: "silent"', async () => {
    phone(UA.iosChrome);
    meterLevel = 0;
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    await flush(1500);
    h.stop();
    await flush(10);
    expect(dictated).toHaveLength(0);
    expect(l.got.end).toEqual({ fault: 'silent', heard: false, engine: 'record' });
    expect(reports[0]).toMatchObject({ fault: 'silent', mime: 'audio/mp4' });
    // what the take was like: the meter ran (l=1), peak 0, no voice, its length
    expect(reports[0].name).toMatch(/^zero-level;l=1;p=0;v=0;ms=\d+$/);
  });

  it('the server has no words now: "stt", with the API code in the report', async () => {
    phone(UA.iosChrome);
    dictateAnswer = () => Promise.reject({ status: 503, code: 'STT_OFF' });
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    await flush(700);
    h.stop();
    await flush(10);
    expect(l.got.end).toEqual({ fault: 'stt', heard: false, engine: 'record' });
    expect(reports[0]).toMatchObject({ fault: 'stt', name: 'STT_OFF' });
  });

  it('nothing was understood: "empty" (not reported: nothing is broken)', async () => {
    phone(UA.iosChrome);
    dictateAnswer = async () => ({ text: '' });
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    await flush(700);
    h.stop();
    await flush(10);
    expect(l.got.end).toEqual({ fault: 'empty', heard: false, engine: 'record' });
    expect(reports).toHaveLength(0);
  });
});

describe('Safari on iPhone', () => {
  it('uses the recogniser, starts it again after a pause, and ends with the words when the member stops', async () => {
    phone(UA.iosSafari);
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    expect(h.engine()).toBe('speech');
    const r = FakeRec.made[0];
    expect(r.continuous).toBe(true);
    expect(r.lang).toBe('ja-JP');
    r.say('きょうは');
    // iOS ends it after the pause
    await flush(3000);
    r.onend?.();
    expect(r.starts).toBe(2);
    r.say('いい天気');
    h.stop();
    await flush(20);
    expect(l.got.finals).toEqual(['きょうは', 'いい天気']);
    expect(l.got.end).toEqual({ fault: null, heard: true, engine: 'speech' });
    expect(FakeRecorder.made).toHaveLength(0);
    // the record session was on for the take and is let go after it
    expect(session).toContain(true);
    expect(session[session.length - 1]).toBe(false);
  });

  it('words that never became final are kept when it is stopped', async () => {
    phone(UA.iosSafari);
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    FakeRec.made[0].say('とちゅう', false);
    h.stop();
    await flush(20);
    expect(l.got.finals).toEqual(['とちゅう']);
    expect(l.got.end?.heard).toBe(true);
  });

  it('the recogniser refuses (service-not-allowed): the same take goes on with the recorder, and the next one starts there', async () => {
    phone(UA.iosSafari);
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    FakeRec.made[0].onerror?.({ error: 'service-not-allowed' });
    // iPhone: the recogniser's capture is let go first (IOS_HANDOVER_MS)
    await flush(10);
    expect(FakeRecorder.made).toHaveLength(0);
    await flush(300);
    expect(h.engine()).toBe('record');
    expect(FakeRecorder.made).toHaveLength(1);
    await flush(700);
    h.stop();
    await flush(10);
    expect(l.got.finals).toEqual(['こんにちは']);
    expect(l.got.end).toEqual({ fault: null, heard: true, engine: 'record' });
    expect(reports[0]).toMatchObject({ fault: 'fallback', name: 'service-not-allowed', engine: 'speech', browser: 'safari' });
    // remembered for the visit
    const l2 = listener();
    const h2 = hear(l2.opts);
    expect(h2.engine()).toBe('record');
    expect(FakeRec.made).toHaveLength(1);
    h2.abort();
  });

  it('a recogniser that ends at once again and again is given up for the recorder', async () => {
    phone(UA.iosSafari);
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    const r = FakeRec.made[0];
    r.onend?.();
    r.onend?.();
    expect(r.starts).toBe(3);
    r.onend?.();
    await flush(300);
    expect(h.engine()).toBe('record');
    expect(reports[0]).toMatchObject({ fault: 'fallback', name: 'ends-at-once' });
    h.abort();
  });

  it('a pause (no-speech) is not an error', async () => {
    phone(UA.iosSafari);
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    FakeRec.made[0].onerror?.({ error: 'no-speech' });
    expect(h.engine()).toBe('speech');
    expect(l.got.end).toBeNull();
    h.abort();
  });

  it('two takes in a row without a word: the recorder from then on', async () => {
    phone(UA.iosSafari);
    const hear = await load();
    for (let k = 0; k < 2; k++) {
      const l = listener();
      const h = hear(l.opts);
      expect(h.engine()).toBe('speech');
      h.stop();
      await flush(20);
      expect(l.got.end).toEqual({ fault: 'empty', heard: false, engine: 'speech' });
    }
    const h3 = hear(listener().opts);
    expect(h3.engine()).toBe('record');
    h3.abort();
  });
});

describe('other browsers', () => {
  it('Chrome on Android: the recogniser', async () => {
    phone(UA.androidChrome);
    const hear = await load();
    const h = hear(listener().opts);
    expect(h.engine()).toBe('speech');
    h.abort();
  });

  it('no recogniser at all (Firefox, a web view): the recorder with webm', async () => {
    phone(UA.androidChrome, { recognizer: false });
    FakeRecorder.supports = ['audio/webm;codecs=opus', 'audio/webm'];
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    expect(h.engine()).toBe('record');
    await flush(700);
    h.stop();
    await flush(10);
    expect(dictated[0].type).toBe('audio/webm');
    expect(l.got.end?.heard).toBe(true);
  });

  it('neither a recogniser nor a recorder: "unsupported" — never silence', async () => {
    phone(UA.iosChrome, { recorder: false });
    const hear = await load();
    const l = listener();
    hear(l.opts);
    await flush(10);
    expect(l.got.end).toEqual({ fault: 'unsupported', heard: false, engine: 'record' });
  });
});

describe('one stream for the page', () => {
  it('a stream the phone muted (a call, another app) is not used again: a fresh one is opened', async () => {
    phone(UA.iosChrome);
    vi.resetModules();
    const { openMic, quietMic, usable } = await import('@/lib/micStream');
    const a = (await openMic()) as unknown as FakeStream;
    quietMic();
    expect(streams).toHaveLength(1);
    // still "live", but muted by the system
    a.track.muted = true;
    expect(usable(a)).toBe(false);
    const b = (await openMic()) as unknown as FakeStream;
    expect(streams).toHaveLength(2);
    expect(b).not.toBe(a);
    expect(a.track.stopped).toBe(true);
    quietMic();
  });

  it('kept a short while after a recording (no second question), then closed and the session let go', async () => {
    phone(UA.iosChrome);
    vi.resetModules();
    const { openMic, quietMic, MIC_IDLE_MS } = await import('@/lib/micStream');
    const a = (await openMic()) as unknown as FakeStream;
    quietMic();
    await flush(0);
    expect(a.track.enabled).toBe(false);
    const again = (await openMic()) as unknown as FakeStream;
    expect(again).toBe(a);
    expect(a.track.enabled).toBe(true);
    quietMic();
    await flush(MIC_IDLE_MS + 10);
    expect(a.track.stopped).toBe(true);
    expect(session[session.length - 1]).toBe(false);
  });
});

describe('R21 playtest (client 2026-11-28, iPhone Safari, day 2: both takes came back as 「00:00」 / noise)', () => {
  it('the model’s 「00:00」 for a take with no voice is no words: "empty", nothing written, and reported with what the take was like', async () => {
    phone(UA.iosChrome);
    dictateAnswer = async () => ({ text: '00:00' });
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    await flush(900);
    h.stop();
    await flush(10);
    expect(dictated).toHaveLength(1);
    expect(l.got.finals).toEqual([]);
    expect(l.got.end).toEqual({ fault: 'empty', heard: false, engine: 'record' });
    expect(reports[0]).toMatchObject({ fault: 'empty', engine: 'record', mime: 'audio/mp4' });
    expect(reports[0].name).toMatch(/^nonspeech;l=1;p=500;v=\d+;ms=\d+$/);
  });

  it('words with the model’s marks around them: only the words', async () => {
    phone(UA.iosChrome);
    dictateAnswer = async () => ({ text: '[00:00] おにぎり' });
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    await flush(900);
    h.stop();
    await flush(10);
    expect(l.got.finals).toEqual(['おにぎり']);
    expect(reports).toHaveLength(0);
  });

  it('a knock as the capture starts is no voice: the take is not cut two seconds in', async () => {
    phone(UA.iosChrome);
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    // the click / gain swell of a starting capture
    meterLevel = 0.6;
    await flush(240);
    meterLevel = 0.004;
    await flush(4000);
    // before: 「a voice」 then 1.8 s quiet → stopped and sent; now it still listens
    expect(dictated).toHaveLength(0);
    expect(l.got.end).toBeNull();
    // the member speaks now and is heard
    meterLevel = 0.3;
    await flush(800);
    meterLevel = 0.004;
    await flush(2600);
    expect(dictated).toHaveLength(1);
    expect(l.got.end?.heard).toBe(true);
    h.abort();
  });

  it('a single loud frame later on is not "spoke" either', async () => {
    phone(UA.iosChrome);
    const hear = await load();
    const l = listener();
    hear(l.opts);
    meterLevel = 0.004;
    await flush(1000);
    meterLevel = 0.6;
    await flush(60);
    meterLevel = 0.004;
    await flush(3000);
    expect(dictated).toHaveLength(0);
    expect(l.got.end).toBeNull();
  });

  it('the page hears that a take is open (the story quiets its music) and that it is over', async () => {
    phone(UA.iosChrome);
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    await flush(900);
    expect(busy).toEqual([true]);
    h.stop();
    await flush(10);
    expect(busy).toEqual([true, false]);
  });

  it('Safari’s recogniser too: busy while it listens, let go after', async () => {
    phone(UA.iosSafari);
    const hear = await load();
    const h = hear(listener().opts);
    expect(busy[busy.length - 1]).toBe(true);
    FakeRec.made[0].say('はい');
    h.stop();
    await flush(20);
    expect(busy[busy.length - 1]).toBe(false);
  });

  it('iPhone: the level is read on a context of its own; Android Chrome: the page’s', async () => {
    phone(UA.iosChrome);
    let hear = await load();
    hear(listener().opts).abort;
    await flush(10);
    expect(meterOwn).toEqual([true]);
    phone(UA.androidChrome, { recognizer: false });
    FakeRecorder.supports = ['audio/webm'];
    hear = await load();
    hear(listener().opts);
    await flush(10);
    expect(meterOwn).toEqual([true, false]);
  });

  it('a refusing recogniser is remembered on the phone: the next visit starts on the recorder (no take spent on it)', async () => {
    phone(UA.iosSafari);
    let hear = await load();
    const h = hear(listener().opts);
    FakeRec.made[0].onerror?.({ error: 'service-not-allowed' });
    await flush(300);
    h.abort();
    // a new visit: a fresh page (module) and a fresh sessionStorage, the same phone
    phone(UA.iosSafari);
    hear = await load();
    expect(hear(listener().opts).engine()).toBe('record');
  });

  it('stopped while the recorder takes over on iPhone: the take ends at once, nothing recorded', async () => {
    phone(UA.iosSafari);
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    FakeRec.made[0].onerror?.({ error: 'service-not-allowed' });
    h.stop();
    await flush(400);
    expect(FakeRecorder.made).toHaveLength(0);
    expect(l.got.end).toEqual({ fault: 'empty', heard: false, engine: 'record' });
    expect(busy[busy.length - 1]).toBe(false);
  });

  it('a stream that comes up muted (the system still has the mic) is waited for before recording', async () => {
    phone(UA.iosChrome);
    let unmute: (() => void) | null = null;
    gum = async () => {
      const s = new FakeStream();
      s.track.muted = true;
      s.track.addEventListener = ((ev: string, f: () => void) => {
        if (ev === 'unmute') unmute = f;
      }) as never;
      streams.push(s);
      return s;
    };
    const hear = await load();
    hear(listener().opts);
    await flush(100);
    expect(FakeRecorder.made).toHaveLength(0);
    // (openMic asks once more for a stream that is not usable: the last one is the one in hand)
    streams[streams.length - 1].track.muted = false;
    unmute!();
    await flush(10);
    expect(FakeRecorder.made).toHaveLength(1);
  });

  it('a meter that never ran: the take is still sent (nothing to judge it by) and a 「00:00」 answer is reported with l=0', async () => {
    phone(UA.iosChrome);
    meterLive = false;
    dictateAnswer = async () => ({ text: '00:00' });
    const hear = await load();
    const l = listener();
    const h = hear(l.opts);
    await flush(1500);
    h.stop();
    await flush(10);
    expect(dictated).toHaveLength(1);
    expect(reports[0].name).toMatch(/^nonspeech;l=0;/);
    expect(l.got.end?.fault).toBe('empty');
  });
});

describe('the remembered refusal', () => {
  it('counts for SPEECH_FAILED_DAYS, and the old mark of a visit still counts', async () => {
    const { failedMarkValid, SPEECH_FAILED_DAYS } = await import('./env');
    const now = Date.UTC(2026, 10, 28);
    expect(failedMarkValid(null, now)).toBe(false);
    expect(failedMarkValid('1', now)).toBe(true);
    expect(failedMarkValid(String(now - 86400_000), now)).toBe(true);
    expect(failedMarkValid(String(now - SPEECH_FAILED_DAYS * 86400_000 - 1), now)).toBe(false);
    expect(failedMarkValid('junk', now)).toBe(false);
  });
});
