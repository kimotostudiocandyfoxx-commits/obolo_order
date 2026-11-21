'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pitchBuffer } from '@/lib/voice/pitch';

const SCRIPT = 'ボクはバティ！ ネオ、今日はどんな曲を作る？ 月で、待ってるね。';
const LINES = ['ボクはバティ！ 今日はどんな曲を作る？', 'ネオ、それ最高じゃん！', '月で、待ってるね。'];
const KEYS = [
  { key: 0, label: 'そのまま' },
  { key: 1, label: '+1' },
  { key: 2, label: '+2 バティ' },
  { key: 3, label: '+3' },
  { key: 4, label: '+4' },
];
const MAX_SEC = 30;

/** a format this browser records AND the API accepts (iPad Safari → mp4, Chrome → webm) */
function pickMime() {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((c) => MediaRecorder.isTypeSupported?.(c));
}

/**
 * /kakunin-5798f28713/bati-voice — 〔バティの声ためし〕: record your voice, hear it raised by 0–4 semitones (same speed),
 * and — only if you choose to — make a Bati voice from it at that height (Fish Audio) and hear Bati's lines in it.
 * The recording stays on this device until 〔この高さでバティの声を作る〕 is pressed and confirmed.
 */
export default function BatiVoicePage() {
  const { me } = useAuth();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [decoded, setDecoded] = useState<AudioBuffer | null>(null);
  const [playingKey, setPlayingKey] = useState<number | null>(null);
  const [chosen, setChosen] = useState(2);
  const [error, setError] = useState('');
  const [fish, setFish] = useState<boolean | null>(null);
  const [making, setMaking] = useState<'idle' | 'confirm' | 'sending' | 'made'>('idle');
  const [lines, setLines] = useState<{ text: string; url: string | null; failed?: boolean }[]>([]);
  const ctx = useRef<AudioContext | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const src = useRef<AudioBufferSourceNode | null>(null);
  const raf = useRef(0);
  const started = useRef(0);
  const cache = useRef(new Map<number, { buffer: AudioBuffer; rate: number }>());

  useEffect(() => {
    getApi()
      .voiceStatus()
      .then((s) => setFish(s.fish))
      .catch(() => setFish(false));
    return () => {
      cancelAnimationFrame(raf.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      src.current?.stop();
      void ctx.current?.close();
    };
  }, []);

  const audio = () => {
    if (!ctx.current) {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'play-and-record';
      ctx.current = new AudioContext();
    }
    void ctx.current.resume();
    return ctx.current;
  };

  const stopPlay = () => {
    try {
      src.current?.stop();
    } catch {
      /* already stopped */
    }
    src.current = null;
    setPlayingKey(null);
  };

  const startRec = async () => {
    setError('');
    stopPlay();
    const mime = pickMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setError('このブラウザでは録音できない');
      return;
    }
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError('マイクが使えない…。設定でマイクを許してね');
      return;
    }
    stream.current = s;
    const c = audio();
    const an = c.createAnalyser();
    an.fftSize = 1024;
    c.createMediaStreamSource(s).connect(an);
    const buf = new Float32Array(an.fftSize);
    const chunks: Blob[] = [];
    const r = new MediaRecorder(s, { mimeType: mime });
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      cancelAnimationFrame(raf.current);
      s.getTracks().forEach((t) => t.stop());
      setRecording(false);
      setLevel(0);
      const b = new Blob(chunks, { type: (r.mimeType || mime).split(';')[0] });
      setBlob(b);
      cache.current.clear();
      try {
        setDecoded(await c.decodeAudioData(await b.arrayBuffer()));
      } catch {
        setError('録音を読みこめなかった。もう一度録ってね');
      }
    };
    rec.current = r;
    r.start(250);
    started.current = performance.now();
    setRecording(true);
    setBlob(null);
    setDecoded(null);
    setMaking('idle');
    setLines([]);
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 8));
      const sec = (performance.now() - started.current) / 1000;
      setElapsed(sec);
      if (sec >= MAX_SEC) r.stop();
      else raf.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const play = (key: number) => {
    if (!decoded) return;
    if (playingKey === key) return stopPlay();
    stopPlay();
    const c = audio();
    let v = cache.current.get(key);
    if (!v) {
      v = pitchBuffer(c, decoded, key);
      cache.current.set(key, v);
    }
    const node = c.createBufferSource();
    node.buffer = v.buffer;
    node.playbackRate.value = v.rate;
    node.connect(c.destination);
    node.onended = () => {
      if (src.current === node) {
        src.current = null;
        setPlayingKey(null);
      }
    };
    node.start();
    src.current = node;
    setPlayingKey(key);
    setChosen(key);
  };

  const make = async () => {
    if (!blob) return;
    setMaking('sending');
    setError('');
    try {
      const data = await new Promise<string>((ok, no) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result).split(',')[1] ?? '');
        fr.onerror = () => no(fr.error);
        fr.readAsDataURL(blob);
      });
      await getApi().registerVoice({ slot: 'bati', pitch: chosen, text: SCRIPT, audio: { mime: blob.type || 'audio/mp4', data } });
      setMaking('made');
      setLines(LINES.map((text) => ({ text, url: null })));
      for (const text of LINES) {
        try {
          const { url } = await getApi().speak({ slot: 'bati', text });
          setLines((cur) => cur.map((l) => (l.text === text ? { ...l, url } : l)));
        } catch {
          setLines((cur) => cur.map((l) => (l.text === text ? { ...l, failed: true } : l)));
        }
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(code === 'VOICE_OFF' ? '声のサービスが、まだつながっていない' : code === 'RATE_LIMITED' ? '今日は、もう作れない（1日10回まで）' : '声を作れなかった…');
      setMaking('idle');
    }
  };

  const canMake = !!blob && fish === true && !!me && elapsed >= 3;

  return (
    <main className="pt-safe pb-safe mx-auto min-h-svh max-w-md px-4 py-4">
      <div className="flex items-center gap-2">
        <Link href="/kakunin-5798f28713" className="btn btn-ghost h-9 w-9 !p-0 text-lg" aria-label="もどる">
          ←
        </Link>
        <h1 className="text-lg font-black">バティの声ためし</h1>
      </div>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-white/50">この文を読んでね</p>
        <p className="mt-1 text-base font-bold leading-relaxed">{SCRIPT}</p>
      </section>

      <section className="mt-4 flex flex-col items-center">
        <button
          onClick={() => (recording ? rec.current?.stop() : void startRec())}
          className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl shadow-lg ${recording ? 'bg-red-500' : 'bg-white/15'}`}
          aria-label={recording ? '録音を止める' : '録音する'}
        >
          {recording ? '■' : '🎙'}
        </button>
        <p className="mt-2 text-sm font-bold">{recording ? '録音中…（もう一度押すと止まる）' : blob ? '録り直すときは、もう一度押す' : '〔🎙 録音する〕'}</p>
        <div className="mt-3 flex w-full items-center gap-3">
          <span className="w-16 text-right font-mono text-sm text-white/70">
            {Math.floor(elapsed)}秒/{MAX_SEC}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
        </div>
      </section>

      {decoded && (
        <section className="mt-6">
          <p className="text-xs text-white/50">高さだけを変えて聴く（速さはそのまま）</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <button
                key={k.key}
                onClick={() => play(k.key)}
                className={`rounded-2xl px-2 py-3 text-sm font-bold ${playingKey === k.key ? 'bg-amber-300 text-slate-950' : chosen === k.key ? 'border border-amber-300 bg-white/10' : 'bg-white/10'} ${k.key === 2 ? 'col-span-1' : ''}`}
              >
                {playingKey === k.key ? '■ ' : '▶ '}
                {k.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/45">録音は、この端末の中だけ。どこにも送っていない</p>
        </section>
      )}

      {decoded && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-bold">この高さでバティの声を作る（{KEYS.find((k) => k.key === chosen)?.label}）</p>
          {fish === false && <p className="mt-1 text-xs text-white/55">声のサービス（Fish Audio）が、ここではまだつながっていないので押せない</p>}
          {!me && <p className="mt-1 text-xs text-white/55">ログインしてから使える</p>}
          {making === 'confirm' ? (
            <div className="mt-3 rounded-xl border border-amber-200/30 bg-amber-200/5 p-3 text-xs leading-relaxed text-amber-50">
              録音した声を、声のモデルを作るサービス（Fish Audio）に送ります。今のバティの声は、この声に入れかわります。
              <div className="mt-3 flex gap-2">
                <button onClick={() => setMaking('idle')} className="flex-1 rounded-full bg-white/10 py-2 text-sm">
                  やめる
                </button>
                <button onClick={() => void make()} className="flex-1 rounded-full bg-amber-300 py-2 text-sm font-black text-slate-950">
                  送って作る
                </button>
              </div>
            </div>
          ) : (
            <button
              disabled={!canMake || making === 'sending'}
              onClick={() => setMaking('confirm')}
              className="mt-3 w-full rounded-full bg-amber-300 py-2.5 text-sm font-black text-slate-950 disabled:bg-white/10 disabled:text-white/40"
            >
              {making === 'sending' ? '声を作っています…（少しかかる）' : 'この高さでバティの声を作る'}
            </button>
          )}
          {lines.length > 0 && (
            <div className="mt-4 space-y-2">
              {lines.map((l) => (
                <div key={l.text} className="rounded-xl bg-black/30 p-2">
                  <p className="text-sm">{l.text}</p>
                  {l.url ? <audio src={l.url} controls className="mt-1 w-full" /> : <p className="mt-1 text-xs text-white/50">{l.failed ? '読めなかった' : '読んでいます…'}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {error && <p className="mt-4 text-center text-sm text-red-300">{error}</p>}
    </main>
  );
}
