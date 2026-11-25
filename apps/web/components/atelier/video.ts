import {
  MAKE_COST,
  type ManaPrices,
  pickSong,
  spellNamedGroups,
  VIDEO_LINES,
  VIDEO_QUESTIONS,
  videoCost,
  videoEdit,
  videoParams,
  withSong,
  type SpellTag,
  type SpellView,
  type VideoCut,
  type VideoEditResult,
  type VideoParams,
  type VideoSong,
} from '@obolo/shared';
import type { CraftAsk } from './craft';
import type { Work } from './work';

/**
 * R13 (client 2026-11-25, docs/動画の作り方.md): 映像 on the Moon is pictures that move — never a generated film. The
 * chat's small rules for it (AtelierChat does the talking): {bati}'s few questions (what it is for, which of your songs,
 * how the pictures move), the song picked by its name, the spell's price (painted scenes, or your own pictures moved for
 * little), and the words after it is made (a free re-render, or a small spell to paint a scene again).
 */

/** a video as the card plays it: what it is made of, and (the demo) the lyric lines to show */
export type VideoReel = VideoCut & { seconds: number; lines?: { t: number; text: string }[] };

/** the demo's songs (the review page has no saved songs on a server) */
export const DEMO_SONGS: VideoSong[] = [
  { id: '5a1e0000-0000-4000-8000-000000000001', title: '夏の海のポップ' },
  { id: '5a1e0000-0000-4000-8000-000000000002', title: '星のバラード' },
  { id: '5a1e0000-0000-4000-8000-000000000003', title: 'ネオンの帰り道' },
];
/** the demo songs' lyric lines (on the reel's clock) */
const DEMO_LINES: Record<string, string[]> = {
  夏の海のポップ: ['波の音が　きこえる', 'きみと走った　夏の海', 'キラキラ光る　ポップな空', 'ずっと　おぼえていて'],
  星のバラード: ['夜空に　ひとつ', '流れ星を　さがして', 'きみの声が　星になる', 'また　あした'],
  ネオンの帰り道: ['ネオンの街を', 'ひとりで　歩く', 'きらめく　帰り道', 'また　会おう'],
};

let songs: VideoSong[] | null = null;
let chosen: VideoSong | null = null;

/** the member's songs (newest first): the saved songs, or on the review page its own and the demo ones */
export async function videoSongs(fresh = false): Promise<VideoSong[]> {
  if (songs && !fresh) return songs;
  // loaded when used (the chat's small rules stay free of the API client)
  const api = (await import('@/lib/api')).getApi();
  if (api.mode === 'live') {
    const saved = await api.savedSongs().catch(() => []);
    songs = saved.map((s) => ({ id: s.id, title: s.title || '曲' }));
  } else songs = [...DEMO_SONGS];
  return songs;
}
/** the song this talk's video is on (set by the words; else the newest) */
export const videoSong = () => chosen ?? songs?.[0] ?? null;

/** the start of a video talk: the song named in the words, the questions still to ask (none named, none needed) */
export async function videoBegin(content: string, bare: boolean): Promise<CraftAsk | null> {
  const list = await videoSongs(true);
  if (!list.length) return null;
  const said = bare ? '' : content.trim();
  const picked = said ? pickSong(list, said) : null;
  chosen = picked ?? (list.length === 1 ? list[0] : null);
  const named = said ? spellNamedGroups('video', said) : [];
  const left = VIDEO_QUESTIONS.filter((q) => !q.covers.some((g) => named.includes(g)) && !(q.group === 'source' && chosen));
  // the song's name is not a talisman of its own (the song talisman shows it)
  const rest = picked ? said.replace(picked.title, '').trim() : said;
  return { kind: 'video', answers: rest ? [{ said: rest }] : [], left };
}

/** a question's placeholders ({songs}: two or three of the member's song names) */
export function videoQuestionVars(): Record<string, string> {
  const list = songs ?? [];
  return { songs: list.slice(0, 3).map((s) => `「${s.title}」`).join('や') || '「きみの曲」' };
}

/** an answer to {bati}'s question: the song named, when it was the song question */
export function videoAnswered(group: string | undefined, text: string) {
  if (group !== 'source' || !songs?.length) return;
  chosen = pickSong(songs, text) ?? chosen ?? songs[0];
}

/** the spell as it is shown: exactly one song talisman (the one named, else the one before, else the newest) */
export function fixVideoSpell(v: SpellView, said: string): SpellView {
  const list = songs ?? [];
  const named = said ? pickSong(list, said) : null;
  if (named) chosen = named;
  const song = chosen ?? list[0] ?? null;
  // what the song's name already says is not a talisman of its own
  const title = song?.title ?? '';
  const tags = withSong(
    v.tags.filter((t) => !(t.group === 'theme' && title && title.includes(t.ja))),
    song,
  );
  return { ...v, tags };
}

/** what the spell costs: painted scenes (mv), your own pictures moved (mvPictures), a scene painted again (mvRedraw) — the live prices */
export function videoPrice(tags: SpellTag[], redraw?: number[], prices: Readonly<ManaPrices> = MAKE_COST): number {
  return redraw?.length ? prices.mvRedraw : videoCost(tags, prices).mana;
}

/** the words after a video: a free change, a scene to paint again, or nothing (talk / a new spell) */
export function videoChange(w: Work, text: string): VideoEditResult {
  const cut = w.reel;
  if (!cut?.scenes?.length) return null;
  return videoEdit(cut, text);
}

/** what {bati} says once a video (or its change) is made */
export const videoDoneLine = (w: Work) => ((w.versions?.length ?? 0) > 1 ? VIDEO_LINES.edited : VIDEO_LINES.done);

// --- the review page: a canned storyboard (frames + a near layer for the 2.5D look) -----------------------------------

/** the demo's frames: far pictures, a few with a near cut-out that drifts faster (the 2.5D parallax look) */
const FRAMES: { url: string; near?: string; tags: string }[] = [
  { url: '/art/mercury-sea.jpg', near: '/art/ship-pearl.webp', tags: 'the summer sea, a white ship' },
  { url: '/art/cover-ocean.jpg', tags: 'the deep blue sea' },
  { url: '/art/mercury-island.jpg', near: '/art/saturn-island.webp', tags: 'a little island' },
  { url: '/art/cover-dawn.jpg', tags: 'sunrise over the water' },
  { url: '/art/cover-sakura.jpg', tags: 'petals in the wind' },
  { url: '/art/cover-space.jpg', near: '/art/ufo-cosmo.webp', tags: 'stars above the sea' },
  { url: '/art/cover-moon.jpg', tags: 'the moon on the waves' },
  { url: '/art/cover-candy.jpg', tags: 'a sweet pastel sky' },
  { url: '/art/cover-city.jpg', tags: 'the city at night' },
  { url: '/art/cover-forest.jpg', tags: 'a green forest' },
  { url: '/art/cover-rain.jpg', tags: 'rain on the window' },
  { url: '/art/cover-fire.jpg', tags: 'a warm fire' },
];

/** the demo's video for a spell: its settings, its frames (the member's own pictures: the same canned ones), the lines */
export function demoReel(tags: SpellTag[]): VideoReel {
  const params: VideoParams = videoParams(tags);
  const song = tags.find((t) => t.group === 'source')?.ja ?? DEMO_SONGS[0].title;
  const n = params.scenes;
  const seconds = params.length === 'chorus' ? 30 : params.length === 'minute' ? 60 : 90;
  const scenes = Array.from({ length: n }, (_, k) => ({ ...FRAMES[k % FRAMES.length], dur: 1 }));
  const words = DEMO_LINES[song] ?? DEMO_LINES['夏の海のポップ'];
  const lines = words.map((text, i) => ({ t: 0.8 + (i * seconds) / words.length, text }));
  return { params, order: scenes.map((_, k) => k), scenes, seconds, lines };
}

/** the demo's video changed for free (the same frames) */
export function demoEdited(reel: VideoReel, e: { params: VideoParams; order: number[] }): VideoReel {
  const seconds = e.params.length === 'chorus' ? 30 : e.params.length === 'minute' ? 60 : 90;
  const lines = reel.lines?.map((l, i, all) => ({ ...l, t: 0.8 + (i * seconds) / all.length }));
  return { ...reel, params: e.params, order: e.order, seconds, lines };
}

/** the demo's video with scenes painted again (another frame stands in for the new picture) */
export function demoRedrawn(reel: VideoReel, scenes: number[]): VideoReel {
  const out = reel.scenes.map((s, k) => (scenes.includes(k) ? { ...FRAMES[(k + 5) % FRAMES.length], dur: s.dur } : s));
  return { ...reel, scenes: out };
}
