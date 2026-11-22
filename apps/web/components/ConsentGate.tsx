'use client';

import { CONSENT_POINTS, GUARDIAN_POINT, MEDIA_CONSENT_VERSION } from '@obolo/shared';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const KEY = 'obolo.consent';
const GKEY = 'obolo.consent.guardian';

/** the agreement given on this device before the account existed (sent once the account is made) */
export function localConsent(): string | null {
  try {
    return localStorage.getItem(KEY) === MEDIA_CONSENT_VERSION ? MEDIA_CONSENT_VERSION : null;
  } catch {
    return null;
  }
}
/** M-R248: the guardian's line was ticked on this device (13〜15) */
function localGuardian(): boolean {
  try {
    return localStorage.getItem(GKEY) === MEDIA_CONSENT_VERSION;
  } catch {
    return false;
  }
}
function keepLocal(guardian = false) {
  try {
    localStorage.setItem(KEY, MEDIA_CONSENT_VERSION);
    if (guardian) localStorage.setItem(GKEY, MEDIA_CONSENT_VERSION);
    else localStorage.removeItem(GKEY);
  } catch {
    /* private mode: asked again next time */
  }
}

/**
 * M-R247: the one agreement at the start of the app — the terms of use and the privacy policy, with what photos and
 * voice are used for (the member's look and {bati} only, never anything else; deletable in the settings). It is the
 * consent the voice model needs (the story's egg scene shows no explanation: only a small ⓘ by the mic).
 * M-R248: one more line to tick for 13〜15 — a guardian agreed to the photo and voice being used (kept with the version).
 * Under 13 (or no birth year) the photo and voice are never used, whatever is ticked; the server decides by the birth year.
 * PLACEHOLDER (P-LEGAL-1): the terms and the privacy policy themselves are not written yet (only their names here); the
 * wording and the flow are checked by a specialist before launch.
 */
export function ConsentPanel({ onAgree, busy = false }: { onAgree: (guardian: boolean) => void; busy?: boolean }) {
  const [guardian, setGuardian] = useState(false);
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[radial-gradient(130%_70%_at_50%_0%,#1d2a52_0%,#0b1027_55%,#05060f_100%)] px-6 text-amber-50" style={{ fontFamily: SERIF }}>
      <div className="w-full max-w-sm">
        <p className="text-center text-[13px] tracking-[0.4em] text-amber-200/70">はじめる前に</p>
        <ul className="mt-6 space-y-3 text-[14px] leading-relaxed">
          {CONSENT_POINTS.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-amber-200/80" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <label className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] leading-relaxed text-amber-50/85">
          <input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-300" />
          <span>{GUARDIAN_POINT}</span>
        </label>
        <p className="mt-1.5 text-[10px] leading-relaxed text-white/40">13歳未満の人の写真と声は使いません。</p>
        <p className="mt-3 text-[11px] text-white/45">利用規約・プライバシーポリシー（本文は準備中）</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAgree(guardian)}
          className="mt-8 w-full rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 py-3.5 text-[16px] tracking-widest text-amber-50 shadow-[0_0_24px_rgba(255,210,130,0.25)] disabled:opacity-40"
        >
          同意してはじめる
        </button>
      </div>
    </div>
  );
}

/** before the account exists (the invitation's day 1): kept on this device, sent right after the account is made */
export function agreeLocally(guardian = false) {
  keepLocal(guardian);
}

/** send the agreement given on this device (after the account is made); quiet when there is none or it fails */
export async function sendLocalConsent() {
  const v = localConsent();
  if (!v) return null;
  return getApi()
    .consent(v, localGuardian())
    .catch(() => null);
}

/** pages that never ask (the invitation asks itself; the team's review pages play without an account of their own) */
const QUIET = /^\/(invite|kakunin-|tameshi-|admin)/;

/** members who have not agreed yet (an account from before M-R247): the agreement over the app, once */
export function ConsentGate() {
  const { me, setMe } = useAuth();
  const path = usePathname() ?? '';
  const [busy, setBusy] = useState(false);
  if (!me || me.consent || QUIET.test(path)) return null;
  return (
    <ConsentPanel
      busy={busy}
      onAgree={async (guardian) => {
        setBusy(true);
        keepLocal(guardian);
        try {
          setMe(await getApi().consent(MEDIA_CONSENT_VERSION, guardian));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
