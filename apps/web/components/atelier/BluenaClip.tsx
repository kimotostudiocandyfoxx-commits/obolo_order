'use client';

import { CLIP_WORD, STORAGE_LINES, MEDIA_POLICY, type ClipFile, type ClipKind } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { getApi } from '@/lib/api';
import { usePartner } from '@/lib/partner';
import { CLIP_ACCEPT, extOf, keptWhen, lengthWord, progressOf, readyFiles, rowProgress, rowsOf, rowSub, sheetWords, sizeWord, type ClipMode, type ClipRow } from '@/lib/clip/rows';
import { ZoomImage } from './BluenaView';
import { clipsChanged, clipUrl, sendClips, uploadClip, useClips, useClipUrl } from '@/lib/clip/useClip';

/**
 * Bluena's 📎 (client 2026-11-24): pictures, films, sounds and files from the member's own phone / iPad. The paperclip
 * in Bluena's row of buttons opens the device's own picker (on iOS: the photo library, the camera, Files); what was
 * picked shows in a small sheet, each going up at once with its bar (✕ drops one), then 〔送る〕 into the open ダチ talk,
 * 〔わたす〕 to {bati}, or — in the hall / on the plain — 〔しまう〕 into Bluena. Everything sent is in Bluena afterwards
 * (ClipRows). In a talk each file shows as ClipView. Private: the bytes are fetched with the session (useClip.ts).
 */

const PILL = 'rounded-full border border-[rgba(210,220,255,.3)] bg-[rgba(16,22,64,.6)] text-[#f4f1ff] backdrop-blur';
const GO = 'rounded-full bg-[rgba(223,230,255,.92)] font-bold text-[#070b24] shadow-[0_4px_12px_rgba(0,0,0,.35)] disabled:opacity-40';

/** the paperclip */
export function ClipMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.5 11.6 12.3 19.8a5.3 5.3 0 0 1-7.5-7.5l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9" />
    </svg>
  );
}

/** each kind's small mark (a picture, a film, a note, a page) */
export function ClipKindMark({ kind, className = 'h-5 w-5' }: { kind: ClipKind | null; className?: string }) {
  const p = {
    viewBox: '0 0 24 24',
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (kind === 'photo')
    return (
      <svg {...p}>
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />
      </svg>
    );
  if (kind === 'video')
    return (
      <svg {...p}>
        <rect x="3" y="6" width="13" height="12" rx="2.5" />
        <path d="m16 10.5 5-3v9l-5-3z" />
      </svg>
    );
  if (kind === 'audio')
    return (
      <svg {...p}>
        <path d="M9 18V6.5l10-2V16" />
        <circle cx="6.8" cy="18" r="2.3" />
        <circle cx="16.8" cy="16" r="2.3" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z" />
      <path d="M14 3.5V8h4.5M9 12.5h6M9 15.5h6" />
    </svg>
  );
}

/** a sound's bars (still; they move while it plays) */
function Bars({ on, n = 14, className = '' }: { on?: boolean; n?: number; className?: string }) {
  return (
    <span className={`flex h-5 items-end gap-[2.5px] ${className}`} aria-hidden>
      {Array.from({ length: n }, (_, k) => (
        <span
          key={k}
          className="w-[3px] rounded-full bg-current"
          style={{
            opacity: 0.6,
            height: `${28 + ((k * 41) % 72)}%`,
            animation: on ? `talk-nod ${0.5 + (k % 3) * 0.15}s ease-in-out infinite` : undefined,
          }}
        />
      ))}
    </span>
  );
}

/** a picked file's picture before it is up (its own bytes on the device) */
function LocalThumb({ file, kind }: { file: File | undefined; kind: ClipKind | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    if (!file || (kind !== 'photo' && kind !== 'video')) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, kind]);
  return <Thumb kind={kind} url={bad ? null : url} name={file?.name ?? ''} onBad={() => setBad(true)} />;
}

function Thumb({ kind, url, poster, name, onBad, round }: { kind: ClipKind | null; url: string | null; poster?: string | null; name: string; onBad?: () => void; round?: boolean }) {
  const shape = round ? 'rounded-full' : 'rounded-xl';
  const box = `relative block h-full w-full overflow-hidden ${shape} bg-[#141b44]`;
  if (kind === 'photo' && url)
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" onError={onBad} className="h-full w-full object-cover" />
      </span>
    );
  if (kind === 'video' && (poster || url))
    return (
      <span className={box}>
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="h-full w-full object-cover" />
        ) : (
          <video src={`${url}#t=0.1`} muted playsInline preload="metadata" onError={onBad} className="h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-black/45 text-[10px] text-white">▶</span>
        </span>
      </span>
    );
  if (kind === 'audio')
    return (
      <span className={`${box} flex flex-col items-center justify-center gap-0.5 bg-[linear-gradient(160deg,#27407a,#141b44)] text-sky-100`}>
        <ClipKindMark kind="audio" className="h-4 w-4" />
        <Bars n={7} className="h-3" />
      </span>
    );
  const ext = extOf(name);
  return (
    <span className={`${box} flex flex-col items-center justify-center bg-[linear-gradient(160deg,#3a3f6e,#1a1f4a)] text-[#e9ecff]`}>
      <ClipKindMark kind={kind ?? 'file'} className="h-5 w-5" />
      {ext && kind === 'file' && <span className="mt-0.5 text-[8.5px] font-black tracking-[0.08em]">{ext}</span>}
    </span>
  );
}

/** a kept file's small picture (its own bytes, or a film's poster) */
function KeptThumb({ f, round }: { f: ClipFile; round?: boolean }) {
  const url = useClipUrl(f.kind === 'photo' ? f.id : null);
  const poster = useClipUrl(f.kind === 'video' ? f.posterId : null);
  const film = useClipUrl(f.kind === 'video' && !f.posterId ? f.id : null);
  return <Thumb kind={f.kind} url={url ?? film} poster={poster} name={f.name} round={round} />;
}

/**
 * The paperclip and its sheet. `mode`: where the files go (MoonTabs' BluenaDevice decides: a ダチ talk, {bati}, or
 * Bluena only); `onSent`: after 〔送る〕 / 〔わたす〕 (the device closes, as for a work).
 */
export function BluenaClip({ mode, onSent, onLine }: { mode: ClipMode; onSent?: () => void; onLine?: (s: string) => void }) {
  const partner = usePartner();
  const input = useRef<HTMLInputElement>(null);
  const files = useRef(new Map<string, File>());
  const [rows, setRows] = useState<ClipRow[] | null>(null);
  const rowsRef = useRef<ClipRow[] | null>(null);
  rowsRef.current = rows;
  const dropped = useRef(new Set<string>());
  const [going, setGoing] = useState(false);

  const pick = () => input.current?.click();
  const picked = (list: FileList | null) => {
    if (!list?.length) return;
    const add = rowsOf(
      [...list].map((f) => ({ name: f.name, size: f.size, type: f.type })),
      rowsRef.current?.length ?? 0,
    );
    add.forEach((r, k) => files.current.set(r.key, list[k]));
    setRows((was) => [...(was ?? []), ...add]);
    if (input.current) input.current.value = '';
  };
  const patch = (key: string, p: Partial<ClipRow>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...p } : r)) ?? rs);

  // one at a time, in the order picked
  const busy = rows?.some((r) => r.state === 'up');
  useEffect(() => {
    if (!rows || busy) return;
    const next = rows.find((r) => r.state === 'wait');
    if (!next) return;
    const f = files.current.get(next.key);
    if (!f) return patch(next.key, { state: 'bad', note: 'よみこめなかった' });
    patch(next.key, { state: 'up', sent: 0 });
    void uploadClip(f, (sent) => patch(next.key, { sent }))
      .then((file) => {
        // dropped while it was going up: not kept
        if (dropped.current.has(next.key))
          return void getApi()
            .dropClip(file.id)
            .catch(() => undefined);
        patch(next.key, { state: 'ready', file });
      })
      .catch((e: { code?: string }) =>
        patch(next.key, {
          state: 'bad',
          note:
            e?.code === 'STORAGE_QUOTA'
              ? STORAGE_LINES.full
              : e?.code === 'RATE_LIMITED'
                ? 'すこし、まってからね'
                : e?.code === 'TOO_LARGE'
                  ? '大きすぎるみたい'
                  : 'うまく、よみこめなかった',
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, busy]);

  const drop = (r: ClipRow) => {
    dropped.current.add(r.key);
    if (r.file)
      void getApi()
        .dropClip(r.file.id)
        .catch(() => undefined);
    setRows((rs) => {
      const left = rs?.filter((x) => x.key !== r.key) ?? [];
      return left.length ? left : null;
    });
  };
  /** closed without sending: what went up is not kept */
  const cancel = () => {
    for (const r of rows ?? []) drop(r);
    setRows(null);
  };
  const ready = readyFiles(rows ?? []);
  const waiting = rows?.some((r) => r.state === 'wait' || r.state === 'up');
  const go = () => {
    if (!ready.length) return;
    setGoing(true);
    if (mode !== 'keep') sendClips(mode, ready);
    clipsChanged();
    onLine?.(mode === 'keep' ? `ブルーナに、${ready.length}こ しまったよ` : '');
    setRows(null);
    setGoing(false);
    if (mode !== 'keep') onSent?.();
  };
  const words = sheetWords(mode, partner.name);
  const all = progressOf(rows ?? []);
  const hasVideo = rows?.some((r) => r.kind === 'video' && r.state !== 'bad');

  return (
    <>
      {/* the first tile of Bluena's list: a dashed ring with the paperclip */}
      <li className="flex items-center gap-2">
        <button onClick={pick} aria-label="この端末から、写真や動画をとりこむ" className="flex min-w-0 flex-1 items-center gap-3 text-left" data-testid="bluena-clip">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-dashed border-sky-200/70 bg-[rgba(16,22,64,.55)] text-sky-100 shadow-[0_6px_16px_rgba(0,0,0,.35)] backdrop-blur-sm">
            <ClipMark className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1 rounded-2xl border border-dashed border-sky-200/30 bg-[rgba(10,14,44,.45)] px-3 py-1.5 backdrop-blur-sm">
            <span className="block truncate text-[13.5px] font-bold text-[#f4f1ff]">とりこむ</span>
            <span className="block truncate text-[11px] text-[#c9cff5]/80">写真・動画・音・ファイルを、この端末から</span>
          </span>
        </button>
      </li>
      <li className="contents">
        <input ref={input} type="file" multiple accept={CLIP_ACCEPT} className="hidden" onChange={(e) => picked(e.target.files)} data-testid="bluena-clip-input" />
        {rows && (
          <div className="pointer-events-auto absolute inset-0 z-[40] flex flex-col justify-end" data-testid="bluena-clip-sheet">
            <button aria-label="やめる" onClick={cancel} className="absolute inset-0 cursor-default bg-[rgba(4,6,24,.45)]" />
            <div
              className="pb-safe relative mx-auto w-full max-w-xl rounded-t-[26px] border-t border-sky-200/25 bg-[rgba(12,17,52,.94)] px-4 pt-3 shadow-[0_-12px_40px_rgba(0,0,0,.45)] backdrop-blur-xl"
              style={{ animation: 'bluena-in .25s ease-out both' }}
            >
              <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-white/20" />
              <div className="flex items-center gap-2 pb-2">
                <ClipMark className="h-4 w-4 text-sky-200" />
                <b className="flex-1 text-[14px] text-[#f4f1ff]">{words.title}</b>
                <button onClick={cancel} aria-label="やめる" className="grid h-8 w-8 place-items-center rounded-full text-sky-100/70">
                  ✕
                </button>
              </div>
              <ul className="no-scrollbar max-h-[46svh] space-y-2 overflow-y-auto pb-1">
                {rows.map((r) => (
                  <li key={r.key} className="flex items-center gap-3 rounded-2xl bg-white/[.06] p-2" data-testid="bluena-clip-row">
                    <span className="block h-12 w-12 shrink-0">
                      <LocalThumb file={files.current.get(r.key)} kind={r.kind} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-[#f4f1ff]">{r.name}</span>
                      <span className={`block text-[11px] ${r.state === 'bad' ? 'text-rose-300' : 'text-[#c9cff5]/80'}`}>{rowSub(r)}</span>
                      {r.state !== 'bad' && (
                        <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-white/10">
                          <span
                            className={`block h-full rounded-full ${r.state === 'ready' ? 'bg-emerald-300/90' : 'bg-sky-300/90'} transition-[width] duration-200`}
                            style={{
                              width: `${Math.round(rowProgress(r) * 100)}%`,
                            }}
                          />
                        </span>
                      )}
                    </span>
                    <button onClick={() => drop(r)} aria-label={`${r.name}をやめる`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[.08] text-[12px] text-sky-100/80">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              {hasVideo && <p className="pt-1 text-[10.5px] text-sky-100/60">動画は、はじめの{MEDIA_POLICY.video.maxSeconds}秒まで</p>}
              <div className="flex items-center gap-2 py-3">
                <button onClick={pick} disabled={(rows.length ?? 0) >= 6} className={`${PILL} px-3.5 py-2 text-[12.5px] font-bold disabled:opacity-40`}>
                  ＋ ほかにも
                </button>
                <span className="flex-1" />
                <button onClick={go} disabled={!ready.length || !!waiting || going} className={`${GO} px-6 py-2 text-[13.5px]`} data-testid="bluena-clip-go">
                  {waiting ? `${Math.round(all * 100)}%` : words.go}
                </button>
              </div>
            </div>
          </div>
        )}
      </li>
    </>
  );
}

/**
 * Your 📎 files in Bluena's list (above the works, newest first): a tap opens one; 〔送る〕 in a talk sends it as it is.
 */
export function ClipRows({ mode, onSent, only, q }: { mode: ClipMode; onSent?: () => void; /** R16: the 写真 chip */ only?: 'photo'; /** R16: the search box */ q?: string }) {
  const all = useClips();
  const [open, setOpen] = useState<ClipFile | null>(null);
  const words = (q ?? '').trim().toLowerCase();
  const list = all?.filter((f) => (!only || f.kind === only) && (!words || f.name.toLowerCase().includes(words)));
  if (!list?.length) return null;
  return (
    <>
      {list.map((f, k) => (
        <li key={`clip:${f.id}`} className="flex items-center gap-2" data-testid="bluena-clip-item">
          <button onClick={() => setOpen(f)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span
              className="relative block h-14 w-14 shrink-0 rounded-full border-2 border-sky-200/60 shadow-[0_6px_16px_rgba(0,0,0,.45)]"
              style={{
                animation: `bluena-bob ${3.4 + (k % 3) * 0.5}s ease-in-out ${(k % 5) * 0.3}s infinite`,
              }}
            >
              <KeptThumb f={f} round />
              <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border border-sky-200/50 bg-[#141b44] text-sky-100">
                <ClipMark className="h-3 w-3" />
              </span>
            </span>
            <span className="min-w-0 flex-1 rounded-2xl bg-[rgba(10,14,44,.6)] px-3 py-1.5 backdrop-blur-sm">
              <span className="block truncate text-[13.5px] font-bold text-[#f4f1ff]">{f.name}</span>
              <span className="block text-[11px] text-[#c9cff5]/80">
                {CLIP_WORD[f.kind]}・{keptWhen(f.createdAt)}
              </span>
            </span>
          </button>
          {mode !== 'keep' && (
            <button
              onClick={() => {
                sendClips(mode, [f]);
                onSent?.();
              }}
              className="shrink-0 rounded-full border border-[rgba(210,220,255,.35)] bg-[rgba(10,14,44,.55)] px-2.5 py-1 text-[11px] font-bold text-[#dfe4ff]/90 backdrop-blur"
              data-testid="bluena-clip-send"
            >
              送る
            </button>
          )}
        </li>
      ))}
      {open && (
        <li className="list-none">
          <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[rgba(7,11,36,.86)] px-4 backdrop-blur" onClick={() => setOpen(null)}>
            <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              {open.kind === 'photo' ? <ClipPhotoZoom f={open} /> : <ClipView file={open} big />}
            </div>
            <button className={`${PILL} mt-4 px-5 py-2 text-[13px] font-bold`}>とじる</button>
          </div>
        </li>
      )}
    </>
  );
}

/** R16: a kept photo, big, pinched to zoom (as Bluena's viewer) */
function ClipPhotoZoom({ f }: { f: ClipFile }) {
  const url = useClipUrl(f.id);
  return url ? <ZoomImage src={url} alt={f.name} /> : <ClipView file={f} big />;
}

/** open / save a document (a PDF opens in the browser's viewer; others download) */
export async function openDoc(f: ClipFile) {
  const url = await clipUrl(f.id);
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  a.rel = 'noopener';
  if (f.mime === 'application/pdf') a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * A 📎 file in a talk: a picture (small in the bubble, the whole screen on a tap — TalkScene's card), a film with its
 * poster and the player's controls, a sound with ▶, a document with its name and size (a tap opens / saves it).
 */
export function ClipView({ file: f, big }: { file: ClipFile; big?: boolean }) {
  const url = useClipUrl(f.kind === 'photo' || (f.kind === 'video' && big) ? f.id : null);
  const poster = useClipUrl(f.kind === 'video' ? f.posterId : null);
  if (f.kind === 'photo')
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={f.name} className={big ? 'max-h-[78svh] w-full rounded-2xl object-contain' : 'block aspect-[4/3] w-full object-cover'} data-testid="clip-photo" />
    ) : (
      <span className={`grid ${big ? 'h-64' : 'aspect-[4/3]'} w-full place-items-center rounded-xl bg-[#141b44] text-sky-100/60`}>
        <ClipKindMark kind="photo" className="h-7 w-7" />
      </span>
    );
  if (f.kind === 'video') return <ClipFilm f={f} poster={poster} big={big} />;
  if (f.kind === 'audio') return <ClipSound f={f} />;
  return (
    <button onClick={() => void openDoc(f)} className="flex w-full max-w-[240px] items-center gap-2.5 rounded-xl bg-[#151c4a] p-2 text-left shadow-[0_2px_8px_rgba(0,0,0,.25)] text-[#f4f1ff]" data-testid="clip-doc">
      <span className="block h-11 w-9 shrink-0">
        <Thumb kind="file" url={null} name={f.name} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold">{f.name}</span>
        <span className="block text-[10.5px] text-[#c9cff5]/80">
          {extOf(f.name) || 'ファイル'}・{sizeWord(f.sizeBytes)}
        </span>
      </span>
      <span className="shrink-0 text-[11px] text-sky-100/80">ひらく</span>
    </button>
  );
}

/** a film in the bubble: its poster, then the player (loaded only when asked: films are the heavy ones) */
function ClipFilm({ f, poster, big }: { f: ClipFile; poster: string | null; big?: boolean }) {
  const [on, setOn] = useState(!!big);
  const url = useClipUrl(on ? f.id : null);
  const ratio = f.width && f.height ? `${f.width} / ${f.height}` : '16 / 9';
  return (
    <div
      className={`${big ? 'w-full' : 'w-[min(220px,56vw)]'} overflow-hidden rounded-xl bg-black/60`}
      style={{ aspectRatio: ratio, maxHeight: big ? '78svh' : 260 }}
      onClick={(e) => e.stopPropagation()}
      data-testid="clip-video"
    >
      {on && url ? (
        <video src={url} poster={poster ?? undefined} controls playsInline autoPlay={!big} className="h-full w-full object-contain" />
      ) : (
        <button onClick={() => setOn(true)} className="relative block h-full w-full" aria-label="動画を見る">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-sky-100/50">
              <ClipKindMark kind="video" className="h-8 w-8" />
            </span>
          )}
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-[15px] text-white shadow-[0_4px_14px_rgba(0,0,0,.4)]">{on ? '…' : '▶'}</span>
          </span>
          {f.seconds != null && <span className="absolute bottom-1.5 right-2 rounded-full bg-black/55 px-1.5 text-[10px] text-white">{lengthWord(f.seconds)}</span>}
        </button>
      )}
    </div>
  );
}

/** a sound: ▶ and its bars, its name and length */
function ClipSound({ f }: { f: ClipFile }) {
  const [on, setOn] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = async () => {
    if (on) {
      audio.current?.pause();
      return setOn(false);
    }
    const url = await clipUrl(f.id);
    if (!url) return;
    if (!audio.current) {
      audio.current = new Audio(url);
      audio.current.onended = () => setOn(false);
    }
    await audio.current.play().catch(() => undefined);
    setOn(true);
  };
  return (
    <button
      onClick={() => void toggle()}
      className="flex w-full max-w-[240px] items-center gap-2.5 rounded-xl bg-[#151c4a] p-2 text-left shadow-[0_2px_8px_rgba(0,0,0,.25)] text-[#f4f1ff]"
      aria-label={on ? '止める' : '聞く'}
      data-testid="clip-audio"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-200/20 text-[13px]">{on ? '❚❚' : '▶'}</span>
      <span className="min-w-0 flex-1">
        <Bars on={on} className="text-sky-100" />
        <span className="mt-0.5 block truncate text-[10.5px] text-[#c9cff5]/85">
          ♪ {f.name}
          {f.seconds ? `・${lengthWord(f.seconds)}` : ''}
        </span>
      </span>
    </button>
  );
}

/** a talk's TalkItem parts for a file: a picture as a card (opens big), anything else right in the bubble */
export function clipItem(f: ClipFile): {
  card?: { label: string; thumb: React.ReactNode; full: React.ReactNode };
  extra?: React.ReactNode;
} {
  if (f.kind === 'photo')
    return {
      card: {
        label: f.name,
        thumb: <ClipView file={f} />,
        full: <ClipView file={f} big />,
      },
    };
  return { extra: <ClipView file={f} /> };
}
