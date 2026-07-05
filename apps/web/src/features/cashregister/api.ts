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
): Promise<{ register: CashRegister; expectedAmount: number }> {
  const { data } = await api.post<{ register: CashRegister; expectedAmount: number }>(
    `/cashregister/${id}/close`,
    { closingAmount },
  );
  return data;
}
