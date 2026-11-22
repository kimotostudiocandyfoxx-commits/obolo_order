'use client';

import { useState } from 'react';
import { BATI_ROLE_LABELS, BATI_ROLE_QUESTION, BATI_ROLES, BATI_PERSONALITIES, BATI_SEED_QUESTION, batiDefaultCall, batiSeedKind, type BatiEggKind, type Me } from '@obolo/shared';
import { ApiError, getApi } from '@/lib/api';
import { batiLine, batiLineVoiceOf } from '@/lib/onboarding/batiLine';
import { fill } from '@/lib/onboarding/script';
import { BatiCardView, exportCard } from './BatiCard';
import { SmallEgg, eggGrowth } from './SmallEgg';
import { BatiMemories } from './BatiMemories';

/** the egg is ready (the review mode's switch `obolo.demo.eggReady` = '1' makes it ready at once) */
export function eggReady(me: Me | null | undefined): boolean {
  const e = me?.batiEgg;
  if (!e) return false;
  if (e.ready || new Date(e.readyAt).getTime() <= Date.now()) return true;
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
      <SmallEgg growth={ready ? 1 : eggGrowth(me.batiEgg.readyAt)} size={20} ready={ready} />
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
  const d = BATI_PERSONALITIES[b.personality];
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
        <p className="mb-1 text-xs font-bold text-white/70">性格</p>
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
          <BatiCardView card={b.card} egg={!!me.batiEgg} eggGrowth={me.batiEgg ? eggGrowth(me.batiEgg.readyAt) : 0} onExport={() => void exportCard(b.card!)} />
          {/* M-R222: 「覚えてること」 (only what was asked in the chat), forget one or all */}
          <BatiMemories me={me} onMe={onMe} />
        </div>
      )}
      {err && <p className="text-center text-sm text-rose-300">{err}</p>}
    </div>
  );
}

type Stage = 'grown' | 'seed' | 'hatching' | 'name' | 'role' | 'card';

/**
 * The morning the egg has grown (M-R218): OBOLON「、、、{neo}。たまごが、育った。」, the egg (moon / sun), the seed (the
 * second: a favourite sound, the third: a word, OBOLON's question as written), the hatching, the name, the card.
 * The lines come from the decision (docs/story-rewrite/バティの性格の決め方.md §4・§6); no script scene has them yet.
 */
export function NewEggFlow({ me, onMe, onClose }: { me: Me; onMe: (m: Me) => void; onClose: () => void }) {
  const kind = batiSeedKind(me.batis?.length ?? 1);
  const [stage, setStage] = useState<Stage>('grown');
  const [egg, setEgg] = useState<BatiEggKind>('moon');
  const [seed, setSeed] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [card, setCard] = useState<Me['bati']>(null);
  const api = getApi();
  const hatch = async () => {
    setErr(null);
    setStage('hatching');
    try {
      onMe(await api.batiNew(egg, seed.trim()));
      const born = await api.batiHatch().catch(() => null);
      if (born) onMe(born);
      setStage('name');
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setErr(code === 'SEED_REASK' || code === 'MODERATION' ? `OBOLON「${BATI_SEED_QUESTION[kind]}」` : code === 'EGG_NOT_READY' ? 'たまごは、まだ育っている' : 'うまくいかなかった……');
      setStage('seed');
    }
  };
  const named = async () => {
    try {
      const m = await api.batiName(name.trim());
      onMe(m);
      setCard(m.bati);
      // the 2nd / 3rd {bati} asks what kind of partner it will be (M-R219 / M-R222)
      setStage('role');
    } catch {
      setErr('その名前は使えません');
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-[radial-gradient(130%_70%_at_50%_0%,#1d2a52_0%,#0b1027_55%,#05060f_100%)] px-6 text-amber-50">
      {stage === 'grown' && (
        <button className="flex flex-col items-center gap-6" onClick={() => setStage('seed')}>
          <SmallEgg growth={1} size={60} ready />
          <p className="text-lg">OBOLON「、、、{me.displayName}。たまごが、育った。」</p>
        </button>
      )}
      {stage === 'seed' && (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <p className="text-center">OBOLON「{BATI_SEED_QUESTION[kind]}」</p>
          <div className="grid grid-cols-2 gap-2">
            {(['moon', 'sun'] as const).map((e) => (
              <button key={e} onClick={() => setEgg(e)} className={`rounded-xl py-2 text-sm ${egg === e ? 'bg-amber-200/30 ring-2 ring-amber-200' : 'bg-white/10'}`}>
                {e === 'moon' ? '月のたまご（女の子寄り）' : '太陽のたまご（男の子寄り）'}
              </button>
            ))}
          </div>
          <input className="input" maxLength={30} value={seed} onChange={(e) => setSeed(e.target.value)} />
          <button className="btn btn-primary" disabled={!seed.trim()} onClick={() => void hatch()}>
            これにする
          </button>
          {err && <p className="text-center text-sm text-amber-100">{err}</p>}
        </div>
      )}
      {stage === 'hatching' && <SmallEgg growth={1} size={80} ready className="animate-[shake_0.5s_ease-in-out_infinite]" />}
      {stage === 'name' && (
        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          {me.bati?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.bati.imageUrl} alt="" className="h-40 w-40 object-contain" />
          )}
          <p>OBOLON「お前も、、、名前を、つけてやれ。」</p>
          <input className="input" maxLength={20} value={name} placeholder="バティの名前" onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary w-full" disabled={!name.trim()} onClick={() => void named()}>
            この名前にする
          </button>
          {err && <p className="text-sm text-rose-300">{err}</p>}
        </div>
      )}
      {stage === 'role' && card && (
        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          <p className="text-center">
            {card.name}「{fill(batiLine(BATI_ROLE_QUESTION, batiLineVoiceOf(card)), { name: me.displayName, neo: me.displayName, inviter: '', bati: card.name ?? '' })}」
          </p>
          <div className="grid w-full grid-cols-2 gap-2">
            {BATI_ROLES.map((r) => (
              <button
                key={r}
                className="rounded-xl bg-white/10 py-2.5 text-sm"
                onClick={() =>
                  void api
                    .batiRole(r)
                    .then(onMe)
                    .catch(() => undefined)
                    .finally(() => setStage('card'))
                }
              >
                {BATI_ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      )}
      {stage === 'card' && card?.card && (
        <>
          <BatiCardView card={card.card} onExport={() => void exportCard(card.card!)} />
          <button className="btn btn-ghost" onClick={onClose}>
            とじる
          </button>
        </>
      )}
      {stage !== 'hatching' && stage !== 'card' && (
        <button className="absolute right-4 top-[calc(12px+env(safe-area-inset-top))] text-sm text-white/60" onClick={onClose}>
          あとで
        </button>
      )}
    </div>
  );
}
