import { createHash } from 'node:crypto';
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

interface PayTechConfig {
  apiKey: string;
  apiSecret: string;
  env: 'test' | 'prod';
  baseUrl: string;
  /** URL IPN (notification serveur) — doit pointer vers l'API publique. */
  ipnUrl?: string;
  /** Redirections du client après paiement (frontend). */
  successUrl?: string;
  cancelUrl?: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Fournisseur PayTech (https://paytech.sn) — passerelle Sénégal/XOF : Wave,
 * Orange Money, Free Money, Wizall et cartes. Paiement par redirection vers un
 * checkout hébergé. PayTech ne propose pas d'endpoint de vérification fiable :
 * la confirmation arrive par IPN, dont on authentifie l'origine en comparant
 * sha256(clé API) et sha256(clé secrète) transmis dans le corps.
 */
export class PayTechProvider implements PaymentProvider {
  readonly name = 'paytech';

  constructor(private readonly config: PayTechConfig) {}

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const url = `${this.config.baseUrl}/payment/request-payment`;
    let res: Response;
    let bodyText: string;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          API_KEY: this.config.apiKey,
          API_SECRET: this.config.apiSecret,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'OculoSaaS/1.0 (+https://oculosaas.africa)',
        },
        body: JSON.stringify({
          item_name: `Paiement ${input.saleNumber}`,
          item_price: Math.round(input.amount),
          currency: input.currency,
          ref_command: input.paymentId,
          command_name: `Paiement ${input.saleNumber}`,
          env: this.config.env,
          ipn_url: this.config.ipnUrl,
          success_url: this.config.successUrl,
          cancel_url: this.config.cancelUrl,
          custom_field: JSON.stringify({ payment_id: input.paymentId }),
        }),
      });
      bodyText = await res.text();
    } catch (err) {
      logger.error({ err, url }, 'PayTech : appel réseau /request-payment échoué');
      const reason = err instanceof Error ? err.message : 'inconnue';
      throw badRequest(`Connexion à PayTech impossible (${reason}). Réessayez.`);
    }

    let data: { success?: number | boolean; token?: string; redirect_url?: string; errors?: unknown };
    try {
      data = JSON.parse(bodyText);
    } catch {
      const snippet = bodyText.slice(0, 200).replace(/\s+/g, ' ').trim();
      logger.error({ status: res.status, body: snippet, url }, 'PayTech : réponse non-JSON');
      throw badRequest(
        `PayTech a renvoyé une réponse inattendue (HTTP ${res.status}) : ${snippet || 'corps vide'}`,
      );
    }

    const ok = data.success === 1 || data.success === true;
    if (!ok || !data.token || !data.redirect_url) {
      logger.error({ paytech: data, status: res.status }, 'PayTech : initialisation refusée');
      const reason = data.errors
        ? JSON.stringify(data.errors).slice(0, 200)
        : `HTTP ${res.status}`;
      throw badRequest(`PayTech a refusé la transaction : ${reason}`);
    }

    return {
      providerRef: data.token,
      status: PaymentStatus.PENDING,
      redirectUrl: data.redirect_url,
      raw: data,
    };
  }

  async verifyPayment(providerRef: string): Promise<VerifyResult> {
    // PayTech ne fournit pas d'endpoint de vérification : le statut authentique
    // provient de l'IPN (cf. handleWebhook). On reste donc en attente ici.
    return { status: PaymentStatus.PENDING, raw: { providerRef, note: 'paytech-ipn-only' } };
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const body = (payload ?? {}) as {
      type_event?: string;
      token?: string;
      ref_command?: string;
      api_key_sha256?: string;
      api_secret_sha256?: string;
    };

    // Authentification de l'IPN : PayTech renvoie sha256(clé API) et
    // sha256(clé secrète). On vérifie qu'ils correspondent à nos clés.
    const keyOk = body.api_key_sha256 === sha256(this.config.apiKey);
    const secretOk = body.api_secret_sha256 === sha256(this.config.apiSecret);
    if (!keyOk || !secretOk) {
      logger.warn('PayTech : IPN avec signature (sha256) invalide');
      throw badRequest('IPN PayTech invalide');
    }

    const status =
      body.type_event === 'sale_complete'
        ? PaymentStatus.SUCCESS
        : body.type_event === 'sale_canceled'
          ? PaymentStatus.CANCELLED
          : PaymentStatus.PENDING;

    return {
      providerRef: body.token ?? body.ref_command ?? '',
      status,
      raw: payload,
    };
  }
}
