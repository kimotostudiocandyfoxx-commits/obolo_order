'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * 〔設定〕 — for now the 〔毎月のマナ〕 part (M-R199 / M-R202): your mana, whether you are Obolo Order, and on days 3–7 of
 * the first journey 〔先にObolo Orderになる〕, which always plays SYS-S002 (the explanation) before the payment.
 * PLACEHOLDER (P-BILL-3): 〔やめる〕 (cancelling the monthly mana) is not built yet.
 * M-R246 / M-R247: 〔声を消す〕 and 〔写真を消す〕 (the voice and what was made from the photo; see VoiceAndPhoto).
 */
export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const { me } = useAuth();
  const [mana, setMana] = useState<number | null>(null);
  useEffect(() => {
    getApi()
      .wallet()
      .then((w) => setMana(w.manaBalance))
      .catch(() => setMana(null));
  }, []);
  if (!me) return null;
  const ordered = !!me.orderedAt;
  // from the end of day 3 to day 7 (day 8 decides it in the story itself)
  const early = !ordered && (me.journeyDay > 3 || (me.journeyDay === 3 && !!me.journeyCompletedAt)) && me.journeyDay < 8;
  return (
    <main className="pt-safe pb-safe mx-auto min-h-svh max-w-md px-4 py-4">
      <header className="flex items-center gap-2">
        <Link href="/" className="btn btn-ghost h-9 w-9 !p-0 text-lg" aria-label="もどる">
          ←
        </Link>
        <h1 className="text-lg font-black">設定</h1>
      </header>
      <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-black text-[color:var(--color-mana)]">毎月のマナ</h2>
        <p className="mt-2 text-3xl font-black text-[color:var(--color-mana)]">{mana === null ? '…' : mana.toLocaleString()}</p>
        <p className="mt-1 text-xs text-white/55">{ordered ? 'Obolo Order：毎月、体から88マナが湧きます（月額88円）' : '住人：マナジェムのマナで作ります'}</p>
        {early && (
          <Link href="/settings/order-early" className="mt-4 block rounded-full bg-gradient-to-b from-amber-300 to-orange-500 py-3 text-center text-[15px] font-black text-slate-950">
            先にObolo Orderになる
          </Link>
        )}
        {ordered && <p className="mt-4 text-[11px] leading-relaxed text-white/45">やめ方：〔やめる〕の画面は準備中です。いつでもやめられます。</p>}
      </section>
      <VoiceAndPhoto />
    </main>
  );
}

/**
 * M-R246 / M-R247: the voice and the photo, deletable at any time. 〔声を消す〕: the egg recording and {bati}'s voice model
 * are deleted (DELETE /voice/bati) — {bati} speaks in the default voice. 〔写真を消す〕: the photo itself was never kept;
 * the looks made from it are deleted (DELETE /me/look) — you stand as the hooded guest until a new look is made.
 */
function VoiceAndPhoto() {
  const { me, setMe } = useAuth();
  const [ask, setAsk] = useState<'voice' | 'photo' | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!me) return null;
  const voice = me.voices?.batiState ?? (me.voices?.bati ? 'ready' : 'none');
  const hasVoice = voice !== 'none' || !!me.voices?.bati;
  const hasLook = !!(me.avatarUrl || me.lookStandee);
  const run = async (what: 'voice' | 'photo') => {
    setBusy(true);
    setNote(null);
    try {
      setMe(what === 'voice' ? await getApi().removeBatiVoice() : await getApi().removeLook());
      setNote(what === 'voice' ? '声を消しました。相方は、はじめの声で話します' : '写真から作った姿を消しました');
    } catch {
      setNote('うまく消せませんでした。もう一度どうぞ');
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };
  const row = (what: 'voice' | 'photo', title: string, now: string, can: boolean, label: string) => (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{now}</p>
      </div>
      {ask === what ? (
        <div className="flex shrink-0 gap-1.5">
          <button disabled={busy} onClick={() => setAsk(null)} className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/70">
            やめる
          </button>
          <button disabled={busy} onClick={() => void run(what)} className="rounded-full bg-rose-400/90 px-3 py-1.5 text-[12px] font-bold text-slate-950 disabled:opacity-40">
            消す
          </button>
        </div>
      ) : (
        <button disabled={!can || busy} onClick={() => setAsk(what)} className="shrink-0 rounded-full border border-rose-300/60 px-3 py-1.5 text-[12px] text-rose-200 disabled:opacity-30">
          {label}
        </button>
      )}
    </div>
  );
  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-black">声と写真</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-white/50">写真と声は、あなたの姿と相方（バティ）を作るためだけに使い、ほかのことには使いません。</p>
      <div className="mt-2 divide-y divide-white/10">
        {row('voice', '相方の声', hasVoice ? (voice === 'making' ? 'あなたの声から、相方の声を作っています' : 'あなたの声を、少し高くして使っています') : 'はじめの声で話しています', hasVoice, '声を消す')}
        {row('photo', 'あなたの姿', hasLook ? '写真から作った姿があります（写真そのものは保存していません）' : 'まだ姿がありません', hasLook, '写真を消す')}
      </div>
      {note && <p className="mt-2 text-[12px] text-amber-100/80">{note}</p>}
    </section>
  );
}
