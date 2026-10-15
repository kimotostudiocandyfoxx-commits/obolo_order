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
 * Day 3 on Saturn (D04-S005〜S006, story 2026-10-15, M-R41 / production UI 13–15). The voice comes out for
 * the first time here, on the real Saturn world (ころりんぱ):
 *  1. KIMORIN⭐︎ in a tremendously funny voice: 「変な声出すの恥ずかしいー！」 → you blow the same line in,
 *     in a funny voice: that is your kororins' voice (agreed the first time; ▶ listen / この声にする / again)
 *  2. 「じゃあ次は、普通の声で…」: KIMORIN⭐︎ says it plainly → his kororin says it in his funny voice →
 *     you say it plainly → your kororin says it in your funny voice
 *  3. after a spoken murmur: make {bati}'s voice your voice a little higher (two semitones)? ［する／今のままでいい］
 *  4. the brother's how-to, then ［もうひとつ、つぶやいてみる／今日は、ここまで］ (topics to start from)
 *  5. the residents' ring, the brother's sneeze, KIMORIN⭐︎'s ☆
 * The mic is {bati} itself (a round button at the bottom); a small ⌨ in the corner is the way out for
 * anyone who cannot speak (then {bati}'s voice reads the kororin). The lines are the story's.
 */
type Who = 'brother' | 'sister' | 'kimorin' | 'pinpon' | 'bati' | 'guide';
type Beat =
  | { k: 'say'; who: Who; text: string; drop?: 'kimorin' | 'sneeze'; star?: boolean }
  | { k: 'note'; text: string }
  | { k: 'recWeird' }
  | { k: 'recNormal'; prompt: 'first' | 'topics' }
  | { k: 'listen'; id: 'kimorin' | 'mine' | 'sneeze'; text?: string }
  | { k: 'batiVoice' }
  | { k: 'choice' }
  | { k: 'done' };

const SPEAKER: Record<Who, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const NAMES: Record<Who, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN⭐︎', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { brother: 'takoyaki-brother', sister: 'takoyaki-sister', kimorin: 'kimorin-sun', pinpon: 'unchi-pinpon' };

const WEIRD = '変な声出すの恥ずかしいー！';
const PROMPT_FIRST = 'そんなこと言われても、なんて喋ればいいかわからない';
const KIMORIN_PLAIN = 'そんなこと言われたって、なんて喋ればいいかわかんない。';

const BEATS: Beat[] = [
  { k: 'say', who: 'kimorin', text: 'なんだこれ。' },
  { k: 'say', who: 'sister', text: '遊ぶ前に、まずは、声を作るわ。' },
  { k: 'say', who: 'brother', text: 'ひとこと吹きこむだけだZE。裏声でも、変な声でも、いいZE!!' },
  { k: 'say', who: 'kimorin', text: 'では、お手本を。' },
  { k: 'say', who: 'kimorin', text: WEIRD }, // 咳ばらい。とてつもなく変な声で
  { k: 'say', who: 'pinpon', text: 'ピンポン♪' },
  { k: 'say', who: 'kimorin', text: '……完璧です。' },
  { k: 'recWeird' },
  { k: 'say', who: 'sister', text: 'じゃあ次は、普通の声で、思ったことを、つぶやいてみて。' },
  { k: 'say', who: 'kimorin', text: KIMORIN_PLAIN }, // 普通の声で、うんちピンポンくんに向かって
  { k: 'say', who: 'kimorin', text: 'なんやこれ、たこ焼きになった！', drop: 'kimorin' }, // ピンポンくんが、KIMORINの顔のコロリンを錬成
  { k: 'say', who: 'sister', text: 'このたこ焼きのことを、コロリンというわ。' },
  { k: 'say', who: 'sister', text: 'コロリンを、タップしてみて。' },
  { k: 'listen', id: 'kimorin' },
  { k: 'say', who: 'kimorin', text: 'うわ、喋った！' },
  { k: 'say', who: 'sister', text: 'そう、コロリンは喋るの。' },
  { k: 'say', who: 'sister', text: '{neo}も、どうぞ。' },
  { k: 'recNormal', prompt: 'first' },
  { k: 'listen', id: 'mine' },
  { k: 'say', who: 'bati', text: 'あはは！　{neo}のコロリン、その声なんだ！' },
  { k: 'batiVoice' },
  { k: 'say', who: 'brother', text: '文字だけだと、冷たく見られたり、怒ってるように思われたりするZE。' },
  { k: 'say', who: 'brother', text: 'かわいいコロリンが声に出せば、そんな勘違いは起きないZE。' },
  { k: 'say', who: 'brother', text: '自分で思ったことや、感じたこと、思いついたことは、全部コロリンにしちゃえ。それは全部、大切な思い出だZE。' },
  { k: 'say', who: 'brother', text: 'つぶやいたコロリンは、全部、土星の空を、リングとなって舞うZE。' },
  { k: 'say', who: 'brother', text: 'そして、人に見せたいものだけを広場に飛ばし、見せないものは自分の部屋に飛ばせばいいんだZE。' },
  { k: 'say', who: 'brother', text: 'だから、メモ代わりにでも、日記代わりにでも、使えちゃうZE。' },
  { k: 'say', who: 'brother', text: 'みんなの広場に飛ばしたコロリンも、88時間経ったら、自分の部屋に帰ってくるZE。' },
  { k: 'note', text: '〔🎙〕を押して、{bati}に向かって、独り言みたいにつぶやく（声を出せない時は、すみの⌨で文字でも）→ {bati}がコロリンにする → タップすると喋る → 〔自分の部屋に飛ばす〕\n人に届けられるのは、二周目の旅から' },
  { k: 'choice' },
  // D04-S006 土星の空のリング
  { k: 'note', text: '土星の空を、住人たちのコロリンが、リングになって舞っている。\n広場のコロリンをタップすると、声が聞けます。☆を押すと「いいな」の印（☆の数は、どこにも出ません）' },
  { k: 'listen', id: 'sneeze' },
  { k: 'say', who: 'brother', text: '……俺のだZE。押すボタンを、間違えたZE。' },
  { k: 'say', who: 'brother', text: '……くしゃみに、星がついたZE。', star: true }, // KIMORINが〔☆〕を、そっと押す
  { k: 'say', who: 'sister', text: 'うまく言えなくても、くしゃみでも、いいの。出したら、それはもう、表現よ。' },
  { k: 'done' },
];
// the branch after the choice
const TRY: Beat[] = [{ k: 'recNormal', prompt: 'topics' }, { k: 'listen', id: 'mine' }, { k: 'say', who: 'bati', text: 'できた！　ボクが作った、{neo}のコロリン！' }, { k: 'note', text: 'コロリンは、あなたの部屋に、日付と時刻つきで残ります。誰にも送られません' }];
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
  const [weird, setWeird] = useState<{ blob: Blob; url: string } | null>(null);
  const [weirdSet, setWeirdSet] = useState(false);
  const [normal, setNormal] = useState<{ blob: Blob; text: string } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [typing, setTyping] = useState(false);
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
        void lineVoiceUrl('コロリン', KIMORIN_PLAIN).then((u) =>
          setExtra((x) => [storyPost('story-kimorin', 'KIMORIN⭐︎', spriteUrl('kimorin-face'), KIMORIN_PLAIN, u ?? neoVoiceUrl(KORORIN_VOICE_STYLE, null, KIMORIN_PLAIN)), ...x]),
        );
    }
    if (beat.k === 'listen' && beat.id === 'sneeze')
      void lineVoiceUrl('コロリン', '……へっくしゅん！').then((u) =>
        setExtra((x) => [...x, storyPost('story-sneeze', 'たこ焼きブラザー', spriteUrl('takoyaki-brother-face'), '……へっくしゅん！', u ?? neoVoiceUrl(KORORIN_VOICE_STYLE, null, '……へっくしゅん！'))]),
      );
    if (beat.k === 'done') onDone(made);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, beats]);

  // 1. the funny voice: becomes your kororins' voice
  const keepWeird = async () => {
    if (!weird) return;
    setBusy(true);
    try {
      if (me) await getApi().registerVoice({ slot: 'kororin', audio: { mime: weird.blob.type || 'audio/webm', data: await toBase64(weird.blob) } });
    } catch {
      /* the kororin falls back to {bati}'s voice */
    }
    setWeirdSet(true);
    setBusy(false);
    next();
  };

  // 2. a murmur (spoken or typed) → {bati} makes it a kororin → it lands in your room
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
    if (!words) words = beat?.k === 'recNormal' && beat.prompt === 'first' ? PROMPT_FIRST : '……';
    let post: SaturnPostView | null = null;
    try {
      if (me) post = await getApi().createSaturnPost({ text: words.slice(0, 140), voiceStyle: KORORIN_VOICE_STYLE, readBy: weirdSet ? 'kororin' : 'bati', room: true });
    } catch {
      post = null;
    }
    // the story previews (nobody logged in): a kororin that lives on this screen, in the funny voice recorded
    post ??= storyPost(`mine-${Date.now()}`, neo || 'あなた', '', words, weird?.url ?? neoVoiceUrl(KORORIN_VOICE_STYLE, null, words));
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
    if (beat.k === 'recWeird' && !agreed) return setAsking(true);
    if (!rec.on) {
      if (!(await rec.start())) setTyping(true);
      return;
    }
    const blob = await rec.stop();
    if (!blob) return;
    if (beat.k === 'recWeird') setWeird({ blob, url: URL.createObjectURL(blob) });
    else void murmur(blob, '');
  };

  // 3. {bati}'s voice: your voice two semitones up
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

  const recording = beat?.k === 'recWeird' || beat?.k === 'recNormal';
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
            const ok = beat.id === 'kimorin' ? p.id === 'story-kimorin' : beat.id === 'sneeze' ? p.id === 'story-sneeze' : !p.id.startsWith('story-');
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
                  {beat?.k === 'recWeird' ? (
                    <>
                      変な声で、言ってみよう「{WEIRD}」
                      <span className="mt-1 block text-[11px] text-white/75">その声に似せて、これからあなたのコロリンがしゃべります（いつでも吹きこみ直せます）</span>
                    </>
                  ) : beat?.k === 'recNormal' && beat.prompt === 'first' ? (
                    `「${PROMPT_FIRST}」`
                  ) : (
                    <>
                      何を言うか迷ったら、お題から
                      <span className="mt-1 block text-[11px] text-white/75">{TOPICS.map((t) => `${t.t}（例「${t.ex}」）`).join('／')}</span>
                    </>
                  )}
                </p>
                {beat?.k === 'recWeird' && weird && !rec.on ? (
                  <div className="flex flex-col items-center gap-2">
                    <Choice onClick={() => void new Audio(weird.url).play().catch(() => undefined)}>▶ 聞いてみる</Choice>
                    <Choice on disabled={busy} onClick={() => void keepWeird()}>
                      {busy ? '……' : 'この声にする'}
                    </Choice>
                    <Choice onClick={() => setWeird(null)}>吹きこみ直す</Choice>
                  </div>
                ) : (
                  <button onClick={() => void tapBati()} disabled={busy} className={`relative h-24 w-24 rounded-full border-2 p-1 transition ${rec.on ? 'border-rose-300 bg-rose-400/40' : 'border-white/80 bg-white/20'} disabled:opacity-60`} aria-label={rec.on ? '録音をとめる' : `${bati}に話しかける`}>
                    {rec.on && <span className="absolute inset-0 animate-ping rounded-full bg-rose-300/40" />}
                    {batiImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={batiImage} alt="" className="relative h-full w-full rounded-full object-cover" />
                    ) : (
                      <span className="relative flex h-full w-full items-center justify-center text-3xl">🎙</span>
                    )}
                    <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow">🎙</span>
                  </button>
                )}
                <p className="mt-2 h-4 text-[11px] font-bold text-[#4a2f78]">{busy ? `${bati}が、コロリンにしているよ…` : rec.on ? '話しおわったら、もう一度タップ' : ''}</p>
                {/* the way out for anyone who cannot speak */}
                <button onClick={() => (beat?.k === 'recWeird' ? next() : setTyping(true))} className="absolute bottom-[calc(14px+env(safe-area-inset-bottom))] right-4 p-2 text-lg text-white/45" aria-label="文字で入力">
                  ⌨
                </button>
              </div>
            )}

            {typing && beat?.k === 'recNormal' && (
              <div className="absolute inset-0 z-[230] flex items-end justify-center bg-black/50" onClick={() => setTyping(false)}>
                <div className="pb-safe w-full max-w-md rounded-t-3xl bg-white p-5 text-slate-800" onClick={(e) => e.stopPropagation()}>
                  <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={140} placeholder={beat.prompt === 'first' ? PROMPT_FIRST : 'いま思ったこと'} className="w-full border-b border-violet-300 py-2 text-[16px] outline-none" />
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
