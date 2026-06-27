import { randomUUID } from 'node:crypto';
import { PaymentStatus, MOBILE_MONEY_METHODS } from '@oculo/shared-types';
import type {
  PaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentResult,
  VerifyResult,
  WebhookResult,
} from '../payment-provider.interface.js';

/**
 * Fournisseur simulé : utilisé tant qu'aucune clé CinetPay réelle n'est
 * configurée. Le Mobile Money reste PENDING jusqu'à un déclenchement manuel
 * (endpoint /payments/:id/simulate-callback). Cash et carte sont validés
 * immédiatement (encaissement constaté par le caissier).
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulation';

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const providerRef = `SIM-${randomUUID()}`;
    const isMobile = MOBILE_MONEY_METHODS.includes(input.method);

    if (!isMobile) {
      return { providerRef, status: PaymentStatus.SUCCESS, raw: { simulated: true } };
    }
    return {
      providerRef,
      status: PaymentStatus.PENDING,
      instruction:
        'Paiement mobile en attente (mode simulation). Utilisez « Simuler la confirmation » pour valider.',
      raw: { simulated: true },
    };
  }

  async verifyPayment(providerRef: string): Promise<VerifyResult> {
    // En simulation, l'état réel est porté par la base ; rien à vérifier côté provider.
    return { status: PaymentStatus.PENDING, raw: { providerRef, simulated: true } };
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const body = (payload ?? {}) as { providerRef?: string; status?: PaymentStatus };
    return {
      providerRef: body.providerRef ?? '',
      status: body.status ?? PaymentStatus.SUCCESS,
      raw: payload,
    };
  }
}
