'use client';

import { VOICE_MAX_SECONDS } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderError = 'denied' | 'unsupported' | null;

/** Pick a container the current browser can record AND the API accepts (Safari → mp4, Chrome/Firefox → webm). */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((c) => MediaRecorder.isTypeSupported?.(c));
}

export function useRecorder(maxSec = VOICE_MAX_SECONDS) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<RecorderError>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('unsupported');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError('denied');
      return;
    }
    streamRef.current = stream;
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      const type = (rec.mimeType || mime || 'audio/webm').split(';')[0];
      setBlob(new Blob(chunks, { type }));
      setDuration(Math.round(((Date.now() - startedRef.current) / 1000) * 10) / 10);
      setRecording(false);
      cleanup();
    };
    recRef.current = rec;
    setBlob(null);
    startedRef.current = Date.now();
    setElapsed(0);
    rec.start(250);
    setRecording(true);
    timerRef.current = setInterval(() => {
      const s = (Date.now() - startedRef.current) / 1000;
      setElapsed(Math.floor(s));
      if (s >= maxSec) rec.stop();
    }, 200);
  }, [cleanup, maxSec]);

  const reset = useCallback(() => {
    setBlob(null);
    setDuration(0);
    setElapsed(0);
  }, []);

  return { recording, elapsed, blob, duration, error, start, stop, reset };
}
