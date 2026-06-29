import { env, appOrigin } from '../../config/env.js';
import type { PaymentProvider } from '../payments/payment-provider.interface.js';
import { SimulatedPaymentProvider } from '../payments/providers/simulated.provider.js';
import { MonerooProvider } from '../payments/providers/moneroo.provider.js';

/**
 * Fournisseur de paiement de la PLATEFORME (l'éditeur SaaS encaisse les
 * abonnements via Moneroo). Utilise la clé secrète Moneroo globale (env) ;
 * bascule en simulation tant qu'elle n'est pas configurée. Distinct du provider
 * des ventes, qui encaisse pour le compte du tenant.
 */
export function resolvePlatformProvider(): PaymentProvider {
  if (env.MONEROO_SECRET_KEY) {
    return new MonerooProvider({
      secretKey: env.MONEROO_SECRET_KEY,
      baseUrl: env.MONEROO_BASE_URL,
      returnUrl: `${appOrigin}/parametres/abonnement`,
      webhookSecret: env.MONEROO_WEBHOOK_SECRET || undefined,
    });
  }
  return new SimulatedPaymentProvider();
}

export function isPlatformSimulation(): boolean {
  return !env.MONEROO_SECRET_KEY;
}
