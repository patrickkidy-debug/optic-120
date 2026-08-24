import { env, appOrigin, isProd } from '../../config/env.js';
import type { PaymentProvider } from '../payments/payment-provider.interface.js';
import { SimulatedPaymentProvider } from '../payments/providers/simulated.provider.js';
import { PayTechProvider } from '../payments/providers/paytech.provider.js';
import { MonerooProvider } from '../payments/providers/moneroo.provider.js';
import { GeniusPayProvider } from '../payments/providers/geniuspay.provider.js';

/**
 * Fournisseur de paiement de la PLATEFORME (l'éditeur SaaS encaisse les
 * abonnements). Ordre de priorité : GeniusPay (23 pays) → Moneroo → PayTech
 * (Sénégal) → simulation. Distinct du provider des ventes, qui encaisse pour le
 * compte du tenant.
 *
 * GeniusPay passe en tête parce qu'il est le seul à couvrir le Maghreb et
 * l'Afrique de l'Est : PayTech ne peut pas encaisser un opticien marocain.
 * L'ordre reste une simple cascade — retirer les clés GeniusPay fait
 * automatiquement redescendre sur le fournisseur suivant.
 */
export function resolvePlatformProvider(): PaymentProvider {
  // 1) GeniusPay (orchestrateur multi-passerelles, couverture continentale).
  // Pas d'URL de webhook ici : chez GeniusPay elle s'enregistre une fois pour
  // toutes via POST /webhooks, pas à chaque paiement comme l'IPN PayTech.
  if (env.GENIUSPAY_API_KEY && env.GENIUSPAY_API_SECRET) {
    return new GeniusPayProvider({
      apiKey: env.GENIUSPAY_API_KEY,
      apiSecret: env.GENIUSPAY_API_SECRET,
      baseUrl: env.GENIUSPAY_BASE_URL,
      webhookSecret: env.GENIUSPAY_WEBHOOK_SECRET || undefined,
      successUrl: `${appOrigin}/parametres/abonnement`,
      errorUrl: `${appOrigin}/parametres/abonnement`,
      // L'écran d'abonnement n'offre aucun choix de moyen de paiement : il
      // envoie « WAVE » en dur, valeur héritée de Moneroo qui l'ignorait. On
      // laisse donc GeniusPay présenter sa page, seule à connaître les
      // opérateurs réellement disponibles dans le pays du client.
      forceHostedCheckout: true,
    });
  }

  // 2) Moneroo (orchestrateur multi-passerelles) — un seul lien, toutes les méthodes.
  if (env.MONEROO_SECRET_KEY) {
    return new MonerooProvider({
      secretKey: env.MONEROO_SECRET_KEY,
      baseUrl: env.MONEROO_BASE_URL,
      returnUrl: `${appOrigin}/parametres/abonnement`,
      webhookSecret: env.MONEROO_WEBHOOK_SECRET || undefined,
    });
  }
  // 3) PayTech (passerelle directe Sénégal/XOF).
  if (env.PAYTECH_API_KEY && env.PAYTECH_API_SECRET) {
    const apiBase = env.PUBLIC_API_URL.replace(/\/$/, '');
    return new PayTechProvider({
      apiKey: env.PAYTECH_API_KEY,
      apiSecret: env.PAYTECH_API_SECRET,
      env: env.PAYTECH_ENV,
      baseUrl: env.PAYTECH_BASE_URL,
      ipnUrl: apiBase ? `${apiBase}/webhooks/paytech-subscription` : undefined,
      successUrl: `${appOrigin}/parametres/abonnement`,
      cancelUrl: `${appOrigin}/parametres/abonnement`,
    });
  }
  // 4) Aucun fournisseur réel configuré. En PRODUCTION, on échoue volontairement
  //    (fail-closed) : sans paiement réel, un abonnement ne doit JAMAIS pouvoir
  //    être activé. La simulation reste réservée au développement/tests.
  if (isProd) {
    throw new Error(
      'Aucun fournisseur de paiement configuré : définissez GENIUSPAY_API_KEY/SECRET, MONEROO_SECRET_KEY ou PayTech en production.',
    );
  }
  return new SimulatedPaymentProvider();
}

export function isPlatformSimulation(): boolean {
  // Jamais de simulation en production : seul un paiement réel active un abonnement.
  if (isProd) return false;
  return (
    !(env.GENIUSPAY_API_KEY && env.GENIUSPAY_API_SECRET) &&
    !env.MONEROO_SECRET_KEY &&
    !(env.PAYTECH_API_KEY && env.PAYTECH_API_SECRET)
  );
}
