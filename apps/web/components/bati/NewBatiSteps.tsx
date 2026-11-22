'use client';

import { useState } from 'react';
import { BATI_ROLE_LABELS, BATI_ROLES, BATI_SEED_QUESTION, BATI_WISH_REFUSE, wishRefusal, type BatiEggKind, type BatiRole } from '@obolo/shared';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { batiLine } from '@/lib/onboarding/batiLine';
import { fill, type StoryVars } from '@/lib/onboarding/script';
import { SmallEgg } from './SmallEgg';

/**
 * the 'newbati' step: the seed said as written (a sound / a word / a wish), then the new {bati} hatched from the chosen
 * egg. A wish that can not be (M-R230) is answered by the first {bati} (`firstSays`: its line in its own manner).
 */
export function NewBatiStep({
  kind,
  egg,
  onBorn,
  firstSays = (t) => t,
  firstName = 'バティ',
}: {
  kind: 'sound' | 'word' | 'wish';
  /** chosen on the altar just before (SYS-S003, f_egg) */
  egg: BatiEggKind;
  onBorn: (imageUrl: string) => void;
  firstSays?: (line: string) => string;
  firstName?: string;
}) {
  const { setMe } = useAuth();
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setErr(null);
    // M-R230: a wish that can not be — the same first screen as the server's
    if (kind === 'wish' && wishRefusal(seed)) return setErr(`${firstName}「${firstSays(BATI_WISH_REFUSE)}」`);
    setBusy(true);
    try {
      setMe(await getApi().batiNew(egg, seed.trim()));
      const born = await getApi().batiHatch().catch(() => null);
      if (born) setMe(born);
      onBorn(born?.bati?.imageUrl ?? '');
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      // the review mode without a {bati} of its own: the scene goes on
      if (getApi().mode === 'demo' && ['NO_BATI', 'EGG_NOT_READY', 'BATI_FULL'].includes(code)) return onBorn('');
      setErr(
        code === 'WISH_REFUSED' || (kind === 'wish' && code === 'MODERATION')
          ? `${firstName}「${firstSays(BATI_WISH_REFUSE)}」`
          : code === 'SEED_REASK' || code === 'MODERATION'
            ? `OBOLON「${BATI_SEED_QUESTION[kind]}」`
            : code === 'EGG_NOT_READY'
              ? 'たまごは、まだ育っている'
              : 'うまく受け取れなかった……もう一度',
      );
      setBusy(false);
    }
  };
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[46] bg-gradient-to-t from-black via-black/85 to-transparent px-6 pt-20">
      <div className="mx-auto mb-10 flex max-w-sm flex-col gap-3">
        {busy ? (
          <div className="flex justify-center py-6">
            <SmallEgg growth={1} size={70} ready className="animate-[shake_0.5s_ease-in-out_infinite]" />
          </div>
        ) : (
          <>
            <input className="input" maxLength={kind === 'wish' ? 40 : 30} value={seed} placeholder={kind === 'sound' ? '例：雨の音／ピアノ／お祭りの太鼓' : kind === 'wish' ? '例：仕事を手伝ってくれる、落ち着いた子' : '例：ありがとう／なんとかなる'} onChange={(e) => setSeed(e.target.value)} />
            <button onClick={() => void go()} disabled={!seed.trim()} className="rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 py-3.5 text-lg tracking-widest text-amber-50 disabled:opacity-40">
              これにする
            </button>
          </>
        )}
        {err && <p className="text-center text-sm text-amber-100">{err}</p>}
      </div>
    </div>
  );
}

/** the 'batirole' step: the new {bati}'s greeting and question in its own manner, the four roles */
export function BatiRoleStep({ greet, ask, vars, onDone }: { greet: string; /** none = the 3rd: only the greeting, its role came from the wish */ ask?: string; vars: StoryVars; onDone: (role: BatiRole | null) => void }) {
  const { setMe } = useAuth();
  const [busy, setBusy] = useState(false);
  const say = (t: string) => fill(batiLine(t, vars.batiSpeech), vars);
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-[46] bg-gradient-to-t from-black via-black/85 to-transparent px-6 pt-16 text-amber-50">
      <div className="mx-auto mb-10 flex max-w-sm flex-col gap-3">
        <p className="text-center">
          {vars.bati ?? 'バティ'}「{say(greet)}」
        </p>
        {!ask && (
          <button className="mx-auto rounded-full border border-amber-200/80 px-10 py-2.5 tracking-widest" onClick={() => onDone(null)}>
            次へ
          </button>
        )}
        {ask && (
          <p className="text-center">
            {vars.bati ?? 'バティ'}「{say(ask)}」
          </p>
        )}
        {ask && <div className="grid grid-cols-2 gap-2">
          {BATI_ROLES.map((r) => (
            <button
              key={r}
              disabled={busy}
              className="rounded-xl bg-white/10 py-2.5 text-sm"
              onClick={async () => {
                setBusy(true);
                const m = await getApi().batiRole(r).catch(() => null);
                if (m) setMe(m);
                onDone(r);
              }}
            >
              {BATI_ROLE_LABELS[r]}
            </button>
          ))}
        </div>}
      </div>
    </div>
  );
}
