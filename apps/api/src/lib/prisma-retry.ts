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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 *
 * Un court délai aléatoire sépare les tentatives : sans lui, plusieurs requêtes
 * parties au même instant se relancent toutes exactement en même temps,
 * recalculent toutes le même compte encore périmé (aucune n'a encore commité)
 * et se re-percutent — épuisant les tentatives même à concurrence modeste.
 * Le délai désynchronise les essais pour qu'une commite avant que les autres
 * ne relisent. (Pour la numérotation des ventes/devis/retours, la source
 * définitive est un verrou Postgres — voir sales.service.ts::nextNumber —
 * cette fonction reste le filet pour les numérotations qui n'ont pas de
 * transaction propre à verrouiller : commandes de verres, réparations, etc.)
 */
export async function retryOnDuplicateNumber<T>(fn: () => Promise<T>, attempts = 10): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (isDuplicateNumber(e) && i < attempts - 1) {
        await sleep(20 + Math.random() * 60);
        continue;
      }
      throw e;
    }
  }
  // Inatteignable : la dernière itération renvoie ou relance toujours.
  throw new Error('retryOnDuplicateNumber: tentatives épuisées');
}
