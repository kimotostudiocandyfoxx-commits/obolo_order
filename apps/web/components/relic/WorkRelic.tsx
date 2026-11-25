'use client';

import type { DachiWorkCard } from '@obolo/shared';
import type { ReactNode } from 'react';
import { face, MagicCircle, useSpellFont } from '@/components/atelier/spellLooks';
import { WORK_WORD } from '@/lib/dachi/works';
import { Mirror, MoonFrame, PlayGlow, RelicWords, Scroll, SoundOrb, type OrbLook } from './ClipRelics';
import { Relic, relicW, useRelicOpen, useRelicSlot } from './Relic';
import { useOrbSound } from './useOrbSound';

/**
 * R12: works sent from Bluena as relics, in the family of the spell's talismans (each in its kind's look):
 *  物語  a floating tome in A 霊符's palette (ochre paper, cinnabar border and brush title, a 月 seal)
 *  ゲーム a 呪符 cartridge (black lacquer, a washi label with vermilion letters, the magic circle turning)
 *  曲    D 光符's light: an orb of paper lit from within, its rings breathing with the song
 *  アート B 天符's frame: night indigo with a gold rule and stars around the picture
 *  映像  C ルーン's scroll-mirror: a mirror held between two scroll rods, violet shimmer
 *  つぶやき Saturn's colours: a small ringed planet that speaks; ラジオ Venus's gold: a shell of radio waves
 * A tap opens the work big (read / play / watch: `full`), or plays a sound right in the orb.
 */

const HIKARI: OrbLook = { core: 'radial-gradient(circle at 36% 30%, #ffffff 0, #f0fdff 20%, #a6ecff 48%, #3fb2e8 80%, #1a6fb0 100%)', rim: '#9ff0ff', ring: 'rgba(130,230,255,.75)', ink: '#0b4a72', glow: 'rgba(110,215,255,.75)', font: face('hikari') };
const SATURN: OrbLook = { core: 'radial-gradient(circle at 36% 30%, #fffaf0 0, #f6e3b4 30%, #d8b27a 62%, #8a6230 100%)', rim: '#ffe7b0', ring: 'rgba(246,227,180,.7)', ink: '#5a3b12', glow: 'rgba(246,210,140,.6)' };
const VENUS: OrbLook = { core: 'radial-gradient(circle at 36% 30%, #fffde8 0, #fff3a8 26%, #f0c94a 60%, #a8800c 100%)', rim: '#fff3a8', ring: 'rgba(255,230,120,.75)', ink: '#5e4300', glow: 'rgba(255,215,90,.65)' };

export function WorkRelic({ id, card, full, mine }: { id: string; card: DachiWorkCard; full?: ReactNode; mine?: boolean }) {
  const k = card.kind;
  if (k === 'book') return <BookRelic id={id} card={card} full={full} />;
  if (k === 'game') return <GameRelic id={id} card={card} full={full} />;
  if (k === 'song' || k === 'kororin' || k === 'radio') return <SoundWorkRelic id={id} card={card} />;
  if (k === 'mv' || k === 'video' || k === 'stage') return <FilmWorkRelic id={id} card={card} full={full} />;
  return <ArtRelic id={id} card={card} full={full} mine={mine} />;
}

const nameOf = (c: DachiWorkCard) => c.title || c.text || WORK_WORD[c.kind];

function BookRelic({ id, card, full }: { id: string; card: DachiWorkCard; full?: ReactNode }) {
  useSpellFont('reifu');
  const open = useRelicOpen();
  const title = nameOf(card);
  return (
    <Relic id={id} aura="rgba(255,110,40,.3)" mote="#ffd9a0" label={`物語「${title}」を読む`} testId="relic-book" onTap={(from) => full && open({ from, label: title, node: full, tone: 'rgba(255,170,90,.9)' })}>
      <span className="relative block" style={{ width: relicW(0.56), aspectRatio: '3 / 4', perspective: 600 }}>
        <span className="absolute inset-0 block" style={{ transform: 'rotateY(-14deg)', transformOrigin: '0 50%', transformStyle: 'preserve-3d' }}>
          {/* the page edges at the right */}
          <span aria-hidden className="absolute bottom-[3%] right-[-7px] top-[3%] w-[9px] rounded-r-[2px]" style={{ background: 'repeating-linear-gradient(180deg,#fbf3dc 0 1.5px,#d9c79c 1.5px 3px)', boxShadow: '2px 0 4px rgba(0,0,0,.4)' }} />
          <span className="absolute inset-0 overflow-hidden rounded-[3px_6px_6px_3px]" style={{ background: 'linear-gradient(160deg,#f8e29a,#e9be5a 55%,#d39a33)', boxShadow: '0 0 20px rgba(255,110,40,.45), 0 12px 24px rgba(1,3,20,.55), inset 0 0 18px rgba(140,70,10,.35)' }}>
            {/* the spine */}
            <span aria-hidden className="absolute inset-y-0 left-0 w-[14%]" style={{ background: 'linear-gradient(90deg,#9a5a14,#c98a2e 60%,#b3741f)', boxShadow: 'inset -2px 0 3px rgba(60,20,0,.4)' }}>
              <span className="absolute inset-x-0 top-[14%] h-[3px] bg-[#7a2a10]/70" />
              <span className="absolute inset-x-0 bottom-[14%] h-[3px] bg-[#7a2a10]/70" />
            </span>
            {/* the cinnabar border and the brush title */}
            <span aria-hidden className="absolute bottom-[7%] left-[22%] right-[8%] top-[7%] rounded-[2px]" style={{ border: '2px solid #b3261e', boxShadow: 'inset 0 0 0 3px rgba(179,38,30,.25)' }} />
            <span className="absolute bottom-[12%] left-[22%] right-[8%] top-[11%] flex justify-center">
              <span className="line-clamp-1 text-center leading-[1.05] text-[#a3150c]" style={{ writingMode: 'vertical-rl', fontFamily: face('reifu'), fontSize: 'calc(var(--relic-w, 230px) * var(--rs, 1) * .085)', maxHeight: '100%', overflow: 'hidden', textShadow: '0 0 1px rgba(255,240,200,.6)' }}>
                {title.slice(0, 10)}
              </span>
            </span>
            <span aria-hidden className="absolute bottom-[10%] right-[12%] grid h-[17%] w-[17%] max-h-6 max-w-6 place-items-center rounded-[2px] bg-[#c1271c] text-[11px] font-bold text-[#ffe8c8]" style={{ fontFamily: face('reifu'), boxShadow: '0 0 6px rgba(255,80,40,.6)' }}>
              月
            </span>
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 block w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,250,220,.35), transparent)', animation: 'rl-sheen 8.5s ease-in-out infinite' }} />
          </span>
        </span>
      </span>
      <span className="mt-2 block text-center text-[10px] tracking-[.3em] text-[#ffd9a0]" style={{ textShadow: '0 0 6px rgba(255,110,40,.8), 0 1px 3px #000' }}>
        物語・押して読む
      </span>
    </Relic>
  );
}

function GameRelic({ id, card, full }: { id: string; card: DachiWorkCard; full?: ReactNode }) {
  useSpellFont('jufu');
  const open = useRelicOpen();
  const title = nameOf(card);
  return (
    <Relic id={id} aura="rgba(255,60,30,.28)" mote="#ffb39a" label={`ゲーム「${title}」で遊ぶ`} testId="relic-game" onTap={(from) => full && open({ from, label: title, node: full, tone: 'rgba(255,90,60,.9)' })}>
      <span className="relative block" style={{ width: relicW(0.56), aspectRatio: '5 / 6' }}>
        <span className="absolute inset-0 overflow-hidden" style={{ borderRadius: '10px 10px 14px 14px', background: 'linear-gradient(165deg,#2a2224,#0e0a0b 55%,#1c1416)', boxShadow: '0 0 20px rgba(255,60,30,.45), 0 12px 24px rgba(1,3,20,.6), inset 0 1px 0 rgba(255,255,255,.18), inset 0 0 0 1.5px #5a1a12' }}>
          {/* the ridges at its top */}
          <span aria-hidden className="absolute inset-x-[18%] top-[5%] h-[7%]" style={{ background: 'repeating-linear-gradient(90deg,#3a2c2e 0 3px,#0e0a0b 3px 6px)', borderRadius: 2 }} />
          {/* the washi label */}
          <span className="absolute inset-x-[10%] bottom-[10%] top-[18%] overflow-hidden rounded-[4px]" style={{ background: 'linear-gradient(180deg,#f3ead6,#e2d4b4)', boxShadow: 'inset 0 0 0 1.5px #b3261e, inset 0 0 10px rgba(120,80,20,.3)' }}>
            <MagicCircle className="absolute left-1/2 top-[40%] h-[76%] w-[76%] text-[#c1271c]" style={{ translate: '-50% -50%', opacity: 0.42, animation: 'rl-spin 18s linear infinite' }} rich />
            <span className="absolute inset-x-0 top-[22%] text-center text-[#b3150c]" style={{ fontFamily: face('jufu'), fontSize: 'calc(var(--relic-w, 230px) * var(--rs, 1) * .15)', lineHeight: 1, textShadow: '0 0 6px rgba(255,80,40,.35)' }}>
              遊
            </span>
            <span className="absolute inset-x-1 bottom-[8%] line-clamp-2 text-center text-[11px] font-bold leading-tight text-[#2a0c06]" style={{ fontFamily: face('jufu') }}>
              {title}
            </span>
          </span>
        </span>
      </span>
      <span className="mt-2 block text-center text-[10px] tracking-[.3em] text-[#ffb39a]" style={{ textShadow: '0 0 6px rgba(255,60,30,.8), 0 1px 3px #000' }}>
        ゲーム・押して遊ぶ
      </span>
    </Relic>
  );
}

function SoundWorkRelic({ id, card }: { id: string; card: DachiWorkCard }) {
  const k = card.kind;
  useSpellFont('hikari');
  const look = k === 'song' ? HIKARI : k === 'kororin' ? SATURN : VENUS;
  const s = useOrbSound(async () => ({ mode: 'clip', url: card.url ?? null }));
  const { scale } = useRelicSlot();
  const size = 92 * scale;
  const title = nameOf(card);
  const mark =
    k === 'kororin' ? (
      // Saturn's ring around the little planet
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 block rounded-[50%]" style={{ width: size * 1.55, height: size * 0.42, translate: '-50% -50%', rotate: '-14deg', border: `${Math.max(2, size * 0.05)}px solid rgba(246,227,180,.85)`, boxShadow: '0 0 8px rgba(246,210,140,.7)', clipPath: 'polygon(0 45%, 100% 45%, 100% 100%, 0 100%)' }} />
    ) : k === 'radio' ? (
      <span aria-hidden className="pointer-events-none absolute -top-[14%] left-1/2 block h-[22%] w-[2px] -translate-x-1/2 rounded bg-[#fff3a8]" style={{ boxShadow: '0 0 6px #ffe680' }} />
    ) : (
      <span aria-hidden className="pointer-events-none absolute right-[16%] top-[12%] text-[15px]" style={{ color: '#ffffff', textShadow: '0 0 6px #7fe3ff' }}>
        ♪
      </span>
    );
  return (
    <Relic
      id={id}
      aura={look.glow.replace(/[\d.]+\)$/, '.32)')}
      mote={look.rim}
      floor={false}
      tapFx={null}
      spread={30}
      label={s.on ? `「${title}」を止める` : `${WORK_WORD[k]}「${title}」を聞く`}
      testId={`relic-${k}`}
      onTap={() => void s.toggle()}
      under={<RelicWords main={title} sub={WORK_WORD[k]} look={{ ink: '#f4fbff', glow: look.glow, font: k === 'song' ? face('hikari') : undefined }} width={relicW(0.8)} />}
    >
      <span className="block px-3 pt-3" style={{ width: relicW(0.8) }}>
        <span className="relative mx-auto block" style={{ width: size }}>
          <SoundOrb look={look} size={size} on={s.on} level={s.level} progress={s.progress} measured={s.measured} mark={mark} />
        </span>
      </span>
    </Relic>
  );
}

function FilmWorkRelic({ id, card, full }: { id: string; card: DachiWorkCard; full?: ReactNode }) {
  useSpellFont('rune');
  const open = useRelicOpen();
  const title = nameOf(card);
  return (
    <Relic
      id={id}
      aura="rgba(170,130,255,.3)"
      mote="#e2d2ff"
      label={`映像「${title}」を見る`}
      testId="relic-mv"
      onTap={(from) => open({ from, label: title, tone: 'rgba(190,150,255,.9)', node: card.url ? <video src={card.url} poster={card.posterUrl} controls autoPlay playsInline className="max-h-[74svh] w-full rounded-[12px] bg-black" /> : full })}
    >
      <Scroll width={relicW(0.7)} paper="linear-gradient(180deg,#efe2c4,#dcc49a 50%,#cfb37f)" rod="linear-gradient(180deg,#5a3a70,#341c48 60%,#160a22)">
        <span className="-mx-1 -mt-1 block">
          <Mirror width="100%" poster={card.posterUrl ?? null} rim="linear-gradient(160deg,#efe4ff,#9a82d0 35%,#e6dcff 55%,#5c4592 85%)" tone="rgba(170,130,255,.55)">
            <PlayGlow tone="rgba(190,150,255,.95)" />
          </Mirror>
        </span>
        <span className="mt-2 line-clamp-1 block text-center text-[12.5px] font-bold text-[#3a2252]" style={{ fontFamily: face('rune') }}>
          {title}
        </span>
      </Scroll>
    </Relic>
  );
}

function ArtRelic({ id, card, full }: { id: string; card: DachiWorkCard; full?: ReactNode; mine?: boolean }) {
  useSpellFont('tenfu');
  const open = useRelicOpen();
  const title = nameOf(card);
  const pic = card.posterUrl ?? card.url ?? null;
  return (
    <Relic
      id={id}
      aura="rgba(255,214,120,.28)"
      mote="#ffe9a8"
      label={`${WORK_WORD[card.kind]}「${title}」を大きく見る`}
      testId="relic-art"
      onTap={(from) =>
        open({
          from,
          label: title,
          tone: 'rgba(255,220,130,.9)',
          // eslint-disable-next-line @next/next/no-img-element
          node: pic ? <img src={pic} alt={title} className="max-h-[74svh] w-full rounded-[8px] object-contain" style={{ boxShadow: '0 0 0 6px #18205a, 0 0 0 8px #d9b25a, 0 0 40px rgba(255,214,120,.4)' }} /> : full,
        })
      }
    >
      <span className="relative block p-[9px]" style={{ width: relicW(0.86), background: `radial-gradient(1px 1px at 12% 22%, rgba(255,240,200,.9), transparent 60%), radial-gradient(1px 1px at 78% 8%, rgba(255,240,200,.7), transparent 60%), radial-gradient(1.2px 1.2px at 40% 96%, rgba(255,240,200,.8), transparent 60%), radial-gradient(1px 1px at 96% 70%, rgba(255,240,200,.6), transparent 60%), linear-gradient(160deg,#1d2766,#0e1440 60%,#1a2160)`, borderRadius: 6, boxShadow: '0 0 20px rgba(255,214,120,.38), 0 12px 24px rgba(1,3,20,.55), inset 0 0 0 1.5px #d9b25a, inset 0 0 0 4px #18205a, inset 0 0 0 5px rgba(217,178,90,.55)' }}>
        <MoonFrame width="100%" ratio={1} rim="linear-gradient(150deg,#fff3c4,#c99a3a 35%,#f6e2a0 55%,#8a6420 85%)" glow="rgba(255,214,120,.35)">
          {pic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pic} alt={title} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-2xl text-[#f6e3a8]">✦</span>
          )}
        </MoonFrame>
        {card.title && (
          <span className="mt-1.5 block truncate text-center text-[11.5px] tracking-[.12em] text-[#f6e3a8]" style={{ fontFamily: face('tenfu'), textShadow: '0 0 6px rgba(255,205,110,.7)' }}>
            {card.title}
          </span>
        )}
      </span>
    </Relic>
  );
}
