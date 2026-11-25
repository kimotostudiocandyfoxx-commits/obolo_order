'use client';

import type { ClipFile } from '@obolo/shared';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { openDoc } from '@/components/atelier/BluenaClip';
import { lengthWord, sizeWord } from '@/lib/clip/rows';
import { clipUrl, useClipUrl } from '@/lib/clip/useClip';
import { sealOf } from '@/lib/relic/layout';
import { Glint, Relic, RELIC_SERIF, relicW, useRelicOpen, useRelicSlot } from './Relic';
import { useOrbSound } from './useOrbSound';

/**
 * R12: Bluena's 📎 files as relics —
 *  写真  a moonlit frame (silver, a crescent at its top, glints at its corners, a sheen of light passing over it)
 *  動画  a moving mirror (an arched glass with its poster, liquid light on it, a ripple going out, ▶ glowing in it)
 *  音声  a sound orb (a pearl of light; its rings breathe with the sound, its rim fills as it plays)
 *  書類  a sealed scroll (parchment between two rods, the name written on it, the type as a wax seal: PDF, Word …)
 */

/** the frame's natural shape from the file (a cluster crops them all a little alike) */
const ratioOf = (f: ClipFile, crop: boolean) => {
  if (crop) return 4 / 5;
  const r = f.width && f.height ? f.width / f.height : 4 / 3;
  return Math.max(0.72, Math.min(1.5, r));
};

export function PhotoRelic({ file: f }: { file: ClipFile }) {
  const url = useClipUrl(f.id);
  const open = useRelicOpen();
  const { scale } = useRelicSlot();
  const [ratio, setRatio] = useState<number | null>(null);
  const r = scale < 1 ? 4 / 5 : (ratio ?? ratioOf(f, false));
  return (
    <Relic
      id={f.id}
      aura="rgba(170,200,255,.34)"
      mote="#eaf2ff"
      label={`写真「${f.name}」を大きく見る`}
      testId="relic-photo"
      onTap={(from) => url && open({ from, label: f.name, node: <PhotoFull url={url} name={f.name} /> })}
    >
      <MoonFrame width={relicW(r >= 1 ? 1 : 0.84)} ratio={r}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={f.name} className="h-full w-full object-cover" onLoad={(e) => !f.width && setRatio(Math.max(0.72, Math.min(1.5, e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight))))} data-testid="clip-photo" />
        ) : (
          <span className="block h-full w-full" style={{ background: 'radial-gradient(circle at 50% 40%, #2c3a7a, #0d1236)' }} />
        )}
      </MoonFrame>
    </Relic>
  );
}

/** a silver moonlit frame around a picture */
export function MoonFrame({ width, ratio, children, rim = 'linear-gradient(150deg,#f6f8ff,#a7b6dc 30%,#eef1ff 52%,#8494c4 78%,#e2e8ff)', glow = 'rgba(170,200,255,.5)' }: { width: string; ratio: number; children: ReactNode; rim?: string; glow?: string }) {
  return (
    <span className="relative block" style={{ width }}>
      <span className="relative block rounded-[7px] p-[5px]" style={{ background: rim, boxShadow: `0 0 18px ${glow}, 0 12px 26px rgba(1,3,20,.55), inset 0 0 0 1px rgba(255,255,255,.55)` }}>
        <span className="relative block overflow-hidden rounded-[3px]" style={{ aspectRatio: String(ratio), boxShadow: 'inset 0 0 0 1px rgba(40,50,110,.5)' }}>
          {children}
          {/* the inner glow at its edges, and a sheen of light passing now and then */}
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 22px rgba(18,26,80,.55), inset 0 0 2px rgba(255,255,255,.4)' }} />
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 block w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent)', animation: 'rl-sheen 7.5s ease-in-out infinite' }} />
        </span>
      </span>
      {/* a crescent at its top, glints at its corners */}
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-1/2 top-[-11px] h-[20px] w-[20px] -translate-x-1/2" style={{ filter: 'drop-shadow(0 0 4px rgba(220,235,255,.95))' }}>
        <path d="M15 3a9 9 0 1 0 6 13A7.2 7.2 0 0 1 15 3z" fill="#f4f7ff" stroke="#9aa9d4" strokeWidth=".8" />
      </svg>
      <Glint size={10} color="#f2f6ff" style={{ left: -5, top: -5, animation: 'rl-twinkle 3.4s ease-in-out infinite' }} />
      <Glint size={8} color="#f2f6ff" style={{ right: -4, top: -4, animation: 'rl-twinkle 4.1s ease-in-out -1.3s infinite' }} />
      <Glint size={9} color="#f2f6ff" style={{ right: -5, bottom: -5, animation: 'rl-twinkle 3.8s ease-in-out -2.2s infinite' }} />
      <Glint size={7} color="#f2f6ff" style={{ left: -4, bottom: -3, animation: 'rl-twinkle 4.6s ease-in-out -.6s infinite' }} />
    </span>
  );
}

function PhotoFull({ url, name }: { url: string; name: string }) {
  return (
    <div className="rounded-[10px] p-[6px]" style={{ background: 'linear-gradient(150deg,#f6f8ff,#a7b6dc 30%,#eef1ff 52%,#8494c4 78%,#e2e8ff)', boxShadow: '0 0 40px rgba(170,200,255,.45)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} className="block max-h-[72svh] w-full rounded-[5px] object-contain" style={{ background: '#0b1030' }} />
    </div>
  );
}

// ---- a film ----

/** the arched glass of a mirror (a film, a YouTube link): `rim` its frame, `tone` its light */
export function Mirror({ width, poster, rim, tone, emblem, children }: { width: string; poster: string | null; rim: string; tone: string; emblem?: ReactNode; children?: ReactNode }) {
  const arch = '50% 50% 12px 12px / 30% 30% 12px 12px';
  return (
    <span className="relative block" style={{ width }}>
      {/* a ripple going out from it */}
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 block h-full w-full" style={{ borderRadius: arch, border: `1.5px solid ${tone}`, animation: 'rl-ripple 3.6s ease-out infinite' }} />
      <span className="relative block p-[5px]" style={{ borderRadius: arch, background: rim, boxShadow: `0 0 20px ${tone}, 0 12px 26px rgba(1,3,20,.55), inset 0 0 0 1px rgba(255,255,255,.5)` }}>
        <span className="relative block overflow-hidden" style={{ borderRadius: '50% 50% 8px 8px / 29% 29% 8px 8px', aspectRatio: '4 / 5', background: 'radial-gradient(circle at 50% 35%, #2a3576, #080b26)' }}>
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="h-full w-full object-cover" />
          )}
          {/* liquid light over the glass */}
          <span aria-hidden className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ background: `linear-gradient(125deg, transparent 20%, ${tone} 45%, transparent 60%, rgba(255,255,255,.18) 75%, transparent 90%)`, backgroundSize: '220% 220%', animation: 'rl-liquid 6s ease-in-out infinite', opacity: 0.55 }} />
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 26px rgba(6,10,40,.75)' }} />
          {children}
        </span>
      </span>
      {emblem}
    </span>
  );
}

/** ▶ glowing in the glass */
export function PlayGlow({ tone = 'rgba(190,220,255,.9)' }: { tone?: string }) {
  return (
    <span aria-hidden className="absolute inset-0 grid place-items-center">
      <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.35), rgba(255,255,255,.08) 60%, transparent 70%)', boxShadow: `0 0 18px ${tone}`, border: '1px solid rgba(255,255,255,.55)', backdropFilter: 'blur(2px)' }}>
        <svg viewBox="0 0 24 24" className="ml-[3px] h-5 w-5" style={{ filter: `drop-shadow(0 0 4px ${tone})` }}>
          <path d="M7 4.5v15l12-7.5z" fill="#fff" />
        </svg>
      </span>
    </span>
  );
}

export function VideoRelic({ file: f }: { file: ClipFile }) {
  const poster = useClipUrl(f.posterId);
  const open = useRelicOpen();
  return (
    <Relic
      id={f.id}
      aura="rgba(150,170,255,.32)"
      mote="#d9e2ff"
      label={`動画「${f.name}」を見る`}
      testId="relic-video"
      onTap={(from) => open({ from, label: f.name, node: <ClipFilmFull f={f} poster={poster} /> })}
    >
      <Mirror width={relicW(0.74)} poster={poster} rim="linear-gradient(160deg,#eef2ff,#8d9bd0 35%,#dfe5ff 55%,#5d6aa6 85%)" tone="rgba(150,175,255,.55)">
        <PlayGlow />
        {f.seconds != null && <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[rgba(6,10,40,.6)] px-2 text-[10.5px] tracking-[.08em] text-[#e8ecff]" style={{ fontFamily: RELIC_SERIF }}>{lengthWord(f.seconds)}</span>}
      </Mirror>
    </Relic>
  );
}

function ClipFilmFull({ f, poster }: { f: ClipFile; poster: string | null }) {
  const url = useClipUrl(f.id);
  return (
    <div className="overflow-hidden rounded-[14px] bg-black" style={{ boxShadow: '0 0 40px rgba(150,175,255,.4)', aspectRatio: f.width && f.height ? `${f.width} / ${f.height}` : '16 / 9', maxHeight: '74svh' }}>
      {url ? <video src={url} poster={poster ?? undefined} controls autoPlay playsInline className="h-full w-full object-contain" data-testid="relic-video-player" /> : <span className="grid h-full w-full place-items-center text-sky-100/60">…</span>}
    </div>
  );
}

// ---- a sound ----

export type OrbLook = { core: string; rim: string; ring: string; ink: string; glow: string; font?: string };
export const ORB_SOUND: OrbLook = { core: 'radial-gradient(circle at 34% 28%, #ffffff 0, #d6f1ff 16%, #7cc4ef 46%, #2b56a8 78%, #142a66 100%)', rim: 'rgba(160,220,255,.9)', ring: 'rgba(150,215,255,.7)', ink: '#0d1f55', glow: 'rgba(120,200,255,.6)' };

/** a pearl of light; its rings breathe with the sound (by itself when there is no level), its rim fills as it plays */
export function SoundOrb({ look, size, on, level, progress, measured, mark }: { look: OrbLook; size: number; on: boolean; level: number; progress: number; measured: boolean; mark?: ReactNode }) {
  const C = 2 * Math.PI * (size / 2 + 5);
  const lv = measured ? level : 0;
  return (
    <span className="relative block" style={{ width: size, height: size }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 block rounded-full"
          style={{
            width: size,
            height: size,
            border: `1.5px solid ${look.ring}`,
            ...(on && measured
              ? { transform: `translate(-50%,-50%) scale(${1.1 + i * 0.16 + lv * (0.5 + i * 0.25)})`, opacity: 0.7 - i * 0.18, transition: 'transform 90ms linear' }
              : { animation: `rl-ripple ${on ? 1.4 : 3.8}s ease-out ${-i * (on ? 0.46 : 1.26)}s infinite` }),
          }}
        />
      ))}
      <span className="absolute inset-0 rounded-full" style={{ background: look.core, boxShadow: `0 0 ${18 + lv * 26}px ${look.glow}, inset -6px -8px 16px rgba(0,0,30,.35), inset 4px 5px 10px rgba(255,255,255,.55)`, transform: `scale(${1 + lv * 0.06})`, transition: 'transform 90ms linear' }} />
      {/* how much has played, around its rim */}
      <svg aria-hidden className="pointer-events-none absolute" style={{ left: -5, top: -5, width: size + 10, height: size + 10, transform: 'rotate(-90deg)' }}>
        <circle cx={(size + 10) / 2} cy={(size + 10) / 2} r={size / 2 + 3.5} fill="none" stroke={look.rim} strokeWidth="2" strokeLinecap="round" strokeDasharray={`${C * progress} ${C}`} style={{ filter: `drop-shadow(0 0 3px ${look.rim})`, opacity: progress > 0 ? 1 : 0 }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center" style={{ color: look.ink }}>
        {mark ?? null}
        <span className="absolute grid place-items-center">
          {on ? (
            <svg viewBox="0 0 24 24" className="h-[34%] w-[34%] min-w-[16px]" style={{ width: size * 0.3, height: size * 0.3 }}>
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" style={{ width: size * 0.32, height: size * 0.32, marginLeft: size * 0.04 }}>
              <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
            </svg>
          )}
        </span>
      </span>
    </span>
  );
}

/** the words under an orb / a portal: a line in the world's writing, a small second line */
export function RelicWords({ main, sub, look, align = 'center', width }: { main: string; sub?: ReactNode; look?: { ink: string; glow: string; font?: string }; align?: 'center' | 'left'; width?: string }) {
  const ink = look?.ink ?? '#eef2ff';
  return (
    <span className={`block ${align === 'center' ? 'text-center' : ''}`} style={{ width, maxWidth: width ?? 220 }}>
      <span className="line-clamp-2 block text-[13px] font-semibold leading-snug tracking-[.04em]" style={{ color: ink, fontFamily: look?.font ?? RELIC_SERIF, textShadow: `0 0 2px rgba(4,8,30,.95), 0 1px 3px rgba(4,8,30,.9), 0 0 10px ${look?.glow ?? 'rgba(150,190,255,.6)'}` }}>
        {main}
      </span>
      {sub && (
        <span className="mt-0.5 block truncate text-[10.5px] tracking-[.08em]" style={{ color: ink, opacity: 0.72, textShadow: '0 1px 3px rgba(4,8,30,.95)' }}>
          {sub}
        </span>
      )}
    </span>
  );
}

export function AudioRelic({ file: f }: { file: ClipFile }) {
  const s = useOrbSound(async () => ({ mode: 'element', url: await clipUrl(f.id) }));
  const { scale } = useRelicSlot();
  return (
    <Relic
      id={f.id}
      aura="rgba(110,190,255,.3)"
      mote="#bfe6ff"
      floor={false}
      tapFx={null}
      spread={30}
      label={s.on ? `「${f.name}」を止める` : `音声「${f.name}」を聞く`}
      testId="relic-audio"
      onTap={() => void s.toggle()}
      under={<RelicWords main={f.name.replace(/\.[a-z0-9]{1,5}$/i, '')} sub={`♪ ${[f.seconds ? lengthWord(f.seconds) : '', sizeWord(f.sizeBytes)].filter(Boolean).join('・')}`} width={relicW(0.8)} />}
    >
      <span className="block px-3 pt-2" style={{ width: relicW(0.8) }}>
        <span className="mx-auto block" style={{ width: 96 * scale }}>
          <SoundOrb look={ORB_SOUND} size={96 * scale} on={s.on} level={s.level} progress={s.progress} measured={s.measured} />
        </span>
      </span>
    </Relic>
  );
}

// ---- a document ----

/** parchment between two rods, the words written on it, a wax seal */
export function Scroll({ width, seal, children, paper = 'linear-gradient(180deg,#f7ecd0,#ecdcb4 45%,#e4cf9e)', rod = 'linear-gradient(180deg,#8a5a2b,#5a3612 60%,#2e1a07)', style }: { width: string; seal?: ReactNode; children: ReactNode; paper?: string; rod?: string; style?: CSSProperties }) {
  const rodEl = (top: boolean) => (
    <span aria-hidden className="relative z-[1] block h-[11px] rounded-full" style={{ margin: '0 -9px', background: rod, boxShadow: `0 ${top ? 3 : -2}px 6px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,220,170,.4)` }}>
      <span className="absolute -left-[5px] top-1/2 h-[15px] w-[9px] -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle at 40% 35%, #f3d58a, #a8761f 70%)' }} />
      <span className="absolute -right-[5px] top-1/2 h-[15px] w-[9px] -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle at 40% 35%, #f3d58a, #a8761f 70%)' }} />
    </span>
  );
  return (
    <span className="relative block" style={{ width, ...style }}>
      {rodEl(true)}
      <span className="relative -my-[3px] block px-4 pb-6 pt-4" style={{ background: paper, boxShadow: 'inset 0 6px 8px -4px rgba(80,50,10,.45), inset 0 -6px 8px -4px rgba(80,50,10,.45), 0 10px 22px rgba(1,3,20,.5)' }}>
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 17px, rgba(120,85,30,.13) 17px 18px)', backgroundPosition: '0 30px' }} />
        <span className="relative block">{children}</span>
      </span>
      {rodEl(false)}
      {seal}
    </span>
  );
}

/** a wax seal with a word on it */
export function WaxSeal({ word, wax, hi, size = 46, style }: { word: string; wax: string; hi: string; size?: number; style?: CSSProperties }) {
  return (
    <span aria-hidden className="absolute z-[2] grid place-items-center" style={{ width: size, height: size, borderRadius: '47% 53% 50% 50% / 52% 46% 54% 48%', background: `radial-gradient(circle at 36% 30%, ${hi}, ${wax} 62%, color-mix(in srgb, ${wax} 70%, #000) 100%)`, boxShadow: `0 3px 8px rgba(0,0,0,.5), inset 0 0 0 3px color-mix(in srgb, ${wax} 80%, #000), inset 0 0 0 5px ${hi}55`, ...style }}>
      <span className="font-bold tracking-[.04em] text-[#fff4e6]" style={{ fontSize: word.length > 3 ? size * 0.24 : size * 0.3, fontFamily: '"Cinzel", "Times New Roman", serif', textShadow: `0 1px 0 color-mix(in srgb, ${wax} 60%, #000)` }}>
        {word}
      </span>
    </span>
  );
}

export function DocRelic({ file: f }: { file: ClipFile }) {
  const seal = sealOf(f.name, f.mime);
  const base = f.name.replace(/\.[a-z0-9]{1,5}$/i, '');
  return (
    <Relic id={f.id} aura="rgba(255,214,140,.26)" mote="#ffe7b0" label={`${seal.word}「${f.name}」をひらく`} testId="relic-doc" onTap={() => setTimeout(() => void openDoc(f), 260)}>
      <Scroll width={relicW(0.66)} seal={<WaxSeal {...seal} style={{ right: -10, bottom: 4 }} />}>
        <span className="block text-[9.5px] tracking-[.3em] text-[#7a5520]">{seal.word === 'TXT' || seal.word === 'CSV' ? '書きつけ' : seal.word === 'ZIP' ? 'たばね' : '文書'}</span>
        <span className="mt-1 line-clamp-3 block break-all text-[13.5px] font-bold leading-[1.45] text-[#3a2408]" style={{ fontFamily: RELIC_SERIF }}>
          {base}
        </span>
        <span className="mt-1.5 block text-[10.5px] tracking-[.06em] text-[#6b4a1c]">{sizeWord(f.sizeBytes)}</span>
      </Scroll>
    </Relic>
  );
}

/** one 📎 file as its relic */
export function ClipRelic({ file }: { file: ClipFile }) {
  if (file.kind === 'photo') return <PhotoRelic file={file} />;
  if (file.kind === 'video') return <VideoRelic file={file} />;
  if (file.kind === 'audio') return <AudioRelic file={file} />;
  return <DocRelic file={file} />;
}
