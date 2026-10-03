# Obolo Order — Full Product & Engineering Specification
### For Claude Code — Complete Design Document v1.7.1
### v1.7.1: Full-document consistency audit — fixed residual contradictions (Venus is
###         SQUARE not vertical; Stars replace likes everywhere; v1.4 changelog annotated
###         as superseded by the v1.6 scout model; Phase 2 Mercury includes the discovery
###         feed + Stars; OPEN items renumbered). No decision content changed.
### v1.7: Revenue payout model finalized — royalties (LabelGrid DSPs + the company's
###       1M-subscriber YouTube channel) are paid in JPY to the EARNINGS ledger by default;
###       optional EARNINGS→MANA conversion grants +10% bonus MANA. MANA-only payout is
###       FORBIDDEN (legal: would undermine the non-redeemable design). YouTube channel
###       exposure is a separate, staff-curated privilege on top of scouted releases.
###       EARNINGS appear as the user's Earth Bank balance; withdrawal to the user's real
###       bank account uses the GMO Aozora transfer API.
### v1.6: Platform terminology — "plays" → "Loops (ループ)", "likes" → "Stars (星)".
###       Stars are 3-tiered (Star 1/2/3) and auto-file into per-tier playlists.
###       Mercury becomes a TikTok-style discovery feed (one square track card at a time,
###       swipe to skip). obolo records switches to a SCOUT model: creators who accumulate
###       Loops & Stars receive an invitation from obolo records; only the invited may pay
###       500 MANA and distribute.
### v1.4: Worldwide distribution is no longer a default feature — it is gated behind the
###       in-app curated label "obolo records" (500 MANA per release; the review flow was
###       superseded by the v1.6 scout model). Royalties split 92% artist / 8% label. See §6.5.
### v1.5: obolo records qualification is AUTOMATIC (Mercury traction thresholds), no
###       per-track human review; added §3.4 MANA Economy — monthly 88-MANA grant, and a
###       viewer-free / creator-pays cost table across all 8 planets + Earth.
### v1.2: Earth communication stack finalized (self-hosted messaging + Agora for real-time calls).
### v1.3: Monetization guardrails & ops decisions — Buddy daily quota + MANA overage;
###       instrumental generator is a swappable abstraction (commercially-licensed model first,
###       NOT hardcoded MusicGen); per-user storage quota with MANA add-ons; Stripe card billing
###       as primary rail; MANA expiry = 1 year from last activity; in-app-only fallback when
###       DSPs reject AI tracks; moderation + admin console are launch blockers.
### Date: 2026-10-03 / Client: Studio Candy Foxx Inc.

---

## 0. HOW TO READ THIS DOCUMENT (for Claude Code)

This document is the single source of truth for the product. Build exactly what is specified here.
Where a decision is marked `DECIDED`, do not deviate. Where marked `OPEN`, ask before implementing.
Where marked `PLACEHOLDER`, insert a clearly-marked stub the client will replace later.

---

## 1. PRODUCT VISION

**Obolo Order** is a social platform whose world is a **solar system**.

- Every user lives on **Earth (🌍)** — the home planet (profile, messages, bank, wallet).
- Users can freely travel to **8 planets**, each of which is a distinct content/social module.
- All 8 planets share one unifying creative principle: **every medium involves SOUND/VOICE/MUSIC**.
- The founder is a professional DJ/music producer; audio-first expression is the brand identity.

### 1.1 Core differentiators (these are the product's reason to exist — never cut them)

1. **¥88/month flat subscription** (approx. $0.60). Designed so children and users in
   low-income markets (e.g., Southeast Asia) can afford a Netflix/Spotify-class experience.
2. **Paid wall as an anti-AI-spam filter.** Because every user pays ¥88/month, mass bot/AI
   content flooding (expected on free platforms like X/TikTok) is economically impractical.
   AI-*assisted* content by real paying humans is welcome; AI bot farms are not.
3. **Everything is SQUARE (1:1).** All images, reels, and videos across planets are 1:1 square
   format. This is a visual brand identity AND a cost optimization (single encode profile,
   single grid layout, no orientation handling).
4. **Your own voice, everywhere.** Users register their voice once; the platform can speak,
   sing, and post in the user's own voice via voice cloning (with strict consent controls).
5. **MANA (マナ) — one internal currency for everything.** Generation credits, purchases,
   tips, and game billing are all denominated in MANA.
6. **Creators keep 92%** on the game store (Neptune) — vs Apple's 30% cut.

---

## 2. PLANET MAP (Functional Specification)

| # | Planet | Role | Analogy | Key difference |
|---|--------|------|---------|----------------|
| 🌍 | Earth | Home: profile / mail / phone / Bank | — | One virtual bank account per user |
| 🌙 | Moon | AI companion chat with "Buddy" (バティ) | Gemini/ChatGPT | Talks to a *character*, not a faceless AI |
| 🪐 | Saturn | Voice-native microblogging | X (Twitter) | Tap a post → hear the poster's VOICE |
| 🟤 | Jupiter | Photo posts | Instagram | Audio attachment is MANDATORY |
| 💧 | Mercury | Music streaming + AI music creation | Spotify | Users generate & publish songs (self-hosted pipeline) |
| 🟡 | Venus | Short-form SQUARE reels | TikTok/Reels-style feed | Paid-members-only posting = quality; SQUARE (1:1) video only |
| 🔥 | Mars | Long-form video | Netflix/YouTube | Anime/drama/long video, SQUARE format |
| ⭕ | Uranus | E-commerce mall | Amazon | Print-on-demand: zero inventory risk for sellers |
| 🔵 | Neptune | Game store | App Store | Only 8% platform fee (creators keep 92%) |

### 2.1 🌍 Earth — Home
- User profile, settings, subscription status.
- **Communication suite (DECIDED v1.2 — see §7.6):**
  - Voice messages (async, voice-mail style): user records a message, OR generates it
    in their own cloned voice (VoiceID / GPT-SoVITS). Stored on Bunny Storage, delivered
    via CDN, played on tap. This reuses the exact same components as Saturn voice posts —
    no real-time call infrastructure needed for async voice messaging.
  - Text messages / mail-style long-form: same thread model, audio attachment optional.
  - Real-time voice calls ("phone"): phase 2+, via Agora (WebRTC-class SDK).
- **Bank**: each user gets one virtual bank account (see §7.2, GMO Aozora BaaS).
- MANA wallet UI: balance, purchase, earnings ledger, withdrawal request.
- Voice registration flow (see §6.3): user records a short sample → VoiceID created.

### 2.2 🌙 Moon — AI Buddy "バティ (Bati)"
- Conversational companion with a persistent character defined by the platform.
- Backend: Gemini API (primary) / ChatGPT API (fallback) with a system-prompt character layer.
- **Key UX difference from raw ChatGPT/Gemini: the user talks to a CHARACTER with a name,
  personality, memory of past conversations, and (optionally) the USER'S OWN cloned voice
  or the character's voice for replies.** The "I'm talking to an AI" awkwardness is removed.
- Buddy profile page ("バティプロフィール") editable per user (name, personality sliders).
- Long-term memory: store conversation summaries per user; inject into context window.
- Usage policy (DECIDED v1.3): free daily quota (default 30 messages/day, admin-tunable);
  beyond the quota each message costs 1 MANA. Enforced server-side with a per-day counter
  (protects the ¥88 model from LLM API cost overruns).

### 2.3 🪐 Saturn — Voice-Native Microblog (the "audible Twitter")
- Short text posts (280-char class), each with an attached voice recording of the post.
- Tap post → plays the author's voice reading it (tone, emotion, laughter come through).
- Voice source options: (a) author records it, or (b) auto-generated with the author's
  cloned voice (VoiceID) via TTS, or (c) platform default voice.
- Standard SNS graph: follow, Star (appreciation — see §3.4 terminology), reply, repost (quote).

### 2.4 🟤 Jupiter — Photo + Mandatory Sound (the "audible Instagram")
- Square (1:1) image posts. **An audio track is REQUIRED to publish** (music clip, voice memo,
  ambient sound — anything). A post without audio cannot be submitted (client + server validation).
- Grid is 1:1 squares only.
- The attached audio may come from the user's Mercury tracks (cross-planet reference).

### 2.5 💧 Mercury — Music Planet (create → publish → distribute worldwide)
- **Listen (DECIDED v1.6)**: Mercury's home is a **TikTok-style discovery feed**, not a
  library: one full-screen square track card plays automatically; swipe down/up for the
  next track; music keeps flowing until the user finds a song they love. Recommendation
  v1 = popularity + freshness mix; personalized ranking is a later iteration.
- **Stars (星) — 3-tier appreciation (DECIDED v1.6)**: instead of a single like, the
  listener awards Star 1, Star 2, or Star 3. The track is auto-filed into the listener's
  corresponding auto-playlist: "Star 1", "Star 2", "Star 3". Re-rating upgrades/downgrades
  the track and moves it between playlists. Traditional playlists and follows also exist.
- **Create**: AI music generation (see §6.1 self-hosted pipeline; Mureka API as premium tier).
  - 10 MANA → generate 1 song (standard, self-hosted pipeline)
- **Distribute**: worldwide distribution is a **paid, curated privilege via the in-app
  label "obolo records" (DECIDED v1.4 — see §6.5)**, NOT a default feature. Users apply,
  auto-qualify through in-app traction (§6.5), and pay per release (500 MANA). Releases go out via the
  LabelGrid API to Spotify, Apple Music, YouTube Music, etc. (LINE Music: TO BE CONFIRMED).
  In-app publishing on Mercury remains free for everyone.
- **Earn**: streaming royalties return via LabelGrid → obolo records keeps 8%, the artist
  receives 92% into the EARNINGS ledger (same split philosophy as Neptune).

### 2.6 🟡 Venus — Paid Reels
- Short-form video feed (TikTok/Reels mechanics: swipe feed, Stars, comment, share).
- **SQUARE (1:1) video, not vertical** — deliberate differentiator.
- Only paying subscribers can post (already guaranteed by the ¥88 paywall).
- Video pipeline: Bunny Stream upload → transcode (single 1:1 profile) → CDN playback.

### 2.7 🔥 Mars — Long-Form Video
- Long video hosting: anime, drama, creator series. SQUARE (1:1) player.
- Bunny Stream; optional DRM add-on for premium/licensed content (OPEN: phase 2).

### 2.8 ⭕ Uranus — E-Commerce Mall (zero-inventory)
- Multi-vendor marketplace: each user/creator can open a shop (1 user = 1 shop).
- Implementation: **Shopify + multi-vendor marketplace app** (e.g., ShipTurtle class)
  + **Print-on-Demand** fulfillment (Printful class): order → produce → ship, automated.
- **Zero inventory risk for sellers** — production starts only after an order is placed.
- Payments in MANA (converted at settlement); creator payout via earnings ledger.
- Cross-link: Neptune game characters can become Uranus merchandise.

### 2.9 🔵 Neptune — Game Store (8% fee)
- In-app game store for **HTML5/browser games** (no App Store / Google Play intermediary).
- Creators publish original games (characters/music from their own IP welcome).
- In-game purchases are billed in MANA.
- **Revenue split: 92% developer / 8% platform.** Automated split at purchase time.
- Legal basis (Japan): the Mobile Software Competition Act (in force since 2025-12-18)
  allows alternative billing / off-store distribution. HTML5 games served in our own
  WebView/PWA avoid the 30% store fee entirely.

---

## 3. MANA (マナ) ECONOMY — The Internal Currency

MANA is the single unit for all in-app value: generation credits, purchases, tips, game billing.
Naming rationale: "currency" has negative connotations; MANA (like magic points) fits the
fantasy/space world. 1 MANA = ¥1 (DECIDED — keeps pricing legible).

### 3.1 MANA sinks (spending)
| Action | Cost (initial pricing — tunable in admin) |
|---|---|
| Generate 1 song (standard self-hosted pipeline) | 10 MANA |
| Generate 1 song (premium via Mureka API) | 30 MANA |
| High-quality image generation | 20 MANA |
| Video generation | 50 MANA |
| Purchases on Uranus (goods) | item price in MANA |
| In-game billing on Neptune | item price in MANA |
| Tips to posts (Saturn/Jupiter/Venus/Mars) | any amount (92% to author) |

### 3.1.1 MANA expiry policy (DECIDED v1.3)
- MANA expires **1 year after the user's last activity** (any purchase, earn, or spend resets
  the clock). Must be stated in the Terms of Service. Automated expiry jobs write compensating
  ledger entries (reason: `expiry`). The wallet screen shows an expiry forecast.

### 3.2 TWO-LEDGER SYSTEM (DECIDED — this is a legal architecture decision)

Japan's Payment Services Act (資金決済法) governs prepaid payment instruments. To stay in the
light "self-use prepaid instrument" category (自家型前払式支払手段) and AVOID the heavy
"fund transfer service" (資金移動業) license, MANA must be **non-redeemable** (no MANA→JPY).
We therefore maintain TWO strictly separated ledgers per user:

```
Ledger A: MANA balance  (spend-only, non-redeemable, non-transferable between users)
Ledger B: EARNINGS balance (JPY-denominated revenue: LabelGrid royalties, Uranus sales,
          Neptune 92% share, received tips)

Flows:
  JPY → MANA                : purchase (top-up)                [ALLOWED]
  EARNINGS → MANA           : one-way conversion               [ALLOWED — and v1.7 adds a
                              +10% bonus MANA on conversion to keep value circulating in-app.
                              Conversion is ALWAYS optional; earnings default to JPY.]
  EARNINGS → JPY (bank)     : withdrawal to the user's own     [ALLOWED — payout of revenue,
                              verified bank account via GMO Aozora transfer API]
  MANA → JPY                :                                  [FORBIDDEN — never implement]
  MANA → another user       : direct transfer                  [FORBIDDEN; tips are settled
                              into the recipient's EARNINGS ledger instead, in JPY terms]
```

Regulatory notes to embed as code comments + compliance checklist:
- Self-use prepaid instrument: filing with the Local Finance Bureau becomes required only
  when unused balance exceeds ¥10M at a base date (Mar 31 / Sep 30). After filing, a
  security deposit of ≥50% of unused balance is required. Build an admin report that tracks
  total unused MANA against this threshold with alerts at ¥8M.
- All MANA transactions must be append-only (immutable ledger entries) with idempotency keys.
- PLACEHOLDER: obtain a one-time review by a Payment Services Act attorney before launch.

### 3.3 Money movement map

| Scene | Flow | System of record |
|---|---|---|
| ¥88 subscription | **Card payment via Stripe (DECIDED primary)**; virtual-account bank transfer as secondary option | Stripe + GMO Aozora |
| MANA top-up | JPY deposit → virtual account → webhook → credit MANA | GMO Aozora + app DB |
| MANA spend | Atomic decrement, append-only ledger | App DB only (bank untouched) |
| LabelGrid royalties | Payout in JPY → obolo records label account → **92% to artist's EARNINGS / 8% platform share** | LabelGrid + app DB |
| YouTube channel revenue | Scouted tracks curated by staff onto the company's 1M-subscriber YouTube channel → ad revenue → **same 92/8 split into artist EARNINGS (JPY)** | YouTube + app DB |
| Earth Bank balance display | User's EARNINGS + virtual-account deposits surface as their "Earth Bank balance" in-app (balance inquiry via GMO Aozora API) | GMO Aozora + app DB |
| Uranus sale | Buyer pays MANA → seller EARNINGS credited in JPY equivalent (minus platform fee) | App DB |
| Neptune game billing | Buyer pays MANA → developer EARNINGS 92%, platform 8% | App DB |
| Withdrawal | User request → EARNINGS → JPY transfer to verified bank account | GMO Aozora transfer API |

---

### 3.4 MANA ECONOMY — value index & per-planet cost table (DECIDED v1.5)

Principles (brand-level, do not change without client sign-off):
1. **VIEWING is free on every planet** — that is what the ¥88 buys.
2. **CREATING/GENERATING costs MANA** — generation burns real GPU/API cost.
3. **EARNING returns 92% to the creator / 8% platform** — same split everywhere
   (obolo records, Neptune, tips, paid Mars series). Consistency is the brand.
4. The ¥88 subscription includes a **monthly grant of 88 MANA** (1 MANA = ¥1).
   Grant lands on the subscription renewal date; grant MANA follows the same expiry rule.

Per-planet cost table (v1 defaults; ALL values admin-tunable):

| Planet | Viewer side (free) | Creator side (MANA cost) |
|---|---|---|
| 🌍 Earth | messages, recorded voice msgs | cloned-voice message 1 MANA/clip; storage add-on 100 MANA per +1 GB |
| 🌙 Moon | — | Buddy chat: 30 msgs/day free, then 1 MANA/msg |
| 🪐 Saturn | browsing, voice playback | recorded posts free; cloned-voice post 1 MANA; tips (92% to author) |
| 🟤 Jupiter | browsing | photo+own audio free; auto-generated BGM post 3 MANA |
| 💧 Mercury | streaming | song 10 MANA; premium (Mureka) 30 MANA; in-app publish free; obolo records distribution 500 MANA/release |
| 🟡 Venus | watching | posting free (within storage quota); tips (92% to author) |
| 🔥 Mars | watching | uploads free (within quota, over-quota via add-on); paid series: creator sets MANA price, 92% to creator |
| ⭕ Uranus | browsing | opening a shop free; buyers pay item price in MANA; sales settle to seller EARNINGS |
| 🔵 Neptune | playing | in-game items in MANA (92% to dev); game listing 100 MANA (proposal — spam gate; see OPEN #11) |

User-facing value framing (for marketing copy): "¥88/month = make 8 songs, or 58 extra
Buddy chats + 3 songs." Keep this arithmetic true when tuning prices.

Terminology (DECIDED v1.6 — user-facing copy, all planets):
- "play/stream" of a track is called a **Loop (ループ)**.
- "like" is called a **Star (星)**; on Mercury Stars are tiered (Star 1/2/3).
- Use these terms in UI copy and user-facing analytics (e.g., "1.2K Loops", "342 Stars").

---

## 4. SYSTEM ARCHITECTURE (PWA-first)

### 4.1 Form factor: DECIDED — Web app (PWA) first
- Rationale: avoids 30% app-store fees, aligns with the Mobile Software Competition Act era,
  instant distribution, one codebase, installable to home screen, push notifications via
  Web Push. Native shells (iOS/Android via Capacitor or similar) are a phase-2 option —
  architect the frontend so this port is cheap (no web-only APIs without a fallback plan).

### 4.2 Recommended stack (strong defaults; Claude Code should use these unless justified)
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS + PWA (next-pwa).
  UI concept: a navigable solar-system map as the home surface; each planet is a route
  (`/earth`, `/moon`, `/saturn`, ...). Square 1:1 media components everywhere.
- **Backend**: Node.js (NestJS) or equivalent typed API server; REST + WebSocket (chat/live).
- **Database**: PostgreSQL (relational core) + Redis (sessions, feed caches, rate limits).
- **Media**: Bunny Stream (video), Bunny Storage + CDN (images/audio), single 1:1 encode profile.
- **AI/LLM**: Gemini API (primary), OpenAI API (fallback) behind a provider-agnostic wrapper.
- **GPU workers**: a queue-based worker pool (e.g., BullMQ) calling self-hosted inference
  containers for instrumental generation / DiffSinger / GPT-SoVITS on rented GPU instances
  (e.g., runpod-class). Design as async jobs: submit → webhook/poll → store result on Bunny.
  Emit per-job GPU cost telemetry to the admin dashboard (used to keep MANA prices above cost).
- **Auth**: email + passkey/WebAuthn; minors-friendly parental-consent flow (OPEN: legal review).
- **Infra**: Docker; deploy on a single VPS initially, scale workers horizontally later.

### 4.3 Microservice-ish module boundaries (keep in one monorepo)
```
apps/web            — PWA frontend
apps/api            — main API (auth, social, commerce, wallet)
apps/worker-audio   — GPU jobs: instrumental generation, DiffSinger, GPT-SoVITS, mixing
packages/ledger     — MANA/EARNINGS double-entry ledger (pure, well-tested)
packages/media      — Bunny upload/transcode/CDN helpers
packages/ai         — LLM wrapper (Gemini/OpenAI), prompt templates, Buddy persona
packages/payments   — GMO Aozora BaaS client, subscription billing, payouts
packages/distro     — LabelGrid client (release creation, royalty sync)
packages/shop       — Shopify multi-vendor + POD integration
```

---

## 5. DATA MODEL (core entities — PostgreSQL)

Per requirement: **every user has a data slice for every planet.** Model as separate tables
keyed by user_id so planet data is independently scalable and deletable.

```sql
users(id, handle, display_name, birthdate, country, subscription_status,
      voice_id NULL, virtual_account_no NULL, kyc_status, created_at)
wallets(user_id PK, mana_balance, earnings_balance_jpy)  -- never negative; enforce in tx
mana_ledger(id, user_id, delta, reason, ref_type, ref_id, idempotency_key UNIQUE, created_at)
earnings_ledger(id, user_id, delta_jpy, source, ref_id, idempotency_key UNIQUE, created_at)

buddy_profiles(user_id PK, buddy_name, persona_json, memory_summary, updated_at)
buddy_messages(id, user_id, role, text, audio_url NULL, created_at)

saturn_posts(id, user_id, text, voice_audio_url, voice_source ENUM(recorded,cloned,default), ...)
jupiter_posts(id, user_id, image_url /*1:1*/, audio_url NOT NULL, audio_ref_track_id NULL, ...)
mercury_tracks(id, user_id, title, lyrics, bpm, key, chord_progression,
               instrumental_url, vocal_url, mix_url, pipeline ENUM(selfhosted,mureka),
               labelgrid_release_id NULL, distribution_status, loop_count DEFAULT 0,
               star1_count DEFAULT 0, star2_count DEFAULT 0, star3_count DEFAULT 0, ...)
star_events(id, user_id, target_type, target_id, tier INT CHECK (tier BETWEEN 1 AND 3),
            created_at)  -- Stars are used platform-wide; on Mercury they carry tiers.
star_playlists(user_id, tier)  -- auto-generated per user; tracks move between tiers.
venus_reels(id, user_id, video_id /*bunny*/, duration_sec, /*1:1 enforced*/ ...)
mars_videos(id, user_id, video_id, title, series_id NULL, is_drm, ...)
uranus_shops(id, user_id, shopify_vendor_ref, status)
uranus_products(id, shop_id, pod_provider_ref, price_mana, status)
neptune_games(id, user_id, title, bundle_url /*HTML5*/, status, fee_bps DEFAULT 800) -- 8%
neptune_purchases(id, game_id, buyer_id, amount_mana, dev_share_jpy, platform_share_jpy)

voice_profiles(user_id PK, sample_audio_url, sovits_model_ref, consent_scope_json, created_at)
generation_jobs(id, user_id, type ENUM(song,image,voice,video), status, cost_mana,
                spec_json, result_url NULL, error NULL, created_at, finished_at)
withdrawals(id, user_id, amount_jpy, dest_account, status, gmo_ref, requested_at, paid_at)
```

Rules:
- All money fields are integers (yen / mana), never floats.
- All ledger writes are transactional with balance checks; expose `FOR UPDATE` locking.
- Every planetary table carries `created_at/updated_at/deleted_at` (soft delete).
- Per-user media storage quota (DECIDED v1.3): default **1 GB** across all planets; track
  `storage_usage_bytes`, updated on upload/delete. Over-quota uploads are rejected with a
  MANA storage add-on offer (pack sizes/prices admin-tunable).

---

## 6. MUSIC & VOICE PIPELINE (the technical crown jewel)

### 6.1 Self-hosted song pipeline (standard tier, target cost ≈ GPU time only)
```
User prompt (e.g. "切ない夜のラブソング、女性ボーカル")
  → Step 1: LLM "Song Composer" (Gemini) emits a STRICT JSON song spec:
      { title, bpm, musical_key, chord_progression[], structure[],
        lyrics{verse,chorus,...}, mood_tags[], vocal_style, language }
      Validate with zod/json-schema; retry-once on invalid output.
  → Step 2: Instrumental via the InstrumentalGenerator interface (see licensing note
      below). Conditioning on bpm/key/mood tags; chunk & crossfade for >30s targets.
  → Step 3: Vocals via DiffSinger, driven by the SAME spec (bpm/key/lyrics)
      so vocals and instrumental cannot drift apart.
  → Step 4: Mix with ffmpeg (loudness-normalize to -14 LUFS, align stems,
      fade in/out), master to AAC/Opus.
  → Step 5: Store on Bunny, create mercury_tracks row. Distribution to LabelGrid happens
      ONLY through the obolo records flow (§6.5) — never directly from this pipeline.
```
- **The LLM-authored song spec is the synchronization contract between the instrumental
  generator and DiffSinger. Never generate stems without it.**
- LICENSING (DECIDED v1.3): the instrumental generator is a **swappable provider interface**
  (`InstrumentalGenerator`), NOT hardcoded to MusicGen. First candidate must be a model with
  a verified commercial-use license for both code AND weights (e.g., Apache-2.0-class).
  MusicGen may only be enabled after legal confirms its weights license permits commercial
  use. The provider is selected by config; the pipeline code must not change.
- Premium tier: same flow but Steps 2–3 replaced by a single Mureka API call (30 MANA).

### 6.2 Component reuse across planets (DECIDED)
- Instrumental generator → also produces the **mandatory audio for Jupiter posts**
  (user may auto-generate a BGM clip for a photo).
- Voice/TTS engine (with VoiceID) → powers **Saturn voice posts**, **Moon Buddy replies**,
  and **Earth message read-aloud**.

### 6.3 Voice cloning (GPT-SoVITS class, self-hosted) — "register once, sound like you everywhere"
- Earth hosts the voice-registration flow: user reads a prompted script (5–60s),
  liveness/anti-spoof check, explicit consent scopes (which planets may use the voice).
- A per-user model reference (`voice_profiles.sovits_model_ref`) is created; all TTS/SVS
  calls pass VoiceID + consent check. Server MUST reject use without scope.
- Singing in the user's voice: voice-conversion layer over DiffSinger output (RVC-class).
  Mark as `experimental` in v1.
- SAFETY (hard requirements, non-negotiable):
  1. Only the account holder's own voice may be registered (identity verification tie-in).
  2. All synthetic audio is watermarked and carries metadata `synthetic: true`.
  3. One-click voice deletion purges samples, model refs, and cached renders.
  4. Impersonation attempts (uploading others' voices) = account suspension.

### 6.4 Distribution & royalties (LabelGrid)
- Client in `packages/distro`: create release → upload assets → submit to DSPs → poll status.
- Royalty ingestion: scheduled sync (LabelGrid reports) → allocate JPY to each user's
  EARNINGS ledger with idempotent keys. LINE Music availability: TO BE CONFIRMED with
  LabelGrid before launch; design DSP list as data, not code.
- AI-content fallback (DECIDED v1.3): if a DSP rejects AI-generated tracks, the release's
  `distribution_status` flips to `in_app_only` and the track stays streamable inside Mercury.
  Never hard-fail; the user always keeps their track in-app.

### 6.5 obolo records — the in-app label (DECIDED v1.4)
- Purpose: prevent mass AI-content flooding of DSPs and protect the platform's LabelGrid
  account standing. Worldwide distribution is a curated privilege, not a default.
- Brand spelling: "obolo records" — use exactly this lowercase casing everywhere.
- Flow (DECIDED v1.6 — SCOUT model, NO per-track human review):
  creators accumulate **Loops** and **Stars** on Mercury. When an account's traction
  crosses scout thresholds (defaults: **1,000 Loops AND 100 Stars** across their catalog,
  both admin-tunable) AND the account is in good standing, the platform sends an
  in-app **scout invitation from obolo records**. Only invited creators may pay
  **500 MANA** to submit a release. Automated screening (copyright fingerprint check +
  lyric/content moderation) must pass before the release goes out via LabelGrid under
  the obolo records label.
- Quality control post-v1.5: the founder's role shifts from reviewing every track to
  **sampling audits** (admin console surfaces a random sample of qualified releases for
  spot-listening). Audit sampling rate is admin-configurable. Releases failing an audit
  are pulled from DSPs and flagged.
- Rights: the artist keeps copyright; obolo records acts solely as the distribution
  window. The Terms of Service must state this explicitly (no lock-in).
- Royalty split: **92% artist / 8% label** — automated at royalty ingestion time in
  packages/distro.
- Payout model (DECIDED v1.7): royalties are ALWAYS credited in JPY to the EARNINGS
  ledger first. MANA-only payout is forbidden. The wallet offers an optional
  EARNINGS→MANA conversion with a **+10% bonus MANA** (bonus rate admin-tunable).
- YouTube channel privilege (DECIDED v1.7): the company's 1M-subscriber YouTube channel
  is a separate exposure tier. Only staff-selected tracks from scouted releases are
  published there (never automatic). Revenue from those videos flows through the same
  92/8 split into the artist's EARNINGS (JPY). Track a youtube_video_id + revenue sync
  per release in packages/distro.
- Mercury UX: obolo records releases carry an "obolo records" badge; non-label tracks
  remain in-app only. In-app publishing stays free for all users (unchanged).
- Data model additions:
  label_qualifications(id, user_id, track_id, status ENUM(qualified,submitted,released,
    pulled), fee_mana DEFAULT 500, qualified_at, submitted_at, audit_status
    ENUM(pending,passed,failed) DEFAULT pending, audit_note)
  mercury_tracks: add label_release BOOLEAN DEFAULT false, label_qualification_id NULL
- Ops: the admin console shows the scout feed (accounts crossing thresholds), sent
  invitations, and the audit sampling queue; scout thresholds (Loops/Stars) and sampling
  rate are admin-configurable.

---

## 7. EXTERNAL INTEGRATIONS

### 7.1 Bunny (media backbone)
- Bunny Stream: Venus reels, Mars long video; single 1:1 transcode profile; optional DRM
  for Mars premium. Music tracks are stored as audio-only assets (Mercury default = treat
  songs as audio-only Stream entries or Storage+CDN objects — choose one in code, prefer
  the cheaper at launch; mark decision in README).
- Bunny Storage + CDN: Jupiter images, Saturn voice clips, voice samples.
- Upload flow: server-issued signed upload URLs; webhook on encode completion.

### 7.2 GMO Aozora Net Bank BaaS (Earth Bank)
- Start in the free **sunabar** sandbox; production requires a corporate account + vetting.
- **Virtual account method (DECIDED for MVP)**: one corporate account; issue one virtual
  account number per user via API. Deposits to that number are auto-attributed to the user
  via webhook → drive subscription status and MANA top-ups.
- Payouts: transfer API pays EARNINGS withdrawals to the user's verified bank account.
- True per-user real bank accounts (full BaaS embedded banking) = phase 2 (requires eKYC
  and bank-side approval). Keep the abstraction layer (`BankProvider` interface) so this
  upgrade is a drop-in.

### 7.3 Shopify (Uranus)
- One Shopify store + multi-vendor marketplace app (ShipTurtle-class) = 1 user : 1 shop.
- POD fulfillment (Printful-class): order → auto produce → ship. Sellers never hold stock.
- Settlement: customer pays in MANA on our platform; we settle with vendors monthly via
  EARNINGS ledger (JPY). Reconciliation job required (orders ↔ payouts).

### 7.4 LLM providers (Moon + composer + moderation)
- Provider-agnostic wrapper: `chat(persona, history)`, `composeSongSpec(prompt)`,
  `moderate(text|media_meta)`.
- Gemini primary, OpenAI fallback. Prompt templates live in `packages/ai/prompts/`.

### 7.5 Mureka (premium music tier)
- Optional paid API path for high-quality songs (30 MANA). Keep behind a feature flag.

### 7.6 Communication infrastructure (DECIDED v1.2)
- **Async messaging & voice messages (Earth)**: self-hosted — PostgreSQL (message rows)
  + WebSocket (live delivery) + Bunny Storage/CDN (audio files). Rationale: voice
  messages are just audio files + metadata; no call infrastructure required. Cost is
  fixed server cost only — protects the ¥88 model.
- **Real-time voice calls**: Agora Voice Calling. Free tier 10,000 participant-minutes
  per month, then $0.99/1,000 minutes (audio-only). Works directly from the PWA browser.
  Introduce in Phase 2+ behind a feature flag.
- **Twilio: NOT ADOPTED.** PSTN/mobile calls in Japan cost ~$0.185/min — incompatible
  with the ¥88 model. "Phone" on Earth means in-app voice calls between app users only.
  No SMS-based auth (auth is email + passkey per §4.2).
- **Firebase Firestore/Realtime DB: NOT ADOPTED.** All data (incl. messages) lives in the
  existing PostgreSQL backend to keep the MANA ledger, planet data, and messages
  consistent in one transactional store, and to avoid per-read billing at scale.

---

## 8. SECURITY, PRIVACY, COMPLIANCE

- Japanese law touchpoints: Payment Services Act (prepaid instruments — see §3.2),
  Act on Specified Commercial Transactions (Uranus sales pages), Provider Liability
  Limitation Act (UGC moderation + takedown flow), APPI (personal data; voice data is
  sensitive — encrypt at rest, strict access logs), Copyright Act (AI-generated music
  policy: user attests originality; DMCA-like takedown endpoint).
- Rate-limit all generation endpoints; per-user daily MANA spend caps (minors: stricter).
- Full audit log of ledger, payouts, voice-model operations. Admin panel: read-only by default.
- Secrets via environment variables; never commit keys. Sandbox credentials for all external
  APIs are PLACEHOLDER constants the client replaces.
- Content moderation (DECIDED v1.3 — launch blocker): LLM-based pre-publish screening of text
  and media metadata (Gemini moderation), user report flow, takedown SLA, and a strike system.
  Minors use this platform; moderation is NOT optional.
- AI-generated content labeling: all AI-generated tracks/posts carry a visible badge and
  `ai_generated: true` metadata (also required for honest DSP distribution).
- Admin console (build from Phase 1): MANA pricing editor, quota editor, user management/BAN,
  revenue & cost dashboard including per-generation GPU cost telemetry, moderation queue.

---

## 9. BUILD PHASES (MVP slicing)

**Phase 1 — Core skeleton (MVP)**
Earth (profile, wallet UI, subscription via Stripe), MANA two-ledger engine, Moon (Buddy chat,
text + default voice, daily quota), Saturn (text + recorded voice posts). PWA shell with
solar-system nav. Admin console v1 (pricing, quotas, users, moderation queue).

**Phase 2 — Media planets**
Jupiter (square photo + mandatory audio), Venus (square reels via Bunny Stream),
Mercury: TikTok-style discovery feed with Loops, 3-tier Stars and auto playlists
(§2.5), plus the self-hosted song pipeline v1 (no voice cloning yet).

**Phase 3 — Economy planets**
Uranus (Shopify mall + POD), Neptune (HTML5 game store, 92/8 split), LabelGrid
distribution + royalty ingestion, EARNINGS withdrawals via GMO transfer API.

**Phase 4 — Voice identity everywhere**
Voice registration, consent scopes, cloned-voice Saturn posts, Buddy in user's voice,
voice-converted singing (experimental), Mars DRM/premium.

Each phase must ship deployable, behind feature flags. Write tests for the ledger package
first — it is the highest-risk module.

---

## 10. OPEN ITEMS (ask the client; do not guess)
1. ~~Final product name~~ → DECIDED: "Obolo Order".
2. Buddy's canonical character design (default persona of バティ).
3. ~~Subscription billing rail~~ → DECIDED: Stripe card payment primary; virtual-account
   transfer secondary.
4. LINE Music availability via LabelGrid (confirm with LabelGrid).
5. Minors' accounts: parental consent + spend caps policy (legal review).
6. Exact MANA pricing table (values in §3.1 are defaults; final numbers after GPU cost tests).
7. Agora account signup timing (needed when Phase 2 real-time calls start).
8. Final selection of the commercially-licensed instrumental model (benchmark 2-3 candidates
   on quality vs GPU cost; document the license check result).
9. ~~MANA expiry~~ → DECIDED: 1 year from last activity. Must appear in the Terms of Service.
10. obolo records operations: scout threshold tuning (Loops/Stars), audit sampling
    rate, and the label's release terms text (legal review of the artist-facing agreement).
11. Neptune game listing fee 100 MANA (spam gate) — confirm or drop before Phase 3.
