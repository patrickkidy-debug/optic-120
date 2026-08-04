import { DEFAULT_OPTICAL_SETTINGS, type OpticalSettings } from '@oculo/shared-types';
import { prisma } from './prisma.js';

/**
 * Réglages métier du cabinet (validité des ordonnances, délais de relance,
 * garantie par défaut, valeur du point de fidélité). Les valeurs absentes
 * retombent sur les valeurs par défaut : un établissement qui n'a rien
 * configuré garde le comportement historique.
 */
export async function getOpticalSettings(tenantId: string): Promise<OpticalSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { opticalSettings: true },
  });
  return mergeOpticalSettings(tenant?.opticalSettings);
}

/** Fusionne des réglages stockés (JSON libre) avec les valeurs par défaut. */
export function mergeOpticalSettings(raw: unknown): OpticalSettings {
  const stored = (raw ?? {}) as Partial<OpticalSettings>;
  return { ...DEFAULT_OPTICAL_SETTINGS, ...stored };
}

/** Ajoute un nombre de mois à une date (null si le nombre de mois est nul). */
export function addMonths(from: Date, months: number): Date | null {
  if (!months || months <= 0) return null;
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}
