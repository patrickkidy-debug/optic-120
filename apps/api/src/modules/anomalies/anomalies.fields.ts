import type { TenantPrisma } from '../../lib/prisma-tenant.js';
import { badRequest, notFound } from '../../lib/http-error.js';

/**
 * Correction directe et tracée d'un champ, pour les cibles qui n'ont pas de
 * fonction de service dédiée (Produit, Client, Commande de verres, SAV,
 * Caisse). C'est la SEULE porte d'entrée pour ces corrections — jamais un
 * `updateMany` ad-hoc ailleurs — afin que la liste blanche de champs ci-dessous
 * reste la frontière de sécurité réelle (indépendante du formulaire, qui ne
 * fait qu'orienter l'utilisateur).
 */

export type DirectFieldTarget = 'PRODUCT' | 'CUSTOMER' | 'LENS_ORDER' | 'REPAIR' | 'CASH_REGISTER';

interface FieldSpec {
  /** 'money'/'int' sont convertis en Number ; 'text' reste une chaîne (ou null si vide). */
  kind: 'money' | 'int' | 'text';
}

const ALLOWED_FIELDS: Record<DirectFieldTarget, Record<string, FieldSpec>> = {
  PRODUCT: {
    sku: { kind: 'text' },
    category: { kind: 'text' },
    brand: { kind: 'text' },
    name: { kind: 'text' },
    buyPrice: { kind: 'money' },
    sellPrice: { kind: 'money' },
  },
  CUSTOMER: {
    firstName: { kind: 'text' },
    lastName: { kind: 'text' },
    phone: { kind: 'text' },
    email: { kind: 'text' },
    loyaltyPoints: { kind: 'int' },
  },
  LENS_ORDER: {
    supplierName: { kind: 'text' },
    description: { kind: 'text' },
    cost: { kind: 'money' },
    notes: { kind: 'text' },
  },
  REPAIR: {
    description: { kind: 'text' },
    cost: { kind: 'money' },
    notes: { kind: 'text' },
  },
  CASH_REGISTER: {
    openingAmount: { kind: 'money' },
    closingAmount: { kind: 'money' },
  },
};

const DELEGATE: Record<DirectFieldTarget, keyof TenantPrisma> = {
  PRODUCT: 'product',
  CUSTOMER: 'customer',
  LENS_ORDER: 'lensOrder',
  REPAIR: 'repair',
  CASH_REGISTER: 'cashRegister',
};

const NOT_FOUND_LABEL: Record<DirectFieldTarget, string> = {
  PRODUCT: 'Produit introuvable',
  CUSTOMER: 'Client introuvable',
  LENS_ORDER: 'Commande de verres introuvable',
  REPAIR: 'Réparation introuvable',
  CASH_REGISTER: 'Session de caisse introuvable',
};

export interface DirectFieldChange {
  fieldName: string;
  newValue: string | null;
}

export interface DirectFieldResult {
  before: Record<string, string | null>;
  after: Record<string, string | null>;
}

function toDisplay(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && 'toNumber' in (v as object)) return String((v as { toNumber: () => number }).toNumber());
  return String(v);
}

function coerce(kind: FieldSpec['kind'], raw: string | null): unknown {
  if (raw == null || raw === '') return kind === 'text' ? null : 0;
  if (kind === 'money') return Number(raw);
  if (kind === 'int') return Math.trunc(Number(raw));
  return raw;
}

/**
 * Applique un lot de champs sur une cible, en une seule transaction, et
 * renvoie l'avant/après (valeurs affichables) de chaque champ touché. Refuse
 * tout champ hors liste blanche. Pour CUSTOMER, répercute prénom/nom/genre/
 * téléphone/email sur la fiche Patient liée si elle existe — même cascade que
 * `PATCH /customers/:id`.
 */
export async function applyDirectFieldCorrection(
  db: TenantPrisma,
  targetEntity: DirectFieldTarget,
  targetId: string,
  changes: DirectFieldChange[],
): Promise<DirectFieldResult> {
  const allowed = ALLOWED_FIELDS[targetEntity];
  const delegateName = DELEGATE[targetEntity];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (db as any)[delegateName];

  for (const c of changes) {
    if (!allowed[c.fieldName]) {
      throw badRequest(`Champ non corrigible pour cette catégorie : ${c.fieldName}`);
    }
  }

  const current = await delegate.findFirst({ where: { id: targetId } });
  if (!current) throw notFound(NOT_FOUND_LABEL[targetEntity]);

  const before: Record<string, string | null> = {};
  const data: Record<string, unknown> = {};
  for (const c of changes) {
    const spec = allowed[c.fieldName];
    before[c.fieldName] = toDisplay((current as Record<string, unknown>)[c.fieldName]);
    data[c.fieldName] = coerce(spec.kind, c.newValue);
  }

  const res = await delegate.updateMany({ where: { id: targetId }, data });
  if (res.count === 0) throw notFound(NOT_FOUND_LABEL[targetEntity]);
  const updated = await delegate.findFirst({ where: { id: targetId } });

  if (targetEntity === 'CUSTOMER' && updated) {
    await db.patient.updateMany({
      where: { customerId: updated.id },
      data: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        email: updated.email,
      },
    });
  }

  const after: Record<string, string | null> = {};
  for (const c of changes) after[c.fieldName] = toDisplay((updated as Record<string, unknown>)[c.fieldName]);

  return { before, after };
}
