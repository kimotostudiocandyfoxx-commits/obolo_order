'use client';

import { PLAZA_ICONS, PLAZA_NAME_MAX, type PlazaView } from '@obolo/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiError, getApi } from '@/lib/api';
import { SATURN_RESIDENTS } from '@/lib/saturnResidents';
import { PuniAvatar } from '@/components/puni/PuniAvatar';
import { Mic } from '@/components/mercury/ComposeChat';
import { hueOf } from './BallAvatar';

/**
 * みんな = the ひろば map (client design 2026-10-07): named places float like little islands along
 * Saturn's rings — 日本, 北海道, K-POP好き … — with the people who spoke there standing on them.
 * Tap one → go in (its voices fall onto the planet). Search by name; anyone can make a new one.
 * PLACEHOLDER (P-SAT-13): islands are drawn in code with an emoji landmark; painted art later.
 */
export function PlazaMap({
  onEnter,
  shakeKey,
  refreshKey,
}: {
  onEnter: (p: PlazaView) => void;
  /** changes on ゆらす: the islands wobble */
  shakeKey: number;
  refreshKey?: number;
}) {
  const [list, setList] = useState<PlazaView[] | null>(null);
  const [q, setQ] = useState('');
  const [making, setMaking] = useState<string | null>(null);
  const [W, setW] = useState(390);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () =>
        getApi()
          .plazas(q)
          .then((r) => live && setList(r))
          .catch(() => live && setList([])),
      q ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, refreshKey]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // staggered along the rings: 2 columns on a phone, 3 on an iPad
  const cols = W >= 640 ? 3 : 2;
  const cell = W / cols;
  const rowH = cell * 1.0;
  const top = Math.max(...(list ?? []).map((p) => p.memberCount), 1);
  const placed = (list ?? []).map((p, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const h = hueOf(p.id);
    const pop = Math.log10(1 + p.memberCount) / Math.log10(1 + top);
    const w = cell * (0.78 + pop * 0.2);
    return {
      p,
      w,
      x: c * cell + (cell - w) / 2 + ((h % 7) - 3) * 4,
      y: r * rowH + (c % 2) * rowH * 0.45 + (h % 5) * 5,
    };
  });
  const height = placed.length ? Math.max(...placed.map((s) => s.y + s.w * 0.95)) + 120 : 0;
  const exact = list?.some((p) => p.name === q.trim());

  return (
    <div className="absolute inset-x-0 bottom-0 top-[calc(150px+env(safe-area-inset-top))] z-[40] flex flex-col">
      {/* search */}
      <div className="relative z-[2] mx-auto mt-1 flex w-[min(92%,460px)] items-center gap-2">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-full border border-white/40 bg-white/90 px-4 shadow-[0_4px_14px_rgba(60,20,110,.25)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a76bd" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value.slice(0, 30))}
            placeholder="ひろばをさがす"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-[#3d2a5c] outline-none placeholder:text-[#b4a3d8]"
            enterKeyHint="search"
          />
          {q && (
            <button onClick={() => setQ('')} className="text-sm font-black text-[#b4a3d8]" aria-label="clear">
              ✕
            </button>
          )}
        </label>
        <Mic value={q} onChange={(v) => setQ(v.slice(0, 30))} />
      </div>

      <div ref={box} className="relative mt-2 flex-1 overflow-y-auto overflow-x-hidden">
        {/* the big planet and its rings, behind the islands */}
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: Math.max(height, 600) }} aria-hidden>
          <div
            className="absolute rounded-full"
            style={{
              left: -W * 0.12,
              top: rowH * 0.15,
              width: W * 0.62,
              height: W * 0.62,
              background: 'radial-gradient(circle at 38% 32%, #fff3dc 0%, #fbd6b0 30%, #eab2c8 62%, #c696d8 100%)',
              boxShadow: '0 0 60px rgba(255,200,230,.35)',
              opacity: 0.95,
            }}
          />
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${Math.max(height, 600)}`} preserveAspectRatio="none">
            {[0, 1, 2].map((k) => {
              const H = Math.max(height, 600);
              const d = `M ${-W * 0.3} ${H * (0.12 + k * 0.08)} C ${W * 0.4} ${H * (0.05 + k * 0.1)}, ${W * 1.1} ${H * (0.3 + k * 0.1)}, ${W * 0.55} ${H * (0.55 + k * 0.08)} S ${-W * 0.2} ${H * (0.85 + k * 0.05)}, ${W * 1.3} ${H * (1 + k * 0.05)}`;
              return (
                <g key={k}>
                  <path d={d} fill="none" stroke="#f7e6ff" strokeOpacity={0.22 - k * 0.04} strokeWidth={W * (0.14 - k * 0.03)} strokeLinecap="round" />
                  <path d={d} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.4} strokeDasharray="1 8" strokeLinecap="round" />
                </g>
              );
            })}
          </svg>
        </div>

        {list === null && <p className="relative mt-16 text-center text-sm font-black text-white/90">ひろばをさがしています…</p>}

        {list && q && !exact && (
          <div className="relative z-[3] mx-auto mt-3 w-[min(92%,420px)] rounded-3xl bg-white/90 p-4 text-center shadow">
            <p className="text-xs font-bold text-[#7a62b0]">{list.length ? `「${q.trim()}」にぴったりのひろばは、まだないみたい` : `「${q.trim()}」のひろばは、まだないよ`}</p>
            <button onClick={() => setMaking(q.trim().slice(0, PLAZA_NAME_MAX))} className="mt-2 rounded-full bg-gradient-to-r from-pink-400 to-violet-400 px-5 py-2 text-sm font-black text-white shadow">
              ＋「{q.trim().slice(0, PLAZA_NAME_MAX)}」をつくる
            </button>
          </div>
        )}

        <div className="relative" style={{ height }}>
          {placed.map((s, i) => (
            <button key={s.p.id} onClick={() => onEnter(s.p)} className="absolute" style={{ left: s.x, top: s.y, width: s.w }} aria-label={s.p.name}>
              <div
                key={shakeKey}
                style={{
                  animation: shakeKey ? `islandShake 0.7s ease-out ${(i % 5) * 0.05}s` : undefined,
                }}
              >
                <div
                  style={{
                    animation: `islandBob ${4 + (hueOf(s.p.id) % 3)}s ease-in-out ${(i % 4) * 0.6}s infinite`,
                  }}
                >
                  <Island plaza={s.p} w={s.w} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ＋ ひろばをつくる */}
      <button
        onClick={() => setMaking('')}
        className="absolute bottom-[104px] right-4 z-[3] flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#4a3570] shadow-[0_4px_0_#e3cfae,0_8px_20px_rgba(60,20,110,.25)]"
      >
        <span className="text-lg leading-none">＋</span> ひろばをつくる
      </button>

      {making !== null &&
        createPortal(
          <MakePlaza
          initial={making}
          onClose={() => setMaking(null)}
          onMade={(p) => {
            setMaking(null);
            onEnter(p);
          }}
          />,
          document.body,
        )}
    </div>
  );
}

/** One floating island: name card, grass with the landmark and the people, earth and clouds below. */
export function Island({ plaza, w }: { plaza: Pick<PlazaView, 'id' | 'name' | 'icon' | 'memberCount' | 'faces' | 'joined'>; w: number }) {
  // nobody spoke yet: a few residents stand there so the island isn't bare
  const faces = useMemo(() => {
    const real = plaza.faces;
    if (real.length >= 4) return real;
    const h = hueOf(plaza.id);
    const fill = Array.from({ length: 4 - real.length }, (_, k) => SATURN_RESIDENTS[(h + k * 5) % SATURN_RESIDENTS.length].author);
    return [...real, ...fill];
  }, [plaza.faces, plaza.id]);
  // where people stand on the island's grass (fractions of the island picture)
  const spots = [
    [0.24, 0.26],
    [0.72, 0.24],
    [0.4, 0.35],
    [0.6, 0.37],
    [0.16, 0.36],
    [0.84, 0.34],
    [0.5, 0.44],
  ];
  const f = Math.max(22, w * 0.15);
  return (
    <div className="relative" style={{ width: w, height: w * 0.95 }}>
      {/* name card */}
      <div className="absolute left-1/2 top-0 z-[3] -translate-x-1/2 whitespace-nowrap rounded-2xl bg-white/95 px-3 py-1 text-center shadow-[0_4px_12px_rgba(60,20,110,.22)]">
        <p className="max-w-[9em] truncate text-[13px] font-black leading-tight text-[#3d2a5c]">{plaza.name}</p>
        <p className="flex items-center justify-center gap-1 text-[11px] font-bold leading-tight text-[#8a76bd]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#e58ab9" aria-hidden>
            <circle cx="12" cy="7" r="5" />
            <path d="M2 23c0-6 4.5-9 10-9s10 3 10 9z" />
          </svg>
          {plaza.memberCount.toLocaleString()}
          {plaza.joined && <span className="ml-1 rounded-full bg-pink-100 px-1.5 text-[9px] text-pink-500">参加中</span>}
        </p>
      </div>
      {/* the island (Art workshop, airbrushed pastel); each plaza's a little different in colour */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/art/saturn-island.webp"
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute inset-x-0 bottom-0 select-none"
        style={{ width: w, height: w * 0.62, filter: `hue-rotate(${(hueOf(plaza.id) % 50) - 25}deg)` }}
      />
      {/* the landmark */}
      <span className="absolute left-1/2 z-[1] -translate-x-1/2 leading-none drop-shadow-[0_4px_4px_rgba(60,20,90,.3)]" style={{ bottom: w * 0.37, fontSize: w * 0.26 }}>
        {plaza.icon}
      </span>
      {/* the people */}
      {faces.slice(0, 7).map((p, k) => (
        <span
          key={`${p.id}-${k}`}
          className="absolute z-[2]"
          style={{
            left: w * spots[k][0] - f / 2,
            top: w * 0.95 - w * 0.62 + w * 0.62 * spots[k][1] - f * 0.8,
          }}
        >
          <PuniAvatar seed={p.id} neo={p.neoForm} look={p.look} pic={p.pic} size={f} />
        </span>
      ))}
    </div>
  );
}

/** ＋ ひろばをつくる: a name (speak or type) and a landmark. */
function MakePlaza({ initial, onClose, onMade }: { initial: string; onClose: () => void; onMade: (p: PlazaView) => void }) {
  const [name, setName] = useState(initial);
  const [icon, setIcon] = useState<string>(PLAZA_ICONS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const n = name.trim();

  const make = async () => {
    if (!n) return;
    setBusy(true);
    setErr('');
    try {
      onMade(
        await getApi().createPlaza({
          name: n,
          icon: icon as (typeof PLAZA_ICONS)[number],
        }),
      );
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'MODERATION' ? 'その名前は使えないよ' : e instanceof ApiError && e.code === 'RATE_LIMITED' ? '今日はもうつくれないよ。また明日ね' : 'つくれなかった…もう一度');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center bg-violet-950/50" style={{ fontFamily: '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif' }} onClick={onClose}>
      <div className="pb-safe max-h-[92%] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 text-[#3d2a5c]" onClick={(e) => e.stopPropagation()}>
        <p className="text-center text-sm font-black text-violet-600">新しいひろばをつくる</p>
        <div className="mx-auto mt-2 w-[180px]">
          <Island
            plaza={{
              id: 'new',
              name: n || 'ひろばの名前',
              icon,
              memberCount: 1,
              faces: [],
              joined: false,
            }}
            w={180}
          />
        </div>
        <p className="mt-2 text-xs font-black text-[#8a76bd]">名前</p>
        <div className="mt-1 flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, PLAZA_NAME_MAX))}
            placeholder="例：ねこ好き、大阪、夜ふかし部"
            className="h-11 min-w-0 flex-1 rounded-2xl bg-violet-50 px-3 text-[16px] font-bold outline-none"
          />
          <Mic value={name} onChange={(v) => setName(v.slice(0, PLAZA_NAME_MAX))} />
        </div>
        <p className="mt-3 text-xs font-black text-[#8a76bd]">島のしるし</p>
        <div className="mt-1 grid grid-cols-6 gap-2">
          {PLAZA_ICONS.map((ic) => (
            <button key={ic} onClick={() => setIcon(ic)} className={`flex h-11 items-center justify-center rounded-2xl text-2xl ${icon === ic ? 'bg-pink-100 ring-2 ring-pink-300' : 'bg-violet-50'}`}>
              {ic}
            </button>
          ))}
        </div>
        {err && <p className="mt-2 text-center text-xs text-rose-500">{err}</p>}
        <button disabled={!n || busy} onClick={() => void make()} className="mt-4 w-full rounded-full bg-gradient-to-r from-pink-400 to-violet-400 py-3.5 text-base font-black text-white disabled:opacity-40">
          {busy ? 'つくっています…' : 'このひろばをつくる'}
        </button>
        <p className="mt-2 text-center text-[10px] text-[#a08fc4]">同じ名前のひろばがあれば、そこに参加するよ</p>
      </div>
    </div>
  );
}
