'use client';

import { isRemovableWorkKind, lyricBlockLabels, lyricHintLabel, type BookView, type GameView, type MarkedKind, type SongLyrics } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { PlanetMark } from '@/components/bluena/PlanetMark';
import { StarButton, useMarkRing } from '@/components/finds/MarkRing';
import { GLASS } from '@/components/talk/TalkScene';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { madeWhen } from '@/lib/bluena/find';
import { music, useMusic } from '@/lib/bluena/musicEngine';
import { BookReader, bookCoverUrl, bookSub } from './BookRead';
import { fullWork, songVersions, trackOf } from './bluenaWork';
import { flownLine } from './Drawers';
import { GameFrame, GameFull } from './GamePlay';
import { KIND_WORD } from './intent';
import { discard, fly, type Ctx } from './makers';
import { STORAGE_EVENT } from '@/components/bluena/StorageBar';
import { ReelPlayer } from './ReelPlayer';
import { refreshWork, stale } from './refresh';
import { face, LOOK_CSS, spellLookFor, Talisman, useSpellFont } from './spellLooks';
import { KindMark } from './WorkCard';
import { FLIES, type Work } from './work';

/**
 * R16 (client 2026-11-25, 「ブルーナが送るだけの道具になっている。保存した作品を、ただ聴いたり見たりいじったりしたい」): a
 * work opened from Bluena — 鑑賞, full screen. A tap on a work in Bluena always comes here (not 〔送る〕). Per kind: a song
 * plays with its progress and its lyrics with their section labels (its free changes switch at the top); a picture big,
 * pinched / double-tapped to zoom; a video plays; a book opens in its reader; a game in its sandbox; a radio show or a
 * kororin plays. Each shows its title, the day it was made, the talismans of its spell (small, read only, in its kind's
 * look), ★ and 〔星へ飛ばす〕 where its planet takes it. 〔バティといじる〕 takes it to {bati}'s talk as the work being
 * changed (「どういじる？」). 〔送る〕 only when Bluena was opened in a talk. Few buttons.
 */
export type ViewItem = { key: string; work: Work; title: string; createdAt: string; mark: { kind: MarkedKind; id: string } };

/** the kinds {bati} can change from here (a free song change, a video re-rendered, a picture redone, a book's next chapter, a game's tweak) */
export const EDITABLE = new Set<Work['kind']>(['song', 'art', 'video', 'novel', 'game']);

const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export function BluenaView({ item, ctx, onClose, onEdit, onSend, autoplay, autoOpen, onChanged }: {
  item: ViewItem;
  ctx: Ctx;
  onClose: () => void;
  /** 〔バティといじる〕 */
  onEdit?: (w: Work) => void;
  /** only in a talk: 〔送る〕 (to that ダチ, or to {bati} as material) */
  onSend?: (w: Work) => void;
  /** a song asked for in words (「〇〇流して」) plays at once */
  autoplay?: boolean;
  /** a book / a game asked for in words opens straight in its reader / sandbox */
  autoOpen?: boolean;
  onChanged?: () => void;
}) {
  const { me } = useAuth();
  const [w, setW] = useState<Work>(() => fullWork(item.work));
  useEffect(() => {
    const f = fullWork(item.work);
    setW(f);
    // a card saved while it was still being made: looked at on the server (refresh.ts, as the talks do)
    if (!stale(f)) return;
    let live = true;
    void refreshWork(f, f.origin?.talkId).then((x) => live && x.status === 'ready' && setW(x));
    return () => {
      live = false;
    };
  }, [item.work]);
  const [line, setLine] = useState('');
  const ring = useMarkRing();
  const kind = w.kind;
  const planet = FLIES[kind];
  const canFly = !!planet && !w.flown && (kind !== 'song' || ctx.live || !!w.ref?.demoSong);
  const sound = kind === 'song' || kind === 'radio' || kind === 'voice';
  const look = spellLookFor(kind);
  useSpellFont(look);
  const doFly = async () => {
    try {
      await fly(w, ctx);
      setW({ ...w, flown: true });
      setLine(flownLine(kind, me?.displayName));
      onChanged?.();
    } catch {
      setLine('うまくいかなかった…');
    }
  };
  // R18 (client 2026-11-25): 〔消す〕 — small, with a confirmation; the work, its tries, its stems / versions and their files
  const removable = item.mark.kind === 'local' || isRemovableWorkKind(item.mark.kind);
  const [removing, setRemoving] = useState(false);
  const doRemove = async () => {
    if (!confirm('ブルーナから消す？　別の版や分けた音も、いっしょに消えるよ。もとには戻せないよ。')) return;
    setRemoving(true);
    try {
      if (item.mark.kind === 'local') await discard(w);
      else await getApi().removeWork(item.mark.kind, item.mark.id);
      window.dispatchEvent(new Event(STORAGE_EVENT));
      onChanged?.();
      onClose();
    } catch {
      setLine('うまく消せなかった…');
      setRemoving(false);
    }
  };
  return (
    <div className="absolute inset-0 z-[55] flex flex-col overflow-hidden bg-[#070b24] text-[#f4f1ff]" role="dialog" aria-label={`${item.title || KIND_WORD[kind]}を見る`} data-testid="bluena-view" data-kind={kind}>
      <style>{`${LOOK_CSS}@keyframes bv-in{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:none}}@keyframes bv-spin{to{transform:rotate(360deg)}}`}</style>
      {/* the work's own picture, blurred, behind everything */}
      {(w.image || w.poster) && kind !== 'art' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={(w.image || w.poster)!} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-2xl" />
      )}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 70% at 50% 0%, rgba(40,60,140,.55), rgba(7,11,36,.2) 55%, rgba(5,6,15,.85))' }} />
      <div className="pt-safe relative z-[1] flex min-h-0 flex-1 flex-col" style={{ animation: 'bv-in .25s ease-out both' }}>
        <header className="flex items-center gap-2.5 px-3.5 py-2.5">
          <button onClick={onClose} aria-label="とじる" className={GLASS} data-testid="bluena-view-close">
            ✕
          </button>
          <span className="min-w-0 flex-1 text-center">
            <b className="block truncate text-[15.5px] font-black tracking-[0.03em] [text-shadow:0_1px_8px_rgba(0,0,0,.6)]">{item.title || w.title || KIND_WORD[kind]}</b>
            <span className="block text-[11px] text-[#c9cff5]/80">
              {KIND_WORD[kind]}・{madeWhen(item.createdAt)}
            </span>
          </span>
          <span className={`${GLASS} !w-auto min-w-[42px] px-2`}>
            <StarButton kind={item.mark.kind} id={item.mark.id} size={16} onRing={(at) => ring.open(item.mark.kind, item.mark.id, at)} />
          </span>
        </header>

        <div className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          {sound && <SoundView w={w} id={item.key} title={item.title || w.title || ''} autoplay={autoplay} />}
          {(kind === 'art' || kind === 'image' || kind === 'look' || kind === 'bati') && w.image && <ZoomImage src={w.image} alt={item.title} />}
          {kind === 'video' && <VideoView w={w} />}
          {kind === 'novel' && <BookPane w={w} autoOpen={autoOpen} />}
          {kind === 'game' && <GamePane w={w} autoOpen={autoOpen} />}
          {!!w.spell?.length && (
            <div className="mt-4" data-testid="bluena-view-spell">
              <p className="mb-1 text-center text-[10.5px] tracking-[0.2em] text-sky-100/60">スペル</p>
              <div className="flex flex-wrap items-start justify-center gap-x-1 gap-y-1.5" style={{ zoom: look === 'reifu' ? 0.55 : 0.72 }} aria-label={w.spell.map((t) => t.ja).join('・')}>
                {w.spell.slice(0, 12).map((t, i) => (
                  <Talisman key={`${t.ja}-${i}`} look={look} tilt={((t.ja.length * 7 + i * 3) % 9) - 4} tag={t} mode="still" delay={i * 40} />
                ))}
              </div>
            </div>
          )}
        </div>

        {line && <p className="relative z-[1] pb-1 text-center text-[12px] text-sky-100/85">{line}</p>}
        <footer className="pb-safe relative z-[1] flex items-center justify-center gap-2.5 px-4 pb-4 pt-2">
          {onEdit && EDITABLE.has(kind) && (
            <button onClick={() => onEdit(w)} className="flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-black text-[#070b24] shadow-[0_6px_22px_rgba(140,170,255,.45)]" style={{ background: 'radial-gradient(circle at 35% 30%,#ffffff,#cdd8ff 55%,#9fb2ff)' }} data-testid="bluena-edit">
              バティといじる
            </button>
          )}
          {planet && (canFly || w.flown) && (
            <button onClick={() => canFly && void doFly()} disabled={!canFly} aria-label={w.flown ? '星にいる' : '星へ飛ばす'} className="flex h-12 items-center gap-1.5 rounded-full border border-sky-200/40 bg-[rgba(16,22,64,.6)] px-4 text-[12.5px] font-bold text-sky-50 backdrop-blur disabled:opacity-60" data-testid="bluena-fly">
              <PlanetMark id={planet} size={18} />
              {w.flown ? '星にいる' : '星へ'}
            </button>
          )}
          {onSend && (
            <button onClick={() => onSend(w)} className="h-9 rounded-full border border-[rgba(210,220,255,.3)] px-3 text-[12px] text-[#dfe4ff]/85" data-testid="bluena-view-send">
              送る
            </button>
          )}
          {removable && (
            <button onClick={() => void doRemove()} disabled={removing} className="h-9 rounded-full px-2.5 text-[11.5px] text-[#dfe4ff]/55 underline-offset-2 hover:underline disabled:opacity-40" data-testid="bluena-view-remove">
              消す
            </button>
          )}
        </footer>
      </div>
      {ring.node}
    </div>
  );
}

/** a song / a radio show / a kororin: ▶, its progress, its versions, its lyrics */
function SoundView({ w, id, title, autoplay }: { w: Work; id: string; title: string; autoplay?: boolean }) {
  const st = useMusic();
  const versions = w.kind === 'song' ? songVersions(w) : [];
  const [vi, setVi] = useState(Math.max(0, versions.length - 1));
  const v = versions[vi];
  const key = versions.length > 1 ? `${id}#${vi}` : id;
  const track = trackOf(w, key, v?.audio && v.audio !== 'synth:' ? v.audio : undefined);
  const mine = st.track?.id === key;
  const on = mine && (st.status === 'playing' || st.status === 'loading');
  // the corner player hides while this viewer shows its own track
  useEffect(() => {
    music.viewer(!!st.track && st.track.id.split('#')[0] === id);
  }, [st.track, id]);
  useEffect(() => () => music.viewer(false), []);
  const started = useRef(false);
  useEffect(() => {
    if (!autoplay || started.current || !track) return;
    started.current = true;
    music.play(track);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);
  const toggle = () => {
    if (!track) return;
    if (mine) music.toggle();
    else music.play(track);
  };
  const lyrics: SongLyrics | undefined = v?.lyrics ?? w.lyrics;
  const plain = !lyrics && w.ref?.demoSong?.lyrics?.length ? w.ref.demoSong.lyrics : null;
  const dur = mine ? st.dur : (track?.seconds ?? 0);
  const at = mine ? st.at : 0;
  const pic = w.image || w.poster;
  return (
    <div className="flex flex-col items-center" data-testid="bluena-sound">
      <div className="relative mt-2 grid aspect-square w-[min(56vw,250px)] place-items-center">
        <span className="absolute inset-0 rounded-full shadow-[0_18px_50px_rgba(0,0,0,.55)]" style={{ background: pic ? undefined : 'conic-gradient(from 210deg, #26407e, #6cc9f0, #8a6cf0, #26407e)', animation: on ? 'bv-spin 14s linear infinite' : undefined }}>
          {pic && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pic} alt="" className="h-full w-full rounded-full object-cover" />
          )}
        </span>
        <span className="absolute h-[18%] w-[18%] rounded-full border border-white/30 bg-[#070b24]/80" />
        {!pic && (
          <span className="absolute left-1/2 top-[22%] -translate-x-1/2 text-white/80">
            <KindMark kind={w.kind} className="h-8 w-8" />
          </span>
        )}
      </div>
      <div className="mt-4 flex w-full max-w-md items-center gap-3">
        <button onClick={toggle} disabled={!track} aria-label={on ? '止める' : '再生'} className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-[20px] text-[#070b24] shadow-[0_6px_22px_rgba(140,170,255,.45)] disabled:opacity-40" style={{ background: 'radial-gradient(circle at 35% 30%,#ffffff,#cdd8ff 55%,#9fb2ff)' }} data-testid="bluena-play">
          {on ? '❚❚' : '▶'}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(1, dur)}
            step={0.5}
            value={Math.min(at, dur || at)}
            onChange={(e) => mine && music.seek(Number(e.target.value))}
            aria-label="どこから"
            className="h-2 w-full accent-sky-200"
            data-testid="bluena-progress"
          />
          <div className="flex justify-between text-[10.5px] tabular-nums text-sky-100/70">
            <span>{fmt(at)}</span>
            <span>{dur ? fmt(dur) : ''}</span>
          </div>
        </div>
      </div>
      {versions.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5" data-testid="bluena-versions">
          {versions.map((x, i) => (
            <button
              key={i}
              onClick={() => {
                const was = on;
                setVi(i);
                if (was) {
                  const t = trackOf(w, versions.length > 1 ? `${id}#${i}` : id, x.audio && x.audio !== 'synth:' ? x.audio : undefined);
                  if (t) music.play(t);
                }
              }}
              aria-pressed={i === vi}
              className={`min-w-8 rounded-full px-2.5 py-1 text-[12px] font-bold ${i === vi ? 'bg-sky-200 text-[#070b24]' : 'border border-sky-200/30 text-sky-100/80'}`}
            >
              {x.label}
            </button>
          ))}
          {v?.what && <span className="w-full text-center text-[11px] text-sky-100/70">♪ {v.what}</span>}
        </div>
      )}
      {lyrics && <Lyrics lyrics={lyrics} />}
      {plain && (
        <div className="mt-4 w-full max-w-md space-y-1 text-center text-[14px] leading-relaxed text-white/85" data-testid="bluena-lyrics">
          {plain.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
      {!lyrics && !plain && w.text && <p className="mt-4 max-w-md whitespace-pre-line text-center text-[14px] leading-relaxed text-white/85">{w.text}</p>}
      {!track && <p className="mt-3 text-[12px] text-white/60">この音は、いまは流せないみたい</p>}
    </div>
  );
}

/** the lyrics as sung, each part with its label (Aメロ・サビ …) */
function Lyrics({ lyrics }: { lyrics: SongLyrics }) {
  const labels = lyricBlockLabels(lyrics);
  return (
    <div className="mt-5 w-full max-w-md rounded-2xl bg-[rgba(70,150,230,.10)] px-4 py-3" style={{ boxShadow: 'inset 0 0 0 1px rgba(190,240,255,.18)' }} data-testid="bluena-lyrics">
      {lyrics.blocks.map((b, i) => (
        <div key={i} className="mb-3 last:mb-0">
          <span className="mb-1 inline-flex items-center gap-1">
            <span className="rounded-[4px] px-2 py-[2px] text-[11px] font-bold leading-tight text-sky-50" style={{ background: 'rgba(110,200,255,.24)', boxShadow: 'inset 0 0 0 1px rgba(210,248,255,.45)', fontFamily: face('hikari') }}>
              {labels[i]}
            </span>
            {b.hints.map((h) => (
              <span key={h} className="rounded-[4px] px-1.5 py-[1px] text-[10px] leading-tight text-violet-50/90" style={{ background: 'rgba(170,140,255,.2)' }}>
                {lyricHintLabel(h)}
              </span>
            ))}
          </span>
          {b.lines.map((l, j) => (
            <p key={j} className="m-0 text-[15px] leading-[1.75] text-white/90">
              {l}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

/** a picture, big: two fingers (or the wheel) zoom, one finger moves it when zoomed, a double tap zooms in / out */
export function ZoomImage({ src, alt }: { src: string; alt?: string }) {
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const zr = useRef(z);
  zr.current = z;
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef<{ d: number; s: number; cx: number; cy: number; x: number; y: number } | null>(null);
  const clampS = (s: number) => Math.max(1, Math.min(5, s));
  const set = (n: { s: number; x: number; y: number }) => setZ(n.s <= 1.01 ? { s: 1, x: 0, y: 0 } : n);
  const begin = () => {
    const p = [...pts.current.values()];
    const c = zr.current;
    if (p.length >= 2) g.current = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, s: c.s, cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2, x: c.x, y: c.y };
    else if (p.length === 1) g.current = { d: 0, s: c.s, cx: p[0].x, cy: p[0].y, x: c.x, y: c.y };
    else g.current = null;
  };
  return (
    <div
      className="relative mt-1 flex h-[calc(100svh-210px)] min-h-[300px] touch-none select-none items-center justify-center overflow-hidden rounded-2xl"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        begin();
      }}
      onPointerMove={(e) => {
        if (!pts.current.has(e.pointerId) || !g.current) return;
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const p = [...pts.current.values()];
        const s0 = g.current;
        if (p.length >= 2) {
          const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
          const cx = (p[0].x + p[1].x) / 2;
          const cy = (p[0].y + p[1].y) / 2;
          set({ s: clampS((s0.s * d) / s0.d), x: s0.x + cx - s0.cx, y: s0.y + cy - s0.cy });
        } else if (zr.current.s > 1) set({ s: zr.current.s, x: s0.x + p[0].x - s0.cx, y: s0.y + p[0].y - s0.cy });
      }}
      onPointerUp={(e) => {
        pts.current.delete(e.pointerId);
        begin();
      }}
      onPointerCancel={(e) => {
        pts.current.delete(e.pointerId);
        begin();
      }}
      onDoubleClick={() => set(zr.current.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 })}
      onWheel={(e) => set({ ...zr.current, s: clampS(zr.current.s * Math.exp(-e.deltaY / 400)) })}
      data-testid="bluena-zoom"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt ?? ''} draggable={false} className="max-h-full max-w-full rounded-2xl object-contain shadow-[0_18px_50px_rgba(0,0,0,.55)]" style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})`, transition: g.current ? 'none' : 'transform .2s ease-out' }} />
      {z.s === 1 && <span className="pointer-events-none absolute bottom-2 rounded-full bg-black/40 px-2.5 py-0.5 text-[10.5px] text-white/75">ふたつの指で、大きく</span>}
    </div>
  );
}

function VideoView({ w }: { w: Work }) {
  if (w.video)
    return (
      <div className="mt-2 overflow-hidden rounded-2xl bg-black shadow-[0_18px_50px_rgba(0,0,0,.55)]" data-testid="bluena-video">
        <video src={w.video} poster={w.poster ?? undefined} controls playsInline autoPlay onPlay={() => music.other()} className="max-h-[calc(100svh-230px)] w-full bg-black" />
      </div>
    );
  if (w.reel)
    return (
      <div className="mt-2" data-testid="bluena-video">
        <ReelPlayer reel={w.reel} title={w.title?.replace(/（MV）$/, '')} />
      </div>
    );
  return w.poster || w.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={(w.poster || w.image)!} alt="" className="mt-2 w-full rounded-2xl" />
  ) : (
    <p className="py-10 text-center text-[13px] text-white/60">この映像は、いまは見られないみたい</p>
  );
}

function useLoaded<T>(have: T | undefined, id: string | undefined, load: (id: string) => Promise<T>) {
  const [x, setX] = useState<T | null | 'none'>(have ?? null);
  useEffect(() => {
    if (have) return setX(have);
    if (!id) return setX('none');
    let live = true;
    load(id)
      .then((v) => live && setX(v))
      .catch(() => live && setX('none'));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [have, id]);
  return x;
}
const loadBook = (id: string) => getApi().book(id);
const loadGame = (id: string) => getApi().game(id);

function BookPane({ w, autoOpen }: { w: Work; autoOpen?: boolean }) {
  const b = useLoaded<BookView>(w.book, w.ref?.bookId, loadBook);
  const [open, setOpen] = useState<number | null>(null);
  const did = useRef(false);
  useEffect(() => {
    if (!autoOpen || did.current || !b || b === 'none') return;
    did.current = true;
    setOpen(0);
  }, [autoOpen, b]);
  if (b === 'none') return <p className="py-10 text-center text-[13px] text-white/60">この本は、いまは読めないみたい</p>;
  if (!b) return <p className="py-10 text-center text-white/50">…</p>;
  return (
    <div className="mt-3 flex flex-col items-center" data-testid="bluena-book">
      <button onClick={() => setOpen(0)} aria-label="読む" className="w-[min(52vw,220px)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.cover ?? bookCoverUrl(b.title, bookSub(b))} alt="" className="w-full rounded-lg shadow-[0_18px_40px_rgba(0,0,0,.55)]" />
      </button>
      <p className="mt-3 text-[12px] text-amber-100/70">{b.done ? `全${b.chapters.length}章・おしまい` : `第${b.chapters.length}章まで`}</p>
      <button onClick={() => setOpen(0)} className="mt-2 rounded-full bg-amber-200 px-6 py-2 text-[14px] font-bold text-slate-950" data-testid="bluena-read">
        よむ
      </button>
      {open != null && <BookReader book={b} start={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function GamePane({ w, autoOpen }: { w: Work; autoOpen?: boolean }) {
  const g = useLoaded<GameView>(w.game, w.ref?.gameId, loadGame);
  const [full, setFull] = useState(false);
  const did = useRef(false);
  useEffect(() => {
    if (!autoOpen || did.current || !g || g === 'none') return;
    did.current = true;
    setFull(true);
  }, [autoOpen, g]);
  if (g === 'none') return <p className="py-10 text-center text-[13px] text-white/60">このゲームは、いまは遊べないみたい</p>;
  if (!g) return <p className="py-10 text-center text-white/50">…</p>;
  return (
    <div className="mt-2 flex flex-col items-center" data-testid="bluena-game">
      <GameFrame game={g} className="aspect-[3/4] w-full max-w-md rounded-2xl" />
      {g.howTo && <p className="mt-1.5 text-center text-[12px] text-amber-50/80">{g.howTo}</p>}
      <button onClick={() => setFull(true)} className="mt-2 rounded-full bg-amber-200 px-5 py-2 text-[13px] font-bold text-slate-950">
        ▶ 全画面で遊ぶ
      </button>
      {full && <GameFull game={g} onClose={() => setFull(false)} />}
    </div>
  );
}
