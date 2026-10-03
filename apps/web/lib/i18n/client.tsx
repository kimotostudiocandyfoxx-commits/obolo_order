'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { format, LOCALE_COOKIE, MESSAGES, type Locale, type Messages } from './index';

interface I18nValue {
  locale: Locale;
  m: Messages;
  t: (template: string, vars?: Record<string, string | number>) => string;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const setLocale = useCallback(
    (l: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router],
  );
  const value = useMemo<I18nValue>(() => ({ locale, m: MESSAGES[locale], t: format, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

/** Localised relative time ("3分前"). */
export function useTimeAgo() {
  const { m, t } = useI18n();
  return (iso: string) => {
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return m.common.justNow;
    if (s < 3600) return t(m.common.minutesAgo, { n: Math.floor(s / 60) });
    if (s < 86400) return t(m.common.hoursAgo, { n: Math.floor(s / 3600) });
    return t(m.common.daysAgo, { n: Math.floor(s / 86400) });
  };
}
