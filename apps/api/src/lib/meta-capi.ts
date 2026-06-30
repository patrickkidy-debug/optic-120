import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

interface ConversionUserData {
  email?: string | null;
  phone?: string | null;
  /** Identifiant interne (ex. user.id) — haché avant envoi, comme email/téléphone. */
  externalId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Cookies _fbp / _fbc posés par le Pixel navigateur (meilleure qualité d'appariement). */
  fbp?: string | null;
  fbc?: string | null;
}

interface ConversionEventInput {
  eventName: string;
  /** Identique au eventID passé à fbq() côté navigateur, pour dédupliquer Pixel + CAPI. */
  eventId?: string;
  eventSourceUrl?: string;
  user: ConversionUserData;
  customData?: Record<string, unknown>;
}

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Envoie un événement à la Meta Conversions API : suivi côté serveur,
 * complémentaire au Pixel navigateur (fiable même avec bloqueurs de pub,
 * Safari ITP, ou si le client quitte la page avant la confirmation).
 * No-op silencieux tant que META_CAPI_ACCESS_TOKEN n'est pas configuré.
 */
export async function sendConversionEvent(input: ConversionEventInput): Promise<void> {
  if (!env.META_CAPI_ACCESS_TOKEN) return;

  const userData: Record<string, unknown> = {};
  if (input.user.email) userData.em = [sha256(input.user.email)];
  if (input.user.phone) userData.ph = [sha256(input.user.phone.replace(/[^0-9]/g, ''))];
  if (input.user.externalId) userData.external_id = [sha256(input.user.externalId)];
  if (input.user.ipAddress) userData.client_ip_address = input.user.ipAddress;
  if (input.user.userAgent) userData.client_user_agent = input.user.userAgent;
  if (input.user.fbp) userData.fbp = input.user.fbp;
  if (input.user.fbc) userData.fbc = input.user.fbc;

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: input.customData,
      },
    ],
    ...(env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: env.META_CAPI_TEST_EVENT_CODE } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_ACCESS_TOKEN)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn({ status: res.status, text }, 'Meta Conversions API : envoi échoué');
    }
  } catch (err) {
    logger.warn({ err }, 'Meta Conversions API : erreur réseau');
  }
}
