'use client';

import { useEffect, useRef, useState } from 'react';
import { Big, LessonShell, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { spriteUrl } from '@/lib/onboarding/media';
import { LineVoice } from '@/lib/story/lineVoice';
import type { StickerMade } from '@/lib/onboarding/made';
import { ATELIER_DEFAULT, MyAtelier, atelierCards, atelierFromWords, atelierOmakase, type AtelierLook } from './MyAtelier';
import { NeoButterfly } from './NeoButterfly';

/**
 * Day 4 on Jupiter (first journey; story D05-S005〜S008b, draft 21: M-R151 art, M-R142〜M-R146 spells, M-R155〜157
 * the butterfly and myアトリエ). 大根カイザー teaches; words become an『アート』— one square picture: a photo,
 * {bati}'s drawing (mana, asked first; one redraw) or words only. KIMORIN⭐︎ goes first with the oil painting
 * 『プリプリ・ボカン』, then the visitor makes one from a root's words or new words: {bati} shows the spell cards and
 * casts it; 大根カイザー gives the spellbook. Put on the stone, the art is carried off by a small {neo} butterfly.
 * Then 🎨 myアトリエ is built by talking with {bati} (part cards, no mana), the butterfly hangs the art in its
 * frame, may fly it to the dachi's sky ({inviter} and KIMORIN⭐︎), and KIMORIN⭐︎'s butterfly brings his art into the
 * 〔推し〕 sky. The lines are the story's, word for word, so their voices play.
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
type Scene = 'stone' | 'demo-bar' | 'demo-roots' | 'demo-picked' | 'demo-art' | 'demo-title' | 'roots';

type Beat =
  | { k: 'say'; who: Who; text: string; scene?: Scene; choices?: { label: string; reply: Line[] }[] }
  | { k: 'pick' }
  | { k: 'make' };

const KIMORIN_WORDS = 'ぷりぷりぷりり！　ぷりぷりぷりり！　うひょひょひょげへへ！……ぷりぷり滑り台でボカーン！';
export const KIMORIN_JACKET: StickerMade = { text: 'プリプリ・ボカン', url: '/onboarding/s/jacket-puripuri.jpg' };

// D05-S005〜S006, and the start of S007
const OPEN: Beat[] = [
  { k: 'say', who: 'kaiser', text: '木星は、命が宿る星ダ。' },
  { k: 'say', who: 'kaiser', text: '君が見た風景だったり、今日食べたご飯だったり。そんな何気ない日常でも、命を宿し、そして思い出になっていくのダ。' },
  { k: 'say', who: 'kaiser', text: 'この石に、言葉の『アート』を立ててみるダ。', scene: 'stone' },
  { k: 'say', who: 'kaiser', text: '百聞は、一見にしかず、ダ。', scene: 'stone' },
  {
    k: 'say',
    who: 'kimorin',
    text: '……百聞は、一見にしかず。いい言葉ですね。今日から、私の言葉にしましょう。',
    scene: 'stone',
    choices: [
      { label: '「それ、昔からあることわざだよ」と言う', reply: [{ who: 'kimorin', text: '……ご存じでしたか。では、私が広めた、ということで。' }] },
      { label: '黙って見ている', reply: [{ who: 'kimorin', text: '……異論は、ないようですね。今日から、私の言葉です。' }] },
    ],
  },
  { k: 'say', who: 'kaiser', text: '木星では、言葉を『アート』にするダ。' },
  { k: 'say', who: 'kaiser', text: '正方形の、一枚の絵ダ。写真でも、描いた絵でも、字だけでも、いいダ。' },
  { k: 'say', who: 'kimorin', text: 'では、私から。天才の手本を、お見せしましょう。' },
  { k: 'say', who: 'kaiser', text: 'まず〔🥚 たまご〕を押すダ。根っこが開くダ。', scene: 'demo-bar' },
  { k: 'say', who: 'kaiser', text: 'この中から一つ選んで、アートにするダ。', scene: 'demo-roots' },
  { k: 'say', who: 'kimorin', text: 'では、これを。', scene: 'demo-picked' },
  { k: 'say', who: 'pinpon', text: 'ピンポン♪', scene: 'demo-picked' },
  { k: 'say', who: 'kimorin', text: '……ふふ。ありがとう、ピンポンくん。', scene: 'demo-picked' },
  { k: 'say', who: 'kaiser', text: 'その日の写真があれば、添えるダ。なくても、マナで、作れるダ。', scene: 'demo-picked' },
  { k: 'say', who: 'guide', text: 'マナを使う時は、使う前に毎回たずねます', scene: 'demo-picked' },
  { k: 'say', who: 'kimorin', text: '……天才の絵です。', scene: 'demo-art' },
  { k: 'say', who: 'kimorin', text: '題して、『プリプリ・ボカン』。', scene: 'demo-title' },
  { k: 'say', who: 'kaiser', text: '……いいアートダ。', scene: 'demo-title' },
  { k: 'say', who: 'kimorin', text: '反応の数は、どこで拝見できます？', scene: 'demo-title' },
  { k: 'say', who: 'kaiser', text: '木星には、点も数もないダ。まず、根っこにしまうダ。', scene: 'demo-title' },
  { k: 'say', who: 'guide', text: '〔🔒 根っこにしまう〕で、自分の根っこに残します', scene: 'demo-title' },
  {
    k: 'say',
    who: 'guide',
    text: 'しまったアートは、〔🦋 投稿する〕で、ダチの空に飛ばせます',
    scene: 'demo-title',
    choices: [
      {
        label: '「そのジャケ、好きだよ」と言う',
        reply: [
          { who: 'kimorin', text: '好き？　オレのが？　……ほんとケン？' },
          { who: 'kimorin', text: '……失礼。点より、効きますね。' },
        ],
      },
      { label: '次は自分の番だと手を挙げる', reply: [{ who: 'kimorin', text: 'おや、やる気ですね。どうぞ。' }] },
    ],
  },
  // D05-S007 the visitor's art
  { k: 'say', who: 'kaiser', text: '{neo}。土星の言葉のなかで、形にしたくなったものは、あるかダ？', scene: 'roots' },
  { k: 'pick' },
  { k: 'make' },
];

// the spell (M-R142〜M-R144): {bati} shows the cards, 大根カイザー says what a spell is
const SPELL_LINES: Line[] = [
  { who: 'bati', text: 'じゃあ、スペルは、こうなるね！' },
  { who: 'kaiser', text: 'それが、スペルダ。{bati}が唱える、魔法の言葉ダ。スペルが変われば、できあがりも、変わるダ。' },
  { who: 'kaiser', text: 'Obolo Order達は、スペルを自由自在に使いこなして、魔法を唱えてるんダ。まぁ、ネオのうちは、なんとなくで、大丈夫ダ。' },
];
// the spellbook (M-R146): everyone gets it before keeping the art
const BOOK_LINES: Line[] = [
  { who: 'kaiser', text: '{neo}。これを、持っていくダ。' },
  { who: 'guide', text: 'スペルブックを、もらった' },
  { who: 'kaiser', text: 'スペルブックダ。今後、気に入ったスペルがあったら、このスペルブックに、記しておくのが、いいダ。' },
  { who: 'kaiser', text: '記したスペルは、どの星で作る時も、開けば、いつでも出せるダ。' },
];

// D05-S008 蝶が、パタパタ
const FLY: Line[] = [
  { who: 'kaiser', text: '……石に、置いてみるダ。' },
  { who: 'kaiser', text: '木星ではな、アートは蝶が運ぶダ。{neo}の蝶ダ。' },
  { who: 'kaiser', text: '飛ばすのは、アトリエを建ててからダ。' },
  { who: 'guide', text: '飛んでいる蝶をタップすると〔アート帳〕がひらきます。蝶は石のまわりを飛ぶだけで、誰にも送られていません' },
  { who: 'kimorin', text: '……飛んだ。オレのが、飛んだケン……！　言葉の翼ケン！' },
  { who: 'kimorin', text: '……失礼。おしゃれですね。' },
  { who: 'kaiser', text: '中身は、水星で作るダ。{neo}。今日という日も、ひとつの命ダ。' },
];

// D05-S008b myアトリエと、ダチの空へ
type AtBeat =
  | { k: 'line'; l: Line }
  | { k: 'bar' } // the 🎨 myアトリエ button glows
  | { k: 'chat' } // {bati}: what kind of atelier? → the part cards → 〔このアトリエにする〕
  | { k: 'build' }
  | { k: 'hang' } // the butterfly hangs the art in the frame
  | { k: 'send' } // 〔🦋 投稿する〕〔今は飛ばさず、壁に飾っておく〕
  | { k: 'post' } // 行き先〔ダチへ〕 → 〔🦋 飛ばす〕
  | { k: 'oshi' } // KIMORIN⭐︎'s butterfly flies into the 〔推し〕 sky: tap it
  | { k: 'end' };
const kai = (text: string): AtBeat => ({ k: 'line', l: { who: 'kaiser', text } });
const kim = (text: string): AtBeat => ({ k: 'line', l: { who: 'kimorin', text } });
const note = (text: string): AtBeat => ({ k: 'line', l: { who: 'guide', text } });
const ATELIER: AtBeat[] = [
  note('下の〔🎨 myアトリエ〕が、光る'),
  { k: 'bar' },
  kai('ここが、{neo}の場所ダ。どんなアトリエにするかは、自分で決めるダ。'),
  { k: 'chat' },
  { k: 'build' },
  note('myアトリエができた'),
  { k: 'hang' },
  kai('君のアトリエダ。作ったアートは、この壁に並ぶダ。'),
  kai('そのアートは、ダチの空に飛ばせるダ。'),
  kai('{neo}のダチは、{inviter}と、KIMORINダ。届くのは、ダチだけダ。'),
  { k: 'send' },
];
const SENT: AtBeat[] = [{ k: 'post' }, kai('88時間、ダチの空を飛んで、この壁に帰ってくるダ。帰ってきたら、額に、葉が一枚出るダ。'), kim('……{neo}のアート、私の空に、届きました。')];
const KEPT: AtBeat[] = [kai('飛ばすのは、いつでもできるダ。')];
const OSHI: AtBeat[] = [
  kim('では、私も。'),
  { k: 'oshi' },
  kai('上の〔推し〕は、ダチの作品が飛んでくる空ダ。KIMORINは、もう{neo}のダチダ。だから、来るダ。'),
  note('ダチのアートは、上の〔推し〕の空に飛んできます。タップすると見られます'),
  kim('……{neo}の空で、私のアートが、開いています……！'),
  kim('……ダチの空とは、いいものですね。'),
  kai('アトリエも空も、いつ来て遊んでもよいダ。'),
  { k: 'end' },
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

function saveSpell(cards: string[]) {
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

/** The three buttons along the bottom of every planet (here: sky / egg / my atelier). */
function Bar({ glow, lit = 1, onTap }: { glow?: boolean; lit?: number; onTap?: () => void }) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[175] flex justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-4 pb-5 pt-8">
      {['🦋 空', '🥚 たまご', '🎨 myアトリエ'].map((l, k) => (
        <button key={l} disabled={k !== lit || !onTap} onClick={onTap} className={`rounded-2xl px-4 py-2.5 text-sm font-black ${k === lit ? `bg-amber-300 text-amber-900 ${glow ? 'animate-pulse ring-4 ring-amber-200' : ''}` : 'bg-white/20 text-white/80'}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

type Make = 'cards' | 'spell' | 'choose' | 'style' | 'ask-mana' | 'drawing' | 'burnt' | 'ready' | 'restyle' | 'book' | 'keep' | 'kept';

export function JupiterLesson({
  api,
  kororins,
  neo,
  bati,
  inviter,
  batiImage,
  look: neoFace,
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
  onDone: (arts: StickerMade[], atelier: AtelierLook & { parts: string[] }, sent: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [reply, setReply] = useState<Line[] | null>(null);
  const [replyAt, setReplyAt] = useState(0);
  const [mode, setMode] = useState<'list' | 'new' | 'hold'>('list');
  const [words, setWords] = useState('');
  const [draft, setDraft] = useState<StickerMade | null>(null);
  const [make, setMake] = useState<Make>('cards');
  const [step, setStep] = useState(0);
  const [cards, setCards] = useState<string[]>([]);
  const [said, setSaid] = useState('');
  const [art, setArt] = useState<'photo' | 'mana' | 'skip' | null>(null);
  const [mine, setMine] = useState<StickerMade | null>(null);
  const [fly, setFly] = useState(-1);
  const [firstArt, setFirstArt] = useState<string | null>(null);
  const [redrawn, setRedrawn] = useState(false);
  const [picking, setPicking] = useState(false);
  const [kept, setKept] = useState<boolean | null>(null);
  const [at, setAt] = useState<AtBeat[] | null>(null);
  const [ai, setAi] = useState(0);
  const [look, setLook] = useState<AtelierLook>(ATELIER_DEFAULT);
  const [chat, setChat] = useState<'ask' | 'cards' | 'redo' | 'hold'>('ask');
  const [built, setBuilt] = useState(0);
  const [sent, setSent] = useState(false);
  const [post, setPost] = useState<'to' | 'fly' | 'gone'>('to');
  const [oshi, setOshi] = useState<'coming' | 'here' | 'open'>('coming');
  const [book, setBook] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const voice = useRef<LineVoice | null>(null);
  const beat = OPEN[i] as Beat | undefined;
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{bati}', bati).replaceAll('{inviter}', inviter);
  const ab = at?.[ai];
  const anext = () => setAi((x) => x + 1);
  const ainsert = (more: AtBeat[]) => setAt((t) => (t ? [...t.slice(0, ai + 1), ...more, ...t.slice(ai + 1)] : t));

  // the atelier grows board by board; the butterfly hangs the art; KIMORIN⭐︎'s butterfly flies in
  useEffect(() => {
    if (ab?.k === 'build') {
      setBuilt(0);
      const t0 = Date.now();
      const iv = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / 3200);
        setBuilt(p);
        if (p >= 1) {
          clearInterval(iv);
          setTimeout(anext, 700);
        }
      }, 60);
      return () => clearInterval(iv);
    }
    if (ab?.k === 'hang') {
      const a = setTimeout(anext, 2200);
      return () => clearTimeout(a);
    }
    if (ab?.k === 'oshi') {
      setOshi('coming');
      const a = setTimeout(() => setOshi('here'), 1800);
      return () => clearTimeout(a);
    }
    if (ab?.k === 'end') onDone(mine ? [mine] : [], { ...look, parts: atelierCards(look) }, sent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ab]);

  useEffect(() => {
    const v = new LineVoice();
    v.unlock();
    voice.current = v;
    return () => v.dispose();
  }, []);
  const say = (l: Line) => {
    if (l.who !== 'guide') void voice.current?.say(SPEAKER[l.who], fill(l.text));
  };

  // the line now on screen (each plays its voice)
  const makeLine: Line | null =
    beat?.k !== 'make' || fly >= 0 || at
      ? null
      : make === 'cards'
        ? SPELL_LINES[step]
        : make === 'spell'
          ? { who: 'bati', text: '〈{neo}の言葉〉——ここに、かたちを。' }
          : make === 'style'
            ? { who: 'bati', text: 'どんな絵にする？　色とか、タッチとか、できるだけ、くわしく教えて！' }
            : make === 'ask-mana'
              ? { who: 'bati', text: 'このスペルで、ボクが描くよ。マナを少し使うけど、いい？' }
              : make === 'burnt'
                ? { who: 'bati', text: '魔法陣、ちょっと焦げちゃった……。言葉は残ってるよ。もう1回やる？　字だけにする？' }
                : make === 'restyle'
                  ? { who: 'bati', text: 'スペルの、どこを変える？' }
                  : make === 'ready' && art === 'skip'
                    ? { who: 'kaiser', text: '字だけのアートも、あるダ。' }
                    : make === 'book'
                      ? BOOK_LINES[step]
                      : null;
  const atLine: Line | null = ab?.k === 'line' ? ab.l : ab?.k === 'chat' ? (chat === 'ask' ? { who: 'bati', text: 'どんなアトリエにしたい？　ざっくりでいいよ！' } : chat === 'cards' ? { who: 'bati', text: 'じゃあ、こんな感じかな！' } : null) : null;
  const current: Line | null = at ? atLine : fly >= 0 ? FLY[fly] ?? null : reply ? reply[replyAt] : beat?.k === 'say' ? beat : beat?.k === 'pick' ? (mode === 'new' ? { who: 'kaiser', text: words === '大きな森' ? 'なら、見えたままでいいダ。『大きな森』。あとで変えてもいいダ。' : 'なら、話してみるダ。' } : { who: 'kaiser', text: '焦って、撮らなくても、いいダ。思い出は、あとから、作れるダ。さあ、遊んでみるダ！' }) : makeLine;
  useEffect(() => {
    if (current) say(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.text]);

  const next = () => {
    setReply(null);
    setReplyAt(0);
    setI((x) => x + 1);
  };
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
  const toBook = () => {
    setMake('book');
    setStep(0);
  };

  // --- the line at the top ------------------------------------------------------------------------------
  const lineOf = (l: Line): CoachLine => ({ sprite: l.who === 'bati' ? batiImage : SPRITES[l.who], name: l.who === 'bati' ? bati : NAMES[l.who] || undefined, text: fill(l.text) });
  let coach: CoachLine | null = current ? lineOf(current) : null;
  let actions: React.ReactNode = null;
  let scene: Scene | undefined = beat?.k === 'say' ? beat.scene : undefined;
  if (at) {
    scene = undefined;
    if (ab?.k === 'bar') coach = { text: '〔🎨 myアトリエ〕を押す' };
    if (ab?.k === 'oshi') coach = oshi === 'here' ? { text: '上の〔推し〕の空に、蝶が一匹。タップしてみよう' } : null;
    if (ab?.k === 'line') actions = <NextButton onClick={anext} />;
  } else if (fly >= 0) {
    actions = (
      <NextButton
        onClick={() => {
          if (fly < FLY.length - 1) return setFly(fly + 1);
          setAt(ATELIER);
          setAi(0);
        }}
      />
    );
  } else if (beat?.k === 'say') {
    actions =
      beat.choices && !reply ? (
        beat.choices.map((c) => (
          <button key={c.label} onClick={() => setReply(c.reply)} className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">
            {c.label}
          </button>
        ))
      ) : (
        <NextButton onClick={() => (reply && replyAt < reply.length - 1 ? setReplyAt(replyAt + 1) : next())} />
      );
  } else if (beat?.k === 'pick') {
    scene = 'roots';
    if (mode === 'hold') {
      coach = { text: '次は、ここから。閉じても、だいじょうぶです' };
      actions = <NextButton label="続ける" onClick={() => setMode('list')} />;
    }
  } else if (beat?.k === 'make') {
    if (make === 'cards') actions = <NextButton onClick={() => (step < SPELL_LINES.length - 1 ? setStep(step + 1) : cast())} />;
    if (make === 'book' && step < BOOK_LINES.length - 1) actions = <NextButton onClick={() => setStep(step + 1)} />;
    if (make === 'ready' && art === 'mana' && !picking && !coach) coach = { text: '−3マナ' };
    if (make === 'choose') coach = { text: 'アートの作り方を、えらぶ' };
    if (make === 'kept') {
      coach = { text: `アートを、${neo}だけの根っこにしまいました。誰にも送られていません` };
      actions = <NextButton onClick={() => setFly(0)} />;
    }
  }

  const born = fly >= 1;
  const kimFly = fly >= 4;

  return (
    <LessonShell bg={at && ai > 1 ? '/onboarding/s/jupiter-forest.jpg' : '/onboarding/s/jupiter-stone.jpg'} coach={coach} actions={actions}>
      {batiImage && beat?.k !== 'make' && (
        // the Bati stays in one place on screen (M-R14)
        // eslint-disable-next-line @next/next/no-img-element
        <img src={batiImage} alt="" className="pointer-events-none absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-3 z-[170] h-16 w-16 rounded-2xl border-2 border-white/70 object-cover shadow-lg" aria-hidden />
      )}

      {/* KIMORIN⭐︎'s turn, shown on the planet's screen */}
      {scene === 'demo-bar' && <Bar glow />}
      {(scene === 'demo-roots' || scene === 'demo-picked') && (
        <Panel>
          <p className="text-center text-sm font-black text-amber-700">🔒 根っこ（KIMORIN⭐︎だけ）</p>
          <div className={`mt-3 rounded-2xl p-3 text-[14px] font-bold leading-snug ${scene === 'demo-picked' ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-slate-50'}`}>
            <p className="text-[10px] text-slate-400">土星</p>
            {KIMORIN_WORDS}
          </div>
          {scene === 'demo-picked' && <p className="mt-3 rounded-full bg-amber-400 py-2.5 text-center text-sm font-black text-white">アートをつくる</p>}
        </Panel>
      )}
      {(scene === 'demo-art' || scene === 'demo-title') && (
        <div className="absolute inset-x-0 top-[34svh] z-[160] flex justify-center">
          <div className="animate-[fadeUp_0.6s_ease-out]">
            <Sticker s={scene === 'demo-title' ? KIMORIN_JACKET : { text: '', url: KIMORIN_JACKET.url }} size={230} />
          </div>
        </div>
      )}

      {beat?.k === 'pick' && mode !== 'hold' && (
        <Panel>
          <p className="text-center text-sm font-black text-amber-700">🔒 根っこ（{neo}だけ）</p>
          {kororins.length ? (
            <div className="mt-3 space-y-2">
              <p className="text-center text-[11px] text-slate-400">土星でつぶやいた言葉。光の糸が、結ばれています</p>
              {kororins.map((w) => (
                <button key={w} onClick={() => startMake(w)} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-amber-200">
                  <span className="text-amber-400">✦</span>
                  <span className="text-[15px] font-bold leading-snug">{w}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-center text-[12px] text-slate-400">根っこは、まだ空っぽです</p>
          )}
          {mode === 'new' ? (
            <div className="mt-3 space-y-2">
              <p className="text-center text-[12px] text-slate-500">形にしたい言葉を、話してみよう</p>
              <VoiceField light value={words} onChange={setWords} placeholder="大根の王様、木にまぎれすぎ" maxLength={30} />
              <Big tone="amber" disabled={!words.trim()} onClick={() => startMake(words.trim())}>
                この言葉で、アートをつくる
              </Big>
              <Soft onClick={() => setWords('大きな森')}>パス</Soft>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <Big tone="sky" onClick={() => setMode('new')}>
                新しく作る
              </Big>
              <Soft onClick={() => setMode('hold')}>今はここで止める</Soft>
            </div>
          )}
        </Panel>
      )}

      {beat?.k === 'make' && draft && fly < 0 && !at && (
        <Panel>
          {/* the spell cards, then the white square card the words settle on */}
          {(make === 'cards' || make === 'spell' || make === 'style' || make === 'ask-mana' || make === 'restyle') && (
            <div className="mb-3">
              <Cards cards={cards} />
            </div>
          )}
          {make !== 'cards' && (
            <div className="flex justify-center">
              <div className={`relative ${make === 'drawing' || make === 'spell' ? 'animate-pulse' : ''}`}>
                {make === 'spell' && <span className="absolute inset-[-18%] animate-[spin_4s_linear_infinite] rounded-full border-2 border-dashed border-violet-300" />}
                <Sticker s={draft} size={170} />
              </div>
            </div>
          )}
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void photo(f);
            }}
          />
          {make === 'choose' && (
            <div className="mt-4 space-y-2">
              <Big tone="sky" onClick={() => file.current?.click()}>
                📷 写真を添える
              </Big>
              <Big
                tone="violet"
                onClick={() => {
                  setSaid('');
                  setMake('style');
                }}
              >
                🎨 {bati}に描いてもらう
              </Big>
              <Soft
                onClick={() => {
                  setArt('skip');
                  setMake('ready');
                }}
              >
                🔤 字だけ
              </Soft>
              <p className="text-center text-[11px] leading-relaxed text-slate-400">人が写っている写真は、その人がいいと言ったものだけ使おう。人の顔を、勝手に描くことはしません</p>
            </div>
          )}
          {make === 'style' && (
            <div className="mt-4 space-y-2">
              <VoiceField light value={said} onChange={setSaid} placeholder="水彩で、やわらかい色。ちょっと、夢の中みたいな感じ" maxLength={60} />
              <Big
                tone="violet"
                disabled={!said.trim()}
                onClick={() => {
                  setCards(spellCards(draft.text, styleCards(said)));
                  setMake('ask-mana');
                }}
              >
                これで描いてもらう
              </Big>
              <Soft
                onClick={() => {
                  setCards(spellCards(draft.text, OMAKASE_STYLE));
                  setMake('ask-mana');
                }}
              >
                おまかせ
              </Soft>
            </div>
          )}
          {make === 'ask-mana' && (
            <div className="mt-4 space-y-2">
              <Big tone="violet" onClick={() => void draw()}>
                使う
              </Big>
              <Soft onClick={() => setMake('choose')}>やめる</Soft>
            </div>
          )}
          {make === 'drawing' && <p className="mt-4 text-center text-sm font-bold text-violet-500">✨ 魔法陣を描いています…</p>}
          {make === 'burnt' && (
            <div className="mt-4 space-y-2">
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
            <div className="mt-4 space-y-2">
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
              <p className="text-center text-[11px] text-slate-400">札を、話して変えられます（変えなくてもいい）</p>
            </div>
          )}
          {make === 'ready' && art === 'mana' && !picking && (
            <div className="mt-4 space-y-2">
              {redrawn && firstArt && (
                <div className="flex justify-center gap-3">
                  {[firstArt, draft.url].map((u) => (
                    <button key={u} onClick={() => setDraft({ ...draft, url: u })} className={`rounded-md ring-4 ${draft.url === u ? 'ring-amber-400' : 'ring-transparent'}`}>
                      <Sticker s={{ ...draft, url: u }} size={96} />
                    </button>
                  ))}
                </div>
              )}
              <Big
                tone="amber"
                onClick={() => {
                  setPicking(true);
                  toBook();
                }}
              >
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
            <div className="mt-4 space-y-2">
              <Big tone="amber" onClick={toBook}>
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
          {/* the spellbook: 〔📖 記す〕 under the cards, or go on without */}
          {make === 'book' && step === 0 && (
            <div className="mt-4 flex justify-center">
              <span className="animate-[fadeUp_0.6s_ease-out] text-5xl drop-shadow">📖</span>
            </div>
          )}
          {make === 'book' && step === BOOK_LINES.length - 1 && (
            <div className="mt-4 space-y-2">
              <Cards cards={cards} />
              <Big
                tone="violet"
                onClick={() => {
                  saveSpell(cards);
                  setKept(true);
                  setMake('keep');
                }}
              >
                📖 記す
              </Big>
              <Soft
                onClick={() => {
                  setKept(false);
                  setMake('keep');
                }}
              >
                記さずに進む
              </Soft>
            </div>
          )}
          {make === 'keep' && (
            <div className="mt-4 space-y-2">
              {kept && <p className="text-center text-[12px] text-violet-600">スペルブックに、このスペルを記しました</p>}
              <Big
                tone="amber"
                onClick={() => {
                  setMine(draft);
                  setMake('kept');
                }}
              >
                🔒 根っこにしまう
              </Big>
            </div>
          )}
        </Panel>
      )}

      {/* D05-S008: the art on the stone, then the {neo} butterfly carries it round the stone */}
      {fly >= 0 && !at && mine && (
        <div className="absolute inset-0 z-[160]">
          {!born ? (
            <div className="absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2">
              <Sticker s={mine} size={120} />
            </div>
          ) : (
            <button onClick={() => setBook(true)} className="absolute left-[18%] top-[34%] animate-[fadeUp_0.8s_ease-out]" style={{ animation: 'butterflyDrift 7s ease-in-out infinite' }}>
              <NeoButterfly face={neoFace} art={mine} size={120} />
            </button>
          )}
          {kimFly && (
            <button onClick={() => setBook(true)} className="absolute right-[12%] top-[26%]" style={{ animation: 'butterflyDrift 6s ease-in-out 0.6s infinite' }}>
              <NeoButterfly face={spriteUrl('kimorin-face')} art={KIMORIN_JACKET} size={104} shades hue={200} />
            </button>
          )}
          <style>{'@keyframes butterflyDrift{0%,100%{transform:translate(0,0)}25%{transform:translate(14px,-18px)}50%{transform:translate(28px,4px)}75%{transform:translate(10px,14px)}}'}</style>
        </div>
      )}

      {/* D05-S008b: the plot with your name tag, the atelier, the dachi's sky */}
      {at && ab?.k === 'bar' && <Bar glow lit={2} onTap={anext} />}
      {at && ai >= 2 && ab?.k !== 'oshi' && (
        <div className="absolute inset-x-0 top-[20svh] z-[160] flex flex-col items-center">
          {ab?.k === 'build' || ai > ATELIER.findIndex((b) => b.k === 'build') ? (
            <MyAtelier look={look} built={ab?.k === 'build' ? built : 1} arts={(ab?.k === 'hang' || ai > ATELIER.findIndex((b) => b.k === 'hang')) && !(post !== 'to' && sent) && mine ? [mine] : []} width={280} onArt={() => setBook(true)} />
          ) : (
            <div className="flex h-[268px] w-[280px] items-end justify-center">
              <div className="mb-6 h-6 w-56 rounded-[50%] bg-[#5b3a22]/70" />
            </div>
          )}
          <span className="-mt-2 rounded bg-[#f6ead2] px-2 py-0.5 text-[12px] font-bold text-stone-700 shadow">{neo}</span>
          {ab?.k === 'hang' && mine && (
            <div className="pointer-events-none absolute left-[56%] top-[10%] animate-[hangIn_2s_ease-in-out_forwards]">
              <NeoButterfly face={neoFace} art={mine} size={80} />
            </div>
          )}
          <style>{'@keyframes hangIn{0%{transform:translate(60px,-80px)}70%{transform:translate(-40px,60px)}100%{transform:translate(-40px,60px);opacity:0}}'}</style>
        </div>
      )}
      {ab?.k === 'chat' && (
        <Panel>
          {chat === 'hold' ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-slate-500">次は、ここから。閉じても、だいじょうぶです</p>
              <Big tone="amber" onClick={() => setChat('cards')}>
                続ける
              </Big>
            </div>
          ) : chat === 'ask' || chat === 'redo' ? (
            <div className="space-y-3">
              <p className="text-center text-sm font-black text-amber-700">🎨 myアトリエ</p>
              <VoiceField light value={said} onChange={setSaid} placeholder={chat === 'ask' ? '森の中の、木とガラスの、あったかいアトリエ' : 'もっと、明るく'} maxLength={40} />
              <Big
                tone="amber"
                disabled={!said.trim()}
                onClick={() => {
                  setLook((l) => atelierFromWords(said, chat === 'ask' ? ATELIER_DEFAULT : l));
                  setSaid('');
                  setChat('cards');
                }}
              >
                これで組む
              </Big>
              {chat === 'ask' && (
                <Soft
                  onClick={() => {
                    setLook(atelierOmakase());
                    setChat('cards');
                  }}
                >
                  おまかせ
                </Soft>
              )}
              {chat === 'ask' && <p className="text-center text-[11px] text-slate-400">おまかせなら、{neo}とアートに合うアトリエを、{bati}が組みます</p>}
            </div>
          ) : (
            <div className="space-y-3">
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
              <VoiceField light value={look.sign} onChange={(t) => setLook((x) => ({ ...x, sign: [...t].slice(0, 8).join('') }))} placeholder="入口の看板（8文字まで。なくてもいい）" maxLength={8} />
              <Big tone="amber" onClick={anext}>
                このアトリエにする
              </Big>
              <Soft
                onClick={() => {
                  setSaid('');
                  setChat('redo');
                }}
              >
                🎙 話して直す
              </Soft>
              <Soft onClick={() => setChat('hold')}>今はここで止める</Soft>
              <p className="text-center text-[11px] text-slate-400">話すと、札が変わります。マナは使いません。あとで変えられます</p>
            </div>
          )}
        </Panel>
      )}
      {ab?.k === 'send' && (
        <Panel>
          <div className="space-y-2">
            <Big
              tone="sky"
              onClick={() => {
                setSent(true);
                setPost('to');
                ainsert([...SENT, ...OSHI]);
                anext();
              }}
            >
              🦋 投稿する
            </Big>
            <Soft
              onClick={() => {
                ainsert([...KEPT, ...OSHI]);
                anext();
              }}
            >
              今は飛ばさず、壁に飾っておく
            </Soft>
          </div>
        </Panel>
      )}
      {ab?.k === 'post' && (
        <Panel>
          {post === 'to' && (
            <div className="space-y-3">
              <p className="text-center text-[13px] text-slate-500">行き先</p>
              <div className="rounded-2xl bg-sky-50 p-3 text-center text-[14px] font-bold text-sky-700 ring-2 ring-sky-300">
                ✓ ダチへ（{inviter}・KIMORIN⭐︎）
              </div>
              <p className="text-center text-[11px] text-slate-400">88時間、空を飛んで、あなたのアトリエに帰ります</p>
              <Big
                tone="sky"
                onClick={() => {
                  if (mine) void api.deliver?.({ kind: 'jacket', title: mine.text.slice(0, 60), url: mine.url && /^https?:/.test(mine.url) ? mine.url : undefined }).catch(() => undefined);
                  setPost('fly');
                  setTimeout(() => {
                    setPost('gone');
                    anext();
                  }, 2000);
                }}
              >
                🦋 飛ばす
              </Big>
            </div>
          )}
          {post === 'fly' && mine && (
            <div className="flex justify-center py-4">
              <div className="animate-[flyAway_2s_ease-in_forwards]">
                <NeoButterfly face={neoFace} art={mine} size={100} />
              </div>
              <style>{'@keyframes flyAway{to{transform:translate(120px,-240px) scale(.4);opacity:0}}'}</style>
            </div>
          )}
        </Panel>
      )}
      {ab?.k === 'oshi' && (
        <div className="absolute inset-x-0 top-[calc(17svh+env(safe-area-inset-top))] z-[185] flex flex-col items-center">
          <span className="rounded-full bg-black/40 px-4 py-1 text-[13px] font-bold text-amber-100">推し</span>
          <button onClick={() => oshi === 'here' && setOshi('open')} className={`mt-2 flex flex-col items-center transition-all duration-[1600ms] ${oshi === 'coming' ? 'translate-x-[60vw] opacity-0' : 'translate-x-0 opacity-100'}`}>
            {oshi === 'open' ? <Sticker s={KIMORIN_JACKET} size={200} /> : <NeoButterfly face={spriteUrl('kimorin-face')} art={KIMORIN_JACKET} size={96} shades hue={200} />}
            <span className="mt-1 rounded-full bg-white/80 px-2 text-[10px] font-bold text-stone-600">@KIMORIN⭐︎</span>
          </button>
          {oshi === 'open' && (
            <div className="mt-3">
              <NextButton onClick={anext} />
            </div>
          )}
        </div>
      )}

      {book && (
        <div className="absolute inset-0 z-[260] flex items-center justify-center bg-black/60 px-6" onClick={() => setBook(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-[#f6ead2] p-5 text-stone-700 shadow-2xl">
            <p className="text-center text-sm font-black">アート帳</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {[...(mine ? [mine] : []), ...(kimFly || at ? [KIMORIN_JACKET] : [])].map((s, k) => (
                <Sticker key={k} s={s} size={120} />
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] font-bold text-stone-400">タップで閉じる</p>
          </div>
        </div>
      )}
    </LessonShell>
  );
}
