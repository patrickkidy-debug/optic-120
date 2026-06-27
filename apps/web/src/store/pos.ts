import { create } from 'zustand';
import { VAT_RATE } from '@oculo/shared-types';

export interface CartLine {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

interface PosState {
  lines: CartLine[];
  customerId: string | null;
  discountAmount: number;
  insuranceAmount: number;
  addLine: (line: Omit<CartLine, 'quantity'>) => void;
  setQuantity: (productId: string, qty: number) => void;
  removeLine: (productId: string) => void;
  setCustomer: (id: string | null) => void;
  setDiscount: (n: number) => void;
  setInsurance: (n: number) => void;
  clear: () => void;
}

export const usePosStore = create<PosState>((set) => ({
  lines: [],
  customerId: null,
  discountAmount: 0,
  insuranceAmount: 0,
  addLine: (line) =>
    set((s) => {
      const existing = s.lines.find((l) => l.productId === line.productId);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.productId === line.productId ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        };
      }
      return { lines: [...s.lines, { ...line, quantity: 1 }] };
    }),
  setQuantity: (productId, qty) =>
    set((s) => ({
      lines: s.lines
        .map((l) => (l.productId === productId ? { ...l, quantity: Math.max(0, qty) } : l))
        .filter((l) => l.quantity > 0),
    })),
  removeLine: (productId) =>
    set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),
  setCustomer: (customerId) => set({ customerId }),
  setDiscount: (discountAmount) => set({ discountAmount: Math.max(0, discountAmount) }),
  setInsurance: (insuranceAmount) => set({ insuranceAmount: Math.max(0, insuranceAmount) }),
  clear: () => set({ lines: [], customerId: null, discountAmount: 0, insuranceAmount: 0 }),
}));

/** Calcule les totaux du panier (miroir du calcul serveur). */
export function computeTotals(state: {
  lines: CartLine[];
  discountAmount: number;
  insuranceAmount: number;
}) {
  const subtotal = state.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const taxBase = Math.max(0, subtotal - state.discountAmount);
  const taxAmount = Math.round(taxBase * VAT_RATE);
  const total = taxBase + taxAmount;
  const dueFromCustomer = Math.max(0, total - state.insuranceAmount);
  return { subtotal, taxAmount, total, dueFromCustomer };
}
