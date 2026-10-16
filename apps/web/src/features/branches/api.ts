import { api } from '../../lib/api';
import type { BranchCreateInput, BranchPeriod, OpeningHours } from '@oculo/shared-types';

/** Statut affiché : archivé, inactif, en configuration (fiche incomplète) ou actif. */
export type BranchStatus = 'ACTIVE' | 'INACTIVE' | 'SETUP' | 'ARCHIVED';
export type MissingField = 'address' | 'phone' | 'city' | 'manager';

export interface BranchPerson {
  id: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
}

export interface BranchRow {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  countryCode: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  logoUrl: string | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  openingHours: OpeningHours | null;
  managerId: string | null;
  manager: BranchPerson | null;
  isMain: boolean;
  status: BranchStatus;
  missing: MissingField[];
  staffCount: number;
  lowStock: number;
  pendingIn: number;
  pendingOut: number;
  /** null : l'utilisateur n'a pas accès au chiffre d'affaires. */
  revenue: number | null;
  salesCount: number | null;
}

export interface BranchOverview {
  period: BranchPeriod;
  from: string;
  currency: string;
  mainBranchId: string | null;
  branches: BranchRow[];
  totals: { branches: number; active: number; archived: number; collaborators: number; revenue: number | null };
  permissions: { revenue: boolean; create: boolean; update: boolean; team: boolean; allBranches: boolean };
}

export async function getBranchOverview(period: BranchPeriod, includeArchived: boolean): Promise<BranchOverview> {
  const { data } = await api.get<BranchOverview>('/branches/overview', {
    params: { period, includeArchived: includeArchived ? '1' : undefined },
  });
  return data;
}

export interface BranchTeamMember extends BranchPerson {
  email: string;
  lastLoginAt: string | null;
  role: { name: string; allBranches: boolean };
  branchCount: number;
}

export interface BranchTransfer {
  id: string;
  number: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  confirmedAt: string | null;
  fromBranchId: string;
  toBranchId: string;
  fromBranch: { name: string };
  toBranch: { name: string };
  createdBy: { firstName: string; lastName: string } | null;
  confirmedBy: { firstName: string; lastName: string } | null;
  units: number;
}

export interface BranchDetail {
  branch: Omit<BranchRow, 'staffCount' | 'lowStock' | 'pendingIn' | 'pendingOut' | 'revenue' | 'salesCount'>;
  currency: string;
  tenantCountryCode: string | null;
  period: BranchPeriod;
  from: string;
  activity: {
    revenue: number | null;
    collected: number | null;
    salesCount: number | null;
    receivables: number | null;
    openQuotes: number | null;
    registerOpenSince: string | null;
  };
  team: BranchTeamMember[] | null;
  allBranchUsers: { id: string; firstName: string; lastName: string; role: { name: string } }[] | null;
  stock: {
    lowStockCount: number | null;
    lowStock: { id: string; name: string; sku: string; quantity: number; minAlert: number }[] | null;
    units: number;
    refs: number;
    inTransitIn: number;
    transfers: BranchTransfer[];
  } | null;
  permissions: {
    revenue: boolean;
    sales: boolean;
    team: boolean;
    teamEdit: boolean;
    stock: boolean;
    transfer: boolean;
    update: boolean;
    setMain: boolean;
  };
}

export async function getBranchDetail(id: string, period: BranchPeriod): Promise<BranchDetail> {
  const { data } = await api.get<BranchDetail>(`/branches/${id}`, { params: { period } });
  return data;
}

export async function nextBranchCode(): Promise<string> {
  const { data } = await api.get<{ code: string }>('/branches/next-code');
  return data.code;
}

export async function createBranchFull(input: BranchCreateInput) {
  const { data } = await api.post('/branches', input);
  return data.branch as { id: string; name: string };
}

export async function updateBranch(id: string, input: Partial<BranchCreateInput>) {
  const { data } = await api.patch(`/branches/${id}`, input);
  return data.branch as { id: string; name: string };
}

export async function setBranchTeam(id: string, userIds: string[]) {
  const { data } = await api.put<{ added: number; removed: number }>(`/branches/${id}/team`, { userIds });
  return data;
}

export async function setMainBranch(id: string) {
  await api.post(`/branches/${id}/main`, {});
}

export interface ArchiveIssue {
  code: string;
  params?: Record<string, string | number>;
}
export async function archiveCheck(id: string) {
  const { data } = await api.get<{ canArchive: boolean; blockers: ArchiveIssue[]; warnings: ArchiveIssue[] }>(`/branches/${id}/archive-check`);
  return data;
}

export async function archiveBranch(id: string) {
  await api.post(`/branches/${id}/archive`, {});
}

export async function restoreBranch(id: string) {
  await api.post(`/branches/${id}/restore`, {});
}
