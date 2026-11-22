'use client';

import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { PlanetMark } from '@/components/bluena/PlanetMark';
import { discard, fly, type Ctx } from './makers';
import { shelf, talks, type Talk } from './shelf';
import type { ThreadInfo } from './threads';
import { KindMark, usePlay } from './WorkCard';
import { FLIES, type Work } from './work';

/** a picture that may live in this browser (the demo keeps uploads as idb:) */
function Img({ src, className }: { src: string; className?: string }) {
  const [url, setUrl] = useState(src.startsWith('idb:') ? '' : src);
  useEffect(() => {
    if (!src.startsWith('idb:')) return setUrl(src);
    let made = '';
    void import('@/lib/api/idb').then(async ({ getBlob }) => {
      const b = await getBlob(src.slice(4));
      if (b) setUrl((made = URL.createObjectURL(b)));
    });
    return () => void (made && URL.revokeObjectURL(made));
  }, [src]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className={className} /> : <span className={`block bg-white/10 ${className ?? ''}`} />;
}

/** what is in Bluena for one kind: the planets' own stores (the same items the planet's 「自分の場所」 shows), or this device */
async function load(kind: AtelierKind, meId: string | undefined, live: boolean, avatar?: string | null): Promise<Work[]> {
  const api = getApi();
  const w = (x: Partial<Work> & { id: string }): Work => ({ kind, prompt: '', status: 'ready', saved: true, ...x });
  if (kind === 'voice') {
    if (!meId) return [];
    const p = await api.saturnUserPosts(meId);
    return p.items.filter((x) => !x.replyToId).map((x) => w({ id: x.id, title: x.text, audio: x.voiceUrl, ref: { postId: x.id }, flown: !x.room }));
  }
  if (kind === 'art') return (await api.jupiterRoots()).filter((r) => r.kind === 'photo').map((r) => w({ id: r.id, image: r.url, ref: { rootId: r.id } }));
  if (kind === 'song' && live) return (await api.savedSongs()).map((s) => w({ id: s.id, title: s.title, audio: s.url, ref: { songId: s.id }, flown: s.posted }));
  if (kind === 'video') return (await api.marsBackstage()).map((v) => w({ id: v.id, title: v.title || '映像', video: v.url, poster: v.posterUrl, ref: { backstageId: v.id } }));
  if (kind === 'radio') return (await api.myRadioShows()).map((s) => w({ id: s.id, title: s.title, audio: s.audioUrl, ref: { showId: s.id }, flown: s.status === 'public' }));
  const kept = shelf().filter((x) => x.kind === kind);
  // the face shelf starts with the look worn now (made on day 2, M-R212) when it is not one kept here
  if (kind === 'look' && avatar && !kept.some((x) => x.image === avatar)) return [w({ id: 'profile', image: avatar, worn: true }), ...kept];
  return kept;
}

/**
 * Bluena on the right (M-R211): your works in one folder per kind — a mark only, no words; a folder appears as its kind
 * unlocks. Every item can be played, flown to its planet, or thrown away here.
 */
export function BluenaDrawer({ kinds, ctx, onClose }: { kinds: AtelierKind[]; ctx: Ctx; onClose: () => void }) {
  const { me } = useAuth();
  const [kind, setKind] = useState<AtelierKind | null>(kinds[kinds.length - 1] ?? null);
  const [items, setItems] = useState<Work[] | null>(null);
  const [n, setN] = useState(0);
  const [line, setLine] = useState('');
  useEffect(() => {
    if (!kind) return;
    setItems(null);
    load(kind, me?.id, ctx.live, me?.avatarUrl)
      .then(setItems)
      .catch(() => setItems([]));
  }, [kind, me?.id, me?.avatarUrl, ctx.live, n]);
  const act = async (f: () => Promise<void>, ok: string) => {
    try {
      await f();
      setLine(ok);
      setN((x) => x + 1);
    } catch {
      setLine('うまくいかなかった…');
    }
  };
  return (
    <Drawer side="right" onClose={onClose} label="ブルーナ">
      <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-2" role="tablist">
        {kinds.map((k) => (
          <button key={k} role="tab" aria-selected={k === kind} onClick={() => setKind(k)} className={`flex h-10 w-10 items-center justify-center rounded-xl ${k === kind ? 'bg-sky-300/25 text-sky-100 shadow-[0_0_12px_rgba(140,220,255,0.35)]' : 'text-white/55'}`}>
            <KindMark kind={k} />
          </button>
        ))}
      </div>
      {line && <p className="mt-2 text-center text-[11px] text-sky-100/70">{line}</p>}
      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {items === null && <p className="py-8 text-center text-xs text-white/45">…</p>}
        {items?.length === 0 && <p className="py-8 text-center text-xs text-white/45">まだ、なにもない</p>}
        {items?.map((it) => (
          <Item
            key={it.id}
            w={it}
            onFly={FLIES[it.kind] && !it.flown && (it.kind !== 'song' || ctx.live) ? () => void act(() => fly(it, ctx), '星へ飛ばした') : undefined}
            onDiscard={(it.kind === 'song' && ctx.live) || it.id === 'profile' ? undefined : () => confirm('ブルーナから捨てる？') && void act(() => discard(it), '捨てた')}
          />
        ))}
      </div>
    </Drawer>
  );
}

function Item({ w, onFly, onDiscard }: { w: Work; onFly?: () => void; onDiscard?: () => void }) {
  const [on, toggle] = usePlay(w);
  const planet = FLIES[w.kind];
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/[0.06] p-2">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/30 text-amber-100/70">
        {w.image ? <Img src={w.image} className="h-full w-full object-cover" /> : w.poster ? <Img src={w.poster} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center"><KindMark kind={w.kind} /></span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[12px] leading-snug">{w.title || w.text || w.prompt}</p>
        {w.flown && planet && <PlanetMark id={planet} size={12} />}
      </div>
      {(w.audio || w.ref?.demoSong) && (
        <button onClick={() => void toggle()} aria-label={on ? '止める' : '再生'} className="h-8 w-8 shrink-0 rounded-full bg-white/15 text-xs">
          {on ? '❚❚' : '▶'}
        </button>
      )}
      {w.video && (
        <a href={w.video} target="_blank" rel="noreferrer" aria-label="再生" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs">
          ▶
        </a>
      )}
      {onFly && planet && (
        <button onClick={onFly} aria-label="星へ飛ばす" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-300">
          <PlanetMark id={planet} size={16} />
        </button>
      )}
      {onDiscard && (
        <button onClick={onDiscard} aria-label="捨てる" className="h-8 w-8 shrink-0 rounded-full bg-black/40 text-xs text-white/60">
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * The conversations on the left (M-R212): {bati} first — with your past talks with {bati} under it (kept apart from the
 * works, M-R211) — then the other threads (ダチ: {inviter}, KIMORIN⭐︎ … passed in by the page).
 */
export function ThreadsDrawer({
  bati,
  threads,
  current,
  talkId,
  onThread,
  onTalk,
  onNew,
  onClose,
}: {
  bati: { name: string; face: string };
  threads: ThreadInfo[];
  current: string;
  talkId: string;
  onThread: (id: string) => void;
  onTalk: (t: Talk) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [list] = useState(talks);
  const row = (t: { id: string; name: string; avatar?: string; unread?: number }, on: boolean, tap: () => void) => (
    <button key={t.id} onClick={tap} className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left ${on ? 'bg-amber-200/15' : ''}`}>
      <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
        {t.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.avatar} alt="" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px]">{t.name}</span>
      {!!t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-300" aria-label="新しいメッセージ" />}
    </button>
  );
  return (
    <Drawer side="left" onClose={onClose} label="会話">
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {row({ id: 'bati', name: bati.name, avatar: bati.face }, current === 'bati', () => onThread('bati'))}
        <div className="ml-12 space-y-1 border-l border-white/10 pl-2">
          <button onClick={onNew} className="w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-amber-100/80">
            ＋ 新しく話す
          </button>
          {list.map((t) => {
            const first = t.msgs.find((m) => m.who === 'me');
            return (
              <button key={t.id} onClick={() => onTalk(t)} className={`block w-full rounded-lg px-2 py-1.5 text-left ${current === 'bati' && t.id === talkId ? 'bg-white/10' : ''}`}>
                <p className="truncate text-[12px] text-white/80">{first && 'text' in first ? first.text : '…'}</p>
                <p className="text-[10px] text-white/40">{new Date(t.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </button>
            );
          })}
        </div>
        {threads
          .filter((t) => t.id !== 'bati')
          .map((t) => row(t, current === t.id, () => onThread(t.id)))}
      </div>
    </Drawer>
  );
}

function Drawer({ side, label, onClose, children }: { side: 'left' | 'right'; label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 bg-black/40" onClick={onClose}>
      <aside
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`pt-safe pb-safe absolute top-0 flex h-full w-[82%] max-w-xs flex-col bg-[#0b0f24]/95 px-3 pt-4 backdrop-blur-xl ${side === 'left' ? 'left-0 border-r' : 'right-0 border-l'} border-white/10`}
      >
        {children}
      </aside>
    </div>
  );
}
