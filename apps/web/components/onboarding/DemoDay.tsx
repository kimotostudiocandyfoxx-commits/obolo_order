'use client';

import { useState } from 'react';
import { setDemoMode } from '@/lib/onboarding/demoMode';
import { StoryPlayer } from '@/components/onboarding/StoryPlayer';
import { knownSealsOn, solvedSealsOn, stampsOn } from '@/components/onboarding/StoryExtras';
import { demoBati, demoStickerArt, demoFromReference, demoNeoLooks, demoRefine } from '@/lib/look';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { realLessonApi, type LessonApi } from '@/lib/onboarding/lessonApi';
import type { Made } from '@/lib/onboarding/made';
import type { Step, StoryVars } from '@/lib/onboarding/script';

/**
 * One day of the first journey with no server (the review pages and the testers' link): the look and
 * Bati are drawn in the browser, the song is the opening tune, the MV a story clip, the payment a demo.
 * `live`: logged in to the real API — the look and Bati are painted for real and saved to the account.
 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const fakeLessonApi: LessonApi = {
  stickerArt: async (text) => {
    await wait(1500);
    return { url: await demoStickerArt(text) };
  },
  uploadPhoto: async (blob) => ({ url: URL.createObjectURL(blob) }),
  kororinDesigns: async () => {
    await wait(1500);
    return ['salmon', 'green', 'purple', 'gray'].map((n) => ({ id: n, url: `/puni-test/${n}.png` }));
  },
  chooseKororin: async () => undefined,
  // the previews have nobody to deliver to; the demo API keeps it in this browser
  befriendInviter: async () => void (await getApi().befriendInviter().catch(() => null)),
  deliver: async (b) => void (await getApi().deliver(b).catch(() => null)),
  lyrics: async (words) => {
    await wait(1500);
    const line = (text: string) => ({ text, kana: text, notes: [] });
    return {
      title: words.slice(0, 12),
      emoji: '🎵',
      genre: 'pop',
      mood: 'bright',
      bpm: 112,
      keyRoot: 0,
      scale: 'major',
      progression: [0, 4, 5, 3],
      chords: ['C', 'G', 'Am', 'F'],
      sections: [
        {
          name: 'verse',
          lines: [line(words), line('きょうも、空を見上げてた')],
        },
        {
          name: 'chorus',
          lines: [line('ころがれ、ころがれ、星まで'), line(words)],
        },
      ],
      instrumentalPrompt: '',
      comment: 'できたよ！',
      seconds: 60,
    };
  },
  sing: async (d, onStage) => {
    onStage?.('singing');
    await wait(3000);
    onStage?.(null);
    return {
      id: 'preview-song',
      title: d.title,
      url: '/onboarding/bgm-opening.m4a',
    };
  },
  saveSong: async () => {},
  mv: async (song, _wish, lyrics) => {
    await wait(4000);
    return {
      id: 'preview-mv',
      url: '/onboarding/m3-3.mp4',
      poster: null,
      title: lyrics ? `${song.title}（歌詞つき）` : song.title,
    };
  },
};

/** What the earlier days made, for previewing a day on its own. */
export function previewMade(day: number): Made {
  const kororins = ['きょうの空、ひろかった', 'ラーメンの湯気がきれい', 'くしゃみ三回'];
  const stickers = [
    { text: kororins[0], url: null },
    { text: kororins[1], url: null },
  ];
  return {
    kororins: day >= 4 ? kororins : undefined,
    stickers: day >= 5 ? stickers : undefined,
    song:
      day >= 6
        ? {
            id: 'preview-song',
            title: 'きょうの空',
            url: '/onboarding/bgm-opening.m4a',
            jacket: null,
            words: kororins[0],
          }
        : undefined,
    mv:
      day >= 7
        ? {
            id: 'preview-mv',
            url: '/onboarding/m3-3.mp4',
            poster: null,
            title: 'きょうの空',
          }
        : undefined,
  };
}

export function DemoDay({
  day,
  steps,
  start = 0,
  vars,
  live = false,
  timeUp = false,
  onTimeUp = () => undefined,
  onEnd,
  onName,
  onNeoForm,
  onNeoName,
  onBatiFood,
  onBatiName,
  onBati,
  showGate = false,
}: {
  day: number;
  steps: Step[];
  start?: number;
  vars: StoryVars;
  live?: boolean;
  timeUp?: boolean;
  onTimeUp?: () => void;
  onEnd: (answers: Record<string, string>) => void;
  onName?: (name: string) => void;
  onNeoForm?: (id: string) => void;
  onNeoName?: (name: string) => void;
  onBatiFood?: (food: string) => void;
  onBatiName?: (name: string) => void;
  onBati?: (url: string) => void;
  showGate?: boolean;
}) {
  setDemoMode(!live);
  const [round, setRound] = useState(0);
  const [refines, setRefines] = useState(0);
  const [cands, setCands] = useState<{ id: string; url: string }[]>([]);
  const [ordered, setOrdered] = useState(false);
  const [batiFood, setBatiFood] = useState('ラーメン');
  const { setMe } = useAuth();
  const done = (url: string) => {
    onBati?.(url);
    return url;
  };
  return (
    <StoryPlayer
      steps={steps}
      vars={vars}
      lessonApi={live ? realLessonApi : fakeLessonApi}
      textOnly={day <= 1}
      showGate={showGate}
      replayFilms
      seals={{
        known: day >= 2 ? knownSealsOn(day) : [],
        solved: solvedSealsOn(day),
      }}
      stamps={stampsOn(day)}
      timeUp={timeUp}
      onTimeUp={onTimeUp}
      onNeoName={async (n) => onNeoName?.(n)}
      initial={start > 0 ? { i: start, name: typeof vars.name === 'string' ? vars.name : '', answers: {} } : null}
      onProgress={() => {}}
      onName={async (n) => onName?.(n)}
      onNeo={async (id) => onNeoForm?.(id)}
      lookApi={
        live
          ? {
              candidates: (a) => getApi().lookCandidates(a),
              refine: (id, instruction) => getApi().refineLook(id, instruction),
              choose: async (id) => {
                const u = await getApi().chooseLook(id);
                setMe(u);
                return u.avatarUrl ?? '';
              },
              chooseForm: async (id) => {
                setMe(await getApi().updateMe({ neoForm: id }));
                onNeoForm?.(id);
              },
            }
          : {
              candidates: async (a) => {
                await new Promise((r) => setTimeout(r, 1500));
                const urls =
                  'reference' in a
                    ? await Promise.all([0, 1, 2, 3].map((k) => demoFromReference(`data:${a.reference.mime};base64,${a.reference.data}`, a, k + round * 4)))
                    : 'like' in a
                      ? await Promise.all([0, 1, 2, 3].map((k) => demoRefine(cands.find((c) => c.id === a.like)?.url ?? '', '', k + round * 4)))
                      : demoNeoLooks(
                          'animal' in a
                            ? a
                            : {
                                animal: 'おまかせ',
                                color: 'おまかせ',
                                mood: 'おまかせ',
                              },
                          round,
                        );
                const c = urls.map((url, k) => ({ id: `${round}-${k}`, url }));
                setCands((x) => [...x, ...c]);
                setRound(round + 1);
                return {
                  candidates: c,
                  triesLeft: Math.max(0, 2 - round),
                  refinesLeft: 3 - refines,
                };
              },
              refine: async (id, instruction) => {
                await new Promise((r) => setTimeout(r, 1200));
                const src = cands.find((c) => c.id === id);
                // the one refine: four looks with the wish (client 2026-10-25)
                const c = await Promise.all(
                  [0, 1, 2, 3].map(async (k) => ({
                    id: `r${refines}-${k}`,
                    url: await demoRefine(src?.url ?? '', instruction, refines * 4 + k),
                  })),
                );
                setCands((x) => [...x, ...c]);
                setRefines(refines + 1);
                return {
                  candidates: c,
                  triesLeft: Math.max(0, 3 - round),
                  refinesLeft: 2 - refines,
                };
              },
              choose: async (id) => cands.find((c) => c.id === id)?.url ?? '',
              chooseForm: async (id) => onNeoForm?.(id),
            }
      }
      onEgg={async (food, egg) => {
        setBatiFood(food);
        onBatiFood?.(food);
        if (live) setMe(await getApi().batiEgg(food, egg));
      }}
      onHatch={async () => {
        if (live) {
          try {
            const u = await getApi().batiHatch();
            setMe(u);
            return done(u.bati?.imageUrl ?? demoBati(batiFood));
          } catch {
            return done(demoBati(batiFood));
          }
        }
        await new Promise((r) => setTimeout(r, 1500));
        return done(demoBati(batiFood));
      }}
      onBatiName={async (n) => {
        onBatiName?.(n);
        if (live) setMe(await getApi().batiName(n));
      }}
      ordered={ordered}
      orderApi={{
        checkout: async () => ({ mode: 'demo' }),
        confirm: async () => {},
        demo: async () => {
          await new Promise((r) => setTimeout(r, 800));
          setOrdered(true);
        },
      }}
      onEnd={(a) => setTimeout(() => onEnd(a), 1200)}
    />
  );
}
