'use client';

import { useEffect, useRef, useState } from 'react';
import { Big, LessonShell, Later, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { LineVoice } from '@/lib/story/lineVoice';
import type { StickerMade } from '@/lib/onboarding/made';

/**
 * Day 4 on Jupiter (first journey; story D05-S005〜S008, M-R89 — words become square record jackets, the
 * song comes later on Mercury). 大根カイザー teaches, KIMORIN⭐︎ goes first with his oil-painting jacket
 * 『プリプリ・ボカン』 (M-R114), then the visitor makes one jacket from a root's words (yesterday's
 * kororins) or new words: a photo / {bati}'s drawing (mana, asked first) / words only. It is put on the
 * stone and flaps up like a butterfly. Kept only for the visitor (〔🦋 投稿する〕 opens on the second
 * journey). The lines are the story's, word for word, so their voices play.
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
const KIMORIN_JACKET: StickerMade = { text: 'プリプリ・ボカン', url: '/onboarding/s/jacket-puripuri.jpg' };
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
  { k: 'say', who: 'kaiser', text: '木星には、点も数もないダ。それに今日は、しまうだけダ。', scene: 'demo-title' },
  {
    k: 'say',
    who: 'guide',
    text: '〔🦋 投稿する〕（届ける）は、二周目からひらきます。今日は〔🔒 根っこにしまう〕で、自分の根っこに残します',
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
  { who: 'kaiser', text: '届けるのも、{neo}の木を植えるのも、次の旅からダ。' },
  { who: 'guide', text: '飛んでいるジャケットをタップすると〔ジャケット帳〕がひらきます。ジャケットは石のまわりを飛ぶだけで、誰にも送られていません' },
  { who: 'kimorin', text: '……飛んだ。オレのが、飛んだケン……！　言葉の翼ケン！' },
  { who: 'kimorin', text: '……失礼。おしゃれですね。' },
  { who: 'kaiser', text: '中身は、水星で作るダ。{neo}。今日という日も、ひとつの命ダ。' },
];

const SPEAKER: Record<Who, string> = { kaiser: '大根カイザー', kimorin: 'KIMORIN', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const NAMES: Record<Who, string> = { kaiser: '大根カイザー', kimorin: 'KIMORIN⭐︎', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { kaiser: 'daikon-kaiser', kimorin: 'kimorin-sun', pinpon: 'unchi-pinpon' };

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
function Bar({ glow }: { glow?: boolean }) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[175] flex justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-4 pb-5 pt-8">
      {['🦋 空', '🥚 たまご', '🌳 myツリー'].map((l, k) => (
        <div key={l} className={`rounded-2xl px-4 py-2.5 text-sm font-black ${k === 1 ? `bg-amber-300 text-amber-900 ${glow ? 'animate-pulse ring-4 ring-amber-200' : ''}` : 'bg-white/20 text-white/80'}`}>
          {l}
        </div>
      ))}
    </div>
  );
}

export function JupiterLesson({ api, kororins, neo, bati, batiImage, onDone }: { api: JupiterLessonApi; kororins: string[]; neo: string; bati: string; batiImage?: string; onDone: (stickers: StickerMade[]) => void }) {
  const [i, setI] = useState(0);
  const [reply, setReply] = useState<Line[] | null>(null);
  const [replyAt, setReplyAt] = useState(0);
  const [mode, setMode] = useState<'list' | 'new' | 'hold'>('list');
  const [words, setWords] = useState('');
  const [draft, setDraft] = useState<StickerMade | null>(null);
  const [make, setMake] = useState<'spell' | 'choose' | 'ask-mana' | 'drawing' | 'burnt' | 'ready' | 'kept'>('spell');
  const [art, setArt] = useState<'photo' | 'mana' | 'skip' | null>(null);
  const [mine, setMine] = useState<StickerMade | null>(null);
  const [none, setNone] = useState(false);
  const [fly, setFly] = useState(-1);
  const [book, setBook] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const voice = useRef<LineVoice | null>(null);
  const beat = OPEN[i] as Beat | undefined;
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{bati}', bati);

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
    fly >= 0 ? (fly === 0 ? { who: 'kaiser', text: none ? 'なら、今日は我のジャケットを飛ばすダ。' : '……石に、置いてみるダ。' } : FLY[fly - 1] ?? null) : reply ? reply[replyAt] : beat?.k === 'say' ? beat : null;
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
  if (fly >= 0) {
    scene = fly >= 5 ? 'kimorin-fly' : 'fly';
    coach = current ? lineOf(current) : null;
    actions = <NextButton onClick={() => (fly < FLY.length ? setFly(fly + 1) : onDone(mine ? [mine] : []))} />;
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
    <LessonShell bg="/onboarding/s/jupiter-stone.jpg" coach={coach} actions={actions}>
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
              <VoiceField value={words} onChange={setWords} placeholder="森のこと／大根カイザーのこと／いま思ったこと" maxLength={30} />
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
              <Soft
                onClick={() => {
                  setNone(true);
                  setFly(0);
                  setI(OPEN.length);
                }}
              >
                今日は作らない
              </Soft>
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
              <Later label="🦋 投稿する" />
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
