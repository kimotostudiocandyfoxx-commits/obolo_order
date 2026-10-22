'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { PatapataWorld } from '@/components/jupiter/PatapataWorld';
import { MarsWorld } from '@/components/mars/MarsWorld';
import { VenusWorld } from '@/components/venus/VenusWorld';
import { MercuryWorld } from '@/components/mercury/MercuryWorld';
import { KororinWorld } from '@/components/saturn/KororinWorld';
import { StoryPlayer } from '@/components/onboarding/StoryPlayer';
import { knownSealsOn, solvedSealsOn, stampsOn } from '@/components/onboarding/StoryExtras';
import { neoForm } from '@obolo/shared';
import { demoBati, demoStickerArt, demoFromReference, demoNeoLooks, demoRefine } from '@/lib/look';
import type { LessonApi } from '@/lib/onboarding/lessonApi';
import type { Made } from '@/lib/onboarding/made';
import { PREVIEW_ONLY, STORIES } from '@/lib/onboarding/stories';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** No server: Bati's drawings are drawn here, the song is the opening BGM, the MV a story clip. */
const fakeLessonApi: LessonApi = {
  stickerArt: async (text) => {
    await wait(1500);
    return { url: await demoStickerArt(text) };
  },
  uploadPhoto: async (blob) => ({ url: URL.createObjectURL(blob) }),
  lyrics: async (words) => {
    await wait(1500);
    const line = (text: string) => ({ text, kana: text, notes: [] });
    return {
      title: words.slice(0, 12),
      emoji: '🎵',
      genre: 'pop',
      mood: 'bright',
      bpm: 112,
      keyRoot: 0,
      scale: 'major',
      progression: [0, 4, 5, 3],
      chords: ['C', 'G', 'Am', 'F'],
      sections: [
        { name: 'verse', lines: [line(words), line('きょうも、空を見上げてた')] },
        { name: 'chorus', lines: [line('ころがれ、ころがれ、星まで'), line(words)] },
      ],
      instrumentalPrompt: '',
      comment: 'できたよ！',
      seconds: 60,
    };
  },
  sing: async (d, onStage) => {
    onStage?.('singing');
    await wait(3000);
    onStage?.(null);
    return { id: 'preview-song', title: d.title, url: '/onboarding/bgm-opening.m4a' };
  },
  saveSong: async () => {},
  mv: async (song, _wish, lyrics) => {
    await wait(4000);
    return { id: 'preview-mv', url: '/onboarding/m3-3.mp4', poster: null, title: lyrics ? `${song.title}（歌詞つき）` : song.title };
  },
};

/** What the earlier days made, for previewing a day on its own. */
function previewMade(day: number): Made {
  const kororins = ['きょうの空、ひろかった', 'ラーメンの湯気がきれい', 'くしゃみ三回'];
  const stickers = [
    { text: kororins[0], url: null },
    { text: kororins[1], url: null },
  ];
  return {
    kororins: day >= 4 ? kororins : undefined,
    stickers: day >= 5 ? stickers : undefined,
    song: day >= 6 ? { id: 'preview-song', title: 'きょうの空', url: '/onboarding/bgm-opening.m4a', jacket: null, words: kororins[0] } : undefined,
    mv: day >= 7 ? { id: 'preview-mv', url: '/onboarding/m3-3.mp4', poster: null, title: 'きょうの空' } : undefined,
  };
}

/**
 * /preview/play?day=N[&at=<step type>][&timeup=1] — plays one day's story from the start (or from its first
 * step of that type, e.g. at=jupiter) with a test name. Nothing is saved to the account.
 * timeup=1: the 88 minutes of space time run out 20 seconds in (SYS-S001).
 * /preview/play?world=jupiter | saturn | mercury | mars | venus — that planet's world on its own.
 */
export default function PreviewPlayPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <PreviewPlay />
    </Suspense>
  );
}

function PreviewPlay() {
  const q = useSearchParams();
  const day = Number(q.get('day'));
  const at = q.get('at');
  const [ended, setEnded] = useState(false);
  const [neo, setNeo] = useState<string | undefined>(undefined);
  const [round, setRound] = useState(0);
  const [refines, setRefines] = useState(0);
  const [cands, setCands] = useState<{ id: string; url: string }[]>([]);
  const [ordered, setOrdered] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  useEffect(() => {
    if (q.get('timeup') !== '1') return;
    const t = setTimeout(() => setTimeUp(true), 20_000);
    return () => clearTimeout(t);
  }, [q]);

  if (q.get('world') === 'venus') {
    return (
      <div className="fixed inset-0">
        <VenusWorld />
        <BackLink />
      </div>
    );
  }
  if (q.get('world') === 'mars') {
    return (
      <div className="fixed inset-0">
        <MarsWorld />
        <BackLink />
      </div>
    );
  }
  if (q.get('world') === 'mercury') {
    return (
      <div className="fixed inset-0">
        <MercuryWorld />
        <BackLink />
      </div>
    );
  }
  if (q.get('world') === 'saturn') {
    return (
      <div className="fixed inset-0">
        <KororinWorld />
        <BackLink />
      </div>
    );
  }
  if (q.get('world') === 'jupiter') {
    return (
      <div className="fixed inset-0">
        <PatapataWorld />
        <BackLink />
      </div>
    );
  }

  const story = STORIES[day] ?? PREVIEW_ONLY[day];
  if (!story) return <Ended text="その日のストーリーはまだありません" />;
  if (ended) return <Ended text={`${day}日目 おわり`} again={`/preview/play?day=${day}${at ? `&at=${at}` : ''}`} />;

  // at=<step type> (its first step) or i=<step index>
  const start = q.get('i') ? Number(q.get('i')) : at ? Math.max(0, story.steps.findIndex((s) => s.t === at)) : 0;
  return (
    <>
      <StoryPlayer
        key={`${day}-${at}`}
        steps={story.steps}
        vars={{
          name: 'テスト',
          inviter: '木元 駿之介',
          inviterMessage: q.get('msg') === '0' ? undefined : '宇宙で待ってる✌️ウヒョヒョ',
          neo: neoForm(neo)?.name ?? (day >= 3 ? 'ミナト⭐︎' : undefined),
          batiFood: day >= 3 ? 'ラーメン' : undefined,
          bati: day >= 3 ? 'ぽん' : undefined,
          batiImage: day >= 3 ? demoBati('ラーメン') : undefined,
          kimorinStar: day >= 3,
          made: previewMade(day),
          story: { 'd1.choice1': '行きたい', 'd1.f_d01_talk': '話を聞いてみる' },
        }}
        lessonApi={fakeLessonApi}
        textOnly={day <= 3}
        seals={{ known: day >= 2 ? knownSealsOn(day) : [], solved: solvedSealsOn(day) }}
        stamps={stampsOn(day)}
        timeUp={timeUp}
        onTimeUp={() => setEnded(true)}
        onNeoName={async () => {}}
        initial={start > 0 ? { i: start, name: 'テスト', answers: {} } : null}
        onProgress={() => {}}
        onName={async () => {}}
        onNeo={async (id) => setNeo(id)}
        lookApi={{
          candidates: async (a) => {
            await new Promise((r) => setTimeout(r, 1500));
            const urls =
              'reference' in a
                ? await Promise.all([0, 1, 2, 3].map((k) => demoFromReference(`data:${a.reference.mime};base64,${a.reference.data}`, a, k + round * 4)))
                : 'like' in a
                  ? await Promise.all([0, 1, 2, 3].map((k) => demoRefine(cands.find((c) => c.id === a.like)?.url ?? '', '', k + round * 4)))
                  : demoNeoLooks('animal' in a ? a : { animal: 'おまかせ', color: 'おまかせ', mood: 'おまかせ' }, round);
            const c = urls.map((url, k) => ({ id: `${round}-${k}`, url }));
            setCands((x) => [...x, ...c]);
            setRound(round + 1);
            return { candidates: c, triesLeft: Math.max(0, 2 - round), refinesLeft: 3 - refines };
          },
          refine: async (id, instruction) => {
            await new Promise((r) => setTimeout(r, 1200));
            const src = cands.find((c) => c.id === id);
            const c = { id: `r${refines}`, url: await demoRefine(src?.url ?? '', instruction, refines) };
            setCands((x) => [...x, c]);
            setRefines(refines + 1);
            return { candidates: [c], triesLeft: Math.max(0, 3 - round), refinesLeft: 2 - refines };
          },
          choose: async (id) => cands.find((c) => c.id === id)?.url ?? '',
          chooseForm: async (id) => setNeo(id),
        }}
        onEgg={async () => {}}
        onHatch={async () => {
          await new Promise((r) => setTimeout(r, 1500));
          return '';
        }}
        onBatiName={async () => {}}
        ordered={ordered}
        orderApi={{
          checkout: async () => ({ mode: 'demo' }),
          confirm: async () => {},
          demo: async () => {
            await new Promise((r) => setTimeout(r, 800));
            setOrdered(true);
          },
        }}
        onEnd={() => setTimeout(() => setEnded(true), 1200)}
      />
      <BackLink />
    </>
  );
}

function BackLink() {
  return (
    <Link href="/preview" className="fixed left-1/2 top-[calc(10px+env(safe-area-inset-top))] z-[400] -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[10px] text-white/60 backdrop-blur">
      ← 確認用ページ
    </Link>
  );
}

function Ended({ text, again }: { text: string; again?: string }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[#07060d] text-white">
      <p className="tracking-[0.3em] text-amber-100">{text}</p>
      {again && (
        <a href={again} className="rounded-full border border-amber-200/40 px-5 py-2 text-sm">
          もう一度
        </a>
      )}
      <Link href="/preview" className="text-sm text-white/60 underline">
        確認用ページへもどる
      </Link>
    </main>
  );
}
