'use client';

import { useEffect } from 'react';
import type { StoryNames } from '@obolo/shared';
import { getApi } from '@/lib/api';
import type { Step } from '@/lib/onboarding/script';
import { hasNames, type LineVoice } from './lineVoice';
import { voiceKey } from './voice';

/**
 * The day's lines with the member's names in them, in their own voices (client decision 2026-10-16):
 * asked for as soon as the names are known and again every few seconds while some are still being made.
 * A line whose voice is not back yet is played silent (e.g. the very next line after giving your name).
 */
export function useNameVoices(voice: LineVoice | null, steps: Step[], names: StoryNames) {
  const keys = [...new Set(steps.flatMap((s) => (s.t === 'say' && hasNames(s.text) ? [voiceKey(s.who, undefined, s.text)] : [])))];
  const clean: StoryNames = Object.fromEntries(Object.entries(names).flatMap(([k, val]) => (typeof val === 'string' && val.trim() ? [[k, val.trim().slice(0, 24)]] : [])));
  const dep = JSON.stringify([keys, clean]);
  useEffect(() => {
    // the voices of the names before this (e.g. the account's name before the one just typed) never play
    voice?.setPersonal({});
    if (!voice || !keys.length || !Object.keys(clean).length) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const ask = async () => {
      try {
        const r = await getApi().lineVoices({ names: clean, keys: keys.slice(0, 120) });
        if (stop) return;
        voice.setPersonal(r.voices);
        // a few minutes of asking at most (a day's lines are made in about that time)
        if (r.pending > 0 && ++tries < 50) timer = setTimeout(() => void ask(), 6000);
      } catch {
        // not signed in yet (Day 1 before the name), or offline: the lines stay silent
      }
    };
    void ask();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, dep]);
}
