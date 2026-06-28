import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

const app = await buildApp();

// Les plateformes d'hébergement (Render, etc.) imposent le port via $PORT ;
// on l'utilise en priorité, sinon on retombe sur API_PORT (local).
const port = Number(process.env.PORT) || env.API_PORT;

try {
  await app.listen({ port, host: '0.0.0.0' });
  logger.info(`🚀 API OculoSaaS démarrée sur le port ${port}`);
} catch (err) {
  logger.error(err);
  process.exit(1);
}
