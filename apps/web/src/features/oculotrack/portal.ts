import axios, { AxiosError } from 'axios';
import { create } from 'zustand';
import type { TrackAnomalyType, TrackStage } from '@oculo/shared-types';
import { API_URL } from '../../lib/api';

/* ==========================================================================
 * Client du portail OculoTrack (laboratoires, fournisseurs, transporteurs).
 * Session totalement séparée de celle des magasins : jeton en mémoire,
 * cookie de renouvellement dédié (chemin /portal/auth).
 * ========================================================================== */

export interface PortalScope {
  accessId: string;
  tenantId: string;
  tenantName: string;
  supplierId: string | null;
  supplierName: string | null;
}
export interface PortalAccount {
  accountId: string;
  name: string;
  email: string;
  kind: 'SUPPLIER' | 'CARRIER';
  scopes: PortalScope[];
}

interface PortalState {
  status: 'loading' | 'guest' | 'ready';
  token: string | null;
  account: PortalAccount | null;
  set: (token: string, account: PortalAccount) => void;
  clear: () => void;
}
export const usePortal = create<PortalState>((set) => ({
  status: 'loading',
  token: null,
  account: null,
  set: (token, account) => set({ token, account, status: 'ready' }),
  clear: () => set({ token: null, account: null, status: 'guest' }),
}));

export const papi = axios.create({ baseURL: `${API_URL}/portal`, withCredentials: true, timeout: 45000 });
papi.interceptors.request.use((c) => {
  const t = usePortal.getState().token;
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
let refreshing: Promise<boolean> | null = null;
export function refreshPortal(): Promise<boolean> {
  refreshing ??= axios
    .post<{ accessToken: string; account: PortalAccount }>(`${API_URL}/portal/auth/refresh`, {}, { withCredentials: true })
    .then((r) => {
      usePortal.getState().set(r.data.accessToken, r.data.account);
      return true;
    })
    .catch((e: AxiosError) => {
      if (e.response) usePortal.getState().clear();
      return false;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}
papi.interceptors.response.use(undefined, async (error: AxiosError) => {
  const cfg = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
  if (error.response?.status === 401 && cfg && !cfg._retried && !cfg.url?.startsWith('/auth/')) {
    cfg._retried = true;
    if (await refreshPortal()) return papi(cfg);
  }
  throw error;
});

export function portalError(e: unknown): string {
  const ax = e as AxiosError<{ message?: string }>;
  if (!ax.response) return 'Connexion impossible';
  return ax.response.data?.message ?? 'Erreur';
}

/* ---------------------------- File hors ligne ---------------------------- */

/**
 * Actions terrain (réception, étape, anomalie, prise en charge…) : si le
 * réseau manque, l'action est mise en file AVEC son heure réelle et un
 * identifiant unique, puis rejouée automatiquement au retour de la
 * connexion. Le serveur ignore un rejeu déjà appliqué (clientEventId).
 */
interface QueuedAction {
  id: string;
  path: string;
  body: Record<string, unknown>;
  label: string;
  at: string;
}
const QKEY = 'oculo_portal_queue';
function readQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(QKEY) ?? '[]') as QueuedAction[];
  } catch {
    return [];
  }
}
function writeQueue(q: QueuedAction[]) {
  try {
    localStorage.setItem(QKEY, JSON.stringify(q));
  } catch {
    /* stockage plein ou indisponible : l'action reste à refaire */
  }
  usePendingCount.setState({ count: q.length });
}
export const usePendingCount = create<{ count: number }>(() => ({ count: readQueue().length }));

export async function sendAction(path: string, body: Record<string, unknown>, label: string): Promise<{ queued: boolean }> {
  const id = crypto.randomUUID();
  const full = { ...body, clientEventId: id, occurredAt: new Date().toISOString() };
  try {
    await papi.post(path, full);
    return { queued: false };
  } catch (e) {
    const ax = e as AxiosError;
    if (ax.response) throw e; // refus du serveur : ne pas mettre en file
    writeQueue([...readQueue(), { id, path, body: full, label, at: full.occurredAt }]);
    return { queued: true };
  }
}

let flushing = false;
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let done = 0;
  try {
    for (const a of readQueue()) {
      try {
        await papi.post(a.path, a.body);
        done++;
        writeQueue(readQueue().filter((x) => x.id !== a.id));
      } catch (e) {
        const ax = e as AxiosError;
        if (!ax.response) break; // toujours hors ligne : on réessaiera
        writeQueue(readQueue().filter((x) => x.id !== a.id)); // refusée définitivement : retirée
      }
    }
  } finally {
    flushing = false;
  }
  return done;
}

/* --------------------------------- Appels -------------------------------- */

export interface PortalOrderRow {
  id: string;
  tenantId: string;
  number: string;
  trackCode: string;
  trackStage: TrackStage;
  description: string;
  frameRef: string | null;
  expectedAt: string | null;
  updatedAt: string;
  store: string;
  client: string | null;
  openAnomalies: number;
  frameProduct: { name: string; brand: string | null } | null;
}
export interface PortalPackageRow {
  id: string;
  number: string;
  direction: 'OUTBOUND' | 'RETURN';
  status: string;
  fromCity: string | null;
  toCity: string | null;
  carrierName: string | null;
  externalTracking: string | null;
  expectedAt: string | null;
  store: string;
  _count: { items: number };
}
export interface PortalPackageDetail {
  package: PortalPackageRow & {
    note: string | null;
    items: { lensOrderId: string; checks: Record<string, boolean> | null; lensOrder: { id: string; trackCode: string; trackStage: TrackStage; frameRef: string | null; description: string; frameProduct: { name: string; brand: string | null } | null } }[];
  };
  events: { id: string; type: string; stage: string | null; actorType: 'STAFF' | 'SUPPLIER' | 'CARRIER' | 'SYSTEM'; actorName: string; message: string | null; occurredAt: string }[];
}

export const portal = {
  login: async (email: string, password: string) => (await papi.post<{ accessToken: string; account: PortalAccount }>('/auth/login', { email, password })).data,
  invite: async (token: string) => (await papi.get<{ name: string; email: string; kind: string }>(`/auth/invite/${token}`)).data,
  acceptInvite: async (token: string, password: string) => (await papi.post<{ accessToken: string; account: PortalAccount }>('/auth/accept-invite', { token, password })).data,
  logout: async () => papi.post('/auth/logout'),
  dashboard: async () => (await papi.get<{ kind: 'SUPPLIER' | 'CARRIER'; counts: Record<string, number> }>('/dashboard')).data,
  orders: async (filter?: string, q?: string) => (await papi.get<{ orders: PortalOrderRow[] }>('/orders', { params: { filter, q } })).data.orders,
  order: async (id: string) =>
    (await papi.get<{
      order: PortalOrderRow & {
        lensConfig: { lensType?: string; index?: string; material?: string; treatments?: string[]; prescription?: { sameForBoth?: boolean; od?: Record<string, number | string>; og?: Record<string, number | string> } } | null;
        odLens: string | null;
        ogLens: string | null;
        notes: string | null;
        trackAttachments: { id: string; kind: string; name: string | null; mime: string; uploadedByName: string; createdAt: string }[];
        trackAnomalies: { id: string; type: TrackAnomalyType; comment: string | null; status: string; reportedByName: string; createdAt: string }[];
        packageItems: { package: { id: string; number: string; direction: string; status: string } }[];
      };
      measurement: Record<string, number | string | null> | null;
      events: PortalPackageDetail['events'];
    }>(`/orders/${id}`)).data,
  packages: async (filter?: string) => (await papi.get<{ packages: PortalPackageRow[] }>('/packages', { params: { filter } })).data.packages,
  package: async (id: string) => (await papi.get<PortalPackageDetail>(`/packages/${id}`)).data,
  scan: async (token: string) => (await papi.get<PortalPackageDetail>(`/scan/${encodeURIComponent(token)}`)).data,
  attachment: async (id: string) => (await papi.get<{ attachment: { data: string; mime: string } }>(`/attachments/${id}`)).data.attachment,
  uploadProof: async (orderId: string, data: string, name?: string) => (await papi.post(`/orders/${orderId}/attachments`, { kind: 'MOUNT_PROOF', data, name })).data,
};
