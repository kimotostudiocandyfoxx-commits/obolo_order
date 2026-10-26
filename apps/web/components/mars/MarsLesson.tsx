'use client';

import { useEffect, useRef, useState } from 'react';
import { Record } from '@/components/mercury/MercuryLesson';
import { Big, LessonShell, Later, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import type { LessonApi } from '@/lib/onboarding/lessonApi';
import type { MvMade, SongMade } from '@/lib/onboarding/made';
import { LineVoice } from '@/lib/story/lineVoice';

/**
 * Day 6 on Mars (first journey; story D07-S004〜S005, M-R108/M-R113/M-R114): the song gets an MV.
 *  1. ヒポキン: no camera — say the scene. KIMORIN⭐︎ presses 🎬 myスタジオ by mistake: an empty lot with
 *     only the 🔒 裏スタジオ door (built on the next journey). 🎥 撮影 in the middle.
 *  2. make / not today (stop here, or pick one of three old film frames and watch KIMORIN⭐︎'s MV)
 *  3. say the scene (or pass) → the kind: MV (today) → yesterday's song → three scenes; scene 1 is yours
 *     (from the song's view / {neo} walks in / from black)
 *  4. mana asked → {bati} shoots; meanwhile KIMORIN⭐︎'s 『プリプリ・ボカン』 MV (the giant golden slide)
 *  5. ▶ watch it first → 〔🔒 裏スタジオにしまう〕 (only you; 〔🛸 公開する〕 is the next journey)
 * Without a song there is no MV to make yet (the server shoots from a song), so only the film frames
 * are offered. The lines are the story's, word for word, so their voices play.
 */
export type MarsResult = { mv: MvMade | null; frame?: 'sunset' | 'sea' | 'stars' };
type Phase = 'intro' | 'studio' | 'tabs' | 'choose' | 'nomake' | 'hold' | 'frames' | 'kimorin-mv' | 'words' | 'kind' | 'scenes' | 'first' | 'mana' | 'making' | 'failed' | 'made' | 'kept';
type Who = 'hipokin' | 'kimorin' | 'bati' | 'guide';
type Line = { who: Who; text: string };
const SPEAKER: Record<Who, string> = { hipokin: 'ヒポキン', kimorin: 'KIMORIN', bati: 'バティ', guide: '' };
const NAMES: Record<Who, string> = { hipokin: 'ヒポキン', kimorin: 'KIMORIN⭐︎', bati: 'バティ', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { hipokin: 'hipokin', kimorin: 'kimorin-sun' };
const FRAMES = [
  { id: 'sunset', label: '夕焼け' },
  { id: 'sea', label: '夜の海' },
  { id: 'stars', label: '星空' },
] as const;
const FIRSTS = [
  { id: 'view', label: '曲の景色から', wish: '曲の景色から始まる', reply: '定番だ。見る人が迷わない。' },
  { id: 'walk', label: '{neo}が歩いてくる', wish: '主人公が歩いてくるところから始まる', reply: '主役が先か。いい。' },
  { id: 'dark', label: '真っ暗から', wish: '真っ暗な画面から始まる', reply: '黒から入るか。渋いな。' },
];
const WAITING: Line[] = [
  { who: 'kimorin', text: '……待つのは、得意ですよ。' },
  { who: 'kimorin', text: 'それは？' },
  { who: 'hipokin', text: '俺が初めて撮った映像だ。途中で止めたままだ。' },
  { who: 'kimorin', text: '……いつ、終わったのです？' },
  { who: 'hipokin', text: '……いい画だ。' },
];
const KIMORIN_MV = '/onboarding/s/mv-kimorin-slide.jpg';

function Bar({ glow }: { glow: 0 | 1 | 2 | null }) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[175] flex justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-4 pb-5 pt-8">
      {['✨ 星図', '🎥 撮影', '🎬 myスタジオ'].map((l, k) => (
        <div key={l} className={`rounded-2xl px-4 py-2.5 text-sm font-black ${k === glow ? 'animate-pulse bg-rose-400 text-white ring-4 ring-rose-200' : 'bg-white/20 text-white/80'}`}>
          {l}
        </div>
      ))}
    </div>
  );
}

export function MarsLesson({ api, song, neo, bati, batiImage, onDone }: { api: LessonApi; song: SongMade | null; neo: string; bati: string; batiImage?: string; onDone: (r: MarsResult) => void }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [k, setK] = useState(0);
  const [cue, setCue] = useState<Line | null>({ who: 'hipokin', text: '火星の撮影に、カメラはいらない。撮りたい場面を、話せばいい。' });
  const [words, setWords] = useState('');
  const [passed, setPassed] = useState(false);
  const [first, setFirst] = useState<(typeof FIRSTS)[number] | null>(null);
  const [frame, setFrame] = useState<MarsResult['frame']>();
  const [mv, setMv] = useState<MvMade | null>(null);
  const [wk, setWk] = useState(-1);
  const [watched, setWatched] = useState(false);
  const [keptK, setKeptK] = useState(0);
  const voice = useRef<LineVoice | null>(null);
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{bati}', bati);
  const lineOf = (l: Line): CoachLine => ({ sprite: l.who === 'bati' ? batiImage : SPRITES[l.who], name: l.who === 'bati' ? bati : NAMES[l.who] || undefined, text: fill(l.text) });
  const said = (l: Line) => {
    setCue(l);
    if (SPEAKER[l.who]) void voice.current?.say(SPEAKER[l.who], l.text);
  };

  useEffect(() => {
    const v = new LineVoice();
    v.unlock();
    voice.current = v;
    void v.say('ヒポキン', '火星の撮影に、カメラはいらない。撮りたい場面を、話せばいい。');
    return () => v.dispose();
  }, []);

  const make = async () => {
    if (!song) return;
    setPhase('making');
    said({ who: 'bati', text: '〈{neo}の場面〉——ここに、ひかりを。' });
    setWk(-1);
    const wish = [passed ? '' : words.trim(), first?.wish ?? ''].filter(Boolean).join('。');
    try {
      setMv(await api.mv(song, wish, false));
      setPhase('made');
      setCue({ who: 'guide', text: '−8マナ' });
    } catch {
      setPhase('failed');
      said({ who: 'bati', text: '魔法陣、ちょっとぶれちゃった……。シーンは残ってるよ。もう1回唱えてもいい？' });
    }
  };
  // while {bati} shoots: KIMORIN⭐︎ waits, then his own MV is done first
  useEffect(() => {
    if (phase !== 'making') return;
    const t = setInterval(() => setWk((x) => Math.min(x + 1, WAITING.length - 1)), 7000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase === 'making' && wk >= 0) said(WAITING[wk]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wk]);

  const KEPT: Line[] = [
    { who: 'guide', text: '🔒 裏スタジオにしまいました。{neo}だけが見られます' },
    { who: 'kimorin', text: '……更地に、一本。始まりとしては、上出来です。' },
    { who: 'guide', text: '〔🛸 公開する〕（届ける）は、二周目からひらきます' },
    { who: 'hipokin', text: '人に届けるのは、次の旅からだ。' },
  ];

  let coach: CoachLine | null = cue ? lineOf(cue) : null;
  let actions: React.ReactNode = null;
  let glow: 0 | 1 | 2 | null = null;
  if (phase === 'intro') {
    glow = k === 1 ? 2 : null;
    actions = (
      <NextButton
        onClick={() => {
          if (k === 0) {
            setK(1);
            said({ who: 'kimorin', text: '……ふふ。私の出番ですね。' });
          } else {
            setPhase('studio');
            setK(0);
            said({ who: 'kimorin', text: '……私のスタジオ、まだ更地ですね。' });
          }
        }}
      />
    );
  } else if (phase === 'studio') {
    actions = (
      <NextButton
        onClick={() => {
          if (k === 0) {
            setK(1);
            said({ who: 'hipokin', text: 'そこは、次の旅で建てる所だ。撮るのは、真ん中の〔🎥 撮影〕。' });
          } else {
            setPhase('tabs');
            setCue({ who: 'guide', text: '〔🎥 撮影〕をタップ' });
          }
        }}
      />
    );
  } else if (phase === 'hold') actions = <NextButton label="続ける" onClick={() => setPhase('nomake')} />;
  else if (phase === 'kimorin-mv') actions = <NextButton onClick={() => onDone({ mv: null, frame })} />;
  else if (phase === 'kind') coach = { text: '何を撮る？' };
  else if (phase === 'mana') coach = { text: '撮影に、マナを使います。いいですか？' };
  else if (phase === 'made' && cue?.text === '−8マナ') actions = <NextButton onClick={() => said({ who: 'hipokin', text: 'しまう前に、▶で見ろ。最初に見るのは、作った者だ。' })} />;
  else if (phase === 'kept') {
    coach = lineOf(KEPT[keptK]);
    const nextKept = () => {
      if (keptK >= KEPT.length - 1) return onDone({ mv });
      const l = KEPT[keptK + 1];
      setKeptK(keptK + 1);
      if (SPEAKER[l.who]) void voice.current?.say(SPEAKER[l.who], l.text);
    };
    actions = <NextButton onClick={nextKept} />;
  }

  return (
    <LessonShell bg="/onboarding/s/mars-screens.jpg" coach={coach} actions={actions}>
      {batiImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={batiImage} alt="" className="pointer-events-none absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-3 z-[170] h-16 w-16 rounded-2xl border-2 border-white/70 object-cover shadow-lg" aria-hidden />
      )}
      {phase === 'intro' && <Bar glow={glow} />}

      {phase === 'studio' && (
        <Panel>
          <p className="text-center text-sm font-black text-rose-600">🎬 myスタジオ</p>
          <div className="relative mt-3 h-40 rounded-2xl bg-gradient-to-b from-orange-200 to-rose-300">
            <div className="absolute inset-x-8 bottom-6 top-8 border-2 border-dashed border-white/90" />
            <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs font-black text-white drop-shadow">空き地（二周目で建てられます）</p>
            <div className="absolute bottom-3 right-3 rounded-t-lg bg-stone-700 px-2 py-3 text-[10px] font-black text-amber-200">🔒 裏スタジオ</div>
          </div>
        </Panel>
      )}

      {phase === 'tabs' && (
        <Panel>
          <div className="grid grid-cols-3 gap-2">
            <button disabled className="rounded-2xl bg-slate-100 py-4 text-sm font-black text-slate-300">
              ✨ 星図
              <span className="block text-[10px] font-bold">二周目から</span>
            </button>
            <button
              onClick={() => {
                setPhase('choose');
                setCue(null);
              }}
              className="animate-pulse rounded-2xl bg-rose-500 py-4 text-sm font-black text-white shadow"
            >
              🎥 撮影
            </button>
            <button onClick={() => setPhase('studio')} className="rounded-2xl bg-slate-100 py-4 text-sm font-black text-slate-500">
              🎬 myスタジオ
            </button>
          </div>
        </Panel>
      )}

      {phase === 'choose' && (
        <Panel>
          <div className="space-y-2">
            {song ? (
              <Big
                tone="rose"
                onClick={() => {
                  setPhase('words');
                  said({ who: 'bati', text: 'どんな場面を見たい？　しゃべっても、打っても、選んでもいいよ。' });
                }}
              >
                撮ってみる
              </Big>
            ) : (
              <p className="text-center text-[12px] font-bold text-slate-400">MVは、曲から撮ります。水星で曲をしまうと、ここで撮れます</p>
            )}
            <Soft
              onClick={() => {
                setPhase('nomake');
                said({ who: 'hipokin', text: '……そうか。' });
              }}
            >
              今日は作らない
            </Soft>
          </div>
        </Panel>
      )}

      {phase === 'nomake' && (
        <Panel>
          <div className="space-y-2">
            <Soft
              onClick={() => {
                setPhase('hold');
                said({ who: 'hipokin', text: 'スタジオは、逃げない。' });
              }}
            >
              今日はここまで
            </Soft>
            <Big
              tone="rose"
              onClick={() => {
                setPhase('frames');
                said({ who: 'hipokin', text: '見たいのを一つ。' });
              }}
            >
              作らずに、映したい景色を一つ選ぶ
            </Big>
          </div>
        </Panel>
      )}

      {phase === 'frames' && (
        <Panel>
          <div className="grid grid-cols-3 gap-2">
            {FRAMES.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFrame(f.id);
                  setPhase('kimorin-mv');
                  said({ who: 'hipokin', text: '……いい画だ。' });
                }}
                className="overflow-hidden rounded-xl bg-black text-[11px] font-black text-white active:scale-95"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/onboarding/s/mars-frame-${f.id}.jpg`} alt="" className="aspect-video w-full object-cover sepia-[0.3]" />
                <span className="block py-1">{f.label}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {(phase === 'kimorin-mv' || (phase === 'making' && wk >= 3)) && (
        <div className="absolute inset-x-0 top-[30svh] z-[160] flex justify-center px-4">
          <div className="w-full max-w-md animate-[fadeUp_0.6s_ease-out] overflow-hidden rounded-xl border-4 border-[#2a2a2a] bg-black shadow-[0_0_60px_rgba(255,190,80,0.5)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={KIMORIN_MV} alt="" className="aspect-video w-full animate-[kenBurns_12s_ease-in-out_infinite_alternate] object-cover" />
            <p className="bg-black py-1 text-center text-[11px] font-black text-amber-200">KIMORIN⭐︎『プリプリ・ボカン』</p>
          </div>
        </div>
      )}

      {phase === 'words' && (
        <Panel>
          <p className="text-center text-sm font-black text-rose-600">撮りたい場面を話してみよう</p>
          <div className="mt-3">
            <VoiceField value={words} onChange={setWords} placeholder="夜の海を、小さな船が、まっすぐ進む" maxLength={60} />
          </div>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">本当にいる人の顔や名前、ほかの人の作品のキャラクターは、映像にしません</p>
          <div className="mt-3 space-y-2">
            <Big
              tone="rose"
              disabled={!words.trim()}
              onClick={() => {
                setPassed(false);
                setPhase('kind');
              }}
            >
              送る
            </Big>
            <Soft
              onClick={() => {
                setPassed(true);
                setPhase('kind');
              }}
            >
              パス
            </Soft>
          </div>
        </Panel>
      )}

      {phase === 'kind' && (
        <Panel>
          <div className="grid grid-cols-2 gap-2">
            {['MV', '映画', '番組', 'おまかせ'].map((l) => (
              <button
                key={l}
                disabled={l !== 'MV'}
                onClick={() => {
                  setPhase('scenes');
                  said({ who: 'hipokin', text: '今日は、MVだ。曲に映像をつけるやつだ。' });
                }}
                className={`rounded-2xl py-4 text-sm font-black ${l === 'MV' ? 'animate-pulse bg-rose-500 text-white' : 'bg-slate-100 text-slate-300'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </Panel>
      )}

      {phase === 'scenes' && song && (
        <Panel>
          <div className="flex items-center gap-3 rounded-2xl bg-rose-50 p-2">
            <Record s={{ text: song.words, url: song.jacket }} playing={false} size={64} />
            <span className="text-sm font-black">{song.title}</span>
            <span className="ml-auto text-lg text-amber-400">✦</span>
          </div>
          <p className="mt-3 text-center text-[12px] font-bold text-slate-500">{passed ? '曲の景色から三つ考えました。ちがったら直せます' : '話した場面を、三つのシーンに分けました'}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`flex aspect-video items-end rounded-lg p-1 text-[10px] font-black ${n === 1 ? 'border-2 border-dashed border-rose-300 bg-white text-rose-400' : 'bg-gradient-to-br from-rose-200 to-amber-200 text-rose-700'}`}>
                🎬 シーン{n}
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Big
              tone="rose"
              onClick={() => {
                setPhase('first');
                setK(0);
                said({ who: 'hipokin', text: '最初のシーン1は、お前が決めろ。' });
              }}
            >
              つぎへ
            </Big>
          </div>
        </Panel>
      )}

      {phase === 'first' && (
        <Panel>
          {k < 2 ? (
            <Big
              tone="rose"
              onClick={() => {
                if (k === 0) said({ who: 'kimorin', text: '曲は、もちろん『プリプリ・ボカン』。シーン1は……炎の中から現れる私。いえ、雷の中……いえ、夜明けの崖の上……全部です。' });
                else said({ who: 'hipokin', text: '全部は、映らない。一つだけだ。' });
                setK(k + 1);
              }}
            >
              つぎへ
            </Big>
          ) : first ? (
            <Big tone="violet" onClick={() => setPhase('mana')}>
              この3つのシーンで撮る
            </Big>
          ) : (
            <div className="space-y-2">
              {FIRSTS.map((f) => (
                <Soft
                  key={f.id}
                  onClick={() => {
                    setFirst(f);
                    said({ who: 'hipokin', text: f.reply });
                  }}
                >
                  {fill(f.id === 'view' && !song ? '街の景色から' : f.label)}
                </Soft>
              ))}
            </div>
          )}
        </Panel>
      )}

      {phase === 'mana' && (
        <Panel>
          <div className="space-y-2">
            <Big tone="violet" onClick={() => void make()}>
              使う
            </Big>
            <Soft
              onClick={() => {
                setPhase('first');
                said({ who: 'hipokin', text: 'シーンは、ここに残しておく。' });
              }}
            >
              やめる
            </Soft>
          </div>
        </Panel>
      )}

      {(phase === 'making' || phase === 'failed') && (
        <Panel>
          {phase === 'making' ? (
            <p className="py-4 text-center text-sm font-bold text-rose-500">🎬 撮影中…（数分）　アプリを閉じても大丈夫</p>
          ) : (
            <Big tone="rose" onClick={() => void make()}>
              もう1回唱える
            </Big>
          )}
        </Panel>
      )}

      {phase === 'made' && mv && (
        <Panel>
          <p className="text-center text-sm font-black text-rose-600">{mv.title}</p>
          <p className="text-center text-[11px] text-slate-400">MV・未公開</p>
          <video src={mv.url} poster={mv.poster ?? undefined} controls playsInline onPlay={() => setWatched(true)} className="mt-2 aspect-video w-full rounded-2xl bg-black object-contain" />
          <div className="mt-3 space-y-2">
            <Big
              tone="rose"
              onClick={() => {
                setPhase('kept');
                setKeptK(0);
              }}
            >
              🔒 裏スタジオにしまう
            </Big>
            {!watched && <p className="text-center text-[11px] text-slate-400">しまう前に、▶ で見てみよう</p>}
            <Soft onClick={() => setPhase('first')}>もう一回つくる</Soft>
            <Later label="🛸 公開する" />
          </div>
        </Panel>
      )}

      {phase === 'kept' && mv && (
        <Panel>
          <div className="rounded-2xl bg-stone-800 p-3 text-amber-100">
            <p className="text-xs font-black">🔒 裏スタジオ</p>
            <div className="mt-2 flex items-center gap-3">
              <video src={mv.url} poster={mv.poster ?? undefined} muted playsInline className="h-16 w-28 rounded-lg bg-black object-cover" />
              <span className="text-sm font-bold">{mv.title}</span>
            </div>
          </div>
        </Panel>
      )}
    </LessonShell>
  );
}
