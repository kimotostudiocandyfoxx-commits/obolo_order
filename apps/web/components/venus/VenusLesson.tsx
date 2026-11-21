'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KIMORIN_JACKET, Sticker } from '@/components/jupiter/JupiterLesson';
import { Big, LessonShell, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { playSfx } from '@/components/onboarding/StoryExtras';
import { EasyDj } from '@/lib/dj/easy';
import { BoothMixer } from '@/lib/venus/booth';
import type { MvMade, SongMade, StickerMade } from '@/lib/onboarding/made';
import { LineVoice, lineVoiceUrl } from '@/lib/story/lineVoice';

/**
 * Day 7 on Venus, the radio planet (simple version: P04/c01v.md D07V-S002〜S003, M-R190; screens
 * docs/story-rewrite/画面設計/venus.md V-2 / V-5 / V-6). The broadcast booth is the one place where making and
 * showing happen together, so there is no Moon atelier here. The easy DJ, held upright: Bluena goes into the
 * round hollow of the desk (DJ's USB), two platters, 〔印〕〔SYNC〕, the crossfader, 〔コロリン〕, 〔おまかせ〕.
 * KIMORIN⭐︎ shows off first (『プリプリ・ボカン』 on both decks), then the visitor mixes from the practice
 * rhythm into their own song — one step at a time (self) or 〔おまかせ〕 (the desk builds the set, they press
 * 〔つなぐ〕) — the planet turns at the song's speed, their art fills the booth glass with the MV looping round
 * it; a kororin is dropped at the seam. At night the first show: 〔⏺ 収録〕, a word into the mic (the music
 * ducks while they talk: lib/venus/booth.ts), their song, 〔■ 止める〕; then 〔🎤 見せる〕 → 〔ダチへ〕 →
 * 〔🎤 届ける〕 (ON AIR lights up), or keep it in Bluena. No mana. Only the step that comes next glows.
 * Character lines are written `who: '<alias>', text: '…'` so scripts/story-sync.ts checks them against the script.
 */
type Who = 'bossg' | 'hatg' | 'longg' | 'kimorin' | 'guide';
type Line = { who: Who; text: string };
const SPEAKER: Record<Who, string> = { bossg: 'ボスG', hatg: 'ハットG', longg: 'ロングG', kimorin: 'KIMORIN', guide: '' };
const NAMES: Record<Who, string> = { bossg: 'ボスG', hatg: 'ハットG', longg: 'ロングG', kimorin: 'KIMORIN⭐︎', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { bossg: 'bossg', hatg: 'hatg', longg: 'longg', kimorin: 'kimorin-sun' };
const PRACTICE = '/onboarding/bgm-dj-practice.m4a';
const BALLAD = '/onboarding/bgm-kimorin-ballad.m4a';
const BLUENA = '/onboarding/s/bluena.jpg';
/** Hat G's desk: each press of 〔あかり〕 is another colour */
const LIGHTS = ['#ff5ab4', '#5ad2ff', '#ffd25a', '#8a5aff', '#5aff9a'];
const PRACTICE_JACKET: StickerMade = { text: '練習用のリズム', url: null };

type Step =
  | { k: 'line'; l: Line }
  | { k: 'plug'; l: Line } // Bluena into the desk's round hollow (the line stays up until it is in)
  | { k: 'demo' } // KIMORIN⭐︎'s 『プリプリ・ボカン』 on both decks
  | { k: 'how' } // 〔一手ずつ、自分で回す〕〔〔おまかせ〕〕〔今はここで止める〕
  | { k: 'load' } // ① both platters
  | { k: 'cue' } // ② the right rim, then 〔印〕
  | { k: 'sync' } // ③ 〔SYNC〕
  | { k: 'fade' } // ④ the crossfader to the right
  | { k: 'pick' } // おまかせ: the desk builds the set from Bluena
  | { k: 'join' } // おまかせ: 〔つなぐ〕
  | { k: 'turning' } // the planet turns at the song's speed; the art on the booth glass, the MV round it
  | { k: 'kororin' } // ⑤ 〔コロリン〕
  | { k: 'lights' } // the back booth: 〔あかり〕
  | { k: 'stop' } // the song ends; the planet slowly stops
  | { k: 'night' }
  | { k: 'rec'; l: Line } // 〔⏺ 収録〕 → talk → the song → 〔■ 止める〕 (the line comes up once recording starts)
  | { k: 'show' } // 〔🎤 見せる〕〔今は、Bluenaにしまっておく〕
  | { k: 'post' } // 行き先〔ダチへ〕 → 〔🎤 届ける〕
  | { k: 'end' };
const L = (l: Line): Step => ({ k: 'line', l });
/** a 〔画面〕 note: words on the screen, no speaker */
const G = (text: string): Step => ({ k: 'line', l: { who: 'guide', text } });

// D07V-S002
const OPEN: Step[] = [
  { k: 'plug', l: { who: 'bossg', text: 'Bluenaを、差せ。DJの、USBと同じだ。' } },
  G('Bluenaの中の曲と声が、卓に読み込まれました'),
  L({ who: 'bossg', text: '回すのは、お前が作ったものだ。最初の一枚だけ、こっちで用意した。' }),
  G('音が出ます。音を出せる場所か、イヤホンで遊んでください。回すのに、マナは使いません'),
  L({ who: 'kimorin', text: 'では、お手本を。' }),
  { k: 'demo' },
  L({ who: 'kimorin', text: 'すね毛が、三倍ケン!!　……失礼。三倍です。' }),
  L({ who: 'bossg', text: '……一枚ずつ、つなげ。' }),
  { k: 'how' },
];
const SELF: Step[] = [
  L({ who: 'bossg', text: '台は、二つ。左で鳴らしながら、右で次を待たせる。' }),
  L({ who: 'bossg', text: '左の一枚が、練習用のリズムだ。……右の一枚が、お前の曲だ。' }),
  { k: 'load' },
  L({ who: 'bossg', text: '次の曲は、出だしに、印をつけておく。' }),
  { k: 'cue' },
  { k: 'sync' },
  L({ who: 'bossg', text: 'つまみを、ゆっくり右へ。左が消えて、右が残る。それが、つなぐ、だ。' }),
  { k: 'fade' },
];
const AUTO: Step[] = [L({ who: 'bossg', text: '並べるのは、卓がやる。' }), { k: 'pick' }, { k: 'join' }];
const AFTER: Step[] = [
  { k: 'turning' },
  L({ who: 'kimorin', text: '……いま、この星を回しているのは、{neo}です。' }),
  L({ who: 'bossg', text: '……つながったな。それが、お前の曲だ。' }),
  L({ who: 'bossg', text: 'つなぎ目に、お前のコロリンを落としてもいい。' }),
  { k: 'kororin' },
  { k: 'stop' },
  // D07V-S003
  { k: 'night' },
  L({ who: 'bossg', text: '練習は、ここまでだ。次は、番組にする。' }),
  L({ who: 'bossg', text: 'マイクに、ひとこと。そのあと、さっきの曲をかける。それで、一回目だ。' }),
  { k: 'rec', l: { who: 'bossg', text: '話すあいだは、曲が、自然に小さくなる。' } },
  G('番組の絵は、木星のアート。ループ画像は、MVのひとこま（あとで変えられます）'),
  G('Bluenaの金星のフォルダにしまいました。{neo}だけが聴けます'),
  L({ who: 'bossg', text: 'いま作った番組を、誰に聴かせるかは、自分で決めろ。' }),
  G('〔🎤 見せる〕を押すと、いまの番組（声と曲）が、Bluenaから金星の空へ映り、ダチ（{inviter}とKIMORIN⭐︎）の夜空に、ラジオとして88時間流れます。88時間たつと、あなたの放送ブースの記録に戻ります。押さなければ、Bluenaの中だけにあって、どこにも送られません'),
  { k: 'show' },
];
/**
 * The back booth (second journey, L2-VENUS-S002 — P08, not the day-7 script): your song on both decks (the same
 * record with the 〔印〕 somewhere else), SYNC, the fader at your speed, 〔あかり〕 from Hat G's desk. `self`: they
 * mixed by hand on the first journey (the gorillas say less). Its lines stay in the positional B(…) form on
 * purpose: they belong to the second journey's script, so the day-7 sync check does not read them.
 */
const B = (who: Who, text: string): Step => ({ k: 'line', l: { who, text } });
const booth = (self: boolean, kororin: boolean): Step[] => [
  B('guide', '左の台に、{neo}の曲。右の台にも、同じ一枚'),
  { k: 'load' },
  B('hatg', self ? '印は、出だしだけじゃない。' : '右のレコードの、入りたい所に、印をつける。'),
  B('hatg', 'サビの頭に置けば、いきなり山から入る。静かな所に置けば、そっと入る。'),
  { k: 'cue' },
  B('longg', self ? '……速さは、もう、そろえられるな。' : '……速さを、そろえろ。'),
  { k: 'sync' },
  B('bossg', 'つまみは、速さでも、語れる。'),
  B('bossg', 'ゆっくり回せば、二つの曲が、溶けあう。すっと回せば、ぱっと切りかわる。'),
  { k: 'fade' },
  B('hatg', '映像は、こっちの卓で、俺が見ている。'),
  B('hatg', 'つまみを回せば、映像も、いっしょに切りかわる。……ちがう絵を映したい時は、〔映像を選ぶ〕だ。'),
  B('hatg', '絵のない所は、光で照らせ。'),
  { k: 'lights' },
  { k: 'turning' },
  ...(kororin ? [{ k: 'kororin' } as Step] : []),
  { k: 'end' },
];
const SHOWN: Step[] = [{ k: 'post' }, G('届けました'), L({ who: 'kimorin', text: '……私の夜空にも、届くのですね。では、今夜は、起きて待ちます。' }), { k: 'end' }];
const NOT_SHOWN: Step[] = [L({ who: 'bossg', text: '聴かせるのは、いつでもいい。' }), { k: 'end' }];

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
  /** 〔🎤 届ける〕: the show (your word and your song; its picture = your art) goes to the dachi's night sky */
  deliver?: (body: { kind: 'stage'; title?: string; text?: string; url?: string; posterUrl?: string }) => Promise<void>;
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
  const [drop, setDrop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plugged, setPlugged] = useState(false);
  /** the first show: idle → talk (mic open) → song → done */
  const [rec, setRec] = useState<'idle' | 'talk' | 'song' | 'done'>('idle');
  const [micOff, setMicOff] = useState(false);
  const [keys, setKeys] = useState(false);
  const [typed, setTyped] = useState('');
  const [draft, setDraft] = useState('');
  const [onAir, setOnAir] = useState(false);
  const mixer = useRef<BoothMixer | null>(null);
  const heard = useRef(0);
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
      mixer.current?.close();
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
    if ((step.k === 'line' || step.k === 'plug') && SPEAKER[step.l.who]) void voice.current?.say(SPEAKER[step.l.who], step.l.text);
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
    if (step.k === 'stop') {
      // 曲が終わる。星が、ゆっくり止まる。KIMORINが、サングラスをかけ直す
      dj.current?.fadeOut();
      const t = setTimeout(next, 2600);
      return () => clearTimeout(t);
    }
    if (step.k === 'night') {
      dj.current?.close();
      dj.current = null;
      const t = setTimeout(next, 1600);
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

  // --- Bluena into the desk ---------------------------------------------------------------------------
  const plug = () => {
    if (step?.k !== 'plug' || plugged) return;
    setPlugged(true);
    playSfx('pop', false, 0.8);
    setTimeout(next, 900);
  };

  // --- the first show (D07V-S003): the booth's mixer records the mic and the song together ----------------
  const startRec = async () => {
    if (step?.k !== 'rec' || rec !== 'idle' || busy) return;
    setBusy(true);
    const m = new BoothMixer();
    mixer.current = m;
    try {
      await m.decks[0].load(song?.url ?? PRACTICE, song ? null : 120);
    } catch {
      /* no sound: the show is the voice alone */
    }
    try {
      await m.openMic();
    } catch {
      setMicOff(true); // no microphone: 〔パス〕 or ⌨
    }
    try {
      m.startRecording();
    } catch {
      /* no recorder on this browser: the steps still go on */
    }
    heard.current = 0;
    setRec('talk');
    setBusy(false);
    // (Boss G's line is shown, not voiced: the mic is open)
  };
  const playSong = () => {
    if (rec !== 'talk') return;
    mixer.current?.decks[0].play(0);
    setRec('song');
  };
  // {neo}の声のあとに、{neo}の曲が鳴りだす: the song comes in once they have spoken and gone quiet
  useEffect(() => {
    if (rec !== 'talk') return;
    const t = setInterval(() => {
      const m = mixer.current;
      if (!m) return;
      if (m.speaking) heard.current = performance.now();
      else if (heard.current && performance.now() - heard.current > 1600) playSong();
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec]);
  const stopRec = async () => {
    if (rec !== 'song') return;
    const m = mixer.current;
    // kept on this device for now (the lesson api has no upload for a show yet)
    if (m?.recording) await m.stopRecording().catch(() => undefined);
    m?.closeMic();
    m?.setMusicLevel(0);
    setRec('done');
    next();
  };

  // --- the line on top ----------------------------------------------------------------------------------
  const lineOf = (l: Line): CoachLine => ({ sprite: SPRITES[l.who], name: NAMES[l.who] || undefined, text: fill(l.text) });
  let coach: CoachLine | null = null;
  let actions: ReactNode = null;
  if (step?.k === 'line') {
    coach = lineOf(step.l);
    actions = <NextButton onClick={next} />;
  } else if (step?.k === 'plug') coach = lineOf(step.l);
  else if (step?.k === 'rec') coach = rec === 'idle' ? { text: '〔⏺ 収録〕を押すと、収録が始まります。マイクに話して、曲をかけて、〔■ 止める〕' } : lineOf(step.l); else if (step?.k === 'load') coach = { text: '①左右の台に、レコードをのせる（左の台は、のせるとすぐ鳴ります）' };
  else if (step?.k === 'cue') coach = { text: '②右のレコードの、鳴らしたい所を押して〔印〕（右の台が、印の所から回りはじめます。音は、つまみを動かすと聞こえます）' };
  else if (step?.k === 'sync') coach = { text: '③〔SYNC〕を押す（左右の拍がそろうと、光ります）' };
  else if (step?.k === 'fade') coach = { text: '④真ん中のつまみを、ゆっくり右へ' };
  else if (step?.k === 'join') coach = { text: '〔つなぐ〕が光ったら、押す' };
  else if (step?.k === 'lights') coach = { text: '〔あかり〕を押すと、ステージの光の色が変わります（押すたびに、ちがう色）' };
  else if (step?.k === 'kororin') coach = { text: mode === 'auto' && !inBooth ? '〔コロリン〕が光ったら、押す' : '⑤つなぎ目で〔コロリン〕を押すと、自分のコロリンの声がひとつ落ちる' };

  const night = steps.findIndex((s) => s.k === 'night') <= i && steps.some((s) => s.k === 'night');
  const turning = steps.findIndex((s) => s.k === 'turning') <= i && steps.some((s) => s.k === 'turning') && !night;
  const demo = step?.k === 'demo';
  const glow = (on: boolean) => (on ? 'animate-[hintGlow_2.2s_ease-in-out_infinite] ring-4 ring-amber-200' : '');
  const deckOn = (k: 0 | 1) => (demo ? true : !!dj.current?.decks[k].playing);
  const spin = (k: 0 | 1) => (deckOn(k) ? ((Date.now() / (k ? 1000 / ((dj.current?.decks[1].rate ?? 1) * 1.1) : 909)) * 60) % 360 : 0);
  const showDesk = !night && step && step.k !== 'how';
  const art = song?.jacket ?? null;
  const loopPic = mv?.poster ?? null;

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
          {/* the booth glass: your art big, the MV's frames looping round it, once the mix is yours */}
          <div className={`relative aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-amber-200/40 bg-black ${turning ? 'shadow-[0_0_40px_rgba(255,200,120,0.6)]' : ''}`}>
            {demo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/onboarding/s/mv-kimorin-slide.jpg" alt="" className="h-full w-full animate-[kenBurns_12s_ease-in-out_infinite_alternate] object-cover" />
            ) : turning || step?.k === 'kororin' || step?.k === 'stop' ? (
              <>
                {mv ? (
                  <video src={mv.url} poster={mv.poster ?? undefined} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-70" />
                ) : (
                  <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle,#ffb35c,#5a1e6e)]" />
                )}
                {art && !inBooth && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={art} alt="" className="absolute left-1/2 top-1/2 h-[78%] -translate-x-1/2 -translate-y-1/2 rounded-lg object-cover shadow-[0_0_30px_rgba(255,200,120,0.6)]" />
                )}
              </>
            ) : plugged && !inBooth ? (
              // 台の横の小さな画面に、Bluenaの中のものが並ぶ：水星の曲、土星のコロリンの声、木星のアート、火星のMV
              <div className="grid h-full w-full grid-cols-4 items-center gap-1.5 p-2 text-center text-[10px] text-white/80">
                <span className="truncate">🎵 {song?.title ?? '曲'}</span>
                <span className="truncate">🪐 {kororins[kororins.length - 1] ?? 'コロリン'}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {art ? <img src={art} alt="" className="aspect-square w-full rounded object-cover" /> : <span>🎨</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {loopPic ? <img src={loopPic} alt="" className="aspect-video w-full rounded object-cover" /> : <span>🎬</span>}
              </div>
            ) : (
              <div className="h-full w-full" />
            )}
            {light && <span className="pointer-events-none absolute inset-0 mix-blend-screen transition-colors duration-500" style={{ background: `radial-gradient(circle at 50% 20%, ${light}, transparent 75%)` }} />}
            {drop && <span className="absolute inset-x-3 bottom-2 animate-[fadeUp_0.4s_ease-out] rounded-full bg-white/90 px-3 py-1 text-center text-[12px] font-bold text-violet-700">🪐 {drop.length > 24 ? `${drop.slice(0, 24)}…` : drop}</span>}
          </div>

          {/* the two platters, each with its square jacket; Bluena's round hollow between them */}
          <div className="relative flex w-full max-w-sm justify-between">
            {!inBooth && (
              <button
                onClick={plug}
                disabled={step?.k !== 'plug'}
                aria-label="Bluena"
                className={`absolute left-1/2 top-[calc(min(17vw,70px)-28px)] z-10 h-14 w-14 -translate-x-1/2 overflow-hidden rounded-full bg-black/70 shadow-inner ring-2 ${plugged ? 'ring-violet-400 shadow-[0_0_24px_#a78bfa]' : 'ring-white/20'} ${glow(step?.k === 'plug')}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {(plugged || step?.k === 'plug') && <img src={BLUENA} alt="" className={`h-full w-full object-cover transition-opacity duration-500 ${plugged ? 'opacity-100' : 'opacity-40'}`} />}
              </button>
            )}
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
              <p className="text-sm text-slate-500">次は、ここから</p>
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
                〔おまかせ〕
                <span className="block text-[11px] font-bold opacity-80">押すだけで、卓が組む</span>
              </Big>
              <Soft onClick={() => setHold(true)}>今はここで止める</Soft>
            </div>
          )}
        </Panel>
      )}
      {step?.k === 'pick' && (
        <Panel>
          <p className="text-center text-sm font-black text-violet-700">〔おまかせ〕</p>
          <p className="mt-1 animate-pulse text-center text-[12px] leading-relaxed text-slate-500">Bluenaの中のもの（曲・コロリン・アート・映像）から、卓がセットを組みます。あなたが押すのは、つなぐ時と、コロリンを落とす時だけ</p>
        </Panel>
      )}
      {night && !inBooth && (
        // the booth at night: ON AIR on its roof (lit only once the show is delivered), the show's picture on the glass
        <div className="pointer-events-none absolute inset-x-0 top-[22svh] z-[160] flex flex-col items-center gap-2">
          <span className={`rounded-md px-3 py-0.5 text-[12px] font-black tracking-[0.25em] transition-all duration-700 ${onAir ? 'bg-red-500 text-white shadow-[0_0_24px_#ef4444]' : 'bg-white/10 text-white/30'}`}>ON AIR</span>
          {(rec !== 'idle' || step?.k === 'rec') && (
            <div className={`relative aspect-square w-[min(52vw,220px)] overflow-hidden rounded-2xl border border-amber-200/40 bg-black/60 ${rec === 'song' ? 'shadow-[0_0_40px_rgba(255,200,120,0.55)]' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {loopPic && <img src={loopPic} alt="" className="absolute inset-0 h-full w-full animate-[kenBurns_12s_ease-in-out_infinite_alternate] object-cover opacity-50" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {art && <img src={art} alt="" className="absolute inset-[14%] h-[72%] w-[72%] rounded-xl object-cover shadow-xl" />}
              {typed && <span className="absolute inset-x-2 bottom-2 rounded-lg bg-black/60 px-2 py-1 text-center text-[12px] font-bold leading-snug text-white">{typed}</span>}
              {(rec === 'talk' || rec === 'song') && <span className="absolute left-2 top-2 h-3 w-3 animate-pulse rounded-full bg-red-500" />}
            </div>
          )}
        </div>
      )}
      {night && onAir && (
        // 電波が一本、夜空へまっすぐのびていく
        <div className="pointer-events-none absolute bottom-[30svh] left-1/2 z-[155] h-[70svh] w-1 -translate-x-1/2 animate-[fadeUp_1.2s_ease-out] bg-gradient-to-t from-amber-200 via-amber-100/70 to-transparent blur-[1px]" />
      )}
      {step?.k === 'rec' && (
        <Panel>
          {rec === 'idle' ? (
            <Big tone="rose" disabled={busy} onClick={() => void startRec()}>
              ⏺ 収録
            </Big>
          ) : (
            <div className="space-y-3">
              {rec === 'talk' && !keys && (
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-4xl text-white shadow-lg transition-transform"
                    style={{ transform: `scale(${1 + (mixer.current?.micLevel ?? 0) * 0.35})` }}
                  >
                    🎙
                  </div>
                  <p className="text-sm font-black text-violet-700">{micOff ? '' : '話してみよう'}</p>
                </div>
              )}
              {rec === 'talk' && keys && (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!draft.trim()) return;
                    setTyped(draft.trim().slice(0, 80));
                    playSong();
                  }}
                >
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} autoFocus className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm" />
                  <button className="rounded-full bg-violet-500 px-4 text-sm font-bold text-white">OK</button>
                </form>
              )}
              {rec === 'talk' && (
                <div className="flex items-center gap-2">
                  <Soft onClick={playSong}>パス</Soft>
                  <button onClick={() => setKeys((x) => !x)} aria-label="⌨" className="shrink-0 rounded-full bg-slate-100 px-3 py-3 text-[12px] text-slate-500">
                    ⌨
                  </button>
                </div>
              )}
              {rec === 'song' && (
                <Big tone="rose" onClick={() => void stopRec()}>
                  ■ 止める
                </Big>
              )}
            </div>
          )}
        </Panel>
      )}
      {step?.k === 'show' && (
        <Panel>
          <div className="space-y-2">
            <Big
              tone="amber"
              onClick={() => {
                setShown(true);
                insert(SHOWN);
                next();
              }}
            >
              🎤 見せる
            </Big>
            <Soft
              onClick={() => {
                insert(NOT_SHOWN);
                next();
              }}
            >
              今は、Bluenaにしまっておく
            </Soft>
          </div>
        </Panel>
      )}
      {step?.k === 'post' && (
        <Panel>
          <div className="space-y-3">
            <p className="text-center text-[13px] text-slate-500">行き先</p>
            <div className="rounded-2xl bg-amber-50 p-3 text-center text-[14px] font-bold text-amber-700 ring-2 ring-amber-300">
              ダチへ（{inviter}・KIMORIN⭐︎）
            </div>
            <Big
              tone="amber"
              disabled={onAir}
              onClick={() => {
                if (onAir) return;
                const web = (u: string | null | undefined) => (u && /^https?:/.test(u) ? u : undefined);
                if (song) void deliver?.({ kind: 'stage', title: song.title.slice(0, 60), text: typed.slice(0, 200), url: web(song.url), posterUrl: web(art) ?? web(loopPic) }).catch(() => undefined);
                // Bluenaの側面のレンズが光る。屋根の『ON AIR』のランプが、ぽっと灯る
                playSfx('pop', false, 0.8);
                setOnAir(true);
                setTimeout(next, 1400);
              }}
            >
              🎤 届ける
            </Big>
          </div>
        </Panel>
      )}
    </LessonShell>
  );
}
