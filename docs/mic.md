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

## Fixing heard words in place (client 2026-11-27)

One component, `components/mic/VoiceText.tsx` (rules: `lib/mic/edit.ts`, tests `edit.test.ts`), shows the heard words in every voice input: the talk with {bati}, the atelier and the ダチ talk (`TalkComposer`), the ダチ voice message's caption (`components/dachi/TapVoice.tsx`), the story's voice fields (`VoiceField`) and voice answers (`VoiceChoice`).

- A tap on the sentence puts a caret there; 〔けす〕 takes one character per press (an emoji, a kana with its dakuten apart: one press, never half a character); a long press (0.42 s) selects the character under the finger and dragging grows the stretch; 〔まとめてけす〕 takes it away.
- The mic then puts the new words at the caret / in place of the stretch (`useDictation({ caret })`); with nothing tapped they go to the end as before.
- It is drawn text, not a field: nothing is focused, so the keyboard never comes up by itself. The browser's own selection, loupe and copy menu are off on it; touch is read from touch events (a non-passive `touchmove` holds the page while a stretch is dragged), a mouse drags as on a desktop.
- `VoiceChoice` still goes on by itself 1.6 s after the words are heard (it was 0.5 s); a tap on the words holds it and shows 〔これで答える〕.
- The fields that are real text inputs (the story's message bar, Saturn's つぶやき, Mercury's chat) keep their own cursor: the mic already writes where it stands.
- Not checked on a real phone: the long press and drag on iPhone Safari / Chrome (no loupe, no page scroll while dragging), the tap's place in wrapped lines, the floating line of the story's field.

## ダチ voice messages: tap to start, tap to stop, and the trial (client 2026-11-27)

`components/dachi/TapVoice.tsx`. The take goes to `POST /dachi/voice` (raw `audio/*`): ffmpeg cleans it (high-pass 90 Hz, `afftdn` 10 dB, `loudnorm` −16 LUFS), makes it 1.2× faster with the pitch kept (`atempo`), the words are heard (the caption) and a sound is picked from them (`packages/ai voiceMood.ts`, the cheapest text model; `shared/voiceSound.ts`). The member can fix the caption, change the sound under 「おと」, listen (`POST /dachi/voice/preview`, nothing kept) and send. At the send the mix is made (`apps/api/src/voice/voice-mix.ts`) and kept beside the clean voice: the receiver's ♪ → 〔おとをけす〕 plays the clean one (this device, every voice message, until 〔おとをつける〕).

- The sounds: `apps/api/assets/voice-sounds/*.mp3`, made once by `node apps/api/scripts/make-voice-sounds.mjs` (code only). Levels: a bed −24 dB, an accent −20 dB under a −16 LUFS voice, pushed down further by a side-chain compressor while the voice sounds; the weakest うれしい (no mood in the words) is one bell at −26 dB. Samples for the ear: `npx tsx apps/api/scripts/voice-mix-samples.ts <out> <recording>` (`design/refs/2026-11-27-voice-samples/`).
- Who: only a member whose voice may be used (`canUseMedia`: never under 13). Everyone else gets the dictating mic in the ダチ talk — words only, nothing recorded; their words are read by the default cute voice (below).
- How many: `VOICE_MIX_DAILY_CAP` (100) a day per member; past it a calm line. Cost: the small cost `voiceMix` (docs/マナの値段.md 3.).
- A server that cannot make the take ready sends it as before (no caption, no sound).
- Not checked on a real phone: everything heard — the levels of the sounds on a phone's speaker, the clean-up on a real room's noise, the time it takes on Cloud Run (here: about 1 s for a 23 s take, 0.3–0.7 s a mix).

## After the client tried it (2026-11-27, evening): key +2, the sender does not hear their own voice, two versions

The section above still tells the morning's trial (〔listen〕 through `POST /dachi/voice/preview`); the sections below are brought up to this. It is now:

1. **The default key is +2 semitones** (it was +6): `VOICE_TUNE_DEFAULT = { key: 2, speed: 1.8, tune: 0.6, cut: true }` — step d is `rubberband=tempo=1.8:pitch=1.122462`. The rest of the chain is unchanged. A member who saved settings of their own keeps them (they are kept whole in `users.onboarding_json['voice.dachi']`, also a +6 of their own); a member who never changed anything had no entry and gets +2; 「もとにもどす」 is the new default (kept as no entry). `design/refs/2026-11-27-voice-samples/` was made again at +2.
2. **The sender never hears their own voice** (most people dislike hearing their own recording):
   - the draft card has no 〔▶ きいてみる〕; the sound under 「おと」 is chosen without hearing it;
   - the sender's own voice bubbles in the talk have no play control: the caption and a small quiet mark 「🎙 声を送ったよ・12秒」 (`TalkItem.voiceSent`, `lib/dachi/voiceSend.ts voicePartOf`). The receiver plays it as before;
   - {bati}'s voice settings play nothing: the new settings are said in words; 「きいてみたい」 gets one line (`VOICE_TUNE_LINES.noListen`); the chip 〔きいてみる〕 is gone;
   - **on the server too**: `POST /dachi/voice/preview` and `POST /dachi/voice/tune/preview` answer 410 `VOICE_NOT_PLAYED` for everyone; the draft (`POST /dachi/voice`) carries no URL; the sender's own view of their voice message (`DachiVoiceService.toView`) has `audioUrl: null`, no `sound.plainUrl`, and `sentVoice: true` — in the answer to the send and in every later read. Not closed: the file itself is still the member's own media (`/media/...` by its URL, for someone who kept the URL from before) — the URL is simply no longer given to them.
   - The **default cute voice of a member who is not recorded** is not their own voice: their flow is as it was (their bubble plays). To be confirmed with the client.
   - **The "last take" is not kept any more** (it existed only for the settings' trial): the code is gone. What was kept on 2026-11-27 — one clean file per member and the pointer `voice-take:<member>` in Redis — is removed for a member at their next take or voice-settings turn (`DachiVoiceDraftService.forgetTake`) and for everyone by the one-off `POST /admin/voice-takes-cleanup?limit=500` (admin token; answers `{ looked, removed, next }`; run again with `&after=<next>` until `next` is null). It walks the members by id and looks each pointer up (the key-value store has no key listing).
3. **Two versions, one button on the draft card**, remembered per member on the server (`users.onboarding_json['voice.dachi.version']`, `PUT /dachi/voice/version`; `packages/shared/src/voiceVersion.ts`):
   - **「そのまま」** (`asis`, the default, the cheap one): the recording made ready as above.
   - **「きれい」** (`clean`): Fish reads the caption — the words heard from the take, as the member fixed them — in **the member's own registered voice model** (`users.voice_bati_id` — the column keeps its old name; since M-R342 {bati} no longer speaks in it, and new models are made from the recording without the old +2 semitones — only when it may be used) or, without one, in the default cute voice (`defaultCuteVoiceId`). It is `CuteVoiceService.speak` with the same checks: the words moderated, the mana taken first (`cuteVoice`, per character, shown small beside 〔送る〕 as 「−0.6」), given back when no voice came, and with no mana the words go as a text message with the calm line. The row is a voice message with `work_json.tts = 'clean'`.
   - **The recording in 「きれい」**: when 「きれい」 is the member's remembered version the take is only heard as words (`heardVoice`: step a → the speech model) and **nothing of it is kept**. When the member had a 「そのまま」 draft and then presses 「きれい」, that draft's file is thrown away at the send (`drop`), also when the words went alone. The other way round (「きれい」 → 「そのまま」) the recording is made ready then, from the take still in the page's memory (`POST /dachi/voice?as=asis`).
   - 「きれい」 is offered only where it can be made (the voice service on, a voice to read in): `DachiVoiceDraft.clean.on`. A member who is not recorded has no such button (their cute-voice switch is unchanged).
   - The sender hears neither version.
4. **What each costs the member**: `docs/マナの値段.md` 「ダチの声のメッセージ：2つの声」.

Not checked on a real phone or with a real voice model: how 「きれい」 sounds in a member's own model (it is the model made for {bati}: pitched up two semitones), and the card's layout with the new button on a small screen.

## The voice itself: sample K, and the member's own settings (client 2026-11-27)

The lines above about "1.2× faster with the pitch kept" are the trial of the morning; the client then chose **sample K** by ear. `cleanVoice` (`apps/api/src/voice/voice-mix.ts`) is now:

| step | what | with |
|---|---|---|
| a. clean | `highpass=f=100,afftdn=nr=24:nf=-45:tn=1,agate=threshold=0.012:ratio=2:attack=10:release=250` | ffmpeg (`CLEAN`) |
| b. 「間をつめる」 | `silenceremove`: the silence before the first word goes, a pause longer than 0.28 s becomes 0.14 s, −40 dB | ffmpeg (`SILENCE_CUT`: `on` and the thresholds in one constant — the client may still tune or drop it) |
| c. autotune 0.6 | every pitch point pulled toward the nearest semitone (A = 440) by the strength: Praat "To Manipulation" (0.01, 75, 500) → pitch tier → "Get resynthesis (overlap-add)" | `apps/api/assets/voice-tune/autotune.py`, python3 + praat-parselmouth 0.4.7, a subprocess |
| d. the shape | `rubberband=tempo=1.8:pitch=1.122462` (+2 semitones — it was +6, `pitch=1.414214`, until the client tried it; formants not kept — the approved sound), then `loudnorm=I=-16:TP=-1.5:LRA=11` | ffmpeg |

- **Never fails the message for the autotune.** The subprocess has a time limit (`VOICE_TUNE_TIMEOUT_MS`, 8 s); no Python, no parselmouth, an error or late → the chain goes on without step c. An ffmpeg without the rubberband filter → the same speed and key by `asetrate` + `atempo` (a rougher sound). `cleanVoice` says which it was (`made`).
- **The image**: `apps/api/Dockerfile` installs python3 and praat-parselmouth in `/opt/voice` (`VOICE_TUNE_PYTHON=/opt/voice/bin/python`). Debian's ffmpeg has rubberband; the build log prints the filter's line (or a note that it is missing). Not checked in a built image here (no Docker daemon in the work machine): after the next deploy, one voice message and the log line `clean … autotune` tell.
- **The caption** is heard from step a's output — clean, uncut, at the speed and pitch it was said in — not from the changed voice, so the settings do not touch the words.
- **A take that is all silence** leaves nothing after step b: `VOICE_SILENT` (422), and the mic says 「もう少し長く、話してね」 like a take that was too short. It is never sent "as it is".
- **Time**: a 20 s take in 1.8–1.9 s here (4 cores; 1.35 s without the autotune), the 23 s sample in 2.4 s; a mix 0.25–0.33 s. Cloud Run's one core will be slower — the target is 2–4 s.
- **Samples**: `design/refs/2026-11-27-voice-samples/` (now at key +2; made again with the default from `design/voices/default-bati-source.m4a`: `npx tsx apps/api/scripts/voice-mix-samples.ts <out> <recording>`; `TUNE='{"key":0,"speed":1.2}'` tries other settings).

### The member's own settings, by talking to {bati}

`packages/shared/src/voiceTune.ts` (rules, words, lines; tests `voiceTune.test.ts`). Kept per member in `users.onboarding_json['voice.dachi']` (a JSON string; the default is kept as no entry; no migration).

| | range | default |
|---|---|---|
| key | −6 … +8 semitones (whole) | +2 (was +6) |
| speed | 1.0 … 2.0 (tenths) | 1.8 |
| autotune | 0 … 1 (tenths; 0 = none) | 0.6 |
| 「間をつめる」 | on / off | on |

- In the Moon talk (`AtelierChat.voiceTuneSend`, found like the title words — a pure parser, `voiceTuneTalk`): 「声の設定」 says where they are; 「声を低くして／高くして」 (2 semitones; 「少し」1, 「すごく」4; 「キーを+3に」), 「もっとゆっくり／速く」 (0.2; 「1.5倍に」), 「オートチューンを強く／弱く／なしに／80%に」, 「間をつめないで／つめて」, 「もとの声に近づけて」 (half-way back to the voice as recorded), 「もとの声のままで」 (key 0, 1.0×, no autotune), 「もとにもどす」 (the default). After a turn about them short words count (「もっとゆっくり」, the chip 〔もとにもどす〕; 「きいてみたい」 gets the line that one's own voice is not played back); outside it the words must name the voice — 「もっとゆっくり」 with a song on the table is the song's.
- `GET /dachi/voice/tune`, `PUT /dachi/voice/tune` (the parts given, or `reset`; **clamped on the server** whatever is sent). Nothing is played: {bati} says the new settings in words (`POST /dachi/voice/tune/preview` refuses, 410).
- No "last take" is kept (it was, on 2026-11-27 only, for a trial that is gone: see the cleanup above).
- Only a member who is recorded has settings (`VOICE_NOT_ALLOWED` otherwise; {bati} says so). They never touch the default cute voice.
- The cost is still the small cost `voiceMix` (CPU seconds × `CPU_SECOND_JPY`: about 2–4 s a take now instead of 1).

## The default cute voice for a member who is not recorded (client 2026-11-27)

`packages/shared/src/cuteVoice.ts`, `apps/api/src/dachi/cute-voice.service.ts`. A member for whom `canUseMedia` is false (under 13; 13–15 without the guardian's consent; the start screen's branch without photo and voice) is never recorded. Their ダチ words — dictated (`POST /voice/dictate`, not stored) or typed — are read by **the default cute voice**: the shared {bati} voice model, one constant (`defaultCuteVoiceId` = `FISH_DEFAULT_VOICE_ID`). Only the words go to Fish.

- The talk shows 〔🔊 こえをつける〕 above the mic (on by default, kept on the device) and the price small beside 〔送る〕 (「−0.3」) — `GET /dachi/voice/cute` gives whether it applies and the live price's two numbers.
- The send is the text message's (`POST /dachi/threads/:id/messages` `{ text, spoken: true }`): the words are checked as ever, the mana taken (`MakeKind` `cuteVoice`, per message on its own words), the voice made, the quiet sound picked from the words and mixed in as for a recorded voice, and a **voice message with the words as its caption** is sent (the receiver's 〔おとをけす〕 as built).
- No mana / not enough, no voice service, a failure (the mana is given back): the same words go as a text message and one calm line says so (`cute.miss`) — never an error.
- A member who is recorded never gets it (`spoken` is ignored): their recorded voice message is unchanged.
- {bati} for these members: the same fixed voice as everyone's (M-R342). At 0 mana one rule for everyone (`batiVoiceSilent`): during the first journey {bati} is always heard; after it, with **no mana left there is no voice** (`POST /voice/bati-says` answers `{ url: null }`, the words stay; a post read by {bati} falls back to the device's reading voice) — recorded or not, Obolo Order or not.

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
