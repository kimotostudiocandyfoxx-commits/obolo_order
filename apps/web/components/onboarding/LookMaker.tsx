'use client';

import type { NeoLookCandidate, NeoLookResult } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { NeoChooser } from './NeoChooser';

/**
 * Day 3: KIMORIN asks three questions and the visitor's OBOLO NEO look is generated — four
 * candidates, three tries (client decision 2026-10-05). If generation fails, the eight preset forms
 * are offered instead so the story always moves on.
 */
export interface LookApi {
  candidates(a: { animal: string; color: string; mood: string }): Promise<NeoLookResult>;
  choose(id: string): Promise<string>;
  chooseForm(formId: string): Promise<void>;
}

const Q = [
  { key: 'animal', label: '好きな動物は？', chips: ['キツネ', 'ネコ', 'ウサギ', 'オオカミ', 'フクロウ', 'リュウ'] },
  { key: 'color', label: '好きな色は？', chips: ['赤', '青', '紫', '金', '黒', '白'] },
  { key: 'mood', label: 'どんな雰囲気になりたい？', chips: ['ミステリアス', 'クール', 'かわいい', '元気', 'やさしい', '強そう'] },
] as const;
const WAIT = ['いい感じだケン…', '星のかけらを集めてるケン…', 'もう少しだ…！', '創って創って、創りまくるケン…'];

export function LookMaker({ api, onDone }: { api: LookApi; onDone: (url: string | null) => void }) {
  const [ans, setAns] = useState({ animal: '', color: '', mood: '' });
  const [phase, setPhase] = useState<'ask' | 'making' | 'pick' | 'failed' | 'forms'>('ask');
  const [cands, setCands] = useState<NeoLookCandidate[]>([]);
  const [left, setLeft] = useState(3);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (phase !== 'making') return;
    const id = setInterval(() => setW((x) => x + 1), 2200);
    return () => clearInterval(id);
  }, [phase]);

  const make = async () => {
    setErr(null);
    setPhase('making');
    try {
      const r = await api.candidates(ans);
      setLeft(r.triesLeft);
      if (!r.candidates.length) return setPhase('failed');
      setCands(r.candidates);
      setSel(null);
      setPhase('pick');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/作り直せません|LOOK_TRIES/.test(msg)) {
        setLeft(0);
        setPhase(cands.length ? 'pick' : 'failed');
      } else setPhase('failed');
      setErr(msg);
    }
  };

  const panel = 'pb-safe absolute inset-x-0 bottom-0 z-20 max-h-[88svh] overflow-y-auto rounded-t-3xl border-t border-amber-200/30 bg-black/85 px-5 pt-5 backdrop-blur-md';

  if (phase === 'forms') return <NeoChooser onChoose={async (id) => { await api.chooseForm(id); onDone(null); }} />;

  if (phase === 'making')
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-sm">
        <div className="relative h-40 w-40">
          <span className="absolute inset-0 animate-ping rounded-full bg-amber-200/20" />
          <span className="absolute inset-6 animate-[spin-slow_6s_linear_infinite] rounded-full border-2 border-dashed border-amber-200/60" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spriteUrl('kimorin-face')} alt="" className="absolute inset-10 rounded-full" />
        </div>
        <p className="tracking-widest text-amber-100">{WAIT[w % WAIT.length]}</p>
        <p className="text-xs text-white/50">君の姿を創っています（30秒ほど）</p>
      </div>
    );

  if (phase === 'failed')
    return (
      <div className={panel}>
        <p className="text-center text-amber-100">うまく創れなかったケン……</p>
        <p className="mt-1 text-center text-xs text-white/55">{left > 0 ? 'もう一度ためすか、用意した姿から選んでくれ。' : '用意した姿から選んでくれ。'}</p>
        <div className="mx-auto mb-8 mt-4 flex max-w-sm flex-col gap-2">
          {left > 0 && <Gold onClick={make}>もう一度創る（あと{left}回）</Gold>}
          <button onClick={() => setPhase('forms')} className="rounded-full border border-white/30 py-3 text-sm">
            用意された8つの姿から選ぶ
          </button>
        </div>
      </div>
    );

  if (phase === 'pick')
    return (
      <div className={panel}>
        <p className="text-center tracking-widest text-amber-100">気に入った姿をえらぶケン</p>
        <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-3">
          {cands.map((c) => (
            <button key={c.id} onClick={() => setSel(c.id)} className={`overflow-hidden rounded-2xl border-4 transition ${sel === c.id ? 'scale-[1.03] border-amber-300 shadow-[0_0_24px_rgba(255,200,90,0.6)]' : 'border-transparent opacity-85'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.url} alt="" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
        <div className="mx-auto mb-8 mt-4 flex max-w-sm flex-col gap-2">
          <Gold
            disabled={!sel || busy}
            onClick={async () => {
              if (!sel) return;
              setBusy(true);
              try {
                onDone(await api.choose(sel));
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
                setBusy(false);
              }
            }}
          >
            {busy ? '……' : 'この姿にする'}
          </Gold>
          {left > 0 ? (
            <button onClick={() => setPhase('ask')} className="rounded-full border border-white/30 py-2.5 text-sm">
              作り直す（あと{left}回）
            </button>
          ) : (
            <p className="text-center text-xs text-white/50">作り直しはもうできないケン</p>
          )}
          {err && <p className="text-center text-xs text-rose-300">{err}</p>}
        </div>
      </div>
    );

  const ready = ans.animal.trim() && ans.color.trim() && ans.mood.trim();
  return (
    <div className={panel}>
      <div className="mx-auto max-w-md space-y-4">
        {Q.map((q) => (
          <div key={q.key}>
            <p className="mb-1.5 text-sm tracking-widest text-amber-100">{q.label}</p>
            <input
              value={ans[q.key]}
              onChange={(e) => setAns({ ...ans, [q.key]: e.target.value.slice(0, 30) })}
              className="w-full rounded-full border border-amber-200/50 bg-black/60 px-5 py-2.5 text-white outline-none"
              style={{ fontSize: 16 }}
              placeholder="自由に書いてもOK"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {q.chips.map((c) => (
                <button key={c} onClick={() => setAns({ ...ans, [q.key]: c })} className={`rounded-full px-3 py-1 text-xs ${ans[q.key] === c ? 'bg-amber-300 font-bold text-black' : 'bg-white/10 text-white/80'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="pb-8 pt-1">
          <Gold disabled={!ready} onClick={make}>
            ✦ 姿を創る（あと{left}回）
          </Gold>
          {err && <p className="mt-2 text-center text-xs text-rose-300">{err}</p>}
        </div>
      </div>
    </div>
  );
}

function Gold({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 py-3.5 text-lg tracking-widest text-amber-50 disabled:opacity-40">
      {children}
    </button>
  );
}
