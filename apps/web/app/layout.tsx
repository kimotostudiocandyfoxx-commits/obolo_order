import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n/client';
import { getLocale } from '@/lib/i18n/server';
import './globals.css';
import { SuspendedNotice } from '@/components/SuspendedNotice';

export const metadata: Metadata = {
  title: 'Obolo Order',
  description: 'A social solar system connected by sound — 音でつながる、ひとつの太陽系',
  applicationName: 'Obolo Order',
  appleWebApp: { capable: true, title: 'Obolo Order', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
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
        {/* rounded font of the client's picture (falls back to Hiragino Maru Gothic on iPad) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <div className="starfield" aria-hidden />
        <div className="starfield layer2" aria-hidden />
        <I18nProvider locale={locale}>
          <AuthProvider>
            <div className="relative z-10">{children}</div>
            <SuspendedNotice />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
