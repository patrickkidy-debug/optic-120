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

  // 'resend' = envoi par HTTPS (recommandé : Render bloque le SMTP sortant).
  MAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console'),
  MAIL_FROM: z.string().default('OculoSaaS <no-reply@oculosaas.africa>'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  // Clé API Resend (https://resend.com) pour l'envoi d'emails par HTTPS.
  RESEND_API_KEY: z.string().optional().default(''),

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

  // PayTech — passerelle de paiement (Wave, Orange Money, Free Money, cartes).
  // Clés de la PLATEFORME (encaissement des abonnements). Tant que la clé API
  // est vide → mode simulation.
  PAYTECH_API_KEY: z.string().optional().default(''),
  PAYTECH_API_SECRET: z.string().optional().default(''),
  PAYTECH_ENV: z.enum(['test', 'prod']).default('prod'),
  PAYTECH_BASE_URL: z.string().default('https://paytech.sn/api'),
  // URL publique de l'API (pour les IPN PayTech). Ex : https://oculosaas-api.onrender.com
  PUBLIC_API_URL: z.string().optional().default(''),

  // Emails des opérateurs de la plateforme (console SaaS cross-tenant), séparés par des virgules.
  PLATFORM_ADMIN_EMAILS: z.string().optional().default(''),

  // Meta Conversions API (suivi serveur, fiable même avec bloqueurs de pub).
  // Tant que META_CAPI_ACCESS_TOKEN est vide → envoi désactivé (no-op silencieux).
  META_PIXEL_ID: z.string().optional().default('1247725803989922'),
  META_CAPI_ACCESS_TOKEN: z.string().optional().default(''),
  // Code de test (onglet « Test Events » du gestionnaire d'évènements Meta).
  META_CAPI_TEST_EVENT_CODE: z.string().optional().default(''),

  // « Se connecter avec Google » — Client ID OAuth (Google Cloud Console).
  // Tant qu'il est vide, les routes /auth/google répondent une erreur claire.
  GOOGLE_CLIENT_ID: z.string().optional().default(''),

  // ===== Chatbot WhatsApp (assistant commercial IA) =====
  // Meta WhatsApp Cloud API. Tant que WHATSAPP_ACCESS_TOKEN ou
  // WHATSAPP_PHONE_NUMBER_ID (ou ANTHROPIC_API_KEY) sont vides → le bot est
  // inactif : le webhook accepte les messages mais n'auto-répond pas.
  // Jeton choisi librement, à recopier à l'identique dans la console Meta lors
  // de l'abonnement au webhook (handshake de vérification).
  WHATSAPP_VERIFY_TOKEN: z.string().default('oculosaas-verify-token'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  // Secret de l'application Meta (App Secret) — vérifie la signature
  // X-Hub-Signature-256 des webhooks. Vide → vérification désactivée (dev).
  WHATSAPP_APP_SECRET: z.string().optional().default(''),
  WHATSAPP_GRAPH_VERSION: z.string().default('v21.0'),

  // Moteur IA du chatbot (Anthropic Claude). Vide → bot inactif.
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  // Modèle économique et rapide, très bon en français — adapté à un bot commercial.
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5-20251001'),
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
