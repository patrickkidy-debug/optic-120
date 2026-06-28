import { env } from '../../config/env.js';
import type { PaymentProvider } from '../payments/payment-provider.interface.js';
import { SimulatedPaymentProvider } from '../payments/providers/simulated.provider.js';
import { CinetPayProvider } from '../payments/providers/cinetpay.provider.js';

/**
 * Fournisseur de paiement de la PLATEFORME (l'éditeur SaaS encaisse les
 * abonnements). Utilise les clés CinetPay globales (env) ; bascule en
 * simulation tant qu'elles ne sont pas configurées. Distinct du provider des
 * ventes, qui encaisse pour le compte du tenant.
 */
export function resolvePlatformProvider(): PaymentProvider {
  if (env.CINETPAY_API_KEY && env.CINETPAY_SITE_ID) {
    return new CinetPayProvider({
      apiKey: env.CINETPAY_API_KEY,
      siteId: env.CINETPAY_SITE_ID,
      baseUrl: env.CINETPAY_BASE_URL,
    });
  }
  return new SimulatedPaymentProvider();
}

export function isPlatformSimulation(): boolean {
  return !(env.CINETPAY_API_KEY && env.CINETPAY_SITE_ID);
}
