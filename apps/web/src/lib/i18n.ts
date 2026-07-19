import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isSupportedLocale,
  resolveLocale,
  type LocaleCode,
} from './locale-resolve';

export { LOCALES, DEFAULT_LOCALE, isSupportedLocale, resolveLocale };
export type { LocaleCode };

/**
 * Chargement à la demande : une seule langue part sur le réseau au lieu des
 * trois (~14 kB chacune). Vite crée un chunk par fichier grâce au glob.
 */
const BUNDLES = import.meta.glob<{ default: Record<string, unknown> }>('../locales/*.json');

function bundleFor(locale: LocaleCode) {
  return BUNDLES[`../locales/${locale}.json`];
}

const loaded = new Set<string>();

/** Charge et enregistre une langue (idempotent — le cache évite tout re-fetch). */
export async function loadLocale(locale: LocaleCode): Promise<void> {
  if (loaded.has(locale)) return;
  const loader = bundleFor(locale);
  if (!loader) return;
  const mod = await loader();
  i18n.addResourceBundle(locale, 'translation', mod.default, true, true);
  loaded.add(locale);
}

/**
 * Change la langue : charge le bundle si besoin, met à jour i18next, mémorise
 * le choix (il primera sur toute détection ultérieure) et corrige `<html lang>`
 * pour les lecteurs d'écran et les moteurs de recherche.
 */
export async function setLocale(locale: LocaleCode): Promise<void> {
  await loadLocale(locale);
  await i18n.changeLanguage(locale);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* stockage indisponible : le choix vaut pour la session en cours */
  }
  document.documentElement.lang = locale;
}

/**
 * À appeler AVANT le premier rendu de React. Sans cette attente, l'écran
 * s'afficherait une fraction de seconde avec les clés brutes ou la mauvaise
 * langue — ce que l'on veut précisément éviter.
 */
export async function initI18n(): Promise<LocaleCode> {
  const { locale } = resolveLocale(window.location.pathname);

  await i18n.use(initReactI18next).init({
    resources: {},
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    // Rien à afficher tant que le bundle n'est pas là : on l'attend juste après.
    react: { useSuspense: false },
    // Filet : les trois langues ont aujourd'hui des jeux de clés identiques, on
    // ne précharge donc pas le français en plus (ce serait ~5 kB pour rien).
    // Si une clé venait à manquer, on charge le repli à ce moment-là.
    saveMissing: true,
    missingKeyHandler: () => {
      void loadLocale(DEFAULT_LOCALE);
    },
  });

  await loadLocale(locale);

  document.documentElement.lang = locale;
  return locale;
}

export default i18n;
