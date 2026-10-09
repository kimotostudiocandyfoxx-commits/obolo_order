'use client';

import { useEffect, useRef, useState } from 'react';
import { Artwork } from '@/components/Artwork';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePartner } from '@/lib/partner';
import type { SongEditCommand, SongView } from '@obolo/shared';
import { GENRES, makeSong, pickGenre, songFromDesign, type Genre, type MadeSong } from '@/lib/mercury/compose';
import { fmt } from '@/lib/mercury/sea';
import { spriteUrl } from '@/lib/onboarding/media';
import { synth } from '@/lib/synth';
import { useDictation } from '@/lib/useDictation';

/**
 * 作曲 (Mercury) — PLACEHOLDER until the client's design (P-MER-3): talk to your partner and they
 * make the song. Before the visitor has Bati (created after joining ORDER, back at the Moon temple)
 * KIMORIN composes; afterwards Bati does. Voice first (the round device listens), typing to fix.
 * The finished demo is buried in the island's soil, ready to set sail.
 */
type Msg = { who: 'partner'; text: string } | { who: 'me'; text: string } | { who: 'song'; song: MadeSong };

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
        ? 'やあ、今日はどんな曲を作っちゃう？ 今日あったこと、思ってること、なんでも話して。わたしが歌にするね。'
        : '作曲するケン！ 今日あったこと、思ってること、なんでも話してみろ。オレが歌にしてやるケン。',
    },
  ]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [buried, setBuried] = useState<Set<string>>(new Set());
  // 手直し mode: chat messages go to the song's edit endpoint (Gemini picks the change)
  const [editing, setEditing] = useState<string | null>(null);
  const [warming, setWarming] = useState<{ songId: string; command: SongEditCommand } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, busy, pending]);
  useEffect(() => () => synth.stop(), []);
  // wake the GPU studio while we chat: a cold start takes 1-2 min, about as long as the talk,
  // so the instrumental is usually ready to make by the time the song is written
  useEffect(() => {
    if (getApi().mode === 'live')
      void getApi()
        .composeMusicStatus()
        .catch(() => {});
  }, []);

  const say = (t: string) => setMsgs((m) => [...m, { who: 'partner', text: t }]);
  // live: the partner and the song come from the AI (Gemini); demo: the offline song maker
  const live = getApi().mode === 'live';
  const history = (extra?: string) =>
    [
      ...msgs.flatMap((m) => (m.who === 'song' ? [] : [{ role: m.who === 'me' ? ('user' as const) : ('partner' as const), text: m.text.slice(0, 400) }])),
      ...(extra ? [{ role: 'user' as const, text: extra.slice(0, 400) }] : []),
    ].slice(-30);

  const songMsg = (id: string) => msgs.find((m): m is Extract<Msg, { who: 'song' }> => m.who === 'song' && m.song.id === id)?.song;
  const updateSong = (id: string, v: SongView) =>
    setMsgs((ms) =>
      ms.map((x) => (x.who === 'song' && x.song.id === id ? { ...x, song: { ...x.song, songUrl: v.url, songId: v.id, instrumentalUrl: v.instrumentalUrl, seconds: Math.round(v.seconds) } } : x)),
    );

  /** One 手直し round: the message (or a command retried after the GPU warmed up) → reply + new mix. */
  const editSong = async (id: string, body: { message?: string; command?: SongEditCommand }) => {
    const song = songMsg(id);
    if (!song?.songId) return;
    synth.stop();
    setPlaying(null);
    setBusy(true);
    try {
      const r = await getApi().composeSongEdit(song.songId, {
        ...body,
        history: history().slice(-8),
        partner: partner.name,
        isBati: hasBati,
      });
      say(r.reply);
      if (r.pending === 'MUSIC_WARMING' && r.command) setWarming({ songId: id, command: r.command });
      else {
        setWarming(null);
        if (r.action !== 'CHAT') updateSong(id, r.song);
      }
    } catch (e) {
      say((hasBati ? 'ごめん、うまく直せなかった……もう一回言ってみて？' : 'すまん、うまく直せなかったケン……もう一回言ってみろ。') + detail(e));
    } finally {
      setBusy(false);
    }
  };

  // a genre edit waits for the GPU studio: poll and send the same command once it is ready
  useEffect(() => {
    if (!warming) return;
    let on = true;
    const t = setInterval(async () => {
      try {
        const st = await getApi().composeMusicStatus();
        if (on && st.ready) {
          clearInterval(t);
          const w = warming;
          setWarming(null);
          await editSong(w.songId, { command: w.command });
        }
      } catch {
        /* keep polling */
      }
    }, 10000);
    return () => {
      on = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warming]);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    setMsgs((m) => [...m, { who: 'me', text: t }]);
    if (editing) return void editSong(editing, { message: t });
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
    } catch (e) {
      say((hasBati ? 'ごめん、うまく聞き取れなかった。もう一回話して？' : 'すまん、うまく聞き取れなかったケン。もう一回話してくれ。') + detail(e));
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
    } catch (e) {
      say((hasBati ? 'ごめん、うまく作れなかった……。もう一回ジャンルを選んで？' : 'すまん、うまく作れなかったケン……。もう一回ジャンルを選んでくれ。') + detail(e));
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
          <p className="text-[11px] text-white/50">
            話しかけると、{partner.name}が曲にしてくれる（{live ? '伴奏と歌も入れられるよ' : '仮の画面'}）
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m, i) =>
          m.who === 'song' ? (
            <SongCard
              key={i}
              song={m.song}
              playing={playing === m.song.id}
              buried={buried.has(`${m.song.id}:${m.song.songUrl ?? ''}`) || (!m.song.songUrl && buried.has(`${m.song.id}:`))}
              onPlay={() => {
                if (playing === m.song.id) {
                  synth.stop();
                  setPlaying(null);
                } else {
                  synth.play(m.song.preset);
                  setPlaying(m.song.id);
                }
              }}
              onBury={async () => {
                synth.stop();
                setPlaying(null);
                // 保存する: a sung song keeps this version on the server and plays its recording on the island
                if (m.song.songId) {
                  try {
                    await getApi().composeSongSave(m.song.songId);
                  } catch (e) {
                    say((hasBati ? 'ごめん、保存できなかった……' : 'すまん、保存できなかったケン……') + detail(e));
                    return;
                  }
                }
                onBury(m.song.songUrl ? { ...m.song, id: `${m.song.id}-${Date.now()}`, audioUrl: m.song.songUrl } : m.song);
                setBuried((b) => new Set(b).add(`${m.song.id}:${m.song.songUrl ?? ''}`));
                if (editing === m.song.id) setEditing(null);
                say(hasBati ? '保存して、島の土に埋めておいたよ。出航させたくなったら、島から出航してね。' : '保存して、島の土に埋めといたケン。出航させたくなったら、島から出航だ！');
              }}
              editing={editing === m.song.id}
              onEdit={() => {
                setEditing(m.song.id);
                say(
                  hasBati
                    ? 'どこを直す？ 「もう少し速く」「歌を大きく」「サビの歌詞を変えて」「サビだけわたしの声で」「歌い出しを遅らせて」「ロックっぽくして」…なんでも言ってね！'
                    : 'どこを直すケン？ 「もう少し速く」「歌を大きく」「サビの歌詞を変えて」「サビだけバティの声で」「歌い出しを遅らせて」「ロックっぽくして」…なんでも言ってみろ！',
                );
              }}
              onEditDone={() => {
                setEditing(null);
                setWarming(null);
                say(hasBati ? 'おつかれさま！気に入ったら「保存する」を押してね。' : 'おつかれだケン！気に入ったら「保存する」だ。');
              }}
              onAgain={() => {
                setPending(m.song.lyrics[0]);
                say('じゃあ、もう一回。どんな感じにする？');
              }}
              onIsland={onOpenIsland}
              live={live}
              onSung={(v) => {
                synth.stop();
                setPlaying(null);
                updateSong(m.song.id, v);
              }}
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
        {warming && !busy && <p className="text-center text-[11px] text-amber-200/80">音楽スタジオ（GPU）を起動中…。準備できたら自動で伴奏を作り直すよ。</p>}
        {busy && (
          <div className="flex items-end gap-2">
            <Face face={partner.face} size={32} />
            <p className="animate-pulse rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-sm">{typing ? '……' : editing ? '♪ 手直し中…（歌い直し・伴奏の作り直しは1〜2分）' : '♪ 作曲中…'}</p>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
        <Mic value={text} onChange={setText} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && void send()}
          placeholder={editing ? '例：サビをバティの声にして／もう少し速く' : '今日あったことを話してみよう'}
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm outline-none"
        />
        <button onClick={() => void send()} disabled={!text.trim() || busy} className="rounded-full bg-violet-500 px-4 py-2.5 text-sm font-bold disabled:opacity-40">
          送る
        </button>
      </div>
    </div>
  );
}

/** The reason under an error line (status / code / provider message) so failures can be reported. */
function detail(e: unknown) {
  return e instanceof ApiError ? `\n（${e.status} ${e.code}${e.message ? `: ${e.message.slice(0, 120)}` : ''}）` : `\n（${String(e).slice(0, 120)}）`;
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
  live,
  onSung,
  editing,
  onEdit,
  onEditDone,
}: {
  live: boolean;
  onSung: (v: SongView) => void;
  editing: boolean;
  onEdit: () => void;
  onEditDone: () => void;
  song: MadeSong;
  playing: boolean;
  buried: boolean;
  onPlay: () => void;
  onBury: () => void | Promise<void>;
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
      {live && song.design && <FullSong song={song} onMade={onSung} />}
      {buried ? (
        <button onClick={onIsland} className="mt-3 w-full rounded-full border border-amber-200/50 bg-[#3a2410]/80 py-2 text-sm">
          ⛏ 保存して島の土に埋めました → 島を見る
        </button>
      ) : song.songUrl ? (
        <>
          {editing ? (
            <button onClick={onEditDone} className="mt-3 w-full rounded-full border border-fuchsia-300/50 bg-fuchsia-500/10 py-2 text-xs">
              ✏️ 手直し中 — チャットで直したいところを話してね（終わる）
            </button>
          ) : (
            <div className="mt-3 flex gap-2">
              <button onClick={onEdit} className="flex-1 rounded-full border border-fuchsia-300/60 bg-fuchsia-500/15 py-2 text-sm font-bold">
                ✏️ 手直しする
              </button>
              <button onClick={() => void onBury()} className="flex-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 py-2 text-sm font-bold">
                💾 保存する
              </button>
            </div>
          )}
          {editing && (
            <button onClick={() => void onBury()} className="mt-2 w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 py-2 text-sm font-bold">
              💾 この曲を保存する
            </button>
          )}
        </>
      ) : (
        <div className="mt-3 flex gap-2">
          <button onClick={onAgain} className="flex-1 rounded-full border border-white/20 py-2 text-xs">
            もう一回つくる
          </button>
          <button onClick={() => void onBury()} className="flex-[2] rounded-full bg-gradient-to-r from-amber-500 to-orange-500 py-2 text-sm font-bold">
            ⛏ 島の土に埋める（デモ）
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Step 2 of composing (client decision 2026-10-09): the whole song sung by the music studio on the
 * GPU (Cloud Run L4) — ACE-Step makes the song with the lyrics, HTDemucs splits vocals and
 * instrumental. A cold GPU needs a while to start: the card shows what it is doing and starts by itself.
 */
function FullSong({ song, onMade }: { song: MadeSong; onMade: (v: SongView) => void }) {
  const [state, setState] = useState<'idle' | 'working' | 'warming' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('');
  const makeRef = useRef<() => Promise<void>>(async () => {});
  // while warming, show what the GPU studio is doing and start by itself as soon as it is ready
  useEffect(() => {
    if (state !== 'warming') return;
    let live = true;
    const poll = async () => {
      try {
        const s = await getApi().composeMusicStatus();
        if (!live) return;
        if (s.ready) {
          setStatus('準備できた！作曲を始めるね。');
          void makeRef.current();
          return;
        } else if (s.error) setStatus(`スタジオの状態：${String(s.error).slice(0, 160)}`);
        else setStatus(`スタジオの状態：${String(s.phase ?? '起動中')}（${Number(s.seconds ?? 0)}秒・モデル ${Number(s.checkpointGB ?? 0)}GB）`);
      } catch {
        /* keep the last status */
      }
    };
    void poll();
    const t = setInterval(() => void poll(), 10000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [state]);
  if (song.songUrl) {
    return (
      <div className="mt-3 rounded-2xl bg-black/25 p-2">
        <p className="mb-1 text-center text-[11px] text-fuchsia-200/80">🎤 歌入りの曲</p>
        <audio key={song.songUrl} src={song.songUrl} controls playsInline className="w-full" />
      </div>
    );
  }
  const make = async () => {
    const d = song.design!;
    setState('working');
    setErr('');
    try {
      const r = await getApi().composeFullSong({
        title: d.title.slice(0, 40),
        genre: d.genre,
        mood: d.mood.slice(0, 30),
        bpm: d.bpm,
        keyRoot: d.keyRoot,
        scale: d.scale,
        sections: d.sections.map((s) => ({ name: s.name, lines: s.lines.map((l) => ({ text: l.text.slice(0, 40), beats: l.notes.reduce((a, n) => a + n.beats, 0) })) })),
        instrumentalPrompt: d.instrumentalPrompt,
        progression: d.progression,
        seconds: Math.max(10, Math.min(180, d.seconds)),
      });
      onMade(r);
      setState('idle');
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'MUSIC_WARMING' || e.status === 504)) {
        setStatus('');
        setState('warming');
      } else {
        setErr(detail(e));
        setState('error');
      }
    }
  };
  makeRef.current = make;
  return (
    <div className="mt-3 text-center">
      <button
        onClick={() => void make()}
        disabled={state === 'working' || state === 'warming'}
        className="w-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 py-2 text-sm font-bold disabled:opacity-60"
      >
        {state === 'working' ? '🎤 歌入りで作曲中…（2〜3分）' : '🎤 歌入りで作曲する'}
      </button>
      {state === 'warming' && (
        <p className="mt-1.5 text-[11px] text-amber-200/80">
          音楽スタジオ（GPU）を起動中…。準備ができたら自動で作曲を始めるので、このまま待っててね。
          {status && <span className="mt-0.5 block text-white/60">{status}</span>}
        </p>
      )}
      {state === 'error' && <p className="mt-1.5 whitespace-pre-wrap text-[11px] text-rose-300">うまく作れなかった。{err}</p>}
    </div>
  );
}

/**
 * Voice input next to a chat box (mic first, client decision 2026-10-07): tap to start, tap
 * again to stop; the words go where the cursor is in the box beside it (select words to replace
 * them). Hidden where the browser can't listen.
 */
export function Mic({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const mic = useDictation({ field, value, onChange });
  if (!mic.supported) return null;
  return (
    <button
      ref={btn}
      onClick={() => {
        field.current = btn.current?.parentElement?.querySelector('input, textarea') ?? null;
        mic.toggle();
      }}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow ${mic.listening ? 'bg-gradient-to-br from-rose-400 to-pink-500' : 'bg-gradient-to-br from-[#f39bd0] to-[#b58cff]'}`}
      aria-label={mic.listening ? '聞き取りを止める' : '話して入力'}
    >
      {mic.listening && <span className="absolute inset-0 animate-ping rounded-full bg-pink-400/40" />}
      {mic.listening ? (
        <span className="relative block h-3.5 w-3.5 rounded-sm bg-white" />
      ) : (
        <svg className="relative" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="currentColor" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      )}
    </button>
  );
}
