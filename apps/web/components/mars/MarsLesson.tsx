'use client';

import { useState } from 'react';
import { Record } from '@/components/mercury/MercuryLesson';
import { Big, LessonShell, Later, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import type { LessonApi } from '@/lib/onboarding/lessonApi';
import type { MvMade, SongMade } from '@/lib/onboarding/made';

/**
 * Day 6 on Mars (first journey; client 2026-10-14): yesterday's song gets an MV.
 *  1. ヒポキン: you shoot on the screen in your hand — ✨星図 / 🎥 撮影 / 🎬 myスタジオ (KIMORIN⭐︎ presses
 *     myスタジオ first: empty — that is where films go after shooting)
 *  2. 🎥 撮影 → today it is an MV: pick the song (yesterday's)
 *  3. tell {bati} what you want to see (speak / type / pick / おまかせ) → mana asked → {bati} makes the MV
 *  4. ▶ watch it first → 〔🔒 裏スタジオにしまう〕 (only you can see it; 〔🛸 届ける〕 is the next journey)
 * The lines are this app's (the story left D07-S004〜S005 to the UI); ヒポキン is a film director (カット).
 */
type Phase = 'intro' | 'tabs' | 'studio' | 'song' | 'wish' | 'mana' | 'making' | 'failed' | 'made' | 'kept';
type Who = 'hipokin' | 'kimorin' | 'bati' | 'guide';
const WHO: Record<Who, { sprite?: string; name?: string }> = {
  hipokin: { sprite: 'hipokin', name: 'ヒポキン' },
  kimorin: { sprite: 'kimorin-sun', name: 'KIMORIN⭐︎' },
  bati: { name: 'バティ' },
  guide: {},
};
const WISHES = ['夜の海を、小さな船が進む', '夕焼けの街を、歩いていく', '星空の下で、踊る'];
const WAITING: { who: Who; text: string }[] = [
  { who: 'bati', text: '絵を30枚描くよ！　ちょっと時間かかるね！' },
  { who: 'kimorin', text: '……待つのは、得意ですよ。' },
  { who: 'kimorin', text: 'それは？' },
  { who: 'hipokin', text: '俺が初めて撮った映像だ。途中で止めたままだ。' },
];

export function MarsLesson({ api, song, neo, bati, batiImage, onDone }: { api: LessonApi; song: SongMade | null; neo: string; bati: string; batiImage?: string; onDone: (mv: MvMade) => void }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [k, setK] = useState(0);
  const [wish, setWish] = useState('');
  const [mv, setMv] = useState<MvMade | null>(null);
  const [wk, setWk] = useState(0);
  const [watched, setWatched] = useState(false);
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{bati}', bati);
  const line = (who: Who, text: string): CoachLine => ({ sprite: who === 'bati' ? batiImage : WHO[who].sprite, name: who === 'bati' ? bati : WHO[who].name, text: fill(text) });

  const make = async () => {
    if (!song) return;
    setPhase('making');
    setWk(0);
    const timer = setInterval(() => setWk((x) => Math.min(x + 1, WAITING.length - 1)), 9000);
    try {
      setMv(await api.mv(song, wish.trim()));
      setPhase('made');
    } catch {
      setPhase('failed');
    } finally {
      clearInterval(timer);
    }
  };

  const INTRO: { who: Who; text: string }[] = [
    { who: 'hipokin', text: '撮るのは、手元の画面だ。' },
    { who: 'kimorin', text: '……ふふ。私の出番ですね。' },
  ];
  let coach: CoachLine | null = null;
  let actions: React.ReactNode = null;
  if (phase === 'intro') {
    coach = line(INTRO[k].who, INTRO[k].text);
    actions = <NextButton onClick={() => (k < INTRO.length - 1 ? setK(k + 1) : setPhase('studio'))} />;
  } else if (phase === 'studio') {
    coach = line(k < 2 ? 'kimorin' : 'hipokin', k < 2 ? '……私のスタジオ、がらがらですね。' : 'そこは、撮ったあとに並ぶ所だ。撮るのは、真ん中の🎥 撮影。');
    actions = <NextButton onClick={() => (k < 2 ? setK(2) : setPhase('tabs'))} />;
  } else if (phase === 'tabs') coach = line('guide', '〔🎥 撮影〕をタップ');
  else if (phase === 'song') coach = line('hipokin', '今日は、MVだ。曲に、映像をつけるやつだ。');
  else if (phase === 'wish') coach = line('bati', 'どんな場面を見たい？　しゃべっても、打っても、選んでもいいよ。');
  else if (phase === 'mana') coach = line('bati', 'MVにするのに、マナを少し使うけど、いい？');
  else if (phase === 'making') coach = line(WAITING[wk].who, WAITING[wk].text);
  else if (phase === 'failed') coach = line('bati', 'フィルムが、ちょっと絡まっちゃった……。もう1回、撮ってもいい？');
  else if (phase === 'made') coach = line(watched ? 'hipokin' : 'bati', watched ? 'いい画だ。……しまうか、撮り直すか、お前が決めろ。' : `できたー！　${neo}が主役だよ！`);
  else if (phase === 'kept') {
    coach = line('hipokin', '人に届けるのは、次の旅からだ。');
    actions = <NextButton onClick={() => mv && onDone(mv)} />;
  }

  return (
    <LessonShell bg="/art/mars-studio.jpg" coach={coach} actions={actions}>
      {batiImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={batiImage} alt="" className="pointer-events-none absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-3 z-[170] h-16 w-16 rounded-2xl border-2 border-white/70 object-cover shadow-lg" aria-hidden />
      )}

      {(phase === 'studio' || phase === 'tabs') && (
        <Panel>
          {phase === 'studio' ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">🎬 myスタジオ（{neo}だけ）{'\n'}つくった映像は、ここに並びます</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button disabled className="rounded-2xl bg-slate-100 py-4 text-sm font-black text-slate-300">
                ✨ 星図
                <span className="block text-[10px] font-bold">二周目から</span>
              </button>
              <button onClick={() => setPhase(song ? 'song' : 'wish')} className="animate-pulse rounded-2xl bg-rose-500 py-4 text-sm font-black text-white shadow">
                🎥 撮影
              </button>
              <button onClick={() => setPhase('studio')} className="rounded-2xl bg-slate-100 py-4 text-sm font-black text-slate-500">
                🎬 myスタジオ
              </button>
            </div>
          )}
        </Panel>
      )}

      {phase === 'song' && song && (
        <Panel>
          <p className="text-center text-sm font-black text-rose-600">🎵 曲を選ぶ</p>
          <button onClick={() => setPhase('wish')} className="mt-3 flex w-full items-center gap-4 rounded-3xl bg-rose-50 p-3 text-left active:scale-[0.98]">
            <Record s={{ text: song.words, url: song.jacket }} playing={false} size={90} />
            <span>
              <span className="block text-xs text-rose-400">きのうの曲</span>
              <span className="block text-base font-black">{song.title}</span>
            </span>
          </button>
        </Panel>
      )}

      {phase === 'wish' && (
        <Panel>
          <VoiceField value={wish} onChange={setWish} placeholder="例：夜の海を、小さな船が進む" maxLength={60} multiline />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WISHES.map((w) => (
              <button key={w} onClick={() => setWish(w)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${wish === w ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600'}`}>
                {w}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <Big tone="rose" disabled={!wish.trim() || !song} onClick={() => setPhase('mana')}>
              これで撮る
            </Big>
            <Soft
              disabled={!song}
              onClick={() => {
                setWish('');
                setPhase('mana');
              }}
            >
              おまかせ
            </Soft>
          </div>
        </Panel>
      )}

      {phase === 'mana' && (
        <Panel>
          <div className="space-y-2">
            <Big tone="violet" onClick={() => void make()}>
              使う
            </Big>
            <Soft onClick={() => setPhase('wish')}>やめる</Soft>
          </div>
        </Panel>
      )}

      {(phase === 'making' || phase === 'failed') && (
        <Panel>
          {phase === 'making' ? (
            <p className="py-6 text-center text-sm font-bold text-rose-500">🎬 撮影中…（数分）　アプリを閉じても大丈夫</p>
          ) : (
            <Big tone="rose" onClick={() => void make()}>
              もう1回撮る
            </Big>
          )}
        </Panel>
      )}

      {phase === 'made' && mv && (
        <Panel>
          <p className="text-center text-sm font-black text-rose-600">{mv.title}</p>
          <video src={mv.url} poster={mv.poster ?? undefined} controls playsInline onPlay={() => setWatched(true)} className="mt-2 aspect-video w-full rounded-2xl bg-black object-contain" />
          <p className="mt-1 text-center text-[11px] text-slate-400">しまう前に、▶ で見てみよう</p>
          <div className="mt-3 space-y-2">
            <Big tone="rose" onClick={() => setPhase('kept')}>
              🔒 裏スタジオにしまう
            </Big>
            <Soft onClick={() => setPhase('wish')}>もう一回つくる</Soft>
            <Later label="🛸 届ける" />
          </div>
        </Panel>
      )}

      {phase === 'kept' && mv && (
        <Panel>
          <p className="text-center text-sm font-black text-rose-600">🔒 裏スタジオにしまいました。{neo}だけが見られます</p>
          <div className="mt-3 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">🎬 myスタジオ</p>
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
