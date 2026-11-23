'use client';

import type { CSSProperties } from 'react';
import { useHold } from '@/lib/planetHome/useHold';
import type { StageItem } from '@/lib/planetHome/model';
import type { SceneProps } from './skin';
import s from './PlanetHome.module.css';

/**
 * The story team's template scene (design/home/template.html): the planet's backdrop with your place painted in, up to
 * seven works floating in the sky (27–47% of the height), the far scenery small in the corners (51–57%), the tap area
 * over your place (16–46% from the bottom) and its white name plate. Saturn: the grooves turn while it plays and the
 * kororin singing comes to the needle (lower right).
 */
const SPOTS: [number, number][] = [
  [20, 33],
  [72, 31],
  [46, 27],
  [84, 44],
  [15, 47],
  [58, 41],
  [33, 40],
];
const FAR_SPOTS: [number, number][] = [
  [7, 53],
  [16, 56],
  [25, 51],
  [75, 52],
  [84, 57],
  [93, 54],
];
export const SKY_MAX = SPOTS.length;
const NEEDLE: [number, number] = [70, 58];

const colourOf = (w: StageItem) => (w.rel === 'oshi' ? 'var(--oshi)' : w.rel === 'own' ? 'var(--mine)' : 'var(--dachi)');

/** what floats: dachi and 推し first (newest first); on Saturn your own kororins fill the rest (they live on your record) */
export function skyOf(stage: SceneProps['stage'], planet: string): StageItem[] {
  return [...stage.around, ...(planet === 'saturn' ? stage.own : [])].slice(0, SKY_MAX);
}

export function TemplateScene({ cfg, view, stage, playingId, spinning, onPlace, onPlate, onItem, onHold }: SceneProps) {
  const hold = useHold();
  const sky = skyOf(stage, cfg.planet);
  let fall = 0;
  return (
    <>
      <div className={s.bg} style={{ backgroundImage: `url(${cfg.art.backdrop})` }} />
      {cfg.planet === 'saturn' && <div className={`${s.spin} ${spinning ? s.spinOn : ''}`} aria-hidden />}
      <div className={s.sky}>
        {sky.map((w, i) => {
          const [x, y] = playingId === w.id && cfg.planet === 'saturn' ? NEEDLE : SPOTS[i % SPOTS.length];
          const cls = [
            s.item,
            w.fresh ? s.new : '',
            w.drop === 'one' ? s.drop : w.drop === 'plus' ? s.afterPlus : '',
            w.leaving ? s[`leave-${cfg.leave}`] : '',
            playingId === w.id ? s.singing : '',
          ].join(' ');
          const style = {
            left: `${x}%`,
            top: `${y}%`,
            '--c': colourOf(w),
            '--d': `${5 + (i % 4) * 1.3}s`,
            '--dl': `${-i * 0.9}s`,
            '--fall': `${w.drop === 'one' ? 0.25 + fall++ * 0.35 : 0}s`,
          } as CSSProperties;
          return (
            <button
              key={w.id}
              type="button"
              className={cls}
              style={style}
              aria-label={`${w.rel === 'own' ? 'あなた' : w.author.name}の${cfg.work}`}
              data-rel={w.rel}
              {...hold(
                () => onItem(w),
                (at) => onHold(w, at),
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={cfg.art.sprite} draggable={false} />
              {/* the maker's face on it, so whose it is shows at a glance (design/home §5) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {w.author.pic && <img alt="" src={w.author.pic} className={s.face} draggable={false} />}
              <span className={s.tag}>{w.rel === 'own' ? 'あなた' : w.author.name}</span>
            </button>
          );
        })}
        {stage.far.slice(0, FAR_SPOTS.length).map((w, i) => (
          <button
            key={w.id}
            type="button"
            className={`${s.item} ${s.far}`}
            style={
              {
                left: `${FAR_SPOTS[i][0]}%`,
                top: `${FAR_SPOTS[i][1]}%`,
                '--d': `${11 + i}s`,
                '--dl': `${-(i + 7) * 0.9}s`,
              } as CSSProperties
            }
            aria-label={`遠くの${cfg.work}`}
            data-rel="stranger"
            {...hold(
              () => onItem(w),
              (at) => onHold(w, at),
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" src={cfg.art.sprite} draggable={false} />
          </button>
        ))}
      </div>
      {stage.plus && (
        <div className={s.plus} aria-hidden>
          ＋
        </div>
      )}
      <button type="button" className={s.place} onClick={onPlace} aria-label={`${view.owner.name}の${cfg.place}`} />
      <button type="button" className={s.plate} onClick={onPlate} data-testid="name-plate">
        {view.owner.name}の{cfg.place}
      </button>
    </>
  );
}
