import { cookies, headers } from 'next/headers';
import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from './index';

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return negotiateLocale((await headers()).get('accept-language'));
}
