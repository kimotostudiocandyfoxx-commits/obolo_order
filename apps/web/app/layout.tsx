import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n/client';
import { getLocale } from '@/lib/i18n/server';
import './globals.css';
import { SuspendedNotice } from '@/components/SuspendedNotice';
import { NoManaNotice } from '@/components/NoManaNotice';
import { NeoSpeaking } from '@/components/NeoSpeaking';
import { ConsentGate } from '@/components/ConsentGate';
import { JobToasts } from '@/components/JobToasts';
import { TesterBar } from '@/components/TesterBar';
import { AudioUnlock } from '@/components/AudioUnlock';
import { MicCheck } from '@/components/mic/MicCheck';

export const metadata: Metadata = {
  title: 'Obolo Order',
  description: 'A social solar system connected by sound — 音でつながる、ひとつの太陽系',
  applicationName: 'Obolo Order',
  appleWebApp: { capable: true, title: 'Obolo Order', statusBarStyle: 'black-translucent' },
  // client 2026-11-27: the golden eclipse (the client's own picture) as the app icon and as the picture a shared link shows
  icons: { icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }], apple: '/apple-touch-icon.png' },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://oboloorder-web.vercel.app'),
  openGraph: {
    type: 'website',
    siteName: 'Obolo Order',
    title: 'Obolo Order',
    description: '音でつながる、ひとつの太陽系',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'Obolo Order' }],
  },
  twitter: { card: 'summary_large_image', title: 'Obolo Order', description: '音でつながる、ひとつの太陽系', images: ['/og.jpg'] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#04050d',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <head>
        {/* rounded font of the client's picture (falls back to Hiragino Maru Gothic on iPad); the talk's (M-R232/M-R243): Zen Maru Gothic, the shout Dela Gothic One, the whisper Klee One */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;700;800;900&family=Shippori+Mincho:wght@500;600;700&family=Cormorant+Garamond:wght@300;500&family=Zen+Maru+Gothic:wght@500;700;900&family=Dela+Gothic+One&family=Klee+One:wght@600&family=Yusei+Magic&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <div className="starfield" aria-hidden />
        <div className="starfield layer2" aria-hidden />
        <I18nProvider locale={locale}>
          <AuthProvider>
            <div className="relative z-10">{children}</div>
            <SuspendedNotice />
            <NoManaNotice />
            <NeoSpeaking />
            <ConsentGate />
            <JobToasts />
            {/* iPad: the first real tap lets the voices sound */}
            <AudioUnlock />
            {/* 〔マイクをためす〕: opened from the settings and from every mic notice */}
            <MicCheck />
            {/* the tester entrance: only for accounts on the server's allowlist (Me.tester) */}
            <TesterBar />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
