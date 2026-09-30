import type {
  ActivationActivityInput,
  ActivationEventName,
  ActivationInformationInput,
  ActivationNeedsInput,
  ActivationPlanInput,
  CallbackRequestInput,
  PaymentMethod,
} from '@oculo/shared-types';
import { api } from '../../lib/api';

export interface ActivationSession {
  token: string;
  step: string;
  structureType: string | null;
  branchCount: string | null;
  country: string | null;
  needs: string[];
  planCode: string | null;
  billingCycle: string | null;
  fullName: string | null;
  establishmentName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  wantsStockImport: boolean;
  hasExistingData: boolean;
  activated: boolean;
}

export async function startActivation(utm: Record<string, string | undefined>): Promise<ActivationSession> {
  const { data } = await api.post<{ session: ActivationSession }>('/activation', null, { params: utm });
  return data.session;
}

export async function getActivation(token: string): Promise<ActivationSession> {
  const { data } = await api.get<{ session: ActivationSession }>(`/activation/${token}`);
  return data.session;
}

export async function saveActivity(token: string, input: ActivationActivityInput) {
  const { data } = await api.post<{ session: ActivationSession }>(`/activation/${token}/activity`, input);
  return data.session;
}

export async function saveNeeds(token: string, input: ActivationNeedsInput) {
  const { data } = await api.post<{ session: ActivationSession }>(`/activation/${token}/needs`, input);
  return data.session;
}

export async function savePlan(token: string, input: ActivationPlanInput) {
  const { data } = await api.post<{ session: ActivationSession }>(`/activation/${token}/plan`, input);
  return data.session;
}

export async function saveInformation(token: string, input: ActivationInformationInput) {
  const { data } = await api.post<{ session: ActivationSession }>(`/activation/${token}/information`, input);
  return data.session;
}

export interface StartPaymentResult {
  redirectUrl?: string;
  instruction?: string;
  simulation: boolean;
  paymentId: string;
}

export async function startPayment(token: string, method: PaymentMethod): Promise<StartPaymentResult> {
  const { data } = await api.post<StartPaymentResult>(`/activation/${token}/payment`, { method });
  return data;
}

export interface BankDetails {
  bankName: string | null;
  accountName: string | null;
  accountNumber: string;
  swift: string | null;
}

/** Options de fin de parcours : essai (minutes, 0 = désactivé) et virement (null = indisponible). */
export async function getTrialOffer(): Promise<{ minutes: number; bank: BankDetails | null }> {
  const { data } = await api.get<{ minutes: number; bank: BankDetails | null }>('/activation/trial-offer');
  return data;
}

export interface BankTransferRequest {
  invoiceNumber: string;
  amount: number;
  currency: string;
}

/** Déclare un virement : facture en attente, activée par l'équipe à réception du reçu. */
export async function requestBankTransfer(token: string): Promise<BankTransferRequest> {
  const { data } = await api.post<BankTransferRequest>(`/activation/${token}/bank-transfer`);
  return data;
}

/** Démarre l'essai gratuit : le serveur ouvre la session (cookie + jeton d'accès). */
export async function startTrial(token: string): Promise<{ accessToken: string; trialEndsAt: string }> {
  const { data } = await api.post<{ accessToken: string; trialEndsAt: string }>(`/activation/${token}/trial`);
  return data;
}

/** Ouvre une session quand le paiement est confirmé. `activated` fait foi. */
export async function getActivationStatus(
  token: string,
): Promise<{ activated: boolean; accessToken?: string }> {
  const { data } = await api.get<{ activated: boolean; accessToken?: string }>(
    `/activation/${token}/status`,
  );
  return data;
}

/** Suivi marketing. N'échoue jamais bruyamment : un clic perdu n'est pas un incident. */
export async function trackActivation(token: string, name: ActivationEventName): Promise<void> {
  try {
    await api.post(`/activation/${token}/event`, { name });
  } catch {
    /* mesure best-effort */
  }
}

export async function requestCallback(input: CallbackRequestInput & { token?: string }) {
  await api.post('/activation/callback', input);
}
