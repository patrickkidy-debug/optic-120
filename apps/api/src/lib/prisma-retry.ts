import { Prisma } from '@prisma/client';

/** Vrai si l'erreur est une violation d'unicité Prisma portant sur le champ `number`. */
function isDuplicateNumber(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = (e.meta?.target ?? []) as string[] | string;
    const t = Array.isArray(target) ? target.join(',') : String(target);
    return t.includes('number');
  }
  return false;
}

/**
 * Rejoue `fn` quand la génération d'un numéro séquentiel (basée sur un `count()`)
 * entre en collision avec une opération concurrente sur la contrainte unique
 * `[tenantId, number]`. Sans ce filet, deux ventes (ou devis, commandes de verres,
 * réparations, factures) créées au même instant par deux caissiers échouent ;
 * ici la seconde tentative recalcule un nouveau numéro et réussit.
 *
 * La fonction fournie doit être ré-exécutable sans effet de bord partiel : en
 * pratique elle enveloppe un `prisma.$transaction(...)`, entièrement annulé en
 * cas d'erreur, donc rejouable sans risque.
 */
export async function retryOnDuplicateNumber<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (isDuplicateNumber(e) && i < attempts - 1) continue;
      throw e;
    }
  }
  // Inatteignable : la dernière itération renvoie ou relance toujours.
  throw new Error('retryOnDuplicateNumber: tentatives épuisées');
}
