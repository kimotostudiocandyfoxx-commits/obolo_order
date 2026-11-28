'use client';

import { getApi } from '@/lib/api';
import { faultOfError, micAdvice, micEnv, pickEngine, reportGate, type HearEngine, type MicEnv, type MicPath, type MicReport } from './core';

/** the browser's speech recogniser, as far as this app uses it */
export type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
};

export function recognizerClass(): (new () => Recognizer) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** this phone and browser (the family only) */
export function currentEnv(): MicEnv {
  if (typeof navigator === 'undefined') return { os: 'other', browser: 'other', inApp: false, standalone: false };
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = !!nav.standalone || (typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches);
  return micEnv(navigator.userAgent, { standalone, maxTouchPoints: navigator.maxTouchPoints, platform: navigator.platform });
}

export const canRecord = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

/**
 * The recogniser failed on this phone: the recorder from now on. R21 playtest (client 2026-11-28, iPhone Safari):
 * Safari's recogniser answered `service-not-allowed` (Siri and dictation off on that phone) on the first take of every
 * visit, so that take was spent on it and the recorder only began after the member had already started to speak. It is
 * remembered on the device for SPEECH_FAILED_DAYS now (it was the visit only), so a later visit starts on the recorder.
 */
const FAILED_KEY = 'obolo.mic.speechFailed';
export const SPEECH_FAILED_DAYS = 7;
let failedMem = false;
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const local = (): Store | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
const session = (): Store | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};
/** whether a stored mark (a time in ms, or the old '1' of a visit) still counts */
export function failedMarkValid(v: string | null, now: number): boolean {
  if (!v) return false;
  if (v === '1') return true;
  const at = Number(v);
  return Number.isFinite(at) && now - at < SPEECH_FAILED_DAYS * 86400_000 && at <= now + 60_000;
}
export function speechFailed(now = Date.now()): boolean {
  if (failedMem) return true;
  for (const s of [session(), local()]) {
    try {
      if (s && failedMarkValid(s.getItem(FAILED_KEY), now)) return true;
    } catch {
      /* blocked storage */
    }
  }
  return false;
}
export function markSpeechFailed(now = Date.now()) {
  failedMem = true;
  for (const s of [session(), local()]) {
    try {
      s?.setItem(FAILED_KEY, String(now));
    } catch {
      /* private mode: remembered for the page only */
    }
  }
}

/** the engine the next take will use (null: this browser has no mic way at all) */
export function currentEngine(): HearEngine | null {
  return pickEngine(currentEnv(), { recognizer: !!recognizerClass(), recorder: canRecord() }, speechFailed());
}

const gate = reportGate();
/**
 * A mic failure for the operator (docs/mic.md): the fault, the place, the browser family — no words, no ids, never the
 * recording. Limited on the page (reportGate) and again on the server; a failed report is dropped.
 */
export function reportMic(r: { path: MicPath; fault: string; engine: MicReport['engine']; name?: string; mime?: string }) {
  if (typeof window === 'undefined') return;
  if (!gate(`${r.path}:${r.fault}:${r.name ?? ''}`, Date.now())) return;
  const env = currentEnv();
  const report: MicReport = { ...r, name: r.name?.slice(0, 40), os: env.os, browser: env.browser, inApp: env.inApp, standalone: env.standalone };
  try {
    void getApi()
      .micDiag(report)
      .catch(() => undefined);
  } catch {
    /* no api here */
  }
}

/** a mic that would not open (the places that open it themselves): reported, and the one line to show comes back */
export function micFailText(e: unknown, path: MicPath = 'other'): string {
  const fault = faultOfError(e);
  reportMic({ path, fault, engine: 'stream', name: (e as { name?: string } | null)?.name });
  return micAdvice(fault, currentEnv()).text;
}

/** 〔マイクをためす〕 from anywhere (the sheet lives in the layout: components/mic/MicCheck.tsx) */
export const MIC_CHECK_EVENT = 'obolo:mic-check';
export function openMicCheck() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MIC_CHECK_EVENT));
}
