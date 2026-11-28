'use client';

import { VOICE_MAX_SECONDS } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SILENT_PEAK, blobType, faultOfError, micAdvice, pickMime, type MicAdvice, type MicFault, type MicPath } from '@/lib/mic/core';
import { canRecord, currentEnv, reportMic } from '@/lib/mic/env';
import { micMeter, type MicMeter } from '@/lib/mic/meter';
import { openMic, quietMic } from './micStream';

export type RecorderError = 'denied' | 'unsupported' | null;

/**
 * Records a voice (the ダチ voice messages, the egg, Saturn's voice test …): the page's one mic stream, a container
 * the phone can record and the API takes (iPhone → audio/mp4, Chrome / Firefox → webm; lib/mic/core pickMime).
 *
 * Client 2026-11-27 (phones: 「マイクが反応しないことが多い」): every failure used to be 'denied' (「設定 → Safari → マイク」,
 * also in Chrome and on Android). Now `fault` names it (not allowed / no mic / busy / unsupported / silent) and
 * `advice` is the line to show; `level` is the loudness while recording (so the button can show that it hears), and a
 * take with no sound in it at all is not handed on as a recording (`fault: 'silent'`).
 */
export function useRecorder(maxSec = VOICE_MAX_SECONDS, path: MicPath = 'other', opts: { /** hand a take with no sound in it on anyway (the story's egg: the scene goes on by time) */ keepSilent?: boolean } = {}) {
  const keepSilent = !!opts.keepSilent;
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [fault, setFault] = useState<MicFault | null>(null);
  const [level, setLevel] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterRef = useRef<MicMeter | null>(null);
  const startedRef = useRef(0);
  // a press that is still opening the mic (the phone is asking): a second press must not open a second one
  const opening = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    meterRef.current?.close();
    meterRef.current = null;
    // the page's one stream is kept a short while (quiet), so the next press does not ask again
    if (streamRef.current) quietMic();
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      const r = recRef.current;
      if (r && r.state !== 'inactive') {
        r.onstop = null;
        try {
          r.stop();
        } catch {
          /* over */
        }
      }
      cleanup();
    },
    [cleanup],
  );

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  }, []);

  const fail = useCallback(
    (f: MicFault, name?: string, mime?: string) => {
      setFault(f);
      reportMic({ path, fault: f, engine: 'stream', name, mime });
    },
    [path],
  );

  const start = useCallback(async () => {
    if (opening.current || (recRef.current && recRef.current.state !== 'inactive')) return;
    setFault(null);
    if (!canRecord()) return fail('unsupported', typeof MediaRecorder === 'undefined' ? 'no-recorder' : 'no-getusermedia');
    let stream: MediaStream;
    opening.current = true;
    try {
      // asked for at once, inside the press
      stream = await openMic();
    } catch (e) {
      opening.current = false;
      return fail(faultOfError(e), (e as Error)?.name);
    }
    opening.current = false;
    streamRef.current = stream;
    const mime = pickMime(typeof MediaRecorder.isTypeSupported === 'function' ? (t) => MediaRecorder.isTypeSupported(t) : undefined);
    let rec: MediaRecorder;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      cleanup();
      return fail(faultOfError(e), (e as Error)?.name, mime);
    }
    const chunks: Blob[] = [];
    let peak = 0;
    let metered = 0;
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onerror = () => rec.state !== 'inactive' && rec.stop();
    rec.onstop = () => {
      const type = blobType(rec.mimeType, mime, currentEnv());
      const out = new Blob(chunks, { type });
      const secs = Math.round(((Date.now() - startedRef.current) / 1000) * 10) / 10;
      setRecording(false);
      setLevel(0);
      cleanup();
      // no sound at all in a real take (a muted mic, another app has it): not a recording to send
      if (!keepSilent && secs >= 0.6 && (out.size === 0 || (metered > 5 && peak < SILENT_PEAK))) return fail('silent', out.size === 0 ? 'empty-blob' : 'zero-level', type);
      setBlob(out);
      setDuration(secs);
    };
    // the phone took the mic away in the middle (a call, the lock screen): the take ends with what it has
    for (const t of stream.getAudioTracks()) t.addEventListener('ended', () => rec.state !== 'inactive' && rec.stop(), { once: true });
    recRef.current = rec;
    setBlob(null);
    startedRef.current = Date.now();
    setElapsed(0);
    try {
      rec.start(250);
    } catch (e) {
      cleanup();
      return fail(faultOfError(e), (e as Error)?.name, mime);
    }
    setRecording(true);
    meterRef.current = micMeter(stream, { own: currentEnv().os === 'ios' });
    timerRef.current = setInterval(() => {
      const s = (Date.now() - startedRef.current) / 1000;
      setElapsed(Math.floor(s));
      const m = meterRef.current;
      if (m?.live()) {
        const lv = m.level();
        metered++;
        peak = Math.max(peak, lv);
        setLevel(lv);
      }
      if (s >= maxSec && rec.state !== 'inactive') rec.stop();
    }, 100);
  }, [cleanup, fail, keepSilent, maxSec]);

  const reset = useCallback(() => {
    setBlob(null);
    setDuration(0);
    setElapsed(0);
    setFault(null);
  }, []);

  /** the older two-way error (callers that only tell "not allowed" from the rest) */
  const error: RecorderError = fault === 'denied' ? 'denied' : fault && fault !== 'silent' ? 'unsupported' : null;
  const advice: MicAdvice | null = fault ? micAdvice(fault, currentEnv()) : null;

  return { recording, elapsed, blob, duration, error, fault, advice, level, start, stop, reset };
}
