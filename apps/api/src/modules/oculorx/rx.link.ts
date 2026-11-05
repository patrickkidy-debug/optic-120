import { RX_GEOMETRY_LABELS, RX_TO_LENS_STATUS, rxDiopter, type RxGeometry, type RxStatus } from '@oculo/shared-types';
import type { TenantPrisma } from '../../lib/prisma-tenant.js';
import { nextSeriesNumber, numberSeriesPrefix } from '../../lib/document-number.js';
import { startTracking, type Actor } from '../oculotrack/track.service.js';
import { logger } from '../../lib/logger.js';

type Eye = { sph?: number | null; cyl?: number | null; axis?: number | null };
const eyeText = (e: Eye, add: number | null) =>
  [rxDiopter(e.sph), e.cyl ? `(${rxDiopter(e.cyl)}) ${e.axis ?? 0}°` : '', add != null ? `add ${rxDiopter(add)}` : ''].filter(Boolean).join(' ');
const indexKey = (i: number | null) => (i == null ? undefined : (['1.5', '1.53', '1.59', '1.6', '1.67', '1.74'] as const).find((k) => Number(k) === i));

/**
 * Crée la « Commande de verres » (Kanban) d'une commande OculoRX et active
 * son suivi OculoTrack : le colis, le laboratoire et le retour se suivent
 * ensuite avec les outils existants. Un échec ici n'annule pas la commande.
 */
export async function createLinkedLensOrder(
  db: TenantPrisma,
  tenantId: string,
  rx: {
    id: string;
    number: string;
    customerId: string | null;
    patientName: string;
    supplierId: string;
    od: unknown;
    og: unknown;
    addition: number | null;
    purchasePrice: number;
    comment: string | null;
    lensSnapshot: unknown;
  },
  supplier: { id: string; name: string; deliveryDays: number | null },
  actor: Actor,
): Promise<{ lensOrderId: string; number: string; trackCode: string | null } | null> {
  try {
    const lens = rx.lensSnapshot as { reference: string; designation: string; geometry: string; lensIndex: number | null; material: string | null };
    const od = rx.od as Eye;
    const og = rx.og as Eye;
    const year = new Date().getFullYear();
    const expectedAt = supplier.deliveryDays ? new Date(Date.now() + supplier.deliveryDays * 86_400_000) : null;
    let created: { id: string; number: string } | null = null;
    for (let attempt = 0; attempt < 4 && !created; attempt++) {
      const [last] = await db.lensOrder.findMany({ where: { number: { startsWith: numberSeriesPrefix('LO', year) } }, orderBy: { number: 'desc' }, take: 1, select: { number: true } });
      try {
        created = await db.lensOrder.create({
          data: {
            tenantId,
            number: nextSeriesNumber('LO', year, last?.number, 5),
            customerId: rx.customerId,
            category: 'VERRES',
            supplierId: supplier.id,
            supplierName: supplier.name,
            description: `${lens.designation} (${lens.reference})`,
            odLens: eyeText(od, rx.addition),
            ogLens: eyeText(og, rx.addition),
            status: 'ORDERED',
            expectedAt,
            notes: `Commande OculoRX ${rx.number} · patient ${rx.patientName}${rx.comment ? ` · ${rx.comment}` : ''}`,
            lensConfig: {
              lensType: RX_GEOMETRY_LABELS[lens.geometry as RxGeometry] ?? lens.geometry,
              ...(lens.material ? { material: lens.material } : {}),
              ...(indexKey(lens.lensIndex) ? { index: indexKey(lens.lensIndex) } : {}),
              treatments: [],
              prescription: {
                sameForBoth: false,
                od: { ...(od.sph != null ? { sphere: od.sph } : {}), ...(od.cyl != null ? { cylinder: od.cyl } : {}), ...(od.axis != null ? { axis: od.axis } : {}), ...(rx.addition != null ? { addition: rx.addition } : {}) },
                og: { ...(og.sph != null ? { sphere: og.sph } : {}), ...(og.cyl != null ? { cylinder: og.cyl } : {}), ...(og.axis != null ? { axis: og.axis } : {}), ...(rx.addition != null ? { addition: rx.addition } : {}) },
              },
            },
            createdById: actor.type === 'STAFF' ? actor.id ?? null : null,
          } as never,
          select: { id: true, number: true },
        });
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e;
      }
    }
    if (!created) return null;
    const trackCode = await startTracking(db, tenantId, created.id, { supplierId: supplier.id, expectedAt: expectedAt?.toISOString() ?? null, note: `Commande OculoRX ${rx.number}` }, actor);
    await db.rxOrder.updateMany({ where: { id: rx.id }, data: { lensOrderId: created.id } });
    return { lensOrderId: created.id, number: created.number, trackCode };
  } catch (e) {
    logger.warn({ err: e, rx: rx.number }, 'OculoRX : commande de verres liée non créée');
    return null;
  }
}

/** Le statut OculoRX change : la commande de verres liée suit. */
export async function syncLensOrderFromRx(db: TenantPrisma, lensOrderId: string | null, status: RxStatus) {
  const lensStatus = RX_TO_LENS_STATUS[status];
  if (!lensOrderId || !lensStatus) return;
  await db.lensOrder.updateMany({ where: { id: lensOrderId }, data: { status: lensStatus as never } });
}
