import { CRAFT_LINES, KIND_HOME_PLANET, spellFrom, KORORIN_VOICE_STYLE, neoVoiceUrl, withTarget, lyricsLines, lyricsSections, type JobView, type MakeConfirm, type Me, type RefineTarget, type VideoParams, type WorkVersion, VIDEO_LINES, videoParams } from '@obolo/shared';
import { demoStickerArt } from '@/lib/look';
import { ApiError, getApi } from '@/lib/api';
import type { AtelierKind } from '@/lib/atelier/unlock';
import type { Watched } from '@/lib/atelier/jobs';
import { workMarkRef } from '@/lib/finds/works';
import { makeSong, pickGenre, songFromDesign, type MadeSong } from '@/lib/mercury/compose';
import { dropShelf, LOCAL_KINDS, patchTalkWork, putShelf } from './shelf';
import { stack, uid, type Version, type Work } from './work';
import { bookCoverUrl, bookSub } from './BookRead';
import { spellKindOf, type Plan } from './plan';
import { demoEdited, demoRedrawn, demoReel, type VideoReel } from './video';

/**
 * The generation calls behind the atelier's cards (M-R210): the same ones the old per-kind screens used — the look's
 * magic (refineLook), {bati}'s restyle, the kororin (a room-only Saturn post), sticker art (→ a Jupiter root), the song
 * (design → sung song → saved), the MV (Mars studio → backstage) and the recorded radio show. Each result is put into
 * Bluena as it comes (M-R211). The review demo has no song / MV server: a song is the offline sketch, an MV says so.
 */
export type Ctx = {
  live: boolean;
  me: Me | null;
  partner: { name: string; isBati: boolean };
  /** the demo's Mercury store (offline songs) */
  mercury: { bury: (s: MadeSong) => void; release: (id: string) => void };
  /** the newest song made in this talk (an MV is made on it) */
  lastSongId?: string;
  /** the review page's story steps: stand-in works made in this browser (no AI, no account, nothing saved or flown) */
  test?: boolean;
};

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), ms))]);

/**
 * M-R253 §4: a slow kind starts a job and the card comes back at once, still making (`started`): the chat says when to
 * come back, the card counts down, and the app's job host finishes it (finishJob) wherever you are.
 */
export type Started = { job: JobView; what: Watched['what']; words: string; extra?: Watched['extra'] };
export type Made = Work & { started?: Started };
/** §2 / §3: the part pointed at, and the works used as material */
export type MakeOpts = {
  target?: RefineTarget;
  materials?: Work[];
  /** R11: the member's yes to the plan and its price (a paid making is asked with it, never without) */
  confirm?: MakeConfirm;
  /** R11: the plan said yes to (its genre / mood go into the making) */
  plan?: Plan;
  /** R13: a video's free change (how its pictures move): re-rendered from the kept pictures, no mana */
  edit?: { params: VideoParams; order: number[] };
  /** R13: a video's scenes to paint again (in its own order), from the small spell said yes to */
  redraw?: number[];
};

/** the review page's stand-in times (M-R253 §4): a 2-minute one (said up front) and a 20-second one (waited in place) */
export const DEMO_SECONDS: Partial<Record<AtelierKind | 'videoEdit', number>> = { song: 120, video: 120, art: 20, videoEdit: 12 };

/** §3: what a material gives the next work — its words (a kororin's, a song's title), its picture, its song */
export function materialWords(ms: Work[] = []): string {
  return ms
    .map((m) => (m.kind === 'voice' ? m.text || m.title || '' : ''))
    .filter(Boolean)
    .join('。')
    .slice(0, 200);
}

/** make one card; `prev` is the card being refined (its words carry over) */
export async function make(kind: AtelierKind, prompt: string, ctx: Ctx, prev?: Work, opts: MakeOpts = {}): Promise<Made> {
  if (ctx.test) return makeTest(kind, withTarget(prompt, opts.target), ctx, prev);
  const mats = opts.materials ?? [];
  const lyric = materialWords(mats);
  const said = withTarget(prompt, opts.target);
  const api = getApi();
  // R11: the yes and the spell it was given to (the server makes the work from exactly those tags)
  const spell = opts.confirm ? opts.plan?.tags : undefined;
  const sk = spellKindOf(kind);
  const paid = { confirm: opts.confirm, spell };
  const lyrics = kind === 'song' && opts.confirm ? opts.plan?.lyrics : undefined;
  const pay = (m: 'song' | 'jacketArt' | 'mv' | 'mvPictures' | 'mvRedraw') => (opts.confirm ? { kind: m, confirm: opts.confirm, spell: spell && sk ? { kind: sk, tags: spell, ...(lyrics ? { lyrics } : {}) } : undefined } : undefined);
  const base: Work = { id: uid(), kind, prompt, status: 'ready' };
  const done = (w: Work): Work => {
    const out = { ...w, saved: true };
    if (LOCAL_KINDS.includes(kind) || (kind === 'song' && !ctx.live)) putShelf(out);
    return out;
  };
  switch (kind) {
    case 'look':
    case 'bati': {
      // the magic goes on from the one picked, so the look can be changed step by step
      const r = kind === 'bati' ? await api.batiRestyle(prompt, undefined, paid) : await api.refineLook(prev?.kind === 'look' ? (prev.pick ?? null) : null, prompt, true, paid);
      if (!r.candidates.length) throw new Error('none');
      return done({ ...base, candidates: r.candidates, pick: r.candidates[0].id, image: r.candidates[0].url });
    }
    case 'lookup': {
      const r = await withTimeout(api.buddyChat(prompt, 'ja'), 25_000);
      const text = r.reply.text;
      const noPic = !!r.kind && r.kind !== 'normal';
      const pic = noPic ? null : await withTimeout(api.buddyPicture(prompt, text), 10_000).then((x) => x.picture).catch(() => null);
      return done({ ...base, text, image: pic?.url, source: pic ? { title: pic.title, source: pic.source, pageUrl: pic.pageUrl } : undefined });
    }
    case 'image': {
      const pic = (await withTimeout(api.buddyPicture(prompt), 15_000)).picture;
      if (!pic) return { ...base, status: 'failed', note: 'ぴったりの絵は、見つからなかった……' };
      return done({ ...base, image: pic.url, title: pic.title, source: { title: pic.title, source: pic.source, pageUrl: pic.pageUrl } });
    }
    case 'voice': {
      const post = await api.createSaturnPost({ text: prompt.slice(0, 140), voiceStyle: KORORIN_VOICE_STYLE, readBy: 'bati', room: true });
      return done({ ...base, text: post.text, audio: post.voiceUrl, ref: { postId: post.id } });
    }
    case 'art': {
      const style = prev?.kind === 'art' ? [prev.ref?.style, said].filter(Boolean).join('、').slice(0, 80) : undefined;
      const words = (prev?.kind === 'art' ? prev.prompt : [lyric, prompt].filter(Boolean).join('。')).slice(0, 60);
      // the review page: a 20-second stand-in job (waited in place, no time said)
      if (!ctx.live) {
        const job = await api.demoJob({ seconds: DEMO_SECONDS.art!, failTimes: 0, pay: pay('jacketArt') });
        return { ...base, prompt: words, status: 'making', ref: { style }, started: { job, what: 'art', words: `${words}${style ?? ''}` } };
      }
      const r = await api.stickerArt(words, style, paid);
      const w: Work = { ...base, prompt: words, image: r.url, ref: { style } };
      // into Bluena's Jupiter folder (the roots): a root is a photo, so the picture goes up once as one
      try {
        const blob = await fetch(r.url).then((x) => (x.ok ? x.blob() : Promise.reject(new Error(String(x.status)))));
        const ph = await api.uploadPhoto(blob);
        const root = await api.addJupiterRoot({ mediaId: ph.id });
        return done({ ...w, ref: { ...w.ref, rootId: root.id, mediaId: ph.id } });
      } catch {
        return { ...w, note: 'ブルーナに、うまくしまえなかった' };
      }
    }
    case 'song': {
      // §3: a kororin's words become the lyrics
      const asked = lyric ? `${said}。歌詞は「${lyric}」` : said;
      const words = prev?.kind === 'song' ? `${prev.prompt}。${asked}` : asked;
      if (!ctx.live) {
        // the review page: a 2-minute stand-in job, then the offline sketch (finishJob)
        const job = await api.demoJob({ seconds: DEMO_SECONDS.song!, failTimes: 0, pay: pay('song') });
        return { ...base, prompt: words, status: 'making', ...(lyrics ? { lyrics, title: lyrics.title } : {}), started: { job, what: 'song', words, extra: { ...(opts.plan?.genre ? { genre: opts.plan.genre } : {}), ...(lyrics?.title ? { songTitle: lyrics.title } : {}) } } };
      }
      // R13: the design (tempo, key, chords) goes with the lyrics said yes to; the song is sung from exactly those
      const sung = lyrics ? `\n歌詞：\n${lyricsLines(lyrics).map((l) => l.text).join('\n')}` : '';
      const d = await api.composeDesign({ partner: ctx.partner.name, isBati: ctx.partner.isBati, genre: opts.plan?.genre ?? 'auto', history: [{ role: 'user', text: `${words.slice(0, 300)}${sung}`.slice(0, 1400) }] });
      const sketch = songFromDesign(d, ctx.me?.displayName ?? '');
      const job = await api.composeFullSong({
        title: (lyrics?.title || d.title).slice(0, 40),
        genre: d.genre,
        mood: d.mood.slice(0, 30),
        bpm: d.bpm,
        keyRoot: d.keyRoot,
        scale: d.scale,
        sections: lyrics ? lyricsSections(lyrics) : d.sections.map((s) => ({ name: s.name, lines: s.lines.map((l) => ({ text: l.text.slice(0, 40), beats: l.notes.reduce((a, n) => a + n.beats, 0) })) })),
        ...(lyrics ? { lyrics } : {}),
        instrumentalPrompt: d.instrumentalPrompt,
        progression: d.progression,
        seconds: Math.max(10, Math.min(180, d.seconds)),
        from: 'atelier',
        ...(opts.confirm ? { confirm: opts.confirm, ...(spell ? { spell } : {}) } : {}),
      });
      const title = lyrics?.title || sketch.title;
      return { ...base, prompt: words, status: 'making', title, ...(lyrics ? { lyrics } : {}), started: { job, what: 'song', words, extra: { comment: d.comment, songTitle: title } } };
    }
    case 'video': {
      // R13 (docs/動画の作り方.md): pictures that move — painted scenes or your own pictures, never a generated film
      const words = prev?.kind === 'video' ? `${prev.prompt}。${said}` : said;
      const mvId = prev?.ref?.mvId;
      const home = KIND_HOME_PLANET.video;
      // a free change of how it moves (no mana): the same pictures, re-rendered
      if (opts.edit && prev?.reel) {
        if (!ctx.live) {
          const job = await api.demoJob({ seconds: DEMO_SECONDS.videoEdit!, failTimes: 0 });
          return { ...base, prompt: prev.prompt, status: 'making', started: { job, what: 'video', words: prev.prompt, extra: { reel: demoEdited(prev.reel as VideoReel, opts.edit), songTitle: prev.title?.replace(/（MV）$/, '') } } };
        }
        if (!mvId) throw new ApiError(400, 'NO_CUT', 'not kept');
        const job = await api.mvEdit(mvId, { params: opts.edit.params, order: opts.edit.order, from: 'atelier' });
        return { ...base, prompt: prev.prompt, status: 'making', ref: prev.ref, spell: prev.spell, home, started: { job, what: 'video', words: prev.prompt } };
      }
      const tags = opts.plan?.tags;
      // scenes painted again from the small spell said yes to
      if (opts.redraw?.length && prev?.reel && tags && opts.confirm) {
        if (!ctx.live) {
          const job = await api.demoJob({ seconds: DEMO_SECONDS.video!, failTimes: 0, pay: pay('mvRedraw') });
          return { ...base, prompt: prev.prompt, status: 'making', started: { job, what: 'video', words: prev.prompt, extra: { reel: demoRedrawn(prev.reel as VideoReel, opts.redraw), songTitle: prev.title?.replace(/（MV）$/, '') } } };
        }
        if (!mvId) throw new ApiError(400, 'NO_CUT', 'not kept');
        const job = await api.mvRedraw(mvId, { scenes: opts.redraw, spell: tags, confirm: opts.confirm, from: 'atelier' });
        return { ...base, prompt: prev.prompt, status: 'making', ref: prev.ref, spell: prev.spell, home, started: { job, what: 'video', words: prev.prompt } };
      }
      const params = tags ? videoParams(tags) : null;
      const own = params?.purpose === 'pictures';
      // §3: a picture made before is a picture of it; a song made before is what it plays on
      const art = mats.find((m) => m.kind === 'art' && m.image);
      const songMat = mats.find((m) => m.kind === 'song');
      const songName = tags?.find((t) => t.group === 'source')?.ja ?? songMat?.title;
      if (!ctx.live) {
        // the review page: a stand-in job, then a canned storyboard moved in the card
        const job = await api.demoJob({ seconds: DEMO_SECONDS.video!, failTimes: 0, pay: pay(own ? 'mvPictures' : 'mv') });
        return { ...base, prompt: words, status: 'making', spell: tags, home, started: { job, what: 'video', words, extra: { still: art?.image ?? null, songTitle: songName, reel: tags ? demoReel(tags) : undefined } } };
      }
      const songId = params?.songId ?? songMat?.ref?.songId ?? ctx.lastSongId ?? (await api.savedSongs())[0]?.id;
      if (!songId) return { ...base, status: 'failed', note: VIDEO_LINES.noSong };
      const mv = await api.mvCreate(songId);
      // your own pictures: the works brought in (else the server takes the newest in Bluena)
      for (const m of (own ? mats.filter((x) => x.image) : art ? [art] : []).slice(0, 12)) {
        const mediaId = m.ref?.mediaId ?? (await fetch(m.image!).then((x) => x.blob()).then((b) => api.uploadPhoto(b)).then((x) => x.id).catch(() => null));
        if (mediaId) await api.mvAddMaterial(mv.id, { mediaId, kind: 'photo' }).catch(() => undefined);
      }
      const job = own && tags && opts.confirm ? await api.mvPictures(mv.id, { spell: tags, confirm: opts.confirm, from: 'atelier' }) : await api.mvStory(mv.id, words, 'atelier', paid);
      return { ...base, prompt: words, status: 'making', ref: { mvId: mv.id }, spell: tags, home, started: { job, what: 'video', words } };
    }
    case 'radio':
      // a recorded show: the card records it (your songs + your voice), then it is kept
      return { ...base, status: 'record', title: (prompt || `${ctx.me?.displayName ?? ''}のラジオ`).slice(0, 40) };
    case 'novel': {
      // client 2026-11-25: a new book from its spell, or the next chapter (its own small spell) — free, written at once
      const bookId = prev?.kind === 'novel' ? prev.ref?.bookId : undefined;
      const tags = opts.plan?.tags ?? spellFrom(bookId ? 'chapter' : 'novel', said);
      const b = await withTimeout(api.novelChapter({ bookId, tags, said: said.slice(0, 200) }), 120_000);
      return { ...base, prompt: said, title: b.title, book: b, image: b.cover ?? bookCoverUrl(b.title, bookSub(b)), ref: { bookId: b.id }, spell: bookId ? prev?.spell : tags, home: KIND_HOME_PLANET.novel, saved: true };
    }
    case 'game': {
      // client 2026-11-25: built in the background with the yes (12, then 3 a tweak); the job host finishes the card
      const tags = opts.plan?.tags ?? spellFrom('game', said);
      if (!opts.confirm) throw new ApiError(428, 'CONFIRM_REQUIRED', 'まだ、OKをもらってないよ。');
      const job = await api.gameBuild({ gameId: prev?.kind === 'game' ? prev.ref?.gameId : undefined, tags, said: said.slice(0, 200), confirm: opts.confirm });
      return { ...base, prompt: said, status: 'making', ref: prev?.ref, spell: tags, home: KIND_HOME_PLANET.game, started: { job, what: 'game', words: said } };
    }
  }
}

/** M-R253 §4: a watched job is done — the card it was waiting for, finished (the job host calls this, wherever you are) */
export async function finishJob(w: Watched, job: JobView, live = getApi().mode === 'live'): Promise<Work> {
  const c = w.card;
  const base: Work = { ...c, status: 'ready', job: undefined };
  let made: Work;
  if (w.what === 'song') {
    if (live && job.result?.song) {
      const song = job.result.song;
      await getApi().composeSongSave(song.id).catch(() => undefined);
      made = { ...base, title: song.title || w.extra?.songTitle || c.title, text: w.extra?.comment, audio: song.url, ref: { songId: song.id } };
    } else {
      const s = makeSong(w.words, (w.extra?.genre as ReturnType<typeof pickGenre> | undefined) ?? pickGenre(w.words), '');
      buryDemo(s);
      made = { ...base, title: w.extra?.songTitle || s.title, audio: 'synth:', ref: { demoSong: s } };
    }
  } else if (w.what === 'video') {
    const p = job.result?.mv;
    // R13: the video and what it is made of (its later words change how it moves, for free)
    const reel = p?.cut ? ({ ...p.cut, seconds: p.seconds ?? 30 } as VideoReel) : w.extra?.reel;
    made = p
      ? { ...base, title: `${p.songTitle}（MV）`.slice(0, 40), text: p.note ?? undefined, video: p.videoUrl ?? undefined, poster: p.posterUrl, image: undefined, note: undefined, reel, ref: { backstageId: p.backstageId ?? undefined, mvId: p.id }, home: KIND_HOME_PLANET.video }
      : reel
        ? { ...base, title: `${w.extra?.songTitle ?? 'MV'}（MV）`.slice(0, 40), reel, poster: reel.scenes[reel.order[0] ?? 0]?.url ?? null, image: undefined, video: undefined, note: undefined, home: KIND_HOME_PLANET.video }
        : { ...base, title: `${w.extra?.songTitle ?? 'MV'}（MV・おためし）`.slice(0, 40), image: w.extra?.still ?? demoStickerArt(w.words.slice(0, 60)), note: 'おためしでは映像は作らず、場面の絵を置いています' };
  } else if (w.what === 'art') {
    // the review's stand-in picture, put into Bluena's Jupiter folder as the real one is
    const image = demoStickerArt(w.words);
    made = { ...base, image };
    try {
      const api = getApi();
      const ph = await api.uploadPhoto(await fetch(image).then((x) => x.blob()));
      const root = await api.addJupiterRoot({ mediaId: ph.id });
      made = { ...made, ref: { ...made.ref, rootId: root.id, mediaId: ph.id } };
    } catch {
      /* the card only */
    }
  } else if (w.what === 'game') {
    const g = job.result?.game ?? (c.ref?.gameId ? await getApi().game(c.ref.gameId) : null);
    if (!g) throw new Error('no game');
    made = { ...base, title: g.title, game: g, ref: { gameId: g.id }, spell: g.tags, home: KIND_HOME_PLANET.game };
  } else made = base;
  const out = await keep(c.versions?.length ? c : undefined, { ...made, saved: true }, c.target);
  patchTalkWork(w.talkId, out);
  return out;
}

/** the review demo's Mercury soil (the page's hook keeps it in this key) */
function buryDemo(s: MadeSong) {
  try {
    const k = 'obolo.mercury.v1';
    const st = JSON.parse(localStorage.getItem(k) ?? 'null') ?? { soil: [], released: [], stars: {} };
    localStorage.setItem(k, JSON.stringify({ ...st, soil: [s, ...(st.soil ?? [])] }));
  } catch {
    /* kept in Bluena's shelf only */
  }
}

const short = (x?: string | null) => (x && x.length <= 1900 ? x : null);
/** a try as the server keeps it (where its thing is kept, its words and pictures) */
export function serverVersion(v: Version | Work): WorkVersion {
  const ref = workMarkRef({ ...(v as Work), kind: (v as Work).kind ?? 'art', id: (v as Work).id ?? 'x', status: 'ready' });
  return { ref: ref.kind === 'local' ? null : ref, prompt: (v.prompt ?? '').slice(0, 600), title: v.title?.slice(0, 120) ?? null, text: v.text?.slice(0, 2000) ?? null, image: short(v.image), audio: short(v.audio), video: short(v.video), poster: short(v.poster), target: (v as Version).target, at: (v as Version).at ?? new Date().toISOString() };
}

const PLANET_KINDS: AtelierKind[] = ['voice', 'art', 'song', 'video', 'radio'];

/**
 * M-R253 §1: a finished try goes on top of its work (the face) — a redo stays the same card — and the server keeps how
 * the tries belong together (Bluena lists the face only). Device kinds are kept on the shelf with their tries.
 */
export async function keep(base: Work | undefined, made: Work, target?: RefineTarget): Promise<Work> {
  // client 2026-11-25: a book grows chapter by chapter and a game keeps its versions on the server: one face, no tries
  if (made.kind === 'novel' || made.kind === 'game') return { ...made, id: base?.id ?? made.id, origin: base?.origin ?? made.origin, versions: undefined, active: undefined, job: undefined, target: undefined, saved: true };
  let w = stack(base, made, target);
  if (w.status !== 'ready' || w.ref?.test) return w;
  if (PLANET_KINDS.includes(w.kind)) {
    const v = { ...serverVersion({ ...w, ...w.versions![w.active!] } as Work), at: w.versions![w.active!].at };
    try {
      const api = getApi();
      const r = w.atelierId ? await api.addMoonVersion(w.atelierId, { version: v }) : await api.createMoonWork({ kind: w.kind, version: v, origin: w.origin, materials: w.materials ?? [] });
      w = { ...w, atelierId: r.id };
    } catch {
      /* the try is still in its planet's store */
    }
  }
  if (LOCAL_KINDS.includes(w.kind) || w.ref?.demoSong) putShelf(w);
  return w;
}

/** §1: the face chosen by looking (kept on the server; the device's shelf for device kinds) */
export function keepFace(w: Work) {
  if (w.atelierId && w.active != null) void getApi().setMoonFace(w.atelierId, w.active).catch(() => undefined);
  if (LOCAL_KINDS.includes(w.kind) || w.ref?.demoSong) putShelf(w);
}

/** §1: a try thrown away inside the work (its thing goes from its store too) */
export async function dropTry(w: Work, i: number): Promise<Work> {
  const vs = w.versions ?? [];
  if (vs.length <= 1) return w;
  const gone = vs[i];
  if (w.atelierId) await getApi().dropMoonVersion(w.atelierId, i).catch(() => undefined);
  await discardThing({ ...w, ...gone } as Work).catch(() => undefined);
  const rest = vs.filter((_, k) => k !== i);
  const active = Math.min(rest.length - 1, i <= (w.active ?? 0) ? Math.max(0, (w.active ?? 0) - 1) : (w.active ?? 0));
  const out = { ...w, ...rest[active], versions: rest, active } as Work;
  if (LOCAL_KINDS.includes(w.kind) || w.ref?.demoSong) putShelf(out);
  return out;
}

/** the review page's stand-in for a card (story steps not played for real): made here, kept in no account */
async function makeTest(kind: AtelierKind, prompt: string, ctx: Ctx, prev?: Work): Promise<Work> {
  const base: Work = { id: uid(), kind, prompt, status: 'ready', saved: true, ref: { test: true } };
  await new Promise((r) => setTimeout(r, 1200));
  switch (kind) {
    case 'voice':
      return { ...base, text: prompt.slice(0, 140), audio: neoVoiceUrl(KORORIN_VOICE_STYLE, null, prompt.slice(0, 140)) };
    case 'art': {
      const words = (prev?.kind === 'art' ? prev.prompt : prompt).slice(0, 60);
      return { ...base, prompt: words, image: demoStickerArt(words) };
    }
    case 'song': {
      const words = prev?.kind === 'song' ? `${prev.prompt}。${prompt}` : prompt;
      const s = makeSong(words, pickGenre(words), ctx.me?.displayName ?? '');
      return { ...base, prompt: words, title: s.title, audio: 'synth:', ref: { test: true, demoSong: s } };
    }
    case 'video': {
      const words = prev?.kind === 'video' ? `${prev.prompt}。${prompt}` : prompt;
      return { ...base, prompt: words, title: 'MV（おためし）', image: demoStickerArt(words.slice(0, 60)), note: 'おためしでは映像は作らず、絵だけを置いています' };
    }
    case 'radio':
      return { ...base, status: 'record', saved: false, title: (prompt || `${ctx.me?.displayName ?? ''}のラジオ`).slice(0, 40) };
    default:
      return { ...base, status: 'failed', saved: false, note: 'これは、ここ（おためし）では作れないんだ' };
  }
}

/** a recorded radio take → a private show in Bluena's Venus folder (the name goes through the text check) */
export async function keepShow(w: Work, blob: Blob, seconds: number): Promise<Work> {
  // the review page: the take stays in this browser
  if (w.ref?.test) return { ...w, status: 'ready', audio: URL.createObjectURL(blob), title: w.title || '名前のない番組', saved: true };
  const api = getApi();
  const up = await api.uploadShow(blob);
  const show = await api.createRadioShow({ mediaId: up.id, title: w.title || '名前のない番組', thumbUrl: null, loop: 'drift', seconds: Math.round(seconds), cues: [] });
  return { ...w, status: 'ready', audio: show.audioUrl, title: show.title, ref: { ...w.ref, showId: show.id }, saved: true };
}

/** 〔星へ飛ばす〕: the item kept in Bluena goes out to its planet for 88 hours */
export async function fly(w: Work, ctx: Ctx): Promise<void> {
  const api = getApi();
  const r = w.ref ?? {};
  // the review page: flown in the story only
  if (r.test) return;
  if (w.kind === 'voice' && r.postId) await api.publishSaturnPost(r.postId);
  else if (w.kind === 'art' && r.rootId) await api.createJupiterPost({ rootId: r.rootId, text: '', filter: 'none', branch: 0 });
  else if (w.kind === 'song' && r.songId) await api.createPlanetPost('mercury', { sourceId: r.songId, title: w.title ?? '', text: '' });
  else if (w.kind === 'song' && r.demoSong) ctx.mercury.release(r.demoSong.id);
  else if (w.kind === 'video' && r.backstageId) await api.createPlanetPost('mars', { sourceId: r.backstageId, title: w.title ?? '', text: '' });
  else if (w.kind === 'video' && w.reel && api.mode !== 'live') {
    // R13: the review page's video (canned frames, no server): flown in the talk only
  } else if (w.kind === 'radio' && r.showId) await api.publishRadioShow(r.showId, true);
  else throw new ApiError(400, 'NOT_KEPT', 'not kept');
  if (LOCAL_KINDS.includes(w.kind) || r.demoSong) putShelf({ ...w, flown: true });
}

/** thrown away from Bluena (every try inside it) */
export async function discard(w: Work): Promise<void> {
  for (const v of w.versions?.length ? w.versions : [w]) await discardThing({ ...w, ...v } as Work);
  dropShelf(w.id);
}

async function discardThing(w: Work): Promise<void> {
  const api = getApi();
  const r = w.ref ?? {};
  if (w.kind === 'voice' && r.postId) await api.deleteSaturnPost(r.postId);
  else if (w.kind === 'art' && r.rootId) await api.removeJupiterRoot(r.rootId);
  else if (w.kind === 'video' && r.backstageId) await api.removeMarsVideo(r.backstageId);
  else if (w.kind === 'radio' && r.showId) await api.removeRadioShow(r.showId);
}

/** wear it: your look / {bati}'s dress-up */
export async function wear(w: Work): Promise<Me | null> {
  if (!w.pick) return null;
  return w.kind === 'bati' ? getApi().chooseBatiRestyle(w.pick) : getApi().chooseLook(w.pick);
}

/** {bati}'s word for an error (no codes on screen) */
export function failLine(e: unknown): string {
  const code = e instanceof ApiError ? e.code : '';
  if (code === 'MODERATION') return 'その言葉は使えないみたい。別の言い方にしてみて';
  if (code === 'RESTYLE_TRIES' || code === 'LOOK_REFINES' || code === 'STICKER_TRIES') return '今日の魔法は、ここまで。また明日、つづきをしよう';
  if (code === 'NO_MANA' && e instanceof ApiError) return e.message;
  if (code === 'STORAGE_FULL') return 'ブルーナが、いっぱいみたい';
  if (code === 'DEMO') return 'これは、ここ（おためし）では作れないんだ';
  if (code === 'CHAPTER_LIMIT') return CRAFT_LINES.chapterLimit;
  if (code === 'BOOK_FULL') return CRAFT_LINES.bookFull;
  if (code === 'NOVEL_FAILED' || code === 'VALIDATION') return CRAFT_LINES.failed;
  return 'うまくいかなかった。もう一回やってみよう';
}
