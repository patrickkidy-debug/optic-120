import { env } from '../../config/env.js';
import { SYSTEM_PROMPT } from './whatsapp.prompt.js';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const FALLBACK =
  "Merci pour votre message 🙏 Un conseiller OculoSaaS va vous répondre dans un instant.";

/**
 * Fusionne les tours consécutifs de même rôle et garantit que la conversation
 * commence par un message « user » — l'API Anthropic impose une alternance
 * stricte user/assistant démarrant par user.
 */
function normalize(turns: Turn[]): Turn[] {
  const out: Turn[] = [];
  for (const t of turns) {
    const text = t.content.trim();
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += `\n${text}`;
    else out.push({ role: t.role, content: text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/**
 * Génère la réponse du bot à partir de l'historique de conversation.
 * Renvoie un message de repli (jamais d'exception propagée) en cas d'erreur API,
 * pour que le prospect reçoive toujours quelque chose.
 */
export async function generateReply(history: Turn[]): Promise<string> {
  const messages = normalize(history);
  if (messages.length === 0) return FALLBACK;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      // eslint-disable-next-line no-console
      console.error(`[whatsapp] Anthropic ${res.status} : ${detail.slice(0, 500)}`);
      return FALLBACK;
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();

    return text || FALLBACK;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[whatsapp] appel Anthropic échoué :', err);
    return FALLBACK;
  }
}
