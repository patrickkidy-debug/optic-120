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
 * Contexte brut d'un webhook. Nécessaire aux passerelles qui signent le corps
 * en HMAC (GeniusPay) : la signature porte sur les octets exacts reçus, et
 * ré-encoder l'objet parsé la ferait échouer dès qu'un caractère s'encode
 * différemment d'un langage à l'autre.
 */
export interface WebhookContext {
  /** Corps de la requête tel quel, avant parsing JSON. */
  rawBody?: string;
  /** En-têtes en minuscules, tels que Fastify les expose. */
  headers?: Record<string, string | string[] | undefined>;
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
  /**
   * `context` n'est fourni que par les routes qui capturent le corps brut ; les
   * passerelles qui n'en ont pas besoin (PayTech, Moneroo) l'ignorent, une
   * implémentation avec moins de paramètres reste compatible.
   */
  handleWebhook(
    payload: unknown,
    signature?: string,
    context?: WebhookContext,
  ): Promise<WebhookResult>;
}
