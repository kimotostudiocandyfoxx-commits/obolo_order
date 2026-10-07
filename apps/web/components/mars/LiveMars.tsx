'use client';

import { MARS_VIDEO_SECONDS, type MarsBackstageVideo } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useBlobUrl } from '@/lib/jupiter/state';
import { usePartner } from '@/lib/partner';
import { Mic } from '@/components/mercury/ComposeChat';

/**
 * 撮影 on Mars (client decision 2026-10-07): talk with Bati and make the movie you post.
 * Bati asks 「やあ、今日はどんなムービーを作っちゃう？」 → you say what it is about → pick the video
 * from your 裏スタジオ (or add one) → Bati suggests a title → 公開: it is cut to a square and flies
 * as a UFO for 88 hours, then stays in your studio.
 * PLACEHOLDER (P-MARS-3): Bati does not generate footage yet — the movie is one of your videos.
 */
type Msg = { who: 'me' | 'partner'; text: string };

export function LiveShoot({ onPosted }: { onPosted: () => void }) {
  const partner = usePartner();
  const bati = partner.isBati;
  const ken = (a: string, b: string) => (bati ? a : b);
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: 'partner', text: ken('やあ、今日はどんなムービーを作っちゃう？ どんな場面か、話してみて。', 'よう、今日はどんなムービーを作るケン？ どんな場面か、話してみろ。') },
  ]);
  const [text, setText] = useState('');
  const [step, setStep] = useState<'talk' | 'pick' | 'title' | 'busy'>('talk');
  const [about, setAbout] = useState('');
  const [videos, setVideos] = useState<MarsBackstageVideo[] | null>(null);
  const [pick, setPick] = useState<MarsBackstageVideo | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, step, videos]);
  const say = (t: string) => setMsgs((m) => [...m, { who: 'partner', text: t }]);

  const load = () =>
    getApi()
      .marsBackstage()
      .then(setVideos)
      .catch(() => setVideos([]));

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    setMsgs((m) => [...m, { who: 'me', text: t }]);
    if (step === 'talk') {
      setAbout(t);
      setTitle([...t].slice(0, 20).join(''));
      setTimeout(() => {
        say(ken(`いいね！「${[...t].slice(0, 16).join('')}」のムービーだね。その場面の動画を、裏スタジオから選んで。`, `いいな！「${[...t].slice(0, 16).join('')}」か。その場面の動画を、裏スタジオから選ぶケン。`));
        setStep('pick');
        void load();
      }, 400);
    }
  };

  const add = async (files: FileList) => {
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('video/')) continue;
        const v = await getApi().uploadVideo(f, MARS_VIDEO_SECONDS);
        const kept = await getApi().keepMarsVideo({ mediaId: v.id, ...(v.posterUrl ? { posterUrl: v.posterUrl } : {}), seconds: v.seconds, title: f.name.replace(/\.[^.]+$/, '').slice(0, 40) });
        setVideos((cur) => [kept, ...(cur ?? [])]);
      }
    } catch {
      say(ken('ごめん、その動画は入れられなかった……別の動画でためしてね。', 'すまん、その動画は入れられなかったケン……別の動画でためしてみろ。'));
    } finally {
      setUploading(false);
    }
  };

  const choose = (v: MarsBackstageVideo) => {
    setPick(v);
    setStep('title');
    say(ken('いい動画！ 正方形に切りとって、ムービーにするね。タイトルはこれでいい？', 'いい動画だ！ 正方形に切りとって、ムービーにするケン。タイトルはこれでいいか？'));
  };

  const post = async () => {
    if (!pick) return;
    setStep('busy');
    try {
      await getApi().createPlanetPost('mars', { sourceId: pick.id, title: title.trim() || about.slice(0, 20), text: about.slice(0, 60) });
      say(ken('できた！ 88時間、みんなの星図をとんでいくよ。', 'できたケン！ 88時間、みんなの星図をとんでいくぞ。'));
      setTimeout(onPosted, 900);
    } catch (e) {
      setStep('title');
      say(e instanceof ApiError && e.code === 'MODERATION' ? ken('その言葉は使えないみたい……変えてみて。', 'その言葉は使えないケン……変えてみろ。') : ken('ごめん、うまくいかなかった……もう一回！', 'すまん、うまくいかなかったケン……もう一回だ！'));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pt-[calc(10px+env(safe-area-inset-top))]">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-3">
        {msgs.map((m, i) =>
          m.who === 'partner' ? (
            <div key={i} className="flex items-end gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={partner.face} alt="" className="h-10 w-10 shrink-0 rounded-full border border-amber-300/60 bg-black/40 object-cover" />
              <p className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-sm leading-relaxed">{m.text}</p>
            </div>
          ) : (
            <p key={i} className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2 text-sm">
              {m.text}
            </p>
          ),
        )}

        {step === 'pick' && (
          <div className="rounded-2xl border border-amber-300/25 bg-black/30 p-3">
            <p className="text-xs font-bold text-amber-100">🔒 裏スタジオの動画</p>
            <button onClick={() => input.current?.click()} disabled={uploading} className="mt-2 w-full rounded-xl border-2 border-dashed border-amber-300/40 py-2.5 text-sm disabled:opacity-60">
              {uploading ? 'しまっています…（少し時間がかかります）' : '＋ 新しい動画を入れる'}
            </button>
            <input
              ref={input}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void add(e.target.files);
                e.target.value = '';
              }}
            />
            {videos === null && <p className="mt-2 text-center text-xs text-white/50">ひらいています…</p>}
            {videos?.length === 0 && <p className="mt-2 text-center text-xs text-white/50">まだ動画がないよ。カメラロールから入れてね</p>}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {videos?.map((v) => (
                <button key={v.id} onClick={() => choose(v)} className="overflow-hidden rounded-lg bg-black text-left">
                  <Thumb video={v} />
                  <span className="block truncate px-1 py-0.5 text-[10px] text-white/70">{v.title || '動画'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(step === 'title' || step === 'busy') && pick && (
          <div className="rounded-2xl border border-amber-300/25 bg-black/30 p-3">
            <div className="mx-auto w-40 overflow-hidden rounded-xl border border-amber-300/50">
              <Thumb video={pick} square />
            </div>
            <p className="mt-1 text-center text-[10px] text-white/50">正方形に切りとって公開するよ</p>
            <div className="mt-2 flex items-center gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 40))} placeholder="タイトル" className="h-10 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[16px] outline-none" />
              <Mic value={title} onChange={(v) => setTitle(v.slice(0, 40))} />
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setStep('pick')} disabled={step === 'busy'} className="flex-1 rounded-full border border-white/20 py-2 text-xs">
                動画をえらびなおす
              </button>
              <button onClick={() => void post()} disabled={step === 'busy'} className="flex-[2] rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-600 py-2 text-sm font-bold disabled:opacity-60">
                {step === 'busy' ? 'ムービーにしています…' : '🛸 公開する（88時間とぶ）'}
              </button>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      {step === 'talk' && (
        <div className="mb-2 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 120))}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="どんなムービーにする？"
            className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[16px] outline-none"
          />
          <Mic value={text} onChange={(v) => setText(v.slice(0, 120))} />
          <button onClick={send} disabled={!text.trim()} className="h-11 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 text-sm font-bold disabled:opacity-40">
            送る
          </button>
        </div>
      )}
    </div>
  );
}

function Thumb({ video, square = false }: { video: MarsBackstageVideo; square?: boolean }) {
  const local = useBlobUrl(video.url.startsWith('idb:') ? video.url.slice(4) : undefined);
  const src = video.url.startsWith('idb:') ? local : video.url;
  const cls = `${square ? 'aspect-square' : 'aspect-video'} w-full object-cover`;
  if (video.posterUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={video.posterUrl} alt="" className={cls} />;
  }
  return src ? <video src={src} preload="metadata" muted playsInline className={cls} /> : <div className={cls} />;
}
