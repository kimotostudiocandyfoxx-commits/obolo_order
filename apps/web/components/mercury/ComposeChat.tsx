'use client';

import { useEffect, useRef, useState } from 'react';
import { Artwork } from '@/components/Artwork';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePartner } from '@/lib/partner';
import { GENRES, makeSong, pickGenre, songFromDesign, type Genre, type MadeSong } from '@/lib/mercury/compose';
import { fmt } from '@/lib/mercury/sea';
import { spriteUrl } from '@/lib/onboarding/media';
import { synth } from '@/lib/synth';

/**
 * 作曲 (Mercury) — PLACEHOLDER until the client's design (P-MER-3): talk to your partner and they
 * make the song. Before the visitor has Bati (created after joining ORDER, back at the Moon temple)
 * KIMORIN composes; afterwards Bati does. Voice first (the round device listens), typing to fix.
 * The finished demo is buried in the island's soil, ready to set sail.
 */
type Msg =
  | { who: 'partner'; text: string }
  | { who: 'me'; text: string }
  | { who: 'song'; song: MadeSong };

export function ComposeChat({ onBury, onOpenIsland }: { onBury: (s: MadeSong) => void; onOpenIsland: () => void }) {
  const { me } = useAuth();
  // Bati exists only for ORDER members (journeyDay 10) — until then KIMORIN composes.
  const partner = usePartner();
  const hasBati = partner.isBati;
  const artist = me?.displayName || 'neo';

  const [msgs, setMsgs] = useState<Msg[]>([
    {
      who: 'partner',
      text: hasBati
        ? '作曲しよう！ 今日あったこと、思ってること、なんでも話して。わたしが歌にするね。'
        : '作曲するケン！ 今日あったこと、思ってること、なんでも話してみろ。オレが歌にしてやるケン。',
    },
  ]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [buried, setBuried] = useState<Set<string>>(new Set());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, busy, pending]);
  useEffect(() => () => synth.stop(), []);

  const say = (t: string) => setMsgs((m) => [...m, { who: 'partner', text: t }]);
  // live: the partner and the song come from the AI (Gemini); demo: the offline song maker
  const live = getApi().mode === 'live';
  const history = (extra?: string) => [
    ...msgs.flatMap((m) => (m.who === 'song' ? [] : [{ role: m.who === 'me' ? ('user' as const) : ('partner' as const), text: m.text.slice(0, 400) }])),
    ...(extra ? [{ role: 'user' as const, text: extra.slice(0, 400) }] : []),
  ].slice(-30);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    setMsgs((m) => [...m, { who: 'me', text: t }]);
    if (!live) {
      setPending(t);
      setTimeout(() => say(`いいね！「${[...t].slice(0, 14).join('')}${[...t].length > 14 ? '…' : ''}」か。どんな感じの曲にする${partner.end ? 'ケン？' : '？'}`), 500);
      return;
    }
    setBusy(true);
    setTyping(true);
    try {
      const r = await getApi().composeChat({ partner: partner.name, isBati: hasBati, history: history(t) });
      say(r.reply);
      // the partner decides when it knows enough; after two answers the genres show anyway
      if (r.ready || msgs.filter((m) => m.who === 'me').length + 1 >= 2) setPending(t);
    } catch {
      say(hasBati ? 'ごめん、うまく聞き取れなかった。もう一回話して？' : 'すまん、うまく聞き取れなかったケン。もう一回話してくれ。');
    } finally {
      setBusy(false);
      setTyping(false);
    }
  };

  const compose = async (genre: Genre | 'auto') => {
    if (!pending) return;
    const label = genre === 'auto' ? 'おまかせ！' : GENRES.find((x) => x.id === genre)!.label;
    setMsgs((m) => [...m, { who: 'me', text: label }]);
    const words = pending;
    setPending(null);
    setBusy(true);
    const offline = () => makeSong(words, genre === 'auto' ? pickGenre(words) : genre, artist);
    try {
      if (!live) {
        await new Promise((r) => setTimeout(r, 2200));
        const song = offline();
        setMsgs((m) => [...m, { who: 'partner', text: hasBati ? 'できたよ！ 聴いてみて。' : 'できたケン！ 聴いてみろ。' }, { who: 'song', song }]);
        return;
      }
      const d = await getApi().composeDesign({ partner: partner.name, isBati: hasBati, genre, history: history(label) });
      const song = songFromDesign(d, artist);
      setMsgs((m) => [...m, { who: 'partner', text: d.comment }, { who: 'song', song }]);
    } catch {
      say(hasBati ? 'ごめん、うまく作れなかった……。もう一回ジャンルを選んで？' : 'すまん、うまく作れなかったケン……。もう一回ジャンルを選んでくれ。');
      setPending(words);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 pb-2 pt-[calc(12px+env(safe-area-inset-top))]">
        <Face face={partner.face} size={40} />
        <div>
          <p className="text-sm font-bold">{partner.name}と作曲</p>
          <p className="text-[11px] text-white/50">話しかけると、{partner.name}が曲にしてくれる（{live ? 'AI作曲・伴奏と歌はこれから' : '仮の画面'}）</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m, i) =>
          m.who === 'song' ? (
            <SongCard
              key={i}
              song={m.song}
              playing={playing === m.song.id}
              buried={buried.has(m.song.id)}
              onPlay={() => {
                if (playing === m.song.id) {
                  synth.stop();
                  setPlaying(null);
                } else {
                  synth.play(m.song.preset);
                  setPlaying(m.song.id);
                }
              }}
              onBury={() => {
                synth.stop();
                setPlaying(null);
                onBury(m.song);
                setBuried((b) => new Set(b).add(m.song.id));
                say(hasBati ? '島の土に埋めておいたよ。出航させたくなったら、島から出航してね。' : '島の土に埋めといたケン。出航させたくなったら、島から出航だ！');
              }}
              onAgain={() => {
                setPending(m.song.lyrics[0]);
                say('じゃあ、もう一回。どんな感じにする？');
              }}
              onIsland={onOpenIsland}
            />
          ) : (
            <div key={i} className={`flex items-end gap-2 ${m.who === 'me' ? 'justify-end' : ''}`}>
              {m.who === 'partner' && <Face face={partner.face} size={32} />}
              <p className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.who === 'me' ? 'rounded-br-sm bg-violet-500/90' : 'rounded-bl-sm bg-white/10'}`}>{m.text}</p>
            </div>
          ),
        )}
        {pending && !busy && (
          <div className="flex flex-wrap justify-end gap-2">
            {GENRES.map((g) => (
              <button key={g.id} onClick={() => compose(g.id)} className="rounded-full border border-violet-300/50 bg-violet-500/15 px-3 py-1.5 text-xs">
                {g.label}
              </button>
            ))}
            <button onClick={() => compose('auto')} className="rounded-full bg-gradient-to-r from-orange-400 to-fuchsia-500 px-3 py-1.5 text-xs font-bold">
              おまかせ
            </button>
          </div>
        )}
        {busy && (
          <div className="flex items-end gap-2">
            <Face face={partner.face} size={32} />
            <p className="animate-pulse rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-sm">{typing ? '……' : '♪ 作曲中…'}</p>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
        <Mic onText={(t) => setText(t)} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && void send()}
          placeholder="今日あったことを話してみよう"
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm outline-none"
        />
        <button onClick={() => void send()} disabled={!text.trim() || busy} className="rounded-full bg-violet-500 px-4 py-2.5 text-sm font-bold disabled:opacity-40">
          送る
        </button>
      </div>
    </div>
  );
}

export function Face({ face, size }: { face: string; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={face} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full border border-white/20 object-cover" />;
}

function SongCard({
  song,
  playing,
  buried,
  onPlay,
  onBury,
  onAgain,
  onIsland,
}: {
  song: MadeSong;
  playing: boolean;
  buried: boolean;
  onPlay: () => void;
  onBury: () => void;
  onAgain: () => void;
  onIsland: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-sm rounded-3xl border border-violet-300/30 bg-gradient-to-b from-[#1b1a4a] to-[#0f1230] p-4 shadow-xl">
      <div className="flex items-center gap-3">
        <button onClick={onPlay} className="relative w-20 shrink-0" aria-label={playing ? '止める' : '聴く'}>
          <div className={`aspect-square overflow-hidden rounded-full border-4 border-black/80 ${playing ? 'animate-[spin-slow_10s_linear_infinite]' : ''}`}>
            <Artwork hue={song.hue ?? 260} emoji={song.emoji ?? '🎵'} className="h-full w-full" />
          </div>
          <span className="absolute inset-0 flex items-center justify-center text-2xl drop-shadow">{playing ? '❚❚' : '▶'}</span>
        </button>
        <div className="min-w-0">
          <p className="truncate text-base font-black">{song.title}</p>
          <p className="text-xs text-cyan-300">{song.artist}</p>
          <p className="text-[11px] text-white/50">
            {GENRES.find((g) => g.id === song.genre)?.label} ・ {fmt(song.seconds)} ・ デモ
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-2xl bg-black/25 p-3 text-center text-sm leading-relaxed text-white/85">
        {song.design
          ? song.design.sections.map((s) => (
              <div key={s.name} className="mb-2 last:mb-0">
                <p className="mb-0.5 text-[10px] tracking-widest text-violet-200/60">{s.name === 'chorus' ? 'サビ' : s.name === 'bridge' ? 'Cメロ' : 'Aメロ'}</p>
                {s.lines.map((l, i) => (
                  <p key={i}>{l.text}</p>
                ))}
              </div>
            ))
          : song.lyrics.map((l, i) => <p key={i}>{l}</p>)}
      </div>
      {song.design && (
        <p className="mt-2 text-center text-[11px] text-white/50">
          {song.design.chords.join(' → ')} ・ BPM {song.design.bpm} ・ ▶ はメロディの試し聴き
        </p>
      )}
      {buried ? (
        <button onClick={onIsland} className="mt-3 w-full rounded-full border border-amber-200/50 bg-[#3a2410]/80 py-2 text-sm">
          ⛏ 島の土に埋めました → 島を見る
        </button>
      ) : (
        <div className="mt-3 flex gap-2">
          <button onClick={onAgain} className="flex-1 rounded-full border border-white/20 py-2 text-xs">
            もう一回つくる
          </button>
          <button onClick={onBury} className="flex-[2] rounded-full bg-gradient-to-r from-amber-500 to-orange-500 py-2 text-sm font-bold">
            ⛏ 島の土に埋める（デモ）
          </button>
        </div>
      )}
    </div>
  );
}

/** Voice input (the round device is voice first). Hidden where the browser can't listen. */
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null };
export function Mic({ onText }: { onText: (t: string) => void }) {
  const [on, setOn] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  if (!supported) return null;
  const toggle = () => {
    if (on) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const R = w.SpeechRecognition || w.webkitSpeechRecognition!;
    const r = new R();
    r.lang = 'ja-JP';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(''));
    r.onend = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };
  return (
    <button onClick={toggle} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? 'animate-pulse bg-rose-500' : 'bg-white/10'}`} aria-label={on ? '聞き取りを止める' : '話して入力'}>
      🎙
    </button>
  );
}
