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
