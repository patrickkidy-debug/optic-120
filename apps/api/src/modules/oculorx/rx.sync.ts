import type { Prisma } from '@prisma/client';
import { rxIsForward, rxStatusFromLensStatus, type RxStatus } from '@oculo/shared-types';
import type { TenantPrisma } from '../../lib/prisma-tenant.js';

/**
 * Une commande de verres liée à OculoRX a avancé (Kanban « Commandes de
 * verres » ou étape OculoTrack) : la commande OculoRX suit, sans jamais
 * reculer ni sortir d'un statut final.
 */
export async function syncRxFromLensOrders(db: TenantPrisma, lensOrderIds: string[], lensStatus: string, by: string) {
  const target = rxStatusFromLensStatus(lensStatus);
  if (!target || !lensOrderIds.length) return;
  const orders = await db.rxOrder.findMany({ where: { lensOrderId: { in: lensOrderIds } }, select: { id: true, status: true, statusHistory: true } });
  for (const o of orders) {
    if (!rxIsForward(o.status as RxStatus, target)) continue;
    const history = [...((o.statusHistory as unknown[]) ?? []), { status: target, at: new Date().toISOString(), by, note: 'Synchronisé depuis la commande de verres / OculoTrack' }];
    await db.rxOrder.updateMany({ where: { id: o.id }, data: { status: target, statusHistory: history as Prisma.InputJsonValue } });
  }
}
