'use client';

import type { PuniLook } from '@obolo/shared';
import { useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { COLORS, defaultLook, SAMPLE_LOOKS, SLOT_LABELS, SLOTS } from '@/lib/puni/parts';
import { PuniFigure } from './PuniFigure';

/**
 * 着せ替え on your own Saturn page: change the body / parts / colour, tap the preview to squish
 * it, save → everyone sees the new look (Saturn world, replies, your page).
 */
export function PuniWardrobe({ start, onClose, onSaved }: { start: PuniLook | null; onClose: () => void; onSaved: (look: PuniLook | null) => void }) {
  const { me, setMe } = useAuth();
  const [look, setLook] = useState<PuniLook>(start ?? defaultLook());
  const [bounce, setBounceRaw] = useState(0);
  const [poked, setPoked] = useState(false);
  const setBounce = (t: number) => {
    setBounceRaw(t);
    setPoked(true);
    setTimeout(() => setPoked(false), 450);
  };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof PuniLook, v: string) => {
    setLook((l) => ({ ...l, [k]: v }));
    setBounce(Date.now());
  };

  const save = async (next: PuniLook | null) => {
    setBusy(true);
    setErr('');
    try {
      const u = await getApi().updateMe({ look: next });
      setMe(u);
      onSaved(u.look);
    } catch {
      setErr('保存できなかった…もう一度');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[97] flex flex-col bg-[#fff7fb] text-slate-700 animate-[fadeUp_0.25s_ease-out]">
      <div className="pt-safe relative shrink-0 overflow-hidden bg-gradient-to-b from-[#2b1b5c] via-[#6b3fa3] to-[#f4a3c4] pb-4">
        <div className="starfield" aria-hidden />
        <div className="relative flex items-center justify-between px-4 pt-2">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-lg font-black text-violet-600 shadow" aria-label="back">
            ←
          </button>
          <p className="text-sm font-black text-white drop-shadow">👕 着せ替え</p>
          <span className="w-9" />
        </div>
        <button onClick={() => setBounce(Date.now())} className="relative mx-auto mt-1 block" aria-label="squish">
          <PuniFigure look={look} size={200} bounce={bounce} poked={poked} />
        </button>
        <p className="relative text-center text-[11px] font-bold text-white/80">タップしてぷにぷに ／ 保存するとみんなの土星にこの姿で出るよ</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
        <p className="text-[10px] font-black text-violet-400">お手本からはじめる</p>
        <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1">
          {SAMPLE_LOOKS.map(({ id, name, ...l }) => (
            <button
              key={id}
              onClick={() => {
                setLook(l);
                setBounce(Date.now());
              }}
              className="shrink-0 rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-600"
            >
              {name}
            </button>
          ))}
          <button
            onClick={() => {
              setLook(defaultLook());
              setBounce(Date.now());
            }}
            className="shrink-0 rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-600"
          >
            シンプル
          </button>
        </div>
        <Row label="色">
          {COLORS.map((c) => (
            <button key={c} onClick={() => set('color', c)} className={`h-7 w-7 shrink-0 rounded-full border-2 ${look.color === c ? 'border-violet-500' : 'border-white shadow'}`} style={{ background: c }} aria-label={c} />
          ))}
        </Row>
        {(Object.keys(SLOTS) as (keyof typeof SLOTS)[]).map((k) => (
          <Row key={k} label={SLOT_LABELS[k]}>
            {SLOTS[k].map(([v, label]) => (
              <button key={v} onClick={() => set(k, v)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${look[k] === v ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-600'}`}>
                {label}
              </button>
            ))}
          </Row>
        ))}
        {look.neck === 'goldChain' && (
          <Row label="メダル">
            <input
              value={look.medal ?? ''}
              onChange={(e) => setLook((l) => ({ ...l, medal: e.target.value.slice(0, 5) }))}
              placeholder="5454"
              className="w-24 rounded-full bg-violet-50 px-3 py-1 text-[16px] outline-none"
            />
          </Row>
        )}
      </div>

      <div className="pb-safe shrink-0 border-t border-violet-100 bg-white px-4 py-3">
        {err && <p className="mb-1 text-center text-xs text-rose-500">{err}</p>}
        <button onClick={() => void save(look)} disabled={busy} className="w-full rounded-full bg-gradient-to-r from-pink-400 to-violet-400 py-3 text-base font-black text-white shadow disabled:opacity-50">
          {busy ? '保存中…' : 'この姿で保存する'}
        </button>
        {(start || me?.look) && (
          <button onClick={() => void save(null)} disabled={busy} className="mt-2 w-full text-center text-[11px] font-bold text-slate-400">
            まるい玉にもどす
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] font-black text-violet-400">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto py-0.5">{children}</div>
    </div>
  );
}
