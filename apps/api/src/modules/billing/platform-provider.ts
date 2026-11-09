import { env, appOrigin, isProd } from '../../config/env.js';
import type { PaymentProvider } from '../payments/payment-provider.interface.js';
import { SimulatedPaymentProvider } from '../payments/providers/simulated.provider.js';
import { MonerooProvider } from '../payments/providers/moneroo.provider.js';
import { ChariowProvider, parseChariowProducts } from '../payments/providers/chariow.provider.js';
import { KkiapayProvider } from '../payments/providers/kkiapay.provider.js';
import { WaveProvider } from '../payments/providers/wave.provider.js';
import { DexPayProvider, dexpayEnvironment } from '../payments/providers/dexpay.provider.js';

/**
 * Fournisseur de paiement de la PLATEFORME : l'editeur encaisse les
 * abonnements. Distinct du fournisseur des ventes, qui encaisse pour le compte
 * d'un magasin.
 *
 * UNE SEULE passerelle a la fois, choisie par PLATFORM_PAYMENT_PROVIDER :
 * « kkiapay » (defaut depuis le 2026-11-09, a la place de GeniusPay), « dexpay »,
 * « moneroo » ou « chariow ». La cascade d'autrefois (Moneroo, puis
 * GeniusPay, puis PayTech) faisait qu'une cle absente ou invalide basculait
 * silencieusement sur une autre passerelle : les paiements partaient ailleurs
 * sans que personne ne le remarque. Ici, la passerelle choisie sans ses cles
 * ECHOUE en production au lieu de se rabattre sur l'autre.
 *
 * Moneroo et PayTech restent dans le code : ils servent encore aux
 * encaissements des magasins, qui ne passent pas par ici.
 */
export function kkiapayReady(): boolean {
  return Boolean(env.KKIAPAY_PUBLIC_KEY && env.KKIAPAY_PRIVATE_KEY && env.KKIAPAY_SECRET_KEY);
}

/** Fournisseur KkiaPay, ou null sans ses trois clés. */
export function kkiapayProvider(): KkiapayProvider | null {
  if (!kkiapayReady()) return null;
  return new KkiapayProvider({
    publicKey: env.KKIAPAY_PUBLIC_KEY,
    privateKey: env.KKIAPAY_PRIVATE_KEY,
    secretKey: env.KKIAPAY_SECRET_KEY,
    sandbox: env.KKIAPAY_SANDBOX,
    webhookSecret: env.KKIAPAY_WEBHOOK_SECRET || undefined,
    checkoutPageUrl: `${appOrigin}/paiement/kkiapay`,
    returnUrl: `${appOrigin}/parametres/abonnement`,
  });
}

export function dexpayReady(): boolean {
  return Boolean(env.DEXPAY_PUBLIC_KEY && env.DEXPAY_SECRET_KEY);
}

/** Fournisseur DexPay, ou null sans ses clés. */
export function dexpayProvider(): PaymentProvider | null {
  if (!dexpayReady()) return null;
  const apiBase = env.PUBLIC_API_URL.replace(/\/$/, '');
  return new DexPayProvider({
    apiKey: env.DEXPAY_PUBLIC_KEY,
    apiSecret: env.DEXPAY_SECRET_KEY,
    baseUrl: env.DEXPAY_BASE_URL || undefined,
    // DexPay prend l'URL de notification session par session.
    webhookUrl: apiBase ? `${apiBase}/webhooks/dexpay-subscription` : undefined,
    successUrl: `${appOrigin}/parametres/abonnement`,
    failureUrl: `${appOrigin}/parametres/abonnement`,
  });
}

function chariowReady(): boolean {
  return Boolean(env.CHARIOW_API_KEY) && Object.keys(parseChariowProducts(env.CHARIOW_PRODUCTS)).length > 0;
}

export function resolvePlatformProvider(): PaymentProvider {
  if (env.PLATFORM_PAYMENT_PROVIDER === 'kkiapay') {
    const kkia = kkiapayProvider();
    if (kkia) return kkia;
    if (isProd) {
      throw new Error(
        'KkiaPay choisi (PLATFORM_PAYMENT_PROVIDER=kkiapay) mais non configure : ' +
          'definissez KKIAPAY_PUBLIC_KEY, KKIAPAY_PRIVATE_KEY et KKIAPAY_SECRET_KEY.',
      );
    }
    return new SimulatedPaymentProvider();
  }

  if (env.PLATFORM_PAYMENT_PROVIDER === 'dexpay') {
    const dex = dexpayProvider();
    if (dex) return dex;
    if (isProd) {
      throw new Error(
        'DexPay choisi (PLATFORM_PAYMENT_PROVIDER=dexpay) mais non configure : ' +
          'definissez DEXPAY_PUBLIC_KEY et DEXPAY_SECRET_KEY.',
      );
    }
    return new SimulatedPaymentProvider();
  }

  if (env.PLATFORM_PAYMENT_PROVIDER === 'chariow') {
    if (chariowReady()) {
      return new ChariowProvider({
        apiKey: env.CHARIOW_API_KEY,
        baseUrl: env.CHARIOW_BASE_URL,
        pulseSecret: env.CHARIOW_PULSE_SECRET || undefined,
        products: parseChariowProducts(env.CHARIOW_PRODUCTS),
      });
    }
    if (isProd) {
      throw new Error(
        'Chariow choisi (PLATFORM_PAYMENT_PROVIDER=chariow) mais non configure : ' +
          'definissez CHARIOW_API_KEY et CHARIOW_PRODUCTS.',
      );
    }
    return new SimulatedPaymentProvider();
  }

  if (env.MONEROO_SECRET_KEY) {
    return new MonerooProvider({
      secretKey: env.MONEROO_SECRET_KEY,
      baseUrl: env.MONEROO_BASE_URL,
      // Retour par defaut. Le tunnel d'activation impose le sien, paiement par
      // paiement (voir InitiatePaymentInput.returnUrl).
      returnUrl: `${appOrigin}/parametres/abonnement`,
      webhookSecret: env.MONEROO_WEBHOOK_SECRET || undefined,
    });
  }

  // Aucune cle Moneroo. En PRODUCTION on echoue volontairement (fail-closed) :
  // sans paiement reel, un abonnement ne doit JAMAIS pouvoir etre active.
  if (isProd) {
    throw new Error(
      "Aucune passerelle de paiement configuree : definissez MONEROO_SECRET_KEY. " +
        "L'activation d'un abonnement exige un paiement reel.",
    );
  }
  // Developpement uniquement : permet de derouler le parcours sans encaisser.
  return new SimulatedPaymentProvider();
}

/**
 * Lecture des paiements Moneroo lancés avant le passage à une autre passerelle
 * (webhook tardif). Null sans clé Moneroo.
 */
export function monerooVerifier(): PaymentProvider | null {
  if (!env.MONEROO_SECRET_KEY) return null;
  return new MonerooProvider({
    secretKey: env.MONEROO_SECRET_KEY,
    baseUrl: env.MONEROO_BASE_URL,
    returnUrl: `${appOrigin}/parametres/abonnement`,
    webhookSecret: env.MONEROO_WEBHOOK_SECRET || undefined,
  });
}

/* ----------------------------- Wave en direct ----------------------------- */

export function waveReady(): boolean {
  return Boolean(env.WAVE_API_KEY);
}

/** Fournisseur Wave direct, ou null sans clé Wave. */
export function waveProvider(): PaymentProvider | null {
  if (!waveReady()) return null;
  return new WaveProvider({
    apiKey: env.WAVE_API_KEY,
    baseUrl: env.WAVE_BASE_URL,
    signingSecret: env.WAVE_SIGNING_SECRET || undefined,
    webhookSecret: env.WAVE_WEBHOOK_SECRET || undefined,
    successUrl: `${appOrigin}/parametres/abonnement`,
    errorUrl: `${appOrigin}/parametres/abonnement`,
  });
}

/**
 * Passerelle d'un paiement d'abonnement selon le moyen choisi : Wave en direct
 * quand le client choisit Wave, paie en XOF et que la clé Wave est posée ;
 * sinon la passerelle de la plateforme (KkiaPay…), qui affiche les autres
 * opérateurs et la carte.
 */
export function resolveProviderForPayment(method: string, currency: string): PaymentProvider {
  if (method === 'WAVE' && currency.toUpperCase() === 'XOF') {
    const wave = waveProvider();
    if (wave) return wave;
  }
  return resolvePlatformProvider();
}

/**
 * Passerelle capable de relire un paiement déjà lancé, d'après le nom
 * enregistré sur le paiement (« wave », « kkiapay », « moneroo »…). Null si
 * cette passerelle n'est plus configurée.
 */
export function verifierFor(name: string | null | undefined): PaymentProvider | null {
  if (name === 'wave') return waveProvider();
  // DexPay reste lisible même après le passage à une autre passerelle.
  if (name === 'dexpay') return dexpayProvider();
  if (name === 'kkiapay') return kkiapayProvider();
  try {
    const active = resolvePlatformProvider();
    if (active.name === name) return active;
  } catch {
    // Passerelle de la plateforme non configurée : on tente les autres.
  }
  if (name === 'moneroo') return monerooVerifier();
  return null;
}

/**
 * Etat de la passerelle d'encaissement des abonnements, pour la console
 * fondateur.
 *
 * Sans cet etat, poser une cle revient a configurer a l'aveugle : rien
 * n'indique si la passerelle est reellement retenue, ni si l'adresse de
 * notification est joignable. Ne renvoie JAMAIS de secret — uniquement des
 * booleens et des URLs publiques.
 */
export interface PaymentProviderStatus {
  /** Passerelle retenue : « kkiapay », « dexpay », « moneroo », « chariow » ou « simulation ». */
  active: string;
  /** Passerelle choisie dans la configuration, meme si ses cles manquent. */
  selected: 'kkiapay' | 'dexpay' | 'moneroo' | 'chariow';
  dexpayConfigured: boolean;
  /** Environnement lu dans le préfixe des clés : « live », « sandbox » ou vide. */
  dexpayEnvironment: string;
  /** URL de notification envoyée avec chaque session DexPay (vide sans PUBLIC_API_URL). */
  dexpayWebhookUrl: string;
  kkiapayConfigured: boolean;
  /** « Secret hash » du webhook KkiaPay renseigne (sans lui, webhooks refuses). */
  kkiapayWebhookSecret: boolean;
  /** « sandbox » (KKIAPAY_SANDBOX=true) ou « live ». */
  kkiapayEnvironment: string;
  /** URL a declarer chez KkiaPay (webhook). */
  kkiapayWebhookUrl: string;
  /** Wave en direct : clé posée (les clients qui choisissent Wave paient chez Wave). */
  waveConfigured: boolean;
  /** Secret du webhook Wave renseigné (sans lui, webhooks refusés). */
  waveWebhookSecret: boolean;
  /** Signature des requêtes Wave activée. */
  waveSigning: boolean;
  /** URL à déclarer chez Wave Business (webhook). */
  waveWebhookUrl: string;
  chariowConfigured: boolean;
  chariowPulseSecret: boolean;
  /** Offres couvertes par un produit Chariow, ex. ["STANDARD:1"]. */
  chariowProducts: string[];
  /** URL a declarer comme Pulse chez Chariow. */
  chariowWebhookUrl: string;
  /** Vrai quand aucune cle Moneroo n'est posee (developpement seulement). */
  simulation: boolean;
  monerooConfigured: boolean;
  /** Secret de signature du webhook Moneroo renseigne. */
  monerooWebhookSecret: boolean;
  /**
   * URLs a declarer chez Moneroo. Vides si PUBLIC_API_URL n'est pas defini :
   * dans ce cas la passerelle n'a aucune adresse ou notifier le paiement, et
   * les abonnements resteraient bloques « en attente » malgre un reglement
   * reussi.
   */
  subscriptionWebhookUrl: string;
  salesWebhookUrl: string;
}

export function getPaymentProviderStatus(): PaymentProviderStatus {
  const monerooConfigured = Boolean(env.MONEROO_SECRET_KEY);
  const apiBase = env.PUBLIC_API_URL.replace(/\/$/, '');
  const selected = env.PLATFORM_PAYMENT_PROVIDER;
  const active =
    selected === 'kkiapay'
      ? kkiapayReady()
        ? 'kkiapay'
        : 'simulation'
      : selected === 'dexpay'
        ? dexpayReady()
          ? 'dexpay'
          : 'simulation'
      : selected === 'chariow'
        ? chariowReady()
          ? 'chariow'
          : 'simulation'
        : monerooConfigured
          ? 'moneroo'
          : 'simulation';
  return {
    active,
    selected,
    dexpayConfigured: dexpayReady(),
    dexpayEnvironment: dexpayEnvironment(env.DEXPAY_PUBLIC_KEY, env.DEXPAY_SECRET_KEY),
    dexpayWebhookUrl: apiBase ? `${apiBase}/webhooks/dexpay-subscription` : '',
    kkiapayConfigured: kkiapayReady(),
    kkiapayWebhookSecret: Boolean(env.KKIAPAY_WEBHOOK_SECRET),
    kkiapayEnvironment: env.KKIAPAY_SANDBOX ? 'sandbox' : 'live',
    kkiapayWebhookUrl: apiBase ? `${apiBase}/webhooks/kkiapay-subscription` : '',
    waveConfigured: waveReady(),
    waveWebhookSecret: Boolean(env.WAVE_WEBHOOK_SECRET),
    waveSigning: Boolean(env.WAVE_SIGNING_SECRET),
    waveWebhookUrl: apiBase ? `${apiBase}/webhooks/wave-subscription` : '',
    chariowConfigured: chariowReady(),
    chariowPulseSecret: Boolean(env.CHARIOW_PULSE_SECRET),
    chariowProducts: Object.keys(parseChariowProducts(env.CHARIOW_PRODUCTS)),
    chariowWebhookUrl: apiBase ? `${apiBase}/webhooks/chariow-subscription` : '',
    simulation: isPlatformSimulation(),
    monerooConfigured,
    monerooWebhookSecret: Boolean(env.MONEROO_WEBHOOK_SECRET),
    subscriptionWebhookUrl: apiBase ? `${apiBase}/webhooks/moneroo-subscription` : '',
    salesWebhookUrl: apiBase ? `${apiBase}/webhooks/moneroo` : '',
  };
}

export function isPlatformSimulation(): boolean {
  // Jamais de simulation en production : seul un paiement reel active un abonnement.
  if (isProd) return false;
  if (env.PLATFORM_PAYMENT_PROVIDER === 'kkiapay') return !kkiapayReady();
  if (env.PLATFORM_PAYMENT_PROVIDER === 'dexpay') return !dexpayReady();
  if (env.PLATFORM_PAYMENT_PROVIDER === 'chariow') return !chariowReady();
  return !env.MONEROO_SECRET_KEY;
}
