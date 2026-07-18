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

// Une langue inconnue en stockage (ancienne valeur, saisie manuelle) doit
// retomber sur le français plutôt que d'afficher des clés brutes.
const stored = localStorage.getItem('oculo_locale');

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    pt: { translation: pt },
  },
  lng: isSupportedLocale(stored) ? stored : 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export default i18n;
