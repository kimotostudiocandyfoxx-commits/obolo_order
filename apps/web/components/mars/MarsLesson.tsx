'use client';

import { MAKE_COST } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { Sticker, saveSpell } from '@/components/jupiter/JupiterLesson';
import { Record } from '@/components/mercury/MercuryLesson';
import { AtelierScreen } from '@/components/atelier/AtelierScreen';
import { Big, LessonShell, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import type { LessonApi } from '@/lib/onboarding/lessonApi';
import type { MvMade, SongMade, StickerMade } from '@/lib/onboarding/made';
import { MyStudio, STUDIO_DEFAULT, studioCards, studioFromWords, studioOmakase, type StudioLook } from './MyStudio';
import { LineVoice } from '@/lib/story/lineVoice';
import { Glyph } from '@/components/bluena/glyphs';

/**
 * Day 6 on Mars (first journey, simple version M-R185/M-R198/M-R200; script P04/c01.md D07-S004〜S005b).
 * 作るのは月、しまうのはBluena、見せるのは星:
 *  D07-S004  ヒポキン: no camera — say the scene. 〔✨ 星図／🎬 myスタジオ〕 and, in the corner, 〔🌙 つくる〕〔Bluena〕.
 *            〔🌙 つくる〕 → {bati}「工房に行こう！」 → the Moon atelier opens through Bluena (AtelierScreen) →
 *            「何を作る？」 〔▶〕 → say the scene (or 〔パス〕) → 「何を撮る？」 only 〔MV〕 → yesterday's song (one song:
 *            no prev/new choice) → three scenes → scene 1 is yours (view / art / walk / dark).
 *  D07-S005  the spell cards → mana asked → {bati} shoots on the workbench; KIMORIN⭐︎'s 『プリプリ・ボカン』 MV next
 *            door (「……いい画だ。」) → できあがり, −8マナ → 「Bluenaに、しまったよ！」 (the MV goes into Bluena's Mars
 *            folder, the backstage shelf) → ▶ watch it first → このまま次へ／もう一回つくる（1回だけ） → the screen
 *            closes back into Bluena → 「しまったら、次は、置き場所だ。」
 *  D07-S005b 🎬 myスタジオ: the lot, {bati}'s chat → part cards → 「鳴らせ。」 the clapper (or talk to change it) →
 *            built, its big frame empty → 「次は、届ける。」 → 〔🛸 公開する〕 (Bluena projects the MV into the frame,
 *            a UFO flies to the dachi's star map) or keep it in Bluena. The scene's last lines play in day6.ts.
 * Without a song there is no MV to make (the server shoots from a song): only an old film frame is picked.
 * The character lines are the script's, word for word (who/text, so scripts/story-sync.ts reads them).
 */
export type MarsResult = { mv: MvMade | null; frame?: 'sunset' | 'sea' | 'stars'; studio?: StudioLook & { parts: string[] }; sent?: boolean };
type Phase =
  | 'intro'
  | 'what'
  | 'look'
  | 'frames'
  | 'kimorin-mv'
  | 'words'
  | 'kind'
  | 'song'
  | 'scenes'
  | 'first'
  | 'redraft'
  | 'spell'
  | 'mana'
  | 'making'
  | 'failed'
  | 'made'
  | 'close'
  | 'after';
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
const FIRSTS: { id: 'view' | 'art' | 'walk' | 'dark'; label: string; wish: string; reply: Line }[] = [
  { id: 'view', label: '曲の景色から', wish: '曲の景色から始まる', reply: { who: 'hipokin', text: '定番だ。見る人が迷わない。' } },
  { id: 'art', label: '木星のアートから', wish: '木星のアートの絵から始まる', reply: { who: 'hipokin', text: '自分の絵から入るか。いい入り方だ。' } },
  { id: 'walk', label: '{neo}が歩いてくる', wish: '主人公が歩いてくるところから始まる', reply: { who: 'hipokin', text: '主役が先か。いい。' } },
  { id: 'dark', label: '真っ暗から', wish: '真っ暗な画面から始まる', reply: { who: 'hipokin', text: '黒から入るか。渋いな。' } },
];
// 「何を作る？」: the atelier's symbol buttons (only ▶ = a film today)
const MAKE_KINDS = ['voice', 'art', 'song', 'video'] as const;
const KIMORIN_MV = '/onboarding/s/mv-kimorin-slide.jpg';
const OPENING: Line = { who: 'hipokin', text: '火星の撮影に、カメラはいらない。撮りたい場面を、話せばいい。' };

// D07-S005b myスタジオと、ダチの星図へ (after the screen has closed)
type After =
  | { k: 'line'; l: Line }
  | { k: 'bar' } // the right 〔🎬 myスタジオ〕 glows
  | { k: 'chat' } // {bati}: what kind of studio? → the part cards
  | { k: 'pick' } // 「鳴らせ。」 〔カチンコを鳴らす〕／〔話して直す〕
  | { k: 'build' }
  | { k: 'inside' } // the studio's door opens: the big frame is still empty
  | { k: 'send' } // 〔🛸 公開する〕／〔今は、Bluenaにしまっておく〕
  | { k: 'post' } // 行き先〔ダチへ〕 → 〔とばす〕
  | { k: 'beam' } // Bluena's lens: the MV appears in the big frame
  | { k: 'ufo' }
  | { k: 'end' };
const L = (l: Line): After => ({ k: 'line', l });
const AFTER: After[] = [
  { k: 'bar' },
  L({ who: 'hipokin', text: '撮影所の土地だ。建てるのは、自分でやれ。' }), // ヒポキンが、カチンコを{neo}に渡す
  { k: 'chat' },
  { k: 'pick' },
  { k: 'build' },
  L({ who: 'guide', text: 'myスタジオができた' }),
  { k: 'inside' },
  L({ who: 'hipokin', text: '次は、届ける。' }),
  { k: 'send' },
];
const SENT: After[] = [
  { k: 'post' },
  { k: 'beam' },
  { k: 'ufo' },
  L({ who: 'kimorin', text: '……来ました。押すまで、待っていてくれるのですね。では、遠慮なく。' }),
  L({ who: 'kimorin', text: '……{neo}の一本、確かに受け取りました。' }),
  { k: 'end' },
];
const KEPT: After[] = [
  L({ who: 'hipokin', text: '飛ばすのは、いつでもいい。' }),
  L({ who: 'guide', text: '〔公開する〕は、Bluenaの映像から、いつでも押せます。公開するまで、スタジオの1枠は空いたままです' }),
  { k: 'end' },
];

/** Mars's screen: 〔✨ 星図〕〔🎬 myスタジオ〕, and in the corner the same 〔🌙 つくる〕〔Bluena〕 as on every planet. */
function Bar({ glow, onTap }: { glow: 'make' | 'studio' | null; onTap?: () => void }) {
  const btn = (on: boolean) => `rounded-2xl px-4 py-2.5 text-sm font-black ${on ? 'animate-pulse bg-rose-400 text-white ring-4 ring-rose-200' : 'bg-white/20 text-white/80'}`;
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[175] bg-gradient-to-t from-black/60 to-transparent px-4 pb-5 pt-8">
      <div className="flex justify-center gap-3">
        <button disabled className={btn(false)}>
          星図
        </button>
        <button disabled={glow !== 'studio' || !onTap} onClick={onTap} className={btn(glow === 'studio')}>
          myスタジオ
        </button>
      </div>
      <div className="absolute bottom-5 right-3 flex flex-col items-end gap-2">
        <button disabled={glow !== 'make' || !onTap} onClick={onTap} className={`rounded-full px-3 py-2 text-[12px] font-black ${glow === 'make' ? 'animate-pulse bg-amber-300 text-stone-900 ring-4 ring-amber-100' : 'bg-white/20 text-white/80'}`}>
          つくる
        </button>
        <span className="rounded-full bg-sky-300/30 px-3 py-1 text-[11px] font-black text-sky-50">Bluena</span>
      </div>
    </div>
  );
}

export function MarsLesson({
  api,
  song,
  neo,
  bati,
  inviter,
  batiImage,
  stickers = [],
  look: neoFace,
  chibi,
  onDone,
}: {
  api: LessonApi;
  song: SongMade | null;
  /** the arts from Jupiter: scene 1 may start from one (R21b) */
  stickers?: StickerMade[];
  /** the round look and the chibi: the pilot in the UFO's window */
  look?: string;
  chibi?: string;
  neo: string;
  bati: string;
  inviter: string;
  batiImage?: string;
  onDone: (r: MarsResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [k, setK] = useState(0);
  const [cue, setCue] = useState<Line | null>(OPENING);
  const [words, setWords] = useState('');
  const [passed, setPassed] = useState(false);
  const [first, setFirst] = useState<(typeof FIRSTS)[number] | null>(null);
  const [frame, setFrame] = useState<MarsResult['frame']>();
  // the takes in Bluena's Mars folder (M-R132: one more take at most); `pick` is the one to publish
  const [takes, setTakes] = useState<MvMade[]>([]);
  const [pick, setPick] = useState(0);
  const [pending, setPending] = useState<MvMade | null>(null);
  const [kmShown, setKmShown] = useState(false);
  const [ms, setMs] = useState(0); // the steps after a take is done: できあがり → −8マナ → しまったよ → ▶
  const [after, setAfter] = useState<After[]>([]);
  const [ak, setAk] = useState(0);
  const [studio, setStudio] = useState<StudioLook>(STUDIO_DEFAULT);
  const [chat, setChat] = useState<'ask' | 'cards'>('ask');
  const [redo, setRedo] = useState(false);
  const [talk, setTalk] = useState('');
  const [built, setBuilt] = useState(0);
  const [startArt, setStartArt] = useState<StickerMade | null>(null);
  const [spelled, setSpelled] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [sent, setSent] = useState(false);
  const voice = useRef<LineVoice | null>(null);
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{bati}', bati).replaceAll('{inviter}', inviter);
  const mv = takes[pick] ?? null;
  const ab = phase === 'after' ? after[ak] : undefined;
  const anext = () => setAk((x) => x + 1);
  const ainsert = (more: After[]) => setAfter((a) => [...a.slice(0, ak + 1), ...more, ...a.slice(ak + 1)]);
  const lineOf = (l: Line): CoachLine => ({ sprite: l.who === 'bati' ? batiImage : SPRITES[l.who], name: l.who === 'bati' ? bati : NAMES[l.who] || undefined, text: fill(l.text) });
  const said = (l: Line) => {
    setCue(l);
    if (SPEAKER[l.who]) void voice.current?.say(SPEAKER[l.who], l.text);
  };
  const sayVoice = (l: Line) => {
    if (SPEAKER[l.who]) void voice.current?.say(SPEAKER[l.who], l.text);
  };

  useEffect(() => {
    const v = new LineVoice();
    v.unlock();
    voice.current = v;
    void v.say('ヒポキン', OPENING.text);
    return () => v.dispose();
  }, []);

  const make = async () => {
    if (!song) return;
    setPhase('making');
    setPending(null);
    setKmShown(false);
    said({ who: 'bati', text: '〈{neo}の場面〉——ここに、ひかりを。' });
    const opening = first?.id === 'art' && startArt ? `木星のアート「${startArt.text}」の絵から始まる` : (first?.wish ?? '');
    const wish = [passed ? '' : words.trim(), opening].filter(Boolean).join('。');
    try {
      setPending(await api.mv(song, wish, false));
    } catch {
      setPhase('failed');
      said({ who: 'bati', text: '魔法陣、ちょっとぶれちゃった……。シーンは残ってるよ。もう1回唱えてもいい？' });
    }
  };
  // while {bati} shoots: KIMORIN⭐︎'s Bluena door is open next to us — his 『プリプリ・ボカン』 MV (the giant golden slide)
  useEffect(() => {
    if (phase !== 'making' || kmShown) return;
    const t = setTimeout(() => {
      setKmShown(true);
      said({ who: 'hipokin', text: '……いい画だ。' });
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, kmShown]);
  // the take is done once both are: {neo}'s MV and KIMORIN⭐︎'s (so the −8マナ never reads as his)
  useEffect(() => {
    if (phase !== 'making' || !kmShown || !pending) return;
    const t = setTimeout(() => {
      setTakes((ts) => [...ts, pending]);
      setPick(takes.length);
      setPending(null);
      setPhase('made');
      setMs(0);
      setCue({ who: 'guide', text: 'できあがり' });
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, kmShown, pending]);

  // each line plays its voice; the studio rises out of the sand; the beam; the UFO lifts off
  useEffect(() => {
    if (!ab) return;
    if (ab.k === 'line') sayVoice(ab.l);
    if (ab.k === 'chat' && chat === 'ask') sayVoice({ who: 'bati', text: 'どんなスタジオにしたい？　ざっくりでいいよ！' });
    if (ab.k === 'pick') sayVoice({ who: 'hipokin', text: '鳴らせ。' });
    if (ab.k === 'build') {
      // カチン: the red sand swirls and the studio rises as the cards say
      setBuilt(0);
      const t0 = Date.now();
      const iv = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / 2200);
        setBuilt(p);
        if (p >= 1) {
          clearInterval(iv);
          setTimeout(anext, 600);
        }
      }, 60);
      return () => clearInterval(iv);
    }
    if (ab.k === 'beam') {
      setPlaced(true);
      const t = setTimeout(anext, 1800);
      return () => clearTimeout(t);
    }
    if (ab.k === 'ufo') {
      const t = setTimeout(anext, 3000);
      return () => clearTimeout(t);
    }
    if (ab.k === 'end') onDone({ mv, studio: { ...studio, parts: studioCards(studio) }, sent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ab]);

  const atelierOpen = ['what', 'look', 'frames', 'kimorin-mv', 'words', 'kind', 'song', 'scenes', 'first', 'redraft', 'spell', 'mana', 'making', 'failed', 'made'].includes(phase);
  const lotShown = phase === 'after' && ak >= 1;
  const pickAt = after.findIndex((x) => x.k === 'pick');
  const remade = takes.length > 1;

  let coach: CoachLine | null = cue ? lineOf(cue) : null;
  let actions: React.ReactNode = null;
  if (phase === 'intro' && k === 0)
    actions = (
      <NextButton
        onClick={() => {
          setK(1);
          said({ who: 'hipokin', text: '撮るのは、すみの〔🌙 つくる〕だ。' });
        }}
      />
    );
  else if (phase === 'what') coach = { text: '何を作る？' };
  else if (phase === 'look')
    actions = (
      <NextButton
        onClick={() => {
          if (!song) {
            setPhase('frames');
            setCue({ who: 'guide', text: 'MVは、曲から撮ります。水星で曲をしまうと、ここで撮れます' });
            return;
          }
          setPhase('words');
          said({ who: 'bati', text: 'どんな場面を見たい？　話してみて。' });
        }}
      />
    );
  else if (phase === 'kimorin-mv') actions = <NextButton onClick={() => onDone({ mv: null, frame })} />;
  else if (phase === 'kind') coach = { text: '何を撮る？' };
  else if (phase === 'mana') coach = { text: '撮影に、マナを使います。いいですか？' };
  else if (phase === 'made' && ms < 2)
    actions = (
      <NextButton
        onClick={() => {
          if (ms === 0) setCue({ who: 'guide', text: `−${MAKE_COST.mv}マナ` });
          else if (!remade) said({ who: 'bati', text: 'Bluenaに、しまったよ！' });
          else setCue(null);
          setMs(ms === 0 ? 1 : remade ? 3 : 2);
        }}
      />
    );
  else if (phase === 'made' && ms === 2)
    actions = (
      <NextButton
        onClick={() => {
          setMs(3);
          said({ who: 'hipokin', text: '公開する前に、▶で見ろ。最初に見るのは、作った者だ。' });
        }}
      />
    );
  else if (phase === 'close')
    actions = (
      <NextButton
        onClick={() => {
          setPhase('after');
          setAfter(AFTER);
          setAk(0);
          setCue(null);
        }}
      />
    );
  else if (phase === 'after') {
    coach =
      ab?.k === 'line'
        ? lineOf(ab.l)
        : ab?.k === 'bar'
          ? { text: '右の〔myスタジオ〕を押す' }
          : ab?.k === 'chat'
            ? lineOf({ who: 'bati', text: chat === 'cards' ? 'じゃあ、こんな感じかな！' : 'どんなスタジオにしたい？　ざっくりでいいよ！' })
            : ab?.k === 'pick'
              ? lineOf({ who: 'hipokin', text: '鳴らせ。' })
              : null;
    if (ab?.k === 'line') actions = <NextButton onClick={anext} />;
  }

  const sceneCards = (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {[1, 2, 3].map((n) => (
        <div key={n} className={`flex aspect-video items-end rounded-lg p-1 text-[10px] font-black ${n === 1 && !first ? 'border-2 border-dashed border-rose-300 bg-white text-rose-400' : 'bg-gradient-to-br from-rose-200 to-amber-200 text-rose-700'}`}>
          シーン{n}
        </div>
      ))}
    </div>
  );
  const takeCard = (m: MvMade, i: number) => (
    <div key={m.id + i} className={`rounded-2xl p-2 ${remade ? (i === pick ? 'bg-rose-50 ring-2 ring-rose-300' : 'bg-slate-50') : ''}`}>
      <p className="text-center text-sm font-black text-rose-600">{m.title}</p>
      <p className="text-center text-[11px] text-slate-400">MV・未公開</p>
      <video src={m.url} poster={m.poster ?? undefined} controls playsInline className="mt-1 aspect-video w-full rounded-xl bg-black object-contain" />
    </div>
  );

  return (
    <LessonShell bg="/onboarding/s/mars-screens.jpg" coach={coach} actions={actions}>
      {batiImage && !atelierOpen && (
        // {bati} next to {neo} (in the atelier while its screen is open)
        // eslint-disable-next-line @next/next/no-img-element
        <img src={batiImage} alt="" className="pointer-events-none absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-3 z-[170] h-16 w-16 animate-[fadeUp_0.5s_ease-out] rounded-2xl border-2 border-white/70 object-cover shadow-lg" aria-hidden />
      )}
      {phase === 'intro' && (
        <Bar
          glow={k === 1 ? 'make' : null}
          onTap={() => {
            setPhase('what');
            said({ who: 'bati', text: '工房に行こう！' });
          }}
        />
      )}

      {/* the Moon atelier through Bluena's lens: {bati} on the workbench; the film strip while shooting */}
      {(atelierOpen || phase === 'close') && (
        <AtelierScreen bati={{ name: bati, image: batiImage }} closing={phase === 'close'}>
          {(phase === 'making' || phase === 'made') && (
            <div className="flex w-full flex-col items-center gap-2">
              <span className={`h-14 w-14 rounded-full border-2 border-dashed border-amber-200/80 ${phase === 'making' ? 'animate-spin' : 'opacity-0'}`} style={{ animationDuration: '3s' }} />
              <div className="flex w-full gap-1 rounded-sm border-y-4 border-dashed border-stone-900 bg-stone-800 p-1">
                {[1, 2, 3].map((n) => (
                  <span key={n} className="flex aspect-video flex-1 items-end rounded-sm bg-gradient-to-br from-rose-300/80 to-amber-200/80 p-0.5 text-[9px] font-black text-rose-900">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </AtelierScreen>
      )}

      {phase === 'what' && (
        <Panel>
          <div className="grid grid-cols-4 gap-2">
            {MAKE_KINDS.map((s) => (
              <button
                key={s}
                disabled={s !== 'video'}
                onClick={() => {
                  setPhase('look');
                  said({ who: 'hipokin', text: '撮るのは、向こうでいい。撮った映像が生きるのは、こっちだ。' });
                }}
                className={`rounded-2xl py-4 text-xl font-black ${s === 'video' ? 'animate-pulse bg-rose-500 text-white' : 'bg-slate-100 text-slate-300'}`}
              >
                <Glyph id={s} className="mx-auto h-7 w-7" />
              </button>
            ))}
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

      {(phase === 'kimorin-mv' || (phase === 'making' && kmShown)) && (
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
            <VoiceField light value={words} onChange={setWords} placeholder="夜の海を、小さな船が、まっすぐ進む" maxLength={60} />
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
                  setPhase('song');
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

      {/* one song in Bluena: no prev/new choice — a thread of light runs from yesterday's record to the screen */}
      {(phase === 'song' || phase === 'scenes') && song && (
        <Panel>
          <div className="flex items-center gap-3 rounded-2xl bg-rose-50 p-2">
            <Record s={{ text: song.words, url: song.jacket }} playing={false} size={64} />
            <span className="text-sm font-black">{song.title}</span>
            <span className="ml-auto h-[2px] flex-1 animate-pulse rounded bg-gradient-to-r from-amber-300 to-transparent" />
          </div>
          {phase === 'song' ? (
            <div className="mt-3">
              <Big tone="rose" onClick={() => setPhase('scenes')}>
                つぎへ
              </Big>
            </div>
          ) : (
            <>
              <p className="mt-3 text-center text-[12px] font-bold text-slate-500">{passed ? '曲の景色から三つ考えました。ちがったら直せます' : '話した場面を、三つのシーンに分けました'}</p>
              {sceneCards}
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
            </>
          )}
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
          ) : first?.id === 'art' && !startArt ? (
            // the art book opens; the song's jacket art glows at the front
            <div>
              <p className="text-center text-sm font-black text-rose-600">アート帳</p>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {[...stickers].sort((a, b) => Number(b.url === song?.jacket) - Number(a.url === song?.jacket)).map((a, i) => (
                  <button key={i} onClick={() => setStartArt(a)} className={`rounded-md ${a.url && a.url === song?.jacket ? 'ring-4 ring-amber-300' : ''}`}>
                    <Sticker s={a} size={90} />
                  </button>
                ))}
              </div>
              {!stickers.length && <Soft onClick={() => setFirst(FIRSTS[0])}>{FIRSTS[0].label}</Soft>}
            </div>
          ) : first ? (
            <>
              {sceneCards}
              <div className="mt-3">
                <Big
                  tone="violet"
                  onClick={() => {
                    setPhase('spell');
                    said({ who: 'bati', text: 'じゃあ、スペルは、こうなるね！' });
                  }}
                >
                  この3つのシーンで撮る
                </Big>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {FIRSTS.map((f) => (
                <Soft
                  key={f.id}
                  onClick={() => {
                    setFirst(f);
                    said(f.reply);
                  }}
                >
                  {fill(f.label)}
                </Soft>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* one more take: back to the three scenes' draft (they may change it; the spell cards change as they talk) */}
      {phase === 'redraft' && (
        <Panel>
          <p className="text-center text-sm font-black text-rose-600">シーン1／シーン2／シーン3</p>
          {sceneCards}
          <div className="mt-3">
            <VoiceField light value={words} onChange={setWords} placeholder="夜の海を、小さな船が、まっすぐ進む" maxLength={60} />
          </div>
          <div className="mt-3">
            <Big
              tone="violet"
              onClick={() => {
                if (words.trim()) setPassed(false);
                setPhase('spell');
                setCue(null);
              }}
            >
              この3つのシーンで撮る
            </Big>
          </div>
        </Panel>
      )}

      {phase === 'spell' && (
        <Panel>
          <div className="flex flex-wrap justify-center gap-1.5">
            {[song?.title ?? 'MV', 'シーン1', 'シーン2', 'シーン3', ...(passed ? [] : words.split(/[、。,.\s　]+/).filter(Boolean).slice(0, 3)), first?.id === 'art' && startArt ? `アート：${startArt.text}` : first?.label.replace('{neo}', neo) ?? '', 'ゆっくりのカメラ']
              .filter(Boolean)
              .map((c, i) => (
                <span key={`${c}-${i}`} className="animate-[fadeUp_0.4s_ease-out] rounded-md border border-rose-300 bg-gradient-to-b from-rose-50 to-amber-50 px-2 py-1 font-serif text-[13px] font-bold text-rose-800 shadow-sm" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}>
                  〈{c}〉
                </span>
              ))}
          </div>
          <button
            onClick={() => {
              saveSpell([song?.title ?? 'MV', ...(passed ? [] : words.split(/[、。,.\s　]+/).filter(Boolean).slice(0, 3)), 'ゆっくりのカメラ']);
              setSpelled(true);
            }}
            disabled={spelled}
            className="mx-auto mt-2 block text-[12px] font-bold text-violet-600 disabled:text-slate-400"
          >
            {spelled ? 'スペルブックに、記しました' : '記す'}
          </button>
          <div className="mt-3">
            <Big
              tone="rose"
              onClick={() => {
                if (cue?.text === 'じゃあ、スペルは、こうなるね！') return said({ who: 'hipokin', text: 'カメラの動きも、スペルのうちだ。' });
                setPhase('mana');
                setCue(null);
              }}
            >
              つぎへ
            </Big>
          </div>
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
                setPhase(takes.length ? 'redraft' : 'first');
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
            <p className="py-4 text-center text-sm font-bold text-rose-500">撮影中…</p>
          ) : (
            <Big tone="rose" onClick={() => void make()}>
              もう1回唱える
            </Big>
          )}
        </Panel>
      )}

      {/* the video card(s) in Bluena's Mars folder (it looks like the backstage shelf) */}
      {phase === 'made' && ms >= 3 && mv && (
        <Panel>
          <div className={remade ? 'grid grid-cols-2 gap-2' : ''}>{takes.map(takeCard)}</div>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
            {remade
              ? '映像カードが二枚、Bluenaの火星のフォルダに並びました。公開する一本は、あとで選べます（もう一回つくるのは、ここまで）'
              : `Bluenaの火星のフォルダ（裏スタジオの棚）にしまいました。${neo}だけが見られます`}
          </p>
          <div className="mt-3 space-y-2">
            <Big
              tone="rose"
              onClick={() => {
                setPhase('close');
                said({ who: 'hipokin', text: 'しまったら、次は、置き場所だ。' });
              }}
            >
              このまま次へ
            </Big>
            {!remade && (
              <Soft
                onClick={() => {
                  setPhase('redraft');
                  setCue(null);
                }}
              >
                もう一回つくる（1回だけ）
              </Soft>
            )}
          </div>
        </Panel>
      )}

      {ab?.k === 'bar' && <Bar glow="studio" onTap={anext} />}
      {/* the lot with your name tag → the studio you built, its big frame (empty until 〔🛸 公開する〕), the UFO */}
      {lotShown && (
        <div className="pointer-events-none absolute inset-x-0 top-[24svh] z-[160] flex flex-col items-center px-6">
          <div className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl border-2 border-white/40 bg-gradient-to-b from-orange-300 to-rose-500 shadow-2xl">
            {pickAt >= 0 && ak > pickAt ? (
              <MyStudio look={studio} built={ab?.k === 'build' ? built : 1} width={384} />
            ) : (
              <div className="absolute inset-x-10 bottom-8 top-10 border-2 border-dashed border-white/90" />
            )}
            {ab?.k === 'build' && <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle,rgba(255,170,90,0.6),transparent_70%)]" />}
            {pickAt >= 0 && ak > pickAt + 1 && !placed && (
              <div className="absolute bottom-[34%] left-1/2 flex aspect-video w-[34%] -translate-x-1/2 items-center justify-center rounded-sm border-2 border-dashed border-amber-200/80 bg-black/40 text-[10px] font-bold text-amber-100/80">空き</div>
            )}
            {ab?.k === 'beam' && <span className="absolute bottom-0 right-[8%] h-[70%] w-1 origin-bottom rotate-[-35deg] animate-[atelier-beam_1.2s_ease-out_forwards] rounded-full bg-sky-200/80 blur-[2px]" />}
            {placed && mv && (
              <div className="absolute bottom-[34%] left-1/2 w-[34%] -translate-x-1/2 animate-[fadeUp_0.6s_ease-out] overflow-hidden rounded-sm border-2 border-amber-200 bg-black shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {mv.poster ? <img src={mv.poster} alt="" className="aspect-video w-full object-cover" /> : <video src={mv.url} muted autoPlay loop playsInline className="aspect-video w-full object-cover" />}
              </div>
            )}
            {ab?.k === 'ufo' && (
              // the UFO carries the MV up into the red sky; in its round window the small {neo} holds the stick
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 animate-[shipOut_3s_ease-in_forwards]">
                <span className="relative block text-7xl drop-shadow-xl">
                  🛸
                  <span className="absolute left-1/2 top-[14%] h-7 w-7 -translate-x-1/2 overflow-hidden rounded-full border-2 border-sky-200 bg-sky-100/80">
                    {(chibi || neoFace) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={chibi || neoFace} alt="" className="h-full w-full object-cover object-top" />
                    )}
                  </span>
                </span>
              </span>
            )}
          </div>
          <span className="-mt-3 rounded bg-[#f6ead2] px-2 py-0.5 text-[12px] font-bold text-stone-700 shadow">〈{neo}〉 STUDIO</span>
        </div>
      )}
      {ab?.k === 'chat' && (
        <Panel>
          {chat === 'ask' ? (
            <div className="space-y-2">
              <p className="text-center text-sm font-black text-rose-600">myスタジオ</p>
              <VoiceField light value={talk} onChange={setTalk} placeholder="夜の砂漠で、ネオンがギラギラしてる感じ" maxLength={40} />
              <Big
                tone="rose"
                disabled={!talk.trim()}
                onClick={() => {
                  setStudio(studioFromWords(talk, STUDIO_DEFAULT));
                  setTalk('');
                  setChat('cards');
                  sayVoice({ who: 'bati', text: 'じゃあ、こんな感じかな！' });
                }}
              >
                これで組む
              </Big>
              <Soft
                onClick={() => {
                  setStudio(studioOmakase());
                  setChat('cards');
                  sayVoice({ who: 'bati', text: 'じゃあ、こんな感じかな！' });
                }}
              >
                おまかせ
              </Soft>
            </div>
          ) : (
            <div className="space-y-2">
              <StudioCards look={studio} />
              <Big tone="rose" onClick={anext}>
                つぎへ
              </Big>
            </div>
          )}
        </Panel>
      )}
      {ab?.k === 'pick' && (
        <Panel>
          <div className="space-y-2">
            <StudioCards look={studio} />
            {redo ? (
              <>
                <VoiceField light value={talk} onChange={setTalk} placeholder="もっと、派手に" maxLength={40} />
                <Big
                  tone="rose"
                  disabled={!talk.trim()}
                  onClick={() => {
                    setStudio((l) => studioFromWords(talk, l));
                    setTalk('');
                    setRedo(false);
                  }}
                >
                  これで直す
                </Big>
              </>
            ) : (
              <>
                <button onClick={anext} className="mx-auto flex animate-[hintGlow_2.2s_ease-in-out_infinite] flex-col items-center rounded-2xl bg-stone-900 px-8 py-4 text-white shadow-2xl active:scale-95">
                  <span className="text-[14px] font-black">カチンコを鳴らす</span>
                </button>
                <Soft onClick={() => setRedo(true)}>話して直す</Soft>
              </>
            )}
          </div>
        </Panel>
      )}
      {ab?.k === 'inside' && (
        <Panel>
          <p className="text-center text-sm font-black text-rose-600">〈{neo}〉 STUDIO</p>
          <div className="mx-auto mt-2 flex aspect-video w-2/3 items-center justify-center rounded-lg border-2 border-dashed border-rose-300 text-[12px] font-bold text-rose-400">大きい1枠は、空き</div>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">ここに飾るのは、公開した映像です。スタジオに飾った映像は、ダチがスタジオに来た時に見られます。Bluenaの中（裏スタジオの棚）は、{neo}だけ</p>
          <div className="mt-3 space-y-2">
            <Soft disabled onClick={() => undefined}>
              工房で新しく作る
            </Soft>
            <Big tone="rose" onClick={anext}>
              つぎへ
            </Big>
          </div>
        </Panel>
      )}
      {ab?.k === 'send' && mv && (
        <Panel>
          {remade ? (
            <div className="grid grid-cols-2 gap-2">
              {takes.map((m, i) => (
                <button key={m.id + i} onClick={() => setPick(i)} className={`rounded-xl p-1.5 text-left ${i === pick ? 'bg-rose-50 ring-2 ring-rose-400' : 'bg-slate-50'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.poster ? <img src={m.poster} alt="" className="aspect-video w-full rounded-lg object-cover" /> : <video src={m.url} muted playsInline className="aspect-video w-full rounded-lg bg-black object-cover" />}
                  <p className="mt-1 truncate text-[12px] font-black text-rose-600">
                    {i === pick ? '✓ ' : ''}
                    {m.title}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-sky-50 p-2">
              <video src={mv.url} poster={mv.poster ?? undefined} muted playsInline className="h-16 w-28 rounded-lg bg-black object-cover" />
              <div>
                <p className="text-sm font-black text-slate-700">{mv.title}</p>
                <p className="text-[11px] text-slate-400">MV</p>
              </div>
            </div>
          )}
          <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
            〔公開する〕を押すと、Bluenaから火星へ映り、スタジオの大きい1枠に飾られます。同時にUFOになって、ダチの星図を88時間とび、このスタジオに戻ります（届くのはダチだけ）
          </p>
          <div className="mt-3 space-y-2">
            <Big
              tone="rose"
              onClick={() => {
                setSent(true);
                ainsert(SENT);
                anext();
              }}
            >
              公開する
            </Big>
            <Soft
              onClick={() => {
                ainsert(KEPT);
                anext();
              }}
            >
              今は、Bluenaにしまっておく
            </Soft>
          </div>
        </Panel>
      )}
      {ab?.k === 'post' && (
        <Panel>
          <div className="space-y-3">
            <p className="text-center text-[13px] text-slate-500">行き先</p>
            <div className="rounded-2xl bg-rose-50 p-3 text-center text-[14px] font-bold text-rose-700 ring-2 ring-rose-300">✓ ダチへ（{inviter}・KIMORIN⭐︎）</div>
            <Big
              tone="rose"
              onClick={() => {
                if (mv) void api.deliver({ kind: 'mv', title: mv.title.slice(0, 60), url: mv.url, posterUrl: mv.poster ?? undefined, refId: /^[0-9a-f-]{36}$/.test(mv.id) ? mv.id : undefined }).catch(() => undefined);
                anext();
              }}
            >
              とばす
            </Big>
          </div>
        </Panel>
      )}
    </LessonShell>
  );
}

/** {bati}'s part cards for the studio, over a small picture of it */
function StudioCards({ look }: { look: StudioLook }) {
  return (
    <>
      <div className="flex justify-center">
        <MyStudio look={look} width={220} />
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {studioCards(look).map((c) => (
          <span key={c} className="rounded-md bg-rose-50 px-2 py-1 text-[12px] font-bold text-rose-800 ring-1 ring-rose-300">
            〈{c}〉
          </span>
        ))}
      </div>
      <p className="text-center text-[11px] text-slate-400">話すと、札が変わります。マナは使いません。あとで変えられます。星図の景色も、同じ見た目になります</p>
    </>
  );
}
