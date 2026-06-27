import type { AuthUser, SignupInput, LoginInput } from '@oculo/shared-types';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export async function login(input: LoginInput): Promise<AuthUser> {
  const { data } = await api.post<AuthResponse>('/auth/login', input);
  useAuthStore.getState().setAuth(data.accessToken, data.user);
  return data.user;
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
