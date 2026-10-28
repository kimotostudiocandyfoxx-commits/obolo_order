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
    ];
  },
};

export default nextConfig;
