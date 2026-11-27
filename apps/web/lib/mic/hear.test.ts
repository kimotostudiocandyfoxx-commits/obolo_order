import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The mic's whole way with fakes (no browser): which engine a phone gets, the fall back from the browser's recogniser
 * to the recorder, the restart after a pause, the recording's container, and what is said when it fails.
 */
const session: boolean[] = [];
vi.mock('@/lib/onboarding/audio', () => ({ micSession: (on: boolean) => void session.push(on), unlockAudio: () => null }));
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
vi.mock('./meter', () => ({ micMeter: () => ({ level: () => meterLevel, live: () => true, close: () => undefined }) }));

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
    await flush(600);
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
    await flush(2400);
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
    expect(reports[0]).toMatchObject({ fault: 'silent', name: 'zero-level', mime: 'audio/mp4' });
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
    await flush(10);
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
    await flush(10);
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
