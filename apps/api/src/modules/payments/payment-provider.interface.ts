import type { PaymentMethod, PaymentStatus } from '@oculo/shared-types';

export interface InitiatePaymentInput {
  paymentId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  customerName: string;
  customerPhone?: string;
  /** Email du client — requis par certaines passerelles (Moneroo). */
  customerEmail?: string;
  saleNumber: string;
}

export interface InitiatePaymentResult {
  providerRef: string;
  status: PaymentStatus;
  redirectUrl?: string;
  /** Instruction affichable au caissier (ex : code USSD, push mobile). */
  instruction?: string;
  raw?: unknown;
}

export interface VerifyResult {
  status: PaymentStatus;
  raw?: unknown;
}

export interface WebhookResult {
  providerRef: string;
  status: PaymentStatus;
  raw?: unknown;
}

/**
 * Contrat d'abstraction des fournisseurs de paiement. Permet de brancher
 * indifféremment la simulation (dev / pas de clés) ou Moneroo réel sans
 * toucher au flux de vente.
 */
export interface PaymentProvider {
  readonly name: string;
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verifyPayment(providerRef: string): Promise<VerifyResult>;
  handleWebhook(payload: unknown, signature?: string): Promise<WebhookResult>;
}
