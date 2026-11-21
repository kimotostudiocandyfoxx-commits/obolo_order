'use client';

import type { PlanetId } from '@obolo/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Glyph, GLYPH_NAMES, type GlyphId } from '@/components/bluena/glyphs';
import { PlanetMark } from '@/components/bluena/PlanetMark';
import { LiveShoot } from '@/components/mars/LiveMars';
import { ShootChat } from '@/components/mars/ShootChat';
import { ComposeChat, Face } from '@/components/mercury/ComposeChat';
import { ApiError, getApi } from '@/lib/api';
import { useMars } from '@/lib/mars/state';
import { useMercury } from '@/lib/mercury/state';
import { usePartner } from '@/lib/partner';

/** what can be made, in the order of the design (docs/工房とブルーナ_設計.md §3.2), and the planet it is shown on */
export type MakeKind = 'song' | 'video' | 'art' | 'radio' | 'goods' | 'voice' | 'book' | 'game' | 'any';
const KINDS: {
  id: MakeKind;
  glyph: GlyphId;
  planet: PlanetId | 'pluto' | null;
  folder: string | null;
}[] = [
  { id: 'song', glyph: 'song', planet: 'mercury', folder: 'mercury' },
  { id: 'video', glyph: 'video', planet: 'mars', folder: 'mars' },
  { id: 'art', glyph: 'art', planet: 'jupiter', folder: 'jupiter' },
  { id: 'radio', glyph: 'radio', planet: 'venus', folder: 'venus' },
  { id: 'goods', glyph: 'goods', planet: 'uranus', folder: 'uranus' },
  { id: 'voice', glyph: 'voice', planet: 'saturn', folder: 'saturn' },
  { id: 'book', glyph: 'book', planet: 'pluto', folder: 'pluto' },
  { id: 'game', glyph: 'game', planet: 'neptune', folder: 'neptune' },
  { id: 'any', glyph: 'any', planet: null, folder: null },
];
const isKind = (k: string | null): k is MakeKind => !!k && KINDS.some((x) => x.id === k);

/**
 * 月の工房 (client decision 2026-11-21, docs/工房とブルーナ_設計.md §1.2・§3.2): Bati's workshop in the Moon temple.
 * 〔つくる〕 opens Bluena's gate, a square screen widens and you are inside. Bati asks「何を作る？」 with the marks;
 * what you make goes into Bluena by itself (the folder of its kind), and 〔公開する〕 projects it to its planet.
 * Coming from a planet's 〔月で作る〕 (?kind=song …) the kind is already chosen.
 * Only you see what is in here, and making things does not use the day's 88 minutes (§13).
 */
export function MoonAtelier() {
  const params = useSearchParams();
  const router = useRouter();
  const first = params.get('kind');
  const [kind, setKind] = useState<MakeKind | null>(isKind(first) ? first : null);
  const [gate, setGate] = useState(true);
  const partner = usePartner();

  // the gate plays once per visit; reduced motion → straight in
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setGate(false);
    const t = setTimeout(() => setGate(false), 1500);
    return () => clearTimeout(t);
  }, []);

  const pick = (k: MakeKind | null) => {
    setKind(k);
    const q = new URLSearchParams(params.toString());
    if (k) q.set('kind', k);
    else q.delete('kind');
    router.replace(`/moon/atelier${q.size ? `?${q}` : ''}`, { scroll: false });
  };

  const k = KINDS.find((x) => x.id === kind);
  return (
    <main className="pt-safe relative mx-auto flex h-svh max-w-xl flex-col overflow-hidden bg-[radial-gradient(130%_70%_at_50%_0%,#1d2a52_0%,#0b1027_55%,#05060f_100%)]">
      <header className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => (kind ? pick(null) : router.back())} className="btn btn-ghost h-9 w-9 !p-0 text-lg" aria-label="もどる">
          ←
        </button>
        <Face face={partner.face} size={34} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-black tracking-wide text-amber-50">月で作る</p>
          {k && (
            <p className="flex items-center gap-1 text-[11px] text-sky-100/70">
              <Glyph id={k.glyph} label={false} className="h-3.5 w-3.5" />
              {GLYPH_NAMES[k.glyph]}
            </p>
          )}
        </div>
        <Link href={k?.folder ? `/bluena?folder=${k.folder}` : '/bluena'} aria-label="ブルーナ" className="block h-9 w-9 overflow-hidden rounded-full border border-sky-200/40 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ui/bluena-icon.webp" alt="" className="h-full w-full scale-125 object-cover" />
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{kind ? <Make kind={kind} onKind={pick} /> : <Choose onPick={pick} />}</div>

      {gate && <Gate onSkip={() => setGate(false)} />}
    </main>
  );
}

/** Bluena's gate opens and a square screen widens into the atelier (no new pictures: shapes and light only) */
function Gate({ onSkip }: { onSkip: () => void }) {
  return (
    <button onClick={onSkip} aria-label="月へ入る" className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#03040b]">
      <span className="absolute h-[70vmin] w-[70vmin] animate-[atelier-glow_1.5s_ease-out_forwards] rounded-full bg-[radial-gradient(circle,rgba(140,210,255,0.55),rgba(80,140,255,0.15)_45%,transparent_70%)]" />
      {/* the square screen */}
      <span className="absolute aspect-square w-[62vmin] animate-[atelier-screen_1.5s_cubic-bezier(.6,0,.3,1)_forwards] rounded-3xl border border-sky-100/50 bg-[radial-gradient(130%_70%_at_50%_0%,#1d2a52_0%,#0b1027_70%)] shadow-[0_0_60px_rgba(120,200,255,0.5)]" />
      {/* the two doors of the gate */}
      <span className="absolute left-0 top-0 h-full w-1/2 animate-[atelier-door-l_1.5s_cubic-bezier(.7,0,.3,1)_forwards] border-r border-sky-200/40 bg-gradient-to-l from-[#0e1840] to-[#03040b]" />
      <span className="absolute right-0 top-0 h-full w-1/2 animate-[atelier-door-r_1.5s_cubic-bezier(.7,0,.3,1)_forwards] border-l border-sky-200/40 bg-gradient-to-r from-[#0e1840] to-[#03040b]" />
      <span className="absolute h-16 w-16 animate-[atelier-key_1.5s_ease-out_forwards] overflow-hidden rounded-full border border-sky-200/60 shadow-[0_0_30px_rgba(140,220,255,0.9)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ui/bluena-icon.webp" alt="" className="h-full w-full scale-125 object-cover" />
      </span>
    </button>
  );
}

function Bubble({ face, children }: { face: string; children: ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <Face face={face} size={32} />
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

/** 「何を作る？」 — the marks, with the planet each one is shown on */
function Choose({ onPick }: { onPick: (k: MakeKind) => void }) {
  const partner = usePartner();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2">
      <Bubble face={partner.face}>{partner.isBati ? '何を作る？' : '何を作るケン？'}</Bubble>
      <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 gap-3">
        {KINDS.map((x) => (
          <button
            key={x.id}
            onClick={() => onPick(x.id)}
            aria-label={GLYPH_NAMES[x.glyph]}
            className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-3xl border ${x.id === 'any' ? 'border-amber-200/40 bg-amber-200/10 text-amber-100' : 'border-sky-200/20 bg-white/5 text-sky-100'} active:scale-95`}
          >
            <Glyph id={x.glyph} label={false} className="h-9 w-9" />
            <span className="text-[10px] text-white/55">{GLYPH_NAMES[x.glyph]}</span>
            {x.planet && (
              <span className="absolute right-2 top-2 opacity-80">
                <PlanetMark id={x.planet} size={14} />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function Make({ kind, onKind }: { kind: MakeKind; onKind: (k: MakeKind | null) => void }) {
  const live = getApi().mode === 'live';
  const router = useRouter();
  const mercury = useMercury();
  const mars = useMars();
  // おまかせ: talk first — today a talk becomes a song (the one kind Bati can make end to end from words)
  if (kind === 'song' || kind === 'any')
    return (
      <ComposeChat
        header={false}
        bluena
        onBury={(s) => {
          if (!live) mercury.bury(s);
        }}
        onOpenIsland={() => router.push('/bluena?folder=mercury')}
        onPublish={async (s) => {
          try {
            if (s.songId)
              await getApi().createPlanetPost('mercury', {
                sourceId: s.songId,
                title: s.title,
                text: '',
              });
            else if (!live) mercury.release(s.id);
            else return false;
            return true;
          } catch {
            return false;
          }
        }}
      />
    );
  if (kind === 'video')
    return live ? (
      <LiveShoot onPosted={() => router.push('/mars')} />
    ) : (
      <ShootChat header={false} onKeep={(v) => mars.keep(v)} onOpenStudio={() => router.push('/bluena?folder=mars')} onPreview={() => undefined} />
    );
  if (kind === 'art') return <ArtMake />;
  return <Elsewhere kind={kind} onKind={onKind} />;
}

/** アート: a picture or photo from the device goes into Bluena's Jupiter folder (the roots) */
function ArtMake() {
  const partner = usePartner();
  const ken = (a: string, b: string) => (partner.isBati ? a : b);
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'saved'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const add = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError(ken('動画は、〔再生の三角〕で作ってね', '動画は、〔再生の三角〕で作るケン'));
    setError('');
    setState('busy');
    try {
      const ph = await getApi().uploadPhoto(f);
      await getApi().addJupiterRoot({ mediaId: ph.id });
      setPreview(URL.createObjectURL(f));
      setState('saved');
    } catch (e) {
      setState('idle');
      setError(
        e instanceof ApiError && e.code === 'BAD_IMAGE'
          ? 'この絵は読みこめなかった…'
          : e instanceof ApiError && e.code === 'STORAGE_FULL'
            ? '保存できる容量がいっぱいです'
            : 'うまく入れられなかった…もう一度',
      );
    }
  };

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2">
      {/* PLACEHOLDER (P-ATELIER-2): painting with Bati (正方形の絵・字だけの絵・写真の加工) comes later; today a picture is brought in */}
      <Bubble face={partner.face}>{ken('アートにする絵や写真を、えらんでね。', 'アートにする絵や写真を、えらぶケン。')}</Bubble>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void add(e.target.files?.[0])} />
      {state !== 'saved' && (
        <button
          onClick={() => input.current?.click()}
          disabled={state === 'busy'}
          className="mx-auto flex aspect-square w-40 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-emerald-200/40 bg-emerald-200/5 text-emerald-100 disabled:opacity-60"
        >
          <Glyph id="art" label={false} className="h-10 w-10" />
          <span className="text-xs">{state === 'busy' ? 'しまっています…' : '絵・写真をえらぶ'}</span>
        </button>
      )}
      {state === 'saved' && (
        <>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="mx-auto aspect-square w-48 rounded-2xl border border-white/15 object-cover" />
          )}
          <Bubble face={partner.face}>{ken('ブルーナにしまったよ。', 'ブルーナにしまったケン。')}</Bubble>
          <Saved folder="jupiter" planet="jupiter" publishHref="/jupiter" again={() => input.current?.click()} />
        </>
      )}
      {error && <p className="text-center text-sm text-red-300">{error}</p>}
    </div>
  );
}

/** 〔ブルーナを見る〕〔公開する〕 after something was put away */
function Saved({ folder, planet, publishHref, again }: { folder: string; planet: PlanetId; publishHref: string; again?: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm gap-2">
      <Link href={`/bluena?folder=${folder}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sky-200/40 bg-sky-300/10 py-2 text-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ui/bluena-icon.webp" alt="" className="h-5 w-5 scale-125 rounded-full object-cover" />
        ブルーナを見る
      </Link>
      {/* PLACEHOLDER (P-BLUENA-1): a Jupiter post (words, branch) is still finished on Jupiter */}
      <Link href={publishHref} className="flex flex-[1.3] items-center justify-center gap-1.5 rounded-full bg-sky-300 py-2 text-sm font-black text-slate-950">
        <PlanetMark id={planet} size={16} />
        公開する
      </Link>
      {again && (
        <button onClick={again} className="rounded-full border border-white/20 px-3 py-2 text-xs" aria-label="もう1枚">
          ＋
        </button>
      )}
    </div>
  );
}

/**
 * The kinds that are not made in this room (yet).
 * ラジオ and 声 are the two exceptions where making and showing happen together (§0): the booth on Venus and the
 * Kororin relay on Saturn. グッズ・本・ゲーム are not built yet.
 * PLACEHOLDER (P-ATELIER-2): Bati's lines here are UI stand-ins until the story chat writes them.
 */
function Elsewhere({ kind, onKind }: { kind: MakeKind; onKind: (k: MakeKind | null) => void }) {
  const partner = usePartner();
  const ken = (a: string, b: string) => (partner.isBati ? a : b);
  const line =
    kind === 'radio'
      ? ken('ラジオ番組は、金星の放送ブースで録るよ。録った番組は、ブルーナにしまわれるよ。', 'ラジオ番組は、金星の放送ブースで録るケン。録った番組は、ブルーナにしまわれるぞ。')
      : kind === 'voice'
        ? ken('声は、土星でその場で落とすよ。', '声は、土星でその場で落とすケン。')
        : ken('これは、まだ準備中。もうすぐ一緒に作れるようになるよ。', 'これは、まだ準備中だケン。もうすぐ一緒に作れるようになるぞ。');
  const go = kind === 'radio' ? { href: '/venus?booth=1', planet: 'venus' as const } : kind === 'voice' ? { href: '/saturn', planet: 'saturn' as const } : null;
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-2">
      <Bubble face={partner.face}>{line}</Bubble>
      <div className="mx-auto flex max-w-sm gap-2">
        {go ? (
          <Link href={go.href} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-sky-300 py-2.5 text-sm font-black text-slate-950">
            <PlanetMark id={go.planet} size={18} />
            {kind === 'radio' ? '放送ブースへ' : '土星へ'}
          </Link>
        ) : null}
        <button onClick={() => onKind(null)} className="flex-1 rounded-full border border-white/20 py-2.5 text-sm">
          ほかのものを作る
        </button>
      </div>
    </div>
  );
}
