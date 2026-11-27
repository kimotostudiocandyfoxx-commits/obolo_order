# マイク（声で話す・声を録る）

Client 2026-11-27 (phones, mostly iPhone — Chrome on iPhone): 「ダチチャットやバティとの会話で、マイクが反応しないことが多い。設定を見ても、何を変えたらいいのか分からない」.

## What was wrong

| # | Cause | Where it was | Who it hit |
|---|---|---|---|
| 1 | Words were heard only by the browser's own speech recognition (`webkitSpeechRecognition`). Chrome / Firefox / Edge on iPhone and every in-app browser (LINE, Instagram, TikTok …) are WebKit web views: the recogniser is missing or answers `service-not-allowed`. There was no other way to hear. | `lib/useDictation.ts`, `components/talk/TalkComposer.tsx`, `components/onboarding/VoiceChoice.tsx` | iPhone outside Safari: always. Firefox, Android in-app browsers: always |
| 2 | With no recogniser the talk's mic opened the keyboard without a word; with a refusing one it said 「設定 → 一般 → キーボード →「音声入力」をオンに」 — a setting that changes nothing there. | `TalkComposer.tsx`, `micTrouble()` | the same people |
| 3 | Every recorder failure was "denied" and said 「設定 → Safari → マイク」, also in Chrome and on Android, also for "no microphone" and "busy". | `lib/useRecorder.ts`, `components/dachi/HoldMic.tsx` | ダチ voice messages, the egg, everywhere |
| 4 | The sound session was "ambient" (the silent switch, M-R239, 2026-11-22) while the mic was open, and every sound played set it again, also in the middle of a recording. iOS records under "play-and-record". | `lib/onboarding/audio.ts` | iPhone / iPad, every browser (not verified on a device) |
| 5 | The page's one stream was kept alive for the whole visit (2026-11-24). iOS mutes a stream after a call, another app, the lock screen or the recogniser taking the mic; it stays "live", so it was used again and the take was silent. It also left the recogniser deaf after a ダチ voice message. | `lib/micStream.ts` | iPhone / iPad (not verified on a device) |
| 6 | No sign that the mic hears: a pulse that looks the same whether sound comes in or not. No mic settings anywhere in the app. | talk, ダチ bar, `/settings` | everyone |

Not a cause: there is no `Permissions-Policy` header (next.config, vercel.json), no iframe, and the API takes `audio/mp4` (`VOICE_MIME_TYPES`).

## How it works now

- `lib/mic/core.ts` — the rules, no DOM: phone and browser family, which engine, the recording's container, fault names, the Japanese lines, the loudness gate, the mic check's verdict. Tests: `core.test.ts`.
- `lib/mic/hear.ts` — one take heard as words, for every "speak instead of typing" (`useDictation`, `VoiceChoice`). Two engines:
  - `speech`: the browser's recogniser — Safari on iPhone / iPad, Chrome on Android, desktop Chrome. Started again after each pause; three ends at once in a row, or any real error, go on with the recorder in the same take.
  - `record`: MediaRecorder (`audio/mp4` on iPhone, `audio/webm` elsewhere) → `POST /voice/dictate` → words. Used straight away on iPhone outside Safari, in in-app browsers, and where there is no recogniser. Stops by itself after a quiet.
  Tests with fake browsers: `hear.test.ts`.
- `lib/micStream.ts` — the page's one stream: asked for inside the tap, reused only when live and not muted, closed 15 s after the last recording, when the page is hidden, and before the recogniser starts. `lib/onboarding/audio.ts micSession()` holds "play-and-record" while a mic is open.
- `lib/useRecorder.ts` — voice recordings (ダチ voice messages, the egg …): `fault`, `advice`, `level`; a take with no sound at all is not offered for sending.
- `components/mic/MicCheck.tsx` — 〔マイクをためす〕: the browser, the permission, a live loudness bar, the result in words and the steps to allow the mic on this phone. Opened from `/settings`, the Moon talk's settings and every mic notice. Nothing is recorded.

`POST /voice/dictate` (signed in; raw `audio/*` body, ≤ 3 MB): ffmpeg → MP3 → the speech model → `{ text }`. The recording is not stored. 300 a day and 40 in ten minutes per member (PLACEHOLDER P-VOICE-7); cost filed under `listen`.

## Diagnostics

The web app reports a mic failure to `POST /diag/mic` (no sign-in, 30 an hour per address; on the page at most 6 in ten minutes and the same fault once a minute):

```json
{ "path": "bati", "fault": "denied", "engine": "record", "name": "NotAllowedError", "os": "ios", "browser": "chrome", "inApp": false, "standalone": false, "mime": "audio/mp4" }
```

- `path`: bati, atelier, dachi, dachi-voice, story, kororin, egg, compose, check, other
- `fault`: denied, no-device, busy, unsupported, silent, stt, network, failed — and `fallback` (the recogniser was given up; `name` says why: `service-not-allowed`, `ends-at-once`, `no-words` …)
- no member id, no address, no user agent, no words, no audio. The body is a fixed schema (`packages/shared/src/micDiag.ts`): enums and short plain words only.

Reading it: each report is one log line `mic-diag {…}` (Cloud Logging, logger `MicDiag`), and

```
curl -H "x-admin-token: $ADMIN_TOKEN" https://<api>/admin/diag/mic
```

returns the last 200 reports and, for the last 7 days (Japan time), the counts per "os/browser fault". Kept two weeks in Redis.

## Not checked on a real phone

Causes 4 and 5 are read from the code and from how WebKit behaves; the fix is safe either way, but whether they were what the client saw needs an iPhone. After release, `GET /admin/diag/mic` shows it: `silent` on iOS means sound still does not come in; `fallback` on `ios/safari` means Safari's recogniser fails too.

## Wording

All lines are PROVISIONAL (story chat to confirm): `micAdvice`, `allowSteps`, `PERMISSION_WORDS`, `checkVerdict` in `lib/mic/core.ts`, `MIC_PHASE_WORDS` in `TalkComposer.tsx`, and the sheet's own labels in `MicCheck.tsx`.
