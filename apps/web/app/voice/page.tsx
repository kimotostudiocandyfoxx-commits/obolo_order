'use client';

import { VOICE_SAMPLE_SECONDS, VOICE_SCRIPTS, type VoiceSlot } from '@obolo/shared';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * /voice — register the member's two voices (client decision 2026-10-07):
 *  自分の声 (Saturn read-aloud, singing) and バティの声 (a changed voice the member gives Bati).
 * Read the script aloud (8–30 s); the recording becomes a private Fish Audio voice model.
 * PLACEHOLDER (P-VOICE-4): a standalone page until the client designs where this lives.
 */
export default function VoicePage() {
  const { me, status } = useAuth();
  return (
    <main className="min-h-svh bg-[#07060d] px-4 pb-16 pt-[calc(20px+env(safe-area-inset-top))] text-white">
      <h1 className="text-center text-lg tracking-[0.3em] text-amber-100">声の登録</h1>
      <p className="mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-white/55">
        2つの声を登録します。<b>自分の声</b>は土星の読み上げや水星の歌に、<b>バティの声</b>はバティがしゃべるときに使います（声色を変えて録ってね）。
      </p>
      {status === 'loading' ? null : !me ? (
        <p className="mt-8 text-center text-sm">
          ログインが必要です。<Link href="/" className="underline">トップでログイン</Link>してから開いてください。
        </p>
      ) : (
        <div className="mx-auto mt-6 grid max-w-md gap-5">
          <VoiceCard slot="self" title="🎤 自分の声" done={!!me.voices?.self} />
          <VoiceCard slot="bati" title={`🥚 ${me.bati?.name ?? 'バティ'}の声（変声）`} done={!!me.voices?.bati} />
        </div>
      )}
    </main>
  );
}

function VoiceCard({ slot, title, done }: { slot: VoiceSlot; title: string; done: boolean }) {
  const { setMe } = useAuth();
  const [phase, setPhase] = useState<'idle' | 'recording' | 'recorded' | 'sending'>('idle');
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [msg, setMsg] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [text, setText] = useState(slot === 'self' ? 'これは、わたしの声で読み上げたテストです。' : 'やっほー！バティだよ。今日もいっしょに遊ぼうね！');
  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  const start = async () => {
    setMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setBlob(new Blob(chunks, { type: r.mimeType || 'audio/mp4' }));
        setPhase('recorded');
      };
      rec.current = r;
      r.start();
      setSecs(0);
      setPhase('recording');
      timer.current = setInterval(
        () =>
          setSecs((s) => {
            if (s + 1 >= VOICE_SAMPLE_SECONDS.max) stop();
            return s + 1;
          }),
        1000,
      );
    } catch {
      setMsg('マイクが使えませんでした。ブラウザの設定でマイクを許可してください。');
    }
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    if (rec.current?.state === 'recording') rec.current.stop();
  };

  const send = async () => {
    if (!blob) return;
    if (secs < VOICE_SAMPLE_SECONDS.min) {
      setMsg(`${VOICE_SAMPLE_SECONDS.min}秒以上録ってね。`);
      return;
    }
    setPhase('sending');
    setMsg('');
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '');
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      setMe(await getApi().registerVoice({ slot, audio: { mime: blob.type.split(';')[0] || 'audio/mp4', data } }));
      setMsg('登録できました！下で試しに読み上げてみてね。');
      setPhase('idle');
      setBlob(null);
    } catch (e) {
      setMsg(e instanceof ApiError ? `登録できませんでした（${e.code}: ${e.message}）` : '登録できませんでした。');
      setPhase('recorded');
    }
  };

  const speak = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await getApi().speak({ slot, text });
      setAudioUrl(r.url);
    } catch (e) {
      setMsg(e instanceof ApiError ? `読み上げできませんでした（${e.code}: ${e.message}）` : '読み上げできませんでした。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/15 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${done ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/50'}`}>{done ? '登録済み' : '未登録'}</span>
      </div>
      <p className="mt-3 text-[11px] text-white/50">この文を、声に出して読んでね（{VOICE_SAMPLE_SECONDS.min}〜{VOICE_SAMPLE_SECONDS.max}秒）{slot === 'bati' ? '。バティにあげたい声色で！' : ''}</p>
      <p className="mt-1 rounded-2xl bg-black/30 p-3 text-sm leading-relaxed">{VOICE_SCRIPTS[slot]}</p>
      <div className="mt-3 flex items-center gap-2">
        {phase === 'recording' ? (
          <button onClick={stop} className="flex-1 animate-pulse rounded-full bg-rose-500 py-2.5 text-sm font-bold">
            ■ 止める（{secs}秒）
          </button>
        ) : (
          <button onClick={() => void start()} disabled={phase === 'sending'} className="flex-1 rounded-full border border-white/25 py-2.5 text-sm disabled:opacity-40">
            ● {blob ? '録り直す' : done ? '録り直す' : '録音する'}
          </button>
        )}
        {blob && phase !== 'recording' && (
          <button onClick={() => void send()} disabled={phase === 'sending'} className="flex-1 rounded-full bg-amber-400 py-2.5 text-sm font-bold text-black disabled:opacity-50">
            {phase === 'sending' ? '登録中…' : `この声で登録（${secs}秒）`}
          </button>
        )}
      </div>
      {blob && phase === 'recorded' && <audio src={URL.createObjectURL(blob)} controls className="mt-2 w-full" />}
      {done && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[11px] text-white/50">試しに読み上げ</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={2} className="mt-1 w-full rounded-2xl border border-white/15 bg-black/30 p-2 text-sm outline-none" />
          <button onClick={() => void speak()} disabled={busy || !text.trim()} className="mt-1 w-full rounded-full bg-violet-500 py-2 text-sm font-bold disabled:opacity-40">
            {busy ? '読み上げ中…' : '🔊 この声で読み上げる'}
          </button>
          {audioUrl && <audio src={audioUrl} controls autoPlay className="mt-2 w-full" />}
        </div>
      )}
      {msg && <p className="mt-2 whitespace-pre-wrap text-xs text-amber-200/90">{msg}</p>}
    </section>
  );
}
