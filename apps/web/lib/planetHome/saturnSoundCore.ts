/**
 * M-R275 (decisions_round20 M-R275; design/home/template.html popSound / playVoice): Saturn's sounds on the one shared
 * AudioContext (the one lib/onboarding/audio.ts unlocks on the first tap) — the soap-bubble pop at the moment a ball
 * bursts, and the maker's voice (their Fish read-aloud mp3, decoded) through an AudioBufferSourceNode 300 ms after it,
 * so the pops on a timer in club mode are never blocked like an <audio> started outside a tap. While a voice plays the
 * club music dips to 0.16 and comes back to 0.5 after the voice's length + 0.1 s. Pure: the context is passed in.
 */
export const VOICE_DELAY_MS = 300;
export const MUSIC_GAIN = 0.5;
export const MUSIC_DUCKED = 0.16;

/** a tiny rising "plip" (a sine 520→1900 Hz over 45 ms) and a soft click (30 ms of noise through a 4200 Hz band) */
export function popSound(c: BaseAudioContext, out: AudioNode = c.destination) {
  const t0 = c.currentTime + 0.005;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(520, t0);
  o.frequency.exponentialRampToValueAtTime(1900, t0 + 0.045);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.55, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
  o.connect(g);
  g.connect(out);
  o.start(t0);
  o.stop(t0 + 0.13);
  const len = Math.max(1, Math.floor(c.sampleRate * 0.03));
  const bf = c.createBuffer(1, len, c.sampleRate);
  const d = bf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const n = c.createBufferSource();
  n.buffer = bf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 4200;
  f.Q.value = 0.8;
  const g2 = c.createGain();
  g2.gain.value = 0.35;
  n.connect(f);
  f.connect(g2);
  g2.connect(out);
  n.start(t0);
}

/** the club music's gain dips while a voice of `seconds` plays */
export function duck(c: BaseAudioContext, gain: AudioParam, seconds: number) {
  const t0 = c.currentTime;
  gain.cancelScheduledValues(t0);
  gain.setTargetAtTime(MUSIC_DUCKED, t0, 0.04);
  gain.setTargetAtTime(MUSIC_GAIN, t0 + seconds + 0.1, 0.25);
}

/** one voice, now, on its own source (voices may overlap; none stops another). Returns its length in seconds. */
export function playBuffer(c: BaseAudioContext, buf: AudioBuffer, out: AudioNode = c.destination, music?: AudioParam | null): number {
  const s = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = 1.15;
  s.buffer = buf;
  s.connect(g);
  g.connect(out);
  s.start();
  if (music) duck(c, music, buf.duration);
  return buf.duration;
}

/** a voice URL Web Audio can fetch and decode (the lab's / demo's tts: words are not one) */
export const decodable = (url: string | null | undefined): url is string => !!url && !/^tts:/.test(url);
