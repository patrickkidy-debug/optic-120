import { env, appOrigin } from '../../config/env.js';
import type { PaymentProvider } from '../payments/payment-provider.interface.js';
import { SimulatedPaymentProvider } from '../payments/providers/simulated.provider.js';
import { PayTechProvider } from '../payments/providers/paytech.provider.js';
import { MonerooProvider } from '../payments/providers/moneroo.provider.js';

/**
 * Fournisseur de paiement de la PLATEFORME (l'éditeur SaaS encaisse les
 * abonnements). Ordre de priorité : Moneroo (lien de paiement unique multi-
 * méthodes : Wave, Orange Money, MTN, Moov, Togocom…) → PayTech → simulation.
 * Distinct du provider des ventes, qui encaisse pour le compte du tenant.
 */
export function resolvePlatformProvider(): PaymentProvider {
  // 1) Moneroo (orchestrateur multi-passerelles) — un seul lien, toutes les méthodes.
  if (env.MONEROO_SECRET_KEY) {
    return new MonerooProvider({
      secretKey: env.MONEROO_SECRET_KEY,
      baseUrl: env.MONEROO_BASE_URL,
      returnUrl: `${appOrigin}/parametres/abonnement`,
      webhookSecret: env.MONEROO_WEBHOOK_SECRET || undefined,
    });
  }
  // 2) PayTech (passerelle directe Sénégal/XOF).
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
  return new SimulatedPaymentProvider();
}

export function isPlatformSimulation(): boolean {
  return !env.MONEROO_SECRET_KEY && !(env.PAYTECH_API_KEY && env.PAYTECH_API_SECRET);
}
