import { z } from 'zod';

/**
 * Client 2026-11-27 (sample K): how a member's own recorded ダチ voice message is made to sound, and the member's own
 * settings for it — changed by talking to {bati} (「声の設定」「声を低くして」「もっとゆっくり」「オートチューンをなしに」
 * 「もとの声に近づけて」「間をつめないで」「もとにもどす」).
 *
 * The default (apps/api/src/voice/voice-mix.ts): clean (rumble out, strong noise removal, a gate) → the parts where
 * nobody speaks are cut short (`cut`) → a light pitch correction (`tune`, 0.6) → 1.8× faster and 2 semitones higher
 * (`speed`, `key`; formants not kept — that is the approved sound) → one loudness. The key was +6 in the morning's
 * sample K; the client, after trying it, made it +2 (the rest of the chain as it was). A member who saved settings of
 * their own keeps them (they are kept whole); 「もとにもどす」 is this default.
 *
 * The SENDER never hears their own voice (client 2026-11-27, after trying it: most people dislike their own recording):
 * there is nothing to listen to here — {bati} says the new settings in words.
 *
 * Kept per member in users.onboarding_json['voice.dachi'] (a JSON string; no migration), clamped on the server. They
 * apply to the member's own recorded voice only — never to the default cute voice of a member who is not recorded.
 */
export interface VoiceTune {
  /** the key, in semitones (−6 … +8) */
  key: number;
  /** the speed (1.0 … 2.0) */
  speed: number;
  /** the pitch correction's strength (0 = none … 1 = every note pulled onto the scale) */
  tune: number;
  /** 「間をつめる」: the parts where nobody speaks are cut short */
  cut: boolean;
}
export const VOICE_TUNE_DEFAULT: Readonly<VoiceTune> = Object.freeze({ key: 2, speed: 1.8, tune: 0.6, cut: true });
export const VOICE_TUNE_LIMITS = { key: [-6, 8], speed: [1, 2], tune: [0, 1] } as const;
/** users.onboarding_json key */
export const VOICE_TUNE_KEY = 'voice.dachi';

const num = (v: unknown, d: number, [lo, hi]: readonly [number, number], step: number): number => {
  const x = typeof v === 'number' && Number.isFinite(v) ? v : d;
  // (+1e-9: 0.15 / 0.1 is 1.4999… in floating point; a half goes up)
  return Math.round(Math.min(hi, Math.max(lo, x)) / step + 1e-9) * step;
};
const r1 = (x: number) => Math.round(x * 10) / 10;
/** any value → settings inside the limits (the key in whole semitones, the speed and strength in tenths); a missing part is the default */
export function clampVoiceTune(v: unknown, base: VoiceTune = VOICE_TUNE_DEFAULT): VoiceTune {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    key: num(o.key, base.key, VOICE_TUNE_LIMITS.key, 1),
    speed: r1(num(o.speed, base.speed, VOICE_TUNE_LIMITS.speed, 0.1)),
    tune: r1(num(o.tune, base.tune, VOICE_TUNE_LIMITS.tune, 0.1)),
    cut: typeof o.cut === 'boolean' ? o.cut : base.cut,
  };
}
/** the member's settings as kept (onboarding_json): none, or something unreadable = the default */
export function voiceTuneOf(onboarding: unknown): VoiceTune {
  const raw = (onboarding as Record<string, unknown> | null | undefined)?.[VOICE_TUNE_KEY];
  if (typeof raw !== 'string' || !raw) return { ...VOICE_TUNE_DEFAULT };
  try {
    return clampVoiceTune(JSON.parse(raw));
  } catch {
    return { ...VOICE_TUNE_DEFAULT };
  }
}
export const sameVoiceTune = (a: VoiceTune, b: VoiceTune): boolean => a.key === b.key && a.speed === b.speed && a.tune === b.tune && a.cut === b.cut;
export const isDefaultVoiceTune = (t: VoiceTune): boolean => sameVoiceTune(t, VOICE_TUNE_DEFAULT);
/** semitones → the pitch ratio (2 → 1.122462) */
export const semitoneRatio = (semitones: number): number => Math.round(2 ** (semitones / 12) * 1e6) / 1e6;

/** PUT /dachi/voice/tune: the parts to change (clamped on the server), or `reset` = back to the default */
export const VoiceTuneBody = z.object({
  key: z.number().finite().optional(),
  speed: z.number().finite().optional(),
  tune: z.number().finite().optional(),
  cut: z.boolean().optional(),
  reset: z.boolean().optional(),
});
export type VoiceTuneBody = z.infer<typeof VoiceTuneBody>;
/** GET / PUT /dachi/voice/tune */
export interface VoiceTuneView {
  tune: VoiceTune;
  /** the settings are the default ones */
  isDefault: boolean;
}

// ───────────────────────────── the words to {bati} ─────────────────────────────

/**
 * what the words mean: the settings asked about, set back, asked to be heard (they cannot be: `listen`), or changed to
 * `next` (`what`: the parts that moved)
 */
export type VoiceTuneTalk = { do: 'open' } | { do: 'limit' } | { do: 'reset' } | { do: 'listen' } | { do: 'set'; next: VoiceTune; what: (keyof VoiceTune)[] } | null;

/** half-width digits, no spaces */
const norm = (s: string) => s.replace(/[０-９．＋－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[−―](?=\d)/g, '-').replace(/\s+/g, '');
const VOICE = /声|こえ|コエ|ボイス|ボイメ/;
const SETTINGS = /(?:声|こえ|ボイス)の?(?:設定|せってい|加工|かこう|エフェクト)|ボイスチェンジ|ボイチェン/;
const TUNE = /オートチューン|ケロケロ|ケロ声|音程(?:の)?(?:補正|ほせい)|ピッチ補正/;
const GAP = /間(?:を|は)?(?:つめ|詰め|あけ|空け|そのまま|のこ|残)|(?:^|[^時人仲])間(?:が|を)?(?:長|なが)|無音|むおん|だまっ|黙っ/;
const SPEED = /速さ|はやさ|スピード|速度|テンポ|[\d.]+倍|ゆっくり|おそ[くめい]|遅[くめい]|はや[くめい]|速[くめい]|早[くめい]|早口|はやくち/;
const KEYW = /キー|高さ|たかさ|ピッチ|低[くめい]|ひく[くめい]|高[くめい]|たか[くめい]/;
const RESET = /もとにもど|元に戻|もとに戻|元にもど|リセット|最初(?:の設定)?に(?:戻|もど)|はじめ(?:の設定)?に(?:戻|もど)|デフォルト|初期設定/;
const LISTEN = /^(?:きいてみ|聞いてみ|聴いてみ|きかせて|聞かせて|聴かせて|ためし|試し|プレビュー|どんな(?:声|こえ|感じ|かんじ))/;
const MORE = /すごく|かなり|めっちゃ|超|ぐっと|うんと/;
const LITTLE = /(?:少|すこ)し|ちょっと|ちょい|やや/;
const OFF = /な[しく]|無し|オフ|切っ|きっ|やめ|いらな|要らな|はずし|外し|つけな|かけな|消し|けし/;
const ON = /オン|あり|つけて|かけて|入れて|いれて|ほしい|欲しい|して/;

/**
 * The words about the voice settings. `inTalk`: the turn before was about them, so short words count too (「もっとゆっくり」
 * 「もとにもどす」; 「きいてみたい」 gets the line that one's own voice is not played back); outside it the words must name the voice (声 / オートチューン / 間をつめる …) — 「もっと
 * ゆっくり」 alone may be about a song. null: not about the voice settings.
 */
export function voiceTuneTalk(said: string, now: VoiceTune = VOICE_TUNE_DEFAULT, inTalk = false): VoiceTuneTalk {
  const s = norm(said.trim());
  if (!s || s.length > 60) return null;
  const voice = VOICE.test(s);
  const named = SETTINGS.test(s) || TUNE.test(s) || /間(?:を|は)?(?:つめ|詰め)/.test(s) || (voice && (KEYW.test(s) || SPEED.test(s) || GAP.test(s) || RESET.test(s) || /もとの声|元の声|自分の声|じぶんの声|地声|じごえ|そのままの声|ふつうの声|普通の声/.test(s)));
  if (!named && !inTalk) return null;
  if (inTalk && LISTEN.test(s)) return { do: 'listen' };
  if (RESET.test(s)) return { do: 'reset' };

  const next: VoiceTune = { ...now };
  const step = (big: number, small: number, normal: number) => (MORE.test(s) ? big : LITTLE.test(s) ? small : normal);

  // 「もとの声に近づけて」: half-way back to the voice as recorded; 「もとの声のままで」「加工なし」: the voice as recorded
  if (/(?:もと|元|自分|じぶん)の(?:声|こえ)に(?:近|ちか)|地声に(?:近|ちか)|(?:加工|かこう|エフェクト)を?(?:弱|よわ|少な|すくな|へら|減ら)/.test(s)) {
    next.key = Math.trunc(now.key / 2);
    next.speed = 1 + (now.speed - 1) / 2;
    next.tune = now.tune / 2;
  } else if (/(?:もと|元|自分|じぶん|そのまま|ふつう|普通)の(?:声|こえ)(?:のまま|で|に(?:して|もど|戻)|がいい)|地声(?:で|に|のまま|がいい)|(?:加工|かこう|エフェクト)(?:を|は)?(?:な[しく]|無し|オフ|やめ|いらな|しない)/.test(s)) {
    next.key = 0;
    next.speed = 1;
    next.tune = 0;
  } else {
    // the pitch correction: none / on / stronger / weaker / a number (「オートチューンを0.8に」「80%に」)
    if (TUNE.test(s)) {
      const pct = /(\d{1,3})(?:%|％|パーセント)/.exec(s);
      const n = /(?:チューン|補正|ケロケロ)\D{0,3}?(\d(?:\.\d+)?)(?!\d*倍)/.exec(s);
      if (pct) next.tune = Number(pct[1]) / 100;
      else if (n) next.tune = Number(n[1]);
      else if (/最大|MAX|マックス|いちばん(?:強|つよ)|ばりばり|バリバリ/i.test(s)) next.tune = 1;
      else if (/強[くめい]|つよ[くめい]/.test(s)) next.tune = now.tune + step(0.4, 0.1, 0.2);
      else if (/弱[くめい]|よわ[くめい]/.test(s)) next.tune = now.tune - step(0.4, 0.1, 0.2);
      else if (OFF.test(s)) next.tune = 0;
      else if (ON.test(s)) next.tune = now.tune > 0 ? now.tune : VOICE_TUNE_DEFAULT.tune;
    }
    // 「間をつめる」 on / off
    if (GAP.test(s)) next.cut = !/つめな|詰めな|つめず|詰めず|あけ|空け|そのまま|のこ|残|(?:つめ|詰め)(?:るの)?(?:を|は)?(?:な[しく]|オフ|やめ)/.test(s);
    // the speed: a number of times, slower / faster
    const times = /(\d(?:\.\d+)?)倍/.exec(s);
    if (times) next.speed = Number(times[1]);
    else if (/ゆっくり|おそ[くめい]|遅[くめい]/.test(s)) next.speed = now.speed - step(0.4, 0.1, 0.2);
    else if (/はや[くめい]|速[くめい]|早[くめい]|早口|はやくち/.test(s)) next.speed = now.speed + step(0.4, 0.1, 0.2);
    else if (/(?:速さ|はやさ|スピード|速度|テンポ)(?:を|は)?(?:ふつう|普通|そのまま|もとの)/.test(s)) next.speed = 1;
    // the key: a number of semitones (「キーを+3に」「キーを-2」), lower / higher
    const semis = /(?:キー|ピッチ|高さ|たかさ)\D{0,3}?([+-]?\d{1,2})(?![\d.]*倍)/.exec(s);
    if (semis) next.key = Number(semis[1]);
    else if (/低[くめい]|ひく[くめい]/.test(s)) next.key = now.key - step(4, 1, 2);
    else if (/高[くめい]|たか[くめい]/.test(s)) next.key = now.key + step(4, 1, 2);
    else if (/(?:キー|高さ|たかさ|ピッチ)(?:を|は)?(?:ふつう|普通|そのまま|もとの)/.test(s)) next.key = 0;
  }
  const clamped = clampVoiceTune(next, now);
  const what = (['key', 'speed', 'tune', 'cut'] as const).filter((k) => clamped[k] !== now[k]);
  if (what.length) return { do: 'set', next: clamped, what };
  // a change asked for that is already at the end of its range
  if (next.key !== now.key || next.speed !== now.speed || next.tune !== now.tune) return { do: 'limit' };
  // the settings were named with nothing to change (「声の設定」): {bati} says where they are; else another matter
  return named ? { do: 'open' } : null;
}

/** the settings in words (「キー +2・はやさ 1.8倍・オートチューン 0.6・間をつめる」) */
export function voiceTuneWords(t: VoiceTune): string {
  const key = t.key > 0 ? `+${t.key}` : String(t.key);
  return `キー ${key}・はやさ ${t.speed.toFixed(1)}倍・オートチューン ${t.tune ? t.tune.toFixed(1) : 'なし'}・${t.cut ? '間をつめる' : '間はそのまま'}`;
}

/** the chips under {bati}'s answer (their words come back as the member's next words) */
export const VOICE_TUNE_CHIPS = { reset: 'もとにもどす' } as const;

/** {bati}'s lines (PROVISIONAL: the story session confirms them). {now} = voiceTuneWords */
export const VOICE_TUNE_LINES = {
  /** 「声の設定」: where they are, and what can be said */
  open: 'ダチに送る声の設定だね。いまは「{now}」だよ。「声を低くして」「もっとゆっくり」「オートチューンをなしに」「もとの声に近づけて」みたいに言ってね。',
  /** changed */
  changed: 'できたよ！ いまは「{now}」。つぎに送る声から、こうなるよ。',
  /** nothing moved: already at the end of the range */
  limit: 'これ以上は、変えられないみたい。いまは「{now}」だよ。',
  /** 「もとにもどす」 */
  reset: 'さいしょの設定にもどしたよ。いまは「{now}」。',
  /** 「きいてみたい」: one's own voice is not played back — it is for the ダチ to hear */
  noListen: 'じぶんの声は、ここでは流さないんだ。ダチに送って、どう聞こえたか聞いてみてね。いまは「{now}」だよ。',
  /** the change could not be kept */
  failed: 'ごめん、うまく変えられなかった。もう一回、言ってみて。',
  /** a member who is not recorded: there is no voice of their own to set */
  notRecorded: 'きみのダチへの声は、かわいい声が読んでくれるよ。だから、声の設定はないんだ。',
} as const;
export const VOICE_TUNE_LINE_TEXTS: string[] = Object.values(VOICE_TUNE_LINES);
