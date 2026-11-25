'use client';

import { linkDomain, linkKind, type LinkPreview } from '@obolo/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { getApi } from '@/lib/api';
import { relicSeed } from '@/lib/relic/layout';
import { Mirror, PlayGlow, RelicWords } from './ClipRelics';
import { Glint, Relic, relicW, useRelicSlot } from './Relic';

/**
 * R12: a pasted URL as a portal — a small window of light floating where the URL was: the page's picture inside a
 * glowing ring that slowly turns, its title in the world's writing under it, the domain small. A few places look like
 * themselves in this world: YouTube a moving mirror with its thumbnail and a red seal, Spotify a turning disc of green
 * light, SoundCloud a shell of orange waves. Nothing plays here; a tap flares the portal open, then the link opens in a
 * new tab (no referrer, no opener). The preview comes from POST /links/unfurl (pictures as data: URLs).
 */

const cache = new Map<string, Promise<LinkPreview | null>>();
export function usePreview(url: string): LinkPreview | null | undefined {
  const [p, setP] = useState<LinkPreview | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    let q = cache.get(url);
    if (!q) {
      q = getApi()
        .unfurl(url)
        .catch(() => {
          cache.delete(url);
          return null;
        });
      cache.set(url, q);
    }
    void q.then((v) => live && setP(v));
    return () => {
      live = false;
    };
  }, [url]);
  return p;
}

/** a link, after the portal's flare (the gesture still counts after 0.3 s on iOS and Chrome) */
function go(url: string) {
  setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), 320);
}

const LOOK = {
  web: { aura: 'rgba(150,200,255,.3)', mote: '#d6ecff', ring: 'conic-gradient(from 0deg, #fff6c8, #7fd8ff, #b18cff, #ffd27a, #7fd8ff, #fff6c8)', glow: 'rgba(140,200,255,.65)' },
  spotify: { aura: 'rgba(40,215,110,.28)', mote: '#b8ffd4', ring: 'conic-gradient(from 0deg, #1ed760, #b8ffd4, #0d6b33, #1ed760)', glow: 'rgba(30,215,96,.6)' },
  soundcloud: { aura: 'rgba(255,120,30,.28)', mote: '#ffd2a8', ring: 'conic-gradient(from 0deg, #ff7a1a, #ffd2a8, #b8420a, #ff7a1a)', glow: 'rgba(255,120,30,.6)' },
};

export function PortalRelic({ url, id }: { url: string; id: string }) {
  const p = usePreview(url);
  const kind = p?.kind ?? linkKind(url);
  const domain = linkDomain(p?.finalUrl ?? url);
  const title = p?.title ?? (p === undefined ? '…' : domain);
  const site = p?.siteName && p.siteName !== title ? p.siteName : null;
  const label = `${p?.title ? `「${p.title}」` : ''}${domain} をひらく（新しいタブ）`;
  if (kind === 'youtube') {
    return (
      <Relic
        id={id}
        aura="rgba(255,90,80,.26)"
        mote="#ffd0c8"
        label={label}
        tapFx="portal"
        testId="relic-portal-youtube"
        onTap={() => go(url)}
        under={<RelicWords main={title} sub={<Domain favicon={null} text={`YouTube・${p?.description ?? domain}`} />} width={relicW(0.82)} look={{ ink: '#fff1ee', glow: 'rgba(255,90,80,.6)' }} />}
      >
        <span className="block" style={{ width: relicW(0.82), paddingLeft: `calc(${relicW(0.82)} * .08)` }}>
          <Mirror
            width={relicW(0.66)}
            poster={p?.image ?? null}
            rim="linear-gradient(160deg,#fff1e6,#c99a6a 30%,#fde3c4 52%,#8a4f2a 85%)"
            tone="rgba(255,110,90,.5)"
            emblem={
              <span aria-hidden className="absolute -bottom-[9px] left-1/2 grid h-[20px] w-[30px] -translate-x-1/2 place-items-center rounded-[7px]" style={{ background: 'linear-gradient(180deg,#ff3b30,#c4120a)', boxShadow: '0 0 10px rgba(255,60,40,.8), 0 2px 4px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,220,200,.5)' }}>
                <svg viewBox="0 0 24 24" className="ml-[1px] h-[11px] w-[11px]">
                  <path d="M7 4.5v15l12-7.5z" fill="#fff" />
                </svg>
              </span>
            }
          >
            <PlayGlow tone="rgba(255,120,100,.9)" />
          </Mirror>
        </span>
      </Relic>
    );
  }
  const look = kind === 'spotify' ? LOOK.spotify : kind === 'soundcloud' ? LOOK.soundcloud : LOOK.web;
  return (
    <Relic
      id={id}
      aura={look.aura}
      mote={look.mote}
      floor={false}
      label={label}
      tapFx="portal"
      spread={22}
      testId={kind === 'web' ? 'relic-portal' : `relic-portal-${kind}`}
      onTap={() => go(url)}
      under={<RelicWords main={title} sub={<Domain favicon={p?.favicon ?? null} text={site ? `${site}・${domain}` : domain} />} width={relicW(0.82)} look={{ ink: '#f3f6ff', glow: look.glow }} />}
    >
      <span className="block" style={{ width: relicW(0.82) }}>
        <Ring kind={kind} ring={look.ring} glow={look.glow} image={p?.image ?? null} loading={p === undefined} seed={relicSeed(url)} letter={domain.slice(0, 1).toUpperCase()} />
      </span>
    </Relic>
  );
}

function Domain({ favicon, text }: { favicon: string | null; text: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 align-middle">
      {favicon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={favicon} alt="" className="h-3 w-3 shrink-0 rounded-[3px]" />
      )}
      <span className="truncate">{text}</span>
    </span>
  );
}

/** the portal: a ring of light that slowly turns, the page's picture (or a swirl of nebula) inside it */
function Ring({ kind, ring, glow, image, loading, seed, letter }: { kind: string; ring: string; glow: string; image: string | null; loading: boolean; seed: number; letter: string }) {
  const { scale } = useRelicSlot();
  const d = `calc(var(--relic-w, 230px) * var(--rs, 1) * .62)`;
  const disc = kind === 'spotify';
  const hue = seed % 360;
  const inner: ReactNode = image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="h-full w-full object-cover" style={disc ? { animation: 'rl-spin 14s linear infinite' } : undefined} />
  ) : (
    <span className="relative block h-full w-full overflow-hidden">
      <span className="absolute inset-[-20%] block" style={{ background: `conic-gradient(from ${hue}deg, hsl(${hue} 70% 22%), hsl(${(hue + 80) % 360} 75% 45%), hsl(${(hue + 160) % 360} 70% 28%), hsl(${(hue + 240) % 360} 80% 50%), hsl(${hue} 70% 22%))`, filter: 'blur(10px)', animation: 'rl-swirl 9s linear infinite' }} />
      {!loading && <span className="absolute inset-0 grid place-items-center text-[30px] text-white/85" style={{ fontFamily: '"Cinzel", "Shippori Mincho", serif', textShadow: `0 0 12px ${glow}` }}>{letter}</span>}
    </span>
  );
  return (
    <span className="relative mx-auto block" style={{ width: d, height: d }}>
      {/* the turning rim */}
      <span aria-hidden className="absolute inset-[-5px] rounded-full" style={{ background: ring, animation: 'rl-spin 11s linear infinite', boxShadow: `0 0 22px ${glow}, 0 0 46px ${glow}` }} />
      <span aria-hidden className="absolute inset-[-1px] rounded-full" style={{ background: 'rgba(6,10,36,.9)' }} />
      {/* a dashed ring of runes outside it, turning the other way */}
      <span aria-hidden className="absolute inset-[-13px] rounded-full" style={{ border: `1px dashed ${glow}`, animation: 'rl-spin 30s linear infinite reverse', opacity: 0.7 }} />
      <span className="absolute inset-[2px] overflow-hidden rounded-full" style={disc ? { background: 'repeating-radial-gradient(circle, #111 0 2px, #1c1c1c 2px 4px)' } : undefined}>
        {disc ? (
          <span className="absolute inset-[22%] overflow-hidden rounded-full" style={{ boxShadow: '0 0 0 3px #0b0b0b' }}>
            {inner}
          </span>
        ) : (
          inner
        )}
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 ${18 * scale}px rgba(4,8,30,.85), inset 0 0 3px ${glow}` }} />
        {kind === 'soundcloud' && [0, 1].map((i) => <span key={i} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 block h-full w-full rounded-full" style={{ border: '2px solid rgba(255,170,90,.7)', animation: `rl-ripple 2.8s ease-out ${-i * 1.4}s infinite` }} />)}
      </span>
      <Glint size={10} color="#fffbe6" style={{ left: '8%', top: '6%', animation: 'rl-twinkle 3.2s ease-in-out infinite' }} />
      <Glint size={8} color="#fffbe6" style={{ right: '4%', bottom: '14%', animation: 'rl-twinkle 4s ease-in-out -1.6s infinite' }} />
    </span>
  );
}
