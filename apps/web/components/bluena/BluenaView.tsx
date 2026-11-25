'use client';

import { BatiShelf } from '@/components/bati/BatiShelf';
import { SATURN_LIFETIME_HOURS, type BluenaKeptView, type JupiterRootView, type MarsBackstageVideo, type PlanetId, type RadioShowView, type SaturnPostView, type SongView } from '@obolo/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BluenaComms } from '@/components/earth/Comms';
import { PlanetSphere } from '@/components/PlanetSphere';
import { useToast } from '@/components/Toast';
import { ShowArt } from '@/components/venus/radio/ShowArt';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Glyph, GLYPH_NAMES, type GlyphId } from './glyphs';

type FolderId = 'saturn' | 'jupiter' | 'mercury' | 'mars' | 'venus' | 'uranus' | 'neptune' | 'pluto';

/** the nine planets' folders in Bluena (docs/工房とブルーナ_設計.md §2): the planet, its mark, and how the folder looks */
const FOLDERS: {
  id: FolderId;
  glyph: GlyphId;
  planet: string;
  look: string;
  empty: string;
}[] = [
  {
    id: 'saturn',
    glyph: 'voice',
    planet: '土星',
    look: 'from-amber-900/50 via-stone-900/60 to-stone-950',
    empty: 'まだ公開していないつぶやきは、ここにしまわれる。',
  },
  {
    id: 'jupiter',
    glyph: 'art',
    planet: '木星',
    look: 'from-emerald-950 via-amber-950/70 to-stone-950',
    empty: '木の根っこに、アートがしまわれる。',
  },
  {
    id: 'mercury',
    glyph: 'song',
    planet: '水星',
    look: 'from-sky-950 via-amber-950/60 to-stone-950',
    empty: '島の土の中に、曲がうめてある。',
  },
  {
    id: 'mars',
    glyph: 'video',
    planet: '火星',
    look: 'from-red-950 via-orange-950/60 to-stone-950',
    empty: '裏スタジオの棚に、映像がしまわれる。',
  },
  {
    id: 'venus',
    glyph: 'radio',
    planet: '金星',
    look: 'from-fuchsia-950 via-indigo-950 to-stone-950',
    empty: '月で番組を収録すると、ここにしまわれる。',
  },
  {
    id: 'uranus',
    glyph: 'goods',
    planet: '天王星',
    look: 'from-cyan-950 via-teal-950/70 to-stone-950',
    empty: '月で作ったグッズが、ここにならぶ。',
  },
  {
    id: 'neptune',
    glyph: 'game',
    planet: '海王星',
    look: 'from-blue-950 via-indigo-950 to-black',
    empty: '月で作ったゲームが、ここにしまわれる。',
  },
  {
    id: 'pluto',
    glyph: 'book',
    planet: '冥王星',
    look: 'from-slate-800 via-sky-950 to-black',
    empty: '氷の書庫。物語が、氷の結晶の中で眠る。',
  },
];

/** the atelier's kind for each folder (〔月で作る〕 opens with it chosen; a kind not open yet shows its lock there, M-R208) */
const MAKE: Record<FolderId, string> = {
  saturn: 'voice',
  jupiter: 'art',
  mercury: 'song',
  mars: 'video',
  venus: 'radio',
  uranus: 'goods',
  neptune: 'game',
  pluto: 'book',
};

const HINT_KEY = 'obolo.bluenaHint';

/**
 * Bluena (client decision 2026-11-21, docs/工房とブルーナ_設計.md §3.3・§11): your works in the planets' folders
 * (〔作品〕) and your talks with your ダチ (〔通信〕). Only you see what is in here. The planets carry a mark, never a
 * word under them (the name is there for screen readers, and a long press shows it). Nothing here uses the day's
 * 88 minutes.
 */
export function BluenaView() {
  const params = useSearchParams();
  const [tab, setTab] = useState<'works' | 'comms'>(params.get('tab') === 'comms' ? 'comms' : 'works');
  const [folder, setFolder] = useState<FolderId>((params.get('folder') as FolderId) || 'mercury');
  const [hint, setHint] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(HINT_KEY)) setHint(true);
    } catch {
      /* private window: no hint memory */
    }
  }, []);
  const closeHint = () => {
    setHint(false);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-svh max-w-xl flex-col px-4">
      <header className="flex items-center gap-2 py-3">
        <Link href="/" className="btn btn-ghost h-9 w-9 !p-0 text-lg" aria-label="もどる">
          ←
        </Link>
        <span className="h-8 w-8 overflow-hidden rounded-full border border-sky-200/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ui/bluena-icon.webp" alt="" className="h-full w-full scale-125 object-cover" />
        </span>
        <h1 className="flex-1 text-base font-black tracking-wide">Bluena</h1>
        <div className="flex rounded-full border border-white/10 bg-white/5 p-1" role="tablist">
          {(['works', 'comms'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              aria-label={GLYPH_NAMES[t]}
              onClick={() => setTab(t)}
              className={`flex h-8 w-10 items-center justify-center rounded-full ${tab === t ? 'bg-sky-300 text-slate-950' : 'text-white/60'}`}
            >
              <Glyph id={t} label={false} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </header>

      {/* the square screen */}
      <section className="relative overflow-hidden rounded-3xl border border-sky-200/20 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(80,170,255,0.18),transparent_60%)] p-3 shadow-[0_0_40px_rgba(80,170,255,0.12)_inset]">
        {tab === 'works' ? <Works folder={folder} onFolder={setFolder} /> : <BluenaComms />}
      </section>

      {hint && tab === 'works' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 pb-[calc(24px+env(safe-area-inset-bottom))]" onClick={closeHint}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[color:var(--color-space-900)] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-black">星のしるし</p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {FOLDERS.map((f) => (
                <p key={f.id} className="flex items-center gap-2 text-white/80">
                  <Glyph id={f.glyph} label={false} className="h-5 w-5 text-sky-200" />
                  {GLYPH_NAMES[f.glyph]}
                </p>
              ))}
              <p className="flex items-center gap-2 text-white/80">
                <Glyph id="kept" label={false} className="h-5 w-5 text-amber-200" />
                しまった作品
              </p>
            </div>
            <p className="mt-3 text-xs text-white/55">星を長く押すと、名前が出るよ</p>
            <button onClick={closeHint} className="mt-4 w-full rounded-full bg-sky-300 py-2.5 text-sm font-black text-slate-950">
              わかった
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Works({ folder, onFolder }: { folder: FolderId; onFolder: (f: FolderId) => void }) {
  const f = FOLDERS.find((x) => x.id === folder)!;
  const [kept, setKept] = useState(false);
  return (
    <>
      {/* M-R217: the first shelf — the {bati} cards and the small egg */}
      <BatiShelf />
      <div className="flex justify-between gap-1 pb-3" role="tablist" aria-label="星のフォルダ">
        {FOLDERS.map((x) => (
          <FolderIcon key={x.id} f={x} on={x.id === folder} onPick={() => onFolder(x.id)} />
        ))}
      </div>
      <div className={`relative min-h-[52svh] rounded-2xl bg-gradient-to-b p-3 ${f.look}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sky-100/80">
            <Glyph id={f.glyph} className="h-5 w-5" />
          </span>
          <span className="flex items-center gap-2">
            <Link
              href={`/moon/atelier?kind=${MAKE[folder]}`}
              aria-label="月で作る"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-100/30 bg-amber-100/10 text-amber-100"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
                <path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.6A7 7 0 0 1 15.5 3.5z" />
              </svg>
            </Link>
            {(folder === 'mercury' || folder === 'mars') && (
              <button
                onClick={() => setKept((v) => !v)}
                aria-label={kept ? '自分の作品を見る' : 'しまった作品を見る'}
                aria-pressed={kept}
                className={`flex h-8 w-8 items-center justify-center rounded-full ${kept ? 'bg-amber-300 text-slate-950' : 'bg-white/10 text-white/70'}`}
              >
                <Glyph id="kept" label={false} className="h-4 w-4" />
              </button>
            )}
          </span>
        </div>
        <Folder id={folder} kept={kept} empty={f.empty} />
      </div>
    </>
  );
}

/** a planet with its mark at the bottom right; the name only for screen readers and on a long press */
function FolderIcon({ f, on, onPick }: { f: (typeof FOLDERS)[number]; on: boolean; onPick: () => void }) {
  const [name, setName] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = () => {
    timer.current = setTimeout(() => setName(true), 450);
  };
  const release = () => {
    if (timer.current) clearTimeout(timer.current);
    setTimeout(() => setName(false), 900);
  };
  return (
    <button
      role="tab"
      aria-selected={on}
      aria-label={`${f.planet}・${GLYPH_NAMES[f.glyph]}`}
      onClick={onPick}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative flex h-11 w-9 shrink-0 select-none items-center justify-center rounded-xl transition ${on ? 'bg-white/15 shadow-[0_0_12px_rgba(140,220,255,0.35)]' : 'opacity-70'}`}
    >
      {f.id === 'pluto' ? (
        <span className="inline-block h-[26px] w-[26px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#e8eef5,#8a99ab_55%,#3d4756)]" aria-hidden />
      ) : (
        <PlanetSphere id={f.id as PlanetId} size={26} />
      )}
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-sky-200 ring-1 ring-sky-200/40">
        <Glyph id={f.glyph} label={false} className="h-3 w-3" />
      </span>
      {name && (
        <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-900">{f.planet}</span>
      )}
    </button>
  );
}

function Folder({ id, kept, empty }: { id: FolderId; kept: boolean; empty: string }) {
  if (kept && (id === 'mercury' || id === 'mars')) return <KeptList planet={id} />;
  if (id === 'mercury') return <SongsFolder empty={empty} />;
  if (id === 'mars') return <MarsFolder empty={empty} />;
  if (id === 'jupiter') return <JupiterFolder empty={empty} />;
  if (id === 'venus') return <VenusFolder empty={empty} />;
  if (id === 'saturn') return <SaturnFolder empty={empty} />;
  return <Empty text={empty} />;
}

function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[40svh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm leading-relaxed text-white/60">{text}</p>
      {children}
    </div>
  );
}

function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    load()
      .then(setData)
      .catch(() => setData([] as unknown as T));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  return [data, useCallback(() => setN((x) => x + 1), [])] as const;
}

function Row({ art, title, sub, children }: { art: ReactNode; title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-black/30 p-2 backdrop-blur-sm">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/10">{art}</div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold leading-snug">{title}</p>
        {sub && <p className="truncate text-[11px] text-white/55">{sub}</p>}
        {children && <div className="mt-1.5 flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}

const pill = 'shrink-0 rounded-full px-3 py-1 text-xs font-bold';

/** 水星：島の土の中のレコード（自分の曲） */
function SongsFolder({ empty }: { empty: string }) {
  const [songs, reload] = useLoad<(SongView & { posted: boolean })[]>(() => getApi().savedSongs());
  const toast = useToast();
  const publish = async (s: SongView) => {
    try {
      await getApi().createPlanetPost('mercury', {
        sourceId: s.id,
        title: s.title,
        text: '',
      });
      toast.show('ブルーナから水星へ投影した。船が出航する');
      reload();
    } catch {
      toast.show('公開できなかった…');
    }
  };
  if (songs === null) return <Empty text="読みこみ中…" />;
  if (!songs.length) return <Empty text={empty} />;
  return (
    <div className="space-y-2">
      {songs.map((s) => (
        <Row
          key={s.id}
          art={
            <span className="flex h-full w-full items-center justify-center rounded-full border-4 border-black/60 bg-amber-900/60 text-sky-100">
              <Glyph id="song" label={false} className="h-5 w-5" />
            </span>
          }
          title={s.title}
          sub={s.posted ? '水星で流れている' : '島の土の中（自分だけ）'}
        >
          <Play url={s.url} />
          {!s.posted && (
            <button onClick={() => void publish(s)} className={`${pill} bg-sky-300 text-slate-950`}>
              公開する
            </button>
          )}
        </Row>
      ))}
      {toast.node}
    </div>
  );
}

/** 火星：裏スタジオの棚（自分の映像） */
function MarsFolder({ empty }: { empty: string }) {
  const [videos, reload] = useLoad<MarsBackstageVideo[]>(() => getApi().marsBackstage());
  const [sent, setSent] = useState<Set<string>>(new Set());
  const toast = useToast();
  // the same projection as Mars's backstage: cut square and flying as a UFO for 88 hours; the original stays here
  const publish = async (v: MarsBackstageVideo) => {
    try {
      await getApi().createPlanetPost('mars', { sourceId: v.id, title: v.title, text: '' });
      setSent((s) => new Set(s).add(v.id));
      toast.show('ブルーナから火星へ投影した。UFOがとんでいく');
    } catch (e) {
      toast.show(e instanceof ApiError && e.code === 'MODERATION' ? 'そのタイトルは使えないよ' : '公開できなかった…');
    }
  };
  if (videos === null) return <Empty text="読みこみ中…" />;
  if (!videos.length) return <Empty text={empty} />;
  return (
    <div className="space-y-2">
      {videos.map((v) => (
        // eslint-disable-next-line @next/next/no-img-element
        <Row
          key={v.id}
          art={v.posterUrl ? <img src={v.posterUrl} alt="" className="h-full w-full object-cover" /> : <Glyph id="video" label={false} className="m-3 h-6 w-6 text-orange-100" />}
          title={v.title || '名前のない映像'}
          sub={sent.has(v.id) ? '火星をとんでいる' : '裏スタジオの棚（自分だけ）'}
        >
          {!sent.has(v.id) && (
            <button onClick={() => void publish(v)} className={`${pill} bg-orange-300 text-slate-950`}>
              公開する
            </button>
          )}
          <Remove onRemove={() => getApi().removeWork('mars_backstage', v.id).then(reload)} />
        </Row>
      ))}
      {toast.node}
    </div>
  );
}

/** 木星：木の根っこ（自分のアート・写真） */
function JupiterFolder({ empty }: { empty: string }) {
  const [roots, reload] = useLoad<JupiterRootView[]>(() => getApi().jupiterRoots());
  if (roots === null) return <Empty text="読みこみ中…" />;
  const photos = roots.filter((r) => r.kind === 'photo');
  if (!photos.length) return <Empty text={empty} />;
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((r) => (
        <div key={r.id} className="group relative aspect-square overflow-hidden rounded-xl border border-amber-200/20 bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-x-1 bottom-1 flex justify-between">
            {/* PLACEHOLDER (P-BLUENA-1): a post (words, branch) is still made on Jupiter */}
            <Link href="/jupiter" className="rounded-full bg-emerald-300 px-2 py-0.5 text-[10px] font-bold text-slate-950">
              公開する
            </Link>
            <Remove small onRemove={() => getApi().removeWork('jupiter_root', r.id).then(reload)} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 金星：放送ブースで収録した番組 */
function VenusFolder({ empty }: { empty: string }) {
  const [shows, reload] = useLoad<RadioShowView[]>(() => getApi().myRadioShows());
  const toast = useToast();
  if (shows === null) return <Empty text="読みこみ中…" />;
  if (!shows.length)
    return (
      <Empty text={empty}>
        <Link href="/moon/atelier?kind=radio" className="mt-4 rounded-full bg-fuchsia-300/20 px-4 py-2 text-xs text-fuchsia-100">
          月で作る
        </Link>
      </Empty>
    );
  return (
    <div className="space-y-2">
      {shows.map((s) => (
        <Row
          key={s.id}
          art={<ShowArt url={s.thumbUrl} loop={s.loop} playing={false} className="!rounded-xl" />}
          title={s.title}
          sub={s.status === 'public' ? '金星で流れている' : 'ブルーナの中（自分だけ）'}
        >
          <Play url={s.audioUrl} />
          <button
            onClick={() =>
              void getApi()
                .publishRadioShow(s.id, s.status !== 'public')
                .then(() => {
                  toast.show(s.status !== 'public' ? 'ブルーナから金星へ投影した' : '金星から、ブルーナにもどした');
                  reload();
                })
                .catch(() => toast.show('できなかった…'))
            }
            className={`${pill} ${s.status === 'public' ? 'bg-white/10 text-white/70' : 'bg-fuchsia-300 text-slate-950'}`}
          >
            {s.status === 'public' ? 'もどす' : '公開する'}
          </button>
          <Remove onRemove={() => getApi().removeWork('radio_show', s.id).then(reload)} />
        </Row>
      ))}
      {toast.node}
    </div>
  );
}

/**
 * 土星：コロリン (M-R208). Kororins made in the Moon atelier (and the first journey's) are kept room-only — nobody else
 * sees them — until 〔公開する〕 flies one to Saturn for its 88 hours; after that it comes back here.
 */
function SaturnFolder({ empty }: { empty: string }) {
  const { me } = useAuth();
  const [posts, reload] = useLoad<SaturnPostView[]>(() => (me ? getApi().saturnUserPosts(me.id).then((p) => p.items.filter((x) => !x.replyToId)) : Promise.resolve([])));
  const toast = useToast();
  const publish = async (p: SaturnPostView) => {
    try {
      await getApi().publishSaturnPost(p.id);
      toast.show('ブルーナから土星へ飛ばした');
      reload();
    } catch {
      toast.show('公開できなかった…');
    }
  };
  if (posts === null) return <Empty text="読みこみ中…" />;
  if (!posts.length) return <Empty text={empty} />;
  const out = (p: SaturnPostView) => !p.room && Date.now() - Date.parse(p.createdAt) < SATURN_LIFETIME_HOURS * 3600_000;
  return (
    <div className="space-y-2">
      {posts.map((p) => (
        <Row
          key={p.id}
          art={
            <span className="flex h-full w-full items-center justify-center rounded-full bg-amber-200/15 text-amber-100">
              <Glyph id="voice" label={false} className="h-6 w-6" />
            </span>
          }
          title={p.text}
          sub={p.room ? 'ブルーナの中（自分だけ）' : out(p) ? '土星にいる' : '土星から、もどってきた'}
        >
          <Play url={p.voiceUrl} />
          {p.room && (
            <button onClick={() => void publish(p)} className={`${pill} bg-amber-300 text-slate-950`}>
              公開する
            </button>
          )}
          <Remove onRemove={() => getApi().removeWork('saturn_post', p.id).then(reload)} />
        </Row>
      ))}
      {toast.node}
    </div>
  );
}

/** しまった作品（他の人の作品へのつながり） */
function KeptList({ planet }: { planet: 'mercury' | 'mars' }) {
  const [list, reload] = useLoad<BluenaKeptView[]>(() => getApi().bluenaKept());
  if (list === null) return <Empty text="読みこみ中…" />;
  const mine = list.filter((k) => k.planet === planet);
  if (!mine.length) return <Empty text={planet === 'mercury' ? '水星で気に入った曲を〔ブルーナにしまう〕と、ここに入る。' : 'まだ、しまった映像はない。'} />;
  return (
    <div className="space-y-2">
      {mine.map((k) => (
        <Row
          key={k.postId}
          art={<Glyph id="kept" label={false} className="m-3 h-6 w-6 text-amber-200" />}
          title={k.available ? k.title : '今は聴けません'}
          sub={k.available ? k.by : '作った人が、しまったみたい'}
        >
          {k.available && k.url && <Play url={k.url} />}
          <Remove onRemove={() => getApi().keepInBluena(k.postId, false).then(reload)} />
        </Row>
      ))}
    </div>
  );
}

function Remove({ onRemove, small = false }: { onRemove: () => Promise<unknown>; small?: boolean }) {
  return (
    <button
      onClick={() => {
        if (confirm('ブルーナから消す？')) void onRemove().catch(() => undefined);
      }}
      aria-label="消す"
      className={`${small ? 'h-5 w-5 text-[10px]' : 'h-7 w-7 text-xs'} shrink-0 rounded-full bg-black/50 text-white/60`}
    >
      ✕
    </button>
  );
}

let playing: { stop: () => void } | null = null;
function Play({ url }: { url: string }) {
  const [on, setOn] = useState(false);
  const toggle = async () => {
    if (on) {
      playing?.stop();
      setOn(false);
      return;
    }
    playing?.stop();
    // a kororin read in the NEO voice is spoken by the device
    if (url.startsWith('tts:')) {
      const { toggleAudio } = await import('@/lib/audio');
      await toggleAudio(url).catch(() => undefined);
      return;
    }
    // M-R239: through Web Audio (quiet with the silent switch on); idb: recordings are read by the player
    const { playClip } = await import('@/lib/voice/webVoice');
    const c = await playClip(url);
    if (!c) return setOn(false);
    playing = c;
    setOn(true);
    void c.done.then(() => setOn(false));
  };
  return (
    <button onClick={() => void toggle()} aria-label={on ? '止める' : '聴く'} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm">
      {on ? '❚❚' : '▶'}
    </button>
  );
}
