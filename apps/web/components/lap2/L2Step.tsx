'use client';

import { VenusLesson } from '@/components/venus/VenusLesson';
import type { L2What } from '@/lib/onboarding/lap2';
import type { LessonApi } from '@/lib/onboarding/lessonApi';
import type { StoryVars } from '@/lib/onboarding/script';
import { BatiAsk } from './BatiAsk';
import { DaydreamJacket } from './DaydreamJacket';
import { HomewardGame } from './HomewardGame';
import { L2Screen } from './L2Screen';
import { PlaceSong } from './PlaceSong';
import { PlazaMaker } from './PlazaMaker';
import { Relook } from './Relook';
import { RoundCards } from './RoundCards';
import { Theater } from './Theater';
import { KororinRelay } from './KororinRelay';
import { AtelierVisit } from './AtelierVisit';
import { IslandWorks } from './IslandWorks';
import { SpellCompass } from './SpellCompass';
import { LibraryBuild, KimorinOwl, OwlSend } from '@/components/uranus/LibraryBuild';
import { PictureBook } from '@/components/uranus/PictureBook';
import { StoryDesk } from '@/components/uranus/StoryDesk';
import { spriteUrl } from '@/lib/onboarding/media';

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
    case 'relay':
      return <KororinRelay onDone={onDone} />;
    case 'jacket':
      return <DaydreamJacket api={lessonApi} bati={v.bati ?? ''} fill={fill} onDone={onDone} />;
    // L2-JUPITER-S005: the ateliers (M-R156); the old ids stay so saved progress keeps its place
    case 'theme-island':
      return <IslandWorks mode="theme" neo={v.neo || v.name} bati={v.bati ?? 'バティ'} onDone={onDone} />;
    case 'island-deco':
      return <IslandWorks mode="deco" neo={v.neo || v.name} bati={v.bati ?? 'バティ'} onDone={onDone} />;
    // 〔🧭 スペルコンパス〕 for a song (L2-MERCURY-S002): the cards go to the spellbook for the song made next
    case 'compass-song':
      return <SpellCompass kind="song" onClose={() => onDone({ compass_song: 'skip' })} onAdd={(c) => onDone({ compass_song: c.join('、').slice(0, 120) })} />;
    case 'kimorin-tree':
      return <AtelierVisit who="kimorin" neo={v.neo || v.name} bati={v.bati ?? 'バティ'} onDone={onDone} />;
    case 'my-tree':
      return <AtelierVisit who="mine" arts={v.made?.stickers ?? []} neo={v.neo || v.name} bati={v.bati ?? 'バティ'} onDone={onDone} />;
    case 'tree-deco':
      return <AtelierVisit who="deco" arts={v.made?.stickers ?? []} neo={v.neo || v.name} bati={v.bati ?? 'バティ'} onDone={onDone} />;
    case 'round-cards':
      return <RoundCards answers={answers} look={v.look} onDone={() => onDone({})} />;
    case 'place-song':
      return <PlaceSong onDone={onDone} />;
    case 'theater':
      return <Theater mv={v.made?.mv ?? null} neo={v.neo || v.name} onDone={onDone} />;
    // 天王星 (L2-URANUS-S002〜S004, M-R158)
    case 'novel':
      return <StoryDesk neo={v.neo || v.name} bati={v.bati ?? 'バティ'} arts={v.made?.stickers ?? []} words={v.made?.kororins ?? []} onDone={onDone} />;
    case 'picturebook':
      return <PictureBook neo={v.neo || v.name} bati={v.bati ?? 'バティ'} arts={v.made?.stickers ?? []} onDone={onDone} />;
    case 'library':
      return <LibraryBuild neo={v.neo || v.name} bati={v.bati ?? 'バティ'} onDone={onDone} />;
    case 'owl-send':
      return <OwlSend neo={v.neo || v.name} face={v.lookChibi || v.look} onDone={onDone} />;
    case 'kimorin-owl':
      return <KimorinOwl face={spriteUrl('kimorin-face')} onDone={onDone} />;
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
