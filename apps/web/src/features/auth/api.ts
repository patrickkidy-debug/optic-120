import type {
  AuthUser,
  SignupInput,
  LoginInput,
  ProfileUpdateInput,
  GoogleSignupInput,
  EstablishmentChoice,
} from '@oculo/shared-types';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export type LoginOutcome =
  | { twoFactorRequired: true; challenge: string }
  | { chooseEstablishment: EstablishmentChoice[]; selectionToken: string }
  | { user: AuthUser };

type LoginApiResponse = AuthResponse & {
  twoFactorRequired?: boolean;
  challenge?: string;
  chooseEstablishment?: EstablishmentChoice[];
  selectionToken?: string;
};

export async function login(input: LoginInput): Promise<LoginOutcome> {
  const { data } = await api.post<LoginApiResponse>('/auth/login', input);
  if (data.chooseEstablishment && data.selectionToken) {
    return { chooseEstablishment: data.chooseEstablishment, selectionToken: data.selectionToken };
  }
  if (data.twoFactorRequired && data.challenge) {
    return { twoFactorRequired: true, challenge: data.challenge };
  }
  useAuthStore.getState().setAuth(data.accessToken, data.user);
  return { user: data.user };
}

/** 2ᵉ étape multi-établissement : choisit l'établissement à activer. */
export async function loginSelectTenant(
  selectionToken: string,
  tenantId: string,
): Promise<LoginOutcome> {
  const { data } = await api.post<LoginApiResponse>('/auth/login/select', {
    selectionToken,
    tenantId,
  });
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

export type GoogleLoginOutcome =
  | { twoFactorRequired: true; challenge: string }
  | { needsSignup: true; email: string; firstName: string; lastName: string }
  | { user: AuthUser };

/** « Se connecter avec Google » : idToken vérifié côté serveur. */
export async function googleLogin(idToken: string): Promise<GoogleLoginOutcome> {
  const { data } = await api.post<
    AuthResponse & { twoFactorRequired?: boolean; challenge?: string; needsSignup?: boolean; email?: string; firstName?: string; lastName?: string }
  >('/auth/google/login', { idToken });
  if (data.needsSignup) {
    return { needsSignup: true, email: data.email!, firstName: data.firstName!, lastName: data.lastName! };
  }
  if (data.twoFactorRequired && data.challenge) {
    return { twoFactorRequired: true, challenge: data.challenge };
  }
  useAuthStore.getState().setAuth(data.accessToken, data.user);
  return { user: data.user };
}

/** Inscription d'un nouvel établissement via Google. */
export async function googleSignup(input: GoogleSignupInput): Promise<AuthUser> {
  const { data } = await api.post<AuthResponse>('/auth/google/signup', input);
  useAuthStore.getState().setAuth(data.accessToken, data.user);
  return data.user;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { token, newPassword });
}

/** Confirme l'adresse email à partir du jeton du lien. */
export async function verifyEmail(token: string): Promise<void> {
  await api.post('/auth/verify-email', { token });
}

/** Renvoie l'email de confirmation au compte connecté. */
export async function resendVerification(): Promise<void> {
  await api.post('/auth/resend-verification');
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
