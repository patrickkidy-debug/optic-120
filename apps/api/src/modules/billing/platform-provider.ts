import { env, appOrigin } from '../../config/env.js';
import type { PaymentProvider } from '../payments/payment-provider.interface.js';
import { SimulatedPaymentProvider } from '../payments/providers/simulated.provider.js';
import { PayTechProvider } from '../payments/providers/paytech.provider.js';

/**
 * Fournisseur de paiement de la PLATEFORME (l'éditeur SaaS encaisse les
 * abonnements via PayTech). Utilise les clés PayTech globales (env) ; bascule
 * en simulation tant qu'elles ne sont pas configurées. Distinct du provider des
 * ventes, qui encaisse pour le compte du tenant.
 */
export function resolvePlatformProvider(): PaymentProvider {
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
  return !(env.PAYTECH_API_KEY && env.PAYTECH_API_SECRET);
}
