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

  /**
   * Passerelle d'encaissement des ABONNEMENTS : « kkiapay » (defaut),
   * « dexpay », « moneroo » ou « chariow ». Une seule a la fois : pas de bascule
   * silencieuse de l'une a l'autre si une cle manque (voir platform-provider.ts).
   * L'ancienne valeur « geniuspay » (passerelle retiree) est lue comme « kkiapay »
   * pour qu'un serveur encore configure ainsi demarre.
   */
  PLATFORM_PAYMENT_PROVIDER: z.preprocess(
    (v) => (v === 'geniuspay' ? 'kkiapay' : v),
    z.enum(['kkiapay', 'dexpay', 'moneroo', 'chariow']).default('kkiapay'),
  ),
  CHARIOW_API_KEY: z.string().optional().default(''),
  CHARIOW_BASE_URL: z.string().default('https://api.chariow.com/v1'),
  /** Secret de signature du Pulse (whsec_...), propre a chaque Pulse. */
  CHARIOW_PULSE_SECRET: z.string().optional().default(''),
  /**
   * Produit Chariow par offre et par duree, en JSON :
   *   {"STANDARD:1":"prd_xxx","STANDARD:6":"prd_yyy","GROWTH:1":"prd_zzz"}
   * Cle = code de l'offre OculoSaaS + nombre de mois factures. Chariow ne
   * laisse pas l'API fixer le prix : il vient du produit, d'ou ce tableau.
   */
  CHARIOW_PRODUCTS: z.string().optional().default('{}'),

  // Encaissement MANUEL des abonnements : numéro Mobile Money de l'éditeur sur
  // lequel le client règle directement, puis le fondateur confirme depuis la
  // console. Permet de vendre même sans passerelle configurée.
  PLATFORM_PAY_NUMBER: z.string().optional().default(''),
  PLATFORM_PAY_NAME: z.string().optional().default(''),
  PLATFORM_PAY_NETWORK: z.string().optional().default(''),

  // Encaissement MANUEL des abonnements par virement bancaire : coordonnées du
  // compte de l'éditeur. Même principe que le Mobile Money ci-dessus (le
  // fondateur confirme depuis la console) — proposé en plus, pas à la place.
  // Valeurs par défaut = compte CBAO de l'éditeur (coordonnées destinées à
  // être affichées aux clients) ; une variable d'environnement les remplace.
  PLATFORM_BANK_NAME: z.string().optional().default('CBAO Saint-Louis (Groupe Attijariwafa bank)'),
  PLATFORM_BANK_ACCOUNT_NAME: z.string().optional().default('PATRICK KONAN'),
  PLATFORM_BANK_ACCOUNT_NUMBER: z.string().optional().default('SN08 SN012 08274 035216465301 66'),
  PLATFORM_BANK_SWIFT: z.string().optional().default('CBAOSNDA'),

  // PayTech — passerelle de paiement (Wave, Orange Money, Free Money, cartes).
  // Clés de la PLATEFORME (encaissement des abonnements). Tant que la clé API
  // est vide → mode simulation.
  PAYTECH_API_KEY: z.string().optional().default(''),
  PAYTECH_API_SECRET: z.string().optional().default(''),
  PAYTECH_ENV: z.enum(['test', 'prod']).default('prod'),
  PAYTECH_BASE_URL: z.string().default('https://paytech.sn/api'),
  // KkiaPay (kkiapay.me) : Mobile Money et cartes en XOF (BJ, CI, TG, SN, NE).
  // Trois cles du tableau de bord (Developpeurs > Cles API) ; le paiement se
  // fait dans le widget KkiaPay ouvert par la page /paiement/kkiapay du front.
  KKIAPAY_PUBLIC_KEY: z.string().optional().default(''),
  KKIAPAY_PRIVATE_KEY: z.string().optional().default(''),
  KKIAPAY_SECRET_KEY: z.string().optional().default(''),
  /** « Secret hash » du webhook KkiaPay (renvoye dans x-kkiapay-secret). */
  KKIAPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  /** « true » = cles de test (api-sandbox.kkiapay.me et widget en sandbox). */
  KKIAPAY_SANDBOX: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  // Wave en DIRECT (API Checkout de Wave Business), sans agrégateur. Clé posée
  // = les clients qui choisissent Wave paient chez Wave ; les autres moyens
  // (Orange, MTN, Moov, carte) restent sur PLATFORM_PAYMENT_PROVIDER.
  WAVE_API_KEY: z.string().optional().default(''),
  /** Secret de signature des requêtes (…_AKS_…), seulement si activé sur la clé. */
  WAVE_SIGNING_SECRET: z.string().optional().default(''),
  /** Secret du webhook : de signature (…_WHS_…) ou partagé, selon la stratégie choisie. */
  WAVE_WEBHOOK_SECRET: z.string().optional().default(''),
  WAVE_BASE_URL: z.string().default('https://api.wave.com'),
  // DexPay (dexpay.africa) : Wave, Orange, MTN, Moov, Mixx et cartes (SN, CI…).
  // Le prefixe des cles (pk_test_ / pk_live_) choisit l'environnement. La cle
  // secrete signe aussi les webhooks : pas de secret de webhook distinct.
  DEXPAY_PUBLIC_KEY: z.string().optional().default(''),
  DEXPAY_SECRET_KEY: z.string().optional().default(''),
  /** Vide = deduit du prefixe des cles (sandbox ou production). */
  DEXPAY_BASE_URL: z.string().optional().default(''),
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
  // Point d'accès de l'API (surchargé seulement pour les tests locaux du conseiller IA).
  ANTHROPIC_BASE_URL: z.string().default('https://api.anthropic.com'),

  // Nombre de proxys de confiance devant l'API (Render : 1 ; Cloudflare + Render : 2).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
});

/** Valeur d'exemple publique : jamais acceptée comme secret en production. */
export const DEFAULT_WHATSAPP_VERIFY_TOKEN = 'oculosaas-verify-token';

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

// Production : cookie de session toujours « Secure », quelle que soit la config.
if (isProd && !env.COOKIE_SECURE) {
  // eslint-disable-next-line no-console
  console.warn('⚠️ COOKIE_SECURE=false ignoré en production : cookies forcés en Secure.');
  env.COOKIE_SECURE = true;
}
// Secrets courts : tolérés pour ne pas bloquer un déploiement existant, mais signalés.
for (const k of ['JWT_ACCESS_SECRET', 'ENCRYPTION_KEY'] as const) {
  const v = (env as Record<string, unknown>)[k];
  if (isProd && typeof v === 'string' && v.length < 32) {
    // eslint-disable-next-line no-console
    console.warn(`⚠️ ${k} fait moins de 32 caractères : remplacez-le par 32 octets aléatoires.`);
  }
}
/** Webhook WhatsApp exploitable : secret Meta présent et jeton de vérification personnalisé. */
export const whatsappWebhookSecured = Boolean(env.WHATSAPP_APP_SECRET) && env.WHATSAPP_VERIFY_TOKEN !== DEFAULT_WHATSAPP_VERIFY_TOKEN;

/**
 * Origines autorisées par CORS. CORS_ORIGIN peut contenir plusieurs URLs
 * séparées par des virgules (ex. front Vercel + front Netlify).
 */
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** URL principale du frontend (1re origine) — utilisée pour les liens email. */
export const appOrigin = corsOrigins[0] ?? 'http://localhost:5173';
