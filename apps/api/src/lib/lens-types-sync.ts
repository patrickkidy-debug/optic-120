import { ProductCategory } from '@prisma/client';
import type { LensPricing } from '@oculo/shared-types';
import type { TenantPrisma } from './prisma-tenant.js';

/**
 * Types de verres de l'établissement (Réglages → Tarifs des verres) publiés
 * comme fiches produit « Verre » : ils apparaissent ainsi dans Produits, dans
 * Stock et dans la grille de la caisse, en plus du compositeur « Verre sur
 * mesure ». Référence stable « TYPE-<id> » : modifier un type met sa fiche à
 * jour ; le supprimer retire la fiche (désactivée si déjà vendue).
 */
const PREFIX = 'TYPE-';

function skuOf(id: string): string {
  return PREFIX + id.replace(/^custom-/, '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
}

/** Famille déduite du nom quand elle est sans ambiguïté (sinon : non renseignée). */
function familyOf(name: string): string | undefined {
  const t = name.toLowerCase();
  if (/progress|\bprg\b|\bvarilux\b/.test(t)) return 'PROGRESSIF';
  if (/double foyer|bifocal/.test(t)) return 'BIFOCAL';
  if (/d[ée]gressif|office|bureau/.test(t)) return 'ORDINATEUR';
  if (/photochrom|transition/.test(t)) return 'PHOTOCHROMIQUE';
  if (/solaire/.test(t)) return 'SOLAIRE';
  if (/mono|unifocal|simple vision|single/.test(t)) return 'UNIFOCAL';
  return undefined;
}

export async function syncLensTypeProducts(db: TenantPrisma, tenantId: string, pricing: LensPricing): Promise<void> {
  const types = (pricing.customTypes ?? []).filter((c) => c.name.trim());
  const wanted = new Set<string>();
  for (const c of types) {
    const sku = skuOf(c.id);
    wanted.add(sku);
    const family = familyOf(c.name);
    const attributes = { lensTypeId: c.id, ...(family ? { family } : {}) };
    await db.product.upsert({
      where: { tenantId_sku: { tenantId, sku } },
      update: { name: c.name.trim(), sellPrice: c.price, isActive: true, attributes },
      create: {
        tenantId,
        sku,
        category: ProductCategory.VERRE,
        name: c.name.trim(),
        sellPrice: c.price,
        buyPrice: 0,
        trackStock: false,
        attributes,
      },
    });
  }

  // Types retirés : fiche supprimée, ou seulement désactivée si déjà vendue.
  const stale = await db.product.findMany({
    where: { sku: { startsWith: PREFIX }, category: ProductCategory.VERRE, isActive: true },
    select: { id: true, sku: true },
  });
  for (const p of stale.filter((x) => !wanted.has(x.sku))) {
    const sold = await db.saleItem.count({ where: { productId: p.id } });
    if (sold > 0) await db.product.updateMany({ where: { id: p.id }, data: { isActive: false } });
    else await db.product.deleteMany({ where: { id: p.id } });
  }
}

/**
 * Rattrapage sans action de l'opticien : types de verres enregistrés avant la
 * publication automatique (ou jamais ré-enregistrés) sans fiche produit. Appelé
 * quand la caisse ou une vente charge le catalogue : deux lectures légères, et
 * la synchronisation complète seulement s'il manque une fiche ou un prix.
 */
export async function ensureLensTypeProducts(db: TenantPrisma, tenantId: string): Promise<void> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { lensPricing: true } });
  const pricing = tenant?.lensPricing as LensPricing | null;
  const types = (pricing?.customTypes ?? []).filter((c) => c.name.trim());
  if (!pricing || !types.length) return;
  const skus = types.map((c) => skuOf(c.id));
  const existing = await db.product.findMany({
    where: { sku: { in: skus }, category: ProductCategory.VERRE, isActive: true },
    select: { sku: true, name: true, sellPrice: true },
  });
  const bySku = new Map(existing.map((p) => [p.sku, p]));
  const outdated = types.some((c) => {
    const p = bySku.get(skuOf(c.id));
    return !p || p.name !== c.name.trim() || Number(p.sellPrice) !== Number(c.price);
  });
  if (outdated) await syncLensTypeProducts(db, tenantId, pricing);
}
