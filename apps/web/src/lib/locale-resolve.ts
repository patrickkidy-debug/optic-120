import { SUPPORTED_COUNTRIES } from '@oculo/shared-types';

export const LOCALES = [
  { code: 'fr', label: 'Français', short: 'FR', flag: '🇫🇷', htmlLang: 'fr' },
  { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧', htmlLang: 'en' },
  { code: 'pt', label: 'Português', short: 'PT', flag: '🇵🇹', htmlLang: 'pt' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: LocaleCode = 'fr';
export const LOCALE_STORAGE_KEY = 'oculo_locale';
/** Écrit par la fonction edge Netlify d'après l'IP (GeoIP). */
export const COUNTRY_COOKIE = 'oculo_country';

export function isSupportedLocale(v: unknown): v is LocaleCode {
  return typeof v === 'string' && LOCALES.some((l) => l.code === v);
}

/**
 * Langue officielle du pays, pour les 18 pays où l'inscription fonctionne.
 * Un pays non servi n'a pas de correspondance : on retombe sur la langue du
 * navigateur plutôt que d'inventer une préférence.
 */
export function localeForCountry(countryCode?: string | null): LocaleCode | null {
  if (!countryCode) return null;
  const c = SUPPORTED_COUNTRIES.find((x) => x.code === countryCode.toUpperCase());
  return c && isSupportedLocale(c.locale) ? c.locale : null;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Première langue supportée parmi les préférences du navigateur. */
function localeFromNavigator(): LocaleCode | null {
  if (typeof navigator === 'undefined') return null;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    if (!tag) continue;
    const base = tag.toLowerCase().split('-')[0];
    if (isSupportedLocale(base)) return base;
  }
  return null;
}

/** Langue déduite d'un préfixe d'URL localisée (/fr, /en, /pt). */
export function localeFromPath(pathname: string): LocaleCode | null {
  const seg = pathname.split('/')[1]?.toLowerCase();
  return isSupportedLocale(seg) ? seg : null;
}

export interface ResolvedLocale {
  locale: LocaleCode;
  /** D'où vient la décision — utile au débogage et aux tests. */
  source: 'url' | 'stored' | 'geo' | 'navigator' | 'default';
}

/**
 * Choisit la langue à afficher.
 *
 * Ordre volontaire :
 *   1. préfixe d'URL — un lien partagé /pt doit s'ouvrir en portugais ;
 *   2. choix manuel mémorisé — il prime toujours sur toute détection ;
 *   3. pays via GeoIP (cookie posé par la fonction edge) — un opticien de
 *      Luanda dont le téléphone est en anglais doit voir le portugais ;
 *   4. langue du navigateur ;
 *   5. français.
 */
export function resolveLocale(pathname?: string): ResolvedLocale {
  const fromPath = pathname ? localeFromPath(pathname) : null;
  if (fromPath) return { locale: fromPath, source: 'url' };

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    /* stockage indisponible (navigation privée) : on poursuit sans */
  }
  if (isSupportedLocale(stored)) return { locale: stored, source: 'stored' };

  const geo = localeForCountry(readCookie(COUNTRY_COOKIE));
  if (geo) return { locale: geo, source: 'geo' };

  const nav = localeFromNavigator();
  if (nav) return { locale: nav, source: 'navigator' };

  return { locale: DEFAULT_LOCALE, source: 'default' };
}
