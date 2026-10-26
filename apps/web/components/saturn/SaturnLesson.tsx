'use client';

import { KORORIN_VOICE_STYLE, neoVoiceUrl, type SaturnPostView } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { Choice, DecisionButton } from '@/components/story/parts';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { spriteUrl } from '@/lib/onboarding/media';
import { LineVoice, lineVoiceUrl } from '@/lib/story/lineVoice';
import { KororinWorld } from './KororinWorld';

/**
 * Day 3 on Saturn (D04-S005〜S006; story 9ec42f9, M-R85 — client 2026-10-25). The voice comes out for the
 * first time here, on the real Saturn world (ころりんぱ):
 *  1. outside the temple, round Saturn stones: you blow words into a stone, your {bati} touches it and it
 *     becomes a kororin that speaks your words in your own voice two semitones up (KIMORIN⭐︎ first, with
 *     うんちピンポンくん; a slip of paper with words to read for anyone who cannot think of any)
 *  2. after a spoken murmur: make {bati}'s voice your voice a little higher too? ［する／今のままでいい］
 *  3. the brother's how-to, then ［もうひとつ、つぶやいてみる／今日は、ここまで］ (topics to start from)
 *  4. the residents' ring: a kororin rolls to your feet — the sister's 「……今日の夕焼け、きれいだったわ。」 (story M-R107)
 * The mic is {bati} itself (a round button at the bottom); a small ⌨ in the corner is the way out for
 * anyone who cannot speak (then {bati}'s voice reads the kororin). The lines are the story's.
 */
type Who = 'brother' | 'sister' | 'kimorin' | 'pinpon' | 'bati' | 'guide';
type Beat =
  | { k: 'say'; who: Who; text: string; drop?: 'kimorin'; star?: boolean }
  | { k: 'note'; text: string }
  | { k: 'recNormal'; prompt: 'first' | 'topics' }
  | { k: 'listen'; id: 'kimorin' | 'mine' | 'sunset'; text?: string }
  | { k: 'batiVoice' }
  | { k: 'choice' }
  | { k: 'done' };

const SPEAKER: Record<Who, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const NAMES: Record<Who, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN⭐︎', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { brother: 'takoyaki-brother', sister: 'takoyaki-sister', kimorin: 'kimorin-sun', pinpon: 'unchi-pinpon' };

/** KIMORIN⭐︎'s words for the stone (his kororin says them in his voice two semitones up) */
/** the residents' kororin that rolls to your feet on Saturn (story M-R107) */
const SISTER_SUNSET = '……今日の夕焼け、きれいだったわ。';
const KIMORIN_STONE = 'ぷりぷりぷりり！ぷりぷりぷりり！うひょひょひょげへへ！ぷりぷりぷりりり！うん！うん！うんちピンポーン大正かーい！ぷり！げへへへ！ぷりぷり滑り台でボカーン！';
/** the slip of paper KIMORIN⭐︎ hands over, for anyone who cannot think of words */
const PAPER = 'ぷりぷりぷりり！うひょひょひょ！げへへ！うん！うん！うんちピンポーン！だいせいかーい！ぷり！げへへへ！ぷりぷりブランコでボカーン！';

const BEATS: Beat[] = [
  // D04-S005 コロリン: outside the temple, a heap of round Saturn stones
  { k: 'say', who: 'brother', text: '土星は原石の星だZE!!' },
  { k: 'say', who: 'sister', text: 'この原石になんでもいいから言葉を吹き込んでみるといいわ' },
  { k: 'say', who: 'kimorin', text: '本当になんでもいいんですか？' },
  { k: 'say', who: 'brother', text: 'なんでもいいZE!!' },
  { k: 'say', who: 'sister', text: '最初はお試しだから“こんにちは”とか、一言で大丈夫だわ。' },
  { k: 'say', who: 'kimorin', text: 'わかりました。\nでは、、。' },
  { k: 'say', who: 'kimorin', text: KIMORIN_STONE },
  { k: 'say', who: 'sister', text: '.....吹き込みが終わったら、バティが魔法で石をコロリンにしてくれるわ' }, // シーン……みんなが無言でKIMORINを見つめる
  { k: 'say', who: 'pinpon', text: 'ピンポーン！', drop: 'kimorin' }, // うんちピンポンくんが石にタッチ → KIMORINの見た目のコロリン
  { k: 'say', who: 'kimorin', text: 'なんですかこのかわいいたこ焼きは！' },
  { k: 'say', who: 'brother', text: 'これはコロリンだZE!!' },
  { k: 'say', who: 'sister', text: 'コロリンを、タップしてみるといいわ。' },
  { k: 'say', who: 'kimorin', text: 'タッチ..' },
  { k: 'listen', id: 'kimorin' },
  { k: 'say', who: 'kimorin', text: '楽しいですね。' }, // シーン……
  { k: 'say', who: 'sister', text: 'そう、コロリンは喋るの。' },
  { k: 'say', who: 'sister', text: '{neo}もやってみたらいいわ。' },
  { k: 'say', who: 'brother', text: 'なんでもいいから石に声を吹き込むんだZE！' },
  { k: 'say', who: 'kimorin', text: '思いつかない時は、これを読んでください。' },
  { k: 'note', text: `紙に書いてある言葉：\n${PAPER}` },
  { k: 'recNormal', prompt: 'first' },
  { k: 'listen', id: 'mine' },
  { k: 'note', text: '−1マナ' },
  { k: 'batiVoice' },
  { k: 'say', who: 'brother', text: '文字だけだと、冷たく見られたり、怒ってるように思われたりするZE。' },
  { k: 'say', who: 'brother', text: 'かわいいコロリンが声に出せば、そんな勘違いは起きないZE。' },
  { k: 'say', who: 'brother', text: '自分で思ったことや、感じたこと、思いついたことは、全部コロリンにしちゃえ。それは全部、大切な思い出だZE。' },
  { k: 'say', who: 'brother', text: 'つぶやいたコロリンは、全部、土星の空を、リングとなって舞うZE。' },
  { k: 'say', who: 'brother', text: 'つぶやいたコロリンは、自分の部屋に落としとけばいいんだZE。' },
  { k: 'say', who: 'brother', text: 'だから、メモ代わりにでも、日記代わりにでも、使えちゃうZE。' },
  { k: 'note', text: '〔🎙〕を押して、{bati}に向かって、独り言みたいにつぶやく（声を出せない時は、すみの⌨で文字でも）→ {bati}がコロリンにする → タップすると喋る → 〔自分の部屋に飛ばす〕\n人に届けられるのは、二周目の旅から' },
  { k: 'choice' },
  // D04-S006 土星の空のリング (story M-R107): a kororin rolls to your feet — the sister's sunset
  { k: 'note', text: '空を舞う住人たちのコロリンをタップすると、声が聞けます' },
  { k: 'listen', id: 'sunset' },
  { k: 'done' },
];
// the branch after the choice
const TRY: Beat[] = [{ k: 'recNormal', prompt: 'topics' }, { k: 'listen', id: 'mine' }, { k: 'note', text: '−1マナ' }, { k: 'say', who: 'bati', text: 'できた！　ボクが作った、{neo}のコロリン！' }, { k: 'note', text: 'コロリンは、あなたの部屋に、日付と時刻つきで残ります。誰にも送られません' }];
const SKIP: Beat[] = [{ k: 'say', who: 'sister', text: 'いいわ。つぶやきたくなったら、いつでもどうぞ。' }, { k: 'note', text: 'コロリンは、いつでも作れます（今日でなくても）' }];
const TOPICS = [
  { t: '今したいこと', ex: '滑り台でボカーン！' },
  { t: '最近驚いたこと', ex: 'え！？わき毛ってこんなに美味しいの？' },
  { t: 'やりたいこと', ex: 'ハグキフェチ集合' },
];

/** The story's own kororins (not saved anywhere; they live on this screen). */
const storyPost = (id: string, name: string, pic: string, text: string, url: string): SaturnPostView => ({
  id,
  author: { id: `story-${name}`, handle: name, displayName: name, pic },
  text,
  voiceUrl: url,
  voiceSource: 'default',
  voiceDurationSec: null,
  starCount: 0,
  starredByMe: false,
  createdAt: new Date().toISOString(),
});

const toBase64 = (b: Blob) =>
  new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => no(r.error);
    r.readAsDataURL(b);
  });

/** A recording two semitones up (pitch and pace together, like a sped-up tape) → WAV: the kororin's voice. */
async function upTwo(blob: Blob): Promise<Blob> {
  try {
    const rate = Math.pow(2, 2 / 12);
    const src = await new AudioContext().decodeAudioData(await blob.arrayBuffer());
    const off = new OfflineAudioContext(1, Math.ceil((src.length / rate) * (44100 / src.sampleRate)), 44100);
    const node = off.createBufferSource();
    node.buffer = src;
    node.playbackRate.value = rate;
    node.connect(off.destination);
    node.start();
    const out = await off.startRendering();
    const pcm = out.getChannelData(0);
    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const v = new DataView(buf);
    const w = (o: number, t: string) => [...t].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 44100, true); v.setUint32(28, 88200, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    for (let k = 0; k < pcm.length; k++) v.setInt16(44 + k * 2, Math.max(-1, Math.min(1, pcm[k])) * 0x7fff, true);
    return new Blob([buf], { type: 'audio/wav' });
  } catch {
    return blob;
  }
}

/** Record from the mic (tap to start, tap to stop). Gain control on, so a whisper is heard too. */
function useRecorder() {
  const [on, setOn] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const done = useRef<(b: Blob | null) => void>(() => undefined);
  const start = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const chunks: BlobPart[] = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        done.current(chunks.length ? new Blob(chunks, { type: r.mimeType || 'audio/webm' }) : null);
      };
      rec.current = r;
      r.start();
      setOn(true);
      return true;
    } catch {
      return false;
    }
  };
  const stop = () =>
    new Promise<Blob | null>((ok) => {
      done.current = ok;
      setOn(false);
      if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
      else ok(null);
    });
  return { on, start, stop };
}

export function SaturnLesson({ bati, neo, batiImage, onDone }: { bati: string; neo: string; batiImage?: string; onDone: (made: string[]) => void }) {
  const { me } = useAuth();
  const [beats, setBeats] = useState<Beat[]>(BEATS);
  const [i, setI] = useState(0);
  const [made, setMade] = useState<string[]>([]);
  const [extra, setExtra] = useState<SaturnPostView[]>([]);
  const [normal, setNormal] = useState<{ blob: Blob; text: string } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [micFail, setMicFail] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [star, setStar] = useState(false);
  const voice = useRef<LineVoice | null>(null);
  const rec = useRecorder();
  const beat = beats[i];
  const fill = (t: string) => t.replaceAll('{bati}', bati).replaceAll('{neo}', neo);
  const next = () => setI((n) => n + 1);

  useEffect(() => {
    const v = new LineVoice();
    v.unlock();
    voice.current = v;
    return () => v.dispose();
  }, []);
  // each line plays its voice; the story's kororins drop in with theirs
  useEffect(() => {
    if (!beat) return;
    if (beat.k === 'say') {
      void voice.current?.say(SPEAKER[beat.who], beat.text);
      if (beat.star) setStar(true);
      if (beat.drop === 'kimorin')
        void lineVoiceUrl('コロリン', KIMORIN_STONE).then((u) =>
          setExtra((x) => [storyPost('story-kimorin', 'KIMORIN⭐︎', spriteUrl('kimorin-face'), KIMORIN_STONE, u ?? neoVoiceUrl(KORORIN_VOICE_STYLE, null, KIMORIN_STONE)), ...x]),
        );
    }
    if (beat.k === 'listen' && beat.id === 'sunset')
      void lineVoiceUrl('コロリン', SISTER_SUNSET).then((u) =>
        setExtra((x) => [...x, storyPost('story-sunset', 'たこ焼きシスター', spriteUrl('takoyaki-sister'), SISTER_SUNSET, u ?? neoVoiceUrl(KORORIN_VOICE_STYLE, null, SISTER_SUNSET))]),
      );
    if (beat.k === 'done') onDone(made);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, beats]);

  // 1. words blown into a stone (spoken or typed) → {bati} touches it: a kororin in your own voice, two semitones up
  const murmur = async (blob: Blob | null, text: string) => {
    setBusy(true);
    let words = text.trim();
    try {
      if (blob && me && !words) {
        const up = await getApi().uploadVoice(blob);
        words = (await getApi().transcribe(up.id)).text.trim();
      }
    } catch {
      /* keep going with what we have */
    }
    if (!words) words = beat?.k === 'recNormal' && beat.prompt === 'first' ? PAPER : '……';
    const up = blob ? await upTwo(blob) : null;
    let post: SaturnPostView | null = null;
    try {
      if (me) {
        const voiceMediaId = up ? (await getApi().uploadVoice(up)).id : undefined;
        post = await getApi().createSaturnPost(voiceMediaId ? { text: words.slice(0, 140), voiceMediaId, room: true } : { text: words.slice(0, 140), voiceStyle: KORORIN_VOICE_STYLE, readBy: 'bati', room: true });
      }
    } catch {
      post = null;
    }
    // the story previews (nobody logged in): a kororin that lives on this screen, in the voice just recorded
    post ??= storyPost(`mine-${Date.now()}`, neo || 'あなた', '', words, up ? URL.createObjectURL(up) : neoVoiceUrl(KORORIN_VOICE_STYLE, null, words));
    setExtra((x) => [...x, { ...post!, id: post!.id }]);
    setMade((m) => [...m, words]);
    if (blob) setNormal({ blob, text: words });
    setTyped('');
    setTyping(false);
    setBusy(false);
    next();
  };

  const tapBati = async () => {
    if (busy || !beat) return;
    if (beat.k === 'recNormal' && !agreed) return setAsking(true);
    if (!rec.on) {
      if (await rec.start()) return setMicFail(false);
      setMicFail(true);
      if (beat.k === 'recNormal') setTyping(true);
      return;
    }
    const blob = await rec.stop();
    if (!blob) return;
    void murmur(blob, '');
  };

  // 2. {bati}'s voice: your voice two semitones up
  const batiVoice = async (yes: boolean) => {
    if (!yes || !normal) return next();
    setBusy(true);
    const line = fill('わあ！　ボク、{neo}と、おそろいの声になった！');
    let url: string | null = null;
    try {
      if (me) {
        await getApi().registerVoice({ slot: 'bati', audio: { mime: normal.blob.type || 'audio/webm', data: await toBase64(normal.blob) }, text: normal.text, pitch: 2 });
        url = (await getApi().speak({ slot: 'bati', text: line })).url;
      }
    } catch {
      url = null;
    }
    // play {bati}'s new voice (the preview: the murmur itself, two semitones up)
    const a = new Audio(url ?? URL.createObjectURL(normal.blob));
    if (!url) {
      a.playbackRate = Math.pow(2, 2 / 12);
      (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false;
    }
    void a.play().catch(() => undefined);
    setBusy(false);
    setBeats((b) => [...b.slice(0, i + 1), { k: 'say', who: 'bati', text: 'わあ！　ボク、{neo}と、おそろいの声になった！' }, ...b.slice(i + 1)]);
    next();
  };

  const choose = (tryMore: boolean) => {
    setBeats((b) => [...b.slice(0, i + 1), ...(tryMore ? TRY : SKIP), ...b.slice(i + 1)]);
    next();
  };

  const recording = beat?.k === 'recNormal';
  const coachWho: Who = beat?.k === 'say' ? beat.who : 'guide';
  const coachText =
    beat?.k === 'say'
      ? fill(beat.text)
      : beat?.k === 'note'
        ? fill(beat.text)
        : beat?.k === 'listen'
          ? '👆 コロリンをタップ'
          : beat?.k === 'batiVoice'
            ? fill('いまの普通の声を、少し高くして、{bati}の声にもする？')
            : beat?.k === 'choice'
              ? ''
              : '';

  return (
    <div className="fixed inset-0 z-[150]">
      <KororinWorld
        neoOnly
        roomOnly
        noBar
        extra={extra}
        events={{
          onListen: (p) => {
            if (beat?.k !== 'listen') return;
            const ok = beat.id === 'kimorin' ? p.id === 'story-kimorin' : beat.id === 'sunset' ? p.id === 'story-sunset' : !p.id.startsWith('story-');
            if (ok) next();
          },
        }}
        overlay={
          <>
            {star && <span className="pointer-events-none absolute bottom-[34%] left-1/2 z-[210] -translate-x-1/2 animate-[fadeUp_0.5s_ease-out] text-6xl text-amber-300 drop-shadow-[0_0_18px_rgba(255,214,120,0.9)]">★</span>}

            {/* the line (a thin band at the top so the planet stays in view) */}
            {coachText && (
              <div className="pointer-events-none absolute inset-x-0 top-[calc(70px+env(safe-area-inset-top))] z-[200] flex justify-center px-3">
                <div key={`${i}-${coachText}`} className="flex w-full max-w-md animate-[fadeUp_0.35s_ease-out] items-end gap-2">
                  {SPRITES[coachWho] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={spriteUrl(SPRITES[coachWho]!)} alt="" className="h-14 w-14 shrink-0 object-contain object-top drop-shadow" />
                  )}
                  {coachWho === 'bati' && batiImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={batiImage} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                  )}
                  <div className="min-w-0 flex-1 rounded-2xl bg-[rgba(20,12,36,0.72)] px-4 py-2.5 text-white shadow-lg backdrop-blur-sm">
                    {NAMES[coachWho] && <p className="text-[10.5px] tracking-[0.25em] text-amber-200/90">{coachWho === 'bati' ? bati : NAMES[coachWho]}</p>}
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{coachText}</p>
                  </div>
                </div>
              </div>
            )}
            {(beat?.k === 'say' || beat?.k === 'note') && <button className="absolute inset-0 z-[195]" aria-label="つぎへ" onClick={next} />}

            {/* {bati} is the mic: a round button at the bottom */}
            {recording && (
              <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex flex-col items-center px-5 pb-8">
                <p className="mb-3 max-w-sm rounded-2xl bg-[rgba(20,12,36,0.72)] px-4 py-2.5 text-center text-[14px] leading-relaxed text-white backdrop-blur-sm">
                  {beat?.k === 'recNormal' && beat.prompt === 'first' ? (
                    <>
                      石に、声を吹き込もう
                      <span className="mt-1 block text-[11px] text-white/75">思いつかない時は、紙の言葉を：{PAPER}</span>
                    </>
                  ) : (
                    <>
                      何を言うか迷ったら、お題から
                      <span className="mt-1 block text-[11px] text-white/75">{TOPICS.map((t) => `${t.t}（例「${t.ex}」）`).join('／')}</span>
                    </>
                  )}
                </p>
                {(
                  // a big, plain mic: tap to talk, tap again to stop ({bati} listens from its shoulder)
                  <button
                    onClick={() => void tapBati()}
                    disabled={busy}
                    className={`relative flex h-32 w-32 items-center justify-center rounded-full border-4 shadow-[0_8px_30px_rgba(60,20,90,0.45)] transition active:scale-95 disabled:opacity-60 ${rec.on ? 'border-rose-200 bg-gradient-to-b from-rose-400 to-rose-600' : 'border-amber-100 bg-gradient-to-b from-amber-300 to-orange-500'} ${!rec.on && !busy ? 'animate-[hintGlow_2.2s_ease-in-out_infinite]' : ''}`}
                    aria-label={rec.on ? '録音をとめる' : '録音する'}
                  >
                    {rec.on && <span className="absolute inset-0 animate-ping rounded-full bg-rose-300/50" />}
                    {rec.on ? (
                      <span className="relative h-11 w-11 rounded-lg bg-white" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="relative h-16 w-16 fill-white drop-shadow" aria-hidden>
                        <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V5a3.5 3.5 0 0 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z" />
                        <path d="M18.5 11a.9.9 0 0 0-1.8 0 4.7 4.7 0 0 1-9.4 0 .9.9 0 0 0-1.8 0 6.5 6.5 0 0 0 5.6 6.4V20H8.8a.9.9 0 0 0 0 1.8h6.4a.9.9 0 0 0 0-1.8H12.9v-2.6a6.5 6.5 0 0 0 5.6-6.4Z" />
                      </svg>
                    )}
                    {batiImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={batiImage} alt="" className="absolute -left-3 -top-3 h-12 w-12 rounded-full border-2 border-white object-cover shadow" />
                    )}
                  </button>
                )}
                {(
                  <p className="mt-3 rounded-full bg-[rgba(20,12,36,0.72)] px-4 py-1.5 text-[14px] font-bold text-white">
                    {busy ? `${bati}が、コロリンにしているよ…` : rec.on ? '話しおわったら、もう一度タップ' : micFail ? 'マイクが使えないみたい' : 'タップして、話してね'}
                  </p>
                )}
                {/* the way out for anyone who cannot speak */}
                <button onClick={() => setTyping(true)} className="absolute bottom-[calc(14px+env(safe-area-inset-bottom))] right-4 p-2 text-lg text-white/45" aria-label="文字で入力">
                  ⌨
                </button>
              </div>
            )}

            {typing && beat?.k === 'recNormal' && (
              <div className="absolute inset-0 z-[230] flex items-end justify-center bg-black/50" onClick={() => setTyping(false)}>
                <div className="pb-safe w-full max-w-md rounded-t-3xl bg-white p-5 text-slate-800" onClick={(e) => e.stopPropagation()}>
                  <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={140} placeholder={beat.prompt === 'first' ? 'こんにちは' : 'いま思ったこと'} className="w-full border-b border-violet-300 py-2 text-[16px] outline-none" />
                  <button disabled={!typed.trim() || busy} onClick={() => void murmur(null, typed)} className="mt-4 w-full rounded-full bg-violet-500 py-3 font-black text-white disabled:opacity-40">
                    {bati}にコロリンにしてもらう
                  </button>
                </div>
              </div>
            )}

            {asking && (
              <div className="absolute inset-0 z-[240] flex items-center justify-center bg-black/60 px-6">
                <div className="w-full max-w-sm rounded-3xl bg-[rgba(14,10,24,0.95)] p-5 text-center text-amber-50">
                  <p className="text-[15px] leading-relaxed">吹きこんだ声は、あなたのコロリンの声としてだけ使います</p>
                  <div className="mt-4">
                    <DecisionButton
                      onClick={() => {
                        setAgreed(true);
                        setAsking(false);
                        void rec.start().then((ok) => !ok && setTyping(true));
                      }}
                    >
                      いいよ
                    </DecisionButton>
                  </div>
                  <button onClick={() => setAsking(false)} className="mt-3 text-sm text-white/55">
                    やめる
                  </button>
                </div>
              </div>
            )}

            {beat?.k === 'batiVoice' && (
              <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex flex-col items-end gap-2 px-4 pb-8">
                {normal ? (
                  <>
                    <Choice k={0} disabled={busy} onClick={() => void batiVoice(true)}>
                      する
                    </Choice>
                    <Choice k={1} disabled={busy} onClick={() => void batiVoice(false)}>
                      今のままでいい
                    </Choice>
                  </>
                ) : (
                  <BatiSkip onSkip={next} />
                )}
              </div>
            )}

            {beat?.k === 'choice' && (
              <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex flex-col items-end gap-2 px-4 pb-8">
                <Choice k={0} onClick={() => choose(true)}>
                  もうひとつ、つぶやいてみる
                </Choice>
                <Choice k={1} onClick={() => choose(false)}>
                  今日は、ここまで
                </Choice>
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

/** Typed murmurs have no voice to borrow: the question is skipped. */
function BatiSkip({ onSkip }: { onSkip: () => void }) {
  useEffect(() => {
    onSkip();
  }, [onSkip]);
  return null;
}
