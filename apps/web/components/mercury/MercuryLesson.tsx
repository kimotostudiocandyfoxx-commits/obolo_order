'use client';

import type { SongDesign } from '@obolo/shared';
import { useRef, useState } from 'react';
import { Sticker } from '@/components/jupiter/JupiterLesson';
import { Big, LessonShell, Later, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { STYLE_SOUND, type LessonApi } from '@/lib/onboarding/lessonApi';
import type { SongMade, StickerMade } from '@/lib/onboarding/made';

/**
 * Day 5 on Mercury (first journey; client 2026-10-14): one of yesterday's two stickers becomes a song.
 *  1. フリージー: put your day on a tune and it gets 100 times the power
 *  2. pick 1 of the 2 stickers
 *  3. {bati} writes the lyric draft from its words → the visitor touches it up (tap a line to change it)
 *  4. pick the feel (ポップ／ロック／ヒップホップ／バラード／EDM／おまかせ) → mana asked → {bati} sings it
 *  5. the sticker turns into the record's jacket, spinning while the song plays → 〔💾 この曲を保存する〕
 *  6. the song becomes a ship and sails out (a story picture: nothing is sent; 〔🚢 出航させる〕 is second journey)
 * The lines are this app's (the story left D06-S005〜S007 to the UI); フリージー is a breezy big brother.
 */
type Phase = 'intro' | 'pick' | 'writing' | 'lyrics' | 'style' | 'mana' | 'singing' | 'failed' | 'song' | 'saved' | 'ship';
const FEELS: { id: string; label: string }[] = [
  { id: 'pop', label: 'ポップ' },
  { id: 'rock', label: 'ロック' },
  { id: 'hiphop', label: 'ヒップホップ' },
  { id: 'ballad', label: 'バラード' },
  { id: 'edm', label: 'EDM' },
  { id: 'auto', label: 'おまかせ' },
];

type Who = 'freezy' | 'kimorin' | 'bati' | 'guide';
const INTRO: { who: Who; text: string; choices?: { label: string; reply: string }[] }[] = [
  {
    who: 'freezy',
    text: '自分の思いや、起きた出来事を、音に乗っけたことはあるか？',
    choices: [
      { label: 'ある', reply: 'ほう、なかなかやるな。' },
      { label: 'ない', reply: 'そうか。なら今日が、はじめての日だ。' },
      { label: '鼻歌くらいなら', reply: '鼻歌も、立派な歌だ。' },
    ],
  },
  { who: 'freezy', text: '実はな、音に乗っけると、100倍のパワーを持つ。' },
  { who: 'kimorin', text: '百倍。根拠は？' },
  { who: 'freezy', text: '体感だ。' },
  { who: 'freezy', text: 'きのう木星で作ったシールを、歌にしてみよう。シールの絵は、そのままレコードのジャケットになる。' },
  { who: 'kimorin', text: '{neo}、お先にどうぞ。私の歌は、まだ途中ですので。' },
];
const WHO: Record<Who, { sprite?: string; name?: string }> = {
  freezy: { sprite: 'freezy', name: 'フリージー' },
  kimorin: { sprite: 'kimorin-sun', name: 'KIMORIN⭐︎' },
  bati: { name: 'バティ' },
  guide: {},
};
const SHIP_LINES: { who: Who; text: string }[] = [
  { who: 'guide', text: '港の船は、お話の中の船です。曲は送られません' },
  { who: 'bati', text: 'ボクたちの歌が、海に出てった！' },
  { who: 'kimorin', text: '出た……！　船、出たケン！' },
  { who: 'kimorin', text: '……失礼。見事な船出ですね。' },
  { who: 'freezy', text: '{neo}の言葉は、ちゃんと歌になった。また聴かせてくれ。' },
];

/** The record: the sticker as its jacket, spinning while it plays. */
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

export function MercuryLesson({ api, stickers, neo, bati, batiImage, onDone }: { api: LessonApi; stickers: StickerMade[]; neo: string; bati: string; batiImage?: string; onDone: (song: SongMade) => void }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [k, setK] = useState(0);
  const [reply, setReply] = useState<string | null>(null);
  const [sticker, setSticker] = useState<StickerMade | null>(stickers.length === 1 ? stickers[0] : null);
  const [design, setDesign] = useState<SongDesign | null>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [feel, setFeel] = useState<string>('auto');
  const [song, setSong] = useState<{ id: string; title: string; url: string } | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [shipK, setShipK] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{bati}', bati);
  const line = (who: Who, text: string): CoachLine => ({ sprite: who === 'bati' ? batiImage : WHO[who].sprite, name: who === 'bati' ? bati : WHO[who].name, text: fill(text) });

  const write = async (s: StickerMade) => {
    setSticker(s);
    setPhase('writing');
    try {
      setDesign(await api.lyrics(s.text, bati));
      setPhase('lyrics');
    } catch {
      setPhase('failed');
    }
  };
  const sing = async () => {
    if (!design) return;
    setPhase('singing');
    const sound = STYLE_SOUND[feel];
    const d: SongDesign = sound ? { ...design, genre: feel, instrumentalPrompt: sound.prompt, bpm: sound.bpm } : design;
    try {
      setSong(await api.sing(d, setStage));
      setPhase('song');
    } catch {
      setPhase('failed');
    }
  };
  const lines = design?.sections.flatMap((s, si) => s.lines.map((l, li) => ({ si, li, text: l.text }))) ?? [];
  const setLine = (si: number, li: number, text: string) =>
    setDesign((d) => (d ? { ...d, sections: d.sections.map((s, a) => (a !== si ? s : { ...s, lines: s.lines.map((l, b) => (b !== li ? l : { ...l, text })) })) } : d));

  let coach: CoachLine | null = null;
  let actions: React.ReactNode = null;
  if (phase === 'intro') {
    const b = INTRO[k];
    coach = line(b.who, reply ?? b.text);
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
            setReply(null);
            if (k < INTRO.length - 1) setK(k + 1);
            else if (stickers.length > 1) setPhase('pick');
            else void write(stickers[0] ?? { text: '今日のこと', url: null });
          }}
        />
      );
  } else if (phase === 'pick') coach = line('freezy', 'どっちのシールを、歌にする？');
  else if (phase === 'writing') coach = line('bati', 'このシールの言葉から、歌詞を書くね！');
  else if (phase === 'lyrics') coach = line('freezy', 'これが歌詞の下書きだ。直したい所があれば、その行をさわって直せ。');
  else if (phase === 'style') coach = line('freezy', 'どんな感じの曲にする？');
  else if (phase === 'mana') coach = line('bati', '歌にするのに、マナを少し使うけど、いい？');
  else if (phase === 'singing') coach = line('bati', stage === 'warming' ? '音のスタジオが、目をさましてる……もうちょっと待ってね' : `〈${sticker?.text ?? ''}〉——ここに、ふしを。`);
  else if (phase === 'failed') coach = line('bati', '魔法陣、ちょっと凍っちゃった……。歌詞は残ってるよ。もう1回唱えてもいい？');
  else if (phase === 'song') coach = line('bati', 'できたよ！　▶ で聴いてみて！');
  else if (phase === 'saved') {
    coach = line('guide', '曲を、{neo}だけの棚に保存しました。誰にも送られていません');
    actions = <NextButton onClick={() => setPhase('ship')} />;
  } else if (phase === 'ship') {
    const s = SHIP_LINES[Math.min(shipK, SHIP_LINES.length - 1)];
    coach = line(s.who, s.text);
    actions = (
      <NextButton
        onClick={() => {
          if (shipK < SHIP_LINES.length - 1) setShipK(shipK + 1);
          else if (song && sticker) onDone({ id: song.id, title: song.title, url: song.url, jacket: sticker.url, words: sticker.text });
        }}
      />
    );
  }

  return (
    <LessonShell bg="/art/mercury-sea.jpg" coach={coach} actions={actions}>
      {batiImage && phase !== 'ship' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={batiImage} alt="" className="pointer-events-none absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-3 z-[170] h-16 w-16 rounded-2xl border-2 border-white/70 object-cover shadow-lg" aria-hidden />
      )}
      {song && <audio ref={audio} src={song.url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}

      {phase === 'pick' && (
        <Panel>
          <p className="text-center text-sm font-black text-sky-700">🎵 シールを選ぶ</p>
          <div className="mt-3 flex justify-center gap-4">
            {stickers.map((s, i) => (
              <button key={i} onClick={() => void write(s)} className="flex flex-col items-center gap-2 rounded-3xl p-2 active:scale-95">
                <Sticker s={s} size={130} />
              </button>
            ))}
          </div>
        </Panel>
      )}

      {phase === 'writing' && (
        <Panel>
          <p className="py-6 text-center text-sm font-bold text-sky-600">✍️ 歌詞を考えています…</p>
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
          <div className="mt-3">
            <Big tone="sky" onClick={() => setPhase('style')} disabled={lines.some((l) => !l.text.trim())}>
              この歌詞でいく
            </Big>
          </div>
        </Panel>
      )}

      {phase === 'style' && (
        <Panel>
          <div className="grid grid-cols-3 gap-2">
            {FEELS.map((f) => (
              <button key={f.id} onClick={() => setFeel(f.id)} className={`rounded-2xl py-3 text-sm font-black ${feel === f.id ? 'bg-sky-500 text-white' : 'bg-sky-50 text-sky-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <Big tone="sky" onClick={() => setPhase('mana')}>
              {feel === 'auto' ? '任せる' : 'これでいく'}
            </Big>
          </div>
        </Panel>
      )}

      {phase === 'mana' && (
        <Panel>
          <div className="space-y-2">
            <Big tone="violet" onClick={() => void sing()}>
              使う
            </Big>
            <Soft onClick={() => setPhase('style')}>やめる</Soft>
          </div>
        </Panel>
      )}

      {(phase === 'singing' || phase === 'failed') && sticker && (
        <Panel>
          <div className="flex justify-center">
            <Record s={sticker} playing={phase === 'singing'} size={170} />
          </div>
          {phase === 'singing' ? (
            <p className="mt-3 text-center text-sm font-bold text-sky-600">♪ 作曲中…（2〜3分）　アプリを閉じても大丈夫</p>
          ) : (
            <div className="mt-3 space-y-2">
              <Big tone="sky" onClick={() => (design ? void sing() : void write(sticker))}>
                もう1回唱える
              </Big>
            </div>
          )}
        </Panel>
      )}

      {phase === 'song' && sticker && song && (
        <Panel>
          <p className="text-center text-sm font-black text-sky-700">{song.title}</p>
          <div className="mt-3 flex justify-center">
            <button onClick={() => (playing ? audio.current?.pause() : void audio.current?.play())} aria-label="play">
              <Record s={sticker} playing={playing} size={200} />
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
              💾 この曲を保存する
            </Big>
            <Soft onClick={() => setPhase('lyrics')}>歌詞を直して、作り直す</Soft>
            <Later label="🚢 出航させる" />
          </div>
        </Panel>
      )}

      {phase === 'ship' && sticker && (
        <div className="pointer-events-none absolute bottom-[18svh] left-[30%] z-[160] animate-[shipOut_9s_ease-in_forwards]">
          <div className="relative flex flex-col items-center">
            <div className="rounded-full border-4 border-white/80 shadow-xl">
              <Sticker s={sticker} size={110} />
            </div>
            <span className="-mt-2 text-7xl drop-shadow-xl">⛵</span>
          </div>
        </div>
      )}
    </LessonShell>
  );
}
