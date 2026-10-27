'use client';

import { VenusLesson } from '@/components/venus/VenusLesson';
import type { L2What } from '@/lib/onboarding/lap2';
import type { LessonApi } from '@/lib/onboarding/lessonApi';
import type { StoryVars } from '@/lib/onboarding/script';
import { BatiAsk } from './BatiAsk';
import { DaydreamJacket } from './DaydreamJacket';
import { GoodsPress } from './GoodsPress';
import { HomewardGame } from './HomewardGame';
import { L2Screen } from './L2Screen';
import { PlaceSong } from './PlaceSong';
import { PlazaMaker } from './PlazaMaker';
import { Relook } from './Relook';
import { RoundCards } from './RoundCards';
import { Theater } from './Theater';

/**
 * One second-journey screen ({ t: 'l2', what }): the makers built so far, else the script's panel (L2Screen).
 * Whatever it decides comes back as answers for the story's branches and the saved chapter.
 */
export function L2Step({
  what,
  vars: v,
  answers,
  lessonApi,
  fill,
  onDone,
}: {
  what: L2What;
  vars: StoryVars;
  answers: Record<string, string>;
  lessonApi?: LessonApi;
  fill: (s: string) => string;
  onDone: (a: Record<string, string>) => void;
}) {
  switch (what) {
    case 'ask':
      return <BatiAsk bati={v.bati ?? ''} onDone={onDone} />;
    case 'relook':
      return <Relook onDone={onDone} />;
    case 'plaza':
      return <PlazaMaker onDone={onDone} />;
    case 'jacket':
      return <DaydreamJacket api={lessonApi} bati={v.bati ?? ''} fill={fill} onDone={onDone} />;
    case 'round-cards':
      return <RoundCards answers={answers} look={v.look} onDone={() => onDone({})} />;
    case 'place-song':
      return <PlaceSong onDone={onDone} />;
    case 'theater':
      return <Theater mv={v.made?.mv ?? null} onDone={onDone} />;
    case 'goods':
      return (
        <GoodsPress
          pictures={[...(v.made?.stickers ?? []), ...(v.made?.song?.jacket ? [{ text: v.made.song.title, url: v.made.song.jacket }] : []), ...(v.look ? [{ text: v.neo || v.name, url: v.look }] : []), { text: v.neo || v.name || 'Obolo', url: null }]}
          onDone={onDone}
        />
      );
    case 'game':
      return <HomewardGame watch={answers.game === 'KIMORINが遊ぶのを、となりで見る'} onDone={onDone} />;
    case 'booth':
      return (
        <VenusLesson
          booth={{ self: (answers.l1_dj ?? v.story?.['d7.f_d07v_mode']) === 'self' }}
          song={v.made?.song ?? null}
          mv={v.made?.mv ?? null}
          kororins={v.made?.kororins ?? []}
          neo={v.neo || v.name}
          inviter={v.inviter}
          onDone={() => onDone({ l2_synced: 'yes' })}
        />
      );
    default:
      return <L2Screen what={what} fill={fill} onDone={onDone} />;
  }
}
