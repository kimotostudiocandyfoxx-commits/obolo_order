'use client';

import type { HomeWork, PlanetSongView, SongLyricLine, WorkTags } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { LETTER_GAP, letterKind, lyricAt, SONG_START_MS, STAGE, TITLE_MS, titleStyle, titleVoiceInTime, type StagePlace } from '@/lib/planetTemplate/mercury';
import m from './Mercury.module.css';

/** load a title's font, only the letters it uses (Google Fonts `text=`), once */
export function useTitleFont(family: string, title: string) {
  useEffect(() => {
    if (typeof document === 'undefined' || !title) return;
    const href = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(title)}&display=swap`;
    if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }, [family, title]);
}

/**
 * The song's title on top (M-R283 / M-R284 / M-R288): big, letter by letter in the song's own font and entrance (kanji a
 * little bigger, hiragana a little smaller), white into the planet's colour with a glow. No label, no "by" (M-R291).
 */
export function KineticTitle({ title, tags, top }: { title: string; tags?: WorkTags | null; top: string }) {
  const st = titleStyle(title, tags);
  useTitleFont(st.family, title);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  const gap = LETTER_GAP[st.motion];
  return (
    <div className={`${m.kin} ${m[`a_${st.motion}`]} ${on ? m.on : ''}`} style={{ top }} data-testid="song-title">
      <div className={m.tt} style={{ fontFamily: `'${st.font}', var(--font-sans)` }}>
        {[...title].map((ch, i) => (
          <span key={i} className={m[letterKind(ch)]} style={{ transitionDelay: `${(0.12 + i * gap).toFixed(2)}s`, ['--gx' as string]: `${(i % 2 ? -1 : 1) * 7}px` }}>
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
      </div>
    </div>
  );
}

/** the picture disc (M-R288): the jacket printed over the whole disc, its grooves and the hole, spinning */
export function PictureDisc({ art, top, width }: { art: string | null; top: string; width: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className={`${m.disc} ${on ? m.on : ''}`} style={{ top, width }} data-testid="song-disc">
      <div className={m.sp} style={art ? { backgroundImage: `url(${art})` } : undefined} />
    </div>
  );
}

/** the lyrics in time with the song: the line sung now, coloured from the left as it is sung, the next one under it, faint */
function Lyrics({ lines, audio, top }: { lines: SongLyricLine[]; audio: React.RefObject<HTMLAudioElement | null>; top: string }) {
  const [cur, setCur] = useState<{ i: number; next: string }>({ i: -1, next: lines[0]?.text ?? '' });
  const [swap, setSwap] = useState(false);
  const ln = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let shown = -2;
    const tick = () => {
      const a = audio.current;
      if (a) {
        const at = lyricAt(lines, a.currentTime, Number.isFinite(a.duration) ? a.duration : null);
        if (at.i !== shown) {
          shown = at.i;
          setSwap(true);
          setTimeout(() => {
            setCur({ i: at.i, next: at.next });
            setSwap(false);
          }, 140);
        }
        ln.current?.style.setProperty('--p', `${at.progress}%`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, audio]);
  return (
    <div className={`${m.lyr} ${swap ? m.swap : ''}`} style={{ top }} data-testid="song-lyrics">
      <div ref={ln} className={m.ln}>
        {cur.i >= 0 ? lines[cur.i].text : ''}
      </div>
      <div className={m.nx}>{cur.next}</div>
    </div>
  );
}

/**
 * A song played the Mercury way (handoff 02 §2): after `startMs` the song starts and the picture disc spins in the middle;
 * the lyrics follow the song (a song without times has none); after `titleMs` the title comes in on top and its reading
 * in the maker's voice plays (when there is one). `loop`: the home and the profile play on until tapped (M-R282); the
 * play view and a continent's shore play it once to the end (M-R290) and say so with onEnd.
 */
export function SongStage({
  work,
  load,
  place,
  loop,
  startMs = SONG_START_MS,
  titleMs = TITLE_MS,
  onEnd,
}: {
  work: HomeWork;
  load: (w: HomeWork) => Promise<PlanetSongView | null>;
  place: StagePlace;
  loop: boolean;
  startMs?: number;
  titleMs?: number;
  onEnd?: () => void;
}) {
  const at = STAGE[place];
  const [song, setSong] = useState<PlanetSongView | null>(null);
  const [started, setStarted] = useState(startMs <= 0);
  const [titled, setTitled] = useState(titleMs <= 0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const voice = useRef<HTMLAudioElement | null>(null);
  const opened = useRef(0);
  const ended = useRef(onEnd);
  ended.current = onEnd;

  useEffect(() => {
    let live = true;
    opened.current = Date.now();
    load(work)
      .then((s) => live && setSong(s))
      .catch(() => live && setSong(null));
    const t1 = setTimeout(() => setStarted(true), startMs);
    const t2 = setTimeout(() => setTitled(true), titleMs);
    return () => {
      live = false;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [work, load, startMs, titleMs]);

  // the song itself (from the first tap the page may play sound)
  useEffect(() => {
    if (!started || !song?.url) return;
    const a = new Audio(song.url);
    a.loop = loop;
    a.preload = 'auto';
    audio.current = a;
    const done = () => ended.current?.();
    a.addEventListener('ended', done);
    a.play().catch(() => undefined);
    return () => {
      a.removeEventListener('ended', done);
      a.pause();
      a.src = '';
      audio.current = null;
    };
  }, [started, song, loop]);
  // no sound to play (a work without a song): it still ends, after a while
  useEffect(() => {
    if (!started || song?.url || loop) return;
    const id = setTimeout(() => ended.current?.(), 6000);
    return () => clearTimeout(id);
  }, [started, song, loop]);
  // the title read in its maker's own voice (none when they have no registered voice): loaded with the song, so it is
  // ready when the title comes in
  useEffect(() => {
    if (!song?.titleVoice) return;
    const v = new Audio(song.titleVoice);
    v.preload = 'auto';
    voice.current = v;
    return () => {
      v.pause();
      v.src = '';
      voice.current = null;
    };
  }, [song]);
  // …and read with the title's entrance (2.2 s), over the song as it is; one that comes much later is left out
  useEffect(() => {
    const v = voice.current;
    if (!titled || !v || !titleVoiceInTime(Date.now() - opened.current, titleMs)) return;
    v.play().catch(() => undefined);
  }, [titled, song, titleMs]);

  const title = song?.title || work.title || '';
  return (
    <>
      {started && <PictureDisc art={song?.art ?? work.thumbUrl ?? null} top={at.disc.top} width={at.disc.width} />}
      {started && song && song.lyrics.length > 0 && <Lyrics lines={song.lyrics} audio={audio} top={at.lyrics} />}
      {titled && title && <KineticTitle title={title} tags={work.tags} top={at.title} />}
    </>
  );
}
