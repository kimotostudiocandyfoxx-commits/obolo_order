'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { finishJob } from '@/components/atelier/makers';
import { onJobs, startJobPolling } from '@/lib/atelier/jobs';
import { useAuth } from '@/lib/auth';
import { batiLine, batiLineVoiceOf } from '@/lib/onboarding/batiLine';
import { usePartner } from '@/lib/partner';

type Toast = { id: string; jobId: string; text: string; title?: string };

/**
 * M-R253 §4: the slow works' host, in the app's layout — it watches the jobs started in the Moon atelier wherever you
 * are (another talk, another planet), finishes their cards, and when one is done shows a small toast at the top:
 * {bati}'s face and 「できたよ！」. A tap opens that card in the atelier. Outside the app the server's web push says it.
 */
export function JobToasts() {
  const { me } = useAuth();
  const partner = usePartner();
  const router = useRouter();
  const path = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const voice = partner.isBati ? batiLineVoiceOf(me?.bati) : undefined;

  useEffect(() => startJobPolling((w, job) => finishJob(w, job)), []);
  useEffect(
    () =>
      onJobs((e) => {
        if (!e || !e.w.toast || (e.kind !== 'done' && e.kind !== 'failed')) return;
        // PLACEHOLDER (P-ATELIER-10): {bati}'s words on the toast
        const text = batiLine(e.kind === 'done' ? 'できたよ！' : 'ごめん、うまく作れなかった', voice);
        const t: Toast = { id: `${e.job.id}-${e.kind}`, jobId: e.job.id, text, title: e.work?.title };
        setToasts((xs) => [t, ...xs.filter((x) => x.id !== t.id)].slice(0, 3));
        setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== t.id)), 7000);
      }),
    [voice],
  );

  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(8px+env(safe-area-inset-top))] z-[300] flex flex-col items-center gap-1.5 px-4" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          data-testid="job-toast"
          onClick={() => {
            setToasts((xs) => xs.filter((x) => x.id !== t.id));
            const url = `/moon/atelier?job=${t.jobId}`;
            if (path === '/moon/atelier') window.dispatchEvent(new CustomEvent('obolo:openjob', { detail: t.jobId }));
            else router.push(url);
          }}
          className="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-full border border-amber-200/40 bg-[rgba(16,22,64,.88)] py-1.5 pl-1.5 pr-4 text-left text-amber-50 shadow-[0_8px_24px_rgba(0,0,0,.45)] backdrop-blur-md"
          style={{ animation: 'talk-fly .5s cubic-bezier(.4,.1,.2,1) both' }}
        >
          <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-amber-200/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={partner.face} alt="" className="h-full w-full object-cover" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-tight">{t.text}</span>
            {t.title && <span className="block truncate text-[11px] text-amber-100/70">{t.title}</span>}
          </span>
          <span className="text-[11px] text-amber-200/80">ひらく</span>
        </button>
      ))}
    </div>
  );
}
