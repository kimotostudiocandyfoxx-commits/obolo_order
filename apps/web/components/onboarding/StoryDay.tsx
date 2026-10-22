'use client';

import { JOURNEY_PAYMENT } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { StoryPlayer, type StoryProgress } from '@/components/onboarding/StoryPlayer';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n/client';
import { demoBati } from '@/lib/look';
import { realLessonApi } from '@/lib/onboarding/lessonApi';
import { madeFrom } from '@/lib/onboarding/made';
import { clearDay, loadDay, saveDay } from '@/lib/onboarding/progress';
import type { DayStory } from '@/lib/onboarding/stories';
import { clearLookDraft } from './LookMaker';
import { knownSealsOn, solvedSealsOn, stampsOn } from './StoryExtras';

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/**
 * The day's space time (SYS-S001, story 2026-10-14): Bluena works 88 minutes a day; after that MONBAN
 * calls you back to Earth and the day's story continues tomorrow from the same scene.
 * M-R22: counted from the day's first rocket departure (a 'clock' step in the script), not in the temples
 * of Earth and the Moon; nothing is shown. PLACEHOLDER (P-SPACE-88): only while the story screen is open and
 * visible, per calendar day on this device. The day after a cut-off starts with the email check again, from
 * the scene that was cut.
 */
const SPACE_MINUTES = 88;
const today = () => new Date().toLocaleDateString('sv-SE');
function useSpaceClock(userId: string | undefined, on: boolean, running: boolean) {
  const key = `obolo.space.${userId}`;
  const read = useCallback((): { date: string; ms: number; over: boolean } => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? 'null') as { date: string; ms: number; over: boolean } | null;
      return v && v.date === today() ? v : { date: today(), ms: 0, over: false };
    } catch {
      return { date: today(), ms: 0, over: false };
    }
  }, [key]);
  const write = useCallback(
    (v: { date: string; ms: number; over: boolean }) => {
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  const [state, setState] = useState({ timeUp: false, over: false });
  const runningRef = useRef(running);
  runningRef.current = running;
  useEffect(() => {
    if (!on || !userId) return;
    const v = read();
    setState({ timeUp: v.ms >= SPACE_MINUTES * 60_000, over: v.over });
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const step = Math.min(now - last, 10_000);
      last = now;
      if (document.visibilityState !== 'visible' || !runningRef.current) return;
      const cur = read();
      const next = { ...cur, ms: cur.ms + step };
      write(next);
      if (next.ms >= SPACE_MINUTES * 60_000) setState((s) => ({ ...s, timeUp: true }));
      if (!next.over) setState((s) => (s.over ? { ...s, over: false } : s));
    }, 5_000);
    return () => clearInterval(id);
  }, [on, userId, read, write]);
  const finish = useCallback(() => {
    write({ ...read(), over: true });
    try {
      localStorage.setItem(`${key}.cut`, today());
    } catch {
      /* ignore */
    }
    setState({ timeUp: true, over: true });
  }, [read, write, key]);
  /** the last day was cut by the 88 minutes (on an earlier date): ask for the email code again */
  const cutBefore = useCallback(() => {
    try {
      const d = localStorage.getItem(`${key}.cut`);
      return !!d && d !== today();
    } catch {
      return false;
    }
  }, [key]);
  const clearCut = useCallback(() => {
    try {
      localStorage.removeItem(`${key}.cut`);
    } catch {
      /* ignore */
    }
  }, [key]);
  return { ...state, finish, cutBefore, clearCut };
}

/** A scripted journey day (2+): [認証] → story → (HomeGate shows the "また明日" countdown). */
export function StoryDay({ day, story }: { day: number; story: DayStory }) {
  const { me, setMe } = useAuth();
  const [saved, setSaved] = useState<StoryProgress | null | undefined>(undefined);
  const [passed, setPassed] = useState(false);
  // the clock runs only between 'clock' steps (from the first rocket of the day; not in the temples)
  const [clockOn, setClockOn] = useState(false);
  const space = useSpaceClock(me?.id, day >= 3, clockOn);

  useEffect(() => {
    if (!me) return;
    const s = loadDay(day, me.id);
    setSaved(s);
    // Re-opening mid-story does not ask for the code again — except the day after the 88 minutes ran out
    if (!story.auth || (s && s.i > 0 && !space.cutBefore())) setPassed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, me, story.auth]);

  const onProgress = useCallback((p: StoryProgress) => me && saveDay(day, me.id, p), [day, me]);
  const onEnd = useCallback(
    (answers: Record<string, string>) => {
      if (!me) return;
      setTimeout(async () => {
        try {
          const done = await getApi().completeJourneyDay(day, answers);
          // the Eclipse day ends as an ORDER: no 24-hour wait after it
          setMe(day === JOURNEY_PAYMENT ? await getApi().advanceJourney(true) : done);
        } finally {
          clearDay(day, me.id);
          clearLookDraft();
        }
      }, 1500);
    },
    [day, me, setMe],
  );

  if (!me || saved === undefined) return <div className="fixed inset-0 bg-black" />;
  if (space.over) return <SpaceOver />;
  if (!passed)
    return (
      <DayAuth
        onPassed={() => {
          space.clearCut();
          setPassed(true);
        }}
      />
    );
  return (
    <StoryPlayer
      steps={story.steps}
      vars={{
        name: me.displayName,
        inviter: me.invitedByName ?? '木元 駿之介',
        // from day 3 the display name is the NEO name (set on the Moon)
        neo: day >= 3 ? me.displayName : undefined,
        kimorinStar: day >= 3,
        bati: me.bati?.name ?? undefined,
        batiImage: me.bati?.imageUrl ?? undefined,
        batiFood: me.bati?.food,
        look: me.avatarUrl ?? undefined,
        story: me.story,
        made: madeFrom(me.story),
      }}
      lessonApi={realLessonApi}
      textOnly={day <= 3}
      // the riddle book: 1・7・8 from day 1; 2 (「表現者」) solved on day 3, Saturn
      seals={{ known: knownSealsOn(day), solved: solvedSealsOn(day) }}
      stamps={stampsOn(day)}
      onClock={setClockOn}
      timeUp={space.timeUp}
      onTimeUp={space.finish}
      initial={saved}
      onProgress={onProgress}
      onName={async (n) => {
        setMe(await getApi().updateMe({ displayName: n }));
      }}
      onNeoName={async (n) => {
        setMe(await getApi().updateMe({ displayName: n }));
      }}
      onNeo={async (id) => {
        setMe(await getApi().updateMe({ neoForm: id }));
      }}
      lookApi={{
        candidates: (a) => getApi().lookCandidates(a),
        refine: (id, instruction) => getApi().refineLook(id, instruction),
        choose: async (id) => {
          const u = await getApi().chooseLook(id);
          setMe(u);
          return u.avatarUrl ?? '';
        },
        chooseForm: async (id) => {
          setMe(await getApi().updateMe({ neoForm: id }));
        },
      }}
      onEgg={async (food) => {
        setMe(await getApi().batiEgg(food));
      }}
      onHatch={async () => {
        try {
          const u = await getApi().batiHatch();
          setMe(u);
          // if generation failed, a drawn Bati keeps the story going
          return u.bati?.imageUrl ?? demoBati(u.bati?.food ?? '');
        } catch {
          return demoBati(me.bati?.food ?? '');
        }
      }}
      onBatiName={async (n) => {
        setMe(await getApi().batiName(n));
      }}
      ordered={!!me.orderedAt}
      orderApi={{
        checkout: () => getApi().orderCheckout(),
        confirm: async (sessionId) => {
          setMe(await getApi().confirmOrder(sessionId));
        },
        demo: async () => {
          setMe(await getApi().becomeOrder());
        },
      }}
      onEnd={onEnd}
    />
  );
}

/** SYS-S001 afterwards: today's space time is over; tomorrow the story continues from the same scene. */
function SpaceOver() {
  return (
    <main className="pt-safe pb-safe flex min-h-svh flex-col items-center justify-center gap-3 bg-black px-8 text-center" style={{ fontFamily: SERIF }}>
      <span className="mb-4 h-3 w-3 rounded-full bg-sky-100 shadow-[0_0_40px_12px_rgba(140,200,255,0.45)]" />
      <p className="text-lg tracking-[0.2em] text-amber-100">今日の宇宙の時間は終わりです</p>
      <p className="text-sm text-white/60">次の日は、この場面の続きから</p>
    </main>
  );
}

/** [認証]: the member confirms their email with a one-time code before the day's story. */
function DayAuth({ onPassed }: { onPassed: () => void }) {
  const { m, t } = useI18n();
  const { me, signIn } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (email.trim().toLowerCase() !== me?.email.toLowerCase()) {
      setErr(m.entry.authMismatch);
      return;
    }
    setBusy(true);
    try {
      const r = await getApi().requestCode(email.trim());
      setDevCode(r.devCode ?? null);
      if (r.devCode && getApi().mode === 'demo') setCode(r.devCode);
      setStep('code');
    } catch {
      setErr(m.common.error);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await getApi().verify(email.trim(), code.trim());
      if (r.kind !== 'member' || r.user.id !== me?.id) throw new Error('mismatch');
      signIn(r.token, r.user);
      onPassed();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'CODE_INVALID' ? m.entry.wrongCode : m.entry.authMismatch);
      setBusy(false);
    }
  };

  const field =
    'rounded-full border border-amber-200/50 bg-black/60 px-6 py-3.5 text-center text-amber-50 outline-none placeholder:text-white/30 focus:border-amber-100';
  const button =
    'rounded-full border border-amber-200/70 bg-black px-6 py-3.5 tracking-[0.2em] text-amber-50 shadow-[0_0_24px_rgba(255,210,130,0.25)] disabled:opacity-40';

  return (
    <main className="pt-safe pb-safe flex min-h-svh flex-col items-center justify-center bg-black px-8 text-center" style={{ fontFamily: SERIF }}>
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-amber-200/30" />
        <span className="absolute inset-3 animate-[spin-slow_40s_linear_infinite] rounded-full border border-dashed border-amber-200/25" />
        <span className="h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_40px_12px_rgba(255,214,140,0.55)]" />
      </div>
      <span className="text-xs tracking-[0.6em] text-amber-200/70">{m.entry.authTitle}</span>
      {step === 'email' ? (
        <form onSubmit={send} className="mt-6 flex w-full max-w-xs animate-[fadeUp_0.8s_ease-out] flex-col gap-4">
          <p className="text-base tracking-wider text-amber-50">{m.entry.authLead}</p>
          <input
            className={field}
            style={{ fontSize: 16 }}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            placeholder="mail@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className={button} disabled={busy || !email}>
            {busy ? '……' : m.entry.next}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 flex w-full max-w-xs animate-[fadeUp_0.8s_ease-out] flex-col gap-4">
          <p className="text-sm text-white/70">{t(m.entry.codeSent, { email })}</p>
          {devCode && <p className="text-xs text-amber-200/80">{t(m.entry.demoCode, { code: devCode })}</p>}
          <input
            className={`${field} font-mono text-2xl tracking-[0.5em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button className={button} disabled={busy || code.length !== 6}>
            {busy ? '……' : m.entry.enter}
          </button>
        </form>
      )}
      {err && <p className="mt-4 max-w-xs text-sm text-rose-300">{err}</p>}
    </main>
  );
}
