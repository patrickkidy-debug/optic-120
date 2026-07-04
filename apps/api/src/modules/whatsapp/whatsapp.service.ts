import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { generateReply, type Turn } from './whatsapp.ai.js';
import { sendText } from './whatsapp.client.js';

/** Nombre de messages d'historique passés à l'IA (contexte de conversation). */
const HISTORY_LIMIT = 24;

/* ---------- Compteurs de diagnostic (mémoire, remis à zéro au redémarrage) ---------- */
let webhookHits = 0;
let lastHitAt: string | null = null;
let lastError: string | null = null;

/** Comptabilise chaque appel POST du webhook (avant tout traitement). */
export function recordWebhookHit(): void {
  webhookHits += 1;
  lastHitAt = new Date().toISOString();
}

/**
 * Le bot est-il pleinement configuré ? (jetons WhatsApp + clé IA présents).
 * Sinon le webhook enregistre les messages mais n'auto-répond pas.
 */
export function isConfigured(): boolean {
  return Boolean(
    env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.ANTHROPIC_API_KEY,
  );
}

interface Inbound {
  from: string;
  profileName?: string;
  text: string;
  waMessageId?: string;
}

/**
 * Traite un message texte entrant : mémorise TOUJOURS (capture du prospect),
 * puis auto-répond via l'IA si le bot est configuré et non mis en pause.
 */
export async function handleInbound(msg: Inbound): Promise<void> {
  const contact = await prisma.whatsappContact.upsert({
    where: { phone: msg.from },
    create: {
      phone: msg.from,
      profileName: msg.profileName ?? null,
      lastMessageAt: new Date(),
    },
    update: {
      lastMessageAt: new Date(),
      ...(msg.profileName ? { profileName: msg.profileName } : {}),
    },
  });

  // Déduplication : Meta peut redistribuer le même message (même id).
  if (msg.waMessageId) {
    const already = await prisma.whatsappMessage.findFirst({
      where: { waMessageId: msg.waMessageId },
      select: { id: true },
    });
    if (already) return;
  }

  await prisma.whatsappMessage.create({
    data: {
      contactId: contact.id,
      role: 'user',
      text: msg.text,
      waMessageId: msg.waMessageId ?? null,
    },
  });

  // Pas de réponse automatique si le bot n'est pas configuré (le message reste
  // enregistré comme prospect) ou si le fondateur a repris la main.
  if (!isConfigured()) {
    lastError = 'non configuré (jetons/clé manquants)';
    // eslint-disable-next-line no-console
    console.warn('[whatsapp] message enregistré mais bot non configuré — pas de réponse auto');
    return;
  }
  if (contact.botPaused) return;

  const rows = await prisma.whatsappMessage.findMany({
    where: { contactId: contact.id },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
    select: { role: true, text: true },
  });
  const history: Turn[] = rows.reverse().map((r) => ({
    role: r.role === 'assistant' ? 'assistant' : 'user',
    content: r.text,
  }));

  const reply = await generateReply(history);

  await prisma.whatsappMessage.create({
    data: { contactId: contact.id, role: 'assistant', text: reply },
  });
  try {
    await sendText(msg.from, reply);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

/* ---------- Parsing du payload webhook Meta ---------- */

interface MetaMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
}
interface MetaValue {
  messages?: MetaMessage[];
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
}
interface MetaWebhookBody {
  entry?: Array<{ changes?: Array<{ value?: MetaValue }> }>;
}

/**
 * Parcourt le payload d'un webhook WhatsApp et traite chaque message texte.
 * Les messages sont TOUJOURS enregistrés (même bot non configuré). Ignore les
 * accusés de livraison (statuses) ; répond un message d'aiguillage pour les
 * contenus non-texte uniquement si le bot est configuré.
 */
export async function processWebhook(body: unknown): Promise<void> {
  const b = body as MetaWebhookBody;
  for (const entry of b.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue; // statuses / autres évènements
      const profileName = value.contacts?.[0]?.profile?.name;

      for (const m of value.messages) {
        if (m.type !== 'text' || !m.text?.body) {
          if (isConfigured()) {
            await sendText(
              m.from,
              "Bonjour ! Je suis l'assistant OculoSaaS 👋 Envoyez-moi un message texte et je réponds à toutes vos questions.",
            ).catch(() => undefined);
          }
          continue;
        }
        await handleInbound({
          from: m.from,
          profileName,
          text: m.text.body,
          waMessageId: m.id,
        });
      }
    }
  }
}

/* ---------- Abonnement du WABA à l'application ---------- */

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Abonne le compte WhatsApp Business (WABA) à cette application pour la
 * réception des webhooks `messages`, puis renvoie l'état d'abonnement actuel.
 * Sans cet abonnement, Meta ne transmet aucun message entrant au serveur.
 */
export async function subscribeApp(wabaId: string) {
  const base = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${wabaId}/subscribed_apps`;
  const headers = {
    Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    'content-type': 'application/json',
  };

  const postRes = await fetch(base, { method: 'POST', headers });
  const postBody = safeJson(await postRes.text());

  const getRes = await fetch(base, { headers });
  const currentBody = safeJson(await getRes.text());

  return {
    subscribe: { status: postRes.status, body: postBody },
    current: { status: getRes.status, body: currentBody },
  };
}

/* ---------- Diagnostic (endpoint /webhooks/whatsapp/debug) ---------- */

/** État de configuration + activité, sans exposer aucun secret. */
export async function getDebugInfo() {
  const [contacts, messages, last] = await Promise.all([
    prisma.whatsappContact.count(),
    prisma.whatsappMessage.count(),
    prisma.whatsappMessage.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { role: true, text: true, createdAt: true },
    }),
  ]);
  const pid = env.WHATSAPP_PHONE_NUMBER_ID;
  return {
    configured: isConfigured(),
    env: {
      hasAccessToken: Boolean(env.WHATSAPP_ACCESS_TOKEN),
      accessTokenLength: env.WHATSAPP_ACCESS_TOKEN.length,
      hasPhoneNumberId: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
      phoneNumberId: pid ? `${pid.slice(0, 4)}…${pid.slice(-4)} (len ${pid.length})` : '',
      hasAnthropicKey: Boolean(env.ANTHROPIC_API_KEY),
      anthropicKeyPrefix: env.ANTHROPIC_API_KEY ? env.ANTHROPIC_API_KEY.slice(0, 7) : '',
      hasAppSecret: Boolean(env.WHATSAPP_APP_SECRET),
      model: env.ANTHROPIC_MODEL,
      graphVersion: env.WHATSAPP_GRAPH_VERSION,
    },
    webhook: { hits: webhookHits, lastHitAt },
    db: {
      contacts,
      messages,
      lastMessage: last ? { role: last.role, at: last.createdAt, preview: last.text.slice(0, 60) } : null,
    },
    lastError,
  };
}
