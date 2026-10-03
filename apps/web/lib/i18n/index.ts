import { DEFAULT_LOCALE, LOCALES, type Locale } from '@obolo/shared';
import en from './en';
import ja, { type Messages } from './ja';

export const MESSAGES: Record<Locale, Messages> = { ja, en };
export const LOCALE_COOKIE = 'obolo_locale';
export { LOCALES, DEFAULT_LOCALE, type Locale, type Messages };

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

/** Picks a supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  for (const part of (acceptLanguage ?? '').split(',')) {
    const tag = part.split(';')[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
