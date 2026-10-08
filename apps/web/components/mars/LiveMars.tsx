'use client';

import { MV_MAX_MATERIALS, MV_MAX_SECONDS, type MvProjectView, type SongView } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { usePartner } from '@/lib/partner';
import { Mic } from '@/components/mercury/ComposeChat';

/**
 * 撮影 on Mars = the MV studio (client decision 2026-10-08). In the chat with Bati:
 * 「どんな映像を作る？」 (MV only for now) → pick one of your Mercury songs → send a few videos / photos
 * → Bati plans the edit, gives it the anime look and sends the finished MV → 「歌詞も入れる？」 →
 * the MV with the lyrics → 公開: it flies as a UFO for 88 hours (every MV also stays in your 裏スタジオ).
 */
type Media = { kind: 'photo' | 'video'; url: string; poster?: string | null };
type Msg = { who: 'me' | 'partner'; text?: string; media?: Media };
type Step = 'song' | 'materials' | 'rendering' | 'lyrics?' | 'lyrics' | 'publish' | 'busy';

const WAIT = [
  ['素材を見てるよ…', '素材を見てるケン…'],
  ['曲のリズムに合わせて、どこに何を入れるか考え中…', '曲のリズムに合わせて、どこに何を入れるか考え中だ…'],
  ['アニメっぽく描いてるよ。ちょっと時間がかかるから待っててね', 'アニメっぽく描いてるケン。ちょっと時間がかかるから待ってろ'],
  ['つなげて、曲をのせてるよ…', 'つなげて、曲をのせてるケン…'],
  ['もうすぐ！ 仕上げ中…', 'もうすぐだ！ 仕上げ中…'],
];

export function LiveShoot({ onPosted }: { onPosted: () => void }) {
  const partner = usePartner();
  const bati = partner.isBati;
  const ken = (a: string, b: string) => (bati ? a : b);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      who: 'partner',
      text: ken('やあ、今日はどんな映像を作っちゃう？ まずはMVを作ろう！ 水星で作った曲から、1曲えらんでね。', 'よう、今日はどんな映像を作るケン？ まずはMVだ！ 水星で作った曲から、1曲えらぶケン。'),
    },
  ]);
  const [step, setStep] = useState<Step>('song');
  const [songs, setSongs] = useState<SongView[] | null>(null);
  const [mv, setMv] = useState<MvProjectView | null>(null);
  const [uploading, setUploading] = useState(0);
  const [title, setTitle] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, step, songs, uploading]);
  const say = (text: string, media?: Media) => setMsgs((m) => [...m, { who: 'partner', text, media }]);
  const me = (m: Omit<Msg, 'who'>) => setMsgs((cur) => [...cur, { who: 'me', ...m }]);
  const oops = () => say(ken('ごめん、うまくいかなかった……もう一回ためしてね。', 'すまん、うまくいかなかったケン……もう一回ためしてみろ。'));

  useEffect(() => {
    getApi()
      .savedSongs()
      .then(setSongs)
      .catch(() => setSongs([]));
  }, []);

  const chooseSong = async (s: SongView) => {
    me({ text: `「${s.title}」で作りたい！` });
    setStep('busy');
    try {
      const p = await getApi().mvCreate(s.id);
      setMv(p);
      setTitle(`${s.title}（MV）`.slice(0, 40));
      say(
        ken(
          `「${s.title}」のMVだね！ じゃあ素材を送って。動画や写真を、数本チャットで送ってね（${MV_MAX_MATERIALS}本まで）。`,
          `「${s.title}」のMVか！ よし、素材を送るケン。動画や写真を、数本チャットで送れ（${MV_MAX_MATERIALS}本まで）。`,
        ),
      );
      setStep('materials');
    } catch {
      setStep('song');
      oops();
    }
  };

  const send = async (files: FileList) => {
    if (!mv) return;
    let cur = mv;
    const list = Array.from(files).slice(0, MV_MAX_MATERIALS - cur.materials.length);
    setUploading(list.length);
    let failed = false;
    for (const f of list) {
      try {
        if (f.type.startsWith('video/')) {
          const v = await getApi().uploadVideo(f, MV_MAX_SECONDS);
          cur = await getApi().mvAddMaterial(cur.id, { mediaId: v.id, kind: 'video', posterUrl: v.posterUrl || null, seconds: v.seconds });
          me({ media: { kind: 'video', url: v.url, poster: v.posterUrl } });
        } else if (f.type.startsWith('image/')) {
          const p = await getApi().uploadPhoto(f);
          cur = await getApi().mvAddMaterial(cur.id, { mediaId: p.id, kind: 'photo' });
          me({ media: { kind: 'photo', url: p.url } });
        }
      } catch {
        failed = true;
      }
      setUploading((n) => n - 1);
    }
    setUploading(0);
    setMv(cur);
    if (failed) say(ken('送れなかった素材があったみたい……別のでためしてね。', '送れなかった素材があったケン……別のでためしてみろ。'));
    else if (cur.materials.length)
      say(
        cur.materials.length >= MV_MAX_MATERIALS
          ? ken('素材がそろったね！「これで作って」を押してね。', '素材がそろったケン！「これで作って」を押せ。')
          : ken(
              `いいね！ いま${cur.materials.length}本。もっと送ってもいいし、そろったら「これで作って」を押してね。`,
              `いいな！ いま${cur.materials.length}本だ。もっと送ってもいいし、そろったら「これで作って」を押せ。`,
            ),
      );
  };

  const make = async () => {
    if (!mv) return;
    me({ text: 'これで作って！' });
    setStep('rendering');
    let k = 0;
    say(ken(WAIT[0][0], WAIT[0][1]));
    const timer = setInterval(() => {
      k = Math.min(k + 1, WAIT.length - 1);
      say(ken(WAIT[k][0], WAIT[k][1]));
      if (k === WAIT.length - 1) clearInterval(timer);
    }, 14_000);
    try {
      const p = await getApi().mvRender(mv.id);
      setMv(p);
      say(ken(`できたよ！ ${p.note ?? ''}`, `できたケン！ ${p.note ?? ''}`), { kind: 'video', url: p.videoUrl!, poster: p.posterUrl });
      if (p.hasLyrics) {
        say(ken('歌詞も入れたかったら入れられるけど、どうする？', '歌詞も入れたかったら入れられるケン。どうする？'));
        setStep('lyrics?');
      } else {
        say(ken('裏スタジオにもしまっておいたよ。公開する？', '裏スタジオにもしまっておいたケン。公開するか？'));
        setStep('publish');
      }
    } catch (e) {
      setStep('materials');
      say(
        e instanceof ApiError && e.code === 'BUSY'
          ? ken('いま作ってる途中だよ。少し待ってね。', 'いま作ってる途中だケン。少し待て。')
          : ken('ごめん、うまく作れなかった……素材を変えるか、もう一回ためしてね。', 'すまん、うまく作れなかったケン……素材を変えるか、もう一回ためしてみろ。'),
      );
    } finally {
      clearInterval(timer);
    }
  };

  const lyrics = async (yes: boolean) => {
    if (!mv) return;
    if (!yes) {
      me({ text: 'このままでいい！' });
      say(ken('了解！ 裏スタジオにもしまっておいたよ。公開する？', '了解だ！ 裏スタジオにもしまっておいたケン。公開するか？'));
      setStep('publish');
      return;
    }
    me({ text: '歌詞を入れてほしい！' });
    setStep('lyrics');
    say(ken('まかせて！ 歌詞を入れてるよ…', 'まかせろ！ 歌詞を入れてるケン…'));
    try {
      const p = await getApi().mvLyrics(mv.id);
      setMv(p);
      setTitle((t) => t.replace('（MV）', '（MV・歌詞つき）').slice(0, 40));
      say(ken('歌詞つきのMVができたよ！ こっちも裏スタジオにしまっておいたよ。公開する？', '歌詞つきのMVができたケン！ こっちも裏スタジオにしまっておいたぞ。公開するか？'), {
        kind: 'video',
        url: p.lyricsVideoUrl!,
        poster: p.posterUrl,
      });
      setStep('publish');
    } catch {
      setStep('lyrics?');
      oops();
    }
  };

  const post = async () => {
    if (!mv?.backstageId) return;
    setStep('busy');
    try {
      await getApi().createPlanetPost('mars', { sourceId: mv.backstageId, title: title.trim() || mv.songTitle, text: '' });
      say(ken('公開したよ！ 88時間、みんなの星図をとんでいくよ。', '公開したケン！ 88時間、みんなの星図をとんでいくぞ。'));
      setTimeout(onPosted, 900);
    } catch (e) {
      setStep('publish');
      say(
        e instanceof ApiError && e.code === 'MODERATION'
          ? ken('その言葉は使えないみたい……タイトルを変えてみて。', 'その言葉は使えないケン……タイトルを変えてみろ。')
          : ken('ごめん、うまくいかなかった……もう一回！', 'すまん、うまくいかなかったケン……もう一回だ！'),
      );
    }
  };

  const working = step === 'rendering' || step === 'lyrics';

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pt-[calc(10px+env(safe-area-inset-top))]">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-3">
        {msgs.map((m, i) =>
          m.who === 'partner' ? (
            <div key={i} className="flex items-end gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={partner.face} alt="" className="h-10 w-10 shrink-0 rounded-full border border-amber-300/60 bg-black/40 object-cover" />
              <div className="max-w-[80%] space-y-1.5">
                {m.text && <p className="rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-sm leading-relaxed">{m.text}</p>}
                {m.media && <Bubble media={m.media} big />}
              </div>
            </div>
          ) : m.media ? (
            <div key={i} className="ml-auto w-28">
              <Bubble media={m.media} />
            </div>
          ) : (
            <p key={i} className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2 text-sm">
              {m.text}
            </p>
          ),
        )}

        {step === 'song' && (
          <div className="rounded-2xl border border-amber-300/25 bg-black/30 p-3">
            <p className="text-xs font-bold text-amber-100">🎵 水星で作った曲</p>
            {songs === null && <p className="mt-2 text-center text-xs text-white/50">ひらいています…</p>}
            {songs?.length === 0 && <p className="mt-2 text-center text-xs text-white/50">まだ曲がないよ。水星で曲を作ってから来てね</p>}
            <div className="mt-2 space-y-1.5">
              {songs?.map((s) => (
                <button key={s.id} onClick={() => void chooseSong(s)} className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-left active:bg-white/15">
                  <span className="text-lg">🎵</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{s.title || '曲'}</span>
                  <span className="text-[10px] text-white/50">{fmt(s.seconds)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {uploading > 0 && <p className="ml-auto w-fit rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">送っています…（のこり{uploading}本）</p>}

        {working && (
          <div className="flex items-center gap-2 pl-12 text-xs text-amber-100/80">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-200/70 border-t-transparent" />
            {ken('いま作ってるよ（1〜3分くらい）', 'いま作ってるケン（1〜3分くらい）')}
          </div>
        )}

        {step === 'lyrics?' && (
          <div className="flex gap-2 pl-12">
            <button onClick={() => void lyrics(true)} className="flex-1 rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-600 py-2 text-sm font-bold">
              📝 歌詞を入れて
            </button>
            <button onClick={() => void lyrics(false)} className="flex-1 rounded-full border border-white/20 py-2 text-sm">
              このままでいい
            </button>
          </div>
        )}

        {(step === 'publish' || (step === 'busy' && mv?.backstageId)) && (
          <div className="rounded-2xl border border-amber-300/25 bg-black/30 p-3">
            <div className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                placeholder="タイトル"
                className="h-10 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[16px] outline-none"
              />
              <Mic value={title} onChange={(v) => setTitle(v.slice(0, 40))} />
            </div>
            <button
              onClick={() => void post()}
              disabled={step === 'busy'}
              className="mt-2 w-full rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-600 py-2.5 text-sm font-bold disabled:opacity-60"
            >
              {step === 'busy' ? '公開しています…' : '🛸 公開する（88時間とぶ）'}
            </button>
          </div>
        )}
        <div ref={end} />
      </div>

      {step === 'materials' && mv && (
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={() => input.current?.click()}
            disabled={uploading > 0 || mv.materials.length >= MV_MAX_MATERIALS}
            className="h-11 flex-1 rounded-full bg-white/10 px-4 text-sm font-bold disabled:opacity-40"
          >
            📎 動画・写真を送る（{mv.materials.length}/{MV_MAX_MATERIALS}）
          </button>
          <button
            onClick={() => void make()}
            disabled={uploading > 0 || !mv.materials.length}
            className="h-11 rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-600 px-4 text-sm font-bold disabled:opacity-40"
          >
            これで作って
          </button>
          <input
            ref={input}
            type="file"
            accept="video/*,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void send(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}

function fmt(s: number) {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function Bubble({ media, big = false }: { media: Media; big?: boolean }) {
  const cls = `aspect-square w-full rounded-xl border border-amber-300/40 bg-black object-cover ${big ? 'max-w-64' : ''}`;
  if (media.kind === 'photo') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.url} alt="" className={cls} />;
  }
  return <video src={media.url} poster={media.poster ?? undefined} controls={big} muted={!big} playsInline preload="metadata" className={cls} />;
}
