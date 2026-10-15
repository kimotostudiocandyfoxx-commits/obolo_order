'use client';

import { ATELIER_MAX_ITEMS, type AtelierItem, type AtelierLayout } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sticker } from '@/components/jupiter/JupiterLesson';
import { Record } from '@/components/mercury/MercuryLesson';
import { useToast } from '@/components/Toast';
import { getApi } from '@/lib/api';
import { DECOS, FLOORS, KIND_SIZE, WALLS, decoById, floorCss, newItemId, wallCss, type Piece } from '@/lib/atelier';
import { useAuth } from '@/lib/auth';
import { madeFrom } from '@/lib/onboarding/made';

/**
 * Uranus: your atelier (second journey; client 2026-10-15). A room of your own: put up what you made on
 * the journey — stickers, records, MV screens, kororins, your NEO portrait, your Bati — among decorations,
 * on the wallpaper and floor you like. 〔🎨 かざる〕 → drag to move, the bar under the room to resize / turn
 * / flip / bring forward / put away; 〔できた〕 saves. Outside decorating: a record plays, a screen shows its MV,
 * a sticker comes close.
 */
const WALL_H = 0.7;
type Tab = 'mine' | 'deco' | 'room';

export function Atelier() {
  const { me } = useAuth();
  const toast = useToast();
  const [layout, setLayout] = useState<AtelierLayout | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('mine');
  const [sel, setSel] = useState<string | null>(null);
  const [roomW, setRoomW] = useState(360);
  const [playing, setPlaying] = useState<string | null>(null);
  const [close, setClose] = useState<AtelierItem | null>(null);
  const room = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    getApi()
      .atelier()
      .then(setLayout)
      .catch(() => setLayout({ wall: 'cream', floor: 'wood', items: [] }));
  }, []);

  // what you made: from the journey's records, your saved songs and the MVs in your 裏スタジオ
  useEffect(() => {
    if (!me) return;
    const made = madeFrom(me.story);
    const list: Piece[] = [];
    if (me.avatarUrl) list.push({ key: 'look', kind: 'look', ref: 'look', url: me.avatarUrl, poster: null, text: me.displayName, label: 'ネオの姿' });
    if (me.bati?.imageUrl) list.push({ key: 'bati', kind: 'bati', ref: 'bati', url: me.bati.imageUrl, poster: null, text: me.bati.name ?? '', label: me.bati.name ?? 'バティ' });
    made.stickers?.forEach((s, k) => list.push({ key: `sticker-${k}`, kind: 'sticker', ref: `sticker-${k}`, url: s.url, poster: null, text: s.text, label: s.text }));
    made.kororins?.forEach((t, k) => list.push({ key: `kororin-${k}`, kind: 'kororin', ref: `kororin-${k}`, url: null, poster: null, text: t, label: t }));
    if (made.song) list.push({ key: `song-${made.song.id}`, kind: 'song', ref: made.song.id, url: made.song.url, poster: made.song.jacket, text: made.song.title, label: made.song.title });
    if (made.mv) list.push({ key: `mv-${made.mv.id}`, kind: 'mv', ref: made.mv.id, url: made.mv.url, poster: made.mv.poster, text: made.mv.title, label: made.mv.title });
    setPieces(list);
    const api = getApi();
    void Promise.all([api.savedSongs().catch(() => []), api.marsBackstage().catch(() => [])]).then(([songs, mvs]) => {
      setPieces((cur) => {
        const keys = new Set(cur.map((p) => p.key));
        const more: Piece[] = [
          ...songs.map((s) => ({ key: `song-${s.id}`, kind: 'song' as const, ref: s.id, url: s.url, poster: null, text: s.title, label: s.title })),
          ...mvs.map((v) => ({ key: `mv-${v.id}`, kind: 'mv' as const, ref: v.id, url: v.url, poster: v.posterUrl, text: v.title, label: v.title || 'MV' })),
        ].filter((p) => !keys.has(p.key) && p.url && (p.url.startsWith('/') || p.url.startsWith('https://')));
        return [...cur, ...more];
      });
    });
  }, [me]);

  useEffect(() => {
    const el = room.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoomW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  useEffect(() => () => audio.current?.pause(), []);

  const save = useCallback(
    async (l: AtelierLayout, quiet = false) => {
      try {
        await getApi().saveAtelier(l);
        dirty.current = false;
        if (!quiet) toast.show('アトリエを保存しました');
      } catch {
        toast.show('保存できなかった。もう一度「できた」を押してね');
      }
    },
    [toast],
  );

  // while decorating, keep it saved a moment after each change
  useEffect(() => {
    if (!editing || !layout || !dirty.current) return;
    const t = setTimeout(() => void save(layout, true), 2500);
    return () => clearTimeout(t);
  }, [layout, editing, save]);

  if (!layout) return <div className="mx-auto aspect-[3/4] w-full max-w-[520px] animate-pulse rounded-3xl bg-white/10" />;

  const change = (f: (l: AtelierLayout) => AtelierLayout) => {
    dirty.current = true;
    setLayout((l) => (l ? f(l) : l));
  };
  const patch = (id: string, p: Partial<AtelierItem>) => change((l) => ({ ...l, items: l.items.map((it) => (it.id === id ? { ...it, ...p } : it)) }));
  const full = layout.items.length >= ATELIER_MAX_ITEMS;

  const add = (p: Omit<AtelierItem, 'id' | 'x' | 'y' | 'size' | 'rot' | 'flip'>, size: number, on: 'wall' | 'floor') => {
    if (full) return toast.show('これ以上は置けない。どれかをしまってね');
    const id = newItemId();
    // the first free spot (wall: three rows of three; floor: one row), else somewhere near the middle
    const spots = on === 'wall' ? [0.2, 0.4, 0.58].flatMap((y) => [0.24, 0.5, 0.76].map((x) => ({ x, y }))) : [0.24, 0.5, 0.76].map((x) => ({ x, y: 0.84 }));
    const free = spots.find((s) => layout.items.every((it) => Math.hypot(it.x - s.x, (it.y - s.y) * 1.33) > 0.16));
    const at = free ?? { x: 0.5 + (Math.random() - 0.5) * 0.3, y: on === 'wall' ? 0.4 : 0.84 };
    const it: AtelierItem = { ...p, id, ...at, size, rot: 0, flip: false };
    change((l) => ({ ...l, items: p.kind === 'deco' && decoById(p.ref)?.back ? [it, ...l.items] : [...l.items, it] }));
    setSel(id);
  };

  const onDown = (e: React.PointerEvent, it: AtelierItem) => {
    if (!editing || !room.current) return;
    e.stopPropagation();
    const r = room.current.getBoundingClientRect();
    drag.current = { id: it.id, dx: (e.clientX - r.left) / r.width - it.x, dy: (e.clientY - r.top) / r.height - it.y, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSel(it.id);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !room.current) return;
    const r = room.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width - d.dx));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height - d.dy));
    d.moved = true;
    patch(d.id, { x, y });
  };
  const onUp = () => {
    drag.current = null;
  };

  const tap = (it: AtelierItem) => {
    if (editing) return;
    if (it.kind === 'song' && it.url) {
      if (playing === it.id) {
        audio.current?.pause();
        setPlaying(null);
        return;
      }
      audio.current?.pause();
      const a = new Audio(it.url);
      a.onended = () => setPlaying(null);
      audio.current = a;
      void a.play().catch(() => setPlaying(null));
      setPlaying(it.id);
      return;
    }
    if (it.kind !== 'deco') setClose(it);
  };

  const selected = layout.items.find((it) => it.id === sel) ?? null;
  const tools: { label: string; on: () => void }[] = selected
    ? [
        { label: '－', on: () => patch(selected.id, { size: Math.max(0.06, selected.size * 0.85) }) },
        { label: '＋', on: () => patch(selected.id, { size: Math.min(0.9, selected.size * 1.15) }) },
        { label: '↻', on: () => patch(selected.id, { rot: ((selected.rot + 195) % 360) - 180 }) },
        { label: '⇋', on: () => patch(selected.id, { flip: !selected.flip }) },
        { label: '前へ', on: () => change((l) => ({ ...l, items: [...l.items.filter((x) => x.id !== selected.id), selected] })) },
        {
          label: 'しまう',
          on: () => {
            change((l) => ({ ...l, items: l.items.filter((x) => x.id !== selected.id) }));
            setSel(null);
          },
        },
      ]
    : [];

  return (
    <div className={`mx-auto w-full transition-[max-width] ${editing ? 'max-w-[400px]' : 'max-w-[520px]'}`}>
      <div
        ref={room}
        className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden rounded-3xl border-4 border-white/70 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerDown={() => editing && setSel(null)}
      >
        <div className="absolute inset-x-0 top-0" style={{ height: `${WALL_H * 100}%`, background: wallCss(layout.wall) }} />
        <div className="absolute inset-x-0 bottom-0 shadow-[inset_0_10px_14px_-8px_rgba(0,0,0,0.35)]" style={{ height: `${(1 - WALL_H) * 100}%`, background: floorCss(layout.floor) }} />
        {layout.items.map((it) => (
          <div
            key={it.id}
            className={`absolute ${editing ? 'cursor-grab' : 'cursor-pointer'} ${sel === it.id && editing ? 'rounded-xl outline-dashed outline-2 outline-offset-4 outline-violet-500' : ''}`}
            style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%`, width: it.size * roomW, transform: `translate(-50%, -50%) rotate(${it.rot}deg) scaleX(${it.flip ? -1 : 1})` }}
            onPointerDown={(e) => onDown(e, it)}
            onClick={() => tap(it)}
          >
            <PieceView it={it} px={it.size * roomW} playing={playing === it.id} />
          </div>
        ))}
        {layout.items.length === 0 && !editing && (
          <div className="absolute inset-x-6 top-[38%] rounded-2xl bg-white/80 p-4 text-center text-sm font-bold text-stone-600">
            まだ何もない、{me?.displayName ?? ''}のアトリエ。{'\n'}〔🎨 かざる〕で、旅で作ったものを飾ろう
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-2 flex min-h-11 flex-wrap justify-center gap-1.5">
          {selected ? (
            tools.map((t) => (
              <button key={t.label} onClick={t.on} className={`h-10 min-w-10 rounded-full px-3 text-sm font-black ${t.label === 'しまう' ? 'bg-rose-500/90 text-white' : 'bg-white/90 text-stone-700'}`}>
                {t.label}
              </button>
            ))
          ) : (
            <p className="py-2 text-xs text-white/60">飾ったものをタップすると、動かしたり大きさを変えたりできるよ</p>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-center gap-2">
        {editing ? (
          <button
            onClick={() => {
              setEditing(false);
              setSel(null);
              void save(layout);
            }}
            className="rounded-full bg-violet-500 px-8 py-3 text-base font-black text-white shadow-lg"
          >
            できた
          </button>
        ) : (
          <button onClick={() => setEditing(true)} className="rounded-full bg-white px-8 py-3 text-base font-black text-violet-600 shadow-lg">
            🎨 かざる
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 rounded-3xl bg-white/95 p-3 text-stone-700 shadow-xl">
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-full bg-stone-100 p-1 text-sm font-black">
            {(
              [
                ['mine', '作ったもの'],
                ['deco', 'かざり'],
                ['room', 'へや'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className={`rounded-full py-2 ${tab === id ? 'bg-white text-violet-600 shadow' : 'text-stone-500'}`}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'mine' &&
            (pieces.length ? (
              <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto">
                {pieces.map((p) => (
                  <button
                    key={p.key}
                    disabled={full}
                    onClick={() => add({ kind: p.kind, ref: p.ref, url: p.url, poster: p.poster, text: p.text.slice(0, 80) }, KIND_SIZE[p.kind], p.kind === 'bati' ? 'floor' : 'wall')}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-stone-50 p-2 active:scale-95 disabled:opacity-40"
                  >
                    <div className="flex h-16 w-full items-center justify-center">
                      <PieceView it={{ id: p.key, kind: p.kind, ref: p.ref, url: p.url, poster: p.poster, text: p.text, x: 0, y: 0, size: 0.2, rot: 0, flip: false }} px={p.kind === 'mv' || p.kind === 'kororin' ? 90 : 60} playing={false} />
                    </div>
                    <span className="line-clamp-1 w-full text-center text-[11px] font-bold text-stone-500">{p.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-stone-400">旅で作ったものが、ここに並びます</p>
            ))}
          {tab === 'deco' && (
            <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto">
              {DECOS.map((d) => (
                <button
                  key={d.id}
                  disabled={full}
                  onClick={() => add({ kind: 'deco', ref: d.id, url: null, poster: null, text: '' }, d.size, d.on)}
                  className="flex flex-col items-center gap-1 rounded-2xl bg-stone-50 p-2 active:scale-95 disabled:opacity-40"
                >
                  <div className="flex h-12 w-full items-center justify-center">
                    <DecoImage id={d.id} px={48} />
                  </div>
                  <span className="text-[10px] font-bold text-stone-500">{d.label}</span>
                </button>
              ))}
            </div>
          )}
          {tab === 'room' && (
            <div className="space-y-3">
              <SurfacePicker title="かべがみ" list={WALLS} value={layout.wall} onPick={(id) => change((l) => ({ ...l, wall: id }))} />
              <SurfacePicker title="ゆか" list={FLOORS} value={layout.floor} onPick={(id) => change((l) => ({ ...l, floor: id }))} />
            </div>
          )}
        </div>
      )}

      {close && (
        <button className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-6" onClick={() => setClose(null)}>
          <div className="w-full max-w-sm" onClick={(e) => close.kind === 'mv' && e.stopPropagation()}>
            {close.kind === 'mv' && close.url ? (
              <video src={close.url} poster={close.poster ?? undefined} controls autoPlay playsInline className="aspect-video w-full rounded-2xl bg-black object-contain" />
            ) : (
              <div className="flex justify-center">
                <PieceView it={{ ...close, rot: 0, flip: false }} px={260} playing={false} />
              </div>
            )}
            {close.text && <p className="mt-3 text-center text-sm font-bold text-white/90">{close.text}</p>}
          </div>
          <span className="mt-4 text-xs tracking-widest text-white/50">とじる</span>
        </button>
      )}
      {toast.node}
    </div>
  );
}

function SurfacePicker({ title, list, value, onPick }: { title: string; list: { id: string; label: string; css: string }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-black text-stone-500">{title}</p>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {list.map((s) => (
          <button key={s.id} onClick={() => onPick(s.id)} className="flex shrink-0 flex-col items-center gap-1">
            <span className={`block h-12 w-12 rounded-xl border-2 ${value === s.id ? 'border-violet-500' : 'border-stone-200'}`} style={{ background: s.css }} />
            <span className="text-[10px] font-bold text-stone-500">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DecoImage({ id, px }: { id: string; px: number }) {
  const [broken, setBroken] = useState(false);
  const d = decoById(id);
  if (broken || !d)
    return (
      <span className="block text-center leading-none drop-shadow-md" style={{ fontSize: px * 0.8 }}>
        {d?.emoji ?? '✨'}
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/atelier/${id}.webp`} alt={d.label} draggable={false} onError={() => setBroken(true)} className="pointer-events-none w-full drop-shadow-md" />
  );
}

/** How a placed piece looks, `px` wide. */
function PieceView({ it, px, playing }: { it: AtelierItem; px: number; playing: boolean }) {
  switch (it.kind) {
    case 'deco':
      return <DecoImage id={it.ref} px={px} />;
    case 'sticker':
      return <Sticker s={{ text: it.text, url: it.url }} size={px} />;
    case 'song':
      return (
        <div className="pointer-events-none flex flex-col items-center">
          <Record s={{ text: it.text, url: it.poster }} playing={playing} size={px} />
        </div>
      );
    case 'mv':
      return (
        <div className="pointer-events-none rounded-lg border-[5px] border-stone-800 bg-black shadow-lg" style={{ borderWidth: Math.max(3, px * 0.04) }}>
          <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-gradient-to-br from-rose-400 to-violet-600">
            {it.poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.poster} alt="" draggable={false} className="h-full w-full object-cover" />
            )}
            <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow" style={{ fontSize: px * 0.18 }}>
              ▶
            </span>
          </div>
        </div>
      );
    case 'kororin':
      return (
        <div className="pointer-events-none rounded-full bg-gradient-to-b from-violet-300 to-violet-500 px-[8%] py-[7%] text-center font-bold leading-snug text-white shadow-[0_6px_16px_rgba(90,50,160,0.4)] [word-break:keep-all]" style={{ fontSize: Math.max(9, px * 0.075) }}>
          {it.text}
        </div>
      );
    case 'look':
      return (
        <div className="pointer-events-none rounded-[45%] bg-gradient-to-b from-amber-200 to-amber-500 p-[7%] shadow-lg">
          {it.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.url} alt="" draggable={false} className="aspect-[4/5] w-full rounded-[45%] object-cover" />
          )}
        </div>
      );
    case 'bati':
      return it.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={it.url} alt="" draggable={false} className="pointer-events-none w-full rounded-full drop-shadow-lg" />
      ) : null;
  }
}
