import { api } from '../../lib/api';

export interface CashRegister {
  id: string;
  branchId: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: string;
  closingAmount: string | null;
  expectedAmount: string | null;
  status: 'OPEN' | 'CLOSED';
}

/** Vente annulée pendant la session de caisse (détail affiché à la fermeture). */
export interface CancelledSaleSummary {
  id: string;
  number: string;
  total: number;
  cancelledAt: string;
  customerName: string | null;
  /** Encaissé sur cette vente pendant la session, toujours compté dans le total. */
  cashedAmount: number;
  methods: string[];
}

export interface RegisterSummary {
  byMethod: { method: string; amount: number; count: number }[];
  cash: number;
  total: number;
  expensesTotal: number;
  expensesCount: number;
  netTotal: number;
  cancelled: CancelledSaleSummary[];
  cancelledCount: number;
  cancelledCashedTotal: number;
  openingAmount: number;
  expectedCash: number;
  openedAt: string;
}

/** Encaissements par moyen depuis l'ouverture de la caisse (résumé en direct). */
export async function getRegisterSummary(id: string): Promise<RegisterSummary> {
  const { data } = await api.get<RegisterSummary>(`/cashregister/${id}/summary`);
  return data;
}

export async function getCurrentRegister(branchId: string): Promise<CashRegister | null> {
  const { data } = await api.get<{ register: CashRegister | null }>('/cashregister/current', {
    params: { branchId },
  });
  return data.register;
}

export async function openRegister(branchId: string, openingAmount: number): Promise<CashRegister> {
  const { data } = await api.post<{ register: CashRegister }>('/cashregister/open', {
    branchId,
    openingAmount,
  });
  return data.register;
}

export async function closeRegister(
  id: string,
  closingAmount: number,
): Promise<{ register: CashRegister; expectedAmount: number; expensesTotal: number }> {
  const { data } = await api.post<{ register: CashRegister; expectedAmount: number; expensesTotal: number }>(
    `/cashregister/${id}/close`,
    { closingAmount },
  );
  return data;
}
