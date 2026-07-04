import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { corsOrigins } from './config/env.js';
import { errorHandler } from './middlewares/error-handler.js';

import { authRoutes } from './modules/auth/auth.routes.js';
import { rbacRoutes } from './modules/rbac/rbac.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { branchesRoutes } from './modules/branches/branches.routes.js';
import { productsRoutes } from './modules/products/products.routes.js';
import { stockRoutes } from './modules/stock/stock.routes.js';
import { customersRoutes } from './modules/customers/customers.routes.js';
import { salesRoutes } from './modules/sales/sales.routes.js';
import { optiqueRoutes } from './modules/optique/optique.routes.js';
import { cashRegisterRoutes } from './modules/cashregister/cashregister.routes.js';
import { paymentsRoutes, paymentWebhookRoutes } from './modules/payments/payments.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { clinicRoutes } from './modules/clinic/clinic.routes.js';
import { managementRoutes } from './modules/management/management.routes.js';
import { billingRoutes, billingWebhookRoutes } from './modules/billing/billing.routes.js';
import { platformRoutes } from './modules/billing/platform.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';
import { supportRoutes } from './modules/support/support.routes.js';
import { whatsappWebhookRoutes } from './modules/whatsapp/whatsapp.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    // Les images (logo, photo de profil, QR d'encaissement) transitent en base64
    // dans le corps JSON : la limite par défaut de 1 Mo ferait échouer ces uploads.
    bodyLimit: 6 * 1024 * 1024, // 6 Mo
  });

  app.setErrorHandler(errorHandler);

  // PayTech envoie ses IPN en application/x-www-form-urlencoded : on les parse
  // en objet (Fastify ne gère nativement que le JSON).
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, Object.fromEntries(new URLSearchParams(body as string)));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(rbacRoutes, { prefix: '/rbac' });
  await app.register(usersRoutes, { prefix: '/users' });
  await app.register(branchesRoutes, { prefix: '/branches' });
  await app.register(productsRoutes, { prefix: '/products' });
  await app.register(stockRoutes, { prefix: '/stock' });
  await app.register(customersRoutes, { prefix: '/customers' });
  await app.register(salesRoutes, { prefix: '/sales' });
  await app.register(optiqueRoutes, { prefix: '/optique' });
  await app.register(cashRegisterRoutes, { prefix: '/cashregister' });
  await app.register(paymentsRoutes, { prefix: '/payments' });
  await app.register(paymentWebhookRoutes, { prefix: '/webhooks' });
  await app.register(dashboardRoutes, { prefix: '/dashboard' });
  await app.register(auditRoutes, { prefix: '/audit' });
  await app.register(clinicRoutes);
  await app.register(managementRoutes);
  await app.register(billingRoutes, { prefix: '/billing' });
  await app.register(billingWebhookRoutes, { prefix: '/webhooks' });
  await app.register(platformRoutes, { prefix: '/platform' });
  await app.register(settingsRoutes, { prefix: '/settings' });
  await app.register(supportRoutes, { prefix: '/support' });
  await app.register(whatsappWebhookRoutes, { prefix: '/webhooks' });

  return app;
}
