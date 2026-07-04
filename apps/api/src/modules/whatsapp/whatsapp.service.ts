import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { generateReply, type Turn } from './whatsapp.ai.js';
import { sendText } from './whatsapp.client.js';

/** Nombre de messages d'historique passés à l'IA (contexte de conversation). */
const HISTORY_LIMIT = 24;

/**
 * Le bot est-il pleinement configuré ? (jetons WhatsApp + clé IA présents).
 * Sinon le webhook accepte les messages mais n'auto-répond pas.
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

/** Traite un message texte entrant : mémorise, interroge l'IA, répond. */
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

  // Le fondateur a repris la conversation à la main → pas d'auto-réponse.
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
  await sendText(msg.from, reply);
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
 * Ignore les accusés de livraison (statuses) et répond un message d'aiguillage
 * pour les contenus non-texte (image, audio…).
 */
export async function processWebhook(body: unknown): Promise<void> {
  if (!isConfigured()) {
    // eslint-disable-next-line no-console
    console.warn('[whatsapp] message reçu mais bot non configuré (jetons manquants) — ignoré');
    return;
  }

  const b = body as MetaWebhookBody;
  for (const entry of b.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue; // statuses / autres évènements
      const profileName = value.contacts?.[0]?.profile?.name;

      for (const m of value.messages) {
        if (m.type !== 'text' || !m.text?.body) {
          await sendText(
            m.from,
            "Bonjour ! Je suis l'assistant OculoSaaS 👋 Envoyez-moi un message texte et je réponds à toutes vos questions.",
          ).catch(() => undefined);
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
