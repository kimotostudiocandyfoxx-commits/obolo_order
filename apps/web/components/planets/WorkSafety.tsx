'use client';

import type { PlanetWorkKind, PlanetWorkReportBody } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * M-R213: a stranger's work (not yours, not a dachi's) on a planet's wide place carries 〔通報〕 and 〔見えなくする〕.
 * Hiding is for you only and kept on the server; the work stays for everyone else. Dachi works and your own carry
 * neither. Sample residents (no real account) carry neither on the live server.
 */
let dachiIds: Promise<Set<string>> | null = null;
function loadDachi(): Promise<Set<string>> {
  dachiIds ??= getApi()
    .dachi()
    .then((l) => new Set(l.map((d) => d.id)))
    .catch(() => {
      dachiIds = null;
      return new Set<string>();
    });
  return dachiIds;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** is this work a stranger's (so it gets the two buttons) */
export function useStranger(authorId: string | null | undefined, workId: string | null | undefined): boolean {
  const { me } = useAuth();
  const [dachi, setDachi] = useState<Set<string> | null>(null);
  useEffect(() => {
    let on = true;
    void loadDachi().then((s) => on && setDachi(s));
    return () => {
      on = false;
    };
  }, []);
  if (!authorId || !workId || !dachi || !me || authorId === me.id || authorId === 'me' || dachi.has(authorId)) return false;
  return getApi().mode !== 'live' || (UUID.test(authorId) && UUID.test(workId));
}

const REASONS: [PlanetWorkReportBody['reason'], string][] = [
  ['mean', 'いやなことを言っている'],
  ['scary', 'こわい・あぶない'],
  ['other', 'そのほか'],
];

export function WorkSafety({
  kind,
  id,
  authorId,
  onHidden,
  hideOnly = false,
  tone = 'dark',
  className = '',
}: {
  kind: PlanetWorkKind;
  id: string | null | undefined;
  authorId: string | null | undefined;
  /** the work was hidden: take it off the screen */
  onHidden?: (id: string) => void;
  /** the screen already has its own 〔通報〕 (Venus) */
  hideOnly?: boolean;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const stranger = useStranger(authorId, id);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!stranger || !id) return null;
  const pill = tone === 'dark' ? 'border-white/25 bg-black/45 text-white/80' : 'border-[#e6d3bd] bg-white/85 text-[#7a5b3e]';
  const hide = async () => {
    try {
      await getApi().hidePlanetWork(kind, id, true);
      onHidden?.(id);
      setNote('見えなくした。あなたにだけ、もう出てこない');
    } catch {
      setNote('いまは、できなかった');
    }
  };
  const report = async (reason: PlanetWorkReportBody['reason']) => {
    setAsking(false);
    try {
      await getApi().reportPlanetWork(kind, id, { reason });
      setNote('とどいた。運営が確かめるね');
    } catch {
      setNote('送れなかった…もう一度');
    }
  };
  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`} onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-center gap-2">
        {!hideOnly && (
          <button onClick={() => setAsking((v) => !v)} className={`rounded-full border px-3 py-1 text-[11px] font-bold backdrop-blur ${pill}`}>
            通報
          </button>
        )}
        <button onClick={() => void hide()} className={`rounded-full border px-3 py-1 text-[11px] font-bold backdrop-blur ${pill}`}>
          見えなくする
        </button>
      </div>
      {asking && (
        <div className={`flex flex-wrap justify-center gap-1.5 rounded-2xl border p-2 ${pill}`}>
          {REASONS.map(([r, l]) => (
            <button key={r} onClick={() => void report(r)} className="rounded-full px-2 py-1 text-[11px] hover:bg-white/10">
              {l}
            </button>
          ))}
        </div>
      )}
      {note && <p className={`text-[11px] ${tone === 'dark' ? 'text-white/70' : 'text-[#9b8068]'}`}>{note}</p>}
    </div>
  );
}
