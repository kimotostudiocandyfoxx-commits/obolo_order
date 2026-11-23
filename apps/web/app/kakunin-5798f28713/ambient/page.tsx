'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AmbientFront, AmbientSky, type AmbientBox } from '@/components/story/Ambient';
import { PLANETS, type Planet } from '@/lib/story/ambient';

/**
 * /kakunin-5798f28713/ambient — the living backgrounds from day 3 on (lib/story/ambient.ts, components/story/Ambient.tsx):
 * each planet's sky motion and front effect over its current still, with a dummy row of three figures and a dummy
 * subtitle, so the motion and the subtitle's readability can be judged.
 *   ?p=<planet>      moon | mercury | venus | mars | jupiter | saturn | uranus | neptune | sun | pluto | earth | space
 *   ?s=<still>       another still of that planet (e.g. s/mercury-port, s/saturn-night, s/venus-night)
 *   ?q=full          the sky at full quality even on a software GL (captures)
 *   ?i=<0..1.5>      intensity      ?off=1  the still alone (compare)      ?bare=1  no panel (screenshots)
 */
const STILL: Record<Planet, string> = {
  moon: 's/moon-temple',
  mercury: 's/mercury-ice',
  venus: 's/venus-stage',
  mars: 's/mars-screens',
  jupiter: 's/jupiter-forest',
  saturn: 's/saturn-inside',
  uranus: 's/uranus-field',
  neptune: 's/neptune-town',
  sun: 's/sun-inside',
  pluto: 's/mercury-ice',
  earth: 's/launch-pit',
  space: 's/rocket-space',
};
const NAME: Record<Planet, string> = { moon: '月', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星', uranus: '天王星', neptune: '海王星', sun: '太陽', pluto: '冥王星', earth: '地球', space: 'ロケット' };
const MORE: Partial<Record<Planet, string[]>> = {
  moon: ['s/moon-night'],
  mercury: ['s/mercury-port'],
  venus: ['s/venus-night'],
  mars: ['s/arr-mars-city'],
  jupiter: ['s/arr-jupiter-canopy'],
  saturn: ['s/saturn-night', 's/saturn-outside'],
  uranus: ['s/uranus-shop'],
};

/** the dummy row: three figures standing on the floor, their heads */
const FIGS = [0.22, 0.5, 0.78];
const HEADS: AmbientBox[] = FIGS.map((x) => ({ x: x - 0.06, y: 0.45, w: 0.12, h: 0.08 }));
const SUB_TOP = 0.64;

function View() {
  const q = useSearchParams();
  const p = (PLANETS as readonly string[]).includes(q.get('p') ?? '') ? (q.get('p') as Planet) : 'moon';
  const still = q.get('s') ?? STILL[p];
  const src = `/onboarding/${still}.jpg`;
  const intensity = Number(q.get('i') ?? 1);
  const off = q.get('off') === '1';
  const bare = q.get('bare') === '1';
  const quality = q.get('q') === 'full' ? ('full' as const) : ('auto' as const);
  const props = { planet: p, sceneId: null, plate: { src }, intensity, avoid: HEADS, subtitleTop: SUB_TOP, quality };
  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white">
      {/* the still (as TalkScene's place: cover) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {!off && <AmbientSky {...props} fit="cover" />}
      {/* the dummy row */}
      {FIGS.map((x, i) => (
        <div key={i} className="absolute" style={{ left: `${x * 100}%`, top: '45%', width: '15%', height: '17%', transform: 'translateX(-50%)' }}>
          <div className="mx-auto h-[45%] w-[62%] rounded-full" style={{ background: ['#f2c38b', '#a9d6ff', '#ffd1e3'][i], boxShadow: '0 4px 18px rgba(0,0,0,.45)' }} />
          <div className="mx-auto -mt-1 h-[58%] w-[86%] rounded-t-[45%]" style={{ background: ['#7a4f2e', '#2f5d8c', '#8c2f5d'][i], boxShadow: '0 4px 18px rgba(0,0,0,.45)' }} />
        </div>
      ))}
      {!off && <AmbientFront {...props} />}
      {/* the dummy subtitle (lower third) */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end px-6 pb-[12%]" style={{ top: `${SUB_TOP * 100}%`, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,.55) 45%)' }}>
        <p className="text-[12px] font-bold tracking-[0.2em] text-white/70">KIMORIN</p>
        <p className="mt-1 text-center text-[19px] font-black leading-snug [text-shadow:0_2px_8px_rgba(0,0,0,.8)]">おはようございます。いつまで寝ているのですか？</p>
      </div>
      {!bare && (
        <nav className="absolute inset-x-0 top-0 z-10 flex flex-wrap gap-1.5 bg-black/45 p-2 text-[12px] backdrop-blur">
          {PLANETS.map((k) => (
            <Link key={k} href={`?p=${k}`} className={`rounded-full px-2.5 py-1 ${k === p ? 'bg-white text-black' : 'bg-white/15'}`}>
              {NAME[k]}
            </Link>
          ))}
          {(MORE[p] ?? []).map((s) => (
            <Link key={s} href={`?p=${p}&s=${s}`} className={`rounded-full px-2.5 py-1 ${s === still ? 'bg-amber-300 text-black' : 'bg-amber-300/25'}`}>
              {s.replace('s/', '')}
            </Link>
          ))}
          <Link href={`?p=${p}&s=${still}${off ? '' : '&off=1'}`} className="rounded-full bg-white/15 px-2.5 py-1">
            {off ? '効果あり' : '効果なし'}
          </Link>
        </nav>
      )}
    </main>
  );
}

export default function AmbientReview() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
