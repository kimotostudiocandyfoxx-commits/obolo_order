'use client';

import { useState } from 'react';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';

/**
 * 〔💬 バティに聞く〕 (L2-MOON-S001): ask by voice, Bati looks it up and answers (the buddy chat, with its own
 * daily allowance). Under the answer: it can be wrong — check what matters yourself.
 */
export function BatiAsk({ bati, onDone }: { bati: string; onDone: (a: Record<string, string>) => void }) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ask = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await getApi().buddyChat(q.trim(), 'ja');
      setAnswer(r.reply.text);
    } catch {
      setErr('いまは、うまく調べられなかった……。また聞いてね');
    }
    setBusy(false);
  };
  const name = bati || 'バティ';
  const btn = 'w-full rounded-full border border-amber-200/50 bg-amber-200/10 py-3 text-[14px] tracking-wider active:scale-[0.98] disabled:opacity-40';
  return (
    <div className="absolute inset-0 z-[12] flex items-end justify-center bg-black/55 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out] rounded-3xl border border-amber-100/25 bg-[#0d0b18]/95 p-5 text-amber-50">
        <p className="text-center text-[15px] font-bold tracking-wider">💬 {name}に聞く</p>
        {answer === null ? (
          <div className="mt-3 space-y-3">
            {err && <p className="text-center text-[12px] text-amber-200/80">{err}</p>}
            <VoiceField value={q} onChange={setQ} placeholder="土星の輪って、何でできてるの？" maxLength={120} />
            <button onClick={() => void ask()} disabled={busy || !q.trim()} className={btn}>
              {busy ? `${name}が、調べている……` : '聞く'}
            </button>
            <button onClick={() => onDone({ ask: 'later' })} className="w-full py-2 text-[13px] text-amber-50/60">
              あとで
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="rounded-2xl bg-white/5 px-3 py-2 text-[13px] text-amber-50/70">「{q}」</p>
            <p className="text-[14px] leading-relaxed">
              <span className="mr-1 text-[11px] tracking-widest text-amber-200/80">{name}</span>
              {answer}
            </p>
            <p className="text-[11px] leading-relaxed text-amber-50/55">{name}の答えが、まちがっていることもあります。大事なことは、自分でも確かめてね</p>
            <button
              onClick={() => {
                setAnswer(null);
                setQ('');
              }}
              className={btn}
            >
              もう一つ聞く
            </button>
            <button onClick={() => onDone({ ask: 'ask' })} className="w-full py-2 text-[13px] text-amber-50/60">
              つぎへ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
