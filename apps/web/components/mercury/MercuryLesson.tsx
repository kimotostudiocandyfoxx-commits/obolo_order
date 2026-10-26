'use client';

import type { SongDesign } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { KIMORIN_JACKET, Sticker } from '@/components/jupiter/JupiterLesson';
import { Big, LessonShell, Later, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { STYLE_SOUND, type LessonApi } from '@/lib/onboarding/lessonApi';
import type { SongMade, StickerMade } from '@/lib/onboarding/made';
import { LineVoice } from '@/lib/story/lineVoice';

/**
 * Day 5 on Mercury (first journey; story D06-S005〜S007, M-R89/M-R91/M-R114): yesterday's jacket gets its
 * song. フリージー teaches, KIMORIN⭐︎ goes first — his 『プリプリ・ボカン』 as a tearful epic ballad with
 * a choir shouting 「ボカーン！」 — then the visitor: the jacket's song (or new words), add a feeling or
 * pass → the feel → {bati}'s lyric draft (tap a line to touch it up) → mana asked → {bati} sings it → the
 * record spins → 〔🔒 土の中にしまう〕 → the song becomes a ship and sails out (a story picture: nothing is
 * sent; 〔🚢 出航させる〕 is second journey). Not making one is a real choice (a sound of the island
 * sails instead). The lines are the story's, word for word, so their voices play.
 */
type Phase = 'intro' | 'choose' | 'hold' | 'words' | 'style' | 'writing' | 'lyrics' | 'mana' | 'singing' | 'failed' | 'song' | 'saved' | 'none' | 'ship';
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
  { who: 'freezy', text: 'できた曲は、船になって海に出る。' },
  { who: 'kimorin', text: 'では、私が先に一曲。' },
  {
    who: 'kimorin',
    text: '……これは、また今度にしましょう。まだ途中ですので。',
    choices: [
      { label: '黙って待つ', reply: [{ who: 'kimorin', text: '……聞かなかったことに、してください。' }] },
      { label: '「いま、何て歌ったの？」と聞く', reply: [{ who: 'kimorin', text: '一番の、歌い出しです。続きが、まだ決まらないのです。完成したら、お聴かせしますよ。' }] },
    ],
  },
  { who: 'freezy', text: '習うより、慣れろ、だ。さあ、作ってみよう。', scene: 'bar' },
  { who: 'freezy', text: '真ん中の〔♫+ 作曲〕だ。', scene: 'bar-glow' },
  { who: 'kimorin', text: 'お待ちを。途中の歌の代わりに、きのうのジャケットで。……天才の手本です。', scene: 'demo' },
  { who: 'song', text: 'ぷりぷりぷりり……　うひょひょひょ、げへへ……　ぷりぷり、滑り台で——', scene: 'demo-play' },
  { who: 'choir', text: 'ボカーン！　ボカーン！', scene: 'demo-play' },
  { who: 'freezy', text: '……いい曲だ。', scene: 'demo' },
  { who: 'kimorin', text: '……自分の曲で、泣くとは。', scene: 'demo' },
  { who: 'freezy', text: '次は、お前だ。' },
];
const SPEAKER: Record<Who, string> = { freezy: 'フリージー', kimorin: 'KIMORIN', bati: 'バティ', guide: '', song: '', choir: '' };
const NAMES: Record<Who, string> = { freezy: 'フリージー', kimorin: 'KIMORIN⭐︎', bati: 'バティ', guide: '', song: 'KIMORIN⭐︎の曲', choir: '合唱' };
const SPRITES: Partial<Record<Who, string>> = { freezy: 'freezy-x-talk', kimorin: 'kimorin-sun' };
const NONE_SOUNDS = [
  { id: 'ice', label: '冷蔵庫の中の、氷の音', mark: '🧊' },
  { id: 'hum', label: '冷蔵庫のうなり', mark: '〰️' },
  { id: 'bati', label: '{bati}の声', mark: '🥚' },
];

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

function Bar({ glow }: { glow?: boolean }) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[175] flex justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-4 pb-5 pt-8">
      {['🗺️ 海図', '♫+ 作曲', '🏝️ myアイランド'].map((l, k) => (
        <div key={l} className={`rounded-2xl px-4 py-2.5 text-sm font-black ${k === 1 ? `bg-sky-300 text-sky-900 ${glow ? 'animate-pulse ring-4 ring-sky-200' : ''}` : 'bg-white/20 text-white/80'}`}>
          {l}
        </div>
      ))}
    </div>
  );
}

export function MercuryLesson({ api, stickers, neo, bati, batiImage, onDone }: { api: LessonApi; stickers: StickerMade[]; neo: string; bati: string; batiImage?: string; onDone: (song: SongMade | null) => void }) {
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
  const [noneSound, setNoneSound] = useState<string | null>(null);
  const [shipK, setShipK] = useState(0);
  const [cue, setCue] = useState<Line | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const ballad = useRef<HTMLAudioElement>(null);
  const voice = useRef<LineVoice | null>(null);
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{bati}', bati);
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

  const shipLines: Line[] = [
    { who: 'guide', text: '港の船は、お話の中の船です。曲は送られません' },
    { who: 'guide', text: '{neo}の最初の一隻が、海に出た' },
    { who: 'kimorin', text: '出た……！　船、出たケン！' },
    { who: 'kimorin', text: '……失礼。見事な船出ですね。' },
    noneSound
      ? { who: 'freezy', text: '{neo}の選んだ音も、海に出た。……また聴かせてくれ。' }
      : heard
        ? { who: 'freezy', text: '{neo}の言葉は、ちゃんと歌になった。また聴かせてくれ。' }
        : { who: 'freezy', text: '聴くのは、あとでいい。また聴かせてくれ。' },
  ];
  useEffect(() => {
    if (phase === 'ship') speak(shipLines[shipK]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shipK]);

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
  else if (phase === 'saved') {
    coach = lineOf({ who: 'guide', text: '曲を、{neo}だけの〔⛏ 土の中の曲〕にしまいました。誰にも送られていません。しまった曲は、右の〔🏝️ myアイランド〕の空き地の土の中から、いつでも聴けます。〔🚢 出航させる〕（届ける）は、二周目からひらきます' });
    actions = <NextButton onClick={() => setPhase('ship')} />;
  } else if (phase === 'none' && noneSound) actions = <NextButton onClick={() => setPhase('ship')} />;
  else if (phase === 'ship') {
    coach = lineOf(shipLines[shipK]);
    actions = (
      <NextButton
        onClick={() => {
          if (shipK < shipLines.length - 1) setShipK(shipK + 1);
          else onDone(song && !noneSound ? { id: song.id, title: song.title, url: song.url, jacket: record.url, words: record.text } : null);
        }}
      />
    );
  }

  return (
    <LessonShell bg="/onboarding/s/mercury-ice.jpg" coach={coach} actions={actions}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={ballad} src="/onboarding/bgm-kimorin-ballad.m4a" preload="auto" />
      {batiImage && phase !== 'ship' && (
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
                setPhase('none');
                said({ who: 'freezy', text: 'なら、選べ。ここでいちばん耳に残った音はどれだ。それを海に流す。' });
              }}
            >
              今日は作らない
            </Soft>
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
                setPhase('saved');
              }}
            >
              🔒 土の中にしまう
            </Big>
            <Soft onClick={() => setPhase('lyrics')}>歌詞を直して、作り直す</Soft>
            <Later label="🚢 出航させる" />
          </div>
        </Panel>
      )}

      {phase === 'none' && !noneSound && (
        <Panel>
          <div className="space-y-2">
            {NONE_SOUNDS.map((s) => (
              <Soft
                key={s.id}
                onClick={() => {
                  setNoneSound(s.id);
                  if (s.id === 'hum') said({ who: 'kimorin', text: '冷蔵庫の、うなり。……渋い選択です。' });
                  else setCue({ who: 'guide', text: `${fill(s.label)}を、海に流します` });
                }}
              >
                {s.mark} {fill(s.label)}
              </Soft>
            ))}
          </div>
        </Panel>
      )}

      {phase === 'ship' && (
        <div className="pointer-events-none absolute bottom-[18svh] left-[30%] z-[160] animate-[shipOut_9s_ease-in_forwards]">
          <div className="relative flex flex-col items-center">
            {noneSound ? (
              <span className="text-5xl drop-shadow-xl">{NONE_SOUNDS.find((s) => s.id === noneSound)?.mark}</span>
            ) : (
              <Sticker s={record} size={100} />
            )}
            <span className="-mt-2 text-7xl drop-shadow-xl">⛵</span>
          </div>
        </div>
      )}
    </LessonShell>
  );
}
