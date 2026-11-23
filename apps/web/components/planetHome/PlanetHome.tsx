'use client';

import { PLANET_HOMES, type HomePlanet, type HomeWork, type PlanetHomeConfig, type PlanetHomeView, type PlanetWorkReportBody } from '@obolo/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { menuFor, type MenuAct } from '@/lib/planetHome/model';
import { usePlanetHome } from '@/lib/planetHome/usePlanetHome';
import { useHold, type At } from '@/lib/planetHome/useHold';
import type { PlanetHomeSkin } from './skin';
import { skinFor } from './skins';
import s from './PlanetHome.module.css';

/**
 * 星のホーム (M-R258; Saturn M-R257), in the story team's template (design/home): one component for every planet. Data
 * and callbacks come from usePlanetHome; the scene (backdrop, floating works, far scenery, your place) is a swappable
 * skin (skin.ts / skins.ts); this is the frame every planet shares — the planet's name, 〔？〕 and the explainer strip
 * (4.5 s, then folded), 〔♡ 推し〕, the dock (the big button + 〔＋ 飛ばす〕), the bottom sheet for a work, the long-press
 * menu, the inside shelf (your works, forever, newest first; hold one to move it or take it out), the singer's words
 * and the toast. Never a count.
 *
 * A story passes `view` (a resident's scripted place, or {neo}'s) and `seeds` (the inviter's and KIMORIN's works
 * arriving); nothing is then loaded or written.
 */
export function PlanetHome({ planet, view, seeds, skin, onBack }: { planet: HomePlanet; view?: PlanetHomeView; seeds?: HomeWork[]; skin?: PlanetHomeSkin; onBack?: () => void }) {
  const cfg = PLANET_HOMES[planet];
  const h = usePlanetHome(planet, { view, seeds });
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const Scene = (skin ?? skinFor(planet)).Scene;
  const [sheet, setSheet] = useState<HomeWork | null>(null);
  const [menu, setMenu] = useState<{ w: HomeWork; at: At } | null>(null);
  const [shelfMenu, setShelfMenu] = useState<{ w: HomeWork; at: At } | null>(null);
  const [reporting, setReporting] = useState<HomeWork | null>(null);
  const [inside, setInside] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [oshiOpen, setOshiOpen] = useState(false);
  const [say, setSay] = useState(true);
  const young = !!h.view?.young;
  const all = [...(h.stage?.own ?? []), ...(h.stage?.around ?? []), ...(h.stage?.far ?? [])];
  const singing = h.playingId ? all.find((w) => w.id === h.playingId) : undefined;
  const hold = useHold();

  // the explainer strip: shown when the home opens, folded after 4.5 s; 〔？〕 toggles it
  useEffect(() => {
    const t = setTimeout(() => setSay(false), 4500);
    return () => clearTimeout(t);
  }, [planet]);

  const local = (at: At): At => {
    const r = root.current?.getBoundingClientRect();
    return r
      ? {
          x: Math.min(at.x - r.left, r.width - 170),
          y: Math.min(at.y - r.top, r.height - 190),
        }
      : at;
  };
  const enter = () => {
    if (cfg.placeTap === 'play') return h.spinning ? h.stop() : h.play();
    setZoom(true);
    setTimeout(() => {
      setZoom(false);
      setInside(true);
    }, 450);
  };
  // Saturn: a kororin tapped comes to the needle and sings now; elsewhere the sheet opens
  const tap = (w: HomeWork) => (cfg.open === 'sing' && w.rel !== 'stranger' ? h.playOne(w) : setSheet(w));
  const act = (a: MenuAct, w: HomeWork) => {
    setMenu(null);
    if (a === 'open') setSheet(w);
    else if (a === 'push') void h.push(w.author);
    else if (a === 'unpush') void h.unpush(w.author);
    else if (a === 'hide') void h.hide(w);
    else setReporting(w);
  };

  return (
    <div ref={root} className={`${s.home} ${zoom ? s.zoom : ''}`} style={{ '--accent': cfg.accent } as CSSProperties} data-planet={planet}>
      {h.view && h.stage && (
        <Scene
          cfg={cfg}
          view={h.view}
          stage={h.stage}
          playingId={h.playingId}
          spinning={h.spinning}
          onPlace={enter}
          onPlate={() => setInside(true)}
          onItem={tap}
          onHold={(w, at) => menuFor(w, young).length && setMenu({ w, at: local(at) })}
        />
      )}
      {h.error && <p className={s.empty}>いまは、開けなかった。もう一度ためしてみて</p>}

      {/* Saturn: the words of the kororin singing at the needle */}
      {singing && (
        <div className={s.needle} data-testid="singing">
          🎤 {singing.rel === 'own' ? 'あなた' : singing.author.name}
          {(singing.text || singing.title) && (
            <>
              <br />「{singing.text || singing.title}」
            </>
          )}
        </div>
      )}

      <div className={s.top}>
        <div className={s.row}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onBack && (
              <button type="button" className={`${s.pill} ${s.help}`} onClick={onBack} aria-label="もどる">
                ←
              </button>
            )}
            <div className={s.ttl}>
              <small>{cfg.en}</small>
              {cfg.name}
            </div>
          </div>
          <span style={{ display: 'flex', gap: 6 }}>
            <button type="button" className={`${s.pill} ${s.help}`} onClick={() => setSay((v) => !v)} aria-label="この星の説明" aria-expanded={say}>
              ？
            </button>
            <button type="button" className={s.pill} onClick={() => (setOshiOpen(true), h.loadOshi())}>
              ♡ 推し
            </button>
          </span>
        </div>
        <div className={`${s.say} ${say ? '' : s.mini}`}>
          <Emph text={cfg.line} />
        </div>
      </div>

      <div className={s.dock}>
        <button type="button" className={s.cta} onClick={enter}>
          {cfg.placeTap === 'play' && h.spinning ? '■ 止める' : cfg.cta}
        </button>
        <button type="button" className={s.ghost} onClick={() => router.push(cfg.make ? `/moon/atelier?kind=${cfg.make}` : '/moon/atelier')}>
          ＋ 飛ばす
        </button>
      </div>

      {/* inside your place: your works, forever, newest first (hold one: 前へ / 後ろへ / 外す) */}
      {inside && h.stage && h.view && (
        <div className={s.inside}>
          <div className={s.row}>
            <div className={s.ttl} style={{ fontSize: 22 }}>
              {h.view.owner.name}の{cfg.inside}
            </div>
            <button type="button" className={s.pill} onClick={() => setInside(false)}>
              ← 外へ
            </button>
          </div>
          <div className={s.say}>
            <Emph text={`ここには、あなたが作った**${cfg.work}**が、**ずっと**あります。`} />
          </div>
          <div className={s.shelf}>
            {h.stage.own.map((w) => (
              <button
                key={w.id}
                type="button"
                className={s.w}
                {...hold(
                  () => setSheet(w),
                  (at) => setShelfMenu({ w, at: local(at) }),
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {cfg.open === 'view' && (w.thumbUrl || w.url) ? <img alt="" src={(w.thumbUrl || w.url)!} /> : <span>{w.title || w.text || cfg.work}</span>}
                <small>{day(w.flownAt)}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {(menu || shelfMenu) && <div className={s.scrim} onPointerDown={() => (setMenu(null), setShelfMenu(null))} />}
      {menu && (
        <div className={s.menu} style={{ left: menu.at.x, top: menu.at.y }} role="menu">
          {menuFor(menu.w, young).map((a) => (
            <button key={a} type="button" role="menuitem" onClick={() => act(a, menu.w)}>
              {a === 'open' ? 'ひらく' : a === 'push' ? '♡ 推す' : a === 'unpush' ? '推しを外す' : a === 'hide' ? '見えなくする' : '通報する'}
            </button>
          ))}
        </div>
      )}
      {shelfMenu && (
        <div className={s.menu} style={{ left: shelfMenu.at.x, top: shelfMenu.at.y }} role="menu">
          <button type="button" role="menuitem" onClick={() => (h.moveOwn(shelfMenu.w.id, -1), setShelfMenu(null))}>
            前へ
          </button>
          <button type="button" role="menuitem" onClick={() => (h.moveOwn(shelfMenu.w.id, 1), setShelfMenu(null))}>
            後ろへ
          </button>
          <button type="button" role="menuitem" onClick={() => (void h.removeOwn(shelfMenu.w), setShelfMenu(null))}>
            外す
          </button>
        </div>
      )}

      {sheet && (
        <Sheet onClose={() => setSheet(null)}>
          <WorkSheet
            w={sheet}
            cfg={cfg}
            young={young}
            playing={h.playingId === sheet.id}
            onPlay={() => h.playOne(sheet)}
            onHeart={() => (sheet.rel === 'oshi' ? h.unpush(sheet.author) : h.push(sheet.author)).then(() => setSheet((x) => (x ? { ...x, rel: x.rel === 'oshi' ? 'stranger' : 'oshi' } : x)))}
            onClose={() => setSheet(null)}
          />
        </Sheet>
      )}

      {reporting && (
        <Sheet onClose={() => setReporting(null)}>
          <div className={s.n} style={{ textAlign: 'center', marginBottom: 8 }}>
            通報する
          </div>
          <div className={s.acts} style={{ flexDirection: 'column' }}>
            {REASONS.map(([r, l]) => (
              <button key={r} type="button" onClick={() => void h.report(reporting, r).then(() => setReporting(null))}>
                {l}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {oshiOpen && (
        <Sheet onClose={() => setOshiOpen(false)}>
          <div className={s.n} style={{ textAlign: 'center', marginBottom: 8 }}>
            ♡ 推し
          </div>
          {h.oshi?.length === 0 && (
            <p
              style={{
                textAlign: 'center',
                fontSize: 12,
                opacity: 0.75,
                padding: '12px 0',
              }}
            >
              まだ、推している人はいない
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {h.oshi?.map((o) => (
              <div key={o.id} className={s.who} style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 900, fontSize: 14 }}>{o.name}</span>
                {o.dachi ? (
                  <span className={s.chip} style={{ color: 'var(--dachi)' }}>
                    ダチ
                  </span>
                ) : (
                  <button type="button" className={s.pill} onClick={() => void h.unpush(o)}>
                    外す
                  </button>
                )}
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {h.note && (
        <div key={h.note} className={s.toast} role="status">
          {h.note}
        </div>
      )}
    </div>
  );
}

/** **…** in the config's words = the planet's colour */
function Emph({ text }: { text: string }) {
  return <>{text.split('**').map((t, i) => (i % 2 ? <b key={i}>{t}</b> : <span key={i}>{t}</span>))}</>;
}

const day = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const ICON: Record<PlanetHomeConfig['open'], string> = {
  sing: '🎤',
  view: '🖼',
  'play-audio': '🎵',
  'play-video': '🎬',
  read: '📖',
};

/** a work in the bottom sheet: who (ダチ / 推し / まだ知らない人), the work, 〔▶ 聞く〕〔♡ 推す〕〔とじる〕 */
function WorkSheet({
  w,
  cfg,
  young,
  playing,
  onPlay,
  onHeart,
  onClose,
}: {
  w: HomeWork;
  cfg: PlanetHomeConfig;
  young: boolean;
  playing: boolean;
  onPlay: () => void;
  onHeart: () => void;
  onClose: () => void;
}) {
  const [video, setVideo] = useState(false);
  const chip =
    w.rel === 'stranger' ? (
      <span className={s.chip} style={{ color: 'var(--ink-dim)' }}>
        まだ知らない人
      </span>
    ) : w.rel === 'oshi' ? (
      <span className={s.chip} style={{ color: 'var(--oshi)' }}>
        推し
      </span>
    ) : w.rel === 'dachi' ? (
      <span className={s.chip} style={{ color: 'var(--dachi)' }}>
        ダチ
      </span>
    ) : (
      <span className={s.chip} style={{ color: 'var(--mine)' }}>
        あなた
      </span>
    );
  const img = cfg.open === 'view' ? w.url || w.thumbUrl : w.thumbUrl;
  const heart = !w.demo && (w.rel === 'oshi' || (w.rel === 'stranger' && !young));
  return (
    <>
      <div className={s.who}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={w.author.pic || cfg.art.sprite} />
        <div>
          <div className={s.n}>{w.rel === 'own' ? 'あなた' : w.author.name}</div>
          {chip}
        </div>
      </div>
      <div className={s.card}>
        {video && w.url ? (
          <video src={w.url} poster={w.thumbUrl ?? undefined} controls autoPlay playsInline />
        ) : img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={img} />
        ) : (
          <div className={s.big}>{ICON[cfg.open]}</div>
        )}
        {(w.text || w.title) && <div className={s.cap}>「{w.title || w.text}」</div>}
      </div>
      <div className={s.acts}>
        {cfg.open !== 'view' && w.url && (
          <button type="button" onClick={() => (cfg.open === 'play-video' ? setVideo(true) : onPlay())}>
            {playing ? '■ 止める' : `▶ ${cfg.verb}`}
          </button>
        )}
        {heart && (
          <button type="button" className={w.rel === 'oshi' ? s.heartOn : ''} aria-pressed={w.rel === 'oshi'} onClick={onHeart}>
            {w.rel === 'oshi' ? '♥ 推し中' : '♡ 推す'}
          </button>
        )}
        <button type="button" onClick={onClose}>
          とじる
        </button>
      </div>
    </>
  );
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <>
      <div className={s.scrim} onClick={onClose} />
      <div className={s.sheet} role="dialog" aria-label="作品">
        <div className={s.grab} />
        {children}
      </div>
    </>
  );
}

const REASONS: [PlanetWorkReportBody['reason'], string][] = [
  ['mean', 'いやなことを言っている'],
  ['scary', 'こわい・あぶない'],
  ['other', 'そのほか'],
];
