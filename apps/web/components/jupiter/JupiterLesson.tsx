'use client';

import { useEffect, useRef, useState } from 'react';
import { Big, LessonShell, Later, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { LineVoice } from '@/lib/story/lineVoice';
import type { StickerMade } from '@/lib/onboarding/made';
import { MyTree, TREE_COLORS, TREE_DECOS, TREE_DEFAULT, TREE_SHAPES, type TreeLook } from './MyTree';

/**
 * Day 4 on Jupiter (first journey; story D05-S005〜S008, M-R89 — words become square record jackets, the
 * song comes later on Mercury). 大根カイザー teaches, KIMORIN⭐︎ goes first with his oil-painting jacket
 * 『プリプリ・ボカン』 (M-R114), then the visitor makes one jacket from a root's words (yesterday's
 * kororins) or new words: a photo / {bati}'s drawing (mana, asked first) / words only. It is put on the
 * stone and flaps up like a butterfly. Draft 21 (M-R124/125): everyone makes one (no "not today"), then
 * plants 🌳 myツリー (D05-S008b), may fly the jacket to the dachi's sky ({inviter} and KIMORIN⭐︎), and
 * KIMORIN⭐︎'s jacket arrives in the 〔推し〕 sky. The lines are the story's, word for word, so their voices play.
 * (The type keeps its old name StickerMade: one record per jacket — its words and its picture.)
 */
export interface JupiterLessonApi {
  stickerArt(text: string): Promise<{ url: string }>;
  uploadPhoto(blob: Blob): Promise<{ url: string }>;
}

type Who = 'kaiser' | 'kimorin' | 'pinpon' | 'bati' | 'guide';
type Line = { who: Who; text: string };
type Scene = 'stone' | 'demo-bar' | 'demo-roots' | 'demo-picked' | 'demo-art' | 'demo-title' | 'roots' | 'fly' | 'kimorin-fly';

type Beat =
  | { k: 'say'; who: Who; text: string; scene?: Scene; choices?: { label: string; reply: Line[] }[] }
  | { k: 'pick' }
  | { k: 'make' }
  | { k: 'done' };

const KIMORIN_WORDS = 'ぷりぷりぷりり！　ぷりぷりぷりり！　うひょひょひょげへへ！……ぷりぷり滑り台でボカーン！';
export const KIMORIN_JACKET: StickerMade = { text: 'プリプリ・ボカン', url: '/onboarding/s/jacket-puripuri.jpg' };
const KAISER_JACKET: StickerMade = { text: '百聞は、一見にしかず', url: '/onboarding/s/jacket-kaiser.jpg' };

// D05-S005〜S006 (before the visitor's turn)
const OPEN: Beat[] = [
  { k: 'say', who: 'kaiser', text: '木星は、命が宿る星ダ。' },
  { k: 'say', who: 'kaiser', text: '君が見た風景だったり、今日食べたご飯だったり。そんな何気ない日常でも、命を宿し、そして思い出になっていくのダ。' },
  { k: 'say', who: 'kaiser', text: 'この石に、言葉の『ジャケット』を立ててみるダ。', scene: 'stone' },
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
  { k: 'say', who: 'kaiser', text: '木星では、言葉を『ジャケット』にするダ。' },
  { k: 'say', who: 'kaiser', text: 'レコードの、四角いジャケットダ。曲は、まだ無くていいダ。' },
  { k: 'say', who: 'kimorin', text: '中身より先に、顔を作るとは。' },
  { k: 'say', who: 'kimorin', text: 'では、私から。天才の手本を、お見せしましょう。' },
  { k: 'say', who: 'kaiser', text: 'まず〔🥚 たまご〕を押すダ。根っこが開くダ。', scene: 'demo-bar' },
  { k: 'say', who: 'kaiser', text: 'この中から一つ選んで、ジャケットにするダ。', scene: 'demo-roots' },
  { k: 'say', who: 'kimorin', text: 'では、これを。', scene: 'demo-picked' },
  { k: 'say', who: 'pinpon', text: 'ピンポン♪', scene: 'demo-picked' },
  { k: 'say', who: 'kimorin', text: '……ふふ。ありがとう、ピンポンくん。', scene: 'demo-picked' },
  { k: 'say', who: 'kaiser', text: 'その日の写真があれば、添えるダ。なくても、マナで、作れるダ。', scene: 'demo-picked' },
  { k: 'say', who: 'guide', text: 'マナを使う時は、使う前に毎回たずねます', scene: 'demo-picked' },
  { k: 'say', who: 'kimorin', text: '……天才の絵です。', scene: 'demo-art' },
  { k: 'say', who: 'kimorin', text: '題して、『プリプリ・ボカン』。', scene: 'demo-title' },
  { k: 'say', who: 'kaiser', text: '……いいジャケットダ。', scene: 'demo-title' },
  { k: 'say', who: 'kimorin', text: '反応の数は、どこで拝見できます？', scene: 'demo-title' },
  { k: 'say', who: 'kaiser', text: '木星には、点も数もないダ。まず、根っこにしまうダ。', scene: 'demo-title' },
  {
    k: 'say',
    who: 'guide',
    text: '〔🔒 根っこにしまう〕で、自分の根っこに残します。しまったジャケットは、〔🦋 投稿する〕で、ダチの空に飛ばせます',
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
  // D05-S007 the visitor's jacket
  { k: 'say', who: 'kaiser', text: '{neo}。土星の言葉のなかで、形にしたくなったものは、あるかダ？', scene: 'roots' },
  { k: 'say', who: 'kaiser', text: '焦って、撮らなくても、いいダ。思い出は、あとから、作れるダ。さあ、遊んでみるダ！', scene: 'roots' },
  { k: 'pick' },
  { k: 'make' },
];

// D05-S008 (after the visitor's jacket is kept, or the king's flies)
const FLY: Line[] = [
  { who: 'kaiser', text: '木星ではな、ジャケットは蝶のように飛ぶダ。言葉が、書いてあるダ。' },
  { who: 'kaiser', text: '人に届けたジャケットは、88時間、空を飛んで、自分の木に帰るダ。帰ってくると、枝に葉が一枚出るダ。' },
  { who: 'kaiser', text: '帰ってくる木は、これから{neo}が植えるダ。' },
  { who: 'guide', text: '飛んでいるジャケットをタップすると〔ジャケット帳〕がひらきます。ジャケットは石のまわりを飛ぶだけで、誰にも送られていません' },
  { who: 'kimorin', text: '……飛んだ。オレのが、飛んだケン……！　言葉の翼ケン！' },
  { who: 'kimorin', text: '……失礼。おしゃれですね。' },
  { who: 'kaiser', text: '中身は、水星で作るダ。{neo}。今日という日も、ひとつの命ダ。' },
];

// D05-S008b myツリーと、ダチの空へ (draft 21)
type TreeBeat =
  | { k: 'line'; l: Line }
  | { k: 'bar' } // the 🌳 myツリー button glows
  | { k: 'edit' } // shape / colour / ornament / tag → 〔この木にする〕
  | { k: 'grow' }
  | { k: 'send' } // 〔ダチの空に飛ばす〕〔今は飛ばさず、枝に置いておく〕
  | { k: 'post' } // 〔🦋 投稿する〕 → 〔ダチへ〕 → 〔🦋 飛ばす〕
  | { k: 'oshi' } // KIMORIN⭐︎'s jacket flies into the 〔推し〕 sky: tap it
  | { k: 'end' };
const kai = (text: string): TreeBeat => ({ k: 'line', l: { who: 'kaiser', text } });
const kim = (text: string): TreeBeat => ({ k: 'line', l: { who: 'kimorin', text } });
const note = (text: string): TreeBeat => ({ k: 'line', l: { who: 'guide', text } });
const TREE: TreeBeat[] = [
  note('下の〔🌳 myツリー〕が、光る'),
  { k: 'bar' },
  kai('ここが、{neo}の場所ダ。どんな木にするかは、自分で決めるダ。'),
  { k: 'edit' },
  { k: 'grow' },
  note('myツリーができた'),
  kai('君の木ダ。作ったジャケットは、この枝に並ぶダ。'),
  kai('そのジャケットは、ダチの空に飛ばせるダ。'),
  kai('{neo}のダチは、{inviter}と、KIMORINダ。届くのは、ダチだけダ。'),
  note('〔🦋 投稿する〕を押して、行き先〔ダチへ〕を確かめ、〔🦋 飛ばす〕。88時間、空を飛んで、あなたの木に帰ります'),
  { k: 'send' },
];
const SENT: TreeBeat[] = [
  { k: 'post' },
  kai('88時間、ダチの空を飛んで、この枝に帰ってくるダ。帰ってきたら、葉が一枚出るダ。'),
  kim('……{neo}のジャケット、私の空に、届きました。'),
];
const KEPT: TreeBeat[] = [kai('飛ばすのは、いつでもできるダ。')];
const OSHI: TreeBeat[] = [
  kim('では、私も。'),
  { k: 'oshi' },
  kai('上の〔推し〕は、ダチの作品が飛んでくる空ダ。KIMORINは、もう{neo}のダチダ。だから、来るダ。'),
  note('ダチのジャケットは、上の〔推し〕の空に飛んできます。タップすると見られます'),
  kim('なんやこれ……{neo}の空で、オレのが開いとる……！'),
  kim('……失礼。ダチの空とは、いいものですね。'),
  kai('木も空も、いつ来て遊んでもよいダ。'),
  { k: 'end' },
];

const SPEAKER: Record<Who, string> = { kaiser: '大根カイザー', kimorin: 'KIMORIN', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const NAMES: Record<Who, string> = { kaiser: '大根カイザー', kimorin: 'KIMORIN⭐︎', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { kaiser: 'kaiser1-x-talk', kimorin: 'kimorin-sun', pinpon: 'unchi-pinpon' };

/** A square record jacket: the picture (or a soft colour) with the words. */
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
      <div className={`absolute inset-x-[7%] ${s.url ? 'bottom-[7%]' : 'top-1/2 -translate-y-1/2'} text-center`}>
        <span className="inline-block max-w-full rounded-sm bg-white/85 px-2 py-0.5 font-bold leading-snug text-stone-700 [word-break:keep-all]" style={{ fontSize: Math.max(9, size * 0.08) }}>
          {s.text}
        </span>
      </div>
    </div>
  );
}
export const Jacket = Sticker;

/** The three buttons along the bottom of every planet (here: sky / egg / my tree). */
function Bar({ glow, lit = 1, onTap }: { glow?: boolean; lit?: number; onTap?: () => void }) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[175] flex justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-4 pb-5 pt-8">
      {['🦋 空', '🥚 たまご', '🌳 myツリー'].map((l, k) => (
        <button key={l} disabled={k !== lit || !onTap} onClick={onTap} className={`rounded-2xl px-4 py-2.5 text-sm font-black ${k === lit ? `bg-amber-300 text-amber-900 ${glow ? 'animate-pulse ring-4 ring-amber-200' : ''}` : 'bg-white/20 text-white/80'}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function JupiterLesson({
  api,
  kororins,
  neo,
  bati,
  inviter,
  batiImage,
  onDone,
}: {
  api: JupiterLessonApi;
  kororins: string[];
  neo: string;
  bati: string;
  inviter: string;
  batiImage?: string;
  onDone: (stickers: StickerMade[], tree: TreeLook, sent: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [reply, setReply] = useState<Line[] | null>(null);
  const [replyAt, setReplyAt] = useState(0);
  const [mode, setMode] = useState<'list' | 'new' | 'hold'>('list');
  const [words, setWords] = useState('');
  const [draft, setDraft] = useState<StickerMade | null>(null);
  const [make, setMake] = useState<'spell' | 'choose' | 'ask-mana' | 'drawing' | 'burnt' | 'ready' | 'kept'>('spell');
  const [art, setArt] = useState<'photo' | 'mana' | 'skip' | null>(null);
  const [mine, setMine] = useState<StickerMade | null>(null);
  const [fly, setFly] = useState(-1);
  const [tree, setTree] = useState<TreeBeat[] | null>(null);
  const [ti, setTi] = useState(0);
  const [look, setLook] = useState<TreeLook>(TREE_DEFAULT);
  const [hold, setHold] = useState(false);
  const [grow, setGrow] = useState<0 | 1 | 2>(0);
  const [sent, setSent] = useState(false);
  const [post, setPost] = useState<'post' | 'to' | 'fly' | 'gone'>('post');
  const [oshi, setOshi] = useState<'coming' | 'here' | 'open'>('coming');
  const [book, setBook] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const voice = useRef<LineVoice | null>(null);
  const beat = OPEN[i] as Beat | undefined;
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{bati}', bati).replaceAll('{inviter}', inviter);
  const tb = tree?.[ti];
  const tnext = () => setTi((x) => x + 1);
  const tinsert = (more: TreeBeat[]) => setTree((t) => (t ? [...t.slice(0, ti + 1), ...more, ...t.slice(ti + 1)] : t));
  // the seed grows on its own: seed → sprout → the tree; KIMORIN⭐︎'s jacket flies in, then waits for a tap
  useEffect(() => {
    if (tb?.k === 'grow') {
      setGrow(0);
      const a = setTimeout(() => setGrow(1), 900);
      const b = setTimeout(() => setGrow(2), 2000);
      const c = setTimeout(tnext, 3600);
      return () => [a, b, c].forEach(clearTimeout);
    }
    if (tb?.k === 'oshi') {
      setOshi('coming');
      const a = setTimeout(() => setOshi('here'), 1800);
      return () => clearTimeout(a);
    }
    if (tb?.k === 'end') onDone(mine ? [mine] : [], look, sent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tb]);

  useEffect(() => {
    const v = new LineVoice();
    v.unlock();
    voice.current = v;
    return () => v.dispose();
  }, []);
  const say = (l: Line) => {
    if (l.who !== 'guide') void voice.current?.say(SPEAKER[l.who], l.text);
  };

  // each line plays its voice
  const current: Line | null =
    tb?.k === 'line' ? tb.l : tree ? null : fly >= 0 ? (fly === 0 ? { who: 'kaiser', text: '……石に、置いてみるダ。' } : FLY[fly - 1] ?? null) : reply ? reply[replyAt] : beat?.k === 'say' ? beat : null;
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
    setMake('spell');
    next();
    void voice.current?.say('バティ', '〈{neo}の言葉〉——ここに、かたちを。');
    setTimeout(() => setMake('choose'), 2600);
  };
  const draw = async () => {
    if (!draft) return;
    setMake('drawing');
    try {
      const r = await api.stickerArt(draft.text);
      setDraft({ ...draft, url: r.url });
      setArt('mana');
      setMake('ready');
    } catch {
      setMake('burnt');
      void voice.current?.say('バティ', '魔法陣、ちょっと焦げちゃった……。言葉は残ってるよ。もう1回やる？　字だけにする？');
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
  const keep = () => {
    if (!draft) return;
    setMine(draft);
    setMake('kept');
  };

  // --- the line at the top ------------------------------------------------------------------------------
  const lineOf = (l: Line): CoachLine => ({ sprite: l.who === 'bati' ? batiImage : SPRITES[l.who], name: l.who === 'bati' ? bati : NAMES[l.who] || undefined, text: fill(l.text) });
  let coach: CoachLine | null = null;
  let actions: React.ReactNode = null;
  let scene: Scene | undefined = beat?.k === 'say' ? beat.scene : undefined;
  if (tree) {
    scene = undefined;
    coach = tb?.k === 'line' ? lineOf(tb.l) : tb?.k === 'bar' ? { text: '〔🌳 myツリー〕を押す' } : tb?.k === 'oshi' && oshi === 'here' ? { text: '上の〔推し〕の空に、ジャケットが一枚。タップしてみよう' } : null;
    if (tb?.k === 'line') actions = <NextButton onClick={tnext} />;
  } else if (fly >= 0) {
    scene = fly >= 5 ? 'kimorin-fly' : 'fly';
    coach = current ? lineOf(current) : null;
    actions = (
      <NextButton
        onClick={() => {
          if (fly < FLY.length) return setFly(fly + 1);
          setTree(TREE);
          setTi(0);
        }}
      />
    );
  } else if (beat?.k === 'say') {
    coach = lineOf(reply ? reply[replyAt] : beat);
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
    coach =
      mode === 'hold'
        ? { text: '次は、ここから。閉じても、だいじょうぶです' }
        : mode === 'new' && words === '大きな森'
          ? lineOf({ who: 'kaiser', text: 'なら、見えたままでいいダ。『大きな森』。あとで変えてもいいダ。' })
          : lineOf({ who: 'kaiser', text: '焦って、撮らなくても、いいダ。思い出は、あとから、作れるダ。さあ、遊んでみるダ！' });
    if (mode === 'hold') actions = <NextButton label="続ける" onClick={() => setMode('list')} />;
  } else if (beat?.k === 'make') {
    coach =
      make === 'spell'
        ? lineOf({ who: 'bati', text: '〈{neo}の言葉〉——ここに、かたちを。' })
        : make === 'ask-mana'
          ? lineOf({ who: 'bati', text: '写真がなくても、ボクが描くよ。マナを少し使うけど、いい？' })
          : make === 'burnt'
            ? lineOf({ who: 'bati', text: '魔法陣、ちょっと焦げちゃった……。言葉は残ってるよ。もう1回やる？　字だけにする？' })
            : make === 'ready' && art === 'skip'
              ? lineOf({ who: 'kaiser', text: '字だけのジャケットも、あるダ。' })
              : make === 'kept'
                ? { text: `ジャケットを、${neo}だけの根っこにしまいました。誰にも送られていません` }
                : make === 'ready' && art === 'mana'
                  ? { text: '−3マナ' }
                  : { text: 'ジャケットの絵を、えらぶ' };
    if (make === 'kept') actions = <NextButton onClick={() => setFly(0)} />;
  }

  const roots = kororins;
  const flying: StickerMade[] = scene === 'kimorin-fly' ? [mine ?? KAISER_JACKET, KIMORIN_JACKET] : [mine ?? KAISER_JACKET];

  return (
    <LessonShell bg={tree && ti > 1 ? '/onboarding/s/jupiter-forest.jpg' : '/onboarding/s/jupiter-stone.jpg'} coach={coach} actions={actions}>
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
          {scene === 'demo-picked' && <p className="mt-3 rounded-full bg-amber-400 py-2.5 text-center text-sm font-black text-white">ジャケットをつくる</p>}
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
          {roots.length ? (
            <div className="mt-3 space-y-2">
              <p className="text-center text-[11px] text-slate-400">土星でつぶやいた言葉。光の糸が、結ばれています</p>
              {roots.map((w) => (
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
              <VoiceField light value={words} onChange={setWords} placeholder="森のこと／大根カイザーのこと／いま思ったこと" maxLength={30} />
              <Big tone="amber" disabled={!words.trim()} onClick={() => startMake(words.trim())}>
                この言葉で、ジャケットをつくる
              </Big>
              <Soft
                onClick={() => {
                  setWords('大きな森');
                  void voice.current?.say('大根カイザー', 'なら、見えたままでいいダ。『大きな森』。あとで変えてもいいダ。');
                }}
              >
                パス
              </Soft>
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

      {beat?.k === 'make' && draft && (
        <Panel>
          <div className="flex justify-center">
            <div className={make === 'drawing' || make === 'spell' ? 'animate-pulse' : ''}>
              <Sticker s={draft} size={170} />
            </div>
          </div>
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
                  setMake('ask-mana');
                  void voice.current?.say('バティ', '写真がなくても、ボクが描くよ。マナを少し使うけど、いい？');
                }}
              >
                🎨 {bati}に描いてもらう
              </Big>
              <Soft
                onClick={() => {
                  setArt('skip');
                  setMake('ready');
                  void voice.current?.say('大根カイザー', '字だけのジャケットも、あるダ。');
                }}
              >
                🔤 字だけ
              </Soft>
              <p className="text-center text-[11px] leading-relaxed text-slate-400">人が写っている写真は、その人がいいと言ったものだけ使おう。人の顔を、勝手に描くことはしません</p>
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
              <Big tone="violet" onClick={() => void draw()}>
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
          {make === 'ready' && (
            <div className="mt-4 space-y-2">
              <Big tone="amber" onClick={keep}>
                🔒 根っこにしまう
              </Big>
              <Soft
                onClick={() => {
                  setDraft({ ...draft, url: null });
                  setArt(null);
                  setMake('choose');
                }}
              >
                絵を変える
              </Soft>
            </div>
          )}
        </Panel>
      )}

      {/* the jacket(s) on the stone, then flapping round the stone like butterflies */}
      {(scene === 'fly' || scene === 'kimorin-fly') && (
        <div className="absolute inset-0 z-[160]">
          {flying.map((s, k) => (
            <button
              key={k}
              onClick={() => setBook(true)}
              className="absolute"
              style={
                fly === 0 && k === 0
                  ? { left: '50%', top: '62%', transform: 'translate(-50%,-50%)' }
                  : { left: `${22 + k * 34}%`, top: `${36 + (k % 2) * 10}%`, animation: `jacketFlap ${6 + k * 1.5}s ease-in-out ${k * 0.5}s infinite` }
              }
            >
              <Sticker s={s} size={fly === 0 ? 120 : 92} />
            </button>
          ))}
        </div>
      )}
      {/* D05-S008b: the hill with your name tag, the tree, the dachi's sky */}
      {tree && tb?.k === 'bar' && <Bar glow lit={2} onTap={tnext} />}
      {tree && ti >= 2 && (
        <div className="absolute inset-x-0 top-[22svh] z-[160] flex flex-col items-center">
          {ti >= 4 || tb?.k === 'grow' ? (
            <MyTree look={look} grow={tb?.k === 'grow' ? grow : 2} jackets={tb?.k === 'grow' || (post === 'gone' && sent) ? [] : mine ? [mine] : []} width={240} onJacket={() => setBook(true)} />
          ) : (
            <div className="flex h-[276px] w-[240px] items-end justify-center">
              <div className="mb-2 h-6 w-52 rounded-[50%] bg-[#5b3a22]/70" />
            </div>
          )}
          <span className="-mt-3 rounded bg-[#f6ead2] px-2 py-0.5 text-[12px] font-bold text-stone-700 shadow">{neo}</span>
        </div>
      )}
      {tb?.k === 'edit' && (
        <Panel>
          {hold ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-slate-500">次は、ここから。閉じても、だいじょうぶです</p>
              <Big tone="amber" onClick={() => setHold(false)}>
                続ける
              </Big>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-sm font-black text-emerald-700">🌳 myツリー</p>
              <div className="flex justify-center">
                <MyTree look={look} width={120} />
              </div>
              {[
                { name: '形', opts: TREE_SHAPES.map((o) => ({ v: o.v, label: o.label })), key: 'shape' as const },
                { name: '色', opts: TREE_COLORS.map((o) => ({ v: o.v, label: o.label })), key: 'color' as const },
                { name: '飾り', opts: TREE_DECOS.map((o) => ({ v: o.v, label: `${o.icon} ${o.label}` })), key: 'deco' as const },
              ].map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-[12px] font-bold text-slate-400">{row.name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {row.opts.map((o) => (
                      <button key={o.v} onClick={() => setLook((x) => ({ ...x, [row.key]: o.v }))} className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${look[row.key] === o.v ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <input value={look.tag} onChange={(e) => setLook((x) => ({ ...x, tag: [...e.target.value].slice(0, 8).join('') }))} placeholder="枝の先の札（8文字まで。なくてもいい）" className="w-full rounded-xl bg-slate-50 px-3 py-2 text-[16px] outline-none ring-1 ring-slate-200" />
              <Big tone="amber" onClick={tnext}>
                この木にする
              </Big>
              <Soft
                onClick={() => {
                  setLook({ ...TREE_DEFAULT, tag: look.tag });
                  tnext();
                }}
              >
                最初の形のまま〔この木にする〕
              </Soft>
              <Soft onClick={() => setHold(true)}>今はここで止める</Soft>
              <p className="text-center text-[11px] text-slate-400">〔この木にする〕で、あなたの場所として保存されます（あとで変えられます）</p>
            </div>
          )}
        </Panel>
      )}
      {tb?.k === 'send' && (
        <Panel>
          <div className="space-y-2">
            <Big
              tone="sky"
              onClick={() => {
                setSent(true);
                setPost('post');
                tinsert([...SENT, ...OSHI]);
                tnext();
              }}
            >
              ダチの空に飛ばす
            </Big>
            <Soft
              onClick={() => {
                tinsert([...KEPT, ...OSHI]);
                tnext();
              }}
            >
              今は飛ばさず、枝に置いておく
            </Soft>
          </div>
        </Panel>
      )}
      {tb?.k === 'post' && (
        <Panel>
          {post === 'post' && (
            <Big tone="sky" onClick={() => setPost('to')}>
              🦋 投稿する
            </Big>
          )}
          {post === 'to' && (
            <div className="space-y-3">
              <p className="text-center text-[13px] text-slate-500">行き先</p>
              <div className="rounded-2xl bg-sky-50 p-3 text-center text-[14px] font-bold text-sky-700 ring-2 ring-sky-300">
                ダチへ（{inviter}・KIMORIN⭐︎）
              </div>
              <Big
                tone="sky"
                onClick={() => {
                  setPost('fly');
                  setTimeout(() => {
                    setPost('gone');
                    tnext();
                  }, 1800);
                }}
              >
                🦋 飛ばす
              </Big>
            </div>
          )}
          {post === 'fly' && mine && (
            <div className="flex justify-center py-4">
              <div className="animate-[jacketFlap_1.8s_ease-in_forwards]">
                <Sticker s={mine} size={110} />
              </div>
            </div>
          )}
        </Panel>
      )}
      {tb?.k === 'oshi' && (
        <div className="absolute inset-x-0 top-[calc(8px+env(safe-area-inset-top))] z-[185] flex flex-col items-center">
          <span className="rounded-full bg-black/40 px-4 py-1 text-[13px] font-bold text-amber-100">推し</span>
          <button
            onClick={() => oshi === 'here' && setOshi('open')}
            className={`mt-2 flex flex-col items-center transition-all duration-[1600ms] ${oshi === 'coming' ? 'translate-x-[60vw] opacity-0' : 'translate-x-0 opacity-100'}`}
            style={oshi === 'here' ? { animation: 'jacketFlap 5s ease-in-out infinite' } : undefined}
          >
            <Sticker s={{ ...KIMORIN_JACKET, text: oshi === 'open' ? KIMORIN_JACKET.text : '' }} size={oshi === 'open' ? 200 : 84} />
            <span className="mt-1 rounded-full bg-white/80 px-2 text-[10px] font-bold text-stone-600">@KIMORIN⭐︎</span>
          </button>
          {oshi === 'open' && (
            <div className="mt-3">
              <NextButton onClick={tnext} />
            </div>
          )}
        </div>
      )}

      {book && (
        <div className="absolute inset-0 z-[260] flex items-center justify-center bg-black/60 px-6" onClick={() => setBook(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-[#f6ead2] p-5 text-stone-700 shadow-2xl">
            <p className="text-center text-sm font-black">ジャケット帳</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {flying.map((s, k) => (
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
