'use client';

import { NEO_FORMS, type NeoForm } from '@obolo/shared';
import { useState } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';

/** Emblem of a NEO form: the client's artwork (neo-<id>.webp) if present, else a placeholder. */
export function NeoEmblem({ form, size }: { form: NeoForm; size: number }) {
  const [art, setArt] = useState(true);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${form.color}55, #0b0910 70%)`,
        boxShadow: `0 0 ${size / 4}px ${form.color}66, inset 0 0 0 1px ${form.color}88`,
      }}
    >
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={spriteUrl(`neo-${form.id}`)}
          alt=""
          className="h-[88%] w-[88%] object-contain"
          onError={() => setArt(false)}
        />
      ) : (
        <span style={{ fontSize: size * 0.48 }} aria-hidden>
          {form.emoji}
        </span>
      )}
    </span>
  );
}

/**
 * Day 3: choose one of the eight OBOLO NEO forms (apprentice appearance).
 * PLACEHOLDER (P-NEO-1): placeholder emblems until the artwork arrives.
 */
export function NeoChooser({ onChoose }: { onChoose: (id: string) => Promise<void> }) {
  const [sel, setSel] = useState<NeoForm | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="pb-safe absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black via-black/85 to-black/30 px-5">
      <div className="mx-auto w-full max-w-md animate-[fadeUp_0.6s_ease-out]">
        <p className="text-center text-[11px] tracking-[0.5em] text-amber-200/70">OBOLO NEO</p>
        <div className="mt-3 flex min-h-40 flex-col items-center justify-center text-center">
          {sel ? (
            <>
              <NeoEmblem key={sel.id} form={sel} size={112} />
              <p className="mt-3 text-2xl tracking-[0.3em] text-amber-50">{sel.name}</p>
              <p className="mt-1 text-sm text-white/60">{sel.line}</p>
            </>
          ) : (
            <p className="text-base tracking-wider text-amber-50/90">ネオとしての姿を、ひとつ選ぶ</p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {NEO_FORMS.map((f) => (
            <button
              key={f.id}
              onClick={() => setSel(f)}
              className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition active:scale-95 ${
                sel?.id === f.id ? 'bg-amber-200/15 ring-1 ring-amber-200/70' : ''
              }`}
              aria-pressed={sel?.id === f.id}
            >
              <NeoEmblem form={f} size={56} />
              <span className="text-[11px] tracking-widest text-white/75">{f.name}</span>
            </button>
          ))}
        </div>
        <button
          disabled={!sel || busy}
          onClick={async () => {
            if (!sel) return;
            setBusy(true);
            try {
              await onChoose(sel.id);
            } finally {
              setBusy(false);
            }
          }}
          className="mb-8 mt-5 w-full rounded-full border border-amber-200/70 bg-black/50 px-6 py-3.5 text-[17px] tracking-[0.15em] text-amber-50 shadow-[0_0_24px_rgba(255,210,130,0.25)] disabled:opacity-35"
        >
          {busy ? '……' : sel ? `${sel.name}の姿にする` : '姿を選んでください'}
        </button>
      </div>
    </div>
  );
}
