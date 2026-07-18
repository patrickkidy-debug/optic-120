import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from '../locales/fr.json';
import en from '../locales/en.json';
import pt from '../locales/pt.json';

/**
 * Langues proposées dans l'application. Source unique : le sélecteur de la
 * barre supérieure et celui des Réglages lisent cette liste — ajouter une
 * langue ici (plus son fichier dans `locales/`) suffit à l'exposer partout.
 *
 * Le portugais vise les membres lusophones de la CEDEAO (Cap-Vert,
 * Guinée-Bissau) : c'est donc du portugais européen — « utilizador »,
 * « guardar », « definições » — et non brésilien.
 */
export const LOCALES = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'pt', label: 'Português', short: 'PT' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export function isSupportedLocale(v: string | null | undefined): v is LocaleCode {
  return !!v && LOCALES.some((l) => l.code === v);
}

/**
 * Langue déduite du navigateur, au premier passage seulement.
 *
 * Un visiteur de Luanda, Maputo, Praia ou Bissau arrive avec `pt-*` : il doit
 * voir la vitrine et l'inscription dans sa langue sans rien cliquer. Dès qu'il
 * choisit une langue, ce choix est stocké et prime sur la détection.
 *
 * `navigator.languages` est parcouru dans l'ordre de préférence de l'utilisateur.
 */
function detectLocale(): LocaleCode {
  if (typeof navigator === 'undefined') return 'fr';
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean);
  for (const tag of candidates) {
    const base = tag.toLowerCase().split('-')[0];
    if (isSupportedLocale(base)) return base;
  }
  return 'fr';
}

// Une langue inconnue en stockage (ancienne valeur, saisie manuelle) doit
// retomber sur la détection plutôt que d'afficher des clés brutes.
const stored = localStorage.getItem('oculo_locale');
const initialLocale: LocaleCode = isSupportedLocale(stored) ? stored : detectLocale();

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    pt: { translation: pt },
  },
  lng: initialLocale,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

/** Langue retenue au demarrage (choix memorise, sinon detection navigateur). */
export const INITIAL_LOCALE = initialLocale;

export default i18n;
