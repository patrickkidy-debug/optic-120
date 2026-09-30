import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentStatus, SUPPORTED_COUNTRIES } from '@oculo/shared-types';
import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentProvider,
  VerifyResult,
  WebhookContext,
  WebhookResult,
} from '../payment-provider.interface.js';

/**
 * Chariow (https://chariow.dev) — encaissement des abonnements OculoSaaS.
 *
 * Chariow ne vend pas un MONTANT mais un PRODUIT, dont le prix est fixé dans
 * son tableau de bord ; l'API ne peut pas le modifier. D'où trois règles :
 *
 *  1. Un produit Chariow par offre et par durée (CHARIOW_PRODUCTS). Chaque
 *     produit doit être de type « Licence » : c'est le seul type que Chariow
 *     laisse racheter. Un produit téléchargeable renvoie « already_purchased »
 *     au deuxième achat — l'opticien ne pourrait jamais renouveler.
 *  2. Le montant réellement payé est comparé à la facture AVANT d'activer quoi
 *     que ce soit (voir billing.routes.ts) : un prix modifié côté Chariow ne
 *     doit pas ouvrir six mois d'accès pour le prix d'un.
 *  3. Le statut ne se lit jamais dans le corps du webhook : la signature
 *     prouve l'origine, puis la vente est relue par l'API.
 */

export interface ChariowConfig {
  apiKey: string;
  baseUrl: string;
  pulseSecret?: string;
  /** « STANDARD:1 » -> « prd_xxx » */
  products: Record<string, string>;
}

interface ChariowSale {
  id: string;
  status: 'awaiting_payment' | 'completed' | 'failed' | 'abandoned' | 'settled' | string;
  amount?: { value: number; currency: string };
  product?: { id: string };
  custom_metadata?: Record<string, string> | null;
}

/** Parse CHARIOW_PRODUCTS sans faire tomber le serveur sur un JSON mal formé. */
export function parseChariowProducts(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw || '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([k, v]) => typeof k === 'string' && typeof v === 'string' && v.length > 0,
      ),
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Chariow exige le téléphone en deux parties : pays ISO + numéro seul.
 * « +225 07 12 34 56 » -> { country_code: 'CI', number: '07123456' }.
 * L'indicatif le plus long l'emporte (+2250… ne doit pas être lu comme +22…).
 */
export function splitPhone(raw: string | undefined): { country_code: string; number: string } | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) return null;
  const match = [...SUPPORTED_COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => cleaned.startsWith(c.dial));
  if (!match) return null;
  const number = cleaned.slice(match.dial.length);
  return number.length >= 5 ? { country_code: match.code, number } : null;
}

/** « Optique Lumière » -> prénom « Optique », nom « Lumière » (Chariow exige les deux). */
export function splitName(name: string): { first_name: string; last_name: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = (parts.shift() ?? 'Client').slice(0, 50);
  const last = (parts.join(' ') || 'OculoSaaS').slice(0, 50);
  return { first_name: first, last_name: last };
}

export function mapChariowStatus(status: string): PaymentStatus {
  switch (status) {
    case 'completed':
    case 'settled':
      return PaymentStatus.SUCCESS;
    case 'failed':
      return PaymentStatus.FAILED;
    case 'abandoned':
      return PaymentStatus.CANCELLED;
    default:
      return PaymentStatus.PENDING;
  }
}

/**
 * Signature d'un Pulse : "sha256=" + hex(HMAC-SHA256(corps BRUT, secret)).
 * Le corps parsé puis ré-encodé ne donne pas les mêmes octets (Chariow échappe
 * les « / » et l'unicode) : seule la chaîne reçue telle quelle est valable.
 */
export function verifyPulseSignature(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(header.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export class ChariowProvider implements PaymentProvider {
  readonly name = 'chariow';

  constructor(private readonly config: ChariowConfig) {}

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* réponse non JSON : on garde le texte pour le message */
    }
    if (!res.ok) {
      const msg = (json as { message?: string } | null)?.message ?? text.slice(0, 200);
      throw new Error(`Chariow ${method} ${path} : HTTP ${res.status} — ${msg}`);
    }
    return json as T;
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const productId = input.productKey ? this.config.products[input.productKey] : undefined;
    if (!productId) {
      throw new Error(
        `Aucun produit Chariow pour « ${input.productKey ?? 'offre inconnue'} ». ` +
          'Ajoutez-le dans CHARIOW_PRODUCTS (ex. {"STANDARD:1":"prd_..."}).',
      );
    }
    if (!input.customerEmail) throw new Error('Chariow exige un e-mail pour le paiement.');
    const phone = splitPhone(input.customerPhone);
    if (!phone) {
      throw new Error("Chariow exige un numéro de téléphone avec indicatif (ex. +225 07 12 34 56).");
    }

    const res = await this.request<{
      data: {
        step: 'payment' | 'completed' | 'already_purchased';
        purchase?: { id: string; status: string };
        payment?: { checkout_url?: string; transaction_id?: string };
      };
    }>('POST', '/checkout', {
      product_id: productId,
      email: input.customerEmail,
      ...splitName(input.customerName),
      phone,
      redirect_url: input.returnUrl,
      // Relie la vente Chariow au paiement OculoSaaS, pour l'audit.
      custom_metadata: { payment_id: input.paymentId, invoice: input.saleNumber },
    });

    const { step, purchase, payment } = res.data;
    if (step === 'already_purchased') {
      throw new Error(
        'Chariow refuse un nouvel achat de ce produit : il doit être de type « Licence » pour permettre les renouvellements.',
      );
    }
    if (!purchase?.id) throw new Error('Réponse Chariow sans identifiant de vente.');

    return {
      providerRef: purchase.id,
      status: step === 'completed' ? PaymentStatus.SUCCESS : PaymentStatus.PENDING,
      redirectUrl: payment?.checkout_url,
      raw: res.data,
    };
  }

  /** Relit la vente chez Chariow : seule source de vérité du statut. */
  async getSale(saleId: string): Promise<ChariowSale> {
    const res = await this.request<{ data: ChariowSale }>('GET', `/sales/${encodeURIComponent(saleId)}`);
    return res.data;
  }

  async verifyPayment(providerRef: string): Promise<VerifyResult> {
    const sale = await this.getSale(providerRef);
    return { status: mapChariowStatus(sale.status), raw: sale };
  }

  async handleWebhook(payload: unknown, signature?: string, context?: WebhookContext): Promise<WebhookResult> {
    const header = signature ?? (context?.headers?.['x-chariow-signature'] as string | undefined);
    if (!this.config.pulseSecret) throw new Error('CHARIOW_PULSE_SECRET non configuré : Pulse refusé.');
    if (!context?.rawBody || !verifyPulseSignature(context.rawBody, header, this.config.pulseSecret)) {
      throw new Error('Signature Chariow invalide');
    }
    const saleId = (payload as { sale?: { id?: string } })?.sale?.id;
    if (!saleId) throw new Error('Pulse Chariow sans identifiant de vente');
    // Statut relu par l'API, jamais pris dans le corps.
    const verified = await this.verifyPayment(saleId);
    return { providerRef: saleId, status: verified.status, raw: verified.raw };
  }
}
