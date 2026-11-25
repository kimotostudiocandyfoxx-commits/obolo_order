import { barePreview, linkDomain, linkKind, type LinkPreview } from '@obolo/shared';

/**
 * R12: the demo's link previews (no API: nothing is fetched from the browser). A few known places get canned words and
 * one of the app's own pictures, so the portals can be seen; any other link shows just its domain, as an unread page does.
 */
const CANNED: { test: RegExp; p: Partial<LinkPreview> }[] = [
  { test: /youtu\.?be/, p: { title: '月夜のピアノ — Moonlight Session (Live)', siteName: 'YouTube', description: 'OBOLO Records', image: '/planet-home/bg-neptune.webp' } },
  { test: /spotify\.com/, p: { title: '星屑ドライブ', siteName: 'Spotify', description: 'Mochi & Neo', image: '/planet-home/bg-mercury.webp' } },
  { test: /soundcloud\.com/, p: { title: 'night swim (demo)', siteName: 'SoundCloud', description: 'leo', image: '/planet-home/bg-uranus.webp' } },
  { test: /tabelog|cafe|kissa/, p: { title: '月見喫茶 しずく — 夜だけひらく喫茶店', siteName: '食べログ', description: '駅から歩いて5分。窓から月が見える席が人気です。', image: '/planet-home/bg-venus.webp', favicon: '/icon-192.png' } },
  { test: /./, p: { title: '星の海を旅するガイド — 土星の環のひみつ', siteName: 'Moon Journal', description: '土星の環は、氷のつぶでできています。', image: '/planet-home/bg-saturn.webp', favicon: '/icon-192.png' } },
];

export function demoUnfurl(url: string): LinkPreview {
  const bare = barePreview(url);
  // a link with "nopreview" in it stays bare (to see how a page that cannot be read looks)
  if (/nopreview/.test(url)) return bare;
  const hit = CANNED.find((c) => c.test.test(linkDomain(url)));
  return { ...bare, kind: linkKind(url), ...hit?.p, ok: true };
}
