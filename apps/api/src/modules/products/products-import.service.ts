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

export type CanonicalField = 'sku' | 'name' | 'category' | 'brand' | 'buyPrice' | 'sellPrice' | 'stock';
export const CANONICAL_FIELDS: CanonicalField[] = ['sku', 'name', 'category', 'brand', 'buyPrice', 'sellPrice', 'stock'];

/**
 * En-tête réduit à des mots simples : sans accents, minuscules, ponctuation
 * (apostrophes droites OU typographiques, points, tirets…) remplacée par des
 * espaces. « Prix d’achat (FCFA) » → « prix d achat fcfa », « P.A. » → « p a ».
 */
function headerWords(raw: unknown): string[] {
  return norm(String(raw ?? ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * Score d'un en-tête pour un champ (0 = aucun rapport). Les prix sont traités
 * à part : « Prix » seul est générique (= vente), « Prix d'achat », « PA »,
 * « Coût » sont l'achat, « Prix de vente », « PV », « Prix public » la vente.
 */
function fieldScore(field: CanonicalField, raw: unknown): number {
  const w = headerWords(raw);
  if (w.length === 0) return 0;
  const joined = w.join(' ');
  const compact = w.join('');
  const has = (...words: string[]) => words.some((x) => w.includes(x));
  const isPrice = has('prix', 'price', 'pu', 'tarif', 'montant', 'cout', 'cost') || compact === 'pa' || compact === 'pv';
  const buyWords = has('achat', 'achats', 'cout', 'couts', 'cost', 'buy', 'purchase', 'revient', 'fournisseur', 'supplier') || compact === 'pa' || compact === 'pua' || compact === 'paht';
  const sellWords = has('vente', 'ventes', 'sell', 'selling', 'sale', 'public', 'ttc', 'retail', 'client') || compact === 'pv' || compact === 'puv' || compact === 'pvttc';

  switch (field) {
    case 'buyPrice':
      if (buyWords && !sellWords && (isPrice || has('achat', 'cout', 'cost', 'revient'))) return 10;
      return 0;
    case 'sellPrice':
      if (sellWords && !buyWords && (isPrice || has('vente', 'sell', 'public'))) return 10;
      // Colonne de prix générique (« Prix », « Prix unitaire », « Tarif ») :
      // retenue pour la vente seulement si aucune colonne explicite n'existe.
      if (isPrice && !buyWords && !sellWords && !has('remise', 'discount', 'total', 'tva')) return 3;
      return 0;
    case 'stock':
      if (has('stock', 'quantite', 'quantites', 'qte', 'qty', 'quantity', 'qt', 'nombre', 'nb')) return has('alerte', 'min', 'minimum', 'seuil') ? 0 : 10;
      return 0;
    case 'sku':
      if (has('barre', 'barcode', 'ean')) return 2;
      if (has('sku', 'reference', 'ref', 'refs') || joined === 'code' || joined.startsWith('code article') || joined.startsWith('code produit')) return 10;
      return 0;
    case 'name':
      if (has('prix', 'price', 'marque', 'brand', 'categorie', 'category', 'stock', 'quantite')) return 0;
      if (has('nom', 'designation', 'design', 'libelle', 'name', 'produit', 'article', 'modele', 'model', 'description', 'intitule')) return 10;
      return 0;
    case 'category':
      if (has('categorie', 'category', 'famille', 'type', 'rayon')) return 10;
      return 0;
    case 'brand':
      if (has('marque', 'brand', 'fabricant', 'griffe', 'manufacturer')) return 10;
      return 0;
  }
}

// `sampleRow` mappe un INDICE de colonne ("0", "1"…) vers le TEXTE de l'en-tête
// à cet indice. Le "match" retourné reste la clé (l'indice), pour indexer
// ensuite la ligne brute via row[Number(match)].
function detectColumns(sampleRow: Record<string, unknown>): Partial<Record<CanonicalField, string>> {
  const keys = Object.keys(sampleRow);
  // Toutes les paires (champ, colonne) notées, attribuées de la meilleure à la
  // moins bonne : une colonne n'est jamais prise par deux champs, et un prix
  // explicite (« Prix de vente ») passe avant un prix générique (« Prix »).
  const pairs: { field: CanonicalField; key: string; score: number }[] = [];
  for (const field of CANONICAL_FIELDS) {
    for (const key of keys) {
      const score = fieldScore(field, sampleRow[key]);
      if (score > 0) pairs.push({ field, key, score });
    }
  }
  pairs.sort((x, y) => y.score - x.score || Number(x.key) - Number(y.key));
  const result: Partial<Record<CanonicalField, string>> = {};
  const claimed = new Set<string>();
  for (const { field, key } of pairs) {
    if (result[field] !== undefined || claimed.has(key)) continue;
    result[field] = key;
    claimed.add(key);
  }
  return result;
}

/**
 * Montant lu dans une cellule. Les nombres Excel arrivent tels quels ; le texte
 * accepte les écritures courantes : « 15 000 », « 15.000 », « 15,000.00 »,
 * « 1 500,50 », « 25000 FCFA », « 12 500 F CFA ».
 */
export function parseAmount(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').replace(/[\s\u00a0\u202f']/g, '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Les deux : le dernier est le séparateur décimal.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
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

export interface ImportColumns {
  /** En-têtes du fichier, dans l'ordre des colonnes. */
  headers: string[];
  /** Champ → indice de colonne (absent = colonne non trouvée). */
  mapping: Partial<Record<CanonicalField, number>>;
}

/**
 * Lit un .xlsx OU .csv (même lecteur) et détecte les colonnes — aucun accès base.
 * `override` force l'association d'un champ à une colonne (choix fait par
 * l'utilisateur dans l'aperçu) ; -1 = ignorer ce champ.
 */
export function parseImportFile(
  buffer: Buffer,
  override: Partial<Record<CanonicalField, number>> = {},
): { rows: ParsedProductRow[]; columns: ImportColumns } {
  const workbook = readWorkbook(buffer);
  const sheetName = workbook.SheetNames[0];
  const empty = { rows: [], columns: { headers: [], mapping: {} } };
  if (!sheetName) return empty;
  const sheet = workbook.Sheets[sheetName];
  // `header: 1` conserve les premières lignes telles quelles. Beaucoup de
  // fichiers Excel commencent par un titre, un logo ou une ligne vide avant
  // les vrais en-têtes : `sheet_to_json` prenait alors ce titre pour en-tête
  // et produisait des produits entièrement vides.
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
  // Même grille en valeurs brutes : un prix saisi comme nombre dans Excel est
  // lu tel quel, sans dépendre de son format d'affichage (« 15 000 F »…).
  const rawGrid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
  if (grid.length === 0) return empty;
  const headerIndex = grid.slice(0, 30).findIndex((cells) => {
    const header = Object.fromEntries(cells.map((cell, index) => [String(index), cell]));
    const detected = detectColumns(header);
    return Boolean(detected.name) || Object.keys(detected).length >= 2;
  });
  if (headerIndex < 0) {
    throw new Error('En-têtes introuvables : ajoutez au minimum une colonne « Nom », « Désignation » ou « Modèle »');
  }
  const headers = grid[headerIndex].map((cell) => String(cell ?? '').trim());
  const detected = detectColumns(Object.fromEntries(headers.map((header, index) => [String(index), header])));
  const mapping: Partial<Record<CanonicalField, number>> = {};
  for (const f of CANONICAL_FIELDS) {
    const forced = override[f];
    if (forced !== undefined) {
      if (forced >= 0 && forced < headers.length) mapping[f] = forced;
    } else if (detected[f] !== undefined) {
      mapping[f] = Number(detected[f]);
    }
  }

  const get = (row: unknown[], field: CanonicalField): string => {
    const i = mapping[field];
    return i !== undefined ? String(row[i] ?? '').trim() : '';
  };
  const amount = (rawRow: unknown[] | undefined, row: unknown[], field: CanonicalField): number => {
    const i = mapping[field];
    if (i === undefined) return 0;
    const raw = rawRow?.[i];
    return parseAmount(typeof raw === 'number' ? raw : row[i]);
  };

  const rows = grid
    .slice(headerIndex + 1)
    .map((row, k) => ({ row, raw: rawGrid[headerIndex + 1 + k] }))
    .filter(({ row }) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map(({ row, raw }) => ({
      sku: get(row, 'sku'),
      name: get(row, 'name'),
      category: normalizeCategory(get(row, 'category')),
      brand: get(row, 'brand'),
      buyPrice: amount(raw, row, 'buyPrice'),
      sellPrice: amount(raw, row, 'sellPrice'),
      stock: get(row, 'stock') ? Math.round(amount(raw, row, 'stock')) : null,
    }));
  return { rows, columns: { headers, mapping } };
}

export interface PreviewRow extends ParsedProductRow {
  status: 'create' | 'update' | 'error';
  error?: string;
  /** Information non bloquante (ex. référence en double renommée). */
  note?: string;
  existingProductId?: string;
}

/**
 * Tague chaque ligne nouveau / mise à jour / erreur.
 *
 * Une même référence répétée dans le fichier n'est PLUS bloquante : beaucoup de
 * catalogues fournisseurs réutilisent la référence du modèle pour chaque
 * coloris. La première ligne garde la référence (et met à jour le produit
 * existant s'il y en a un) ; les suivantes deviennent de nouveaux produits avec
 * une référence suffixée (« RB2140-2 », « RB2140-3 »…), signalée dans l'aperçu.
 */
export async function previewImportRows(db: TenantPrisma, rows: ParsedProductRow[]): Promise<PreviewRow[]> {
  const skus = rows.map((r) => r.sku.trim()).filter(Boolean);
  const existing = skus.length
    ? await db.product.findMany({ where: { sku: { in: skus, mode: 'insensitive' } }, select: { id: true, sku: true } })
    : [];
  const bySku = new Map(existing.map((p) => [p.sku.toLowerCase(), p.id]));

  // Références déjà prises (base + fichier), pour fabriquer des suffixes libres.
  const taken = new Set<string>(skus.map((x) => x.toLowerCase()));
  const dupBases = [...new Set(skus.filter((x, i) => skus.findIndex((y) => y.toLowerCase() === x.toLowerCase()) !== i).map((x) => x.toLowerCase()))];
  if (dupBases.length) {
    const similar = await db.product.findMany({
      where: { OR: dupBases.map((d) => ({ sku: { startsWith: `${d}-`, mode: 'insensitive' as const } })) },
      select: { sku: true },
    });
    for (const p of similar) taken.add(p.sku.toLowerCase());
  }

  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row.name) return { ...row, status: 'error', error: 'Nom manquant' };
    const sku = row.sku.trim();
    const key = sku.toLowerCase();
    if (key && seen.has(key)) {
      let n = 2;
      while (taken.has(`${key}-${n}`)) n++;
      const next = `${sku}-${n}`;
      taken.add(next.toLowerCase());
      seen.add(next.toLowerCase());
      return { ...row, sku: next, status: 'create', note: `Référence en double : enregistrée sous ${next}` };
    }
    if (key) seen.add(key);
    const matchId = key ? bySku.get(key) : undefined;
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
