import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/auth';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  // Le serveur (Render gratuit) peut se réveiller lentement : on laisse du temps.
  timeout: 60000,
});

/**
 * Erreur transitoire (réveil du serveur, passerelle indisponible) qu'on peut
 * réessayer sans risque : la requête n'a pas été traitée par l'application.
 */
function isTransient(error: AxiosError): boolean {
  if (error.code === 'ECONNABORTED') return true; // timeout
  if (!error.response) return true; // erreur réseau / aucune réponse
  return [502, 503, 504].includes(error.response.status);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

export async function refreshSession(): Promise<string | null> {
  // Réessaie en cas de réveil du serveur (cold start) avant d'abandonner.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await axios.post(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: 60000 },
      );
      const { accessToken, user } = res.data;
      useAuthStore.getState().setAuth(accessToken, user);
      return accessToken;
    } catch (err) {
      if (axios.isAxiosError(err) && isTransient(err) && attempt < 2) {
        await wait(1500 * (attempt + 1));
        continue;
      }
      useAuthStore.getState().clear();
      return null;
    }
  }
  useAuthStore.getState().clear();
  return null;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as
      | (typeof error.config & { _retry?: boolean; _retryCount?: number })
      | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';

    // Abonnement suspendu : bascule l'app en mode "régularisation".
    if (status === 402) {
      useAuthStore.getState().setSuspended(true);
    }

    // Réveil du serveur / passerelle indisponible : on réessaie (backoff).
    if (original && isTransient(error)) {
      original._retryCount = (original._retryCount ?? 0) + 1;
      if (original._retryCount <= 4) {
        await wait(Math.min(1500 * original._retryCount, 6000));
        return api(original);
      }
    }

    if (status === 401 && original && !original._retry && !url.includes('/auth/')) {
      original._retry = true;
      if (!refreshing) {
        refreshing = refreshSession().finally(() => {
          refreshing = null;
        });
      }
      const token = await refreshing;
      if (token) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Extrait un message d'erreur lisible depuis une réponse API. */
export function apiErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: { message?: string } } | undefined;
    return data?.error?.message ?? err.message ?? fallback;
  }
  return fallback;
}
