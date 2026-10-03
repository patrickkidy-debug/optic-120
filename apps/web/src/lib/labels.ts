import i18n from 'i18next';

/**
 * Libellés de codes métier (moyens de paiement, catégories…) dans la langue
 * active. Source unique : les fichiers de langue (`paymentMethods.*`,
 * `expenseCategories.*`), au lieu d'une table française recopiée par écran.
 * Un code inconnu s'affiche tel quel plutôt qu'une clé brute.
 */
function label(ns: string, code: string): string {
  const key = `${ns}.${code}`;
  return i18n.exists(key) ? i18n.t(key) : code;
}

export const paymentMethodLabel = (code: string) => label('paymentMethods', code);
export const expenseCategoryLabel = (code: string) => label('expenseCategories', code);
export const saleStatusLabel = (code: string) => label('saleStatus', code);
export const paymentStatusLabel = (code: string) => label('paymentStatus', code);

/** Catégories proposées à la saisie d'une dépense, dans l'ordre d'usage. */
export const EXPENSE_CATEGORY_CODES = [
  'SUPPLIES',
  'TRANSPORT',
  'MAINTENANCE',
  'MARKETING',
  'ELECTRICITY',
  'WATER',
  'INTERNET',
  'RENT',
  'SALARIES',
  'TAXES',
  'OTHER',
] as const;
