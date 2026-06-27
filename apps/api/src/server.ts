import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

const app = await buildApp();

try {
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  logger.info(`🚀 API OculoSaaS démarrée sur http://localhost:${env.API_PORT}`);
} catch (err) {
  logger.error(err);
  process.exit(1);
}
