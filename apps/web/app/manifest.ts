import type { MetadataRoute } from 'next';

/** PWA manifest (spec §4.1). The service worker (public/sw.js) handles Web Push for calls and mail. */
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
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
