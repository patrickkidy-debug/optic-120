import dns from 'node:dns';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { verifyMailerConnection } from './lib/mailer.js';

// Render ne route pas l'IPv6 : sans ceci, smtp.gmail.com (et d'autres hôtes) sont
// résolus en IPv6 d'abord → « connect ENETUNREACH …:587 ». On force la résolution
// DNS à privilégier l'IPv4 pour tout le process (emails SMTP, etc.).
dns.setDefaultResultOrder('ipv4first');

const app = await buildApp();

// Les plateformes d'hébergement (Render, etc.) imposent le port via $PORT ;
// on l'utilise en priorité, sinon on retombe sur API_PORT (local).
const port = Number(process.env.PORT) || env.API_PORT;

try {
  await app.listen({ port, host: '0.0.0.0' });
  logger.info(`🚀 API OculoSaaS démarrée sur le port ${port}`);
  // Contrôle de la config email au démarrage (non bloquant).
  void verifyMailerConnection();
} catch (err) {
  logger.error(err);
  process.exit(1);
}
