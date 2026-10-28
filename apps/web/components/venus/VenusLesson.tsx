'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KIMORIN_JACKET, Sticker } from '@/components/jupiter/JupiterLesson';
import { Big, LessonShell, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { playSfx } from '@/components/onboarding/StoryExtras';
import { EasyDj } from '@/lib/dj/easy';
import type { MvMade, SongMade, StickerMade } from '@/lib/onboarding/made';
import { LineVoice, lineVoiceUrl } from '@/lib/story/lineVoice';

/**
 * Day 7 on Venus (first journey, story draft 21: D07V-S002〜S003; screens docs/story-rewrite/画面設計/venus.md
 * V-2 / V-5 / V-6). The easy DJ, held upright: the stage screen on top, two platters, 〔印〕〔SYNC〕, the
 * crossfader, 〔コロリン〕 (and 〔あかり〕 / 〔映像を選ぶ〕 kept quiet on the first day), 〔おまかせ〕 in the corner.
 * KIMORIN⭐︎ shows off first (『プリプリ・ボカン』 on both decks, 「すね毛楽しい」 three times), then the visitor
 * mixes from the practice rhythm into their own song — one step at a time (self) or 〔おまかせ〕 (pick three
 * materials, press 〔つなぐ〕) — the planet turns at the song's speed and the MV fills the stage screen; a
 * kororin is dropped at the seam. At night: 〔🎤 見せる〕 → 〔ダチへ〕 → 〔🎤 届ける〕, or not. No mana.
 * Only the step that comes next glows; touching anything else does nothing.
 */
type Who = 'bossg' | 'hatg' | 'longg' | 'kimorin' | 'guide';
type Line = { who: Who; text: string };
const SPEAKER: Record<Who, string> = { bossg: 'ボスG', hatg: 'ハットG', longg: 'ロングG', kimorin: 'KIMORIN', guide: '' };
const NAMES: Record<Who, string> = { bossg: 'ボスG', hatg: 'ハットG', longg: 'ロングG', kimorin: 'KIMORIN⭐︎', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { bossg: 'bossg', hatg: 'hatg', longg: 'longg', kimorin: 'kimorin-sun' };
const PRACTICE = '/onboarding/bgm-dj-practice.m4a';
const BALLAD = '/onboarding/bgm-kimorin-ballad.m4a';
/** Hat G's desk: each press of 〔あかり〕 is another colour */
const LIGHTS = ['#ff5ab4', '#5ad2ff', '#ffd25a', '#8a5aff', '#5aff9a'];
const PRACTICE_JACKET: StickerMade = { text: '練習用のリズム', url: null };

type Step =
  | { k: 'line'; l: Line }
  | { k: 'demo' } // KIMORIN⭐︎'s 『プリプリ・ボカン』 on both decks
  | { k: 'how' } // 〔一手ずつ、自分で回す〕〔〔おまかせ〕で回す〕〔今はここで止める〕
  | { k: 'load' } // ① both platters
  | { k: 'cue' } // ② the right rim, then 〔印〕
  | { k: 'sync' } // ③ 〔SYNC〕
  | { k: 'fade' } // ④ the crossfader to the right
  | { k: 'pick' } // おまかせ: three materials
  | { k: 'join' } // おまかせ: 〔つなぐ〕
  | { k: 'turning' } // the planet turns at the song's speed; the MV on the stage screen
  | { k: 'kororin' } // ⑤ 〔コロリン〕
  | { k: 'lights' } // the back booth: 〔あかり〕
  | { k: 'night' }
  | { k: 'show' } // 〔ダチに見せる〕〔見せない〕
  | { k: 'post' } // 〔🎤 見せる〕 → 〔ダチへ〕 → 〔🎤 届ける〕
  | { k: 'end' };
const L = (who: Who, text: string): Step => ({ k: 'line', l: { who, text } });

const OPEN: Step[] = [
  L('guide', '音が出ます。音を出せる場所か、イヤホンで遊んでください。回すのに、マナは使いません'),
  L('bossg', '回すのは、お前が作ったものだ。最初の一枚だけ、こっちで用意した。'),
  L('kimorin', 'では、お手本を。'),
  { k: 'demo' },
  L('kimorin', 'すね毛が、三倍ケン!!　……失礼。三倍です。'),
  L('bossg', '……一枚ずつ、つなげ。'),
  L('hatg', '左から右へ。一度だけ、だ。'),
  { k: 'how' },
];
const SELF: Step[] = [
  L('bossg', '台は、二つ。左で鳴らしながら、右で次を待たせる。'),
  L('bossg', '左の一枚が、練習用のリズムだ。……右の一枚が、お前の曲だ。'),
  { k: 'load' },
  L('hatg', '次の曲は、出だしに、印をつけておく。'),
  { k: 'cue' },
  L('longg', '……速さを、そろえろ。'),
  { k: 'sync' },
  L('bossg', 'つまみを、ゆっくり右へ。左が消えて、右が残る。それが、つなぐ、だ。'),
  { k: 'fade' },
];
const AUTO: Step[] = [L('bossg', '並べるのは、卓がやる。'), { k: 'pick' }, { k: 'join' }];
const AFTER: Step[] = [
  { k: 'turning' },
  L('guide', '{neo}が、回している'),
  L('kimorin', '……いま、この星を回しているのは、{neo}です。'),
  L('bossg', '……つながったな。それが、お前の曲だ。'),
  L('bossg', 'つなぎ目に、お前のコロリンを落としてもいい。'),
  { k: 'kororin' },
  L('hatg', '……いい所に、落としたな。'),
  { k: 'night' },
  L('bossg', 'いま回したセットを、誰に見せるかは、自分で決めろ。'),
  L('guide', '〔🎤 見せる〕を押すと、いま回したセット（音と映像）が録られ、ダチ（{inviter}とKIMORIN⭐︎）の夜空に88時間流れます。88時間たつと、あなたのステージの記録に戻ります。押さなければ録られず、どこにも送られません'),
  { k: 'show' },
];
/**
 * The back booth (second journey, L2-VENUS-S002): your song on both decks (the same record with the 〔印〕
 * somewhere else), SYNC, the fader at your speed, 〔あかり〕 from Hat G's desk. The night and 〔🎤 見せる〕 stay
 * in the story. `self`: they mixed by hand on the first journey (the gorillas say less).
 */
const booth = (self: boolean, kororin: boolean): Step[] => [
  L('guide', '左の台に、{neo}の曲。右の台にも、同じ一枚'),
  { k: 'load' },
  L('hatg', self ? '印は、出だしだけじゃない。' : '右のレコードの、入りたい所に、印をつける。'),
  L('hatg', 'サビの頭に置けば、いきなり山から入る。静かな所に置けば、そっと入る。'),
  { k: 'cue' },
  L('longg', self ? '……速さは、もう、そろえられるな。' : '……速さを、そろえろ。'),
  { k: 'sync' },
  L('bossg', 'つまみは、速さでも、語れる。'),
  L('bossg', 'ゆっくり回せば、二つの曲が、溶けあう。すっと回せば、ぱっと切りかわる。'),
  { k: 'fade' },
  L('hatg', '映像は、こっちの卓で、俺が見ている。'),
  L('hatg', 'つまみを回せば、映像も、いっしょに切りかわる。……ちがう絵を映したい時は、〔映像を選ぶ〕だ。'),
  L('hatg', '絵のない所は、光で照らせ。'),
  { k: 'lights' },
  { k: 'turning' },
  ...(kororin ? [{ k: 'kororin' } as Step] : []),
  { k: 'end' },
];
const SHOWN: Step[] = [{ k: 'post' }, L('guide', '届けました'), L('kimorin', '……私の夜空にも、届くのですね。では、今夜は、起きて待ちます。'), { k: 'end' }];
const NOT_SHOWN: Step[] = [L('bossg', '見せるのは、いつでもいい。'), { k: 'end' }];


export function VenusLesson({
  song,
  mv,
  kororins,
  neo,
  inviter,
  deliver,
  onDone,
  booth: inBooth,
  standee,
}: {
  /** the visitor standing (no background): big, in front of the deck while they mix (D07V-S002, R21b) */
  standee?: string;
  song: SongMade | null;
  mv: MvMade | null;
  kororins: string[];
  neo: string;
  inviter: string;
  /** 〔🎤 届ける〕: the set (your song and its MV) goes to the dachi's night sky */
  deliver?: (body: { kind: 'stage'; title?: string; url?: string; posterUrl?: string }) => Promise<void>;
  onDone: (r: { shown: boolean; mode: 'self' | 'auto' }) => void;
  /** the back booth of the second journey (your song into your song); `self` = mixed by hand on the first journey */
  booth?: { self: boolean };
}) {
  const [steps, setSteps] = useState<Step[]>(() => (inBooth ? booth(inBooth.self, kororins.length > 0) : OPEN));
  const [light, setLight] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<'self' | 'auto'>('self');
  const [hold, setHold] = useState(false);
  const [loaded, setLoaded] = useState<[boolean, boolean]>([false, false]);
  const [mark, setMark] = useState<number | null>(null);
  const [cued, setCued] = useState(false);
  const [synced, setSynced] = useState(false);
  const [fader, setFader] = useState(0);
  const [shown, setShown] = useState(false);
  const [post, setPost] = useState<'post' | 'to'>('post');
  const [drop, setDrop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const dj = useRef<EasyDj | null>(null);
  const voice = useRef<LineVoice | null>(null);
  const ballad = useRef<HTMLAudioElement>(null);
  const step = steps[i];
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{inviter}', inviter);
  const next = () => setI((x) => x + 1);
  const insert = (more: Step[]) => setSteps((s) => [...s.slice(0, i + 1), ...more, ...s.slice(i + 1)]);
  const right: StickerMade = song ? { text: song.words || song.title, url: song.jacket } : { text: '自分の曲', url: null };

  useEffect(() => {
    const v = new LineVoice();
    v.unlock();
    voice.current = v;
    return () => {
      v.dispose();
      dj.current?.close();
    };
  }, []);
  const engine = () => (dj.current ??= new EasyDj());
  // the platters turn while they play
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 120);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!step) return;
    if (step.k === 'line' && SPEAKER[step.l.who]) void voice.current?.say(SPEAKER[step.l.who], step.l.text);
    if (step.k === 'demo') {
      // KIMORIN⭐︎ throws the fader back and forth: 「すね毛楽しい」 three times
      const a = ballad.current;
      if (a) {
        a.currentTime = 0;
        void a.play().catch(() => undefined);
      }
      let n = 0;
      const t = setInterval(() => setFader(++n % 2 ? 1 : 0), 700);
      const done = setTimeout(() => {
        clearInterval(t);
        setFader(0);
        a?.pause();
        next();
      }, 6500);
      return () => {
        clearInterval(t);
        clearTimeout(done);
      };
    }
    if (step.k === 'pick') void buildSet();
    if (step.k === 'turning') {
      const t = setTimeout(next, 3800);
      return () => clearTimeout(t);
    }
    if (step.k === 'night') {
      dj.current?.fadeOut();
      const t = setTimeout(next, 1800);
      return () => clearTimeout(t);
    }
    if (step.k === 'end') onDone({ shown, mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // --- the decks --------------------------------------------------------------------------------------
  const loadDeck = async (k: 0 | 1) => {
    if (busy || loaded[k]) return;
    setBusy(true);
    try {
      const e = engine();
      await e.decks[k].load(k === 0 && !inBooth ? PRACTICE : (song?.url ?? PRACTICE), k === 0 && !inBooth ? 120 : null);
      if (k === 0) e.decks[0].play(0);
    } catch {
      /* no sound (no file / no audio): the steps still go on */
    }
    setLoaded((l) => (k === 0 ? [true, l[1]] : [l[0], true]));
    setBusy(false);
  };
  useEffect(() => {
    if (step?.k === 'load' && loaded[0] && loaded[1]) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, step]);
  const pressCue = () => {
    if (step?.k !== 'cue' || mark === null) return;
    const d = dj.current?.decks[1];
    if (d) {
      d.cue = (mark / 360) * Math.min(d.duration, 60);
      d.play(d.cue);
    }
    setCued(true);
    next();
  };
  const pressSync = () => {
    if (step?.k !== 'sync') return;
    dj.current?.sync();
    setSynced(true);
    next();
  };
  const moveFader = (x: number) => {
    if (step?.k !== 'fade' && step?.k !== 'demo') return;
    setFader(x);
    dj.current?.setFader(x);
    if (step.k === 'fade' && x > 0.92) {
      dj.current?.setFader(1);
      setFader(1);
      next();
    }
  };
  // おまかせ: the desk builds the set — practice on the left, your song on the right, cued and synced
  const buildSet = async () => {
    setBusy(true);
    const e = engine();
    try {
      await e.decks[0].load(PRACTICE, 120);
      e.decks[0].play(0);
      await e.decks[1].load(song?.url ?? PRACTICE);
      e.decks[1].play(0);
      e.sync();
    } catch {
      /* no sound */
    }
    setLoaded([true, true]);
    setCued(true);
    setSynced(true);
    setBusy(false);
    next();
  };
  const join = () => {
    if (step?.k !== 'join') return;
    let x = 0;
    const t = setInterval(() => {
      x = Math.min(1, x + 0.04);
      setFader(x);
      dj.current?.setFader(x);
      if (x >= 1) {
        clearInterval(t);
        next();
      }
    }, 90);
  };
  const dropKororin = async () => {
    if (step?.k !== 'kororin') return;
    const words = kororins[kororins.length - 1];
    setDrop(words ?? '……');
    playSfx('pop', false, 0.8);
    if (words) {
      const url = await lineVoiceUrl('コロリン', words).catch(() => null);
      if (url) void new Audio(url).play().catch(() => undefined);
      else if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(words);
        u.lang = 'ja-JP';
        u.pitch = 1.4;
        speechSynthesis.speak(u);
      }
    }
    setTimeout(() => {
      setDrop(null);
      next();
    }, 2600);
  };

  // --- the line on top ----------------------------------------------------------------------------------
  const lineOf = (l: Line): CoachLine => ({ sprite: SPRITES[l.who], name: NAMES[l.who] || undefined, text: fill(l.text) });
  let coach: CoachLine | null = null;
  let actions: ReactNode = null;
  if (step?.k === 'line') {
    coach = lineOf(step.l);
    actions = <NextButton onClick={next} />;
  } else if (step?.k === 'load') coach = { text: '①左右の台に、レコードをのせる（左の台は、のせるとすぐ鳴ります）' };
  else if (step?.k === 'cue') coach = { text: '②右のレコードの、鳴らしたい所を押して〔印〕（右の台が、印の所から回りはじめます。音は、つまみを動かすと聞こえます）' };
  else if (step?.k === 'sync') coach = { text: '③〔SYNC〕を押す（左右の拍がそろうと、光ります）' };
  else if (step?.k === 'fade') coach = { text: '④真ん中のつまみを、ゆっくり右へ' };
  else if (step?.k === 'join') coach = { text: '〔つなぐ〕が光ったら、押す' };
  else if (step?.k === 'lights') coach = { text: '〔あかり〕を押すと、ステージの光の色が変わります（押すたびに、ちがう色）' };
  else if (step?.k === 'kororin') coach = { text: '⑤つなぎ目で〔コロリン〕を押すと、自分のコロリンの声がひとつ落ちる' };

  const night = steps.findIndex((s) => s.k === 'night') <= i && steps.some((s) => s.k === 'night');
  const turning = steps.findIndex((s) => s.k === 'turning') <= i && steps.some((s) => s.k === 'turning') && !night;
  const demo = step?.k === 'demo';
  const glow = (on: boolean) => (on ? 'animate-[hintGlow_2.2s_ease-in-out_infinite] ring-4 ring-amber-200' : '');
  const deckOn = (k: 0 | 1) => (demo ? true : !!dj.current?.decks[k].playing);
  const spin = (k: 0 | 1) => (deckOn(k) ? ((Date.now() / (k ? 1000 / ((dj.current?.decks[1].rate ?? 1) * 1.1) : 909)) * 60) % 360 : 0);
  const showDesk = !night && step && !['how'].includes(step.k) && (i >= 3 || demo || !!inBooth);

  return (
    <LessonShell bg={night ? '/onboarding/s/venus-night.jpg' : '/onboarding/s/venus-stage.jpg'} coach={coach} actions={actions}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={ballad} src={BALLAD} preload="auto" />

      {showDesk && standee && !demo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={standee} alt="" className="pointer-events-none absolute bottom-[38%] left-1/2 z-[165] h-[46svh] -translate-x-1/2 object-contain drop-shadow-[0_0_30px_rgba(255,200,120,0.45)]" />
      )}
      {showDesk && (
        <div className="pb-safe absolute inset-x-0 bottom-0 z-[170] flex flex-col items-center gap-3 rounded-t-3xl bg-gradient-to-b from-[#1a1426]/85 to-[#0b0812]/95 px-4 pb-6 pt-4 text-white shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          {/* the stage screen: your MV (or KIMORIN⭐︎'s) once the mix is yours */}
          <div className={`relative aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-amber-200/40 bg-black ${turning ? 'shadow-[0_0_40px_rgba(255,200,120,0.6)]' : ''}`}>
            {demo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/onboarding/s/mv-kimorin-slide.jpg" alt="" className="h-full w-full animate-[kenBurns_12s_ease-in-out_infinite_alternate] object-cover" />
            ) : turning || step?.k === 'kororin' ? (
              mv ? (
                <video src={mv.url} poster={mv.poster ?? undefined} autoPlay muted loop playsInline className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full animate-pulse bg-[radial-gradient(circle,#ffb35c,#5a1e6e)]" />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] tracking-[0.3em] text-white/30">STAGE</div>
            )}
            {light && <span className="pointer-events-none absolute inset-0 mix-blend-screen transition-colors duration-500" style={{ background: `radial-gradient(circle at 50% 20%, ${light}, transparent 75%)` }} />}
            {drop && <span className="absolute inset-x-3 bottom-2 animate-[fadeUp_0.4s_ease-out] rounded-full bg-white/90 px-3 py-1 text-center text-[12px] font-bold text-violet-700">🪐 {drop.length > 24 ? `${drop.slice(0, 24)}…` : drop}</span>}
          </div>

          {/* the two platters, each with its square jacket */}
          <div className="flex w-full max-w-sm justify-between">
            {([0, 1] as const).map((k) => {
              const j = demo ? KIMORIN_JACKET : k === 0 && !inBooth ? PRACTICE_JACKET : right;
              const has = demo || loaded[k];
              const canLoad = step?.k === 'load' && !loaded[k];
              return (
                <div key={k} className="flex flex-col items-center gap-1">
                  <button
                    onClick={(e) => {
                      if (canLoad) return void loadDeck(k);
                      if (k === 1 && step?.k === 'cue') {
                        const r = e.currentTarget.getBoundingClientRect();
                        const a = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90;
                        setMark((a + 360) % 360);
                      }
                    }}
                    className={`relative h-[min(34vw,140px)] w-[min(34vw,140px)] rounded-full bg-[repeating-radial-gradient(circle,#111_0_2px,#222_2px_4px)] shadow-xl ${glow(canLoad || (k === 1 && step?.k === 'cue' && mark === null))} ${synced && !demo ? 'outline outline-2 outline-offset-2 outline-amber-300/70' : ''}`}
                    aria-label={k === 0 ? '左の台' : '右の台'}
                  >
                    {has ? (
                      <span className="absolute inset-[22%] overflow-hidden rounded-full" style={{ transform: `rotate(${spin(k)}deg)` }}>
                        <Sticker s={{ ...j, text: '' }} size={200} />
                      </span>
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] text-white/50">レコードを選ぶ</span>
                    )}
                    {k === 1 && mark !== null && (
                      <span className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_10px_#fcd34d]" style={{ transform: `rotate(${mark}deg) translateY(calc(-1 * min(17vw,70px) + 6px)) translate(-50%,-50%)`, transformOrigin: '0 0' }} />
                    )}
                  </button>
                  <span className="max-w-[min(34vw,140px)] truncate text-[11px] text-white/70">{has ? j.text : ''}</span>
                </div>
              );
            })}
          </div>

          {/* 〔印〕〔SYNC〕 */}
          <div className="flex gap-3">
            <button onClick={pressCue} disabled={step?.k !== 'cue' || mark === null} className={`rounded-xl px-6 py-2 text-sm font-black ${cued ? 'bg-amber-300 text-amber-900' : 'bg-white/10 text-white/80'} ${glow(step?.k === 'cue' && mark !== null)}`}>
              印
            </button>
            <button onClick={pressSync} disabled={step?.k !== 'sync'} className={`rounded-xl px-6 py-2 text-sm font-black ${synced ? 'bg-amber-300 text-amber-900' : 'bg-white/10 text-white/80'} ${glow(step?.k === 'sync')}`}>
              SYNC
            </button>
          </div>
          {/* the crossfader (the only thing moved with a finger) or 〔つなぐ〕 */}
          {mode === 'auto' && step?.k === 'join' ? (
            <button onClick={join} className={`w-full max-w-sm rounded-full bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-black text-white ${glow(true)}`}>
              つなぐ
            </button>
          ) : (
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(fader * 100)}
              onChange={(e) => moveFader(Number(e.target.value) / 100)}
              disabled={step?.k !== 'fade'}
              aria-label="つまみ"
              className={`w-full max-w-sm accent-amber-300 ${step?.k === 'fade' ? 'animate-pulse' : ''}`}
            />
          )}
          <div className="flex gap-2">
            <button onClick={() => void dropKororin()} disabled={step?.k !== 'kororin'} className={`rounded-xl px-4 py-2 text-[13px] font-black ${step?.k === 'kororin' ? 'bg-violet-400 text-white' : 'bg-white/10 text-white/60'} ${glow(step?.k === 'kororin')}`}>
              コロリン
            </button>
            <button
              onClick={() => {
                if (!inBooth || !(step?.k === 'lights' || light)) return;
                setLight((c) => LIGHTS[(LIGHTS.indexOf(c ?? '') + 1) % LIGHTS.length]);
                if (step?.k === 'lights') setTimeout(next, 1400);
              }}
              disabled={!inBooth || !(step?.k === 'lights' || light)}
              className={`rounded-xl px-3 py-2 text-[12px] ${inBooth && (step?.k === 'lights' || light) ? 'bg-white/15 text-white' : 'bg-white/5 text-white/40'} ${glow(step?.k === 'lights')}`}
            >
              あかり
            </button>
            <button disabled className="rounded-xl bg-white/5 px-3 py-2 text-[12px] text-white/40">
              映像を選ぶ
            </button>
          </div>
        </div>
      )}

      {step?.k === 'how' && (
        <Panel>
          {hold ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-slate-500">次は、ここから。閉じても、だいじょうぶです</p>
              <Big tone="amber" onClick={() => setHold(false)}>
                続ける
              </Big>
            </div>
          ) : (
            <div className="space-y-2">
              <Big
                tone="amber"
                onClick={() => {
                  setMode('self');
                  insert([...SELF, ...AFTER]);
                  next();
                }}
              >
                一手ずつ、自分で回す
              </Big>
              <Big
                tone="violet"
                onClick={() => {
                  setMode('auto');
                  insert([...AUTO, ...AFTER]);
                  next();
                }}
              >
                〔おまかせ〕で回す
              </Big>
              <Soft onClick={() => setHold(true)}>今はここで止める</Soft>
            </div>
          )}
        </Panel>
      )}
      {step?.k === 'pick' && (
        <Panel>
          <p className="text-center text-sm font-black text-violet-700">〔おまかせ〕</p>
          <p className="mt-1 text-center text-[11px] leading-relaxed text-slate-400">旅で作ったもの（曲・映像・コロリン・ジャケット）から、卓がセットを組みます。あなたが押すのは、つなぐ時と、コロリンを落とす時だけ</p>
          <p className="mt-3 animate-pulse text-center text-sm font-bold text-violet-500">卓が、棚の全部から、セットを組んでいます…</p>
        </Panel>
      )}
      {step?.k === 'show' && (
        <Panel>
          <div className="space-y-2">
            <Big
              tone="amber"
              onClick={() => {
                setShown(true);
                setPost('post');
                insert(SHOWN);
                next();
              }}
            >
              ダチに見せる
            </Big>
            <Soft
              onClick={() => {
                insert(NOT_SHOWN);
                next();
              }}
            >
              見せない
            </Soft>
          </div>
        </Panel>
      )}
      {step?.k === 'post' && (
        <Panel>
          {post === 'post' ? (
            <Big tone="amber" onClick={() => setPost('to')}>
              🎤 見せる
            </Big>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-[13px] text-slate-500">行き先</p>
              <div className="rounded-2xl bg-amber-50 p-3 text-center text-[14px] font-bold text-amber-700 ring-2 ring-amber-300">
                ダチへ（{inviter}・KIMORIN⭐︎）
              </div>
              <p className="text-center text-[11px] text-slate-400">いま回したセット（音と映像）が、88時間、ダチの夜空を流れます。88時間たつと、あなたのステージの記録に戻ります</p>
              <Big
                tone="amber"
                onClick={() => {
                  if (song) void deliver?.({ kind: 'stage', title: song.title.slice(0, 60), url: /^https?:/.test(song.url) ? song.url : undefined, posterUrl: mv?.poster ?? undefined }).catch(() => undefined);
                  next();
                }}
              >
                🎤 届ける
              </Big>
            </div>
          )}
        </Panel>
      )}
      {night && shown && steps.findIndex((s) => s.k === 'post') < i && (
        // the stage's light, one line straight up into the night sky
        <div className="pointer-events-none absolute bottom-[30svh] left-1/2 z-[160] h-[60svh] w-1 -translate-x-1/2 animate-[fadeUp_1.2s_ease-out] bg-gradient-to-t from-amber-200 via-amber-100/70 to-transparent blur-[1px]" />
      )}
    </LessonShell>
  );
}
