'use client';

import type { SongDesign } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { KIMORIN_JACKET, Sticker } from '@/components/jupiter/JupiterLesson';
import { Big, LessonShell, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { STYLE_SOUND, type LessonApi } from '@/lib/onboarding/lessonApi';
import type { SongMade, StickerMade } from '@/lib/onboarding/made';
import { LineVoice } from '@/lib/story/lineVoice';
import { ISLAND_BEACHES, ISLAND_LIGHTS, ISLAND_SHAPES, MyIsland, islandOmakase, type IslandLook } from './MyIsland';

/**
 * Day 5 on Mercury (first journey; story D06-S005〜S007, M-R89/M-R91/M-R114): yesterday's jacket gets its
 * song. フリージー teaches, KIMORIN⭐︎ goes first — his 『プリプリ・ボカン』 as a tearful epic ballad with
 * a choir shouting 「ボカーン！」 — then the visitor: the jacket's song (or new words), add a feeling or
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

type Who = 'freezy' | 'kimorin' | 'bati' | 'guide' | 'song' | 'choir';
type Line = { who: Who; text: string };
type Scene = 'bar' | 'bar-glow' | 'demo' | 'demo-play';
const INTRO: (Line & { scene?: Scene; choices?: { label: string; reply: Line[] }[] })[] = [
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
  { who: 'freezy', text: '土星の言葉も、木星のジャケットも、音がつけば、もっと伝わる。' },
  { who: 'freezy', text: 'できた曲は、船になって、ダチの海に出る。' },
  { who: 'freezy', text: '習うより、慣れろ、だ。さあ、作ってみよう。', scene: 'bar' },
  { who: 'freezy', text: '真ん中の〔♫+ 作曲〕だ。', scene: 'bar-glow' },
  { who: 'kimorin', text: 'お待ちを。きのうのジャケットで。……天才の手本です。', scene: 'demo' },
  { who: 'song', text: 'ぷりぷりぷりり……　うひょひょひょ、げへへ……　ぷりぷり、滑り台で——', scene: 'demo-play' },
  { who: 'choir', text: 'ボカーン！　ボカーン！', scene: 'demo-play' },
  { who: 'freezy', text: '……いい曲だ。', scene: 'demo' },
  { who: 'kimorin', text: '……自分の曲で、泣くとは。', scene: 'demo' },
  { who: 'freezy', text: '次は、お前だ。' },
];
const SPEAKER: Record<Who, string> = { freezy: 'フリージー', kimorin: 'KIMORIN', bati: 'バティ', guide: '', song: '', choir: '' };
const NAMES: Record<Who, string> = { freezy: 'フリージー', kimorin: 'KIMORIN⭐︎', bati: 'バティ', guide: '', song: 'KIMORIN⭐︎の曲', choir: '合唱' };
const SPRITES: Partial<Record<Who, string>> = { freezy: 'freezy-x-talk', kimorin: 'kimorin-sun' };
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

/** 🏝️ myアイランド: shape, beach, light (unpicked = おまかせ), a name if you like → 〔この島にする〕 */
function IslandEditor({ neo, onMake, onHold }: { neo: string; onMake: (l: IslandLook) => void; onHold: () => void }) {
  const [pick, setPick] = useState<Partial<IslandLook>>({});
  const [name, setName] = useState('');
  const auto = islandOmakase(neo);
  const look: IslandLook = { shape: pick.shape ?? auto.shape, beach: pick.beach ?? auto.beach, light: pick.light ?? auto.light, name };
  const rows = [
    { key: 'shape' as const, name: '形', opts: ISLAND_SHAPES },
    { key: 'beach' as const, name: '浜', opts: ISLAND_BEACHES },
    { key: 'light' as const, name: '灯り', opts: ISLAND_LIGHTS },
  ];
  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-black text-sky-700">🏝️ myアイランド</p>
      <div className="flex justify-center rounded-2xl bg-gradient-to-b from-sky-200 to-sky-400 py-2">
        <MyIsland look={look} width={200} />
      </div>
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[12px] font-bold text-slate-400">{row.name}</span>
          <div className="flex flex-wrap gap-1.5">
            {row.opts.map((o) => (
              <button key={o.v} onClick={() => setPick((x) => ({ ...x, [row.key]: o.v }))} className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${pick[row.key] === o.v ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} placeholder="島の名前（なくてもいい）" className="w-full rounded-xl bg-slate-50 px-3 py-2 text-[16px] outline-none ring-1 ring-slate-200" />
      <p className="text-center text-[11px] leading-relaxed text-slate-400">選ばなければ、おまかせ。土の中の曲も、帰ってきた船も、ここに集まります（船の帰る小さな桟橋は、どの島にもつきます）。あとで変えられます</p>
      <Big tone="sky" onClick={() => onMake(look)}>
        この島にする
      </Big>
      <Soft onClick={onHold}>今はここで止める</Soft>
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
  onDone,
}: {
  api: LessonApi;
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
  const [song, setSong] = useState<{ id: string; title: string; url: string } | null>(null);
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
  const ballad = useRef<HTMLAudioElement>(null);
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
    const play = phase === 'intro' && INTRO[k]?.scene === 'demo-play';
    if (play && ballad.current?.paused) void ballad.current.play().catch(() => undefined);
    if (!play && phase === 'intro' && INTRO[k]?.scene !== 'demo') ballad.current?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introLine?.text, phase]);

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
    const d: SongDesign = sound ? { ...design, genre: feel, instrumentalPrompt: sound.prompt, bpm: sound.bpm } : design;
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
      gd('〔🗺️ 海図〕を開くと、上の〔推し〕に、ダチの船が入ってきます。タップすると聴けます（押した時だけ鳴ります）'),
      { k: 'sail' },
    ]);
    setAk(0);
    setPhase('after');
  };
  const closing = (): After[] => [
    heard ? fr('{neo}の言葉は、ちゃんと歌になった。また聴かせてくれ。') : fr('聴くのは、あとでいい。また聴かせてくれ。'),
    ki('では、私も。'),
    { k: 'ship', who: 'kimorin' },
    { k: 'oshi' },
    { k: 'line', l: { who: 'choir', text: 'ボカーン！　ボカーン！' } },
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
      ballad.current?.pause();
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
              ballad.current?.pause();
              setPhase('choose');
              setCue(null);
            }
          }}
        />
      );
  } else if (phase === 'choose') coach = lineOf({ who: 'freezy', text: '次は、お前だ。' });
  else if (phase === 'hold') actions = <NextButton label="続ける" onClick={() => setPhase('choose')} />;
  else if (phase === 'style' && !feelSaid) coach = { text: 'どんな感じの曲にする？' };
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
      <audio ref={ballad} src="/onboarding/bgm-kimorin-ballad.m4a" preload="auto" />
      {batiImage && phase !== 'after' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={batiImage} alt="" className="pointer-events-none absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-3 z-[170] h-16 w-16 rounded-2xl border-2 border-white/70 object-cover shadow-lg" aria-hidden />
      )}
      {song && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audio} src={song.url} onPlay={() => (setPlaying(true), setHeard(true))} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      )}

      {(scene === 'bar' || scene === 'bar-glow') && <Bar glow={scene === 'bar-glow'} />}
      {(scene === 'demo' || scene === 'demo-play') && (
        <div className="absolute inset-x-0 top-[36svh] z-[160] flex justify-center">
          <Record s={KIMORIN_JACKET} playing={scene === 'demo-play'} size={220} />
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
                  said({ who: 'freezy', text: '顔は、もうある。あとは中身だ。このジャケットの曲を作るぞ。' });
                }}
              >
                きのうのジャケットの曲を作る
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
              <p className="text-center text-sm font-black text-sky-700">ジャケットを選ぶ</p>
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
                    ? 'そのとき何があったか、どんな気持ちだったか、足したければ言え。言葉が、そのまま歌詞になる。足さなくてもいい。'
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
                    setCue(null);
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
          <div className="grid grid-cols-3 gap-2">
            {FEELS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFeel(f.id);
                  setFeelSaid(true);
                  said({ who: 'freezy', text: f.id === 'auto' ? '任せろ。' : 'いいな。それでいこう。' });
                }}
                className={`rounded-2xl py-3 text-sm font-black ${feel === f.id && feelSaid ? 'bg-sky-500 text-white' : 'bg-sky-50 text-sky-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <Big tone="sky" disabled={!feelSaid} onClick={() => void write()}>
              歌詞の下書きを見る
            </Big>
          </div>
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
            <Soft onClick={() => setPhase('lyrics')}>歌詞を直して、作り直す</Soft>
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
                setPost('post');
                ainsert([{ k: 'post' }, { k: 'ship', who: 'mine' }, gd('{neo}の最初の一隻が、ダチの海へ出た'), ki('出た……！　船、出たケン！'), ki('……失礼。見事な船出ですね。'), ...closing()]);
                anext();
              }}
            >
              ダチの海に出航させる
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
                ダチへ（{inviter}・KIMORIN⭐︎）
              </div>
              <Big tone="sky" onClick={anext}>
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
          </div>
        </div>
      )}
      {ab?.k === 'oshi' && (
        <div className="absolute inset-x-0 top-[calc(17svh+env(safe-area-inset-top))] z-[185] flex flex-col items-center">
          <span className="rounded-full bg-black/40 px-4 py-1 text-[13px] font-bold text-sky-100">推し</span>
          <button
            onClick={() => {
              if (oshi !== 'here') return;
              setOshi('open');
              if (ballad.current) {
                ballad.current.currentTime = 0;
                void ballad.current.play().catch(() => undefined);
              }
              setTimeout(anext, 900);
            }}
            className={`mt-2 flex flex-col items-center transition-all duration-[1600ms] ${oshi === 'coming' ? 'translate-x-[60vw] opacity-0' : 'translate-x-0 opacity-100'}`}
          >
            <span className="relative flex flex-col items-center">
              <span className="rounded-sm bg-white/90 px-1.5 text-[10px] font-bold text-stone-700">KIMORIN⭐︎</span>
              <span className="text-5xl drop-shadow-xl">⛵</span>
            </span>
          </button>
        </div>
      )}
      {ab?.k === 'bar' && <Bar glow lit={2} onTap={anext} />}
      {phase === 'after' && ak >= after.findIndex((x) => x.k === 'rise') && after.some((x) => x.k === 'rise') && ab?.k !== 'edit' && (
        <div className="pointer-events-none absolute inset-x-0 top-[30svh] z-[160] flex justify-center">
          <MyIsland look={look ?? islandOmakase(neo)} rise={ab?.k === 'rise' ? rise : 2} records={1} width={320} />
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
            <IslandEditor
              neo={neo}
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
