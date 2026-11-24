'use client';

/**
 * Client 2026-11-24 (iPad, R7: "the mic is asked for on every visit"): one microphone stream for the whole page.
 * getUserMedia is called once; the stream is kept, its track switched on for a recording and off between them (never
 * stopped), so a press does not ask again. It is stopped when the page goes away (pagehide). A reload asks again
 * unless the iPad's own setting allows it: Safari → aA → Webサイトの設定 → マイク → 許可 (Settings → Apps → Safari →
 * マイク → 許可 for every site).
 */
const CONSTRAINTS: MediaStreamConstraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
let shared: Promise<MediaStream> | null = null;
let armed = false;

const live = (s: MediaStream) => s.getAudioTracks().some((t) => t.readyState === 'live');

/** the page's microphone, switched on (asks only the first time, or after the stream ended) */
export async function openMic(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
  if (shared) {
    const s = await shared.catch(() => null);
    if (s && live(s)) {
      for (const t of s.getAudioTracks()) t.enabled = true;
      return s;
    }
  }
  const p = navigator.mediaDevices.getUserMedia(CONSTRAINTS);
  shared = p;
  try {
    const s = await p;
    if (!armed && typeof window !== 'undefined') {
      armed = true;
      window.addEventListener('pagehide', closeMic);
    }
    return s;
  } catch (e) {
    shared = null;
    throw e;
  }
}

/** a recording ended: the track goes quiet, the stream stays (no new question next time) */
export function quietMic() {
  void shared?.then((s) => s.getAudioTracks().forEach((t) => (t.enabled = false))).catch(() => undefined);
}

/** the page is going away: the stream ends */
export function closeMic() {
  void shared?.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => undefined);
  shared = null;
}
