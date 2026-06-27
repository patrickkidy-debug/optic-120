import { PaymentStatus } from '@oculo/shared-types';
import type {
  PaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentResult,
  VerifyResult,
  WebhookResult,
} from '../payment-provider.interface.js';

interface CinetPayConfig {
  apiKey: string;
  siteId: string;
  baseUrl: string;
  notifyUrl?: string;
  returnUrl?: string;
}

/** Mappe un statut CinetPay vers notre enum interne. */
function mapStatus(code: string | undefined): PaymentStatus {
  switch (code) {
    case 'ACCEPTED':
    case '00':
      return PaymentStatus.SUCCESS;
    case 'REFUSED':
      return PaymentStatus.FAILED;
    case 'CANCELED':
      return PaymentStatus.CANCELLED;
    default:
      return PaymentStatus.PENDING;
  }
}

/**
 * Fournisseur CinetPay réel. Implémenté selon l'API v2 mais NON exercé tant
 * que le tenant est en mode simulation ou sans clés. Activé automatiquement
 * dès qu'une configuration valide est fournie (cf. payment.service factory).
 */
export class CinetPayProvider implements PaymentProvider {
  readonly name = 'cinetpay';

  constructor(private readonly config: CinetPayConfig) {}

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const res = await fetch(`${this.config.baseUrl}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: this.config.apiKey,
        site_id: this.config.siteId,
        transaction_id: input.paymentId,
        amount: Math.round(input.amount),
        currency: input.currency,
        description: `Vente ${input.saleNumber}`,
        customer_name: input.customerName,
        customer_phone_number: input.customerPhone ?? '',
        notify_url: this.config.notifyUrl,
        return_url: this.config.returnUrl,
        channels: 'ALL',
      }),
    });
    const data = (await res.json()) as {
      code?: string;
      data?: { payment_token?: string; payment_url?: string };
    };
    return {
      providerRef: input.paymentId,
      status: PaymentStatus.PENDING,
      redirectUrl: data.data?.payment_url,
      raw: data,
    };
  }

  async verifyPayment(providerRef: string): Promise<VerifyResult> {
    const res = await fetch(`${this.config.baseUrl}/payment/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: this.config.apiKey,
        site_id: this.config.siteId,
        transaction_id: providerRef,
      }),
    });
    const data = (await res.json()) as { data?: { status?: string } };
    return { status: mapStatus(data.data?.status), raw: data };
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const body = (payload ?? {}) as { cpm_trans_id?: string; cpm_result?: string };
    return {
      providerRef: body.cpm_trans_id ?? '',
      status: mapStatus(body.cpm_result),
      raw: payload,
    };
  }
}
