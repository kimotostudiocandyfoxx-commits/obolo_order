'use client';

import { KORORIN_VOICE_STYLE, neoVoiceUrl, type PlanetId, type SaturnPostView } from '@obolo/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Glyph, GLYPH_NAMES, type GlyphId } from '@/components/bluena/glyphs';
import { PlanetMark } from '@/components/bluena/PlanetMark';
import { LineIcon } from '@/components/LineIcon';
import { Booth } from '@/components/venus/radio/Booth';
import { LiveShoot } from '@/components/mars/LiveMars';
import { ShootChat } from '@/components/mars/ShootChat';
import { ComposeChat, Face } from '@/components/mercury/ComposeChat';
import { ApiError, getApi } from '@/lib/api';
import { isOpen, lockLine, omakaseKind } from '@/lib/atelier/unlock';
import { playBlob, stopAudio, toggleAudio } from '@/lib/audio';
import { useAuth } from '@/lib/auth';
import { useMars } from '@/lib/mars/state';
import { useMercury } from '@/lib/mercury/state';
import { usePartner } from '@/lib/partner';
import { singKororin } from '@/lib/saturn/sing';
import { useRecorder } from '@/lib/useRecorder';

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
 * Making happens only here (M-R208): on the first journey each day opens one more kind (lib/atelier/unlock.ts) and the
 * rest wait with a thin lock; a kind asked for before its day (?kind=… from a Bluena folder) shows the lock's line.
 */
export function MoonAtelier() {
  const params = useSearchParams();
  const router = useRouter();
  const first = params.get('kind');
  const [kind, setKind] = useState<MakeKind | null>(isKind(first) ? first : null);
  const [gate, setGate] = useState(true);
  const partner = usePartner();
  const day = useAuth().me?.journeyDay;
  // a locked kind is never opened: the choice screen shows its line instead
  const [notice, setNotice] = useState<MakeKind | null>(isKind(first) && !isOpen(first, day) ? first : null);
  useEffect(() => {
    if (kind && !isOpen(kind, day)) {
      setNotice(kind);
      setKind(null);
    }
  }, [kind, day]);

  // the gate plays once per visit; reduced motion → straight in
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setGate(false);
    const t = setTimeout(() => setGate(false), 1500);
    return () => clearTimeout(t);
  }, []);

  const pick = (k: MakeKind | null) => {
    if (k && !isOpen(k, day)) return setNotice(k);
    setNotice(null);
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

      <div className="flex min-h-0 flex-1 flex-col">{kind && isOpen(kind, day) ? <Make kind={kind} day={day} onKind={pick} /> : <Choose day={day} notice={notice} onPick={pick} />}</div>

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

/** 「何を作る？」 — the marks, with the planet each one is shown on; a kind not open yet waits under a thin lock */
function Choose({ day, notice, onPick }: { day: number | undefined; notice: MakeKind | null; onPick: (k: MakeKind) => void }) {
  const partner = usePartner();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2">
      <Bubble face={partner.face}>{partner.isBati ? '何を作る？' : '何を作るケン？'}</Bubble>
      <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 gap-3">
        {KINDS.map((x) => {
          const locked = !isOpen(x.id, day);
          return (
            <button
              key={x.id}
              onClick={() => onPick(x.id)}
              aria-label={locked ? `${GLYPH_NAMES[x.glyph]}（${lockLine(x.id)}）` : GLYPH_NAMES[x.glyph]}
              aria-disabled={locked}
              className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-3xl border ${
                locked
                  ? `border-white/10 bg-white/[0.02] text-white/30 ${notice === x.id ? 'ring-1 ring-sky-200/40' : ''}`
                  : x.id === 'any'
                    ? 'border-amber-200/40 bg-amber-200/10 text-amber-100 active:scale-95'
                    : 'border-sky-200/20 bg-white/5 text-sky-100 active:scale-95'
              }`}
            >
              <Glyph id={x.glyph} label={false} className="h-9 w-9" />
              <span className={`text-[10px] ${locked ? 'text-white/30' : 'text-white/55'}`}>{GLYPH_NAMES[x.glyph]}</span>
              {x.planet && (
                <span className={`absolute right-2 top-2 ${locked ? 'opacity-30' : 'opacity-80'}`}>
                  <PlanetMark id={x.planet} size={14} />
                </span>
              )}
              {locked && (
                <span className="absolute bottom-2 right-2 text-white/45">
                  <LineIcon id="lock" className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-4 min-h-5 text-center text-xs text-sky-100/70">
        {notice ? lockLine(notice) : ''}
      </p>
    </div>
  );
}

function Make({ kind: asked, day, onKind }: { kind: MakeKind; day: number | undefined; onKind: (k: MakeKind | null) => void }) {
  const live = getApi().mode === 'live';
  const router = useRouter();
  const mercury = useMercury();
  const mars = useMars();
  // おまかせ follows what is open: a talk becomes a song once songs are open, before that the newest kind of the journey
  const kind: MakeKind = asked === 'any' ? (omakaseKind(day) ?? 'any') : asked;
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
  if (kind === 'voice') return <VoiceMake />;
  // 金星のラジオ (M-R208): a recorded show (FM) — your songs and your voice, listened back, then flown to Venus.
  // Live streaming stays the members' booth on Venus.
  if (kind === 'radio')
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Booth use="record" bare />
      </div>
    );
  return <Elsewhere onKind={onKind} />;
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
 * The kinds that are not made in this room yet: グッズ・本・ゲーム (the members' later planets).
 * PLACEHOLDER (P-ATELIER-2): Bati's lines here are UI stand-ins until the story chat writes them.
 */
function Elsewhere({ onKind }: { onKind: (k: MakeKind | null) => void }) {
  const partner = usePartner();
  const ken = (a: string, b: string) => (partner.isBati ? a : b);
  const line = ken('これは、まだ準備中。もうすぐ一緒に作れるようになるよ。', 'これは、まだ準備中だケン。もうすぐ一緒に作れるようになるぞ。');
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-2">
      <Bubble face={partner.face}>{line}</Bubble>
      <div className="mx-auto flex max-w-sm gap-2">
        <button onClick={() => onKind(null)} className="flex-1 rounded-full border border-white/20 py-2.5 text-sm">
          ほかのものを作る
        </button>
      </div>
    </div>
  );
}

/**
 * コロリン (M-R208, day 3): a memo or a spoken mutter. Speak (mic) or type, hear it back, keep it → Bluena's Saturn folder
 * (a room-only kororin: nobody else sees it) → 〔公開する〕 flies it to Saturn, where its 88 hours start.
 * A spoken take sings in your own voice (lib/saturn/sing, on the phone); typed words are read in the kororin voice.
 */
function VoiceMake() {
  const { me } = useAuth();
  const rec = useRecorder(20);
  const [words, setWords] = useState('');
  const [sung, setSung] = useState<Blob | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'flown'>('idle');
  const [post, setPost] = useState<SaturnPostView | null>(null);
  const [error, setError] = useState('');
  useEffect(() => () => stopAudio(), []);
  // a new take: the sung copy is made again
  useEffect(() => setSung(null), [rec.blob]);

  const take = rec.blob && rec.blob.size > 1000 ? rec.blob : null;
  const text = words.trim();
  const ready = !!take || !!text;

  const singing = async (b: Blob) => {
    if (sung) return sung;
    const s = await singKororin(b, text).catch(() => b);
    setSung(s);
    return s;
  };
  const listen = async () => {
    setError('');
    try {
      if (take) await playBlob(await singing(take), 'atelier-kororin');
      else if (text) await toggleAudio(neoVoiceUrl(KORORIN_VOICE_STYLE, me?.neoForm, text));
    } catch {
      setError('うまく鳴らせなかった…');
    }
  };
  const mic = async () => {
    setError('');
    if (rec.recording) return rec.stop();
    stopAudio();
    await rec.start();
  };

  const keep = async () => {
    if (!ready) return;
    setState('busy');
    setError('');
    try {
      let said = text;
      let voiceMediaId: string | undefined;
      if (take) {
        voiceMediaId = (await getApi().uploadVoice(await singing(take))).id;
        // spoken without words: the words come from the take (the kororin needs a line to show)
        if (!said && getApi().mode === 'live') said = (await getApi().transcribe(voiceMediaId).catch(() => ({ text: '' }))).text.trim();
      }
      said = (said || '……').slice(0, 140);
      const p = await getApi().createSaturnPost(
        voiceMediaId ? { text: said, voiceMediaId, voiceDurationSec: rec.duration || undefined, room: true } : { text: said, voiceStyle: KORORIN_VOICE_STYLE, readBy: 'bati', room: true },
      );
      setPost(p);
      setState('saved');
    } catch (e) {
      setState('idle');
      setError(e instanceof ApiError && e.code === 'MODERATION' ? 'そのことばは、コロリンにできないよ' : e instanceof ApiError && e.code === 'STORAGE_FULL' ? '保存できる容量がいっぱいです' : 'うまくしまえなかった…もう一度');
    }
  };
  const publish = async () => {
    if (!post) return;
    setState('busy');
    try {
      setPost(await getApi().publishSaturnPost(post.id));
      setState('flown');
    } catch {
      setState('saved');
      setError('公開できなかった…');
    }
  };
  const again = () => {
    rec.reset();
    setWords('');
    setSung(null);
    setPost(null);
    setState('idle');
    setError('');
  };

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2">
      {state === 'idle' || (state === 'busy' && !post) ? (
        <>
          <p className="text-center text-sm text-sky-100/80">ひとこと、つぶやく。声でも、文字でも。</p>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => void mic()}
              disabled={state === 'busy'}
              aria-label={rec.recording ? '止める' : '声でつぶやく'}
              className={`flex h-20 w-20 items-center justify-center rounded-full border ${rec.recording ? 'animate-pulse border-red-300/60 bg-red-500/80 text-white' : 'border-amber-200/40 bg-amber-200/10 text-amber-100'} disabled:opacity-50`}
            >
              <LineIcon id="mic" className="h-9 w-9" />
            </button>
            <span className="text-[11px] text-white/55">
              {rec.recording ? `${rec.elapsed}秒…もう一度押すと止まる` : take ? '声が入った' : rec.error ? 'マイクが使えない…文字でもつぶやける' : '押して話す（20秒まで）'}
            </span>
          </div>
          <textarea
            value={words}
            onChange={(e) => setWords(e.target.value.slice(0, 140))}
            rows={2}
            placeholder={take ? 'ことばも添える（なくてもいい）' : 'または、文字でつぶやく'}
            className="w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none"
          />
          <div className="mx-auto flex max-w-sm gap-2">
            <button onClick={() => void listen()} disabled={!ready || rec.recording || state === 'busy'} className="flex-1 rounded-full border border-white/20 py-2.5 text-sm disabled:opacity-40">
              聴いてみる
            </button>
            <button onClick={() => void keep()} disabled={!ready || rec.recording || state === 'busy'} className="flex-[1.3] rounded-full bg-amber-200 py-2.5 text-sm font-black text-slate-950 disabled:opacity-40">
              {state === 'busy' ? 'しまっています…' : 'ブルーナにしまう'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mx-auto max-w-sm rounded-2xl border border-amber-200/20 bg-amber-200/5 p-3 text-center">
            <p className="text-sm font-bold">{post?.text}</p>
            <p className="mt-1 text-[11px] text-white/55">{state === 'flown' ? '土星へ飛んでいった（88時間）' : 'ブルーナの土星フォルダにしまった（自分だけ）'}</p>
            {post?.voiceUrl && (
              <button onClick={() => void toggleAudio(post.voiceUrl).catch(() => undefined)} className="mt-2 rounded-full bg-white/10 px-3 py-1 text-xs">
                聴く
              </button>
            )}
          </div>
          <div className="mx-auto flex max-w-sm gap-2">
            <Link href="/bluena?folder=saturn" className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sky-200/40 bg-sky-300/10 py-2 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ui/bluena-icon.webp" alt="" className="h-5 w-5 scale-125 rounded-full object-cover" />
              ブルーナを見る
            </Link>
            {state === 'flown' ? (
              <Link href="/saturn" className="flex flex-[1.3] items-center justify-center gap-1.5 rounded-full bg-sky-300 py-2 text-sm font-black text-slate-950">
                <PlanetMark id="saturn" size={16} />
                土星へ行く
              </Link>
            ) : (
              <button onClick={() => void publish()} disabled={state === 'busy'} className="flex flex-[1.3] items-center justify-center gap-1.5 rounded-full bg-sky-300 py-2 text-sm font-black text-slate-950 disabled:opacity-60">
                <PlanetMark id="saturn" size={16} />
                公開する
              </button>
            )}
            <button onClick={again} className="rounded-full border border-white/20 px-3 py-2 text-xs" aria-label="もう1つ">
              ＋
            </button>
          </div>
        </>
      )}
      {error && <p className="text-center text-sm text-red-300">{error}</p>}
    </div>
  );
}
