import { env, appOrigin, isProd } from '../../config/env.js';
import type { PaymentProvider } from '../payments/payment-provider.interface.js';
import { SimulatedPaymentProvider } from '../payments/providers/simulated.provider.js';
import { MonerooProvider } from '../payments/providers/moneroo.provider.js';

/**
 * Fournisseur de paiement de la PLATEFORME : l'editeur encaisse les
 * abonnements. Distinct du fournisseur des ventes, qui encaisse pour le compte
 * d'un magasin.
 *
 * MONEROO UNIQUEMENT, par decision produit. La cascade precedente (Moneroo,
 * puis GeniusPay, puis PayTech) faisait qu'une cle Moneroo absente ou invalide
 * basculait silencieusement sur une autre passerelle : les paiements
 * partaient ailleurs sans que personne ne le remarque. Une seule passerelle
 * rend la configuration verifiable.
 *
 * Les fournisseurs GeniusPay et PayTech restent dans le code : ils servent
 * encore aux encaissements des magasins, qui ne passent pas par ici.
 */
export function resolvePlatformProvider(): PaymentProvider {
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
 * Etat de la passerelle d'encaissement des abonnements, pour la console
 * fondateur.
 *
 * Sans cet etat, poser une cle revient a configurer a l'aveugle : rien
 * n'indique si la passerelle est reellement retenue, ni si l'adresse de
 * notification est joignable. Ne renvoie JAMAIS de secret — uniquement des
 * booleens et des URLs publiques.
 */
export interface PaymentProviderStatus {
  /** Passerelle retenue : « moneroo » ou « simulation ». */
  active: string;
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
  return {
    active: monerooConfigured ? 'moneroo' : 'simulation',
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
  return !env.MONEROO_SECRET_KEY;
}
