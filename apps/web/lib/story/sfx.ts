/**
 * Story sound effects that synthesise well (client plan 2026-10-13): sparkles, chimes, bells, magic,
 * whooshes, pops, knocks, KIMORIN's ピンポン, heartbeats… — made in the browser (no files, no licences).
 * Realistic sounds (doors, footsteps, waves) need recorded or generated files instead
 * (public/story/sound/, docs/story-import/assets.md lists which are still missing).
 *
 * `presetFor` guesses a preset from the script's 〔SE：…〕 text; design/story-sounds.json can set or
 * override it ("扉がきしんで開く": "none" / "knock" / a file).
 */
export const PRESETS = ['sparkle', 'chime', 'bell', 'gong', 'magic', 'whoosh', 'pop', 'boing', 'knock', 'ding', 'heartbeat', 'blip', 'thud'] as const;
export type Preset = (typeof PRESETS)[number];

const RULES: [RegExp, Preset][] = [
  [/ピンポン|呼び鈴|チャイム/, 'ding'],
  [/魔法|呪文|魔法陣|光が満ち|変身/, 'magic'],
  [/キラ|きら|輝|星が|光の粒|光る/, 'sparkle'],
  [/鐘|ベル|鈴/, 'bell'],
  [/銅鑼|ゴーン|ドラ/, 'gong'],
  [/風|ヒュー|ひゅう|飛ぶ|すべる|通り過ぎ|ロケット/, 'whoosh'],
  [/ポン|ぽん|はじけ|泡/, 'pop'],
  [/ボヨン|ぼよん|跳ね|バネ/, 'boing'],
  [/ノック|コンコン|叩く/, 'knock'],
  [/鼓動|ドクン|どくん|心臓/, 'heartbeat'],
  [/ドン|どすん|落ちる|着地|倒れ/, 'thud'],
  [/ピコ|ぴこ|電子音|ボタン|画面/, 'blip'],
  [/チーン|ちりん|風鈴|音叉/, 'chime'],
];

export function presetFor(text: string): Preset | null {
  for (const [re, p] of RULES) if (re.test(text)) return p;
  return null;
}

/** Play a preset on `ctx`, now. */
export function playPreset(ctx: AudioContext, p: Preset, volume = 0.5) {
  const t = ctx.currentTime + 0.01;
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(ctx.destination);
  const tone = (f: number, start: number, dur: number, type: OscillatorType = 'sine', level = 0.4, glideTo?: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(level, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(out);
    o.start(start);
    o.stop(start + dur + 0.05);
  };
  const noise = (start: number, dur: number, f: number, q: number, level: number, type: BiquadFilterType = 'bandpass', glideTo?: number) => {
    const b = ctx.createBuffer(1, Math.ceil(dur * ctx.sampleRate), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource();
    s.buffer = b;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, start);
    if (glideTo) fl.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(level, start + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(fl).connect(g).connect(out);
    s.start(start);
  };
  switch (p) {
    case 'sparkle':
      for (let k = 0; k < 7; k++) tone(2000 + Math.random() * 3000, t + k * 0.05, 0.35, 'sine', 0.18);
      break;
    case 'chime':
      [1318, 1760, 2637].forEach((f, k) => tone(f, t + k * 0.09, 1.4, 'sine', 0.25));
      break;
    case 'bell':
      for (const [f, l] of [[880, 0.35], [880 * 2.76, 0.12], [880 * 5.4, 0.06]] as const) tone(f, t, 2.2, 'sine', l);
      break;
    case 'gong':
      for (const [f, l] of [[110, 0.5], [110 * 1.48, 0.25], [110 * 2.31, 0.15], [110 * 3.9, 0.08]] as const) tone(f, t, 4, 'sine', l);
      noise(t, 0.4, 600, 0.7, 0.15);
      break;
    case 'magic':
      for (let k = 0; k < 10; k++) tone(500 * Math.pow(2, k / 6), t + k * 0.06, 0.6, 'triangle', 0.15);
      noise(t, 1.2, 3000, 2, 0.08, 'bandpass', 9000);
      break;
    case 'whoosh':
      noise(t, 0.7, 400, 1.5, 0.5, 'bandpass', 4000);
      break;
    case 'pop':
      tone(500, t, 0.12, 'sine', 0.6, 1400);
      break;
    case 'boing':
      tone(180, t, 0.5, 'triangle', 0.5, 520);
      break;
    case 'knock':
      for (const dt of [0, 0.16]) {
        tone(180, t + dt, 0.12, 'sine', 0.6, 90);
        noise(t + dt, 0.05, 1800, 1, 0.4);
      }
      break;
    case 'ding':
      tone(1046, t, 0.9, 'sine', 0.4);
      tone(784, t + 0.32, 1.2, 'sine', 0.4);
      break;
    case 'heartbeat':
      for (const dt of [0, 0.22]) tone(60, t + dt, 0.2, 'sine', 0.8, 40);
      break;
    case 'blip':
      tone(880, t, 0.08, 'square', 0.15);
      tone(1320, t + 0.08, 0.1, 'square', 0.15);
      break;
    case 'thud':
      tone(90, t, 0.35, 'sine', 0.8, 40);
      noise(t, 0.12, 300, 0.7, 0.4, 'lowpass');
      break;
  }
}
