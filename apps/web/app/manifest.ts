import type { MetadataRoute } from 'next';

/** PWA manifest (spec §4.1). Service worker / Web Push are PLACEHOLDER (P-PWA-1). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Obolo Order',
    short_name: 'Obolo',
    description: 'A social solar system connected by sound',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#04050d',
    theme_color: '#04050d',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
