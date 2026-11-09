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

export interface WaveConfig {
  /** Clé d'API Wave Business (`wave_ci_prod_…`), en-tête Authorization: Bearer. */
  apiKey: string;
  baseUrl: string;
  /**
   * Secret de signature des REQUÊTES (`wave_..._AKS_…`), seulement si la
   * signature a été activée à la création de la clé : Wave refuse alors toute
   * requête non signée.
   */
  signingSecret?: string;
  /**
   * Secret du WEBHOOK : secret de signature (`wave_..._WHS_…`, en-tête
   * Wave-Signature) ou secret partagé (en-tête Authorization: Bearer), selon la
   * stratégie choisie à la déclaration du webhook.
   */
  webhookSecret?: string;
  successUrl: string;
  errorUrl: string;
}

/** Fenêtre anti-rejeu du webhook, en secondes (valeur recommandée par Wave). */
const WEBHOOK_MAX_AGE_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 15_000;

/** Session Checkout Wave (champs utiles). */
export interface WaveCheckoutSession {
  id?: string;
  amount?: string;
  currency?: string;
  client_reference?: string | null;
  checkout_status?: string;
  payment_status?: string;
  transaction_id?: string | null;
  wave_launch_url?: string;
  when_expires?: string;
  last_payment_error?: { code?: string; message?: string } | null;
}

/**
 * Statut interne d'une session Wave.
 *  - payment_status « succeeded » : payé ;
 *  - session « expired » sans paiement : abandon (plus aucun paiement possible) ;
 *  - tout le reste (open, processing, ou « cancelled » sur une session encore
 *    ouverte : le client peut réessayer) : en attente.
 * Ne JAMAIS créditer sur un statut qu'on ne reconnaît pas.
 */
export function waveStatus(s: WaveCheckoutSession | undefined): PaymentStatus {
  const payment = (s?.payment_status ?? '').toLowerCase();
  const checkout = (s?.checkout_status ?? '').toLowerCase();
  if (payment === 'succeeded') return PaymentStatus.SUCCESS;
  if (checkout === 'expired') return PaymentStatus.CANCELLED;
  return PaymentStatus.PENDING;
}

/** Signature Wave : HMAC-SHA256(secret, `<timestamp><corps>`) en hexadécimal. */
export function waveSign(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(timestamp + body).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Wave en DIRECT (API Checkout de Wave Business), sans agrégateur : frais
 * marchand Wave seulement, confirmation quasi immédiate.
 *
 * Parcours : on crée une session Checkout, le client est redirigé vers
 * `wave_launch_url` (application Wave ou QR code), puis revient sur nos URL de
 * retour. La confirmation arrive par webhook ; le statut retenu est TOUJOURS
 * relu via l'API avec notre clé (cf. la route et le rapprochement actif).
 *
 * Wave n'encaisse qu'en XOF, sans décimales.
 */
export class WaveProvider implements PaymentProvider {
  readonly name = 'wave';

  constructor(private readonly config: WaveConfig) {}

  private headers(body: string): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.config.signingSecret) {
      const t = String(Math.floor(Date.now() / 1000));
      h['Wave-Signature'] = `t=${t},v1=${waveSign(this.config.signingSecret, t, body)}`;
    }
    return h;
  }

  private async call(method: 'GET' | 'POST', path: string, payload?: unknown) {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    // Le corps est sérialisé UNE fois : la signature porte sur ces octets exacts.
    const body = payload === undefined ? '' : JSON.stringify(payload);
    const res = await fetch(url, {
      method,
      headers: this.headers(body),
      ...(payload === undefined ? {} : { body }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { res, text, json };
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (input.currency.toUpperCase() !== 'XOF') {
      throw badRequest('Wave n’encaisse qu’en francs CFA (XOF).');
    }
    const back = input.returnUrl || this.config.successUrl;
    const payload = {
      amount: String(Math.round(input.amount)),
      currency: 'XOF',
      success_url: back,
      error_url: input.returnUrl || this.config.errorUrl,
      // Notre identifiant de paiement : il revient dans le webhook et la lecture.
      client_reference: input.paymentId.slice(0, 255),
    };

    let out: Awaited<ReturnType<WaveProvider['call']>>;
    try {
      out = await this.call('POST', '/v1/checkout/sessions', payload);
    } catch (err) {
      logger.error({ err }, 'Wave : création de session injoignable');
      const reason = err instanceof Error ? err.message : 'inconnue';
      throw badRequest(`Connexion à Wave impossible (${reason}). Réessayez.`);
    }

    const s = out.json as WaveCheckoutSession | null;
    if (out.res.ok && s?.id && s.wave_launch_url) {
      return { providerRef: s.id, status: waveStatus(s), redirectUrl: s.wave_launch_url, raw: s };
    }

    const err = (out.json ?? {}) as { code?: string; message?: string; error?: { code?: string; message?: string } };
    const detail =
      err.message || err.error?.message || err.code || err.error?.code || out.text.slice(0, 200) || `HTTP ${out.res.status}`;
    logger.error({ status: out.res.status, wave: out.json }, 'Wave : session refusée');
    throw badRequest(`Wave a refusé le paiement : ${detail}`);
  }

  async verifyPayment(providerRef: string): Promise<VerifyResult> {
    try {
      const out = await this.call('GET', `/v1/checkout/sessions/${encodeURIComponent(providerRef)}`);
      if (!out.res.ok) {
        logger.warn({ status: out.res.status, providerRef, wave: out.json }, 'Wave : lecture de session refusée');
        return { status: PaymentStatus.PENDING, raw: out.json ?? { httpStatus: out.res.status } };
      }
      return { status: waveStatus(out.json as WaveCheckoutSession), raw: out.json };
    } catch (err) {
      // Panne réseau : on reste en attente, une relecture ultérieure tranchera.
      logger.error({ err, providerRef }, 'Wave : vérification injoignable');
      return { status: PaymentStatus.PENDING, raw: { providerRef, error: 'unreachable' } };
    }
  }

  /**
   * Authentifie un webhook Wave, selon la stratégie choisie à sa déclaration :
   *  - secret de signature : en-tête `Wave-Signature: t=<ts>,v1=<hex>[,v1=…]`,
   *    HMAC-SHA256 de `<ts><corps brut>` ; refusé au-delà de 5 minutes ;
   *  - secret partagé : en-tête `Authorization: Bearer <secret>`.
   * Renvoie un statut consultatif : l'appelant relit la session avant de créditer.
   */
  async handleWebhook(payload: unknown, _signature?: string, context?: WebhookContext): Promise<WebhookResult> {
    const secret = this.config.webhookSecret;
    if (!secret) {
      logger.error('Wave : WAVE_WEBHOOK_SECRET absent, webhook rejeté');
      throw badRequest('Webhook Wave non configuré');
    }
    const headers = context?.headers ?? {};
    const sigHeader = String(headers['wave-signature'] ?? '');
    const auth = String(headers['authorization'] ?? '');

    if (sigHeader) {
      const rawBody = context?.rawBody ?? '';
      const parts = sigHeader.split(',').map((p) => p.trim());
      const t = parts.find((p) => p.startsWith('t='))?.slice(2) ?? '';
      const sigs = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
      const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
      if (!t || !Number.isFinite(age) || age > WEBHOOK_MAX_AGE_SECONDS) {
        throw badRequest('Webhook Wave expiré');
      }
      const want = waveSign(secret, t, rawBody);
      if (!sigs.some((s) => safeEqual(s, want))) throw badRequest('Signature Wave invalide');
    } else if (auth.startsWith('Bearer ')) {
      if (!safeEqual(auth.slice(7), secret)) throw badRequest('Secret Wave invalide');
    } else {
      throw badRequest('Webhook Wave non authentifié');
    }

    const body = (payload ?? {}) as { type?: string; data?: WaveCheckoutSession };
    const providerRef = body.data?.id ?? '';
    if (!providerRef) throw badRequest('Webhook Wave sans session');
    return { providerRef, status: waveStatus(body.data), raw: payload };
  }
}
