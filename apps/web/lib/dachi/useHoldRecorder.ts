'use client';

import { DACHI_VOICE_MAX_SECONDS } from '@obolo/shared';
import { useCallback, useEffect, useRef } from 'react';
import { useRecorder } from '@/lib/useRecorder';

/** a press shorter than this is a slip of the finger, not a message */
const MIN_SECONDS = 0.6;

/**
 * Hold-to-record (M-R212): it records ONLY while the button is held. Releasing stops it; the take is then there to
 * listen back to before it is sent (or thrown away). The recorder stops by itself at 60 s.
 */
export function useHoldRecorder(maxSec = DACHI_VOICE_MAX_SECONDS) {
  const rec = useRecorder(maxSec);
  const held = useRef(false);
  const { recording, stop, start, reset } = rec;

  // the microphone may take a moment to open: a finger already lifted stops it as soon as it has started
  useEffect(() => {
    if (recording && !held.current) stop();
  }, [recording, stop]);

  const press = useCallback(() => {
    held.current = true;
    reset();
    void start();
  }, [reset, start]);

  const release = useCallback(() => {
    held.current = false;
    stop();
  }, [stop]);

  const tooShort = !!rec.blob && rec.duration < MIN_SECONDS;
  return {
    recording,
    elapsed: rec.elapsed,
    /** the take to listen back to (null while recording or after a slip) */
    take: rec.blob && !tooShort ? { blob: rec.blob, seconds: Math.min(rec.duration, maxSec) } : null,
    tooShort,
    error: rec.error,
    maxSec,
    press,
    release,
    discard: reset,
  };
}
