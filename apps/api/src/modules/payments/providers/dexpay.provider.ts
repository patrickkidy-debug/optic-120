import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentStatus } from '@oculo/shared-types';
import { badRequest } from '../../../lib/http-error.js';
import { logger } from '../../../lib/logger.js';
import type {
  PaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentResult,
  VerifyResult,
  WebhookContext,
  WebhookResult,
} from '../payment-provider.interface.js';

export const DEXPAY_LIVE_URL = 'https://api.dexpay.africa/api/v1';
export const DEXPAY_SANDBOX_URL = 'https://api-sandbox.dexpay.africa/api/v1';

export interface DexPayConfig {
  /** Clé publique `pk_live_…` / `pk_test_…` (en-tête x-api-key). */
  apiKey: string;
  /**
   * Clé secrète `sk_live_…` / `sk_test_…` (en-tête x-api-secret). Sert AUSSI à
   * signer les webhooks : DexPay n'a pas de secret de webhook distinct.
   */
  apiSecret: string;
  /** Vide = déduit du préfixe de la clé (test → sandbox, sinon production). */
  baseUrl?: string;
  /** URL de notification envoyée avec chaque session (obligatoire chez DexPay). */
  webhookUrl?: string;
  successUrl: string;
  failureUrl: string;
}

const REQUEST_TIMEOUT_MS = 20_000;

/** Environnement lu dans le préfixe des clés. */
export function dexpayEnvironment(apiKey: string, apiSecret = ''): 'sandbox' | 'live' | '' {
  if (apiKey.startsWith('pk_test_') || apiSecret.startsWith('sk_test_')) return 'sandbox';
  if (apiKey.startsWith('pk_live_') || apiSecret.startsWith('sk_live_')) return 'live';
  return '';
}

/**
 * Statut interne d'une session DexPay. Les docs emploient « completed » (session)
 * et « success » (webhook) : les deux créditent. Une session restée
 * « initiated »/« pending » après son expiration n'aboutira plus : abandon.
 * Ne JAMAIS créditer sur un statut qu'on ne reconnaît pas.
 */
export function dexpayStatus(status: string | undefined, expiresAt?: string | null, now = Date.now()): PaymentStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'completed':
    case 'success':
    case 'succeeded':
      return PaymentStatus.SUCCESS;
    case 'failed':
      return PaymentStatus.FAILED;
    case 'cancelled':
    case 'canceled':
    case 'expired':
      return PaymentStatus.CANCELLED;
    case 'refunded':
    case 'partially_refunded':
      return PaymentStatus.REFUNDED;
    case 'initiated':
    case 'pending': {
      const exp = expiresAt ? Date.parse(expiresAt) : NaN;
      return Number.isFinite(exp) && exp < now ? PaymentStatus.CANCELLED : PaymentStatus.PENDING;
    }
    default:
      return PaymentStatus.PENDING;
  }
}

/** Session telle que lue chez DexPay (champs utiles). */
export interface DexPaySession {
  id?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  payment_url?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

interface DexPayEnvelope<T> {
  status?: number;
  statusCode?: number;
  message?: string | string[];
  error?: string;
  code?: string;
  data?: T;
}

function messageOf(e: DexPayEnvelope<unknown> | null, fallback: string): string {
  const m = e?.message;
  return (Array.isArray(m) ? m.join(', ') : m) || e?.code || e?.error || fallback;
}

/**
 * DexPay (https://dexpay.africa, DEXCHANGE GROUP, Dakar) : Wave, Orange Money,
 * MTN, Moov, Mixx et cartes au Sénégal, en Côte d'Ivoire et dans 5 autres pays,
 * avec une page de paiement hébergée où le client choisit son opérateur.
 *
 * Parcours : création d'une session Checkout (notre identifiant de paiement
 * sert de `reference`, unique chez DexPay), redirection vers `payment_url`,
 * puis webhook signé. Le statut retenu est TOUJOURS relu via l'API avec nos
 * clés (cf. la route et le rapprochement actif).
 */
export class DexPayProvider implements PaymentProvider {
  readonly name = 'dexpay';

  constructor(private readonly config: DexPayConfig) {}

  private get baseUrl(): string {
    const fromKey =
      dexpayEnvironment(this.config.apiKey, this.config.apiSecret) === 'sandbox' ? DEXPAY_SANDBOX_URL : DEXPAY_LIVE_URL;
    return (this.config.baseUrl || fromKey).replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'x-api-secret': this.config.apiSecret,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const currency = input.currency.toUpperCase();
    if (!['XOF', 'XAF', 'GNF'].includes(currency)) {
      throw badRequest('DexPay encaisse en francs CFA (XOF, XAF) ou en francs guinéens (GNF).');
    }
    const back = input.returnUrl;
    const body = {
      reference: input.paymentId,
      item_name: `OculoSaaS ${input.saleNumber}`.slice(0, 120),
      amount: Math.round(input.amount),
      currency,
      success_url: back || this.config.successUrl,
      failure_url: back || this.config.failureUrl,
      ...(this.config.webhookUrl ? { webhook_url: this.config.webhookUrl } : {}),
      is_one_shot_payment: true,
      metadata: { payment_id: input.paymentId, invoice: input.saleNumber },
    };

    let res: Response;
    let text: string;
    try {
      res = await fetch(`${this.baseUrl}/checkout-sessions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      text = await res.text();
    } catch (err) {
      logger.error({ err }, 'DexPay : création de session injoignable');
      const reason = err instanceof Error ? err.message : 'inconnue';
      throw badRequest(`Connexion à DexPay impossible (${reason}). Réessayez.`);
    }

    let payload: DexPayEnvelope<DexPaySession> | null = null;
    try {
      payload = JSON.parse(text) as DexPayEnvelope<DexPaySession>;
    } catch {
      payload = null;
    }
    const s = payload?.data;
    if (res.ok && s?.payment_url) {
      return {
        providerRef: s.reference || input.paymentId,
        status: dexpayStatus(s.status, s.expires_at),
        redirectUrl: s.payment_url,
        raw: payload,
      };
    }
    logger.error({ status: res.status, dexpay: payload ?? text.slice(0, 250) }, 'DexPay : session refusée');
    throw badRequest(`DexPay a refusé le paiement : ${messageOf(payload, text.slice(0, 200) || `HTTP ${res.status}`)}`);
  }

  async verifyPayment(providerRef: string): Promise<VerifyResult> {
    try {
      const res = await fetch(`${this.baseUrl}/checkout-sessions/${encodeURIComponent(providerRef)}`, {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await res.text();
      let payload: DexPayEnvelope<DexPaySession> | null = null;
      try {
        payload = JSON.parse(text) as DexPayEnvelope<DexPaySession>;
      } catch {
        payload = null;
      }
      if (!res.ok || !payload?.data) {
        logger.warn({ status: res.status, providerRef }, 'DexPay : lecture de session refusée');
        return { status: PaymentStatus.PENDING, raw: payload ?? { httpStatus: res.status } };
      }
      return { status: dexpayStatus(payload.data.status, payload.data.expires_at), raw: payload.data };
    } catch (err) {
      // Panne réseau : on reste en attente, une relecture ultérieure tranchera.
      logger.error({ err, providerRef }, 'DexPay : vérification injoignable');
      return { status: PaymentStatus.PENDING, raw: { providerRef, error: 'unreachable' } };
    }
  }

  /**
   * Authentifie un webhook DexPay : `X-Webhook-Signature` = HMAC-SHA256 du corps
   * BRUT, clé = notre clé secrète, en hexadécimal. Calculé sur les octets reçus,
   * jamais sur un ré-encodage de l'objet parsé.
   * Renvoie un statut consultatif : l'appelant relit la session avant de créditer.
   */
  async handleWebhook(payload: unknown, signature?: string, context?: WebhookContext): Promise<WebhookResult> {
    const rawBody = context?.rawBody;
    if (!signature || !rawBody) throw badRequest('Webhook DexPay incomplet');
    const want = createHmac('sha256', this.config.apiSecret).update(rawBody).digest('hex');
    const a = Buffer.from(signature.trim().toLowerCase(), 'utf8');
    const b = Buffer.from(want, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw badRequest('Signature DexPay invalide');

    // Deux formes documentées : à plat, ou sous `data`.
    const body = (payload ?? {}) as { reference?: string; status?: string; data?: { reference?: string; status?: string } };
    const providerRef = body.data?.reference ?? body.reference ?? '';
    if (!providerRef) throw badRequest('Webhook DexPay sans référence');
    return { providerRef, status: dexpayStatus(body.data?.status ?? body.status), raw: payload };
  }
}
