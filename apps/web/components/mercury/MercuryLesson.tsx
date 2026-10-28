'use client';

import type { SongDesign } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { KIMORIN_JACKET, Sticker, saveSpell } from '@/components/jupiter/JupiterLesson';
import { Big, LessonShell, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { STYLE_SOUND, type LessonApi } from '@/lib/onboarding/lessonApi';
import type { SongMade, StickerMade } from '@/lib/onboarding/made';
import { LineVoice } from '@/lib/story/lineVoice';
import { spriteUrl } from '@/lib/onboarding/media';
import { MyIsland, islandCards, islandFromWords, islandOmakase, type IslandLook } from './MyIsland';

/**
 * Day 5 on Mercury (first journey; story D06-S005〜S007, M-R89/M-R91/M-R114): yesterday's jacket gets its
 * song. フリージー teaches, KIMORIN⭐︎ goes first (M-R133: the client's two songs — 「泣ける曲を」 gives a sad
 * one, he asks once more for an epic one with 『すね毛楽しい』 in it: the model of the one redo) — then the visitor: the jacket's song (or new words), add a feeling or
 * pass → the feel → {bati}'s lyric draft (tap a line to touch it up) → mana asked → {bati} sings it → the
 * record spins → 〔🔒 土の中にしまう〕 (always: Mars needs it). Draft 21 (M-R124/125): everyone makes one;
 * the song may sail to the dachi's sea (〔🚢 出航させる〕→〔ダチへ〕→〔🚢 出航〕), KIMORIN⭐︎'s ship comes into
 * the 〔推し〕 sea, then 🏝️ myアイランド rises (D06-S007b). The lines are the story's, word for word.
 */
type Phase = 'intro' | 'choose' | 'hold' | 'words' | 'style' | 'writing' | 'lyrics' | 'mana' | 'singing' | 'failed' | 'song' | 'after';
const FEELS: { id: string; label: string }[] = [
  { id: 'pop', label: 'ポップ' },
  { id: 'rock', label: 'ロック' },
  { id: 'hiphop', label: 'ヒップホップ' },
  { id: 'ballad', label: 'バラード' },
  { id: 'edm', label: 'EDM' },
  { id: 'auto', label: 'おまかせ' },
];

type Who = 'freezy' | 'kimorin' | 'bati' | 'guide' | 'song' | 'pinpon';
type Line = { who: Who; text: string };
type Scene = 'bar' | 'bar-glow' | 'demo' | 'song1' | 'song2';
const SPELL_1 = ['泣ける', '悲しい', 'しっとり', 'ゆっくり', 'ピアノ'];
const SPELL_2 = ['泣ける', '壮大', '神々しい', '感動的', 'オーケストラ', '大合唱', '歌詞：すね毛楽しい'];
const INTRO: (Line & { scene?: Scene; cards?: string[]; choices?: { label: string; reply: Line[] }[] })[] = [
  {
    who: 'freezy',
    text: '自分の思いだったり、起こった出来事を、音に乗っけたことはあるか？',
    choices: [
      { label: 'ある', reply: [{ who: 'freezy', text: 'ほう、なかなかやるな。' }] },
      { label: 'ない', reply: [{ who: 'freezy', text: 'そうか。なら今日が、はじめての日だ。' }] },
      { label: '鼻歌くらいなら', reply: [{ who: 'freezy', text: '鼻歌も、立派な歌だ。' }] },
    ],
  },
  { who: 'freezy', text: '実はな、音に乗っけると、100倍のパワーを持つ。' },
  { who: 'kimorin', text: '百倍。根拠は？' },
  { who: 'freezy', text: '聴けば、わかる。' },
  { who: 'kimorin', text: '……では、聴いてから、計算します。' },
  { who: 'freezy', text: '今日食べたラーメンが美味しかった。学校に遅刻しそうだ。そんな自分の日常のことを、歌にしてみよう。' },
  { who: 'freezy', text: '土星の言葉も、木星のアートも、音がつけば、もっと伝わる。' },
  { who: 'freezy', text: 'できた曲は、船になって、ダチの海に出る。' },
  { who: 'freezy', text: '習うより、慣れろ、だ。さあ、作ってみよう。', scene: 'bar' },
  { who: 'freezy', text: '真ん中の〔♫+ 作曲〕だ。', scene: 'bar-glow' },
  { who: 'kimorin', text: 'お待ちを。きのうのアートで。……天才の手本です。', scene: 'demo' },
  { who: 'kimorin', text: '泣ける曲を、お願いします。', scene: 'demo' }, // 〔🎙〕に顔を近づける
  { who: 'guide', text: '♪ 作曲中…', scene: 'demo' }, // うんちピンポンくんが、ぽこん、と弾む
  { who: 'song', text: '（しっとりと悲しい、泣ける曲）', scene: 'song1' },
  { who: 'kimorin', text: '……なんか、違います。', scene: 'demo' }, // 腕を組んで、首をかしげている
  { who: 'freezy', text: 'なら、スペルを変えろ。', scene: 'demo' },
  { who: 'kimorin', text: '……曲にも、スペルが、あるのですね。', scene: 'demo' },
  { who: 'pinpon', text: 'さっきの曲のスペルは、こんな感じだよ！', scene: 'demo', cards: SPELL_1 },
  { who: 'kimorin', text: '……なるほど。……あまり、わかりませんが。', scene: 'demo', cards: SPELL_1 },
  { who: 'kimorin', text: 'とりあえず、もっと、壮大で、神々しく、感動的に、泣ける曲で、お願いします。……あと、『すね毛楽しい』という歌詞も足してください。', scene: 'demo', cards: SPELL_1 },
  { who: 'pinpon', text: 'なるほど、わかった！　じゃあ、こんなスペルの方が、合うかも！', scene: 'demo', cards: SPELL_2 },
  { who: 'pinpon', text: 'じゃあ、作るね！', scene: 'demo', cards: SPELL_2 },
  { who: 'guide', text: '♪ 作り直し中…', scene: 'demo' },
  { who: 'song', text: '（壮大で、神々しい、感動の曲）', scene: 'song2' },
  { who: 'freezy', text: '……いい曲だ。', scene: 'song2' },
  { who: 'kimorin', text: '……自分の曲で、泣くとは。', scene: 'song2' }, // サングラスの下から、涙が、ぽろぽろ
  { who: 'freezy', text: '次は、お前だ。' },
];
const SPEAKER: Record<Who, string> = { freezy: 'フリージー', kimorin: 'KIMORIN', bati: 'バティ', guide: '', song: '', pinpon: 'うんちピンポンくん' };
const NAMES: Record<Who, string> = { freezy: 'フリージー', kimorin: 'KIMORIN⭐︎', bati: 'バティ', guide: '', song: 'KIMORIN⭐︎の曲', pinpon: 'うんちピンポンくん' };
/** the client's two songs for KIMORIN⭐︎ (M-R133); the first is heard from its chorus */
const KIMORIN_SONG_1 = { src: '/onboarding/kimorin-mercury-1.m4a', from: 22 };
const KIMORIN_SONG_2 = { src: '/onboarding/kimorin-mercury-2.m4a', from: 0 };
const SPRITES: Partial<Record<Who, string>> = { freezy: 'freezy-x-talk', kimorin: 'kimorin-sun', pinpon: 'unchi-pinpon' };
// after the song is put in the soil (D06-S007 最初の一隻 → D06-S007b myアイランド)
type After =
  | { k: 'line'; l: Line }
  | { k: 'sail' } // 〔ダチの海に出航させる〕〔今は、土の中にしまっておく〕
  | { k: 'post' } // 〔🚢 出航させる〕 → 〔ダチへ〕 → 〔🚢 出航〕
  | { k: 'ship'; who: 'mine' | 'kimorin' }
  | { k: 'oshi' } // KIMORIN⭐︎'s ship comes into the 〔推し〕 sea: tap it, the ballad plays
  | { k: 'bar' } // 🏝️ myアイランド glows
  | { k: 'edit' }
  | { k: 'rise' }
  | { k: 'end' };
const fr = (text: string): After => ({ k: 'line', l: { who: 'freezy', text } });
const ki = (text: string): After => ({ k: 'line', l: { who: 'kimorin', text } });
const gd = (text: string): After => ({ k: 'line', l: { who: 'guide', text } });

/** The record: the jacket on it, spinning while it plays. */
export function Record({ s, playing, size = 200 }: { s: StickerMade; playing: boolean; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className={`absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle,#111_0_2px,#222_2px_4px)] shadow-2xl ${playing ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
        <div className="absolute inset-[18%]">
          <Sticker s={s} size={size * 0.64} />
        </div>
      </div>
      <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />
    </div>
  );
}

function Bar({ glow, lit = 1, onTap }: { glow?: boolean; lit?: number; onTap?: () => void }) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[175] flex justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-4 pb-5 pt-8">
      {['🗺️ 海図', '♫+ 作曲', '🏝️ myアイランド'].map((l, k) => (
        <button key={l} disabled={k !== lit || !onTap} onClick={onTap} className={`rounded-2xl px-4 py-2.5 text-sm font-black ${k === lit ? `bg-sky-300 text-sky-900 ${glow ? 'animate-pulse ring-4 ring-sky-200' : ''}` : 'bg-white/20 text-white/80'}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

/**
 * The captain at the bow (D06-S007, M-R155/M-R161): the small chibi {neo} in a captain's cap, looking out to sea.
 * KIMORIN⭐︎'s wears his round sunglasses too.
 */
function Captain({ chibi, face, shades = false, size = 44 }: { chibi?: string; face?: string; shades?: boolean; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size * 1.2 }}>
      {chibi ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={chibi} alt="" className="absolute inset-x-0 bottom-0 h-[88%] w-full object-contain drop-shadow" />
      ) : (
        <div className="absolute inset-x-[10%] bottom-0 aspect-square overflow-hidden rounded-full border-2 border-white bg-amber-100">
          {face && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={face} alt="" className="h-full w-full object-cover object-top" />
          )}
          {shades && (
            <svg viewBox="0 0 100 40" className="absolute left-[12%] top-[38%] w-[76%]">
              <circle cx="27" cy="20" r="16" fill="#151020" stroke="#ffd36f" strokeWidth="4" />
              <circle cx="73" cy="20" r="16" fill="#151020" stroke="#ffd36f" strokeWidth="4" />
            </svg>
          )}
        </div>
      )}
      {/* the captain's cap */}
      <svg viewBox="0 0 60 30" className="absolute left-1/2 top-0 w-[78%] -translate-x-1/2">
        <path d="M6 20 Q30 0 54 20 Z" fill="#fafafa" stroke="#1f2a44" strokeWidth="2" />
        <rect x="4" y="19" width="52" height="6" rx="3" fill="#1f2a44" />
        <circle cx="30" cy="13" r="3.2" fill="#e9c46a" />
      </svg>
    </div>
  );
}

/** 🏝️ myアイランド by talking with {bati} (D06-S007b, M-R154): what you'd like → part cards → 〔この島にする〕 */
function IslandChat({ neo, bati, say, onMake, onHold }: { neo: string; bati: string; say: (l: Line) => void; onMake: (l: IslandLook) => void; onHold: () => void }) {
  const [step, setStep] = useState<'ask' | 'cards' | 'redo'>('ask');
  const [look, setLook] = useState<IslandLook>(() => islandOmakase(neo));
  const [talk, setTalk] = useState('');
  useEffect(() => say({ who: 'bati', text: 'どんな島にしたい？　ざっくりでいいよ！' }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const toCards = (l: IslandLook) => {
    setLook(l);
    setTalk('');
    setStep('cards');
    say({ who: 'bati', text: 'じゃあ、こんな感じかな！' });
  };
  if (step !== 'cards')
    return (
      <div className="space-y-3">
        <p className="text-center text-sm font-black text-sky-700">🏝️ myアイランド</p>
        <VoiceField light value={talk} onChange={setTalk} placeholder={step === 'ask' ? '夕焼けの、ヤシの木がある島' : '夜の島がいい'} maxLength={40} />
        <Big tone="sky" disabled={!talk.trim()} onClick={() => toCards(islandFromWords(talk, step === 'ask' ? { ...islandOmakase(neo), palm: false, time: 'day' } : look))}>
          これで組む
        </Big>
        {step === 'ask' && (
          <>
            <Soft onClick={() => toCards(islandOmakase(neo))}>おまかせ</Soft>
            <p className="text-center text-[11px] text-slate-400">おまかせなら、{neo}の曲に合う島を、{bati}が組みます</p>
          </>
        )}
      </div>
    );
  return (
    <div className="space-y-3">
      <div className={`flex justify-center rounded-2xl py-2 ${look.time === 'night' ? 'bg-gradient-to-b from-indigo-900 to-sky-800' : look.time === 'dusk' ? 'bg-gradient-to-b from-orange-300 to-sky-500' : 'bg-gradient-to-b from-sky-200 to-sky-400'}`}>
        <MyIsland look={look} width={200} />
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {islandCards(look).map((c) => (
          <span key={c} className="rounded-md bg-sky-50 px-2 py-1 text-[12px] font-bold text-sky-800 ring-1 ring-sky-300">
            〈{c}〉
          </span>
        ))}
      </div>
      <VoiceField light value={look.name} onChange={(t) => setLook((x) => ({ ...x, name: t.slice(0, 12) }))} placeholder="島の名前（なくてもいい）" maxLength={12} />
      <Big tone="sky" onClick={() => onMake(look)}>
        この島にする
      </Big>
      <Soft onClick={() => setStep('redo')}>🎙 話して直す</Soft>
      <Soft onClick={onHold}>今はここで止める</Soft>
      <p className="text-center text-[11px] text-slate-400">話すと、札が変わります。マナは使いません。あとで変えられます</p>
    </div>
  );
}

export function MercuryLesson({
  api,
  stickers,
  neo,
  bati,
  inviter,
  batiImage,
  look: neoFace,
  chibi,
  onDone,
}: {
  api: LessonApi;
  /** the visitor's round look and their chibi: the captain at the bow */
  look?: string;
  chibi?: string;
  stickers: StickerMade[];
  neo: string;
  bati: string;
  inviter: string;
  batiImage?: string;
  onDone: (song: SongMade | null, island: IslandLook, sailed: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [k, setK] = useState(0);
  const [reply, setReply] = useState<Line[] | null>(null);
  const [replyAt, setReplyAt] = useState(0);
  const [from, setFrom] = useState<'prev' | 'new'>('new');
  const [jacket, setJacket] = useState<StickerMade | null>(null);
  const [words, setWords] = useState('');
  const [passed, setPassed] = useState(false);
  const [design, setDesign] = useState<SongDesign | null>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [feel, setFeel] = useState<string>('auto');
  const [feelSaid, setFeelSaid] = useState(false);
  // the style said to {bati} and the spell cards made from it (D06-S006, M-R142〜145)
  const [styleSaid, setStyleSaid] = useState('');
  const [cards, setCards] = useState<string[] | null>(null);
  const [kept, setKept] = useState(false);
  const [song, setSong] = useState<{ id: string; title: string; url: string } | null>(null);
  // M-R132: the song can be made again once; then the two lie side by side and one is put in the soil
  const [other, setOther] = useState<{ id: string; title: string; url: string } | null>(null);
  const [redone, setRedone] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(false);
  const [after, setAfter] = useState<After[]>([]);
  const [ak, setAk] = useState(0);
  const [sailed, setSailed] = useState(false);
  const [post, setPost] = useState<'post' | 'to'>('post');
  const [oshi, setOshi] = useState<'coming' | 'here' | 'open'>('coming');
  const [look, setLook] = useState<IslandLook | null>(null);
  const [islandHold, setIslandHold] = useState(false);
  const [rise, setRise] = useState<0 | 1 | 2>(0);
  const [cue, setCue] = useState<Line | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const song1 = useRef<HTMLAudioElement>(null);
  const song2 = useRef<HTMLAudioElement>(null);
  /** fade a demo song out (a tap moved on) */
  const fade = (a: HTMLAudioElement | null) => {
    if (!a || a.paused) return;
    const t = setInterval(() => {
      a.volume = Math.max(0, a.volume - 0.1);
      if (a.volume <= 0.01) {
        clearInterval(t);
        a.pause();
        a.volume = 1;
      }
    }, 60);
  };
  const start = (a: HTMLAudioElement | null, from: number) => {
    if (!a || !a.paused) return;
    a.currentTime = from;
    a.volume = 1;
    void a.play().catch(() => undefined);
  };
  const voice = useRef<LineVoice | null>(null);
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{bati}', bati).replaceAll('{inviter}', inviter);
  const lineOf = (l: Line): CoachLine => ({ sprite: l.who === 'bati' ? batiImage : SPRITES[l.who], name: l.who === 'bati' ? bati : NAMES[l.who] || undefined, text: fill(l.text) });
  const speak = (l: Line) => {
    if (SPEAKER[l.who]) void voice.current?.say(SPEAKER[l.who], l.text);
  };
  const said = (l: Line) => {
    setCue(l);
    speak(l);
  };

  useEffect(() => {
    const v = new LineVoice();
    v.unlock();
    voice.current = v;
    return () => v.dispose();
  }, []);
  const introLine = phase === 'intro' ? (reply ? reply[replyAt] : INTRO[k]) : null;
  useEffect(() => {
    if (introLine) speak(introLine);
    if (phase === 'intro') {
      const sc = INTRO[k]?.scene;
      if (sc === 'song1') start(song1.current, KIMORIN_SONG_1.from);
      else fade(song1.current);
      if (sc === 'song2') start(song2.current, KIMORIN_SONG_2.from);
      else fade(song2.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introLine?.text, phase]);

  // the style words → genre (the first example named) and spell cards (the said words, then the words' own)
  const spell = (talk: string) => {
    const named = FEELS.find((f) => f.id !== 'auto' && talk.toLowerCase().includes(f.label.toLowerCase()));
    setFeel(named?.id ?? 'auto');
    setFeelSaid(true);
    const style = talk
      .split(/[、。,.\s　]+/)
      .map((w) => w.replace(/(で|な感じ|感じ|みたいな)$/, '').trim())
      .filter(Boolean)
      .slice(0, 5);
    const mine = (from === 'prev' && jacket ? jacket.text : passed ? '' : words).split(/[、。！？!?\s　]+/).filter(Boolean).slice(0, 2);
    setCards([...(style.length ? style : ['おまかせのスタイル']), ...mine.map((w) => (w.length > 10 ? `${w.slice(0, 10)}…` : w))]);
    setStyleSaid(talk);
    if (!talk) setCue({ who: 'guide', text: '言葉に合う曲のスタイルを、{bati}が選びます' });
    setTimeout(() => said({ who: 'bati', text: 'じゃあ、スペルは、こうなるね！' }), talk ? 0 : 1600);
    setTimeout(() => said({ who: 'freezy', text: 'くわしく言えば、言っただけ、スペルは細かくなる。' }), talk ? 2400 : 4000);
  };
  const material = () => {
    const base = from === 'prev' && jacket ? jacket.text : '';
    const add = passed ? '' : words.trim();
    return [base, add].filter(Boolean).join('\n') || 'いまいる場所：氷の島と、ぶーんと鳴る白い冷蔵庫';
  };
  const write = async () => {
    setPhase('writing');
    try {
      setDesign(await api.lyrics(material(), bati));
      setPhase('lyrics');
      said({ who: 'freezy', text: '直したい所があれば、〔✏️ 手直しする〕だ。' });
    } catch {
      setPhase('failed');
    }
  };
  const sing = async () => {
    if (!design) return;
    setPhase('singing');
    said({ who: 'bati', text: '〈{neo}の言葉〉——ここに、ふしを。' });
    const sound = STYLE_SOUND[feel];
    // the style said to {bati} rides along with the genre's sound
    const talk = styleSaid.trim();
    const d: SongDesign = sound ? { ...design, genre: feel, instrumentalPrompt: talk ? `${sound.prompt}, ${talk}` : sound.prompt, bpm: sound.bpm } : talk ? { ...design, instrumentalPrompt: design.instrumentalPrompt ? `${design.instrumentalPrompt}, ${talk}` : talk } : design;
    try {
      setSong(await api.sing(d, setStage));
      setPhase('song');
      setCue({ who: 'guide', text: '−2マナ' });
    } catch {
      setPhase('failed');
      said({ who: 'bati', text: '魔法陣、ちょっと凍っちゃった……。歌詞は残ってるよ。もう1回唱えてもいい？' });
    }
  };
  const lines = design?.sections.flatMap((s, si) => s.lines.map((l, li) => ({ si, li, text: l.text }))) ?? [];
  const setLine = (si: number, li: number, text: string) =>
    setDesign((d) => (d ? { ...d, sections: d.sections.map((s, a) => (a !== si ? s : { ...s, lines: s.lines.map((l, b) => (b !== li ? l : { ...l, text })) })) } : d));
  const record: StickerMade = from === 'prev' && jacket ? jacket : { text: design?.title ?? song?.title ?? (words.trim() || '氷の島'), url: null };

  const ab = phase === 'after' ? after[ak] : undefined;
  const anext = () => setAk((x) => x + 1);
  const ainsert = (more: After[]) => setAfter((a) => [...a.slice(0, ak + 1), ...more, ...a.slice(ak + 1)]);
  const putAway = () => {
    setAfter([
      gd('曲を、{neo}だけの〔⛏ 土の中の曲〕にしまいました。誰にも送られていません。しまった曲は、このあと作る〔🏝️ myアイランド〕の土の中から、いつでも聴けます'),
      fr('次は、出航だ。お前の曲を、ダチの海に出す。'),
      gd('〔🚢 出航させる〕を押すと、曲が船になって、ダチの海を88時間めぐり、このあと作るmyアイランドの桟橋に戻ります（届くのはダチだけ。いまのダチは、{inviter}とKIMORIN⭐︎です）'),
      { k: 'sail' },
    ]);
    setAk(0);
    setPhase('after');
  };
  const closing = (): After[] => [
    heard ? fr('{neo}の言葉は、ちゃんと歌になった。また聴かせてくれ。') : fr('聴くのは、あとでいい。また聴かせてくれ。'),
    ki('では、私も。'),
    { k: 'ship', who: 'kimorin' },
    gd('〔🗺️ 海図〕を押すと、上の〔推し〕に、ダチの船が入ってきます。タップすると聴けます（押した時だけ鳴ります）'),
    { k: 'oshi' },
    ki('……二回目でも、泣けますね。'),
    fr('次は、音楽が帰る場所だ。どんな島にするかは、お前が決めろ。'),
    { k: 'bar' },
    { k: 'edit' },
    { k: 'rise' },
    ki('……島とは、生えるものだったのですね。'),
    ...(sailed ? [gd('出航した船は、88時間ダチの海をめぐって、この島の桟橋に戻ります。戻った曲は、浜にレコードとして並びます')] : []),
    gd('myアイランドができた'),
    { k: 'end' },
  ];
  // each line plays its voice; the ships sail on their own; KIMORIN⭐︎'s ship waits for a tap; the island rises
  useEffect(() => {
    if (!ab) return;
    if (ab.k === 'line') speak(ab.l);
    if (ab.k === 'bar') fade(song2.current);
    if (ab.k === 'ship') {
      const t = setTimeout(anext, 3200);
      return () => clearTimeout(t);
    }
    if (ab.k === 'oshi') {
      setOshi('coming');
      const t = setTimeout(() => setOshi('here'), 1800);
      return () => clearTimeout(t);
    }
    if (ab.k === 'rise') {
      setRise(0);
      const a = setTimeout(() => setRise(1), 500);
      const b = setTimeout(() => setRise(2), 2600);
      const c = setTimeout(anext, 3800);
      return () => [a, b, c].forEach(clearTimeout);
    }
    if (ab.k === 'end') {
      fade(song2.current);
      onDone(song ? { id: song.id, title: song.title, url: song.url, jacket: record.url, words: record.text } : null, look ?? islandOmakase(neo), sailed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ab]);

  let coach: CoachLine | null = cue ? lineOf(cue) : null;
  let actions: React.ReactNode = null;
  const scene = phase === 'intro' ? INTRO[k].scene : undefined;
  if (phase === 'intro') {
    const b = INTRO[k];
    coach = lineOf(reply ? reply[replyAt] : b);
    actions =
      b.choices && !reply ? (
        b.choices.map((c) => (
          <button key={c.label} onClick={() => setReply(c.reply)} className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700">
            {c.label}
          </button>
        ))
      ) : (
        <NextButton
          onClick={() => {
            if (reply && replyAt < reply.length - 1) return setReplyAt(replyAt + 1);
            setReply(null);
            setReplyAt(0);
            if (k < INTRO.length - 1) setK(k + 1);
            else {
              fade(song2.current);
              setPhase('choose');
              setCue(null);
            }
          }}
        />
      );
  } else if (phase === 'choose') coach = lineOf({ who: 'freezy', text: '次は、お前だ。' });
  else if (phase === 'hold') actions = <NextButton label="続ける" onClick={() => setPhase('choose')} />;
  else if (phase === 'mana') coach = { text: '作曲に、マナを使います。いいですか？' };
  else if (phase === 'writing') coach = { text: '✍️ 歌詞を考えています…' };
  else if (phase === 'singing' && stage === 'warming') coach = { text: '♪ 作曲中…　音のスタジオが、目をさましています' };
  else if (phase === 'song' && cue?.text === '−2マナ') actions = <NextButton onClick={() => setCue({ who: 'guide', text: '聴いたら〔🔒 土の中にしまう〕を押します（自動ではしまいません）' })} />;
  else if (phase === 'after') {
    coach = ab?.k === 'line' ? lineOf(ab.l) : ab?.k === 'bar' ? { text: '下の右の〔🏝️ myアイランド〕を押す' } : ab?.k === 'oshi' && oshi === 'here' ? { text: '上の〔推し〕の海に、小さな船が一隻。タップしてみよう' } : null;
    if (ab?.k === 'line') actions = <NextButton onClick={anext} />;
  }

  return (
    <LessonShell bg="/onboarding/s/mercury-ice.jpg" coach={coach} actions={actions}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={song1} src={KIMORIN_SONG_1.src} preload="auto" />
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={song2} src={KIMORIN_SONG_2.src} preload="auto" />
      {batiImage && phase !== 'after' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={batiImage} alt="" className="pointer-events-none absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-3 z-[170] h-16 w-16 rounded-2xl border-2 border-white/70 object-cover shadow-lg" aria-hidden />
      )}
      {song && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audio} src={song.url} onPlay={() => (setPlaying(true), setHeard(true))} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      )}

      {(scene === 'bar' || scene === 'bar-glow') && <Bar glow={scene === 'bar-glow'} />}
      {(scene === 'demo' || scene === 'song1' || scene === 'song2') && (
        <div className="absolute inset-x-0 top-[36svh] z-[160] flex justify-center">
          <div className="flex flex-col items-center gap-3">
            <Record s={KIMORIN_JACKET} playing={scene === 'song1' || scene === 'song2'} size={220} />
            {INTRO[k].cards && (
              <div key={INTRO[k].cards!.join()} className="flex max-w-xs flex-wrap justify-center gap-1.5">
                {INTRO[k].cards!.map((c, i) => (
                  <span key={c} className="animate-[fadeUp_0.4s_ease-out] rounded-md border border-sky-300 bg-white/90 px-2 py-0.5 font-serif text-[12px] font-bold text-sky-800" style={{ animationDelay: `${i * 70}ms`, animationFillMode: 'backwards' }}>
                    〈{c}〉
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'choose' && (
        <Panel>
          <div className="space-y-2">
            {stickers.length > 0 && (
              <Big
                tone="sky"
                onClick={() => {
                  setFrom('prev');
                  if (stickers.length === 1) setJacket(stickers[0]);
                  setPhase('words');
                  said({ who: 'freezy', text: 'このアートが、曲の顔になる。あとは中身だ。' });
                }}
              >
                きのうのアートに、曲をつける
              </Big>
            )}
            <Big
              tone="violet"
              onClick={() => {
                setFrom('new');
                setPhase('words');
                said({ who: 'freezy', text: 'なら、今日あったことから作る。' });
              }}
            >
              新しく作る
            </Big>
            <Soft
              onClick={() => {
                setPhase('hold');
                said({ who: 'freezy', text: '港は、逃げない。' });
              }}
            >
              今はここで止める
            </Soft>
          </div>
        </Panel>
      )}

      {phase === 'words' && (
        <Panel>
          {from === 'prev' && !jacket ? (
            <>
              <p className="text-center text-sm font-black text-sky-700">アートを選ぶ</p>
              <div className="mt-3 flex flex-wrap justify-center gap-4">
                {stickers.map((s, i) => (
                  <button key={i} onClick={() => setJacket(s)} className="active:scale-95">
                    <Sticker s={s} size={120} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {from === 'prev' && jacket && (
                <div className="mb-3 flex justify-center">
                  <Sticker s={jacket} size={110} />
                </div>
              )}
              <p className="text-center text-sm font-black text-sky-700">{from === 'prev' ? 'そのときの気持ちを、足してもいい' : '今日あったことを話してみよう'}</p>
              <p className="mt-1 text-center text-[12px] font-bold text-slate-500">
                {fill(
                  from === 'prev'
                    ? 'そのとき何があったか、どんな気持ちだったか、足したければ、声で言ってみろ。言葉が、そのまま歌詞になる。足さなくてもいい。'
                    : '今日あったことを、話してみろ。言葉が、そのまま歌詞になる。',
                )}
              </p>
              <div className="mt-3">
                <VoiceField light value={words} onChange={setWords} placeholder={from === 'prev' ? 'うれしかった／ちょっとさみしかった／まだ言葉にならない' : '海のこと／冷蔵庫のこと／いま思ったこと'} maxLength={60} />
              </div>
              <div className="mt-3 space-y-2">
                <Big
                  tone="sky"
                  disabled={!words.trim()}
                  onClick={() => {
                    setPassed(false);
                    setPhase('style');
                    said({ who: 'bati', text: 'どんな曲にしたい？　速さとか、雰囲気とか、できるだけ、くわしく教えて！' });
                  }}
                >
                  送る
                </Big>
                <Soft
                  onClick={() => {
                    setPassed(true);
                    setPhase('style');
                    if (from === 'prev') setCue({ who: 'guide', text: 'いまある言葉だけで、歌詞にします' });
                    else said({ who: 'kimorin', text: '冷蔵庫が、歌詞に。……家電の、デビューですね。' });
                    setTimeout(() => said({ who: 'bati', text: 'どんな曲にしたい？　速さとか、雰囲気とか、できるだけ、くわしく教えて！' }), 2600);
                  }}
                >
                  パス
                </Soft>
                {passed === false && from === 'new' && <p className="text-center text-[11px] text-slate-400">パスすると、いまいる場所（氷の島と冷蔵庫）から、歌詞を考えます</p>}
              </div>
            </>
          )}
        </Panel>
      )}

      {phase === 'style' && (
        <Panel>
          {!cards ? (
            <>
              <VoiceField light value={styleSaid} onChange={setStyleSaid} placeholder="EDMで、アゲアゲで、テンポが速い感じ" maxLength={60} />
              <p className="mt-2 text-center text-[11px] text-slate-400">迷ったら、例から</p>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                {FEELS.filter((f) => f.id !== 'auto').map((f) => (
                  <button key={f.id} onClick={() => setStyleSaid((x) => (x.includes(f.label) ? x : x ? `${x}、${f.label}` : f.label))} className="rounded-full bg-sky-50 px-3 py-1.5 text-[13px] font-bold text-sky-700">
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <Big tone="sky" disabled={!styleSaid.trim()} onClick={() => spell(styleSaid)}>
                  これで
                </Big>
                <Soft onClick={() => spell('')}>おまかせ</Soft>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap justify-center gap-1.5">
                {cards.map((c, i) => (
                  <span key={`${c}-${i}`} className="animate-[fadeUp_0.4s_ease-out] rounded-md border border-sky-300 bg-gradient-to-b from-sky-50 to-amber-50 px-2 py-1 font-serif text-[13px] font-bold text-sky-800 shadow-sm" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}>
                    〈{c}〉
                  </span>
                ))}
              </div>
              <button onClick={() => (saveSpell(cards), setKept(true))} disabled={kept} className="mx-auto mt-2 block text-[12px] font-bold text-violet-600 disabled:text-slate-400">
                {kept ? 'スペルブックに、記しました' : '📖 記す'}
              </button>
              <div className="mt-3 space-y-2">
                <Big tone="sky" onClick={() => (design && redone ? (setPhase('lyrics'), setCue(null)) : void write())}>
                  {design && redone ? 'このスペルで作り直す' : '歌詞の下書きを見る'}
                </Big>
                <Soft onClick={() => setCards(null)}>🎙 話して変える</Soft>
              </div>
            </>
          )}
        </Panel>
      )}

      {phase === 'lyrics' && design && (
        <Panel>
          <p className="text-center text-sm font-black text-sky-700">📝 歌詞の下書き「{design.title}」</p>
          <div className="mt-3 space-y-1.5">
            {lines.map((l) =>
              edit === l.si * 100 + l.li ? (
                <input
                  key={`${l.si}-${l.li}`}
                  autoFocus
                  className="w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-[15px] outline-none"
                  style={{ fontSize: 16 }}
                  maxLength={40}
                  value={l.text}
                  onChange={(e) => setLine(l.si, l.li, e.target.value)}
                  onBlur={() => setEdit(null)}
                />
              ) : (
                <button key={`${l.si}-${l.li}`} onClick={() => setEdit(l.si * 100 + l.li)} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left text-[15px]">
                  <span>{l.text}</span>
                  <span className="text-xs text-sky-400">✏️</span>
                </button>
              ),
            )}
          </div>
          <div className="mt-3 space-y-2">
            <Big
              tone="sky"
              onClick={() => {
                setPhase('mana');
                setCue(null);
              }}
              disabled={lines.some((l) => !l.text.trim())}
            >
              🎤 歌入りで作曲する
            </Big>
            <Soft onClick={() => void write()}>作り直す</Soft>
          </div>
        </Panel>
      )}

      {phase === 'mana' && (
        <Panel>
          <div className="space-y-2">
            <Big tone="violet" onClick={() => void sing()}>
              使う
            </Big>
            <Soft
              onClick={() => {
                setPhase('lyrics');
                said({ who: 'freezy', text: '下書きは、ここに残しておく。' });
              }}
            >
              やめる
            </Soft>
          </div>
        </Panel>
      )}

      {(phase === 'singing' || phase === 'failed') && (
        <Panel>
          <div className="flex justify-center">
            <Record s={record} playing={phase === 'singing'} size={170} />
          </div>
          {phase === 'singing' ? (
            <p className="mt-3 text-center text-sm font-bold text-sky-600">♪ 作曲中…（2〜3分）　アプリを閉じても大丈夫</p>
          ) : (
            <div className="mt-3 space-y-2">
              <Big tone="sky" onClick={() => (design ? void sing() : void write())}>
                もう1回唱える
              </Big>
            </div>
          )}
        </Panel>
      )}

      {phase === 'song' && song && (
        <Panel>
          {redone && other && (
            <div className="mb-2 flex justify-center gap-2">
              {[
                { label: '作り直した曲', s: song, on: true },
                { label: '前の曲', s: other, on: false },
              ].map((c) => (
                <button
                  key={c.label}
                  onClick={() => {
                    if (c.on) return;
                    audio.current?.pause();
                    setOther(song);
                    setSong(c.s);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${c.on ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {c.on ? '✓ ' : ''}
                  {c.s.title}
                </button>
              ))}
            </div>
          )}
          <p className="text-center text-sm font-black text-sky-700">{song.title}</p>
          <div className="mt-3 flex justify-center">
            <button onClick={() => (playing ? audio.current?.pause() : void audio.current?.play())} aria-label="play">
              <Record s={record} playing={playing} size={200} />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">{playing ? 'タップで止める' : 'レコードをタップして ▶ 聴く'}</p>
          <div className="mt-3 space-y-2">
            <Big
              tone="sky"
              onClick={() => {
                audio.current?.pause();
                void api.saveSong(song.id).catch(() => undefined);
                putAway();
              }}
            >
              🔒 土の中にしまう
            </Big>
            {!redone ? (
              <Soft
                onClick={() => {
                  audio.current?.pause();
                  setOther(song);
                  setRedone(true);
                  setPhase('style');
                  said({ who: 'bati', text: 'スペルの、どこを変える？' });
                }}
              >
                作り直す（1回だけ）
              </Soft>
            ) : (
              other && (
                <p className="text-center text-[11px] text-slate-400">二枚のどちらかを選んで〔🔒 土の中にしまう〕（作り直しは、ここまで）</p>
              )
            )}
          </div>
        </Panel>
      )}

      {ab?.k === 'sail' && (
        <Panel>
          <div className="space-y-2">
            <Big
              tone="sky"
              onClick={() => {
                setSailed(true);
                setPost('to');
                ainsert([{ k: 'post' }, { k: 'ship', who: 'mine' }, gd('{neo}の最初の一隻が、ダチの海へ出た'), ki('出た……！　船、出たケン！'), ki('……失礼。見事な船出ですね。'), ...closing()]);
                anext();
              }}
            >
              🚢 出航させる
            </Big>
            <Soft
              onClick={() => {
                ainsert([fr('出航は、いつでもできる。'), gd('〔⛏ 土の中の曲〕から、いつでも〔🚢 出航させる〕を押せます'), ...closing()]);
                anext();
              }}
            >
              今は、土の中にしまっておく
            </Soft>
          </div>
        </Panel>
      )}
      {ab?.k === 'post' && (
        <Panel>
          {post === 'post' ? (
            <Big tone="sky" onClick={() => setPost('to')}>
              🚢 出航させる
            </Big>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-[13px] text-slate-500">行き先</p>
              <div className="rounded-2xl bg-sky-50 p-3 text-center text-[14px] font-bold text-sky-700 ring-2 ring-sky-300">
                ✓ ダチへ（{inviter}・KIMORIN⭐︎）
              </div>
              <Big
                tone="sky"
                onClick={() => {
                  if (song) void api.deliver({ kind: 'song', title: song.title.slice(0, 60), url: song.url, posterUrl: record.url && /^https?:/.test(record.url) ? record.url : undefined, refId: /^[0-9a-f-]{36}$/.test(song.id) ? song.id : undefined }).catch(() => undefined);
                  anext();
                }}
              >
                🚢 出航
              </Big>
            </div>
          )}
        </Panel>
      )}
      {ab?.k === 'ship' && (
        <div className="pointer-events-none absolute bottom-[18svh] left-[30%] z-[160] animate-[shipOut_3.4s_ease-in_forwards]">
          <div className="relative flex flex-col items-center">
            <Sticker s={ab.who === 'mine' ? record : KIMORIN_JACKET} size={100} />
            <span className="-mt-2 text-7xl drop-shadow-xl">⛵</span>
            <div className="absolute bottom-6 right-[-18px]">{ab.who === 'mine' ? <Captain chibi={chibi} face={neoFace} /> : <Captain face={spriteUrl('kimorin-face')} shades />}</div>
          </div>
        </div>
      )}
      {ab?.k === 'oshi' && (
        <div className="absolute inset-x-0 top-[calc(17svh+env(safe-area-inset-top))] z-[185] flex flex-col items-center overflow-hidden pb-4">
          <span className="rounded-full bg-black/40 px-4 py-1 text-[13px] font-bold text-sky-100">推し</span>
          <button
            onClick={() => {
              if (oshi !== 'here') return;
              setOshi('open');
              if (song2.current) {
                song2.current.currentTime = 0;
                song2.current.volume = 1;
                void song2.current.play().catch(() => undefined);
              }
              setTimeout(anext, 900);
            }}
            className={`mt-2 flex flex-col items-center transition-all duration-[1600ms] ${oshi === 'coming' ? 'translate-x-[60vw] opacity-0' : 'translate-x-0 opacity-100'}`}
          >
            <span className="relative flex flex-col items-center">
              <span className="rounded-sm bg-white/90 px-1.5 text-[10px] font-bold text-stone-700">KIMORIN⭐︎</span>
              <span className="text-5xl drop-shadow-xl">⛵</span>
              <span className="absolute -right-5 bottom-3">
                <Captain face={spriteUrl('kimorin-face')} shades size={30} />
              </span>
            </span>
          </button>
        </div>
      )}
      {ab?.k === 'bar' && <Bar glow lit={2} onTap={anext} />}
      {phase === 'after' && ak >= after.findIndex((x) => x.k === 'rise') && after.some((x) => x.k === 'rise') && ab?.k !== 'edit' && (
        <div className="pointer-events-none absolute inset-x-0 top-[26svh] z-[160] flex justify-center px-5">
          {/* the sea off the harbour, where the island rises */}
          <div className={`relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-b px-3 pb-2 pt-6 shadow-2xl ${look?.time === 'night' ? 'from-indigo-950 via-indigo-800 to-sky-900' : look?.time === 'dusk' ? 'from-orange-300 via-rose-300 to-sky-700' : 'from-sky-300 via-sky-400 to-sky-700'}`}>
            <MyIsland look={look ?? islandOmakase(neo)} rise={ab?.k === 'rise' ? rise : 2} records={1} width={320} />
          </div>
        </div>
      )}
      {ab?.k === 'edit' && (
        <Panel>
          {islandHold ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-slate-500">次は、ここから。閉じても、だいじょうぶです</p>
              <Big tone="sky" onClick={() => setIslandHold(false)}>
                続ける
              </Big>
            </div>
          ) : (
            <IslandChat
              neo={neo}
              bati={bati}
              say={said}
              onMake={(l) => {
                setLook(l);
                anext();
              }}
              onHold={() => {
                setIslandHold(true);
                said({ who: 'freezy', text: '海は、逃げん。' });
              }}
            />
          )}
        </Panel>
      )}
    </LessonShell>
  );
}
