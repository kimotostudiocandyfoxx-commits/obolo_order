'use client';

import { DACHI_VOICE_MAX_SECONDS } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MicPath } from '@/lib/mic/core';
import { useRecorder } from '@/lib/useRecorder';

/** a press shorter than this is a slip of the finger, not a message */
const MIN_SECONDS = 0.6;

/**
 * Hold-to-record (M-R212): it records ONLY while the button is held. Releasing stops it; the take is then there to
 * listen back to before it is sent (or thrown away). The recorder stops by itself at 60 s.
 */
export function useHoldRecorder(maxSec = DACHI_VOICE_MAX_SECONDS, path: MicPath = 'dachi-voice') {
  const rec = useRecorder(maxSec, path);
  // the press that only answered the phone's "allow the microphone?" (the finger was up before it opened): not a slip
  const [asked, setAsked] = useState(false);
  const pressAt = useRef(0);
  const held = useRef(false);
  const { recording, stop, start, reset } = rec;

  // the microphone may take a moment to open: a finger already lifted stops it as soon as it has started
  useEffect(() => {
    if (recording && !held.current) {
      // the mic took long to open (the question was on the screen): say to press again, not "too short"
      if (Date.now() - pressAt.current > 1200) setAsked(true);
      stop();
    }
  }, [recording, stop]);

  const press = useCallback(() => {
    held.current = true;
    pressAt.current = Date.now();
    setAsked(false);
    reset();
    void start();
  }, [reset, start]);

  const release = useCallback(() => {
    held.current = false;
    stop();
  }, [stop]);

  const tooShort = !asked && !!rec.blob && rec.duration < MIN_SECONDS;
  return {
    recording,
    elapsed: rec.elapsed,
    /** the take to listen back to (null while recording or after a slip) */
    take: rec.blob && !tooShort && !asked ? { blob: rec.blob, seconds: Math.min(rec.duration, maxSec) } : null,
    tooShort,
    error: rec.error,
    /** what is wrong with the mic, and the line to show (lib/mic/core) */
    fault: rec.fault,
    advice: rec.advice,
    /** the loudness while recording, 0..1 */
    level: rec.level,
    /** the last press only allowed the microphone: press again */
    asked: asked && !rec.recording && !rec.fault,
    maxSec,
    press,
    release,
    discard: reset,
  };
}
