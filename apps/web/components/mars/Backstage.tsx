'use client';

import { MARS_VIDEO_SECONDS, type MarsBackstageVideo } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useBlobUrl } from '@/lib/jupiter/state';

/**
 * 裏スタジオ — your own videos (client decision 2026-10-07): every video you keep lives on Mars
 * (photos live on Jupiter). Private: only you see them. Add from the camera roll, watch, remove.
 * PLACEHOLDER (P-MARS-4): sending one of these to the 星図 comes with the Mars timeline on the server.
 */
export function Backstage({ onPublish }: { onPublish?: () => void } = {}) {
  const [list, setList] = useState<MarsBackstageVideo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [playing, setPlaying] = useState<MarsBackstageVideo | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  // 公開: the video is cut square and flies as a UFO for 88 hours (the original stays here)
  const publish = async (v: MarsBackstageVideo) => {
    setSending(v.id);
    setMsg('');
    try {
      await getApi().createPlanetPost('mars', { sourceId: v.id, title: v.title, text: '' });
      onPublish?.();
    } catch (e) {
      setMsg(e instanceof ApiError && e.code === 'MODERATION' ? 'そのタイトルは使えないよ' : '公開できなかった…もう一度');
    } finally {
      setSending(null);
    }
  };
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getApi()
      .marsBackstage()
      .then(setList)
      .catch(() => setList(null));
  }, []);

  const add = async (files: FileList) => {
    setBusy(true);
    setMsg('');
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('video/')) {
          setMsg('写真は、木星の根っこにしまってね');
          continue;
        }
        const v = await getApi().uploadVideo(f, MARS_VIDEO_SECONDS);
        const kept = await getApi().keepMarsVideo({ mediaId: v.id, ...(v.posterUrl ? { posterUrl: v.posterUrl } : {}), seconds: v.seconds, title: f.name.replace(/\.[^.]+$/, '').slice(0, 40) });
        setList((cur) => [kept, ...(cur ?? [])]);
      }
    } catch (e) {
      setMsg(e instanceof ApiError && e.code === 'BAD_VIDEO' ? 'この動画は読みこめなかった…' : e instanceof ApiError && e.code === 'STORAGE_FULL' ? '保存できる容量がいっぱいです' : 'しまえなかった…もう一度');
    } finally {
      setBusy(false);
    }
  };

  if (list === null) return null;
  return (
    <div className="mb-4 rounded-2xl border border-amber-300/25 bg-black/25 p-3">
      <p className="text-xs font-bold text-amber-100">🎬 あなたの動画（自分だけ）</p>
      <p className="mt-0.5 text-[10px] text-white/50">撮った動画は、ぜんぶここにしまわれます（{MARS_VIDEO_SECONDS}秒まで）。写真は木星の根っこへ。</p>
      <button onClick={() => input.current?.click()} disabled={busy} className="mt-2 w-full rounded-xl border-2 border-dashed border-amber-300/40 py-3 text-sm disabled:opacity-60">
        {busy ? 'しまっています…（少し時間がかかります）' : '＋ 動画を入れる'}
      </button>
      <input
        ref={input}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void add(e.target.files);
          e.target.value = '';
        }}
      />
      {msg && <p className="mt-1 text-center text-[11px] text-rose-200">{msg}</p>}
      {list.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {list.map((v) => (
            <div key={v.id} className="relative">
              <button onClick={() => setPlaying(v)} className="block w-full overflow-hidden rounded-lg bg-black" aria-label={`${v.title || '動画'}を見る`}>
                <Thumb video={v} />
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px]">{v.seconds ? `${Math.round(v.seconds)}秒` : '▶'}</span>
              </button>
              <button
                onClick={() => {
                  setList((cur) => (cur ?? []).filter((x) => x.id !== v.id));
                  getApi()
                    .removeMarsVideo(v.id)
                    .catch(() => undefined);
                }}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-stone-700 text-[10px] text-white shadow"
                aria-label="消す"
              >
                ✕
              </button>
              <p className="mt-0.5 truncate text-[10px] text-white/60">{v.title || '動画'}</p>
              {onPublish && (
                <button onClick={() => void publish(v)} disabled={!!sending} className="mt-1 w-full rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-600 py-1 text-[10px] font-bold disabled:opacity-50">
                  {sending === v.id ? '正方形にしています…' : '🛸 公開する'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {playing && <Player video={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

const useSrc = (url: string) => {
  const local = useBlobUrl(url.startsWith('idb:') ? url.slice(4) : undefined);
  return url.startsWith('idb:') ? local : url;
};

function Thumb({ video }: { video: MarsBackstageVideo }) {
  const src = useSrc(video.url);
  if (video.posterUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={video.posterUrl} alt="" className="aspect-video w-full object-cover" />;
  }
  return src ? <video src={src} preload="metadata" muted playsInline className="aspect-video w-full object-cover" /> : <div className="aspect-video w-full" />;
}

function Player({ video, onClose }: { video: MarsBackstageVideo; onClose: () => void }) {
  const src = useSrc(video.url);
  return (
    <div className="fixed inset-0 z-[130] flex flex-col items-center justify-center bg-black/90 px-4" onClick={onClose}>
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        {src && <video src={src} poster={video.posterUrl ?? undefined} controls autoPlay playsInline className="max-h-[75svh] w-full rounded-xl bg-black" />}
        <p className="mt-2 truncate text-center text-sm">{video.title || '動画'}</p>
        <button onClick={onClose} className="mx-auto mt-3 block rounded-full bg-white/15 px-6 py-2 text-sm">
          とじる
        </button>
      </div>
    </div>
  );
}
