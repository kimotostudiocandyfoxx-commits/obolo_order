import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // the story's pictures are cached by the browser (QA 12 R33: a slow line showed stills late). A day, not a year:
  // a still is sometimes redrawn under the same name
  async headers() {
    return [
      { source: '/onboarding/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
      { source: '/story/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
      // the lists (the voices' manifest, the story parts) are asked again every time, so a new voice is heard at once,
      // and a voice redone under its own name comes within the hour (QA 13 R46); later rules win
      { source: '/story/:path*.json', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '/story/voices/:path*.json', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '/story/voices/lines/:file', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }] },
    ];
  },
};

export default nextConfig;
