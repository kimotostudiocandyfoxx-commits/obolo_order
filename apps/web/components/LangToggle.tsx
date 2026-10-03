'use client';

import { useI18n } from '@/lib/i18n/client';

export function LangToggle() {
  const { locale, setLocale, m } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
      className="chip bg-white/10 px-2.5 py-1 text-xs text-white/85"
      aria-label={m.common.language}
    >
      {locale === 'ja' ? 'EN' : '日本語'}
    </button>
  );
}
