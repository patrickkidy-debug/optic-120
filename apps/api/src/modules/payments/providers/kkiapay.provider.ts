import { timingSafeEqual } from 'node:crypto';
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

export const KKIAPAY_LIVE_URL = 'https://api.kkiapay.me';
export const KKIAPAY_SANDBOX_URL = 'https://api-sandbox.kkiapay.me';

export interface KkiapayConfig {
  /** Clé publique (en-tête x-api-key, et clé du widget côté navigateur). */
  publicKey: string;
  /** Clé privée (en-tête x-private-key). */
  privateKey: string;
  /** Clé secrète (en-tête x-secret-key). */
  secretKey: string;
  /** Vrai = environnement de test KkiaPay (clés sandbox). */
  sandbox: boolean;
  /** « Secret hash » du webhook, renvoyé par KkiaPay dans x-kkiapay-secret. */
  webhookSecret?: string;
  /** Page de l'application qui ouvre le widget KkiaPay (/paiement/kkiapay). */
  checkoutPageUrl: string;
  /** Retour par défaut une fois le paiement terminé. */
  returnUrl: string;
  baseUrl?: string;
}

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Statut interne d'une transaction KkiaPay. Seul « SUCCESS » crédite. Les refus
 * définitifs documentés passent en échec ; une transaction introuvable ou un
 * statut inconnu reste en attente (jamais de crédit par défaut).
 */
export function kkiapayStatus(status: string | undefined): PaymentStatus {
  switch ((status ?? '').toUpperCase()) {
    case 'SUCCESS':
      return PaymentStatus.SUCCESS;
    case 'FAILED':
    case 'INSUFFICIENT_FUND':
    case 'TRANSACTION_NOT_ELIGIBLE':
    case 'INVALID_TRANSACTION':
    case 'INVALID_TRANSACTION_TYPE':
      return PaymentStatus.FAILED;
    default:
      return PaymentStatus.PENDING;
  }
}

/** Transaction telle que relue chez KkiaPay (champs utiles). */
export interface KkiapayTransaction {
  transactionId?: string;
  status?: string;
  amount?: number;
  fees?: number;
  partnerId?: string | null;
  state?: unknown;
  source?: string;
  reason?: string;
  failureCode?: string;
  failureMessage?: string;
}

/**
 * KkiaPay (https://kkiapay.me) : Mobile Money (MTN, Moov, Orange, Wave…) et
 * cartes au Bénin, en Côte d'Ivoire, au Togo, au Sénégal et au Niger, en XOF.
 *
 * KkiaPay n'a PAS de page de paiement hébergée créée côté serveur : le paiement
 * se fait dans son widget JavaScript. On renvoie donc le client vers notre page
 * /paiement/kkiapay, qui ouvre le widget avec `partnerId` = notre identifiant
 * de paiement. L'identifiant de transaction obtenu est ensuite relu ICI, avec
 * nos clés, avant tout crédit (montant et partnerId contrôlés par l'appelant).
 */
export class KkiapayProvider implements PaymentProvider {
  readonly name = 'kkiapay';

  constructor(private readonly config: KkiapayConfig) {}

  private get baseUrl(): string {
    return (this.config.baseUrl || (this.config.sandbox ? KKIAPAY_SANDBOX_URL : KKIAPAY_LIVE_URL)).replace(/\/$/, '');
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (input.currency.toUpperCase() !== 'XOF') {
      throw badRequest('KkiaPay encaisse uniquement en francs CFA (XOF).');
    }
    const amount = Math.round(input.amount);
    const q = new URLSearchParams({
      p: input.paymentId,
      a: String(amount),
      k: this.config.publicKey,
      r: input.returnUrl || this.config.returnUrl,
    });
    if (this.config.sandbox) q.set('sb', '1');
    if (input.customerName) q.set('n', input.customerName.slice(0, 80));
    if (input.customerEmail) q.set('e', input.customerEmail);
    if (input.customerPhone) q.set('ph', input.customerPhone);
    return {
      // Pas encore de transaction : notre identifiant sert de référence d'attente,
      // remplacé par le transactionId KkiaPay à la confirmation.
      providerRef: input.paymentId,
      status: PaymentStatus.PENDING,
      redirectUrl: `${this.config.checkoutPageUrl}?${q.toString()}`,
      raw: { checkout: 'kkiapay-widget', amount },
    };
  }

  async verifyPayment(transactionId: string): Promise<VerifyResult> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/transactions/status`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.publicKey,
          'x-private-key': this.config.privateKey,
          'x-secret-key': this.config.secretKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ transactionId }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await res.text();
      let tx: KkiapayTransaction | null = null;
      try {
        tx = JSON.parse(text) as KkiapayTransaction;
      } catch {
        tx = null;
      }
      if (!res.ok || !tx) {
        logger.warn({ status: res.status, transactionId, body: text.slice(0, 200) }, 'KkiaPay : lecture de transaction refusée');
        return { status: PaymentStatus.PENDING, raw: tx ?? { httpStatus: res.status } };
      }
      return { status: kkiapayStatus(tx.status), raw: tx };
    } catch (err) {
      // Panne réseau : on reste en attente, une relecture ultérieure tranchera.
      logger.error({ err, transactionId }, 'KkiaPay : vérification injoignable');
      return { status: PaymentStatus.PENDING, raw: { transactionId, error: 'unreachable' } };
    }
  }

  /**
   * Authentifie un webhook KkiaPay : l'en-tête x-kkiapay-secret porte le
   * « secret hash » saisi dans le tableau de bord, comparé à temps constant.
   * Renvoie un statut consultatif : l'appelant relit la transaction avant de créditer.
   */
  async handleWebhook(payload: unknown, signature?: string, context?: WebhookContext): Promise<WebhookResult> {
    const secret = this.config.webhookSecret;
    const header = context?.headers?.['x-kkiapay-secret'];
    const got = signature ?? (Array.isArray(header) ? header[0] : header);
    if (!secret) throw badRequest('Secret du webhook KkiaPay non configuré');
    if (!got) throw badRequest('Webhook KkiaPay non authentifié');
    const a = Buffer.from(got.trim(), 'utf8');
    const b = Buffer.from(secret, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw badRequest('Secret du webhook KkiaPay invalide');

    const body = (payload ?? {}) as { transactionId?: string; isPaymentSucces?: boolean; event?: string };
    if (!body.transactionId) throw badRequest('Webhook KkiaPay sans transaction');
    const status =
      body.isPaymentSucces === true || body.event === 'transaction.success'
        ? PaymentStatus.SUCCESS
        : body.event === 'transaction.failed'
          ? PaymentStatus.FAILED
          : PaymentStatus.PENDING;
    return { providerRef: body.transactionId, status, raw: payload };
  }
}
