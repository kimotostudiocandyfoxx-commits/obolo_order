'use client';

import { useState } from 'react';
import { BATI_ROLE_LABELS, BATI_ROLES, BATI_PERSONALITIES, batiDefaultCall, formatMana, MAKE_COST, normalizeBatiPersonality, type Me } from '@obolo/shared';
import { ApiError, getApi } from '@/lib/api';
import { BatiCardView, exportCard } from './BatiCard';
import { SmallEgg } from './SmallEgg';
import { BatiMemories } from './BatiMemories';

/** the egg is ready (the review mode's switch `obolo.demo.eggReady` = '1' makes it ready at once) */
export function eggReady(me: Me | null | undefined): boolean {
  const e = me?.batiEgg;
  if (!e) return false;
  if (e.ready) return true;
  try {
    return getApi().mode === 'demo' && localStorage.getItem('obolo.demo.eggReady') === '1';
  } catch {
    return false;
  }
}

/**
 * The small egg on the Moon temple's altar (M-R218): a little bigger and brighter as the days pass — never a number.
 * Ready: it glows and a tap starts the hatching.
 */
export function MoonEgg({ me, onHatch }: { me: Me | null | undefined; onHatch: () => void }) {
  if (!me?.batiEgg) return null;
  const ready = eggReady(me);
  return (
    <button type="button" onClick={() => ready && onHatch()} disabled={!ready} aria-label={ready ? 'たまごが、育った' : '小さなたまご'} className="flex h-11 w-9 items-end justify-center">
      <SmallEgg growth={ready ? 1 : (me.batiEgg.growth ?? 0)} size={20} ready={ready} />
    </button>
  );
}

/**
 * The {bati} part of the Moon's settings (M-R215): the cards of the member's {bati} (one is in the chat — swap by
 * mood), and for the one in the chat its 呼び方 and 一人称 (its personality never changes).
 */
export function BatiSettings({ me, onMe }: { me: Me; onMe: (m: Me) => void }) {
  const b = me.bati;
  const [call, setCall] = useState(b?.callCustom ?? '');
  const [self, setSelf] = useState(b?.selfCustom ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!b?.personality) return null;
  const d = BATI_PERSONALITIES[normalizeBatiPersonality(b.personality)];
  const run = async (f: () => Promise<Me>) => {
    setBusy(true);
    setErr(null);
    try {
      onMe(await f());
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'MODERATION' ? 'その言葉は使えません' : 'うまくいかなかった……');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-bold text-white/70">話し方</p>
        <p className="text-sm">
          {d.label}
          <span className="ml-2 text-xs text-white/50">（生まれた時に決まった性格は、ずっと変わりません）</span>
        </p>
      </div>
      <label className="block text-xs text-white/70">
        <span className="font-bold">呼び方</span>
        <input className="input mt-1" maxLength={12} value={call} placeholder={(b.call ?? batiDefaultCall(b.personality)).replace('{neo}', me.displayName)} onChange={(e) => setCall(e.target.value)} />
      </label>
      <label className="block text-xs text-white/70">
        <span className="font-bold">一人称</span>
        <input className="input mt-1" maxLength={6} value={self} placeholder={b.self ?? d.self.sun} onChange={(e) => setSelf(e.target.value)} />
      </label>
      <button className="btn btn-ghost w-full" disabled={busy} onClick={() => void run(() => getApi().batiSpeech({ call: call.trim() || null, self: self.trim() || null }))}>
        呼び方・一人称を保存
      </button>
      <div>
        <p className="mb-1.5 text-xs font-bold text-white/70">役目</p>
        <div className="grid grid-cols-4 gap-1.5">
          {BATI_ROLES.map((r) => (
            <button
              key={r}
              disabled={busy}
              onClick={() => void run(() => getApi().batiRole(r))}
              className={`min-h-10 rounded-xl text-xs font-bold ${(b.role ?? 'any') === r ? 'bg-sky-300 text-sky-950' : 'bg-white/10 text-white/70'}`}
            >
              {BATI_ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      {(me.batis?.length ?? 0) > 1 && (
        <div>
          <p className="mb-1.5 text-xs font-bold text-white/70">チャットにいる相方（気分で入れかえ）</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {me.batis!.map((x) => (
              <button
                key={x.id}
                disabled={busy || x.active || !x.name}
                onClick={() => void run(() => getApi().batiSwitch(x.id))}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl p-2 text-xs ${x.active ? 'bg-sky-300/30 ring-2 ring-sky-300' : 'bg-white/10'} ${x.card.rare ? 'shadow-[0_0_10px_rgba(255,205,90,0.6)]' : ''}`}
              >
                {x.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={x.faces?.smile ?? x.imageUrl} alt="" className="h-12 w-12 object-contain" />
                ) : (
                  <span className="h-12 w-12" />
                )}
                <span>{x.name ?? '……'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {b.card && (
        <div className="flex flex-col items-center gap-3">
          <BatiCardView card={b.card} egg={!!me.batiEgg} eggGrowth={me.batiEgg?.growth ?? 0} onExport={() => void exportCard(b.card!)} />
          {/* client 2026-11-27: the painter failed at the birth (a stand-in, nothing was taken) — the real picture, for the normal price */}
          {b.stand && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  onMe(await getApi().batiBirthRetry());
                } catch (e) {
                  setErr(e instanceof ApiError && e.code === 'NO_MANA' ? e.message : 'うまく描けなかった……もういちど');
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-full border border-amber-200/50 px-4 py-2 text-xs tracking-wider text-amber-100 disabled:opacity-40"
            >
              {busy ? '……' : `生まれた時の絵を、描いてもらう（マナ −${formatMana(MAKE_COST.batiBirth)}）`}
            </button>
          )}
          {/* M-R222: 「覚えてること」 (only what was asked in the chat), forget one or all */}
          <BatiMemories me={me} onMe={onMe} />
        </div>
      )}
      {err && <p className="text-center text-sm text-rose-300">{err}</p>}
    </div>
  );
}
