import type { AuthUser, SignupInput, LoginInput, ProfileUpdateInput } from '@oculo/shared-types';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export type LoginOutcome = { twoFactorRequired: true; challenge: string } | { user: AuthUser };

export async function login(input: LoginInput): Promise<LoginOutcome> {
  const { data } = await api.post<AuthResponse & { twoFactorRequired?: boolean; challenge?: string }>(
    '/auth/login',
    input,
  );
  if (data.twoFactorRequired && data.challenge) {
    return { twoFactorRequired: true, challenge: data.challenge };
  }
  useAuthStore.getState().setAuth(data.accessToken, data.user);
  return { user: data.user };
}

/** 2ᵉ étape : valide le code TOTP et ouvre la session. */
export async function loginTwoFactor(challenge: string, code: string): Promise<AuthUser> {
  const { data } = await api.post<AuthResponse>('/auth/2fa/login', { challenge, code });
  useAuthStore.getState().setAuth(data.accessToken, data.user);
  return data.user;
}

/* --- Gestion 2FA (compte connecté) --- */
export async function getTwoFactorStatus(): Promise<boolean> {
  const { data } = await api.get<{ enabled: boolean }>('/auth/2fa');
  return data.enabled;
}
export async function setupTwoFactor(): Promise<{ qrDataUrl: string; secret: string }> {
  const { data } = await api.post<{ qrDataUrl: string; secret: string }>('/auth/2fa/setup');
  return data;
}
export async function enableTwoFactor(code: string): Promise<void> {
  await api.post('/auth/2fa/enable', { code });
}
export async function disableTwoFactor(password: string, code: string): Promise<void> {
  await api.post('/auth/2fa/disable', { password, code });
}

export async function signup(input: SignupInput): Promise<AuthUser> {
  const { data } = await api.post<AuthResponse>('/auth/signup', input);
  useAuthStore.getState().setAuth(data.accessToken, data.user);
  return data.user;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { token, newPassword });
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    useAuthStore.getState().clear();
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  const { data } = await api.post<{ ok: boolean }>('/auth/verify-password', { password });
  return data.ok;
}

export async function updateProfile(input: ProfileUpdateInput): Promise<AuthUser> {
  const { data } = await api.patch<{ user: AuthUser }>('/auth/me', input);
  useAuthStore.getState().setUser(data.user);
  return data.user;
}
