import { KORORIN_VOICE_STYLE, neoVoiceUrl, type Me } from '@obolo/shared';
import { demoStickerArt } from '@/lib/look';
import { ApiError, getApi } from '@/lib/api';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { waitJob } from '@/lib/jobs';
import { makeSong, pickGenre, songFromDesign, type MadeSong } from '@/lib/mercury/compose';
import { dropShelf, LOCAL_KINDS, putShelf } from './shelf';
import { uid, type Work } from './work';

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

/** make one card; `prev` is the card being refined (its words carry over) */
export async function make(kind: AtelierKind, prompt: string, ctx: Ctx, prev?: Work): Promise<Work> {
  if (ctx.test) return makeTest(kind, prompt, ctx, prev);
  const api = getApi();
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
      const r = kind === 'bati' ? await api.batiRestyle(prompt) : await api.refineLook(prev?.kind === 'look' ? (prev.pick ?? null) : null, prompt, true);
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
      const style = prev?.kind === 'art' ? [prev.ref?.style, prompt].filter(Boolean).join('、').slice(0, 80) : undefined;
      const words = (prev?.kind === 'art' ? prev.prompt : prompt).slice(0, 60);
      const r = await api.stickerArt(words, style);
      const w: Work = { ...base, prompt: words, image: r.url, ref: { style } };
      // into Bluena's Jupiter folder (the roots): a root is a photo, so the picture goes up once as one
      try {
        const blob = await fetch(r.url).then((x) => (x.ok ? x.blob() : Promise.reject(new Error(String(x.status)))));
        const ph = await api.uploadPhoto(blob);
        const root = await api.addJupiterRoot({ mediaId: ph.id });
        return done({ ...w, ref: { ...w.ref, rootId: root.id } });
      } catch {
        return { ...w, note: 'ブルーナに、うまくしまえなかった' };
      }
    }
    case 'song': {
      const words = prev?.kind === 'song' ? `${prev.prompt}。${prompt}` : prompt;
      const artist = ctx.me?.displayName ?? '';
      if (!ctx.live) {
        await new Promise((r) => setTimeout(r, 1500));
        const s = makeSong(words, pickGenre(words), artist);
        ctx.mercury.bury(s);
        return done({ ...base, prompt: words, title: s.title, audio: 'synth:', ref: { demoSong: s } });
      }
      const d = await api.composeDesign({ partner: ctx.partner.name, isBati: ctx.partner.isBati, genre: 'auto', history: [{ role: 'user', text: words.slice(0, 400) }] });
      const sketch = songFromDesign(d, artist);
      const job = await api.composeFullSong({
        title: d.title.slice(0, 40),
        genre: d.genre,
        mood: d.mood.slice(0, 30),
        bpm: d.bpm,
        keyRoot: d.keyRoot,
        scale: d.scale,
        sections: d.sections.map((s) => ({ name: s.name, lines: s.lines.map((l) => ({ text: l.text.slice(0, 40), beats: l.notes.reduce((a, n) => a + n.beats, 0) })) })),
        instrumentalPrompt: d.instrumentalPrompt,
        progression: d.progression,
        seconds: Math.max(10, Math.min(180, d.seconds)),
      });
      const song = (await waitJob(job)).result!.song!;
      await api.composeSongSave(song.id).catch(() => undefined);
      return done({ ...base, prompt: words, title: song.title || sketch.title, text: d.comment, audio: song.url, ref: { songId: song.id } });
    }
    case 'video': {
      if (!ctx.live) return { ...base, status: 'failed', note: '映像は、ここ（おためし）では作れないんだ' };
      const words = prev?.kind === 'video' ? `${prev.prompt}。${prompt}` : prompt;
      const songId = ctx.lastSongId ?? (await api.savedSongs())[0]?.id;
      if (!songId) return { ...base, status: 'failed', note: '映像は曲にのせて作るよ。先に曲を作ろう' };
      const mv = await api.mvCreate(songId);
      const p = (await waitJob(await api.mvStory(mv.id, words))).result!.mv!;
      return done({ ...base, prompt: words, title: `${p.songTitle}（MV）`.slice(0, 40), text: p.note ?? undefined, video: p.videoUrl ?? undefined, poster: p.posterUrl, ref: { backstageId: p.backstageId ?? undefined } });
    }
    case 'radio':
      // a recorded show: the card records it (your songs + your voice), then it is kept
      return { ...base, status: 'record', title: (prompt || `${ctx.me?.displayName ?? ''}のラジオ`).slice(0, 40) };
  }
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
      return { ...base, prompt: words, title: 'MV（おためし）', text: '映像は、ここ（おためし）では作れないから、絵だけ置いておくね', poster: demoStickerArt(words.slice(0, 60)) };
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
  else if (w.kind === 'radio' && r.showId) await api.publishRadioShow(r.showId, true);
  else throw new ApiError(400, 'NOT_KEPT', 'not kept');
  if (LOCAL_KINDS.includes(w.kind) || r.demoSong) putShelf({ ...w, flown: true });
}

/** thrown away from Bluena */
export async function discard(w: Work): Promise<void> {
  const api = getApi();
  const r = w.ref ?? {};
  if (w.kind === 'voice' && r.postId) await api.deleteSaturnPost(r.postId);
  else if (w.kind === 'art' && r.rootId) await api.removeJupiterRoot(r.rootId);
  else if (w.kind === 'video' && r.backstageId) await api.removeMarsVideo(r.backstageId);
  else if (w.kind === 'radio' && r.showId) await api.removeRadioShow(r.showId);
  dropShelf(w.id);
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
  return 'うまくいかなかった。もう一回やってみよう';
}
