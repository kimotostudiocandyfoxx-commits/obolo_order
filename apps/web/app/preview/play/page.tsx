'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { PatapataWorld } from '@/components/jupiter/PatapataWorld';
import { MarsWorld } from '@/components/mars/MarsWorld';
import { VenusWorld } from '@/components/venus/VenusWorld';
import { MercuryWorld } from '@/components/mercury/MercuryWorld';
import { KororinWorld } from '@/components/saturn/KororinWorld';
import { StoryPlayer } from '@/components/onboarding/StoryPlayer';
import { neoForm } from '@obolo/shared';
import { demoNeoLooks } from '@/lib/look';
import { STORIES } from '@/lib/onboarding/stories';

/**
 * /preview/play?day=N[&at=<step type>] — plays one day's story from the start (or from its first
 * step of that type, e.g. at=jupiter) with a test name. Nothing is saved to the account.
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
  const [cands, setCands] = useState<{ id: string; url: string }[]>([]);

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

  const story = STORIES[day];
  if (!story) return <Ended text="その日のストーリーはまだありません" />;
  if (ended) return <Ended text={`${day}日目 おわり`} again={`/preview/play?day=${day}${at ? `&at=${at}` : ''}`} />;

  const start = at ? Math.max(0, story.steps.findIndex((s) => s.t === at)) : 0;
  return (
    <>
      <StoryPlayer
        key={`${day}-${at}`}
        steps={story.steps}
        vars={{ name: 'テスト', inviter: 'KIMORIN', neo: neoForm(neo)?.name, batiFood: day >= 4 ? 'ラーメン' : undefined }}
        initial={start > 0 ? { i: start, name: 'テスト', answers: {} } : null}
        onProgress={() => {}}
        onName={async () => {}}
        onNeo={async (id) => setNeo(id)}
        lookApi={{
          candidates: async (a) => {
            await new Promise((r) => setTimeout(r, 1500));
            const c = demoNeoLooks(a, round).map((url, k) => ({ id: `${round}-${k}`, url }));
            setCands(c);
            setRound(round + 1);
            return { candidates: c, triesLeft: Math.max(0, 2 - round) };
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
        onEnd={() => setTimeout(() => setEnded(true), 1200)}
      />
      <BackLink />
    </>
  );
}

function BackLink() {
  return (
    <Link href="/preview" className="fixed left-3 top-[calc(8px+env(safe-area-inset-top))] z-[400] rounded-full bg-black/45 px-3 py-1 text-xs text-white/80 backdrop-blur">
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
