import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentStatus } from '@oculo/shared-types';
import { badRequest } from '../../../lib/http-error.js';
import { logger } from '../../../lib/logger.js';
import type {
  PaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentResult,
  VerifyResult,
  WebhookResult,
} from '../payment-provider.interface.js';

interface MonerooConfig {
  /** Clé secrète Moneroo (Bearer). */
  secretKey: string;
  baseUrl: string;
  /** URL de retour après paiement sur le checkout Moneroo. */
  returnUrl?: string;
  /** Secret de vérification des signatures de webhook. */
  webhookSecret?: string;
}

/** Mappe un statut Moneroo vers notre enum interne. */
function mapStatus(status: string | undefined): PaymentStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'success':
    case 'completed':
      return PaymentStatus.SUCCESS;
    case 'failed':
    case 'declined':
      return PaymentStatus.FAILED;
    case 'cancelled':
    case 'canceled':
      return PaymentStatus.CANCELLED;
    default:
      // initiated / pending / processing
      return PaymentStatus.PENDING;
  }
}

/** Découpe « Prénom Nom » en deux champs (Moneroo exige first/last name). */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: 'Client', last: '-' };
  if (parts.length === 1) return { first: parts[0]!, last: '-' };
  return { first: parts[0]!, last: parts.slice(1).join(' ') };
}

/**
 * Fournisseur Moneroo (https://moneroo.io) — agrégateur Mobile Money + cartes
 * pour l'Afrique. Paiement par redirection vers un checkout hébergé : on
 * initialise la transaction, on redirige le client vers `checkout_url`, puis
 * on confirme via webhook + vérification serveur (jamais de confiance au corps).
 */
export class MonerooProvider implements PaymentProvider {
  readonly name = 'moneroo';

  constructor(private readonly config: MonerooConfig) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.secretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Évite les pages de challenge (Cloudflare) renvoyées au User-Agent par défaut.
      'User-Agent': 'OculoSaaS/1.0 (+https://oculosaas.africa)',
    };
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const url = `${this.config.baseUrl}/payments/initialize`;
    const { first, last } = splitName(input.customerName);
    const email =
      input.customerEmail && input.customerEmail.includes('@')
        ? input.customerEmail
        : `client+${input.paymentId}@oculosaas.africa`;

    let res: Response;
    let bodyText: string;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          amount: Math.round(input.amount),
          currency: input.currency,
          description: `Paiement ${input.saleNumber}`,
          customer: {
            email,
            first_name: first,
            last_name: last,
            phone: input.customerPhone || undefined,
          },
          return_url: this.config.returnUrl,
          metadata: { payment_id: input.paymentId, sale_number: input.saleNumber },
        }),
      });
      bodyText = await res.text();
    } catch (err) {
      logger.error({ err, url }, 'Moneroo : appel réseau /payments/initialize échoué');
      const reason = err instanceof Error ? err.message : 'inconnue';
      throw badRequest(`Connexion à Moneroo impossible (${reason}). Réessayez.`);
    }

    let data: {
      message?: string;
      errors?: unknown;
      data?: { id?: string; checkout_url?: string };
    };
    try {
      data = JSON.parse(bodyText);
    } catch {
      const snippet = bodyText.slice(0, 200).replace(/\s+/g, ' ').trim();
      logger.error({ status: res.status, body: snippet, url }, 'Moneroo : réponse non-JSON');
      throw badRequest(
        `Moneroo a renvoyé une réponse inattendue (HTTP ${res.status}) : ${snippet || 'corps vide'}`,
      );
    }

    // Succès : Moneroo renvoie data.id (référence) + data.checkout_url.
    if (!res.ok || !data.data?.checkout_url || !data.data?.id) {
      logger.error({ moneroo: data, status: res.status }, 'Moneroo : initialisation refusée');
      const reason =
        data.message ||
        (data.errors ? JSON.stringify(data.errors).slice(0, 200) : '') ||
        `HTTP ${res.status}`;
      throw badRequest(`Moneroo a refusé la transaction : ${reason}`);
    }

    return {
      providerRef: data.data.id,
      status: PaymentStatus.PENDING,
      redirectUrl: data.data.checkout_url,
      raw: data,
    };
  }

  async verifyPayment(providerRef: string): Promise<VerifyResult> {
    const url = `${this.config.baseUrl}/payments/${encodeURIComponent(providerRef)}/verify`;
    const res = await fetch(url, { method: 'GET', headers: this.headers() });
    const data = (await res.json().catch(() => ({}))) as { data?: { status?: string } };
    return { status: mapStatus(data.data?.status), raw: data };
  }

  /**
   * Webhook Moneroo : on valide la signature si un secret est configuré, puis
   * on renvoie l'identifiant de transaction. Le statut authentique est ensuite
   * re-vérifié via verifyPayment (le corps n'est jamais cru sur parole).
   */
  async handleWebhook(payload: unknown, signature?: string): Promise<WebhookResult> {
    if (this.config.webhookSecret && signature) {
      const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expected = createHmac('sha256', this.config.webhookSecret).update(raw).digest('hex');
      const ok =
        expected.length === signature.length &&
        timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      if (!ok) {
        logger.warn('Moneroo : signature de webhook invalide');
        throw badRequest('Signature de webhook Moneroo invalide');
      }
    }

    const body = (typeof payload === 'string' ? JSON.parse(payload) : (payload ?? {})) as {
      event?: string;
      data?: { id?: string; status?: string };
    };
    return {
      providerRef: body.data?.id ?? '',
      status: mapStatus(body.data?.status),
      raw: payload,
    };
  }
}
