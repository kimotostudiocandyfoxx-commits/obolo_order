'use client';

import { LEGAL_DRAFT_NOTE, legalText, PRIVACY_DRAFT, PRIVACY_TITLE, TERMS_DRAFT, TERMS_TITLE } from '@obolo/shared';
import { useAuth } from '@/lib/auth';

export type LegalKind = 'terms' | 'privacy';

/**
 * M-R252: the full text of 〔利用規約〕 / 〔プライバシーについて〕 — the draft's points word for word (shared legal.ts).
 * PLACEHOLDER (P-LEGAL-1): drafts until a specialist has checked them; the contact is blank.
 */
export function LegalText({ kind }: { kind: LegalKind }) {
  const { me } = useAuth();
  const items = kind === 'terms' ? TERMS_DRAFT : PRIVACY_DRAFT;
  const bati = me?.bati?.name;
  return (
    <article>
      <h1 className="text-lg font-black">{kind === 'terms' ? TERMS_TITLE : PRIVACY_TITLE}</h1>
      <p className="mt-1 text-[11px] text-white/45">{LEGAL_DRAFT_NOTE}</p>
      <ol className="mt-4 space-y-4">
        {items.map((it, i) => (
          <li key={it.title} className="text-[14px] leading-relaxed">
            <p className="font-bold text-amber-100">
              {i + 1}. {it.title}
            </p>
            <p className="mt-1 text-white/80">{legalText(it.body, bati)}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}

/** the full text over the start screen (the agreement stays as it was underneath) */
export function LegalSheet({ kind, onClose }: { kind: LegalKind; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[210] flex flex-col bg-[#070a18]/97 text-white" role="dialog" aria-modal="true">
      <div className="pt-safe flex-1 overflow-y-auto px-5 pb-6 pt-6">
        <div className="mx-auto max-w-md">
          <LegalText kind={kind} />
        </div>
      </div>
      <div className="pb-safe border-t border-white/10 px-5 py-3">
        <button type="button" onClick={onClose} className="mx-auto block w-full max-w-md rounded-full border border-white/25 py-3 text-[15px] text-white/85">
          とじる
        </button>
      </div>
    </div>
  );
}
