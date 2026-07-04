import { env } from '../../config/env.js';

/**
 * Envoie un message texte via l'API WhatsApp Cloud (Meta Graph API).
 * Le numéro `to` est au format wa_id (chiffres uniquement, ex. "2250596609036").
 */
export async function sendText(to: string, body: string): Promise<void> {
  const url = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      // WhatsApp limite un message texte à 4096 caractères.
      text: { preview_url: false, body: body.slice(0, 4096) },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`WhatsApp send ${res.status} : ${detail.slice(0, 500)}`);
  }
}
