import { useAuthStore } from '../store/auth';

/**
 * Fonctionnalités en avant-première : visibles uniquement pour ces comptes
 * le temps de les valider, avant ouverture à tous les établissements.
 * Textes en français seulement tant qu'elles sont en bêta.
 */
const BETA_EMAILS = new Set(['patrickkidy@gmail.com', 'puille.nicolas@gmail.com']);

/** Formule de garantie verres/monture : réservée à ce compte (même liste côté API). */
const WARRANTY_PLAN_EMAILS = new Set(['patrickkidy@gmail.com']);

export function useWarrantyPlan(): boolean {
  return useAuthStore((s) => WARRANTY_PLAN_EMAILS.has((s.user?.email ?? '').toLowerCase()));
}

/** Vrai si l'utilisateur connecté voit le « dossier de vente » détaillé (prismes, duplication…). */
export function useBeta(): boolean {
  return useAuthStore((s) => BETA_EMAILS.has((s.user?.email ?? '').toLowerCase()));
}

/** Types de vision proposés sur l'ordonnance détaillée. */
export const VISION_TYPES = [
  { value: 'LOIN', label: 'Vision de loin' },
  { value: 'PRES', label: 'Vision de près' },
  { value: 'MI_DISTANCE', label: 'Mi-distance' },
  { value: 'PROGRESSIF', label: 'Progressif' },
] as const;

/** Motifs de visite proposés sur le devis (saisie libre aussi possible). */
export const VISIT_REASONS = [
  'Renouvellement',
  'Première paire',
  'Contrôle de la vue',
  'Casse / perte',
  'Changement de monture',
  'Lentilles de contact',
  'Solaire',
  'Réparation / SAV',
] as const;
