'use client';

import { neoForm, type PlanetAuthor, type PlanetReplyView, type TimelinePlanet } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic } from '@/components/mercury/ComposeChat';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Replies on a Mercury song / Mars movie (client: like Saturn and Jupiter). The list and the box to
 * answer (mic first); no counts — only who replied. Sample posts cannot be answered.
 */
export function RepliesSheet({ planet, postId, owner, onClose, onReplied }: { planet: TimelinePlanet; postId: string | null; owner: string; onClose: () => void; onReplied?: (who: PlanetAuthor) => void }) {
  const { me } = useAuth();
  const [list, setList] = useState<PlanetReplyView[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!postId) {
      setList([]);
      return;
    }
    getApi()
      .planetReplies(planet, postId)
      .then(setList)
      .catch(() => setList([]));
  }, [planet, postId]);

  const send = async () => {
    const t = text.trim();
    if (!t || !postId) return;
    setBusy(true);
    setErr('');
    try {
      const r = await getApi().replyPlanet(planet, postId, t);
      setList((cur) => [...(cur ?? []), r]);
      setText('');
      onReplied?.(r.author);
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'MODERATION' ? 'その言葉は使えないよ' : '送れなかった…もう一度');
    } finally {
      setBusy(false);
    }
  };

  const dark = planet === 'mars' ? 'bg-[#2a1d38]' : 'bg-[#0f2236]';
  if (!ready) return null;
  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/55" onClick={onClose}>
      <div className={`pb-safe flex max-h-[75svh] w-full max-w-md flex-col rounded-t-3xl ${dark} p-4 text-white`} onClick={(e) => e.stopPropagation()}>
        <p className="text-center text-sm font-bold tracking-widest">💬 @{owner} へのリプ</p>
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {list === null && <p className="text-center text-xs text-white/50">ひらいています…</p>}
          {list?.length === 0 && <p className="py-4 text-center text-xs text-white/55">{postId ? 'まだリプはありません。最初のひとことを送ってみよう' : 'サンプルの作品には、リプできません'}</p>}
          {list?.map((r) => (
            <div key={r.id} className="flex items-start gap-2">
              <Face a={r.author} />
              <div className="min-w-0 rounded-2xl bg-white/10 px-3 py-1.5">
                <p className="text-[10px] font-bold text-white/55">@{r.author.displayName || r.author.handle}</p>
                <p className="whitespace-pre-wrap text-sm">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
        {postId && me && (
          <>
            <div className="mt-3 flex items-center gap-2">
              <Mic value={text} onChange={(v) => setText(v.slice(0, 120))} />
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 120))}
                onKeyDown={(e) => e.key === 'Enter' && void send()}
                placeholder="ひとこと返す"
                className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[16px] outline-none"
              />
              <button onClick={() => void send()} disabled={!text.trim() || busy} className="h-11 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-4 text-sm font-bold disabled:opacity-40">
                送る
              </button>
            </div>
            {err && <p className="mt-1 text-center text-xs text-rose-300">{err}</p>}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Face({ a, size = 36 }: { a: PlanetAuthor; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-[#1b1f3a]" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {a.pic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.pic} alt="" className="h-full w-full object-cover" />
      ) : (
        (neoForm(a.neoForm)?.emoji ?? '🙂')
      )}
    </span>
  );
}

/** Who replied (up to 3 faces, overlapping) — never a number. */
export function ReplierFaces({ who }: { who: PlanetAuthor[] }) {
  if (!who.length) return null;
  return (
    <span className="flex -space-x-2">
      {who.slice(0, 3).map((a) => (
        <Face key={a.id} a={a} size={22} />
      ))}
    </span>
  );
}
