'use client';

import type { HomeWork } from '@obolo/shared';
import type { ReactNode } from 'react';
import type { HomePerson } from '@/lib/planetTemplate/people';
import s from './PlanetTemplate.module.css';

/** what a planet's opener gets: the person tapped, the work to show, how to close it, how to go to their profile */
export interface OpenWork {
  person: HomePerson;
  work: HomeWork;
  /** in the play view (it closes by itself; no background of its own) */
  inPlay?: boolean;
  close: () => void;
  openProfile: (personId: string) => void;
}
/** 3-2 per planet: how a work opens (02〜: the scroll on Jupiter, the CD and lyrics on Mercury, the kororin popping on Saturn …) */
export type WorkOpener = (o: OpenWork) => ReactNode;

const isPicture = (w: HomeWork) => w.kind === 'jupiter_post' || /\.(webp|png|jpe?g|gif)(\?|$)/i.test(w.url ?? '');
const playable = (w: HomeWork) => !!w.url && !w.url.startsWith('tts:') && !isPicture(w);

/**
 * The default opener (until the planet's own comes): the work's picture or words big in the middle, its title, and
 * 「by 名前」 — tapping the name opens that person's profile (3-5). Anywhere else closes it. A voice / song / show plays.
 */
export const defaultOpener: WorkOpener = ({ person, work, inPlay, close, openProfile }) => {
  const pic = work.thumbUrl || (isPicture(work) ? work.url : null);
  return (
    <div className={`${s.work} ${inPlay ? s.inPlay : ''}`} onClick={inPlay ? undefined : close} data-testid="work-view">
      {pic && <div className={s.workArt} style={{ backgroundImage: `url(${pic})` }} />}
      {work.title && <div className={s.workTitle}>{work.title}</div>}
      {!pic && work.text && <div className={s.workWords}>{work.text}</div>}
      <button
        type="button"
        className={s.by}
        onClick={(e) => {
          e.stopPropagation();
          openProfile(person.id);
        }}
      >
        by {person.name}
      </button>
      {playable(work) && <audio src={work.url!} autoPlay />}
      {!inPlay && person.figure && <img className={s.whoFig} src={person.figure} alt="" draggable={false} />}
    </div>
  );
};
