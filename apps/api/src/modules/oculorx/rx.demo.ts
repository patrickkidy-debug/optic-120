import { rxCoefficientFor, rxSuggestedPrice, type RxGeometry } from '@oculo/shared-types';
import type { TenantPrisma } from '../../lib/prisma-tenant.js';
import { getRxSettings, nextOrderNumber } from './rx.service.js';

/*
 * Données de démonstration OculoRX : deux verriers FICTIFS, leurs catalogues
 * et une quinzaine de commandes sur le mois précédent et le mois en cours.
 * Tout est marqué (rxDemo / isDemo) et retiré d'un clic. Aucun email de
 * commande n'est configuré : rien n'est envoyé à qui que ce soit.
 */

type L = [string, string, RxGeometry, number, string, string, number, number, number, number | null, number | null, number];
const CATALOGS: { supplier: { name: string; code: string; city: string; country: string; deliveryDays: number; contactName: string }; lenses: L[] }[] = [
  {
    supplier: { name: 'Verrerie Atlantique', code: 'VAT', city: 'Dakar', country: 'Sénégal', deliveryDays: 3, contactName: 'Service commandes' },
    lenses: [
      ['VA-U150-DUR', 'Unifocal 1.50 durci', 'UNIFOCAL', 1.5, 'Organique', 'Durci', -6, 6, 2, null, null, 4500],
      ['VA-U150-AR', 'Unifocal 1.50 antireflet', 'UNIFOCAL', 1.5, 'Organique', 'Antireflet', -6, 6, 2, null, null, 7000],
      ['VA-U156-BLU', 'Unifocal 1.56 filtre lumière bleue', 'UNIFOCAL', 1.56, 'Organique', 'Filtre lumière bleue', -8, 6, 4, null, null, 9500],
      ['VA-U160-AR', 'Unifocal 1.60 aminci antireflet', 'UNIFOCAL', 1.6, 'Organique', 'Antireflet', -10, 8, 4, null, null, 14000],
      ['VA-U167-AR', 'Unifocal 1.67 très aminci antireflet', 'UNIFOCAL', 1.67, 'Organique', 'Antireflet', -12, 8, 4, null, null, 22000],
      ['VA-P150-AR', 'Progressif confort 1.50 antireflet', 'PROGRESSIF', 1.5, 'Organique', 'Antireflet', -6, 6, 2, 0.75, 3.5, 26000],
      ['VA-P160-BLU', 'Progressif premium 1.60 lumière bleue', 'PROGRESSIF', 1.6, 'Organique', 'Filtre lumière bleue', -8, 6, 4, 0.75, 3.5, 42000],
      ['VA-B150-DUR', 'Bifocal 28 mm 1.50 durci', 'BIFOCAL', 1.5, 'Organique', 'Durci', -6, 6, 2, 1, 3, 12000],
    ],
  },
  {
    supplier: { name: 'Lumen Optik Afrique', code: 'LOA', city: 'Abidjan', country: "Côte d'Ivoire", deliveryDays: 5, contactName: 'Atelier Lumen' },
    lenses: [
      ['LO-1.5-AR', 'Lumen Basic 1.5 AR', 'UNIFOCAL', 1.5, 'Organique', 'Antireflet', -6, 6, 2, null, null, 6500],
      ['LO-1.59-PC', 'Lumen Kid polycarbonate 1.59', 'UNIFOCAL', 1.59, 'Polycarbonate', 'Antireflet', -6, 6, 2, null, null, 11000],
      ['LO-1.6-PHO', 'Lumen Sun photochromique 1.6', 'UNIFOCAL', 1.6, 'Organique', 'Photochromique', -8, 6, 4, null, null, 19000],
      ['LO-1.67-BLU', 'Lumen Thin 1.67 lumière bleue', 'UNIFOCAL', 1.67, 'Organique', 'Filtre lumière bleue', -12, 8, 4, null, null, 24000],
      ['LO-PRO-1.5', 'Lumen Pro progressif 1.5', 'PROGRESSIF', 1.5, 'Organique', 'Antireflet', -6, 6, 2, 0.75, 3.5, 24000],
      ['LO-PRO-1.67', 'Lumen Pro progressif 1.67', 'PROGRESSIF', 1.67, 'Organique', 'Antireflet', -10, 8, 4, 0.75, 3.5, 52000],
      ['LO-DEG-1.6', 'Lumen Office dégressif 1.6', 'DEGRESSIF', 1.6, 'Organique', 'Filtre lumière bleue', -6, 6, 2, 0.75, 2.5, 30000],
    ],
  },
];

// Patients fictifs : [nom, sph OD, cyl OD, axe OD, sph OG, cyl OG, axe OG, addition]
const PATIENTS: [string, number, number, number, number, number, number, number | null][] = [
  ['Aminata Diop', -1.25, -0.5, 90, -1.5, -0.25, 85, null],
  ['Moussa Koné', 1.5, 0, 0, 1.25, 0, 0, 2],
  ['Fatou Sarr', -2.75, -1, 175, -3, -0.75, 10, null],
  ['Ibrahima Ndiaye', 0.75, -0.5, 100, 1, -0.5, 80, 2.25],
  ['Mariam Camara', -0.5, 0, 0, -0.75, 0, 0, null],
  ['Cheikh Ba', 2, -0.75, 45, 2.25, -0.5, 135, 2.5],
  ['Awa Ndoye', -4.25, -1.25, 5, -4, -1, 175, null],
  ['Ousmane Fall', 0.25, 0, 0, 0.5, 0, 0, 1.75],
  ['Kadiatou Traoré', -1, -0.25, 160, -1.25, 0, 0, null],
  ['Yao Kouassi', 1.75, -0.25, 90, 1.5, -0.5, 95, 2],
  ['Adjoua Konan', -6.5, -1.5, 180, -6, -1.25, 0, null],
  ['Seydou Diallo', 0, -0.75, 90, 0.25, -0.5, 90, 2.25],
  ['Mame Diarra Sy', -2, 0, 0, -2.25, -0.25, 170, null],
  ['Koffi Yao', 1, 0, 0, 1.25, -0.25, 90, 1.5],
  ['Binta Gueye', -3.5, -0.5, 15, -3.25, -0.75, 165, null],
];

export async function seedRxDemo(db: TenantPrisma, tenantId: string, by: string) {
  const already = await db.supplier.count({ where: { rxDemo: true } });
  if (already > 0) return { created: false };
  const settings = await getRxSettings(db);
  const lenses: { id: string; supplierId: string; purchasePrice: number; geometry: string; reference: string; designation: string; lensIndex: number; material: string; treatment: string; coef: number }[] = [];
  for (const cat of CATALOGS) {
    const s = await db.supplier.create({ data: { ...cat.supplier, tenantId, rxDemo: true, categories: ['VERRE'], notes: 'Fournisseur fictif — démonstration OculoRX' } as never });
    for (const [reference, designation, geometry, lensIndex, material, treatment, sphMin, sphMax, cylMax, addMin, addMax, purchasePrice] of cat.lenses) {
      const l = await db.rxLens.create({
        data: { tenantId, supplierId: s.id, reference, designation, geometry, lensIndex, material, treatment, diameter: 70, sphMin, sphMax, cylMax, addMin, addMax, purchasePrice, isDemo: true } as never,
      });
      lenses.push({ id: l.id, supplierId: s.id, purchasePrice, geometry, reference, designation, lensIndex, material, treatment, coef: rxCoefficientFor(settings, null, geometry) });
    }
  }

  const now = new Date();
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const curStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const daysCur = Math.max(1, Math.floor((now.getTime() - curStart.getTime()) / 86_400_000));
  // 8 commandes le mois précédent, 7 ce mois-ci (jusqu'à aujourd'hui).
  const dates = [
    ...[2, 5, 8, 11, 14, 18, 22, 26].map((d) => new Date(prevStart.getTime() + (d - 1) * 86_400_000 + 10 * 3_600_000)),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => new Date(curStart.getTime() + Math.floor((i * daysCur) / 7) * 86_400_000 + (9 + i) * 3_600_000)),
  ];
  const statusFor = (i: number) => {
    if (i === 3) return 'CANCELLED';
    if (i === 6) return 'RETURNED';
    if (i < 8) return 'DELIVERED';
    return ['DELIVERED', 'DELIVERED', 'SHIPPED', 'IN_PRODUCTION', 'IN_PRODUCTION', 'SENT', 'SENT'][i - 8];
  };
  const flow = ['SENT', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED'];
  for (let i = 0; i < PATIENTS.length; i++) {
    const [name, odS, odC, odA, ogS, ogC, ogA, add] = PATIENTS[i];
    const pool = lenses.filter((l) => (add != null ? l.geometry !== 'UNIFOCAL' : l.geometry === 'UNIFOCAL'));
    const lens = pool[i % pool.length];
    const at = dates[i];
    const mounted = i % 3 === 0;
    const urgent = i % 5 === 2;
    const supplements = [...(mounted ? [{ label: 'Taillé-monté', amount: settings.mountedFee }] : []), ...(urgent ? [{ label: 'Urgence', amount: settings.urgentFee }] : [])];
    const purchasePrice = lens.purchasePrice * 2 + supplements.reduce((s, x) => s + x.amount, 0);
    const salePrice = rxSuggestedPrice(lens.purchasePrice, lens.coef) * 2;
    const status = statusFor(i);
    const steps = status === 'CANCELLED' ? ['SENT', 'CANCELLED'] : status === 'RETURNED' ? [...flow, 'RETURNED'] : flow.slice(0, flow.indexOf(status) + 1);
    await db.rxOrder.create({
      data: {
        tenantId,
        number: await nextOrderNumber(db, at),
        userName: by,
        supplierId: lens.supplierId,
        lensId: lens.id,
        lensSnapshot: { reference: lens.reference, designation: lens.designation, geometry: lens.geometry, lensIndex: lens.lensIndex, material: lens.material, treatment: lens.treatment, unitPrice: lens.purchasePrice },
        patientName: name,
        fileNumber: `D-${1040 + i}`,
        od: { sph: odS, cyl: odC || null, axis: odC ? odA : null },
        og: { sph: ogS, cyl: ogC || null, axis: ogC ? ogA : null },
        addition: add,
        pd: 62 + (i % 5),
        height: add != null ? 20 + (i % 4) : null,
        frameType: ['CERCLEE', 'NYLOR', 'PERCEE'][i % 3],
        mounted,
        urgent,
        purchasePrice,
        supplements,
        salePrice,
        status,
        statusHistory: steps.map((st, k) => ({ status: st, at: new Date(at.getTime() + k * 2 * 86_400_000).toISOString(), by })),
        isDemo: true,
        createdAt: at,
      } as never,
    });
  }
  return { created: true, suppliers: CATALOGS.length, lenses: lenses.length, orders: PATIENTS.length };
}

export async function clearRxDemo(db: TenantPrisma) {
  const demo = await db.supplier.findMany({ where: { rxDemo: true }, select: { id: true } });
  const ids = demo.map((s) => s.id);
  const orders = await db.rxOrder.deleteMany({ where: { OR: [{ isDemo: true }, { supplierId: { in: ids } }] } });
  await db.rxStatement.deleteMany({ where: { OR: [{ isDemo: true }, { supplierId: { in: ids } }] } });
  const lenses = await db.rxLens.deleteMany({ where: { OR: [{ isDemo: true }, { supplierId: { in: ids } }] } });
  // Un fournisseur fictif déjà utilisé ailleurs (stock, OculoTrack…) est seulement archivé.
  let suppliers = 0;
  for (const id of ids) {
    const used = await db.supplier.findFirst({
      where: { id, OR: [{ lensOrders: { some: {} } }, { trackPackages: { some: {} } }, { stockMovements: { some: {} } }] },
      select: { id: true },
    });
    if (used) await db.supplier.updateMany({ where: { id }, data: { isActive: false, rxDemo: false } });
    else await db.supplier.deleteMany({ where: { id } });
    suppliers++;
  }
  return { orders: orders.count, lenses: lenses.count, suppliers };
}
