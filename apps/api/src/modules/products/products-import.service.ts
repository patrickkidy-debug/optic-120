import * as XLSX from 'xlsx';
import { ProductCategory } from '@prisma/client';
import type { TenantPrisma } from '../../lib/prisma-tenant.js';

/** Préfixe de référence auto-générée par catégorie (identique à products.routes.ts). */
const SKU_PREFIX: Record<string, string> = {
  MONTURE: 'MON',
  VERRE: 'VER',
  LENTILLE: 'LEN',
  ACCESSOIRE: 'ACC',
  ENTRETIEN: 'ENT',
  SERVICE: 'SVC',
  AUTRE: 'DIV',
};

/**
 * Référence auto-générée (candidats aléatoires, repli horodaté) — extrait de
 * products.routes.ts pour être partagé entre la création classique et l'import.
 */
export async function generateSku(tx: Pick<TenantPrisma, 'product'>, category: string): Promise<string> {
  const prefix = SKU_PREFIX[category] ?? 'PRD';
  for (let i = 0; i < 6; i++) {
    const candidate = `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const clash = await tx.product.findFirst({ where: { sku: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// Retire les diacritiques (accents) sans dépendre d'un échappement Unicode
// littéral dans le code source : on filtre par code point (plage des marques
// combinantes 0x0300-0x036F) après décomposition NFD.
function stripAccents(s: string): string {
  const COMBINING_START = 0x0300;
  const COMBINING_END = 0x036f;
  let out = '';
  for (const ch of s.normalize('NFD')) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < COMBINING_START || code > COMBINING_END) out += ch;
  }
  return out;
}
function norm(s: string): string {
  return stripAccents(s).toLowerCase().trim();
}

type CanonicalField = 'sku' | 'name' | 'category' | 'brand' | 'buyPrice' | 'sellPrice' | 'stock';

/** Alias d'en-têtes (FR/EN, insensible casse/accents) reconnus par colonne. */
const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  sku: ['sku', 'reference', 'ref', 'code'],
  name: ['nom', 'designation', 'produit', 'article', 'name'],
  buyPrice: ["prix d'achat", 'prix achat', 'buy price', 'cost', 'cout'],
  sellPrice: ['prix de vente', 'prix vente', 'sell price', 'prix', 'price'],
  category: ['categorie', 'category', 'type'],
  brand: ['marque', 'brand'],
  stock: ['stock initial', 'stock', 'quantite', 'qty', 'quantity'],
};
// Ordre de détection : du plus spécifique au plus générique (ex. "prix d'achat"
// avant le générique "prix" de sellPrice), pour qu'une colonne ne soit jamais
// captée par le mauvais champ.
const DETECTION_ORDER: CanonicalField[] = ['sku', 'name', 'buyPrice', 'sellPrice', 'category', 'brand', 'stock'];

function detectColumns(sampleRow: Record<string, unknown>): Partial<Record<CanonicalField, string>> {
  const keys = Object.keys(sampleRow);
  const claimed = new Set<string>();
  const result: Partial<Record<CanonicalField, string>> = {};
  for (const field of DETECTION_ORDER) {
    const aliases = FIELD_ALIASES[field];
    const match = keys.find(
      (k) => !claimed.has(k) && aliases.some((a) => norm(k) === norm(a) || norm(k).includes(norm(a))),
    );
    if (match) {
      result[field] = match;
      claimed.add(match);
    }
  }
  return result;
}

const CATEGORY_ALIASES: Record<string, ProductCategory> = {
  monture: ProductCategory.MONTURE,
  montures: ProductCategory.MONTURE,
  frame: ProductCategory.MONTURE,
  frames: ProductCategory.MONTURE,
  verre: ProductCategory.VERRE,
  verres: ProductCategory.VERRE,
  lens: ProductCategory.VERRE,
  lenses: ProductCategory.VERRE,
  lentille: ProductCategory.LENTILLE,
  lentilles: ProductCategory.LENTILLE,
  contact: ProductCategory.LENTILLE,
  accessoire: ProductCategory.ACCESSOIRE,
  accessoires: ProductCategory.ACCESSOIRE,
  accessory: ProductCategory.ACCESSOIRE,
  entretien: ProductCategory.ENTRETIEN,
  maintenance: ProductCategory.ENTRETIEN,
  service: ProductCategory.SERVICE,
  services: ProductCategory.SERVICE,
  autre: ProductCategory.AUTRE,
  autres: ProductCategory.AUTRE,
  other: ProductCategory.AUTRE,
};

/** Texte libre -> catégorie connue ; repli sur AUTRE (jamais de ligne rejetée pour ça). */
export function normalizeCategory(raw: string | undefined): ProductCategory {
  if (!raw) return ProductCategory.AUTRE;
  const upper = raw.trim().toUpperCase();
  if ((Object.values(ProductCategory) as string[]).includes(upper)) return upper as ProductCategory;
  return CATEGORY_ALIASES[norm(raw)] ?? ProductCategory.AUTRE;
}

export interface ParsedProductRow {
  sku: string;
  name: string;
  category: ProductCategory;
  brand: string;
  buyPrice: number;
  sellPrice: number;
  stock: number | null;
}

/** Lit un .xlsx OU .csv (même lecteur) et détecte les colonnes — aucun accès base. */
export function parseImportFile(buffer: Buffer): ParsedProductRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (raw.length === 0) return [];
  const columns = detectColumns(raw[0]);

  const get = (row: Record<string, unknown>, field: CanonicalField): string => {
    const key = columns[field];
    return key ? String(row[key] ?? '').trim() : '';
  };
  const toNumber = (s: string): number => {
    const n = Number(s.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  return raw.map((row) => {
    const stockRaw = get(row, 'stock');
    return {
      sku: get(row, 'sku'),
      name: get(row, 'name'),
      category: normalizeCategory(get(row, 'category')),
      brand: get(row, 'brand'),
      buyPrice: toNumber(get(row, 'buyPrice')),
      sellPrice: toNumber(get(row, 'sellPrice')),
      stock: stockRaw ? toNumber(stockRaw) : null,
    };
  });
}

export interface PreviewRow extends ParsedProductRow {
  status: 'create' | 'update' | 'error';
  error?: string;
  existingProductId?: string;
}

/** Tague chaque ligne nouveau/mise à jour/erreur — une seule requête, pas de N+1. */
export async function previewImportRows(db: TenantPrisma, rows: ParsedProductRow[]): Promise<PreviewRow[]> {
  const skus = rows.map((r) => r.sku).filter(Boolean);
  const existing = skus.length
    ? await db.product.findMany({ where: { sku: { in: skus, mode: 'insensitive' } }, select: { id: true, sku: true } })
    : [];
  const bySku = new Map(existing.map((p) => [p.sku.toLowerCase(), p.id]));

  return rows.map((row) => {
    if (!row.name) return { ...row, status: 'error', error: 'Nom manquant' };
    const matchId = row.sku ? bySku.get(row.sku.toLowerCase()) : undefined;
    return matchId ? { ...row, status: 'update', existingProductId: matchId } : { ...row, status: 'create' };
  });
}

export interface CommitRow {
  sku: string;
  name: string;
  category: ProductCategory;
  brand: string;
  buyPrice: number;
  sellPrice: number;
  stock: number | null;
  existingProductId?: string;
}

/**
 * Écrit réellement les lignes retenues (déjà revues/éditées côté client) :
 * création (référence auto-générée si absente) ou mise à jour par produit déjà
 * identifié en revue. Met à jour le stock de la succursale active si une
 * quantité est fournie. Boucle par ligne dans une transaction — volumes
 * réalistes d'un import catalogue (dizaines/centaines de lignes), même
 * approche que receiveStock.
 */
export async function commitImport(
  db: TenantPrisma,
  tenantId: string,
  branchId: string,
  rows: CommitRow[],
): Promise<{ created: number; updated: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  await db.$transaction(
    async (tx) => {
      for (const row of rows) {
        if (!row.name?.trim()) {
          errors.push('Ligne ignorée (nom manquant)');
          continue;
        }
        try {
          if (row.existingProductId) {
            await tx.product.updateMany({
              where: { id: row.existingProductId },
              data: {
                name: row.name,
                category: row.category,
                brand: row.brand || null,
                buyPrice: row.buyPrice,
                sellPrice: row.sellPrice,
              },
            });
            if (row.stock != null) {
              await tx.stockItem.upsert({
                where: { productId_branchId: { productId: row.existingProductId, branchId } },
                create: {
                  tenantId,
                  productId: row.existingProductId,
                  branchId,
                  quantity: row.stock,
                  minAlert: 0,
                },
                update: { quantity: row.stock },
              });
            }
            updated += 1;
          } else {
            const sku = row.sku?.trim() || (await generateSku(tx, row.category));
            const product = await tx.product.create({
              data: {
                tenantId,
                sku,
                category: row.category,
                brand: row.brand || null,
                name: row.name,
                buyPrice: row.buyPrice,
                sellPrice: row.sellPrice,
              },
            });
            await tx.stockItem.create({
              data: {
                tenantId,
                productId: product.id,
                branchId,
                quantity: row.stock ?? 0,
                minAlert: 0,
              },
            });
            created += 1;
          }
        } catch (e) {
          errors.push(`${row.name || row.sku} : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
        }
      }
    },
    { timeout: 30000 },
  );

  return { created, updated, errors };
}
