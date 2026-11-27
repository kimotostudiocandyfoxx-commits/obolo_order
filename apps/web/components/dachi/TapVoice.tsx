'use client';

import { CUTE_VOICE_RATE, DACHI_TEXT_MAX, DACHI_VOICE_MAX_SECONDS, VOICE_SOUND_HEADING, VOICE_SOUND_LABEL, VOICE_SOUNDS, VOICE_VERSION_WORDS, type DachiVoiceDraft, type VoiceSound, type VoiceVersion } from '@obolo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MicNotice } from '@/components/mic/MicCheck';
import { useVoiceEdit, VoiceText } from '@/components/mic/VoiceText';
import { ApiError, getApi } from '@/lib/api';
import { useRecorder } from '@/lib/useRecorder';
import { useDictation } from '@/lib/useDictation';
import { bargeIn } from '@/lib/voice/barge';
import { canPreview, cleanCost, voiceToSend, type VoiceToSend } from '@/lib/dachi/voiceSend';
import { playClip, type Clip } from '@/lib/voice/webVoice';
import { MicGlyph, SendGlyph } from './HoldMic';

/**
 * The ダチ talk's mic (client 2026-11-27).
 *
 *  b. a tap starts the recording, a tap ends it — like the talk with {bati} (it used to record only while held).
 *  c. the voice message: the take goes to the server, which makes it ready (POST /dachi/voice), hears its words and picks
 *     a quiet sound for them. Before it is sent the member sees the words as the caption (fixed in place:
 *     components/mic/VoiceText.tsx — the voice itself is not edited: 〔とりなおす〕) and the sound under 「おと」 (the chips;
 *     the one in use is marked).
 *  d. 〔▶ きいてみる〕 plays the take as it would be sent, with the sound chosen now (POST /dachi/voice/preview, nothing
 *     kept) — for 「そのまま」 only. 「きれい」 is the paid voice, made at the send: nothing is made just to listen, one
 *     small line says it can be heard after the send. (For one evening of 2026-11-27 the sender did not hear their
 *     own voice at all; the client took that back before it was released.)
 *  e. one button chooses between two versions, remembered on the server (shared voiceVersion.ts):
 *       「そのまま」 — the recording made ready in the member's voice settings (the default: clean, the silences cut, a
 *                    light pitch correction, 1.8× and +2 semitones — shared voiceTune.ts; changed by talking to {bati});
 *       「きれい」   — the caption read by the member's own voice model (else the cute voice): the recording is heard as
 *                    words and not kept. Its price (the words' own, per character) shows small beside 〔送る〕.
 *     The take stays in this page's memory while the card is open, so the other version can be made of the same take.
 *
 * A server that cannot make it ready (an older API, ffmpeg failing) is not the end of voice messages: the take is then
 * sent as it is, with no caption and no sound. Past the day's cap the server's calm line is shown.
 * Not shown to a member whose voice may not be recorded (under 13 …): the talk gives them the dictating mic instead.
 */

/** a press shorter than this is a slip of the finger */
const MIN_SECONDS = 0.6;

/** PROVISIONAL wording (the story chat confirms) */
export const TAP_VOICE_WORDS = {
  idle: 'タップして、話してね',
  recording: (sec: number, max: number) => `録音中… ${sec}秒（もう一度タップで、おわり）${max - sec <= 10 ? `　あと${Math.max(0, max - sec)}秒` : ''}`,
  tooShort: 'もう少し長く、話してね',
  making: '声をととのえているよ…',
  caption: 'ことば',
  noWords: '（ことばは、聞きとれなかったよ。声だけ送れるよ）',
  voiceFixed: '声は、とりなおしで直せるよ',
  preview: 'きいてみる',
  stop: 'とめる',
  retake: 'とりなおす',
  send: '送る',
  type: '文字で直す',
  typeDone: 'できた',
  say: '言い直す',
  failed: 'うまくいかなかったみたい。もう一度、ためしてね',
  flagged: 'そのことばは、送れないみたい',
  plain: 'いまは、声だけ送れるよ（おとは、つけられなかった）',
} as const;

export type { VoiceToSend };
type Draft = DachiVoiceDraft & {
  /** made ready by the server (else the take as it is: no caption, no sound, no choice of version) */
  ready: boolean;
  /** which take of this page it is (the card keeps its caption while the version changes) */
  n: number;
};

export function TapVoice({ onSend, disabled, left, right }: { onSend: (v: VoiceToSend) => Promise<void>; disabled?: boolean; left?: ReactNode; right?: ReactNode }) {
  const rec = useRecorder(DACHI_VOICE_MAX_SECONDS, 'dachi-voice');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [making, setMaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tooShort, setTooShort] = useState(false);
  const [switching, setSwitching] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  /** the take itself, in memory only while its card is open: the other version is made of the same take */
  const take = useRef<{ blob: Blob; seconds: number } | null>(null);
  const takes = useRef(0);

  // the take, once the recorder hands it over → made ready on the server
  useEffect(() => {
    const blob = rec.blob;
    if (!blob) return;
    const seconds = Math.min(rec.duration, DACHI_VOICE_MAX_SECONDS);
    rec.reset();
    if (seconds < MIN_SECONDS) return setTooShort(true);
    setMaking(true);
    setErr(null);
    take.current = { blob, seconds };
    const n = ++takes.current;
    void (async () => {
      const api = getApi();
      try {
        const d = await api.dachiVoiceDraft(blob, seconds);
        if (alive.current) setDraft({ ...d, ready: true, n });
      } catch (e) {
        if (!alive.current) return;
        const code = e instanceof ApiError ? e.code : '';
        // nothing but silence was left in the take (the server cuts the parts with no voice): as a take too short
        if (code === 'VOICE_SILENT') return (take.current = null), setTooShort(true);
        // the day's cap, not allowed, too fast: said as it is (the server's own calm line for the cap)
        if (code === 'VOICE_MIX_CAP' || code === 'VOICE_NOT_ALLOWED' || code === 'RATE_LIMITED') return (take.current = null), setErr(code === 'VOICE_MIX_CAP' && e instanceof ApiError ? e.message : TAP_VOICE_WORDS.failed);
        // it could not be made ready: the take as it is (the voice message of before the trial)
        try {
          const up = await api.uploadVoice(blob);
          if (alive.current) setDraft({ version: 'asis', mediaId: up.id, seconds: Math.round(seconds * 10) / 10, text: '', sound: 'none', soft: false, clean: { on: false, own: false, rate: CUTE_VOICE_RATE }, ready: false, n });
        } catch {
          if (alive.current) setErr(TAP_VOICE_WORDS.failed);
        }
      } finally {
        if (alive.current) setMaking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.blob]);

  const toggle = () => {
    if (rec.recording) return rec.stop();
    setErr(null);
    setTooShort(false);
    // R14: the member takes the turn — a voice still speaking stops (its words show whole)
    bargeIn({ mic: true });
    void rec.start();
  };

  const drop = () => {
    const d = draft;
    setDraft(null);
    setErr(null);
    take.current = null;
    if (d?.ready && d.mediaId) void getApi().discardDachiVoice(d.mediaId).catch(() => undefined);
  };

  /**
   * the version button: remembered on the server, and the same take made ready the other way when it is not yet.
   * 「きれい」 needs nothing more (the words are heard already; the 「そのまま」 file goes at the send). 「そのまま」 after a
   * take heard as words only: the recording is made ready now, from the take still in memory.
   */
  const choose = async (version: VoiceVersion) => {
    const d = draft;
    if (!d || !d.ready || !d.clean.on || d.version === version || switching) return;
    const api = getApi();
    setErr(null);
    void api.setDachiVoiceVersion(version).catch(() => undefined);
    if (version === 'clean' || d.mediaId) return setDraft({ ...d, version });
    const t = take.current;
    if (!t) return setErr(VOICE_VERSION_WORDS.failed);
    setSwitching(true);
    try {
      const made = await api.dachiVoiceDraft(t.blob, t.seconds, 'asis');
      // the caption and the sound stay as the member has them on the card: only the voice is new
      if (alive.current) setDraft((now) => (now && now.n === d.n ? { ...now, version: made.version, mediaId: made.mediaId, seconds: made.seconds } : now));
    } catch (e) {
      if (alive.current) setErr(e instanceof ApiError && e.code === 'VOICE_MIX_CAP' ? e.message : VOICE_VERSION_WORDS.failed);
    } finally {
      if (alive.current) setSwitching(false);
    }
  };

  const send = async (v: VoiceToSend) => {
    setBusy(true);
    setErr(null);
    try {
      await onSend(v);
      setDraft(null);
      take.current = null;
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'CONTENT_FLAGGED' ? TAP_VOICE_WORDS.flagged : e instanceof ApiError && e.code === 'DACHI_DAILY_CAP' ? e.message : TAP_VOICE_WORDS.failed);
    } finally {
      setBusy(false);
    }
  };

  if (draft) return <DraftCard key={draft.n} draft={draft} busy={busy} switching={switching} err={err} onDrop={drop} onChoose={(v) => void choose(v)} onSend={(v) => void send(v)} />;

  const loud = rec.recording ? Math.min(1, rec.level * 1.5) : 0;
  const note = err ?? (rec.advice ? null : making ? TAP_VOICE_WORDS.making : rec.recording ? TAP_VOICE_WORDS.recording(rec.elapsed, DACHI_VOICE_MAX_SECONDS) : tooShort ? TAP_VOICE_WORDS.tooShort : TAP_VOICE_WORDS.idle);
  return (
    <div className="pb-safe px-3">
      <div className="mx-auto mb-[14px] max-w-md">
        {note === null ? (
          <MicNotice advice={rec.advice} className="mb-1.5 min-h-[18px] px-2 text-center text-xs leading-relaxed text-rose-200 [text-shadow:0_1px_4px_#000]" linkClass="ml-1 rounded-full border border-rose-200/60 px-2 py-0.5 text-[11px] font-bold text-rose-50" />
        ) : (
          <p className={`mb-1.5 min-h-[18px] px-2 text-center text-xs [text-shadow:0_1px_4px_#000] ${err ? 'text-rose-300' : 'text-[#b9bde6]'}`} data-testid="tapvoice-note" role="status">
            {note}
          </p>
        )}
        <div className="relative flex items-center justify-center pb-1 pt-1">
          <div className="absolute left-1 top-1/2 -translate-y-1/2">{left}</div>
          {right && <div className="absolute right-1 top-1/2 -translate-y-1/2">{right}</div>}
          {rec.recording && <span aria-hidden data-testid="mic-ring" className="pointer-events-none absolute left-1/2 top-1/2 h-[74px] w-[74px] rounded-full border-2 border-[#ffd0dc]/70 bg-[rgba(255,170,190,.14)]" style={{ transform: `translate(-50%,-50%) scale(${(1.15 + loud * 0.8).toFixed(3)})`, transition: 'transform 90ms linear' }} />}
          <button
            data-testid="tap-mic"
            type="button"
            disabled={disabled || making}
            aria-label={rec.recording ? '録音をおわる' : '録音をはじめる'}
            aria-pressed={rec.recording}
            onClick={toggle}
            className={`relative grid h-[74px] w-[74px] place-items-center rounded-full text-[#070b24] transition active:scale-95 disabled:opacity-35 ${rec.recording ? 'scale-105' : ''}`}
            style={{ background: 'radial-gradient(circle at 35% 30%,#ffffff,#cdd8ff 55%,#9fb2ff)', boxShadow: rec.recording ? '0 0 0 14px rgba(255,170,190,.14),0 0 48px rgba(255,150,180,.8)' : '0 0 0 6px rgba(223,230,255,.16),0 0 32px rgba(160,180,255,.55)' }}
          >
            {making ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#070b24]/25 border-t-[#070b24]" />
            ) : rec.recording ? (
              // a square: "this ends it"
              <span className="h-[22px] w-[22px] rounded-[5px] bg-[#c2334f]" />
            ) : (
              <MicGlyph className="h-[30px] w-[30px]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * the take made ready: its caption, its sound, the version button, a listen (「そのまま」 only), then 〔送る〕 or
 * 〔とりなおす〕
 */
function DraftCard({ draft, busy, switching, err, onDrop, onChoose, onSend }: { draft: Draft; busy: boolean; switching: boolean; err: string | null; onDrop: () => void; onChoose: (v: VoiceVersion) => void; onSend: (v: VoiceToSend) => void }) {
  const [caption, setCaption] = useState(draft.text);
  const [sound, setSound] = useState<VoiceSound>(draft.sound);
  // the weakest うれしい is the picker's own answer: a chip pressed by the member is the full sound
  const [soft, setSoft] = useState(draft.soft);
  const [typing, setTyping] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const edit = useVoiceEdit(caption, setCaption);
  // the caption can be said again at the caret (the words only: the voice stays the take)
  const mic = useDictation({ field, value: caption, onChange: setCaption, maxLength: DACHI_TEXT_MAX, path: 'dachi', caret: typing ? undefined : edit });

  const clean = draft.ready && draft.version === 'clean';
  // 〔▶ きいてみる〕: the 「そのまま」 draft with the sound chosen now (asked for once per sound, kept while the card is
  // open). Never for 「きれい」: that voice is made, and paid for, only at the send.
  const listenable = canPreview(draft);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const clip = useRef<Clip | null>(null);
  const urls = useRef(new Map<string, string>());
  const asked = useRef(0);
  const stop = () => {
    asked.current++;
    clip.current?.stop();
    clip.current = null;
    setPlaying(false);
    setLoading(false);
  };
  useEffect(
    () => () => {
      asked.current++;
      clip.current?.stop();
      for (const u of urls.current.values()) URL.revokeObjectURL(u);
    },
    [],
  );
  // the other version chosen, or its file made new: what was playing stops
  useEffect(() => stop(), [draft.version, draft.mediaId]);
  const listen = async () => {
    if (playing || loading) return stop();
    const mediaId = draft.mediaId;
    if (!listenable || !mediaId) return;
    const mine = ++asked.current;
    const mood: VoiceSound = draft.ready ? sound : 'none';
    const key = `${mediaId}:${mood}:${mood === 'ureshii' && soft ? 1 : 0}`;
    let url = urls.current.get(key);
    if (!url) {
      setLoading(true);
      const api = getApi();
      try {
        const mp3 = await api.dachiVoicePreview({ mediaId, sound: mood, soft: mood === 'ureshii' && soft }).catch((e: unknown) => {
          // the mix could not be made: the voice alone is still worth hearing
          if (mood === 'none') throw e;
          return api.dachiVoicePreview({ mediaId, sound: 'none' });
        });
        url = URL.createObjectURL(mp3);
        urls.current.set(key, url);
      } catch {
        if (mine === asked.current) setLoading(false);
        return;
      }
      if (mine !== asked.current) return;
      setLoading(false);
    }
    const c = await playClip(url);
    if (!c || mine !== asked.current) return c?.stop();
    clip.current = c;
    setPlaying(true);
    void c.done.then(() => mine === asked.current && setPlaying(false));
  };
  const pick = (s: VoiceSound) => {
    stop();
    setSound(s);
    setSoft(false);
  };
  const out = voiceToSend(draft, caption, sound, soft);
  const cost = clean ? cleanCost(caption, draft.clean.rate) : null;
  const other: VoiceVersion = draft.version === 'clean' ? 'asis' : 'clean';

  const chip = 'rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition active:scale-95';
  const small = 'grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[rgba(210,220,255,.3)] bg-[rgba(16,22,64,.5)] text-[#f4f1ff] disabled:opacity-40';
  return (
    <div className="pb-safe px-3" data-testid="voice-draft">
      <div className="mx-auto mb-3 max-w-md rounded-3xl border border-[rgba(210,220,255,.24)] bg-[rgba(12,16,52,.82)] p-3 shadow-[0_10px_30px_rgba(0,0,0,.45)] backdrop-blur-xl">
        {/* the caption: the words heard, fixed in place */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 rounded-2xl bg-white/[.07] px-3 py-2">
            <p className="mb-0.5 text-[10.5px] font-bold tracking-[0.18em] text-[#b9bde6]">{TAP_VOICE_WORDS.caption}</p>
            {typing ? (
              <input ref={field} autoFocus value={caption} maxLength={DACHI_TEXT_MAX} onChange={(e) => setCaption(e.target.value)} className="w-full bg-transparent text-[16px] font-bold text-[#f4f1ff] outline-none" aria-label={TAP_VOICE_WORDS.caption} />
            ) : caption || mic.interim ? (
              <VoiceText value={caption} edit={edit} interim={mic.interim} locked={mic.listening} className="text-[15px] font-bold leading-snug text-[#f4f1ff]" toolClass="mt-2" />
            ) : (
              <p className="text-[12.5px] leading-snug text-[#b9bde6]">{clean ? VOICE_VERSION_WORDS.noWords : draft.ready ? TAP_VOICE_WORDS.noWords : TAP_VOICE_WORDS.plain}</p>
            )}
            {!typing && <input ref={field} value={caption} readOnly className="sr-only" tabIndex={-1} aria-hidden />}
          </div>
          {draft.ready && (
            <div className="flex flex-col gap-1.5">
              {!typing && mic.supported && (
                <button type="button" onClick={mic.toggle} aria-label={mic.listening ? '話し終わる' : TAP_VOICE_WORDS.say} aria-pressed={mic.listening} data-testid="caption-mic" className={`${small} ${mic.listening ? 'animate-pulse !border-rose-300 !bg-rose-400/30' : ''}`}>
                  <MicGlyph className="h-[18px] w-[18px]" />
                </button>
              )}
              <button type="button" onClick={() => (mic.listening && mic.stop(), setTyping((t) => !t))} aria-label={typing ? TAP_VOICE_WORDS.typeDone : TAP_VOICE_WORDS.type} className={`${small} text-[14px]`}>
                {typing ? '✓' : '⌨'}
              </button>
            </div>
          )}
        </div>
        <MicNotice advice={mic.listening ? null : mic.advice} className="mt-1 px-1 text-[11px] leading-relaxed text-amber-100/90" linkClass="ml-1 rounded-full border border-amber-100/50 px-2 py-0.5 text-[11px] font-bold text-amber-50" />
        {draft.ready && !clean && <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-[#b9bde6]/90">{TAP_VOICE_WORDS.voiceFixed}</p>}

        {/* the one button: 「そのまま」 (the recording) or 「きれい」 (the words read) — remembered for the next takes */}
        {draft.ready && draft.clean.on && (
          <div className="mt-2.5 flex items-center gap-2 px-1">
            <button
              type="button"
              role="switch"
              aria-checked={clean}
              aria-label={`${VOICE_VERSION_WORDS.heading}：${VOICE_VERSION_WORDS.label[draft.version]}`}
              disabled={busy || switching}
              onClick={() => onChoose(other)}
              data-testid="voice-version"
              data-version={draft.version}
              className="flex h-8 shrink-0 items-center rounded-full border border-[rgba(210,220,255,.3)] bg-[rgba(16,22,64,.5)] p-0.5 text-[12px] font-bold transition active:scale-95 disabled:opacity-50"
            >
              {(['asis', 'clean'] as const).map((v) => (
                <span key={v} className={`rounded-full px-2.5 py-1 ${v === draft.version ? 'bg-[#dfe6ff] text-[#070b24]' : 'text-[#dfe6ff]/80'}`}>
                  {VOICE_VERSION_WORDS.label[v]}
                </span>
              ))}
            </button>
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-[#b9bde6]/90" role="status" data-testid="voice-version-note">
              {switching ? VOICE_VERSION_WORDS.switching : clean ? (draft.clean.own ? VOICE_VERSION_WORDS.note.cleanOwn : VOICE_VERSION_WORDS.note.cleanCute) : `${VOICE_VERSION_WORDS.note.asis}（${Math.max(1, Math.round(draft.seconds))}秒）`}
            </p>
          </div>
        )}

        {/* 「おと」: the sound picked from the words — changed with a chip, the one in use marked */}
        {draft.ready && (
          <div className="mt-2.5" role="group" aria-label={VOICE_SOUND_HEADING}>
            <p className="mb-1.5 px-1 text-[11px] font-bold tracking-[0.2em] text-[#dfe6ff]">{VOICE_SOUND_HEADING}</p>
            <div className="flex flex-wrap gap-1.5">
              {VOICE_SOUNDS.map((s) => {
                const on = s === sound;
                return (
                  <button key={s} type="button" onClick={() => pick(s)} aria-pressed={on} data-testid={`sound-${s}`} className={`${chip} ${on ? 'border-[#dfe6ff] bg-[#dfe6ff] text-[#070b24]' : 'border-[rgba(210,220,255,.3)] bg-transparent text-[#dfe6ff]'}`}>
                    {on && <span aria-hidden>✓ </span>}
                    {VOICE_SOUND_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {err && <p className="mt-2 text-center text-xs text-rose-300">{err}</p>}
        <div className="mt-3 flex items-center gap-2">
          {listenable ? (
            <button type="button" onClick={() => void listen()} disabled={switching} data-testid="voice-preview" className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[rgba(210,220,255,.35)] px-3 text-[13px] font-bold text-[#f4f1ff] disabled:opacity-40">
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <span aria-hidden>{playing ? '❚❚' : '▶'}</span>}
              {playing || loading ? TAP_VOICE_WORDS.stop : TAP_VOICE_WORDS.preview}
              <span className="font-normal text-[#b9bde6]">{Math.max(1, Math.round(draft.seconds))}秒</span>
            </button>
          ) : (
            // 「きれい」: nothing is made just to listen — it is heard in the talk after the send
            <p className="min-w-0 flex-1 text-center text-[11px] leading-snug text-[#b9bde6]/90" data-testid="voice-preview-later">
              {clean ? VOICE_VERSION_WORDS.cleanLater : ''}
            </p>
          )}
          <button type="button" onClick={() => (stop(), onDrop())} disabled={busy} className="h-10 shrink-0 rounded-full border border-white/15 px-3 text-[13px] text-white/75 disabled:opacity-40">
            {TAP_VOICE_WORDS.retake}
          </button>
          {/* 「きれい」: the price of these words, small, before the send (the app's 「−0.3」) */}
          {cost && (
            <span className="shrink-0 text-right text-[10px] tracking-[0.08em] text-amber-200/70" aria-label={cost.label} data-testid="voice-cost">
              {cost.text}
            </span>
          )}
          <button
            type="button"
            onClick={() => out && (stop(), onSend(out))}
            disabled={busy || switching || mic.listening || !out}
            data-testid="voice-send"
            className="flex h-10 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-bold text-[#2b1b06] transition active:scale-95 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #fbe9b7, #d79d45)' }}
          >
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2b1b06]/30 border-t-[#2b1b06]" /> : <SendGlyph />}
            {TAP_VOICE_WORDS.send}
          </button>
        </div>
      </div>
    </div>
  );
}
