import type { FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  SaleType,
  saleCreateSchema,
  stockAdjustSchema,
  type SyncOpKind,
  type SyncOpResult,
  type SyncOperationInput,
} from '@oculo/shared-types';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import { HttpError, forbidden } from '../../lib/http-error.js';
import { assertBranchAccess } from '../../middlewares/rbac-guard.js';
import * as salesService from '../sales/sales.service.js';
import * as stockService from '../stock/stock.service.js';

/**
 * Application des opérations envoyées par les appareils.
 *
 * Garanties tenues, dans cet ordre :
 *
 *  1. MÊMES CONTRÔLES QU'EN LIGNE. Une opération faite hors-ligne passe par la
 *     même permission, le même contrôle de magasin et le même service métier
 *     que la route classique. Le hors-ligne n'ouvre aucune porte.
 *  2. IDEMPOTENCE. L'identifiant d'opération (créé sur l'appareil) est
 *     réservé AVANT d'agir, par l'insertion d'une ligne dont il est la clé
 *     primaire. Un second envoi du même `opId` bute sur cette clé : il reçoit
 *     le résultat déjà obtenu, ou « réessayer plus tard » si le premier envoi
 *     est encore en cours. Jamais une deuxième exécution.
 *  3. RIEN N'EST PERDU. Une panne transitoire (base indisponible, délai
 *     dépassé) libère la réservation : l'appareil garde l'opération et la
 *     renverra. Seul un refus métier ou de droits est définitif — et il est
 *     conservé pour être montré au gérant, pas effacé.
 */

type Handler = (req: FastifyRequest, op: SyncOperationInput) => Promise<{
  entityId?: string;
  result: Record<string, unknown>;
}>;

const auth = (req: FastifyRequest) => req.auth!;

function requireAny(req: FastifyRequest, perms: string[]): void {
  if (!perms.some((p) => auth(req).permissions.has(p))) {
    throw forbidden(`Permission requise : ${perms.join(' ou ')}`);
  }
}

const saleCreatePayload = saleCreateSchema.extend({ id: z.string().uuid() });
const stockAdjustPayload = stockAdjustSchema.extend({
  productId: z.string().uuid(),
  branchId: z.string().uuid(),
});

const HANDLERS: Record<SyncOpKind, Handler> = {
  /**
   * Vente ou devis créé sur l'appareil. L'identifiant vient de l'appareil :
   * la vente affichée localement et la vente enregistrée sont la même.
   */
  SALE_CREATE: async (req, op) => {
    const input = saleCreatePayload.parse(op.payload);
    requireAny(
      req,
      input.type === SaleType.QUOTE
        ? ['optique.quotes.create', 'optique.sales.create']
        : ['optique.sales.create'],
    );
    assertBranchAccess(req, input.branchId);

    // Filet de sécurité : la vente existe déjà mais le journal ne l'a pas
    // retenu (arrêt du serveur entre les deux écritures). On la reconnaît au
    // lieu d'échouer sur la clé primaire ou, pire, d'en créer une autre.
    const existing = await prisma.sale.findFirst({
      where: { id: input.id, tenantId: auth(req).tenantId },
      select: { id: true, number: true },
    });
    if (existing) return { entityId: existing.id, result: { saleId: existing.id, number: existing.number } };

    const { id, ...saleInput } = input;
    const sale = await salesService.createSale(auth(req).tenantId, auth(req).userId, saleInput, { id });
    await recordAudit({
      tenantId: auth(req).tenantId,
      userId: auth(req).userId,
      action: input.type === SaleType.QUOTE ? 'QUOTE_CREATED' : 'SALE_CREATED',
      entity: 'Sale',
      entityId: sale.id,
      metadata: { number: sale.number, total: Number(sale.totalAmount), offline: true, opId: op.opId },
      ...requestMeta(req),
    });
    return { entityId: sale.id, result: { saleId: sale.id, number: sale.number } };
  },

  /**
   * Mouvement de stock (entrée, sortie, ajustement). Voyage comme une
   * VARIATION, jamais comme une quantité absolue : deux appareils qui retirent
   * chacun une pièce retirent deux pièces, quel que soit l'ordre d'arrivée.
   */
  STOCK_ADJUST: async (req, op) => {
    const input = stockAdjustPayload.parse(op.payload);
    requireAny(req, ['optique.stock.adjust']);
    assertBranchAccess(req, input.branchId);
    const item = await stockService.adjustStock(auth(req).tenantId, input, auth(req).userId);
    return { entityId: item.id, result: { stockItemId: item.id, quantity: item.quantity } };
  },
};

function isDuplicateKey(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

/**
 * Un refus DÉFINITIF : l'opération renvoyée donnerait le même résultat.
 * Tout le reste (panne, délai, abonnement à régulariser, trop de requêtes) est
 * transitoire : l'appareil réessaiera.
 */
function isDefinitive(e: unknown): boolean {
  if (e instanceof ZodError) return true;
  if (e instanceof HttpError) {
    return e.statusCode >= 400 && e.statusCode < 500 && ![402, 408, 429].includes(e.statusCode);
  }
  return false;
}

function messageOf(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? 'Données invalides';
  if (e instanceof Error) return e.message;
  return 'Erreur inconnue';
}

export async function applyOperation(
  req: FastifyRequest,
  deviceId: string,
  op: SyncOperationInput,
): Promise<SyncOpResult> {
  const { tenantId, userId } = auth(req);

  // 1. Réservation de l'opId.
  try {
    await prisma.syncOperation.create({
      data: {
        id: op.opId,
        tenantId,
        userId,
        deviceId,
        kind: op.kind,
        entityId: op.entityId ?? null,
        status: 'PROCESSING',
        clientCreatedAt: new Date(op.createdAt),
      },
    });
  } catch (e) {
    if (!isDuplicateKey(e)) throw e;
    // Déjà vue : on rend ce qu'on sait, sans rejouer.
    const known = await prisma.syncOperation.findUnique({ where: { id: op.opId } });
    // Un opId d'un autre établissement ne donne rien : ni résultat, ni indice.
    if (!known || known.tenantId !== tenantId) {
      return { opId: op.opId, outcome: 'REJECTED', error: 'Identifiant d’opération déjà utilisé' };
    }
    if (known.status === 'APPLIED') {
      return { opId: op.opId, outcome: 'APPLIED', result: (known.result ?? {}) as Record<string, unknown> };
    }
    if (known.status === 'REJECTED') {
      return { opId: op.opId, outcome: 'REJECTED', error: known.error ?? 'Opération refusée' };
    }
    return { opId: op.opId, outcome: 'RETRY', error: 'Opération en cours de traitement' };
  }

  // 2. Application.
  try {
    const { entityId, result } = await HANDLERS[op.kind](req, op);
    await prisma.syncOperation.update({
      where: { id: op.opId },
      data: { status: 'APPLIED', entityId: entityId ?? op.entityId ?? null, result: result as object },
    });
    return { opId: op.opId, outcome: 'APPLIED', result };
  } catch (e) {
    if (isDefinitive(e)) {
      const error = messageOf(e);
      await prisma.syncOperation.update({
        where: { id: op.opId },
        data: { status: 'REJECTED', error },
      });
      return { opId: op.opId, outcome: 'REJECTED', error };
    }
    // 3. Transitoire : on libère la réservation pour permettre le renvoi.
    logger.warn({ err: e, opId: op.opId, kind: op.kind }, 'Operation de synchronisation a reessayer');
    await prisma.syncOperation.delete({ where: { id: op.opId } }).catch(() => undefined);
    return { opId: op.opId, outcome: 'RETRY', error: 'Erreur temporaire, nouvel essai automatique' };
  }
}

/**
 * Applique un lot dans l'ORDRE de l'appareil : une vente saisie après une
 * entrée de stock doit trouver ce stock. Une opération refusée n'arrête pas
 * les suivantes ; une opération à réessayer, si — la suivante pourrait en
 * dépendre (ex. la vente d'une pièce qui vient d'être réceptionnée).
 */
export async function applyBatch(
  req: FastifyRequest,
  deviceId: string,
  operations: SyncOperationInput[],
): Promise<SyncOpResult[]> {
  const results: SyncOpResult[] = [];
  for (let i = 0; i < operations.length; i++) {
    const res = await applyOperation(req, deviceId, operations[i]);
    results.push(res);
    if (res.outcome === 'RETRY') {
      for (const rest of operations.slice(i + 1)) {
        results.push({ opId: rest.opId, outcome: 'RETRY', error: 'En attente d’une opération précédente' });
      }
      break;
    }
  }
  return results;
}

/** Opérations refusées de l'établissement, pour l'écran du gérant (§19). */
export async function listRejected(tenantId: string, limit = 100) {
  return prisma.syncOperation.findMany({
    where: { tenantId, status: 'REJECTED' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      kind: true,
      entityId: true,
      deviceId: true,
      userId: true,
      error: true,
      clientCreatedAt: true,
      createdAt: true,
    },
  });
}
