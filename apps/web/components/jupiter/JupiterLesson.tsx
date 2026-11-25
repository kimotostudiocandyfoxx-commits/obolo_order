'use client';

import { MAKE_COST } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { Big, LessonShell, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { AtelierScreen } from '@/components/atelier/AtelierScreen';
import { spriteUrl } from '@/lib/onboarding/media';
import { LineVoice } from '@/lib/story/lineVoice';
import type { StickerMade } from '@/lib/onboarding/made';
import { ATELIER_DEFAULT, MyAtelier, atelierCards, atelierFromWords, atelierOmakase, type AtelierLook } from './MyAtelier';
import { NeoButterfly } from './NeoButterfly';
import { LineIcon } from '@/components/LineIcon';
import { Glyph } from '@/components/bluena/glyphs';

/**
 * Day 4 on Jupiter (first journey, the simple version: wip/P03/c01.md D05-S006, c02.md D05-S007〜S008b; D05-S005
 * plays in day4.ts). 作るのは月、しまうのはBluena、見せるのは星 (M-R185): KIMORIN⭐︎ presses 〔🌙 つくる〕, the Moon
 * atelier opens through his Bluena and うんちピンポンくん makes the oil painting『プリプリ・ボカン』from his Saturn
 * murmur; it goes into his Bluena. Then {bati}「工房に行こう！」: the visitor picks one of yesterday's words from
 * Bluena's Saturn vessel (or says new ones), {bati} shows the spell cards and casts it, and the art is a photo,
 * {bati}'s drawing (mana, asked first; one redraw: M-R132) or words only. It is kept in Bluena's Jupiter folder
 * (「Bluenaに、しまったよ！」, the screen closes). Then 🎨 myアトリエ is built by talking with {bati} (part cards,
 * no mana), 〔公開する〕 projects the art from Bluena to the atelier's frame and a small {neo} butterfly carries it
 * to the dachi's sky ({inviter} and KIMORIN⭐︎) — or it stays in Bluena — and KIMORIN⭐︎'s butterfly brings
 * 『プリプリ・ボカン』 into the 〔推し〕 sky. The spellbook hand-over was cut (M-R200). The lines are the script's,
 * word for word, so their voices play.
 * (The type keeps its old name StickerMade: one record per art — its words and its picture.)
 */
export interface JupiterLessonApi {
  stickerArt(text: string, style?: string): Promise<{ url: string }>;
  uploadPhoto(blob: Blob): Promise<{ url: string }>;
  /** 〔🦋 飛ばす〕 to the dachi */
  deliver?(body: { kind: 'jacket'; title?: string; url?: string }): Promise<void>;
}

type Who = 'kaiser' | 'kimorin' | 'pinpon' | 'bati' | 'guide';
type Line = { who: Who; text: string };
/** what is on screen behind the line */
type Scene =
  | 'sky' // the Jupiter sky with the bottom bar
  | 'bar-make' // 〔🌙 つくる〕 shown (not pressed)
  | 'kim-bench' // KIMORIN⭐︎'s atelier through his Bluena: his words, dated
  | 'kim-make' // his murmur picked, 〔アートをつくる〕
  | 'kim-art' // 『プリプリ・ボカン』 on the white card
  | 'kim-close' // the art flows into his Bluena, the screen closes
  | 'bench' // the visitor's atelier through Bluena, {bati} on the bench
  | 'closing' // the visitor's art flows into Bluena, the screen closes
  | 'plot' // the levelled earth with the name tag
  | 'atelier' // myアトリエ
  | 'kim-sky'; // the {neo} butterfly in KIMORIN⭐︎'s 〔推し〕 sky

type Beat = {
  k: 'line' | 'tap-make' | 'tap-atelier' | 'pick' | 'make' | 'chat' | 'build' | 'send' | 'post' | 'oshi' | 'end';
  scene: Scene;
  l?: Line;
  choices?: { label: string; then: Beat[] }[];
};

const K1 = 'うんち。';
const KIMORIN_WORDS = 'ぷりぷりぷりり、うひょひょひょ、げへへ！　ピンポン大正解！';
export const KIMORIN_JACKET: StickerMade = { text: 'プリプリ・ボカン', url: '/onboarding/s/jacket-puripuri.jpg' };

// D05-S006 根っこから一つ選ぶ (KIMORIN⭐︎'s turn), D05-S007 the visitor's art, D05-S008b myアトリエ
const BEATS: Beat[] = [
  { k: 'line', scene: 'sky', l: { who: 'kaiser', text: '木星では、言葉を『アート』にするダ。' } },
  { k: 'line', scene: 'sky', l: { who: 'kaiser', text: '正方形の、一枚の絵ダ。写真でも、描いた絵でも、字だけでも、いいダ。' } },
  { k: 'line', scene: 'sky', l: { who: 'kimorin', text: 'では、私から。天才の手本を、お見せしましょう。' } },
  { k: 'line', scene: 'bar-make', l: { who: 'kaiser', text: '作る時は、〔🌙 つくる〕を押すダ。Bluenaの門が開いて、月の工房に、つながるダ。' } },
  { k: 'line', scene: 'kim-bench', l: { who: 'kimorin', text: 'では、これを。' } },
  { k: 'line', scene: 'kim-make', l: { who: 'pinpon', text: 'ピンポン♪' } },
  { k: 'line', scene: 'kim-make', l: { who: 'guide', text: 'マナを使う時は、使う前に毎回たずねます' } },
  { k: 'line', scene: 'kim-art', l: { who: 'kimorin', text: '……天才の絵です。題して、『プリプリ・ボカン』。' } },
  { k: 'line', scene: 'kim-art', l: { who: 'kaiser', text: '……いいアートダ。' } },
  { k: 'line', scene: 'kim-art', l: { who: 'kimorin', text: '反応の数は、どこで拝見できます？' } },
  { k: 'line', scene: 'kim-art', l: { who: 'kaiser', text: '木星には、点も数もないダ。できたアートは、まず、Bluenaの根っこに、しまわれるダ。' } },
  { k: 'line', scene: 'kim-close', l: { who: 'guide', text: 'できたアートは、Bluenaの中の木星のフォルダ（根っこ）に、しまわれます。自分だけの作品集です' } },
  {
    k: 'line',
    scene: 'sky',
    l: { who: 'guide', text: 'しまったアートは、〔公開する〕で、Bluenaから木星に映して、ダチの空に飛ばせます' },
    choices: [
      {
        label: '「そのアート、好きだよ」と言う',
        // KIMORIN⭐︎'s sunglasses slide down, the slits of his eyes glow blue; he coughs and puts them back
        then: [
          { k: 'line', scene: 'sky', l: { who: 'kimorin', text: '好き？　オレのが？　……ほんとケン？' } },
          { k: 'line', scene: 'sky', l: { who: 'kimorin', text: '……失礼。点より、効きますね。' } },
        ],
      },
      { label: '次は自分の番だと手を挙げる', then: [{ k: 'line', scene: 'sky', l: { who: 'kimorin', text: 'おや、やる気ですね。どうぞ。' } }] },
    ],
  },
  // D05-S007 {neo}のアート／はじめての、スペルの札
  { k: 'line', scene: 'sky', l: { who: 'kaiser', text: '{neo}。土星の言葉のなかで、形にしたくなったものは、あるかダ？' } },
  { k: 'tap-make', scene: 'sky', l: { who: 'bati', text: '工房に行こう！' } },
  { k: 'line', scene: 'bench', l: { who: 'guide', text: '月の工房につながった' } },
  { k: 'pick', scene: 'bench' },
  { k: 'make', scene: 'bench' },
  { k: 'line', scene: 'closing', l: { who: 'bati', text: 'Bluenaに、しまったよ！' } },
  { k: 'line', scene: 'sky', l: { who: 'guide', text: 'アートを、Bluenaの中の木星のフォルダ（根っこ）にしまいました。{neo}だけの作品集です。誰にも送られていません' } },
  // 〔画面：下の〔🎨 myアトリエ〕が、光る〕: the line stays while the button glows
  { k: 'tap-atelier', scene: 'sky', l: { who: 'kaiser', text: '作るのは、月の工房ダ。だが、、、{neo}のアートが生きるのは、この森ダ。' } },
  // D05-S008b myアトリエと、ダチの空へ
  { k: 'line', scene: 'plot', l: { who: 'kaiser', text: 'ここが、{neo}の場所ダ。どんなアトリエにするかは、自分で決めるダ。' } },
  { k: 'chat', scene: 'plot' },
  { k: 'build', scene: 'atelier' },
  { k: 'line', scene: 'atelier', l: { who: 'guide', text: 'myアトリエができた' } },
  { k: 'line', scene: 'atelier', l: { who: 'kaiser', text: '{neo}のアトリエダ。Bluenaから公開したアートは、この壁に並んで、ダチの空に飛んでいくダ。' } },
  { k: 'send', scene: 'atelier', l: { who: 'kaiser', text: '{neo}のダチは、{inviter}と、KIMORINダ。届くのは、ダチだけダ。' } },
];
const SENT: Beat[] = [
  { k: 'post', scene: 'atelier' },
  // KIMORIN⭐︎'s Bluena goes ping: the {neo} butterfly flutters in his 〔推し〕 sky, holding the art
  { k: 'line', scene: 'kim-sky', l: { who: 'kimorin', text: '……{neo}のアート、私の空に、届きました。' } },
];
const KEPT: Beat[] = [{ k: 'line', scene: 'atelier', l: { who: 'kaiser', text: '公開は、いつでもできるダ。アートは、Bluenaの根っこで、待っているダ。' } }];
const OSHI: Beat[] = [
  // KIMORIN⭐︎ presses 〔公開する〕 on『プリプリ・ボカン』 in his Bluena, then 〔🦋 飛ばす〕
  { k: 'line', scene: 'atelier', l: { who: 'kimorin', text: 'では、私も。' } },
  { k: 'oshi', scene: 'atelier' },
  { k: 'line', scene: 'atelier', l: { who: 'guide', text: 'ダチのアートは、上の〔推し〕の空に飛んできます。タップすると見られます' } },
  { k: 'end', scene: 'atelier' },
];

// the spell (M-R142〜M-R145): {bati} shows the cards, 大根カイザー says what a spell is
const SPELL_LINES: Line[] = [
  { who: 'bati', text: 'じゃあ、スペルは、こうなるね！' },
  { who: 'kaiser', text: 'それが、スペルダ。{bati}が唱える、魔法の言葉ダ。スペルが変われば、できあがりも、変わるダ。ネオのうちは、なんとなくで、大丈夫ダ。' },
];

const SPEAKER: Record<Who, string> = { kaiser: '大根カイザー', kimorin: 'KIMORIN', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const NAMES: Record<Who, string> = { kaiser: '大根カイザー', kimorin: 'KIMORIN⭐︎', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { kaiser: 'kaiser1-x-talk', kimorin: 'kimorin-sun', pinpon: 'unchi-pinpon' };

/** Words → small spell cards, one word each (M-R145); the art's shape card closes the spell. */
export function spellCards(words: string, style: string[] = []): string[] {
  const parts = words
    .split(/[、。！？!?\s　…・]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((p) => (p.length > 10 ? `${p.slice(0, 10)}…` : p));
  return [...parts, ...style, '正方形のアート'];
}
/** Said touch → style cards (「水彩で、やわらかい色。夢の中みたい」→〈水彩〉〈やわらかい色〉〈夢の中みたい〉). */
const styleCards = (said: string) =>
  said
    .split(/[、。,.\s　]+/)
    .map((p) => p.replace(/^(で|に|の)|(で|な感じ|感じ|みたいな)$/g, '').trim())
    .filter(Boolean)
    .slice(0, 4);
/** The redraw: a said card replaces the one about the same thing (colour, touch), or is added. */
function restyle(cards: string[], said: string): string[] {
  const add = styleCards(said);
  const out = [...cards];
  for (const c of add) {
    const topic = /色/.test(c) ? /色/ : /タッチ|水彩|油絵|クレヨン|鉛筆|版画/.test(c) ? /タッチ|水彩|油絵|クレヨン|鉛筆|版画/ : null;
    const at = topic ? out.findIndex((x) => topic.test(x)) : -1;
    if (at >= 0) out[at] = c;
    else out.push(c);
  }
  return out.slice(0, 6);
}
const OMAKASE_STYLE = ['やさしい水彩', 'あたたかい色'];

/** 〔📖 記す〕: the spell's cards into the spellbook (on this device until the server keeps it) */
export function saveSpell(cards: string[]) {
  try {
    const book = JSON.parse(localStorage.getItem('obolo.spellbook') ?? '[]') as string[][];
    localStorage.setItem('obolo.spellbook', JSON.stringify([...book, cards].slice(-60)));
  } catch {
    /* private mode */
  }
}

/** The spell cards: small, many, in a magic-letter face (Japanese on top; the English behind is never shown). */
function Cards({ cards }: { cards: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {cards.map((c, k) => (
        <span key={`${c}-${k}`} className="animate-[fadeUp_0.4s_ease-out] rounded-md border border-violet-300 bg-gradient-to-b from-violet-50 to-amber-50 px-2 py-1 font-serif text-[13px] font-bold tracking-wide text-violet-800 shadow-sm" style={{ animationDelay: `${k * 80}ms`, animationFillMode: 'backwards' }}>
          〈{c}〉
        </span>
      ))}
    </div>
  );
}

/** A square art: the picture (or a soft colour) with the words. */
export function Sticker({ s, size = 140, spin = false }: { s: StickerMade; size?: number; spin?: boolean }) {
  const h = [...s.text].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-[6px] bg-white shadow-[0_8px_22px_rgba(40,25,10,0.4)] ${spin ? 'animate-[spin_9s_linear_infinite]' : ''}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0" style={{ background: `linear-gradient(140deg, hsl(${h} 70% 88%), hsl(${(h + 40) % 360} 55% 66%))` }}>
        {s.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      {s.text && (
        <div className={`absolute inset-x-[7%] ${s.url ? 'bottom-[7%]' : 'top-1/2 -translate-y-1/2'} text-center`}>
          <span className="inline-block max-w-full rounded-sm bg-white/85 px-2 py-0.5 font-bold leading-snug text-stone-700 [word-break:keep-all]" style={{ fontSize: Math.max(9, size * 0.08) }}>
            {s.text}
          </span>
        </div>
      )}
    </div>
  );
}
export const Jacket = Sticker;

/** The buttons along the bottom of the Jupiter sky: 〔🦋 空〕〔🎨 myアトリエ〕, and 〔🌙 つくる〕〔Bluena〕 where they sit on every planet. */
function Bar({ glow, onTap }: { glow?: 'make' | 'atelier' | 'make-shown'; onTap?: () => void }) {
  const lit = (k: 'make' | 'atelier') => glow === k || (k === 'make' && glow === 'make-shown');
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[175] flex items-end justify-center gap-4 bg-gradient-to-t from-black/60 to-transparent px-4 pb-5 pt-10">
      <button disabled className="flex flex-col items-center text-[11px] font-bold text-white/70">
        空
      </button>
      <button disabled={glow !== 'make' || !onTap} onClick={onTap} className="-mt-6 flex flex-col items-center text-[11px] font-bold text-amber-100">
        <span className={`flex h-16 w-16 items-center justify-center rounded-full border border-amber-100/40 bg-gradient-to-br from-[#2b3a6b] to-[#0d1430] text-2xl shadow-[0_0_24px_rgba(140,200,255,0.45)] ${lit('make') ? 'animate-pulse ring-4 ring-amber-200' : ''}`}><LineIcon id="moon" className="h-7 w-7" /></span>
        つくる
      </button>
      <button disabled={glow !== 'atelier' || !onTap} onClick={onTap} className={`flex flex-col items-center text-[11px] font-bold ${lit('atelier') ? 'text-amber-200' : 'text-white/70'}`}>
        <span className={`rounded-full ${lit('atelier') ? 'animate-pulse ring-4 ring-amber-200' : ''}`}><Glyph id="art" label={false} className="h-7 w-7" /></span>
        myアトリエ
      </button>
      <span className="absolute bottom-[calc(20px+env(safe-area-inset-bottom))] right-4 flex h-11 w-11 items-center justify-center rounded-full border border-sky-100/50 bg-[radial-gradient(circle_at_35%_35%,#bfe3ff,#3a78c9_60%,#173866)] text-[9px] font-black text-white shadow-[0_0_18px_rgba(120,190,255,0.6)]">
        Bluena
      </span>
    </div>
  );
}

type Make = 'cards' | 'spell' | 'choose' | 'photo' | 'style' | 'cards2' | 'ask-mana' | 'drawing' | 'burnt' | 'ready' | 'restyle';

export function JupiterLesson({
  api,
  kororins,
  neo,
  bati,
  inviter,
  batiImage,
  look: neoFace,
  chibi,
  onDone,
}: {
  api: JupiterLessonApi;
  kororins: string[];
  neo: string;
  bati: string;
  inviter: string;
  batiImage?: string;
  /** the round picture of the visitor's look: the face of their butterfly */
  look?: string;
  /** the small chibi NEO: the butterfly's body when it exists */
  chibi?: string;
  onDone: (arts: StickerMade[], atelier: AtelierLook & { parts: string[] }, sent: boolean) => void;
}) {
  const [beats, setBeats] = useState<Beat[]>(BEATS);
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<'list' | 'new' | 'hold'>('list');
  const [words, setWords] = useState('');
  const [draft, setDraft] = useState<StickerMade | null>(null);
  const [make, setMake] = useState<Make>('cards');
  const [step, setStep] = useState(0);
  const [cards, setCards] = useState<string[]>([]);
  const [said, setSaid] = useState('');
  const [omakase, setOmakase] = useState(false);
  const [art, setArt] = useState<'photo' | 'mana' | 'skip' | null>(null);
  const [mine, setMine] = useState<StickerMade | null>(null);
  const [firstArt, setFirstArt] = useState<string | null>(null);
  const [redrawn, setRedrawn] = useState(false);
  const [look, setLook] = useState<AtelierLook>(ATELIER_DEFAULT);
  const [chat, setChat] = useState<'ask' | 'cards' | 'redo' | 'hold'>('ask');
  const [chatOmakase, setChatOmakase] = useState(false);
  const [built, setBuilt] = useState(0);
  const [sent, setSent] = useState(false);
  const [post, setPost] = useState<'to' | 'fly'>('to');
  const [oshi, setOshi] = useState<'coming' | 'here' | 'open'>('coming');
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const voice = useRef<LineVoice | null>(null);
  const beat = beats[i] as Beat | undefined;
  const scene: Scene = beat?.scene ?? 'sky';
  const fill = (t: string) =>
    t
      .replaceAll('{neo}の言葉', draft?.text ?? '')
      .replaceAll('{neo}', neo)
      .replaceAll('{bati}', bati)
      .replaceAll('{inviter}', inviter);
  const next = () => setI((x) => x + 1);
  const insert = (more: Beat[]) => {
    setBeats((b) => [...b.slice(0, i + 1), ...more, ...b.slice(i + 1)]);
    next();
  };

  // the atelier grows board by board; KIMORIN⭐︎'s butterfly flies in; the end
  useEffect(() => {
    if (beat?.k === 'build') {
      setBuilt(0);
      const t0 = Date.now();
      const iv = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / 3200);
        setBuilt(p);
        if (p >= 1) {
          clearInterval(iv);
          setTimeout(next, 700);
        }
      }, 60);
      return () => clearInterval(iv);
    }
    if (beat?.k === 'oshi') {
      setOshi('coming');
      const a = setTimeout(() => setOshi('here'), 1800);
      return () => clearTimeout(a);
    }
    if (beat?.k === 'end') onDone(mine ? [mine] : [], { ...look, parts: atelierCards(look) }, sent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, beat?.k]);

  useEffect(() => {
    const v = new LineVoice();
    v.unlock();
    voice.current = v;
    return () => v.dispose();
  }, []);

  // the line now on screen (each plays its voice)
  const makeLine: Line | null =
    beat?.k !== 'make'
      ? null
      : make === 'cards'
        ? SPELL_LINES[step]
        : make === 'spell'
          ? { who: 'bati', text: '〈{neo}の言葉〉——ここに、かたちを。' }
          : make === 'choose'
            ? { who: 'guide', text: 'アートの作り方を、えらぶ' }
            : make === 'photo'
              ? { who: 'guide', text: '人が写っている写真は、その人がいいと言ったものだけ使おう。人の顔を、勝手に描くことはしません' }
              : make === 'style'
                ? { who: 'bati', text: 'どんな絵にする？　色とか、タッチとか、できるだけ、くわしく教えて！' }
                : make === 'cards2'
                  ? SPELL_LINES[0]
                  : make === 'ask-mana'
                    ? { who: 'bati', text: 'このスペルで、ボクが描くよ。マナを少し使うけど、いい？' }
                    : make === 'burnt'
                      ? { who: 'bati', text: '魔法陣、ちょっと焦げちゃった……。言葉は残ってるよ。もう1回やる？　字だけにする？' }
                      : make === 'restyle'
                        ? { who: 'bati', text: 'スペルの、どこを変える？' }
                        : make === 'ready' && art === 'skip'
                          ? { who: 'kaiser', text: '字だけのアートも、あるダ。' }
                          : make === 'ready' && art === 'mana'
                            ? { who: 'guide', text: `−${MAKE_COST.jacketArt}マナ` }
                            : null;
  const pickLine: Line | null =
    beat?.k !== 'pick'
      ? null
      : mode === 'hold'
        ? { who: 'guide', text: '次は、ここから' }
        : mode === 'new'
          ? words === '大きな森'
            ? { who: 'kaiser', text: 'なら、見えたままでいいダ。『大きな森』。あとで変えてもいいダ。' }
            : { who: 'kaiser', text: 'なら、話してみるダ。' }
          : { who: 'kaiser', text: '焦って、撮らなくても、いいダ。思い出は、あとから、作れるダ。さあ、遊んでみるダ！' };
  const chatLine: Line | null =
    beat?.k !== 'chat'
      ? null
      : chat === 'ask'
        ? { who: 'bati', text: 'どんなアトリエにしたい？　ざっくりでいいよ！' }
        : chat === 'cards'
          ? { who: 'bati', text: 'じゃあ、こんな感じかな！' }
          : chat === 'hold'
            ? { who: 'guide', text: '次は、ここから' }
            : { who: 'guide', text: '話すと、札が変わります。マナは使いません。あとで変えられます' };
  const current: Line | null = beat?.l ?? makeLine ?? pickLine ?? chatLine;
  useEffect(() => {
    if (current && current.who !== 'guide') void voice.current?.say(SPEAKER[current.who], fill(current.text));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.text, i]);

  const startMake = (text: string) => {
    setDraft({ text, url: null });
    setCards(spellCards(text));
    setMake('cards');
    setStep(0);
    next();
  };
  const cast = () => {
    setMake('spell');
    setTimeout(() => setMake('choose'), 2800);
  };
  // M-R132: {bati}'s picture can be drawn again once; then one of the two is chosen
  const draw = async (again = false) => {
    if (!draft) return;
    if (again && draft.url) setFirstArt(draft.url);
    setMake('drawing');
    try {
      const style = cards.filter((c) => !spellCards(draft.text).includes(c)).join('、');
      const r = await api.stickerArt(draft.text, style || undefined);
      setDraft({ ...draft, url: r.url });
      setArt('mana');
      setRedrawn(again);
      setMake('ready');
    } catch {
      setMake('burnt');
    }
  };
  const photo = async (f: File) => {
    if (!draft) return;
    setMake('drawing');
    try {
      const r = await api.uploadPhoto(f);
      setDraft({ ...draft, url: r.url });
      setArt('photo');
      setMake('ready');
    } catch {
      setMake('choose');
    }
  };
  // the art is kept in Bluena's Jupiter folder (automatically, once chosen: 「Bluenaに、しまったよ！」)
  const keep = () => {
    if (draft) setMine(draft);
    next();
  };

  // --- the line at the top ------------------------------------------------------------------------------
  const lineOf = (l: Line): CoachLine => ({ sprite: l.who === 'bati' ? batiImage : SPRITES[l.who], name: l.who === 'bati' ? bati : NAMES[l.who] || undefined, text: fill(l.text) });
  let coach: CoachLine | null = current ? lineOf(current) : null;
  let actions: React.ReactNode = null;
  if (beat?.k === 'line') {
    actions = beat.choices
      ? beat.choices.map((c) => (
          <button key={c.label} onClick={() => insert(c.then)} className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">
            {c.label}
          </button>
        ))
      : <NextButton onClick={next} />;
  } else if (beat?.k === 'pick' && mode === 'hold') {
    actions = <NextButton label="続ける" onClick={() => setMode('list')} />;
  } else if (beat?.k === 'make') {
    if (make === 'cards') actions = <NextButton onClick={() => (step < SPELL_LINES.length - 1 ? setStep(step + 1) : cast())} />;
    if (make === 'cards2') actions = <NextButton onClick={() => setMake('ask-mana')} />;
  } else if (beat?.k === 'chat' && chat === 'hold') {
    actions = <NextButton label="続ける" onClick={() => setChat('cards')} />;
  } else if (beat?.k === 'oshi') {
    coach = oshi === 'here' ? { text: 'タップすると見られます' } : null;
    if (oshi === 'open') coach = null;
  } else if (beat?.k === 'post' && post === 'fly') {
    coach = null;
  }

  const kimScreen = scene === 'kim-bench' || scene === 'kim-make' || scene === 'kim-art' || scene === 'kim-close';
  const myScreen = scene === 'bench' || scene === 'closing';
  const showBar = scene === 'sky' || scene === 'bar-make';
  const atelierBuilt = scene === 'atelier';

  return (
    <LessonShell bg="/onboarding/s/jupiter-forest.jpg" coach={coach} actions={actions}>
      {batiImage && !myScreen && !showBar && (
        // the Bati stays in one place on screen (M-R14); on the bench while the Moon atelier is open
        // eslint-disable-next-line @next/next/no-img-element
        <img src={batiImage} alt="" className="pointer-events-none absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-3 z-[170] h-16 w-16 rounded-2xl border-2 border-white/70 object-cover shadow-lg" aria-hidden />
      )}

      {showBar && (
        <Bar
          glow={beat?.k === 'tap-make' ? 'make' : beat?.k === 'tap-atelier' ? 'atelier' : scene === 'bar-make' ? 'make-shown' : undefined}
          onTap={beat?.k === 'tap-make' || beat?.k === 'tap-atelier' ? next : undefined}
        />
      )}

      {/* D05-S006: KIMORIN⭐︎'s atelier, opened through his Bluena; うんちピンポンくん hops onto the bench */}
      {kimScreen && (
        <AtelierScreen bati={{ name: 'うんちピンポンくん', image: spriteUrl('unchi-pinpon') }} caption="月で作る" closing={scene === 'kim-close'}>
          {scene === 'kim-art' || scene === 'kim-close' ? (
            <div className="animate-[fadeUp_0.6s_ease-out]">
              <Sticker s={KIMORIN_JACKET} size={200} />
            </div>
          ) : (
            <div className="w-full max-w-[300px] space-y-2">
              {[K1, KIMORIN_WORDS].map((w) => (
                <div key={w} className={`rounded-xl px-3 py-2 text-[13px] font-bold leading-snug ${scene === 'kim-make' && w === KIMORIN_WORDS ? 'bg-amber-100 text-slate-800 ring-2 ring-amber-400' : 'bg-white/90 text-slate-700'}`}>
                  <p className="text-[10px] text-slate-400">土星・きのう</p>
                  {w}
                </div>
              ))}
              {scene === 'kim-make' && <p className="rounded-full bg-amber-400 py-2 text-center text-sm font-black text-white">アートをつくる</p>}
            </div>
          )}
        </AtelierScreen>
      )}

      {/* D05-S007: the visitor's atelier through Bluena, {bati} on the bench */}
      {myScreen && (
        <AtelierScreen bati={{ name: bati, image: batiImage }} caption="月で作る" closing={scene === 'closing'}>
          {beat?.k === 'make' && draft && (
            <div className="flex flex-col items-center gap-3">
              {(make === 'cards' || make === 'spell' || make === 'style' || make === 'cards2' || make === 'ask-mana' || make === 'restyle') && <Cards cards={cards} />}
              {make !== 'cards' && (
                <div className={`relative ${make === 'drawing' || make === 'spell' ? 'animate-pulse' : ''}`}>
                  {make === 'spell' && <span className="absolute inset-[-18%] animate-[spin_4s_linear_infinite] rounded-full border-2 border-dashed border-violet-300" />}
                  <Sticker s={draft} size={make === 'spell' || make === 'drawing' || make === 'ready' || make === 'burnt' ? 170 : 110} />
                </div>
              )}
            </div>
          )}
          {scene === 'closing' && mine && <Sticker s={mine} size={170} />}
        </AtelierScreen>
      )}

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void photo(f);
        }}
      />
      <input
        ref={library}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void photo(f);
        }}
      />

      {/* yesterday's words in Bluena's Saturn vessel, or new words */}
      {beat?.k === 'pick' && mode !== 'hold' && (
        <Panel>
          {mode === 'new' ? (
            <div className="space-y-2">
              <p className="text-center text-[12px] text-slate-500">形にしたい言葉を、話してみよう</p>
              <VoiceField light value={words} onChange={setWords} placeholder="大根の王様、木にまぎれすぎ" maxLength={30} />
              <Big tone="amber" disabled={!words.trim()} onClick={() => startMake(words.trim())}>
                この言葉で、アートをつくる
              </Big>
              <Soft onClick={() => setWords('大きな森')}>パス</Soft>
              <Soft onClick={() => setMode('list')}>もどる</Soft>
            </div>
          ) : (
            <>
              <p className="text-center text-sm font-black text-amber-700">きのうの言葉から一つ選ぶ</p>
              {kororins.length ? (
                <div className="mt-3 space-y-2">
                  <p className="text-center text-[11px] text-slate-400">Bluenaの中の土星の器。土星から伸びてきた光の糸が、結ばれています</p>
                  {kororins.map((w) => (
                    <button key={w} onClick={() => startMake(w)} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-amber-200">
                      <span className="text-amber-400">✦</span>
                      <span className="text-[15px] font-bold leading-snug">{w}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-center text-[12px] text-slate-400">土星の器は、まだ空っぽです</p>
              )}
              <div className="mt-3 space-y-2">
                <Big tone="sky" onClick={() => setMode('new')}>
                  新しく作る
                </Big>
                <Soft onClick={() => setMode('hold')}>今はここで止める</Soft>
              </div>
            </>
          )}
        </Panel>
      )}

      {beat?.k === 'make' && draft && make !== 'cards' && make !== 'spell' && make !== 'cards2' && (
        <Panel>
          {make === 'choose' && (
            <div className="space-y-2">
              <Big tone="sky" onClick={() => setMake('photo')}>
                写真を添える
              </Big>
              <Big
                tone="violet"
                onClick={() => {
                  setSaid('');
                  setMake('style');
                }}
              >
                {bati}に描いてもらう
              </Big>
              <Soft
                onClick={() => {
                  setArt('skip');
                  setMake('ready');
                }}
              >
                字だけ
              </Soft>
            </div>
          )}
          {make === 'photo' && (
            <div className="space-y-2">
              <Big tone="sky" onClick={() => camera.current?.click()}>
                その場で撮る
              </Big>
              <Big tone="sky" onClick={() => library.current?.click()}>
                Bluenaから選ぶ
              </Big>
              <Soft onClick={() => setMake('choose')}>やめる</Soft>
            </div>
          )}
          {make === 'style' && (
            <div className="space-y-2">
              <VoiceField light value={said} onChange={setSaid} placeholder="水彩で、やわらかい色。ちょっと、夢の中みたいな感じ" maxLength={60} />
              <Big
                tone="violet"
                disabled={!said.trim()}
                onClick={() => {
                  setOmakase(false);
                  setCards(spellCards(draft.text, styleCards(said)));
                  setMake('cards2');
                }}
              >
                これで描いてもらう
              </Big>
              <Soft
                onClick={() => {
                  setOmakase(true);
                  setCards(spellCards(draft.text, OMAKASE_STYLE));
                  setMake('cards2');
                }}
              >
                おまかせ
              </Soft>
            </div>
          )}
          {make === 'ask-mana' && (
            <div className="space-y-2">
              {omakase && <p className="text-center text-[11px] text-slate-400">言葉に合う絵のタッチを、{bati}が選びます</p>}
              <Big tone="violet" onClick={() => void draw()}>
                使う
              </Big>
              <Soft onClick={() => setMake('choose')}>やめる</Soft>
            </div>
          )}
          {make === 'drawing' && <p className="text-center text-sm font-bold text-violet-500">魔法陣を描いています…</p>}
          {make === 'burnt' && (
            <div className="space-y-2">
              <Big tone="violet" onClick={() => void draw(redrawn)}>
                もう1回
              </Big>
              <Soft
                onClick={() => {
                  setArt('skip');
                  setMake('ready');
                }}
              >
                字だけにする
              </Soft>
            </div>
          )}
          {make === 'restyle' && (
            <div className="space-y-2">
              <VoiceField light value={said} onChange={setSaid} placeholder="もっと、明るい色で" maxLength={40} />
              <Big
                tone="violet"
                onClick={() => {
                  if (said.trim()) setCards((c) => restyle(c, said));
                  void draw(true);
                }}
              >
                描き直す
              </Big>
              <p className="text-center text-[11px] text-slate-400">札を、話して変えられる（変えなくてもいい）</p>
            </div>
          )}
          {make === 'ready' && art === 'mana' && (
            <div className="space-y-2">
              {redrawn && firstArt && (
                <div className="flex justify-center gap-3">
                  {[firstArt, draft.url].map((u) => (
                    <button key={u} onClick={() => setDraft({ ...draft, url: u })} className={`rounded-md ring-4 ${draft.url === u ? 'ring-amber-400' : 'ring-transparent'}`}>
                      <Sticker s={{ ...draft, url: u }} size={96} />
                    </button>
                  ))}
                </div>
              )}
              <Big tone="amber" onClick={keep}>
                この絵にする
              </Big>
              {!redrawn && (
                <Soft
                  onClick={() => {
                    setSaid('');
                    setMake('restyle');
                  }}
                >
                  描き直す（1回だけ）
                </Soft>
              )}
              {redrawn && <p className="text-center text-[11px] text-slate-400">二枚のどちらかを選んで〔この絵にする〕（描き直しは、ここまで）</p>}
            </div>
          )}
          {make === 'ready' && art !== 'mana' && (
            <div className="space-y-2">
              <Big tone="amber" onClick={keep}>
                このアートにする
              </Big>
              <Soft
                onClick={() => {
                  setDraft({ ...draft, url: null });
                  setArt(null);
                  setMake('choose');
                }}
              >
                作り方を変える
              </Soft>
            </div>
          )}
        </Panel>
      )}

      {/* D05-S008b: the plot with your name tag, then the atelier */}
      {(scene === 'plot' || atelierBuilt) && beat?.k !== 'oshi' && (
        <div className="absolute inset-x-0 top-[20svh] z-[160] flex flex-col items-center">
          {atelierBuilt ? (
            <MyAtelier look={look} built={beat?.k === 'build' ? built : 1} arts={beat?.k === 'post' && post === 'fly' && mine ? [mine] : []} width={280} />
          ) : (
            <div className="flex h-[268px] w-[280px] items-end justify-center">
              <div className="mb-6 h-6 w-56 rounded-[50%] bg-[#5b3a22]/70" />
            </div>
          )}
          <span className="-mt-2 rounded bg-[#f6ead2] px-2 py-0.5 text-[12px] font-bold text-stone-700 shadow">{neo}</span>
          {/* 〔🦋 飛ばす〕: the art is projected into the frame, the {neo} butterfly is born from it and flies out of the window */}
          {beat?.k === 'post' && post === 'fly' && mine && (
            <div className="pointer-events-none absolute left-[40%] top-[30%] animate-[flyAway_2.6s_ease-in_0.6s_both]">
              <NeoButterfly face={neoFace} body={chibi} art={mine} size={90} />
            </div>
          )}
          <style>{'@keyframes flyAway{0%{transform:scale(.3);opacity:0}20%{transform:scale(1);opacity:1}100%{transform:translate(120px,-260px) scale(.4);opacity:0}}'}</style>
        </div>
      )}

      {/* KIMORIN⭐︎'s 〔推し〕 sky: the {neo} butterfly flutters there, holding the art */}
      {scene === 'kim-sky' && mine && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(24svh+env(safe-area-inset-top))] z-[160] flex flex-col items-center">
          <span className="rounded-full bg-black/40 px-4 py-1 text-[13px] font-bold text-amber-100">推し</span>
          <div className="mt-4" style={{ animation: 'butterflyDrift 6s ease-in-out infinite' }}>
            <NeoButterfly face={neoFace} body={chibi} art={mine} size={110} />
          </div>
          <style>{'@keyframes butterflyDrift{0%,100%{transform:translate(0,0)}25%{transform:translate(14px,-18px)}50%{transform:translate(28px,4px)}75%{transform:translate(10px,14px)}}'}</style>
        </div>
      )}

      {beat?.k === 'chat' && chat !== 'hold' && (
        <Panel>
          {chat === 'ask' || chat === 'redo' ? (
            <div className="space-y-3">
              <p className="text-center text-sm font-black text-amber-700">myアトリエ</p>
              <VoiceField light value={said} onChange={setSaid} placeholder={chat === 'ask' ? '森の中の、木とガラスの、あったかいアトリエ' : 'もっと、明るく'} maxLength={40} />
              <Big
                tone="amber"
                disabled={!said.trim()}
                onClick={() => {
                  setLook((l) => atelierFromWords(said, chat === 'ask' ? ATELIER_DEFAULT : l));
                  setSaid('');
                  setChatOmakase(false);
                  setChat('cards');
                }}
              >
                これで組む
              </Big>
              {chat === 'ask' && (
                <Soft
                  onClick={() => {
                    setLook(atelierOmakase());
                    setChatOmakase(true);
                    setChat('cards');
                  }}
                >
                  おまかせ
                </Soft>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {chatOmakase && <p className="text-center text-[11px] text-slate-400">{neo}の姿と、作ったアートに合うアトリエを、{bati}が組みます</p>}
              <div className="flex justify-center">
                <MyAtelier look={look} width={150} />
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {atelierCards(look).map((c) => (
                  <span key={c} className="rounded-md bg-amber-50 px-2 py-1 text-[12px] font-bold text-amber-800 ring-1 ring-amber-300">
                    〈{c}〉
                  </span>
                ))}
              </div>
              <Big tone="amber" onClick={next}>
                このアトリエにする
              </Big>
              <Soft
                onClick={() => {
                  setSaid('');
                  setChat('redo');
                }}
              >
                話して直す
              </Soft>
              <Soft onClick={() => setChat('hold')}>今はここで止める</Soft>
              <p className="text-center text-[11px] text-slate-400">話すと、札が変わります。マナは使いません。あとで変えられます</p>
            </div>
          )}
        </Panel>
      )}

      {beat?.k === 'send' && (
        <Panel>
          <div className="space-y-2">
            <Big
              tone="sky"
              onClick={() => {
                setSent(true);
                setPost('to');
                insert([...SENT, ...OSHI]);
              }}
            >
              公開する
            </Big>
            <Soft onClick={() => insert([...KEPT, ...OSHI])}>今は公開せず、Bluenaにしまっておく</Soft>
          </div>
        </Panel>
      )}
      {beat?.k === 'post' && post === 'to' && (
        <Panel>
          <div className="space-y-3">
            <p className="text-center text-[13px] text-slate-500">行き先</p>
            <div className="rounded-2xl bg-sky-50 p-3 text-center text-[14px] font-bold text-sky-700 ring-2 ring-sky-300">✓ ダチへ（{inviter}・KIMORIN⭐︎）</div>
            <p className="text-center text-[11px] text-slate-400">Bluenaから木星に映すと、蝶がアートを抱えて、88時間、ダチの空を飛び、あなたのアトリエに帰ります</p>
            <Big
              tone="sky"
              onClick={() => {
                if (mine) void api.deliver?.({ kind: 'jacket', title: mine.text.slice(0, 60), url: mine.url && /^https?:/.test(mine.url) ? mine.url : undefined }).catch(() => undefined);
                setPost('fly');
                setTimeout(next, 3400);
              }}
            >
              飛ばす
            </Big>
          </div>
        </Panel>
      )}
      {beat?.k === 'oshi' && (
        <div className="absolute inset-x-0 top-[calc(17svh+env(safe-area-inset-top))] z-[185] flex flex-col items-center overflow-hidden pb-4">
          <span className="rounded-full bg-black/40 px-4 py-1 text-[13px] font-bold text-amber-100">推し</span>
          <button onClick={() => oshi === 'here' && setOshi('open')} className={`mt-2 flex flex-col items-center transition-all duration-[1600ms] ${oshi === 'coming' ? 'translate-x-[60vw] opacity-0' : 'translate-x-0 opacity-100'}`}>
            {oshi === 'open' ? <Sticker s={KIMORIN_JACKET} size={200} /> : <NeoButterfly face={spriteUrl('kimorin-face')} art={KIMORIN_JACKET} size={96} shades hue={200} />}
            <span className="mt-1 rounded-full bg-white/80 px-2 text-[10px] font-bold text-stone-600">@KIMORIN⭐︎</span>
          </button>
          {oshi === 'open' && (
            <div className="mt-3">
              <NextButton onClick={next} />
            </div>
          )}
        </div>
      )}

    </LessonShell>
  );
}
