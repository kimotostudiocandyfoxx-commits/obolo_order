'use client';

import { useEffect } from 'react';
import { armAudioUnlock } from '@/lib/onboarding/audio';

/** iPad feedback: the app's sound is let out by the first real tap anywhere (lib/onboarding/audio.ts armAudioUnlock) */
export function AudioUnlock() {
  useEffect(() => armAudioUnlock(), []);
  return null;
}
