import i18n from 'i18next';
import {
  ACTIVATION_NEEDS,
  ANNOUNCEMENT_KIND_LABELS,
  ANOMALY_CATEGORY_LABELS,
  ANOMALY_FIELDS_BY_CATEGORY,
  ANOMALY_REASON_LABELS,
  ANOMALY_STATUS_LABELS,
  BRANCH_COUNTS,
  CURRENCY_FORMAT,
  FRAME_COLORS,
  FRAME_GENDERS,
  FRAME_MATERIALS,
  FRAME_SHAPES,
  FRAME_TYPES,
  INVENTORY_REASON_LABELS,
  LENS_DESIGNS,
  LENS_FAMILIES,
  LENS_MATERIALS,
  LENS_ORDER_STATUS_LABELS,
  LENS_TINTS,
  LENS_TREATMENTS,
  LENS_USAGES,
  PLAN_CATALOG,
  SALE_WA_STAGES,
  STRUCTURE_TYPES,
  SUB_INVOICE_STATUS_META,
  SUPPORTED_COUNTRIES,
  SYSTEM_ROLES,
  PERMISSIONS,
  TRANSFER_DIRECTION_LABELS,
} from '@oculo/shared-types';

/**
 * Libellés français venant du code partagé (@oculo/shared-types), traduits
 * pour l'interface.
 *
 * Deux cas, traités différemment parce que l'un touche aux données :
 *  - tables « code → libellé » (statuts, catégories, pays, offres…) : seul le
 *    libellé est affiché, le code part au serveur. Les libellés sont traduits
 *    EN PLACE au démarrage et à chaque changement de langue (localizeShared),
 *    sans toucher aux écrans qui les lisent ;
 *  - listes dont la VALEUR est enregistrée telle quelle (forme, matière,
 *    couleur de monture, matériau de verre…) : jamais modifiées, sinon la base
 *    recevrait de l'anglais. Leur affichage passe par trFr(valeur).
 *
 * Clé de traduction : shared.<slug du texte français>, identique pour un même
 * texte quelle que soit la table (« Annulée » n'est traduit qu'une fois).
 */

export function sharedKey(fr: string): string {
  const base = fr
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g);
  const words = (base ?? ['txt']).slice(0, 6);
  let slug = words.map((w, i) => (i ? w[0]!.toUpperCase() + w.slice(1) : w)).join('');
  if (/^\d/.test(slug)) slug = 'n' + slug;
  // Empreinte du texte complet : deux longs textes au même début restent distincts.
  let h = 0;
  for (const ch of fr) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `shared.${slug.slice(0, 40)}_${h.toString(36)}`;
}

/** Traduit un texte français du code partagé ; le renvoie tel quel s'il n'est pas traduit. */
export function trFr(fr: string | null | undefined): string {
  if (!fr) return fr ?? '';
  const key = sharedKey(fr);
  return i18n.exists(key) ? (i18n.t(key) as string) : fr;
}

/** Champs d'affichage traduisibles dans les objets des tables. */
const LABEL_FIELDS = ['label', 'description', 'hint', 'title', 'text', 'placeholder', 'help'] as const;

type Mutable = Record<string, unknown>;
interface Slot {
  obj: Mutable;
  field: string;
  fr: string;
}

/**
 * Tables traduites en place. FRAME_COLORS est volontairement absente : son
 * `name` est la valeur enregistrée sur la monture.
 */
const LABEL_TABLES: Record<string, unknown> = {
  ACTIVATION_NEEDS,
  ANNOUNCEMENT_KIND_LABELS,
  ANOMALY_CATEGORY_LABELS,
  ANOMALY_FIELDS_BY_CATEGORY,
  ANOMALY_REASON_LABELS,
  ANOMALY_STATUS_LABELS,
  BRANCH_COUNTS,
  CURRENCY_FORMAT,
  INVENTORY_REASON_LABELS,
  LENS_FAMILIES,
  LENS_ORDER_STATUS_LABELS,
  LENS_TREATMENTS,
  PLAN_CATALOG,
  SALE_WA_STAGES,
  STRUCTURE_TYPES,
  SUB_INVOICE_STATUS_META,
  SUPPORTED_COUNTRIES,
  // Rôles et permissions : aussi recopiés en base, d'où l'affichage via trFr.
  SYSTEM_ROLES,
  PERMISSIONS,
  TRANSFER_DIRECTION_LABELS,
};

/** Tables dont toutes les valeurs-chaînes sont des libellés (code → libellé). */
const RECORD_OF_STRINGS = new Set([
  'ANNOUNCEMENT_KIND_LABELS',
  'ANOMALY_CATEGORY_LABELS',
  'ANOMALY_REASON_LABELS',
  'ANOMALY_STATUS_LABELS',
  'INVENTORY_REASON_LABELS',
  'LENS_ORDER_STATUS_LABELS',
  'TRANSFER_DIRECTION_LABELS',
]);

/** Listes de valeurs enregistrées : affichées via trFr, jamais modifiées. */
export const VALUE_LISTS = {
  FRAME_GENDERS,
  FRAME_SHAPES,
  FRAME_MATERIALS,
  FRAME_TYPES,
  LENS_MATERIALS,
  LENS_TINTS,
  LENS_DESIGNS,
  LENS_USAGES,
  FRAME_COLORS: FRAME_COLORS.map((c) => c.name),
};

const isFrench = (s: string) => /[A-Za-zÀ-ÿ]{2,}/.test(s) && !/^[A-Z0-9_]+$/.test(s);

function collectSlots(): Slot[] {
  const slots: Slot[] = [];
  const visit = (node: unknown, table: string, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 4) return;
    const obj = node as Mutable;
    for (const [field, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const labelish =
          (RECORD_OF_STRINGS.has(table) && depth === 0) ||
          (LABEL_FIELDS as readonly string[]).includes(field) ||
          (field === 'name' && table === 'SUPPORTED_COUNTRIES');
        if (labelish && isFrench(value)) slots.push({ obj, field, fr: value });
      } else if (Array.isArray(value) && field === 'features') {
        value.forEach((v, i) => {
          if (typeof v === 'string' && isFrench(v)) slots.push({ obj: value as unknown as Mutable, field: String(i), fr: v });
        });
      } else if (value && typeof value === 'object') {
        visit(value, table, depth + 1);
      }
    }
  };
  for (const [name, table] of Object.entries(LABEL_TABLES)) visit(table, name, 0);
  return slots;
}

// Relevés une seule fois, sur les valeurs françaises d'origine.
let slots: Slot[] | null = null;

/** Applique la langue active aux tables partagées (idempotent). */
export function localizeShared(): void {
  slots ??= collectSlots();
  for (const s of slots) {
    const key = sharedKey(s.fr);
    s.obj[s.field] = i18n.exists(key) ? i18n.t(key) : s.fr;
  }
}

/** Tous les textes français à traduire (pour générer les fichiers de langue). */
export function collectSharedStrings(): string[] {
  const all = new Set<string>(collectSlots().map((s) => s.fr));
  for (const list of Object.values(VALUE_LISTS)) for (const v of list) if (isFrench(v)) all.add(v);
  return [...all];
}
