/**
 * The kororin sings (M-R152): the words you blew into the stone, in your own voice, a cappella on a short club
 * melody. All on the phone, about a second, no mana and no heavy singing model:
 *  1. read the pitch (autocorrelation on a 11 kHz copy) and the loudness, every 10 ms
 *  2. cut the take into syllables (dips in loudness; Japanese is nearly one kana = one note), drop the silences
 *  3. lay them on a melody (A minor pentatonic in the octave nearest the speaker, always 126 BPM, eighths or
 *     sixteenths — the same key and beat for everyone, so kororins can sing in a relay)
 *  4. pitch-synchronous overlap-add: each output grain is cut from the take around a pitch peak and placed at
 *     the note's period — the pitch moves to the note, the vowel stretches to the note's length, the voice
 *     (its formants) stays the same
 *  5. a little room and a dotted echo, rendered offline → WAV
 * If anything fails the caller keeps the plain take.
 */

const SR = 44100;
const BPM = 126;
const HOP = 441; // 10 ms
// melodies as minor-pentatonic steps from the root (0 = root, 5 = the octave); the kororin picks one by the words
const MELODIES = [
  [0, 0, 2, 3, 2, 0, -1, 0, 3, 3, 4, 3, 2, 0, 2, 0],
  [3, 2, 0, 2, 3, 3, 4, 5, 4, 3, 2, 3, 0, 0, -1, 0],
  [0, 2, 0, 3, 0, 4, 3, 2, 0, 2, 0, 3, 2, 0, -1, -1],
  [5, 4, 3, 2, 3, 2, 0, 0, 2, 3, 4, 3, 2, 0, 0, 0],
];
const PENTA = [0, 3, 5, 7, 10];
const stepSemis = (s: number) => Math.floor(s / 5) * 12 + PENTA[((s % 5) + 5) % 5];

type Frame = { f0: number; rms: number };

/** Pitch and loudness every 10 ms. f0 = 0 when unvoiced or quiet. */
function analyse(x: Float32Array): Frame[] {
  // a 4× smaller copy for the pitch search (simple box low-pass first)
  const d = new Float32Array(Math.floor(x.length / 4));
  for (let k = 0; k < d.length; k++) d[k] = (x[4 * k] + x[4 * k + 1] + x[4 * k + 2] + x[4 * k + 3]) / 4;
  const dsr = SR / 4;
  const W = 384;
  const minLag = Math.floor(dsr / 700);
  const maxLag = Math.ceil(dsr / 70);
  const frames: Frame[] = [];
  let peak = 0;
  for (let k = 0; k < x.length; k++) peak = Math.max(peak, Math.abs(x[k]));
  for (let at = 0; at + HOP <= x.length; at += HOP) {
    let e = 0;
    for (let k = at; k < Math.min(x.length, at + HOP * 2); k++) e += x[k] * x[k];
    const rms = Math.sqrt(e / (HOP * 2));
    let f0 = 0;
    const c = Math.floor(at / 4);
    if (rms > peak * 0.04 && c + W + maxLag < d.length) {
      let e0 = 0;
      for (let k = 0; k < W; k++) e0 += d[c + k] * d[c + k];
      let best = 0;
      let bestLag = 0;
      for (let lag = minLag; lag <= maxLag; lag++) {
        let s = 0;
        let el = 0;
        for (let k = 0; k < W; k++) {
          s += d[c + k] * d[c + k + lag];
          el += d[c + k + lag] * d[c + k + lag];
        }
        const r = s / Math.sqrt(e0 * el + 1e-12);
        if (r > best) {
          best = r;
          bestLag = lag;
        }
      }
      if (best > 0.6 && bestLag > minLag) f0 = dsr / bestLag;
    }
    frames.push({ f0, rms });
  }
  // smooth out single-frame octave slips
  for (let k = 1; k < frames.length - 1; k++) {
    const [a, b, n] = [frames[k - 1].f0, frames[k].f0, frames[k + 1].f0];
    if (a && n && b && Math.abs(Math.log2(b / Math.sqrt(a * n))) > 0.6) frames[k].f0 = Math.sqrt(a * n);
  }
  return frames;
}

/** Syllables: [start, end) in frames, cut at dips in loudness, silences dropped. */
function syllables(fr: Frame[]): [number, number][] {
  const loud = fr.map((f) => f.rms);
  const sm = loud.map((_, k) => (loud[k - 1] ?? loud[k]) * 0.25 + loud[k] * 0.5 + (loud[k + 1] ?? loud[k]) * 0.25);
  const top = Math.max(...sm, 1e-6);
  const on = sm.map((v) => v > top * 0.08);
  const out: [number, number][] = [];
  let s = -1;
  for (let k = 0; k <= sm.length; k++) {
    const live = k < sm.length && on[k];
    if (live && s < 0) s = k;
    if (!live && s >= 0) {
      // inside a sounding run: cut at dips at least 8 frames apart
      let from = s;
      for (let j = s + 4; j < k - 4; j++) {
        const dip = sm[j] < sm[j - 1] && sm[j] <= sm[j + 1] && sm[j] < 0.7 * Math.max(...sm.slice(from, j)) && sm[j] < 0.7 * Math.max(...sm.slice(j, Math.min(k, j + 10)));
        if (dip && j - from >= 8) {
          out.push([from, j]);
          from = j;
        }
      }
      if (k - from >= 5) out.push([from, k]);
      else if (out.length && out[out.length - 1][1] === from) out[out.length - 1][1] = k;
      s = -1;
    }
  }
  // long held sounds become more than one note
  return out.flatMap(([a, b]) => {
    const n = Math.max(1, Math.round((b - a) / 28));
    return Array.from({ length: n }, (_, k) => [a + Math.round(((b - a) * k) / n), a + Math.round(((b - a) * (k + 1)) / n)] as [number, number]);
  });
}

/** The nearest sample peak (a stand-in for the glottal pulse) around `at`, within ±half a period. */
function peakNear(x: Float32Array, at: number, half: number): number {
  let best = at;
  let v = -Infinity;
  for (let k = Math.max(0, at - half); k < Math.min(x.length, at + half); k++)
    if (x[k] > v) {
      v = x[k];
      best = k;
    }
  return best;
}

/** Overlap-adds one syllable into `out` at `o0`, `len` samples long, at `hz` (0 = keep the take's own pitch). */
function place(x: Float32Array, fr: Frame[], seg: [number, number], out: Float32Array, o0: number, len: number, hz: number) {
  const a = seg[0] * HOP;
  const b = Math.min(x.length, seg[1] * HOP);
  // the consonant before the vowel keeps its own pace; the voiced part stretches to fill the note
  let v0 = seg[0];
  while (v0 < seg[1] && !fr[v0].f0) v0++;
  const cons = Math.min((v0 - seg[0]) * HOP, Math.floor(len * 0.4));
  const vA = a + cons;
  const mapIn = (o: number) => (o < cons ? a + o : vA + ((o - cons) / Math.max(1, len - cons)) * (b - vA));
  let o = 0;
  while (o < len) {
    const pos = Math.min(b - 1, Math.floor(mapIn(o)));
    const f = fr[Math.min(fr.length - 1, Math.floor(pos / HOP))];
    const voiced = f.f0 > 0 && o >= cons;
    const tIn = voiced ? SR / f.f0 : 220;
    const tOut = voiced ? SR / (hz || f.f0) : 220 + ((o * 7919) % 60); // unvoiced: jittered hop, no buzz
    const centre = voiced ? peakNear(x, pos, Math.floor(tIn / 2)) : pos;
    const half = Math.floor(voiced ? tIn : 330);
    for (let k = -half; k < half; k++) {
      const i = centre + k;
      const j = o0 + o + k;
      if (i < 0 || i >= x.length || j < 0 || j >= out.length) continue;
      const w = 0.5 + 0.5 * Math.cos((Math.PI * k) / half);
      // fade the note's edges so syllables never click
      const edge = Math.min(1, (o + k + 1) / 220, (len - o - k) / 330);
      out[j] += x[i] * w * Math.max(0, edge);
    }
    o += Math.max(40, Math.round(tOut));
  }
}

const wav = (pcm: Float32Array): Blob => {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const w = (o: number, t: string) => [...t].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let k = 0; k < pcm.length; k++) v.setInt16(44 + k * 2, Math.max(-1, Math.min(1, pcm[k])) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
};

/** A recording (any format the browser decodes) → the kororin's song as WAV. */
export async function singKororin(audio: Blob | ArrayBuffer, words = '', oh = false): Promise<Blob> {
  const ctx = new OfflineAudioContext(1, 1, SR);
  const src = await ctx.decodeAudioData(audio instanceof Blob ? await audio.arrayBuffer() : audio.slice(0));
  // to mono at 44.1 kHz
  const conv = new OfflineAudioContext(1, Math.ceil(src.duration * SR), SR);
  const n0 = conv.createBufferSource();
  n0.buffer = src;
  n0.connect(conv.destination);
  n0.start();
  const x = (await conv.startRendering()).getChannelData(0);

  const fr = analyse(x);
  const segs = syllables(fr);
  if (!segs.length) throw new Error('silent');
  const voiced = fr.map((f) => f.f0).filter(Boolean).sort((p, q) => p - q);
  const median = voiced.length ? voiced[Math.floor(voiced.length / 2)] : 220;
  // every kororin is in A (the octave nearest the speaker) at the same BPM, so kororins laid side by side join
  // into a relay (M-R153)
  const root = 440 * Math.pow(2, Math.round(Math.log2(median / 440) - 5 / 12)); // the melody's middle sits on the voice
  const mel = MELODIES[[...words].reduce((h, c) => h + c.charCodeAt(0), segs.length) % MELODIES.length];
  // sixteenths when there are many syllables (keeps a long take under ~12 s), eighths otherwise
  const eighth = (60 / BPM / 2) * SR;
  const step = segs.length > 24 ? eighth / 2 : eighth;
  const lead = Math.round(0.15 * SR);
  // 「♪オー！」 (the relay's last note, M-R153): the take's longest voiced sound, held on the melody's middle note
  // (the same pitch for every voice, so they stack)
  const longest = segs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  const notes: { s: [number, number]; rest: number; steps: number; hz?: number }[] = oh ? [{ s: longest, rest: 0, steps: 6, hz: root * Math.pow(2, stepSemis(2) / 12) }] : segs.map((s, k) => {
    // a syllable that ran long, or the last one, holds for two steps; a pause in the take is a rest
    const gap = k > 0 ? s[0] - segs[k - 1][1] : 0;
    return { s, rest: gap > 25 ? 1 : 0, steps: k === segs.length - 1 ? 3 : s[1] - s[0] > 30 ? 2 : 1 };
  });
  const total = notes.reduce((t, nt) => t + (nt.steps + nt.rest) * step, 0);
  const dry = new Float32Array(Math.ceil(lead + total + SR * 0.2));
  let t = lead;
  notes.forEach((nt, k) => {
    t += nt.rest * step;
    const len = Math.round(nt.steps * step * 0.92);
    const hz = nt.hz ?? root * Math.pow(2, stepSemis(mel[k % mel.length]) / 12);
    place(x, fr, nt.s, dry, Math.round(t), len, hz);
    t += nt.steps * step;
  });
  // level
  let pk = 0;
  for (let k = 0; k < dry.length; k++) pk = Math.max(pk, Math.abs(dry[k]));
  if (pk > 0) for (let k = 0; k < dry.length; k++) dry[k] *= 0.8 / pk;

  // the room and the echo
  const tail = 1.6;
  const off = new OfflineAudioContext(1, dry.length + Math.ceil(tail * SR), SR);
  const buf = off.createBuffer(1, dry.length, SR);
  buf.copyToChannel(dry, 0);
  const play = off.createBufferSource();
  play.buffer = buf;
  const ir = off.createBuffer(1, Math.ceil(SR * 1.2), SR);
  const irD = ir.getChannelData(0);
  for (let k = 0; k < irD.length; k++) irD[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / irD.length, 3);
  const verb = off.createConvolver();
  verb.buffer = ir;
  const verbGain = off.createGain();
  verbGain.gain.value = 0.18;
  const echo = off.createDelay(2);
  echo.delayTime.value = (eighth * 1.5) / SR;
  const fb = off.createGain();
  fb.gain.value = 0.28;
  const echoTone = off.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 3200;
  const echoGain = off.createGain();
  echoGain.gain.value = 0.22;
  play.connect(off.destination);
  play.connect(verb).connect(verbGain).connect(off.destination);
  play.connect(echo).connect(echoTone).connect(fb).connect(echo);
  echoTone.connect(echoGain).connect(off.destination);
  play.start();
  return wav((await off.startRendering()).getChannelData(0));
}

/** The same, from an audio URL (the story's own kororins); null when it cannot be sung. */
export async function singUrl(url: string, words = '', oh = false): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return URL.createObjectURL(await singKororin(await r.arrayBuffer(), words, oh));
  } catch {
    return null;
  }
}
