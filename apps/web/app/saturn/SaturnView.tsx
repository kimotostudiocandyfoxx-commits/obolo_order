'use client';

import { SATURN_MAX_CHARS, VOICE_MAX_SECONDS, type SaturnPostView } from '@obolo/shared';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { DemoBanner } from '@/components/DemoBanner';
import { PlanetShell } from '@/components/PlanetShell';
import { RequireAuth } from '@/components/RequireAuth';
import { VoiceButton } from '@/components/VoiceButton';
import { ApiError, getApi } from '@/lib/api';
import { playBlob, stopAudio } from '@/lib/audio';
import { useAuth } from '@/lib/auth';
import { useI18n, useTimeAgo } from '@/lib/i18n/client';
import { useRecorder } from '@/lib/useRecorder';

export function SaturnView() {
  return (
    <PlanetShell id="saturn">
      <DemoBanner />
      <RequireAuth>
        <Timeline />
      </RequireAuth>
    </PlanetShell>
  );
}

function Timeline() {
  const { m } = useI18n();
  const [posts, setPosts] = useState<SaturnPostView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (c?: string) => {
    setLoading(true);
    try {
      const page = await getApi().saturnFeed(c);
      setPosts((cur) => (c ? [...cur, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => stopAudio();
  }, [load]);

  return (
    <div className="space-y-4">
      <Composer onPosted={(p) => setPosts((cur) => [p, ...cur])} />
      {!loading && posts.length === 0 && <p className="py-10 text-center text-sm text-white/50">{m.saturn.empty}</p>}
      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          onChange={(np) => setPosts((cur) => cur.map((x) => (x.id === np.id ? np : x)))}
          onDelete={() => setPosts((cur) => cur.filter((x) => x.id !== p.id))}
        />
      ))}
      {loading && <p className="py-4 text-center text-sm text-white/50">{m.common.loading}</p>}
      {cursor && !loading && (
        <button className="btn btn-ghost w-full" onClick={() => void load(cursor)}>
          {m.common.loadMore}
        </button>
      )}
    </div>
  );
}

function Composer({ onPosted }: { onPosted: (p: SaturnPostView) => void }) {
  const { m, t } = useI18n();
  const { me } = useAuth();
  const rec = useRecorder();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const remaining = SATURN_MAX_CHARS - [...text].length;

  const submit = async () => {
    if (!rec.blob) {
      setErr(m.saturn.voiceRequired);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const media = await getApi().uploadVoice(rec.blob);
      const post = await getApi().createSaturnPost({ text: text.trim(), voiceMediaId: media.id, voiceDurationSec: rec.duration });
      onPosted(post);
      setText('');
      rec.reset();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'MODERATION' ? m.saturn.moderation : m.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <div className="flex gap-3">
        <Avatar name={me?.displayName ?? '?'} size={40} />
        <textarea
          className="input min-h-20 flex-1 resize-none !border-transparent !bg-transparent !p-1"
          placeholder={m.saturn.composerPlaceholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={SATURN_MAX_CHARS * 2}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!rec.recording && !rec.blob && (
          <button className="btn bg-rose-400/90 text-white" onClick={() => void rec.start()}>
            ● {m.saturn.record}
          </button>
        )}
        {rec.recording && (
          <button className="btn animate-pulse bg-rose-500 text-white" onClick={rec.stop}>
            ■ {m.saturn.stop} · {t(m.saturn.recording, { sec: rec.elapsed })}
          </button>
        )}
        {rec.blob && !rec.recording && (
          <>
            <button className="btn btn-ghost" onClick={() => void playBlob(rec.blob!, 'composer-preview')}>
              ▶ {t(m.saturn.recorded, { sec: rec.duration.toFixed(1) })}
            </button>
            <button className="btn btn-ghost text-xs" onClick={() => void rec.start()}>
              ↺ {m.saturn.reRecord}
            </button>
          </>
        )}
        <span className={`ml-auto text-xs tabular-nums ${remaining < 0 ? 'text-rose-300' : 'text-white/40'}`}>{remaining}</span>
        <button
          className="btn btn-primary"
          disabled={busy || rec.recording || !text.trim() || remaining < 0 || !rec.blob}
          onClick={() => void submit()}
        >
          {busy ? m.saturn.posting : m.saturn.post}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-white/40">
        🎙️ {m.saturn.voiceRequired}（{t(m.saturn.tooLong, { sec: VOICE_MAX_SECONDS })}）
      </p>
      {rec.error && (
        <p className="mt-2 text-sm text-rose-300">{rec.error === 'denied' ? m.saturn.micDenied : m.saturn.micUnsupported}</p>
      )}
      {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}
    </section>
  );
}

function PostCard({
  post,
  onChange,
  onDelete,
}: {
  post: SaturnPostView;
  onChange: (p: SaturnPostView) => void;
  onDelete: () => void;
}) {
  const { m } = useI18n();
  const { me } = useAuth();
  const ago = useTimeAgo();

  const toggleStar = async () => {
    const on = !post.starredByMe;
    onChange({ ...post, starredByMe: on, starCount: post.starCount + (on ? 1 : -1) });
    try {
      const r = await getApi().starSaturnPost(post.id, on);
      onChange({ ...post, ...r });
    } catch {
      onChange(post);
    }
  };

  return (
    <article className="card p-4">
      <header className="flex items-center gap-3">
        <Avatar name={post.author.displayName} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-bold">{post.author.displayName}</div>
          <div className="truncate text-xs text-white/45">
            @{post.author.handle} · {ago(post.createdAt)}
          </div>
        </div>
        {me?.id === post.author.id && (
          <button
            className="text-xs text-white/35 underline"
            onClick={async () => {
              await getApi().deleteSaturnPost(post.id);
              onDelete();
            }}
          >
            {m.saturn.delete}
          </button>
        )}
      </header>
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{post.text}</p>
      <div className="mt-3">
        <VoiceButton url={post.voiceUrl} durationSec={post.voiceDurationSec} label={m.saturn.tapToListen} />
      </div>
      <footer className="mt-3 flex items-center gap-4 text-sm">
        <button
          onClick={() => void toggleStar()}
          className={`flex items-center gap-1 transition active:scale-90 ${post.starredByMe ? 'text-[color:var(--color-star)]' : 'text-white/50'}`}
          aria-pressed={post.starredByMe}
        >
          {post.starredByMe ? '★' : '☆'} <span className="tabular-nums">{post.starCount.toLocaleString()}</span>
        </button>
      </footer>
    </article>
  );
}
