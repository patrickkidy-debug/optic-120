import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentMethod, PaymentStatus } from '@oculo/shared-types';
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

export interface GeniusPayConfig {
  /** Clé publique `pk_live_…` / `pk_sandbox_…` (en-tête X-API-Key). */
  apiKey: string;
  /** Clé secrète `sk_live_…` / `sk_sandbox_…` (en-tête X-API-Secret). */
  apiSecret: string;
  baseUrl: string;
  /** Secret `whsec_…` du webhook, distinct des clés d'API. */
  webhookSecret?: string;
  successUrl?: string;
  errorUrl?: string;
  /**
   * Force la page de checkout GeniusPay, où le client choisit lui-même son
   * opérateur, en n'envoyant jamais `payment_method`.
   *
   * Indispensable pour les ABONNEMENTS : l'écran d'abonnement envoie « WAVE »
   * en dur, hérité de Moneroo qui ignorait cette valeur et affichait sa propre
   * page. GeniusPay, lui, la respecte — sans ce drapeau, un client marocain
   * serait envoyé chez Wave, qui n'existe pas dans son pays.
   */
  forceHostedCheckout?: boolean;
}

/**
 * Correspondance méthode interne → code GeniusPay. Volontairement partielle :
 * seules les méthodes que GeniusPay nomme explicitement y figurent. Pour toutes
 * les autres (Free Money, M-Pesa, Multicaixa, Vinti4…) on n'envoie PAS de
 * `payment_method`, ce qui affiche la page de checkout GeniusPay où le client
 * choisit lui-même parmi les opérateurs réellement disponibles dans son pays.
 * C'est le comportement documenté, et pour un encaissement d'abonnement réparti
 * sur 23 pays il vaut mieux laisser choisir que d'imposer un opérateur absent.
 */
const METHOD_CODES: Partial<Record<PaymentMethod, string>> = {
  [PaymentMethod.WAVE]: 'wave',
  [PaymentMethod.ORANGE_MONEY]: 'orange_money',
  [PaymentMethod.MTN_MOMO]: 'mtn_money',
  [PaymentMethod.MOOV_MONEY]: 'moov_money',
  [PaymentMethod.CARD]: 'card',
};

/** Fenêtre anti-rejeu du webhook, en secondes (valeur recommandée par GeniusPay). */
const WEBHOOK_MAX_AGE_SECONDS = 300;

const REQUEST_TIMEOUT_MS = 20_000;

function mapStatus(raw: string | undefined): PaymentStatus {
  switch ((raw ?? '').toLowerCase()) {
    case 'completed':
      return PaymentStatus.SUCCESS;
    case 'failed':
      return PaymentStatus.FAILED;
    case 'cancelled':
    case 'canceled':
    // Un paiement expiré n'aboutira jamais : on le traite comme un abandon
    // plutôt que de le laisser éternellement en attente.
    case 'expired':
      return PaymentStatus.CANCELLED;
    case 'refunded':
      return PaymentStatus.REFUNDED;
    default:
      // `pending`, `processing`, ou un statut inconnu : on reste en attente.
      // Ne JAMAIS créditer sur un statut qu'on ne reconnaît pas.
      return PaymentStatus.PENDING;
  }
}

interface GeniusPayEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  message?: string;
}

interface GeniusPayPayment {
  id?: number;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  checkout_url?: string;
  payment_url?: string;
  payment_method?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fournisseur GeniusPay (https://geniuspay.ci) — orchestrateur multi-passerelles
 * couvrant 23 pays africains : Wave, Orange Money, MTN, Moov, Airtel, PawaPay,
 * Paystack et cartes bancaires.
 *
 * Authentification par deux en-têtes (X-API-Key / X-API-Secret) ; contrairement
 * à PayTech, aucune signature n'est calculée sur les requêtes sortantes — le
 * secret ne sert qu'à l'appel serveur et ne doit jamais atteindre le navigateur.
 *
 * La confirmation arrive par webhook signé, mais le statut retenu est TOUJOURS
 * relu via l'API (cf. la route) : c'est le corps du webhook qui est le maillon
 * faible, pas notre appel authentifié.
 */
export class GeniusPayProvider implements PaymentProvider {
  readonly name = 'geniuspay';

  constructor(private readonly config: GeniusPayConfig) {}

  private headers(): Record<string, string> {
    return {
      'X-API-Key': this.config.apiKey,
      'X-API-Secret': this.config.apiSecret,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'OculoSaaS/1.0 (+https://oculosaas.com)',
    };
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const url = `${this.config.baseUrl}/payments`;
    const methodCode = this.config.forceHostedCheckout ? undefined : METHOD_CODES[input.method];

    const body: Record<string, unknown> = {
      amount: Math.round(input.amount),
      currency: input.currency,
      description: `Paiement ${input.saleNumber}`,
      customer: {
        name: input.customerName,
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
        ...(input.customerPhone ? { phone: input.customerPhone } : {}),
      },
      // Le `metadata` nous revient tel quel dans le webhook et dans la lecture
      // du paiement : c'est notre lien de rattachement, indépendant de la
      // référence générée par GeniusPay.
      metadata: { payment_id: input.paymentId, sale_number: input.saleNumber },
      ...(methodCode ? { payment_method: methodCode } : {}),
      ...(this.config.successUrl ? { success_url: this.config.successUrl } : {}),
      ...(this.config.errorUrl ? { error_url: this.config.errorUrl } : {}),
    };

    let res: Response;
    let bodyText: string;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      bodyText = await res.text();
    } catch (err) {
      logger.error({ err, url }, 'GeniusPay : appel réseau /payments échoué');
      const reason = err instanceof Error ? err.message : 'inconnue';
      throw badRequest(`Connexion à GeniusPay impossible (${reason}). Réessayez.`);
    }

    let payload: GeniusPayEnvelope<GeniusPayPayment>;
    try {
      payload = JSON.parse(bodyText) as GeniusPayEnvelope<GeniusPayPayment>;
    } catch {
      const snippet = bodyText.slice(0, 250).replace(/\s+/g, ' ').trim();
      logger.error({ status: res.status, body: snippet, url }, 'GeniusPay : réponse non-JSON');
      throw badRequest(
        `GeniusPay a renvoyé une réponse inattendue (HTTP ${res.status}) : ${snippet || 'corps vide'}`,
      );
    }

    const data = payload.data;
    // En mode checkout c'est `checkout_url` ; quand une méthode est imposée,
    // GeniusPay renvoie directement l'URL de l'opérateur dans `payment_url`.
    const redirectUrl = data?.checkout_url ?? data?.payment_url;
    if (payload.success && data?.reference && redirectUrl) {
      return {
        providerRef: data.reference,
        status: mapStatus(data.status),
        redirectUrl,
        raw: payload,
      };
    }

    logger.error({ geniuspay: payload, status: res.status }, 'GeniusPay : initialisation refusée');
    const detail =
      payload.error?.message ||
      payload.error?.code ||
      payload.message ||
      bodyText.slice(0, 250).replace(/\s+/g, ' ').trim() ||
      `HTTP ${res.status}`;
    throw badRequest(`GeniusPay a refusé la transaction : ${detail}`);
  }

  async verifyPayment(providerRef: string): Promise<VerifyResult> {
    const url = `${this.config.baseUrl}/payments/${encodeURIComponent(providerRef)}`;
    let res: Response;
    let bodyText: string;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      bodyText = await res.text();
    } catch (err) {
      // Une panne réseau ne doit pas faire basculer un paiement en échec :
      // on reste en attente, le webhook ou une relecture ultérieure tranchera.
      logger.error({ err, url }, 'GeniusPay : vérification injoignable');
      return { status: PaymentStatus.PENDING, raw: { providerRef, error: 'unreachable' } };
    }

    let payload: GeniusPayEnvelope<GeniusPayPayment>;
    try {
      payload = JSON.parse(bodyText) as GeniusPayEnvelope<GeniusPayPayment>;
    } catch {
      logger.error({ status: res.status, url }, 'GeniusPay : vérification non-JSON');
      return { status: PaymentStatus.PENDING, raw: { providerRef, httpStatus: res.status } };
    }

    if (!payload.success || !payload.data) {
      logger.warn({ geniuspay: payload, providerRef }, 'GeniusPay : transaction introuvable');
      return { status: PaymentStatus.PENDING, raw: payload };
    }

    return { status: mapStatus(payload.data.status), raw: payload };
  }

  /**
   * Authentifie un webhook GeniusPay.
   *
   * Signature : HMAC-SHA256(`<timestamp>.<corps JSON>`, whsec_…), en hexadécimal.
   * La vérification porte sur le corps BRUT tel qu'il a été reçu, jamais sur un
   * ré-encodage de l'objet parsé : `JSON.stringify` en Node et `json_encode` en
   * PHP ne produisent pas les mêmes octets (PHP échappe « / » en « \/ » et les
   * accents en \uXXXX), donc ré-encoder ferait échouer la signature dès qu'une
   * URL ou un nom accentué apparaît dans la charge utile.
   *
   * Renvoie un statut consultatif : l'appelant doit relire le paiement via
   * `verifyPayment` avant de créditer quoi que ce soit.
   */
  async handleWebhook(
    payload: unknown,
    signature?: string,
    context?: WebhookContext,
  ): Promise<WebhookResult> {
    const secret = this.config.webhookSecret;
    if (!secret) {
      // Sans secret configuré, impossible de distinguer un vrai webhook d'un
      // faux : on refuse plutôt que d'accepter aveuglément.
      logger.error('GeniusPay : GENIUSPAY_WEBHOOK_SECRET absent, webhook rejeté');
      throw badRequest('Webhook GeniusPay non configuré');
    }

    const timestamp = String(context?.headers?.['x-webhook-timestamp'] ?? '');
    const rawBody = context?.rawBody;
    if (!signature || !timestamp || !rawBody) {
      logger.warn(
        { hasSignature: Boolean(signature), hasTimestamp: Boolean(timestamp), hasRaw: Boolean(rawBody) },
        'GeniusPay : webhook incomplet (signature, timestamp ou corps brut manquant)',
      );
      throw badRequest('Webhook GeniusPay incomplet');
    }

    // Anti-rejeu : un webhook capté puis renvoyé plus tard doit être refusé.
    const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (!Number.isFinite(age) || age > WEBHOOK_MAX_AGE_SECONDS) {
      logger.warn({ timestamp, age }, 'GeniusPay : webhook hors fenêtre temporelle');
      throw badRequest('Webhook GeniusPay expiré');
    }

    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    // Comparaison à temps constant : une comparaison naïve laisse fuir la
    // signature attendue octet par octet via le temps de réponse.
    const given = Buffer.from(signature, 'utf8');
    const want = Buffer.from(expected, 'utf8');
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      logger.warn('GeniusPay : signature de webhook invalide');
      throw badRequest('Signature GeniusPay invalide');
    }

    const body = (payload ?? {}) as {
      event?: string;
      data?: { reference?: string; status?: string; metadata?: Record<string, unknown> };
    };
    const providerRef = body.data?.reference ?? '';
    if (!providerRef) {
      logger.warn({ event: body.event }, 'GeniusPay : webhook sans référence');
      throw badRequest('Webhook GeniusPay sans référence');
    }

    return { providerRef, status: mapStatus(body.data?.status), raw: payload };
  }
}
