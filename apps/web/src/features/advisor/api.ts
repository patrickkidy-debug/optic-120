import { API_URL } from '../../lib/api';

/** Conseiller commercial IA — appels publics (aucun compte requis). */

export type Turn = { role: 'user' | 'assistant'; content: string };

export type PlanOffer = {
  code: string;
  name: string;
  priceMonthly: number;
  maxBranches: number | null;
  maxUsers: number | null;
  description: string;
  features: string[];
};
export type UiEvent =
  | { kind: 'plans'; data: { currency: string; plans: PlanOffer[]; cycles: { cycle: string; months: number; discountPercent: number }[]; trialMinutes: number } }
  | { kind: 'demo'; data: { topic: string; kind: 'image' | 'video'; src: string; title: string } }
  | { kind: 'signup'; data: { url: string; planName: string; cycle: string } }
  | { kind: 'human'; data: { whatsapp: string; email: string } };

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function advisorStatus(): Promise<boolean> {
  try {
    const r = await fetch(`${API_URL}/advisor/status`, { credentials: 'include' });
    return r.ok && Boolean((await r.json()).enabled);
  } catch {
    return false;
  }
}

export async function startConversation(input: { page: string; mode: 'VOICE' | 'TEXT'; lang: string; activationToken?: string }) {
  const r = await fetch(`${API_URL}/advisor/conversations`, json(input));
  if (r.status === 429) throw new Error('quota');
  if (!r.ok) throw new Error('unavailable');
  return (await r.json()) as { id: string; limits: { maxTurns: number; maxMinutes: number } };
}

export function sendEvent(id: string, name: string, keepalive = false): void {
  void fetch(`${API_URL}/advisor/conversations/${id}/events`, { ...json({ name }), keepalive }).catch(() => {});
}

export async function linkActivation(id: string, token: string): Promise<void> {
  await fetch(`${API_URL}/advisor/conversations/${id}/link`, json({ token })).catch(() => {});
}

export async function deleteConversation(id: string): Promise<boolean> {
  const r = await fetch(`${API_URL}/advisor/conversations/${id}`, { method: 'DELETE', credentials: 'include' });
  return r.ok;
}

export async function requestCallback(input: { name: string; phone: string; moment: 'MORNING' | 'AFTERNOON' | 'EVENING'; token?: string }) {
  const r = await fetch(`${API_URL}/activation/callback`, json(input));
  if (!r.ok) throw new Error('callback');
}

/**
 * Réponse en flux : texte au fil de l'eau + actions d'interface.
 * Résout à la fin ; rejette sur erreur réseau (sauf annulation volontaire).
 */
export async function streamReply(
  id: string,
  turns: Turn[],
  on: { text: (d: string) => void; ui: (e: UiEvent) => void; limit: (reason: string) => void },
  signal: AbortSignal,
): Promise<void> {
  const r = await fetch(`${API_URL}/advisor/conversations/${id}/reply`, { ...json({ turns }), signal });
  if (!r.ok || !r.body) throw new Error(`http ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (!line.startsWith('data:')) continue;
      const ev = JSON.parse(line.slice(5));
      if (ev.t === 'text') on.text(ev.d);
      else if (ev.t === 'ui') on.ui(ev.e);
      else if (ev.t === 'limit') on.limit(ev.reason);
      else if (ev.t === 'error') throw new Error('server');
    }
  }
}

/** Conversation en cours, conservée pour l'attribuer au tunnel d'activation. */
export const ADVISOR_CONV_KEY = 'oculo_advisor_conv';
