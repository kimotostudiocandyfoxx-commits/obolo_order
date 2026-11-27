'use client';

import { CONSENT_TEXT, CONSENT_YEAR, MEDIA_CONSENT_VERSION, mediaAge, validBirthYear, type Me } from '@obolo/shared';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LegalSheet, type LegalKind } from '@/components/LegalText';
import { BIRTH_YEAR_KEY } from '@/components/onboarding/SealGate';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const KEY = 'obolo.consent';
const GKEY = 'obolo.consent.guardian';
/** M-R252: the branch without the photo and voice ('0'), and the year as answered on the start screen ('' = no answer) */
const MKEY = 'obolo.consent.media';
const YKEY = 'obolo.consent.year';

/** what the start screen decided */
export interface ConsentChoice {
  /** 13〜15: 〔保護者の人が同意しました〕 */
  guardian: boolean;
  /** false: the photo and voice are not used (under 13, or 13〜15 without the guardian) */
  media: boolean;
  /** the year chosen (client 2026-11-27: always one — the buttons only come once a year is chosen) */
  birthYear: number | null;
}

/** the agreement given on this device before the account existed (sent once the account is made) */
export function localConsent(): string | null {
  try {
    return localStorage.getItem(KEY) === MEDIA_CONSENT_VERSION ? MEDIA_CONSENT_VERSION : null;
  } catch {
    return null;
  }
}
function localChoice(): ConsentChoice {
  try {
    const y = Number(localStorage.getItem(YKEY));
    return { guardian: localStorage.getItem(GKEY) === MEDIA_CONSENT_VERSION, media: localStorage.getItem(MKEY) !== '0', birthYear: y || localBirthYear() };
  } catch {
    return { guardian: false, media: false, birthYear: null };
  }
}
function keepLocal(c: ConsentChoice) {
  try {
    localStorage.setItem(KEY, MEDIA_CONSENT_VERSION);
    if (c.guardian) localStorage.setItem(GKEY, MEDIA_CONSENT_VERSION);
    else localStorage.removeItem(GKEY);
    localStorage.setItem(MKEY, c.media ? '1' : '0');
    localStorage.setItem(YKEY, c.birthYear ? String(c.birthYear) : '');
    // the birth year is kept the way day 1 keeps it (the seal, M-R150), sent as users.onboarding_json.birthYear
    if (c.birthYear) localStorage.setItem(BIRTH_YEAR_KEY, String(c.birthYear));
  } catch {
    /* private mode: asked again next time */
  }
}
function storedYear(): string {
  try {
    return localStorage.getItem(BIRTH_YEAR_KEY) ?? '';
  } catch {
    return '';
  }
}

/** the year chosen on this device (the start screen, or the seal), null = none yet */
export function localBirthYear(): number | null {
  try {
    const y = Number(localStorage.getItem(YKEY)) || Number(localStorage.getItem(BIRTH_YEAR_KEY));
    return validBirthYear(y) ? y : null;
  } catch {
    return null;
  }
}

/** the agreement on the account is the current one */
export const agreedNow = (me: Pick<Me, 'consent'> | null | undefined) => me?.consent?.version === MEDIA_CONSENT_VERSION;
/**
 * client 2026-11-27: the account may go on — it agreed to the current words AND has its birth year. An account from
 * before with no year (it chose 〔答えない・分からない〕, or was made before the year was asked) is asked again.
 */
export const readyNow = (me: Pick<Me, 'consent' | 'birthYear'> | null | undefined) => agreedNow(me) && !!me?.birthYear;

/**
 * M-R247 / M-R252: the one agreement at the start of the app, before day 1 (the story itself explains nothing). The
 * words are the draft's (docs/legal/同意の画面と規約の下書き.md; shared legal.ts), word for word:
 *  1-1 「生まれた年を教えてください」〔年を選ぶ〕 (skipped when the account has one). Client 2026-11-27: there is no
 *      〔答えない・分からない〕 — nothing below shows until a year is chosen, so nobody goes on without one;
 *  1-2 by age (mediaAge): 16+ 〔利用規約〕〔プライバシーについて〕 (the full text over this screen), 〔同意してはじめる〕;
 *      13〜15 the guardian line, 〔保護者の人が同意しました〕 (as 16+) or 〔保護者の同意なしではじめる〕 (no
 *      photo, no voice); under 13 the one line and 〔はじめる〕 (no photo, no voice).
 * iPad feedback: the three summary lines (CONSENT_TEXT.adult) are no longer shown — the client: they mean nothing before
 * the user knows the app, and other SNS apps don't say them; the same points stay in the terms and the privacy text.
 * What is recorded is unchanged (version, guardian, media, birthYear).
 * The server keeps the branch (POST /me/consent `media`) and decides by it and the birth year (canUseMedia).
 * PLACEHOLDER (P-LEGAL-1/2): the texts are drafts; the wording and the flow are checked by a specialist before launch.
 */
export function ConsentPanel({ onAgree, busy = false, knownYear = null }: { onAgree: (c: ConsentChoice) => void; busy?: boolean; knownYear?: number | null }) {
  const [year, setYear] = useState(knownYear ? String(knownYear) : '');
  // a year chosen on this device before (the seal, or this screen) comes back chosen
  useEffect(() => {
    if (!knownYear) setYear((y) => y || storedYear());
  }, [knownYear]);
  const [sheet, setSheet] = useState<LegalKind | null>(null);
  const thisYear = new Date().getFullYear();
  const birthYear = validBirthYear(Number(year)) ? Number(year) : null;
  const age = birthYear ? mediaAge(birthYear) : null;
  const agree = (c: Omit<ConsentChoice, 'birthYear'>) => onAgree({ ...c, birthYear });
  const btn = 'w-full rounded-full border py-3.5 text-[16px] tracking-widest disabled:opacity-40';
  const main = `${btn} border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 text-amber-50 shadow-[0_0_24px_rgba(255,210,130,0.25)]`;
  const sub = `${btn} border-white/25 text-[14px] text-amber-50/80`;
  const lines = (ls: readonly string[]) => (
    <ul className="space-y-3 text-[14px] leading-relaxed">
      {ls.map((p) => (
        <li key={p} className="flex gap-2">
          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-amber-200/80" aria-hidden />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
  const links = (
    <p className="mt-5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[13px]">
      <button type="button" onClick={() => setSheet('terms')} className="text-amber-200/90 underline underline-offset-4">
        {CONSENT_TEXT.terms}
      </button>
      <button type="button" onClick={() => setSheet('privacy')} className="text-amber-200/90 underline underline-offset-4">
        {CONSENT_TEXT.privacy}
      </button>
      <a href="/tokushoho" target="_blank" rel="noopener" className="text-amber-200/90 underline underline-offset-4">
        特定商取引法に基づく表記
      </a>
    </p>
  );
  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[radial-gradient(130%_70%_at_50%_0%,#1d2a52_0%,#0b1027_55%,#05060f_100%)] px-6 text-amber-50" style={{ fontFamily: SERIF }}>
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center py-10">
        <p className="text-center text-[13px] tracking-[0.4em] text-amber-200/70">{CONSENT_TEXT.title}</p>
        {!knownYear && (
          <label className="mt-6 block text-[14px] tracking-[0.08em] text-amber-50/90">
            {CONSENT_YEAR.ask}
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-2 block w-full rounded-full border border-amber-200/50 bg-black/60 px-4 py-2.5 text-[15px] text-amber-50"
              aria-label={CONSENT_YEAR.ask}
            >
              <option value="">{CONSENT_YEAR.pick}</option>
              {Array.from({ length: 90 }, (_, k) => thisYear - 3 - k).map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </label>
        )}
        {age === 'adult' && (
          <div className="mt-6">
            {links}
            <button type="button" disabled={busy} onClick={() => agree({ guardian: false, media: true })} className={`${main} mt-7`}>
              {CONSENT_TEXT.agree}
            </button>
          </div>
        )}
        {age === 'teen' && (
          <div className="mt-6">
            {lines([CONSENT_TEXT.teen])}
            {links}
            <button type="button" disabled={busy} onClick={() => agree({ guardian: true, media: true })} className={`${main} mt-7`}>
              {CONSENT_TEXT.guardianAgreed}
            </button>
            <button type="button" disabled={busy} onClick={() => agree({ guardian: false, media: false })} className={`${sub} mt-3`}>
              {CONSENT_TEXT.noGuardian}
            </button>
          </div>
        )}
        {age === 'under13' && (
          <div className="mt-6">
            {lines([CONSENT_TEXT.under13])}
            <button type="button" disabled={busy} onClick={() => agree({ guardian: false, media: false })} className={`${main} mt-7`}>
              {CONSENT_TEXT.start}
            </button>
          </div>
        )}
      </div>
      {sheet && <LegalSheet kind={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** before the account exists (the invitation's day 1): kept on this device, sent right after the account is made */
export function agreeLocally(c: ConsentChoice) {
  keepLocal(c);
}

/** send the agreement given on this device (after the account is made); quiet when there is none or it fails */
export async function sendLocalConsent() {
  const v = localConsent();
  if (!v) return null;
  const c = localChoice();
  return getApi()
    .consent(v, c.guardian, { media: c.media, birthYear: c.birthYear })
    .catch(() => null);
}

/** pages that never ask (the invitation asks itself; the team's review pages play without an account of their own; the texts themselves) */
const QUIET = /^\/(invite|kakunin-|tameshi-|admin|terms|privacy|tokushoho)/;

/**
 * members who have not agreed to the current words yet (an account from before M-R247 / M-R252), or who have no birth
 * year (client 2026-11-27: nobody goes on without one): the start screen over the app, once
 */
export function ConsentGate() {
  const { me, setMe } = useAuth();
  const path = usePathname() ?? '';
  const [busy, setBusy] = useState(false);
  if (!me || readyNow(me) || QUIET.test(path)) return null;
  return (
    <ConsentPanel
      busy={busy}
      knownYear={me.birthYear ?? null}
      onAgree={async (c) => {
        setBusy(true);
        keepLocal(c);
        try {
          setMe(await getApi().consent(MEDIA_CONSENT_VERSION, c.guardian, { media: c.media, birthYear: c.birthYear }));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
