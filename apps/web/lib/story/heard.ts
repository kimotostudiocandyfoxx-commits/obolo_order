/**
 * Lines already heard (client decision M-R102, 2026-10-26): a line heard once can be tapped through any
 * time after (reading back, resuming, seeing a scene again); a line heard for the first time moves on only
 * once its voice has finished. Kept on this device per line (the voice key of who + words).
 * "声を待たずに進む" (default off, at the bottom of the sound panel): for people who cannot hear the voices
 * or play without sound — a first line can then move on mid-voice too.
 */
import { voiceKey } from './voice';

const KEY = 'obolo.heard.v1';
const NO_WAIT = 'obolo.noWaitVoice';
const MAX = 6000;

let heard: Set<string> | null = null;
function load(): Set<string> {
  if (heard) return heard;
  try {
    heard = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    heard = new Set();
  }
  return heard;
}

export const lineId = (who: string, text: string) => voiceKey(who, undefined, text);

export function wasHeard(who: string, text: string): boolean {
  return load().has(lineId(who, text));
}

export function markHeard(who: string, text: string) {
  const s = load();
  const id = lineId(who, text);
  if (s.has(id)) return;
  s.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...s].slice(-MAX)));
  } catch {
    /* private mode: kept for this visit only */
  }
}

export function noWaitVoice(): boolean {
  try {
    return localStorage.getItem(NO_WAIT) === '1';
  } catch {
    return false;
  }
}

export function setNoWaitVoice(on: boolean) {
  try {
    localStorage.setItem(NO_WAIT, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
