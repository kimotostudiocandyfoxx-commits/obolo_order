'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { PatapataWorld } from '@/components/jupiter/PatapataWorld';
import { MarsWorld } from '@/components/mars/MarsWorld';
import { VenusWorld } from '@/components/venus/VenusWorld';
import { MercuryWorld } from '@/components/mercury/MercuryWorld';
import { KororinWorld } from '@/components/saturn/KororinWorld';
import { DemoDay, previewMade } from '@/components/onboarding/DemoDay';
import { neoForm } from '@obolo/shared';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { demoBati } from '@/lib/look';
import { DEFAULT_SKIP_LABEL, PREVIEW_ONLY, STORIES } from '@/lib/onboarding/stories';
import { TomorrowScreen } from '@/components/onboarding/TomorrowScreen';

/**
 * /kakunin-5798f28713/play?day=N[&at=<step type>][&timeup=1][&gate=1: the seal E-0 every time] — plays one day's story from the start (or from its first
 * step of that type, e.g. at=jupiter) with a test name. Logged in, it runs as the members get it (the look, Bati and
 * the talk with Bati for real, saved to that account); otherwise with the browser's stand-ins.
 * timeup=1: the 88 minutes of space time run out 20 seconds in (SYS-S001).
 * thru=N: each day ends on the members' own 「また明日」 screen (the 24-hour countdown, 〔明日まで待てない〕 and the clock that
 * skips it), which opens the next day, up to day N (e.g. day=1&thru=3: from the start to Saturn).
 * /kakunin-5798f28713/play?world=jupiter | saturn | mercury | mars | venus — that planet's world on its own.
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
  const [timeUp, setTimeUp] = useState(false);
  // logged in to the real API: the look and Bati are painted for real (Gemini) and saved to the account,
  // like a member's first journey; otherwise demo pictures drawn in the browser
  const { me, status, setMe } = useAuth();
  // the name typed on Day 1 (story chat 2026-10-29: never another name in captions or voices): logged in it becomes
  // the account's name, as for the members; otherwise this browser keeps it for the next days
  const [typed, setTyped] = useState<string | null>(null);
  useEffect(() => {
    try {
      setTyped(sessionStorage.getItem('kakunin.name'));
    } catch {}
  }, []);
  const onName = async (n: string) => {
    setTyped(n);
    try {
      sessionStorage.setItem('kakunin.name', n);
    } catch {}
    if (getApi().mode === 'live' && me) setMe(await getApi().updateMe({ displayName: n }));
  };
  const live = getApi().mode === 'live' && !!me && q.get('demo') !== '1';
  const name = (live && me ? me.displayName : typed) || 'あなた';
  const guest = getApi().mode === 'live' && status === 'guest' && q.get('demo') !== '1';
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
  // thru=N: played straight through, each day handing over to the next up to day N (the client's check from the start to Saturn)
  const thru = Number(q.get('thru') ?? 0);
  // every day that has a next one ends on the countdown (client 2026-10-29: also from day 2 to day 3); thru=N stops at day N
  const upTo = thru || 99;
  const nextDay = upTo > day && STORIES[day + 1] ? `/kakunin-5798f28713/play?day=${day + 1}${thru ? `&thru=${thru}` : ''}` : null;
  if (ended && nextDay)
    return (
      <TomorrowScreen
        name={name}
        completedAt={null}
        skipLabel={STORIES[day]?.skipLabel ?? DEFAULT_SKIP_LABEL}
        skippedText={STORIES[day]?.skippedText}
        onUnlocked={() => window.location.assign(nextDay)}
      />
    );
  if (ended)
    return (
      <Ended
        text={`${day}日目 おわり`}
        again={`/kakunin-5798f28713/play?day=${day}${at ? `&at=${at}` : ''}${thru ? `&thru=${thru}` : ''}${q.get('gate') === '1' ? '&gate=1' : ''}`}
      />
    );

  // at=<step type> (its first step) or i=<step index>
  const start = q.get('i') ? Number(q.get('i')) : at ? Math.max(0, story.steps.findIndex((s) => s.t === at)) : 0;
  return (
    <>
      <DemoDay
        key={`${day}-${at}`}
        day={day}
        steps={story.steps}
        start={start}
        live={live}
        showGate={q.get('gate') === '1'}
        timeUp={timeUp}
        onTimeUp={() => setEnded(true)}
        onNeoForm={(id) => setNeo(id)}
        onName={(n) => void onName(n)}
        onEnd={() => setEnded(true)}
        vars={{
          name,
          inviter: live && me?.invitedByName ? me.invitedByName : '木元 駿之介',
          inviterMessage: q.get('msg') === '0' ? undefined : '宇宙で待ってる✌️ウヒョヒョ',
          // logged in: the member's own NEO and Bati (made for real on the Moon), like the members' journey
          neo: live && me && day >= 3 ? me.displayName : (neoForm(neo)?.name ?? (day >= 3 ? 'ミナト⭐︎' : undefined)),
          batiFood: live && me?.bati ? me.bati.food : day >= 3 ? 'ラーメン' : undefined,
          bati: live && me?.bati?.name ? me.bati.name : day >= 3 ? 'ぽん' : undefined,
          batiImage: live && me?.bati?.imageUrl ? me.bati.imageUrl : day >= 3 ? demoBati('ラーメン') : undefined,
          batiFaces: live ? me?.bati?.faces : undefined,
          look: live ? (me?.avatarUrl ?? undefined) : undefined,
          lookChibi: live ? (me?.lookChibi ?? undefined) : undefined,
          lookStandee: live ? (me?.lookStandee ?? undefined) : undefined,
          kimorinStar: day >= 3,
          made: previewMade(day),
          story: { 'd1.choice1': '行きたい', 'd1.f_d01_talk': '話を聞いてみる' },
        }}
      />
      <BackLink live={live} />
      {guest && <GuestNote />}
    </>
  );
}

/**
 * The real API but nobody logged in on this browser: the mic works, but the look, Bati and the talk with Bati are
 * the browser's stand-ins (story chat 2026-10-29: check it as the members get it — log in first, then come back).
 */
function GuestNote() {
  const [shut, setShut] = useState(false);
  if (shut) return null;
  return (
    <div className="fixed inset-x-3 top-[calc(40px+env(safe-area-inset-top))] z-[400] rounded-xl bg-black/75 px-3 py-2 text-center text-[11px] leading-relaxed text-amber-50 backdrop-blur">
      いまは仮の絵で動いています（姿の絵・バティ・バティとのおしゃべり）。本番と同じにするには、
      <a href="/" className="font-bold underline">
        先にログイン
      </a>
      してから、このページを開きなおしてください（作ったものは、そのアカウントに残ります）
      <button onClick={() => setShut(true)} className="ml-2 text-white/50" aria-label="とじる">
        ✕
      </button>
    </div>
  );
}

function BackLink({ live }: { live?: boolean }) {
  return (
    <Link href="/kakunin-5798f28713" className="fixed left-1/2 top-[calc(10px+env(safe-area-inset-top))] z-[400] -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[10px] text-white/60 backdrop-blur">
      ← 確認用ページ{live ? '・本番生成' : ''}
    </Link>
  );
}

function Ended({ text, again, next }: { text: string; again?: string; next?: { href: string; label: string } }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[#07060d] text-white">
      <p className="tracking-[0.3em] text-amber-100">{text}</p>
      {next && (
        <a href={next.href} className="rounded-full bg-gradient-to-b from-amber-300 to-orange-500 px-7 py-3 text-[15px] font-bold text-white shadow-lg">
          {next.label}
        </a>
      )}
      {again && (
        <a href={again} className="rounded-full border border-amber-200/40 px-5 py-2 text-sm">
          もう一度
        </a>
      )}
      <Link href="/kakunin-5798f28713" className="text-sm text-white/60 underline">
        確認用ページへもどる
      </Link>
    </main>
  );
}
