import { api } from '../../lib/api';
import type {
  EmployeeCreateInput,
  EmployeeUpdateInput,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  CashTransferCreateInput,
  BankAccountCreateInput,
  SupplierCreateInput,
  SupplierUpdateInput,
  InsurerCreateInput,
  InsurerUpdateInput,
  InsuranceContractCreateInput,
  InsuranceContractUpdateInput,
  InsuranceGuaranteeCreateInput,
  InsuranceGuaranteeUpdateInput,
  InsuranceBeneficiaryCreateInput,
  InsuranceClaimCreateInput,
  InsuranceClaimUpdateInput,
  InsuranceRefundCreateInput,
} from '@oculo/shared-types';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  position: string;
  salary: string | null;
  hireDate: string | null;
  status: string;
  branchId: string | null;
}
export interface Expense {
  id: string;
  category: string;
  label: string;
  amount: string;
  date: string;
  notes: string | null;
  branchId?: string | null;
  paymentSource?: 'CASH' | 'BANK' | 'MOBILE_MONEY' | 'CHEQUE' | 'CARD';
  payee?: string | null;
  createdAt?: string;
  createdByName?: string | null;
  cancelledAt?: string | null;
  cancelledByName?: string | null;
  cancelReason?: string | null;
  attachmentUrl?: string | null;
  reference?: string | null;
  bankAccountId?: string | null;
  bankAccount?: { bankName: string; accountName: string; type?: string; provider?: string | null } | null;
  links?: { label?: string; url: string }[] | null;
}
export interface Supplier {
  id: string;
  name: string;
  type: string;
  contactName: string | null;
  phone: string | null;
  whatsapp?: string | null;
  email: string | null;
  address: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  paymentTerms?: string | null;
  deliveryDays?: number | null;
  categories?: string[];
  isActive?: boolean;
  notes: string | null;
  createdAt?: string;
  /** Indicateurs calculés par la liste (absents sur une fiche juste créée). */
  stats?: { openLensOrders: number; lensOrders: number; receptions: number; lastReceptionAt: string | null };
}

export interface SupplierActivity {
  lensOrders: {
    id: string;
    number: string;
    status: string;
    description: string;
    expectedAt: string | null;
    createdAt: string;
    cost: number | null;
    customer: { firstName: string; lastName: string } | null;
  }[];
  receptions: {
    id: string;
    quantity: number;
    unitCost: number | null;
    reason: string | null;
    createdAt: string;
    productName: string;
    sku: string;
  }[];
}

export async function getSupplierActivity(id: string): Promise<SupplierActivity> {
  const { data } = await api.get<SupplierActivity>(`/suppliers/${id}/activity`);
  return data;
}
export interface Insurer {
  id: string;
  name: string;
  type: string;
  /** Taux historique, désormais un repli quand aucun contrat ne s'applique. */
  coveragePercent: number;
  phone: string | null;
  email: string | null;
  notes: string | null;
  contractCount?: number;
  beneficiaryCount?: number;
  claimCount?: number;
  pendingAmount?: number;
  refundedAmount?: number;
}
export interface FinanceSummary {
  monthRevenue: number;
  monthExpenses: number;
  net: number;
  byCategory: { category: string; total: number }[];
}

// Employees
export async function listEmployees(): Promise<Employee[]> {
  const { data } = await api.get<{ employees: Employee[] }>('/employees');
  return data.employees;
}
export async function createEmployee(input: EmployeeCreateInput) {
  const { data } = await api.post('/employees', input);
  return data.employee as Employee;
}
export async function updateEmployee(id: string, input: EmployeeUpdateInput) {
  const { data } = await api.patch(`/employees/${id}`, input);
  return data.employee as Employee;
}

// Expenses
export interface FinanceListFilters {
  from?: string;
  to?: string;
  includeCancelled?: boolean;
}

export async function listExpenses(branchId?: string, filters: FinanceListFilters = {}): Promise<Expense[]> {
  const { data } = await api.get<{ expenses: Expense[] }>('/expenses', {
    params: {
      branchId: branchId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      includeCancelled: filters.includeCancelled ? 'true' : undefined,
    },
  });
  return data.expenses;
}

/** Versement de caisse : apport (IN) ou retrait (OUT), hors ventes et charges. */
export interface CashTransfer {
  id: string;
  direction: 'IN' | 'OUT';
  kind: 'CASH_IN' | 'CASH_OUT' | 'CASH_TO_BANK' | 'BANK_TO_CASH' | 'BANK_IN' | 'BANK_OUT' | 'ACCOUNT_TRANSFER';
  toAccountId?: string | null;
  toAccount?: { bankName: string; accountName: string; type?: string; provider?: string | null } | null;
  affectsCash?: boolean;
  label: string;
  amount: string;
  date: string;
  branchId: string | null;
  notes: string | null;
  method?: string | null;
  counterparty?: string | null;
  handledBy?: string | null;
  createdAt?: string;
  createdByName?: string | null;
  cancelledAt?: string | null;
  cancelledByName?: string | null;
  cancelReason?: string | null;
  attachmentUrl?: string | null;
  reference?: string | null;
  bankAccountId?: string | null;
  bankAccount?: { bankName: string; accountName: string; type?: string; provider?: string | null } | null;
  links?: { label?: string; url: string }[] | null;
}

export interface CashTransferTotals {
  in: number;
  out: number;
  net: number;
  cashIn: number;
  cashOut: number;
  bankIn: number;
  bankOut: number;
}

export async function listCashTransfers(
  branchId?: string,
  filters: FinanceListFilters = {},
): Promise<{ transfers: CashTransfer[]; totals: CashTransferTotals }> {
  const { data } = await api.get<{ transfers: CashTransfer[]; totals: CashTransferTotals }>('/cash-transfers', {
    params: {
      branchId: branchId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      includeCancelled: filters.includeCancelled ? 'true' : undefined,
    },
  });
  return data;
}

/** Annulation tracée (motif obligatoire) : l'écriture reste visible. */
export async function cancelCashTransfer(id: string, reason: string): Promise<void> {
  await api.post(`/cash-transfers/${id}/cancel`, { reason });
}
export async function cancelExpense(id: string, reason: string): Promise<void> {
  await api.post(`/expenses/${id}/cancel`, { reason });
}

/* ------------------------------ Comptes bancaires ------------------------------ */

export interface BankAccount {
  id: string;
  type: 'BANK' | 'MOBILE_MONEY' | 'SAFE' | 'OTHER';
  provider: string | null;
  phoneNumber: string | null;
  bankName: string;
  accountName: string;
  accountNumber: string | null;
  iban: string | null;
  swift: string | null;
  openingBalance: string;
  active: boolean;
  notes: string | null;
  branchId: string | null;
  credits: number;
  debits: number;
  balance: number;
  movements: number;
}

export interface BankStatementLine {
  id: string;
  type: 'TRANSFER' | 'EXPENSE';
  kind: string | null;
  label: string;
  date: string;
  reference: string | null;
  counterparty: string | null;
  signed: number;
  balance: number;
}

export interface FinanceHistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  user?: { firstName: string; lastName: string } | null;
}
/** Historique d'une écriture (création, modification, annulation). */
export async function getFinanceHistory(entity: 'Expense' | 'CashTransfer', id: string) {
  const { data } = await api.get<{ history: FinanceHistoryEntry[] }>(`/cash-transfers/history/${entity}/${id}`);
  return data.history;
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const { data } = await api.get<{ accounts: BankAccount[] }>('/bank-accounts');
  return data.accounts;
}
export async function createBankAccount(input: BankAccountCreateInput) {
  const { data } = await api.post('/bank-accounts', input);
  return data.account as BankAccount;
}
export async function updateBankAccount(id: string, input: Partial<BankAccountCreateInput>) {
  const { data } = await api.patch(`/bank-accounts/${id}`, input);
  return data.account as BankAccount;
}
export async function getBankStatement(id: string) {
  const { data } = await api.get<{ openingBalance: number; balance: number; lines: BankStatementLine[] }>(
    `/bank-accounts/${id}/statement`,
  );
  return data;
}

export async function createCashTransfer(input: CashTransferCreateInput): Promise<CashTransfer> {
  const { data } = await api.post<{ transfer: CashTransfer }>('/cash-transfers', input);
  return data.transfer;
}

export async function deleteCashTransfer(id: string): Promise<void> {
  await api.delete(`/cash-transfers/${id}`);
}
export async function getFinanceSummary(): Promise<FinanceSummary> {
  const { data } = await api.get<FinanceSummary>('/expenses/summary');
  return data;
}
export async function createExpense(input: ExpenseCreateInput) {
  const { data } = await api.post('/expenses', input);
  return data.expense as Expense;
}
export async function updateExpense(id: string, input: ExpenseUpdateInput) {
  const { data } = await api.patch(`/expenses/${id}`, input);
  return data.expense as Expense;
}
export async function deleteExpense(id: string) {
  await api.delete(`/expenses/${id}`);
}

// Suppliers
export async function listSuppliers(): Promise<Supplier[]> {
  const { data } = await api.get<{ suppliers: Supplier[] }>('/suppliers');
  return data.suppliers;
}
export async function createSupplier(input: SupplierCreateInput) {
  const { data } = await api.post('/suppliers', input);
  return data.supplier as Supplier;
}
export async function updateSupplier(id: string, input: SupplierUpdateInput) {
  const { data } = await api.patch(`/suppliers/${id}`, input);
  return data.supplier as Supplier;
}

// Insurers
export interface InsurerUpcoming {
  items: {
    insurerId: string;
    name: string;
    /** Solde restant à recevoir, conservé pour compatibilité d'affichage. */
    amount: number;
    expectedAmount: number;
    receivedAmount: number;
    remainingAmount: number;
    salesCount: number;
  }[];
  total: number;
  expectedTotal: number;
  receivedTotal: number;
  monthStart: string;
  dueDate: string;
  /** Remboursements réellement encaissés pendant le mois affiché. */
  receivedThisMonth?: number;
  /** Restant dû dont l'échéance n'est pas passée (tous mois confondus). */
  pendingTotal?: number;
  /** Restant dû dont l'échéance est dépassée. */
  lateTotal?: number;
  nextDueDate?: string | null;
}

/** Paiements assurance à recevoir pour un mois donné. */
export async function getInsurerUpcoming(month?: string): Promise<InsurerUpcoming> {
  const { data } = await api.get<InsurerUpcoming>('/insurance/upcoming', { params: { month } });
  return data;
}

export interface InsuranceSummary {
  paid: number;
  pending: number;
  late: number;
  toCollect: number;
}

/** Résumé des remboursements assurance (payé / en attente / en retard), 24 derniers mois. */
export async function getInsuranceSummary(): Promise<InsuranceSummary> {
  const { data } = await api.get<InsuranceSummary>('/insurance/summary');
  return data;
}

export async function listInsurers(): Promise<Insurer[]> {
  const { data } = await api.get<{ insurers: Insurer[] }>('/insurance');
  return data.insurers;
}
export async function createInsurer(input: InsurerCreateInput) {
  const { data } = await api.post('/insurance', input);
  return data.insurer as Insurer;
}
export async function updateInsurer(id: string, input: InsurerUpdateInput) {
  const { data } = await api.patch(`/insurance/${id}`, input);
  return data.insurer as Insurer;
}

/* ---------- Contrats, garanties, bénéficiaires ---------- */

export interface InsuranceGuarantee {
  id: string;
  contractId: string;
  category: string;
  coveragePercent: number;
  ceilingAmount: string | null;
  maxAmount: string | null;
  deductibleAmount: string | null;
  conditions: string | null;
}

export interface InsuranceBeneficiary {
  id: string;
  contractId: string;
  customerId: string;
  membershipNumber: string | null;
  notes: string | null;
  customer?: { id: string; firstName: string; lastName: string; phone: string | null };
}

export interface InsuranceContract {
  id: string;
  insurerId: string;
  name: string;
  reference: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  notes: string | null;
  insurer?: { id: string; name: string; type: string };
  guarantees: InsuranceGuarantee[];
  beneficiaries?: InsuranceBeneficiary[];
  _count?: { beneficiaries: number; claims: number };
}

export async function listInsuranceContracts(insurerId?: string): Promise<InsuranceContract[]> {
  const { data } = await api.get<{ contracts: InsuranceContract[] }>('/insurance/contracts', {
    params: insurerId ? { insurerId } : {},
  });
  return data.contracts;
}

export async function getInsuranceContract(id: string): Promise<InsuranceContract> {
  const { data } = await api.get<{ contract: InsuranceContract }>(`/insurance/contracts/${id}`);
  return data.contract;
}

export async function createInsuranceContract(input: InsuranceContractCreateInput) {
  const { data } = await api.post('/insurance/contracts', input);
  return data.contract as InsuranceContract;
}

export async function updateInsuranceContract(id: string, input: InsuranceContractUpdateInput) {
  const { data } = await api.patch(`/insurance/contracts/${id}`, input);
  return data.contract as InsuranceContract;
}

export async function createGuarantee(contractId: string, input: InsuranceGuaranteeCreateInput) {
  const { data } = await api.post(`/insurance/contracts/${contractId}/guarantees`, input);
  return data.guarantee as InsuranceGuarantee;
}

export async function updateGuarantee(id: string, input: InsuranceGuaranteeUpdateInput) {
  const { data } = await api.patch(`/insurance/guarantees/${id}`, input);
  return data.guarantee as InsuranceGuarantee;
}

export async function deleteGuarantee(id: string): Promise<void> {
  await api.delete(`/insurance/guarantees/${id}`);
}

export async function addBeneficiary(contractId: string, input: InsuranceBeneficiaryCreateInput) {
  const { data } = await api.post(`/insurance/contracts/${contractId}/beneficiaries`, input);
  return data.beneficiary as InsuranceBeneficiary;
}

export async function removeBeneficiary(id: string): Promise<void> {
  await api.delete(`/insurance/beneficiaries/${id}`);
}

/** Garanties applicables à un client — sinon `matched: false` (repli sur le taux). */
export interface CustomerCoverage {
  matched: boolean;
  beneficiaryId?: string;
  membershipNumber?: string | null;
  contract?: {
    id: string;
    name: string;
    reference: string | null;
    insurer: { id: string; name: string; coveragePercent: number };
  };
  guarantees?: {
    category: string;
    coveragePercent: number;
    ceilingAmount: number | null;
    maxAmount: number | null;
    deductibleAmount: number | null;
    conditions: string | null;
  }[];
}

export async function getCustomerCoverage(
  customerId: string,
  insurerId?: string,
): Promise<CustomerCoverage> {
  const { data } = await api.get<CustomerCoverage>('/insurance/coverage', {
    params: { customerId, ...(insurerId ? { insurerId } : {}) },
  });
  return data;
}

/* ---------- Prises en charge et remboursements ---------- */

export interface InsuranceRefund {
  id: string;
  claimId: string;
  insurerId: string;
  expectedAmount: string;
  receivedAmount: string;
  receivedAt: string;
  reference: string | null;
  method: string | null;
  notes: string | null;
  insurer?: { id: string; name: string };
  claim?: { id: string; number: string; saleId: string | null };
}

export interface InsuranceClaim {
  id: string;
  number: string;
  insurerId: string;
  contractId: string | null;
  beneficiaryId: string | null;
  customerId: string | null;
  saleId: string | null;
  status: string;
  totalAmount: string;
  requestedAmount: string;
  acceptedAmount: string;
  patientAmount: string;
  paidAmount: string;
  requestedAt: string;
  acceptedAt: string | null;
  dueAt: string | null;
  notes: string | null;
  /** Ce que l'assureur doit réellement : demandé, puis accepté une fois arbitré. */
  expectedAmount: number;
  remainingAmount: number;
  late?: boolean;
  insurer?: { id: string; name: string; type: string };
  contract?: { id: string; name: string; reference: string | null } | null;
  customer?: { id: string; firstName: string; lastName: string; phone?: string | null } | null;
  sale?: { id: string; number: string; createdAt?: string; totalAmount?: string } | null;
  beneficiary?: { id: string; membershipNumber: string | null } | null;
  refunds?: InsuranceRefund[];
}

export interface ClaimFilters {
  insurerId?: string;
  status?: string;
  from?: string;
  to?: string;
  customerId?: string;
}

export async function listClaims(filters: ClaimFilters = {}): Promise<InsuranceClaim[]> {
  const { data } = await api.get<{ claims: InsuranceClaim[] }>('/insurance/claims', { params: filters });
  return data.claims;
}

export async function getClaim(id: string): Promise<InsuranceClaim> {
  const { data } = await api.get<{ claim: InsuranceClaim }>(`/insurance/claims/${id}`);
  return data.claim;
}

export async function createClaim(input: InsuranceClaimCreateInput) {
  const { data } = await api.post('/insurance/claims', input);
  return data.claim as InsuranceClaim;
}

export async function updateClaim(id: string, input: InsuranceClaimUpdateInput) {
  const { data } = await api.patch(`/insurance/claims/${id}`, input);
  return data.claim as InsuranceClaim;
}

export async function addRefund(claimId: string, input: InsuranceRefundCreateInput) {
  const { data } = await api.post(`/insurance/claims/${claimId}/refunds`, input);
  return data.claim as InsuranceClaim;
}

export async function listRefunds(filters: { insurerId?: string; from?: string; to?: string } = {}) {
  const { data } = await api.get<{ refunds: InsuranceRefund[]; total: number }>('/insurance/refunds', {
    params: filters,
  });
  return data;
}

export async function deleteRefund(id: string): Promise<void> {
  await api.delete(`/insurance/refunds/${id}`);
}

/* ---------- Créances et pilotage ---------- */

export interface InsuranceReceivables {
  totals: { due: number; pending: number; late: number; partiallyPaid: number; paid: number };
  items: InsuranceClaim[];
}

export async function getInsuranceReceivables(
  filters: ClaimFilters & { minAmount?: number } = {},
): Promise<InsuranceReceivables> {
  const { data } = await api.get<InsuranceReceivables>('/insurance/receivables', { params: filters });
  return data;
}

export interface InsuranceDashboard {
  totals: {
    requested: number;
    accepted: number;
    pending: number;
    invoiced: number;
    received: number;
    remaining: number;
    late: number;
  };
  months: { month: string; requested: number; received: number }[];
  byStatus: { status: string; count: number; amount: number }[];
  byInsurer: { insurerId: string; name: string; requested: number; received: number; remaining: number; claims: number }[];
}

export async function getInsuranceDashboard(): Promise<InsuranceDashboard> {
  const { data } = await api.get<InsuranceDashboard>('/insurance/dashboard');
  return data;
}
