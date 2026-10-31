import { create } from 'zustand';
import { VAT_RATE, computeTaxes, vatBaseOf, type ExtraTax } from '@oculo/shared-types';
import { useAuthStore } from './auth';

export type Eye = 'OD' | 'OG';

export interface CartLine {
  /** Identifiant de ligne : produit + œil (un même verre peut avoir une ligne OD et une ligne OG). */
  key: string;
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  // Référence libre saisie à la caisse (ex. référence fabricant d'une
  // monture), indépendante du stock — voir SaleItem.reference côté API.
  reference?: string;
  /** Verre : œil concerné (OD / OG), sinon absent. */
  eye?: Eye | null;
  category?: string;
}

export type NewCartLine = Omit<CartLine, 'quantity' | 'key'>;

export const lineKey = (productId: string, eye?: Eye | null) => (eye ? `${productId}:${eye}` : productId);

/** Réglage de l'établissement : verres sur une ligne OD et une ligne OG. */
export function splitLensEyesEnabled() {
  return Boolean(useAuthStore.getState().user?.tenantOpticalSettings?.splitLensEyes);
}

/**
 * Ajoute un article à une liste de lignes (panier de caisse ou devis).
 * Verre + réglage « une ligne par œil » : le premier ajout crée une ligne OD et
 * une ligne OG à quantité 1 au lieu d'une quantité 2 ; un ajout suivant ne fait
 * que compléter l'œil manquant.
 */
export function addCartLine<L extends CartLine>(lines: L[], line: NewCartLine, split = splitLensEyesEnabled()): L[] {
  if (split && !line.eye && line.category === 'VERRE') {
    const missing = (['OD', 'OG'] as const).filter((e) => !lines.some((l) => l.key === lineKey(line.productId, e)));
    if (missing.length === 0) return lines;
    return [...lines, ...missing.map((eye) => ({ ...line, eye, key: lineKey(line.productId, eye), quantity: 1 }) as L)];
  }
  const key = lineKey(line.productId, line.eye);
  if (lines.some((l) => l.key === key)) {
    return lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
  }
  return [...lines, { ...line, key, quantity: 1 } as L];
}

/** Change l'œil d'une ligne (fusionne si une ligne identique existe déjà). */
export function setCartLineEye<L extends CartLine>(lines: L[], key: string, eye: Eye | null): L[] {
  const line = lines.find((l) => l.key === key);
  if (!line) return lines;
  const nextKey = lineKey(line.productId, eye);
  if (nextKey === key) return lines;
  const target = lines.find((l) => l.key === nextKey);
  if (target) {
    return lines
      .filter((l) => l.key !== key)
      .map((l) => (l.key === nextKey ? { ...l, quantity: l.quantity + line.quantity } : l));
  }
  return lines.map((l) => (l.key === key ? { ...l, eye, key: nextKey } : l));
}

/** Sépare une ligne de verre à quantité 2 en une ligne OD et une ligne OG. */
export function splitCartLineEyes<L extends CartLine>(lines: L[], key: string): L[] {
  const line = lines.find((l) => l.key === key);
  if (!line || line.eye) return lines;
  const rest = lines.filter((l) => l.key !== key);
  return addCartLine(rest, { ...line, eye: undefined, category: 'VERRE' }, true);
}

interface PosState {
  lines: CartLine[];
  customerId: string | null;
  discountAmount: number;
  insuranceAmount: number;
  addLine: (line: NewCartLine) => void;
  setQuantity: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  setCustomer: (id: string | null) => void;
  setDiscount: (n: number) => void;
  setInsurance: (n: number) => void;
  setUnitPrice: (key: string, price: number) => void;
  setReference: (key: string, reference: string) => void;
  setEye: (key: string, eye: Eye | null) => void;
  splitEyes: (key: string) => void;
  clear: () => void;
}

export const usePosStore = create<PosState>((set) => ({
  lines: [],
  customerId: null,
  discountAmount: 0,
  insuranceAmount: 0,
  addLine: (line) => set((s) => ({ lines: addCartLine(s.lines, line) })),
  setQuantity: (key, qty) =>
    set((s) => ({
      lines: s.lines
        .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, qty) } : l))
        .filter((l) => l.quantity > 0),
    })),
  removeLine: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
  setCustomer: (customerId) => set({ customerId }),
  setDiscount: (discountAmount) => set({ discountAmount: Math.max(0, discountAmount) }),
  setInsurance: (insuranceAmount) => set({ insuranceAmount: Math.max(0, insuranceAmount) }),
  setUnitPrice: (key, price) =>
    set((s) => ({
      lines: s.lines.map((l) => (l.key === key ? { ...l, unitPrice: Math.max(0, Math.round(price)) } : l)),
    })),
  setReference: (key, reference) =>
    set((s) => ({ lines: s.lines.map((l) => (l.key === key ? { ...l, reference } : l)) })),
  setEye: (key, eye) => set((s) => ({ lines: setCartLineEye(s.lines, key, eye) })),
  splitEyes: (key) => set((s) => ({ lines: splitCartLineEyes(s.lines, key) })),
  clear: () => set({ lines: [], customerId: null, discountAmount: 0, insuranceAmount: 0 }),
}));

/**
 * Calcule les totaux du panier (miroir du calcul serveur).
 * `vatRatePct` = taux de TVA en pourcentage (défaut 18 %, 0 = exonéré) ;
 * `extraTaxes` = taxes ajoutées à la TVA (ex. CSS 1 % au Gabon), détaillées.
 * Les verres (`category` VERRE) sont exonérés de TVA, comme côté serveur.
 */
export function computeTotals(
  state: { lines: { unitPrice: number; quantity: number; category?: string }[]; discountAmount: number; insuranceAmount: number },
  vatRatePct: number = VAT_RATE * 100,
  extraTaxes: readonly ExtraTax[] = [],
) {
  const subtotal = state.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const taxBase = Math.max(0, subtotal - state.discountAmount);
  const vatBase = vatBaseOf(
    state.lines.map((l) => ({ category: l.category, lineTotal: l.unitPrice * l.quantity })),
    state.discountAmount,
  );
  const taxes = computeTaxes(taxBase, vatRatePct, extraTaxes, vatBase);
  const taxAmount = taxes.total;
  const total = taxBase + taxAmount;
  const dueFromCustomer = Math.max(0, total - state.insuranceAmount);
  return { subtotal, taxAmount, taxLines: taxes.lines, total, dueFromCustomer };
}
