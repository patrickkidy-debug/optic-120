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

export interface RegisterExpenseSummary {
  id: string;
  label: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
}

export interface RegisterSummary {
  byMethod: { method: string; amount: number; count: number }[];
  cash: number;
  total: number;
  expenses?: RegisterExpenseSummary[];
  expensesTotal: number;
  expensesCount: number;
  transfersInTotal?: number;
  transfersOutTotal?: number;
  transfersNet?: number;
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
): Promise<{
  register: CashRegister;
  expectedAmount: number;
  expensesTotal: number;
  cashSalesTotal?: number;
  openingAmount?: number;
  transfersNet?: number;
  salesTotal?: number;
  netTotal?: number;
}> {
  const { data } = await api.post<{
    register: CashRegister;
    expectedAmount: number;
    expensesTotal: number;
    cashSalesTotal?: number;
    openingAmount?: number;
    transfersNet?: number;
    salesTotal?: number;
    netTotal?: number;
  }>(`/cashregister/${id}/close`, { closingAmount });
  return data;
}

/* --- Historique des sessions de caisse --- */

export interface CashSessionRow {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  durationMinutes: number;
  openedBy: string | null;
  closedBy: string | null;
  salesTotal: number;
  cashSales: number;
  paymentsCount: number;
  expensesTotal: number;
  expensesCount: number;
  transfersIn: number;
  transfersOut: number;
  netTotal: number;
  openingAmount: number;
  expectedAmount: number;
  countedAmount: number | null;
  variance: number | null;
  methods: string[];
}

export interface CashHistory {
  sessions: CashSessionRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: { sessions: number; closed: number; salesTotal: number; varianceTotal: number; withVariance: number };
}

export async function getCashHistory(params: { branchId: string; from?: string; to?: string; page?: number; pageSize?: number }): Promise<CashHistory> {
  const { data } = await api.get<CashHistory>('/cashregister/history', { params });
  return data;
}

export interface CashSessionReport extends Omit<CashSessionRow, 'methods'> {
  branchName: string | null;
  byMethod: { method: string; amount: number; count: number }[];
  salesCount: number;
  payments: { id: string; method: string; amount: number; at: string; saleId: string; saleNumber: string; saleType: string; cancelled: boolean; customerName: string | null }[];
  expenses: { id: string; label: string; category: string; amount: number; createdAt: string; date: string }[];
  transfers: { id: string; direction: 'IN' | 'OUT'; label: string; amount: number; createdAt: string; date: string }[];
  cancelled: { id: string; number: string; total: number; at: string; customerName: string | null }[];
}

export async function getCashSessionReport(id: string): Promise<CashSessionReport> {
  const { data } = await api.get<{ report: CashSessionReport }>(`/cashregister/${id}/report`);
  return data.report;
}
