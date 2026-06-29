import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Laisser vide en cross-domaine (frontend et API sur des domaines différents) :
  // la cookie devient « host-only » et reste rattachée au domaine de l'API.
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // 'strict' en local ; 'none' obligatoire en cross-domaine (exige COOKIE_SECURE=true).
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET doit faire au moins 16 caractères'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  // Idéalement 64 caractères hexadécimaux (32 octets). À défaut, toute valeur
  // d'au moins 16 caractères est acceptée : une clé AES-256 valide en est
  // dérivée via SHA-256 (voir lib/crypto.ts).
  ENCRYPTION_KEY: z
    .string()
    .min(16, 'ENCRYPTION_KEY doit faire au moins 16 caractères'),

  MAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  MAIL_FROM: z.string().default('OculoSaaS <no-reply@oculosaas.africa>'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),

  MAX_FAILED_LOGINS: z.coerce.number().default(5),
  ACCOUNT_LOCK_MINUTES: z.coerce.number().default(15),

  CINETPAY_API_KEY: z.string().optional().default(''),
  CINETPAY_SITE_ID: z.string().optional().default(''),
  CINETPAY_BASE_URL: z.string().default('https://api-checkout.cinetpay.com/v2'),
  CINETPAY_WEBHOOK_SECRET: z.string().optional().default(''),

  // Moneroo — passerelle de paiement (Mobile Money + cartes) Afrique.
  // Clé secrète de la plateforme (encaissement des abonnements).
  MONEROO_SECRET_KEY: z.string().optional().default(''),
  MONEROO_BASE_URL: z.string().default('https://api.moneroo.io/v1'),
  MONEROO_WEBHOOK_SECRET: z.string().optional().default(''),

  // Emails des opérateurs de la plateforme (console SaaS cross-tenant), séparés par des virgules.
  PLATFORM_ADMIN_EMAILS: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Variables d\'environnement invalides :');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/**
 * Origines autorisées par CORS. CORS_ORIGIN peut contenir plusieurs URLs
 * séparées par des virgules (ex. front Vercel + front Netlify).
 */
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** URL principale du frontend (1re origine) — utilisée pour les liens email. */
export const appOrigin = corsOrigins[0] ?? 'http://localhost:5173';
