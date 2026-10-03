import i18n from 'i18next';

/**
 * Traduction d'un texte d'interface, lue au moment du rendu.
 *
 * Utilisable partout (composants, fonctions, getters de constantes) sans hook :
 * l'application entière est remontée au changement de langue (voir main.tsx),
 * donc chaque texte est relu dans la nouvelle langue.
 */
export function tr(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options) as string;
}
