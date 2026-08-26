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
  sku: ['sku', 'reference', 'ref', 'code', 'code article', 'code produit'],
  name: ['nom', 'designation', 'désignation', 'produit', 'article', 'name', 'modele', 'modèle', 'model', 'libelle', 'libellé'],
  buyPrice: ["prix d'achat", 'prix achat', 'buy price', 'cost', 'cout', 'coût', 'prix coutant'],
  sellPrice: ['prix de vente', 'prix vente', 'sell price', 'prix', 'price'],
  category: ['categorie', 'catégorie', 'category', 'type', 'famille'],
  brand: ['marque', 'brand', 'fabricant'],
  stock: ['stock initial', 'stock', 'quantite', 'quantité', 'qty', 'quantity'],
};
// Ordre de détection : du plus spécifique au plus générique (ex. "prix d'achat"
// avant le générique "prix" de sellPrice), pour qu'une colonne ne soit jamais
// captée par le mauvais champ.
const DETECTION_ORDER: CanonicalField[] = ['sku', 'name', 'buyPrice', 'sellPrice', 'category', 'brand', 'stock'];

// `sampleRow` mappe un INDICE de colonne ("0", "1"…) vers le TEXTE de l'en-tête
// à cet indice (voir les deux appels dans parseImportFile) — jamais un nom de
// colonne vers une valeur de cellule. Le "match" retourné reste la clé
// (l'indice), pour indexer ensuite la ligne brute via row[Number(match)].
function detectColumns(sampleRow: Record<string, unknown>): Partial<Record<CanonicalField, string>> {
  const keys = Object.keys(sampleRow);
  const claimed = new Set<string>();
  const result: Partial<Record<CanonicalField, string>> = {};
  for (const field of DETECTION_ORDER) {
    const aliases = FIELD_ALIASES[field];
    const match = keys.find((k) => {
      if (claimed.has(k)) return false;
      const nk = norm(String(sampleRow[k] ?? ''));
      if (!nk) return false;
      return aliases.some((a) => {
        const na = norm(a);
        // Égalité, en-tête contenant l'alias ("nom du produit" ⊇ "nom"), ou
        // l'inverse pour un en-tête abrégé ("désig." — l'alias le contient).
        return nk === na || nk.includes(na) || (nk.length >= 3 && na.startsWith(nk));
      });
    });
    if (match) {
      result[field] = match;
      claimed.add(match);
    }
  }
  return result;
}

// Signature ZIP ('PK') : un .xlsx est une archive ZIP, un .csv est du texte brut.
const ZIP_MAGIC_0 = 0x50;
const ZIP_MAGIC_1 = 0x4b;

/**
 * Ouvre un classeur .xlsx OU .csv. Les CSV posent un problème que .xlsx n'a
 * pas : Excel en français les enregistre par défaut en Windows-1252 (ANSI)
 * sans BOM (la virgule étant déjà le séparateur décimal du pays, le séparateur
 * de champ devient ';'). Décoder ce texte à tort en UTF-8 transforme les
 * en-têtes accentués ("Désignation", "Prix d'achat"…) en octets invalides —
 * la détection de colonnes échoue alors qu'un humain ouvrant le fichier verrait
 * des en-têtes parfaitement lisibles.
 */
function readWorkbook(buffer: Buffer): XLSX.WorkBook {
  const isZip = buffer.length >= 2 && buffer[0] === ZIP_MAGIC_0 && buffer[1] === ZIP_MAGIC_1;
  if (isZip) return XLSX.read(buffer, { type: 'buffer' });

  let text: string;
  try {
    // TextDecoder en mode strict : lève une erreur sur une séquence UTF-8
    // invalide au lieu de la remplacer silencieusement par des "�".
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Repli Windows-1252 : Node n'a pas cet encodage nommé, mais 'latin1'
    // lui est identique sur la plage des lettres accentuées (0xA0-0xFF),
    // largement suffisante pour des en-têtes de tableur.
    text = buffer.toString('latin1');
  }

  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const FS = semicolons > commas ? ';' : ',';

  return XLSX.read(text, { type: 'string', FS });
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
  const workbook = readWorkbook(buffer);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  // `header: 1` conserve les premières lignes telles quelles. Beaucoup de
  // fichiers Excel commencent par un titre, un logo ou une ligne vide avant
  // les vrais en-têtes : `sheet_to_json` prenait alors ce titre pour en-tête
  // et produisait des produits entièrement vides.
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
  if (grid.length === 0) return [];
  const headerIndex = grid.slice(0, 30).findIndex((cells) => {
    const header = Object.fromEntries(cells.map((cell, index) => [String(index), cell]));
    const detected = detectColumns(header);
    return Boolean(detected.name) || Object.keys(detected).length >= 2;
  });
  if (headerIndex < 0) {
    throw new Error('En-têtes introuvables : ajoutez au minimum une colonne « Nom », « Désignation » ou « Modèle »');
  }
  const headers = grid[headerIndex].map((cell) => String(cell ?? '').trim());
  const columns = detectColumns(Object.fromEntries(headers.map((header, index) => [String(index), header])));

  const get = (row: unknown[], field: CanonicalField): string => {
    const key = columns[field];
    return key !== undefined ? String(row[Number(key)] ?? '').trim() : '';
  };
  const toNumber = (s: string): number => {
    const n = Number(s.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  return grid.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
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

  const seenSkus = new Set<string>();
  return rows.map((row) => {
    if (!row.name) return { ...row, status: 'error', error: 'Nom manquant' };
    const normalizedSku = row.sku.trim().toLowerCase();
    // Deux références identiques dans le même fichier ne pouvaient pas être
    // détectées par la requête DB ci-dessus. La seconde faisait donc tomber la
    // transaction au moment du commit — on la signale maintenant, avant toute
    // écriture, afin que l'utilisateur puisse la corriger.
    if (normalizedSku && seenSkus.has(normalizedSku)) {
      return { ...row, status: 'error', error: 'Référence en double dans le fichier' };
    }
    if (normalizedSku) seenSkus.add(normalizedSku);
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

  for (const [index, row] of rows.entries()) {
    if (!row.name?.trim()) {
      errors.push(`Ligne ${index + 1} : nom manquant`);
      continue;
    }
    try {
      // Une transaction PAR ligne : un SKU déjà utilisé ou une donnée erronée
      // ne met plus PostgreSQL dans l'état « transaction is aborted » pour
      // toutes les montures suivantes. Produit et stock restent néanmoins
      // enregistrés (ou annulés) ensemble pour cette ligne.
      await db.$transaction(
        async (tx) => {
          if (row.existingProductId) {
            const result = await tx.product.updateMany({
              where: { id: row.existingProductId },
              data: {
                name: row.name,
                category: row.category,
                brand: row.brand || null,
                buyPrice: row.buyPrice,
                sellPrice: row.sellPrice,
              },
            });
            if (result.count === 0) throw new Error('Produit à mettre à jour introuvable');
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
          }
        },
        { timeout: 30000 },
      );
      if (row.existingProductId) updated += 1;
      else created += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      const readable =
        /unique constraint|duplicate key|P2002/i.test(message)
          ? 'référence déjà utilisée'
          : /stock/i.test(message)
            ? 'stock impossible à enregistrer'
            : message || 'erreur inconnue';
      errors.push(`Ligne ${index + 1} — ${row.name || row.sku || 'produit sans nom'} : ${readable}`);
    }
  }

  return { created, updated, errors };
}
