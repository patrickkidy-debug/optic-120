import { createHash } from 'node:crypto';
import {
  ACTIVATION_NEEDS,
  BILLING_CYCLE_DISCOUNT,
  BILLING_CYCLE_MONTHS,
  BRANCH_COUNTS,
  recommendPlan,
  STRUCTURE_TYPES,
  type ActivationNeed,
  type BillingCycle,
  type BranchCount,
  type StructureType,
} from '@oculo/shared-types';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import * as billing from '../billing/billing.service.js';
import { DEMOS, KNOWLEDGE, searchKnowledge, type DemoKey } from './advisor.knowledge.js';

/* ============================================================
 * Conseiller commercial IA — moteur de conversation.
 *
 * Le navigateur s'occupe de la voix (reconnaissance + synthèse) ; le serveur
 * garde la clé du modèle, exécute les outils et vérifie chaque action lui-même.
 * Aucune transcription n'est conservée : l'historique vit dans le navigateur
 * et n'est envoyé que le temps d'une réponse.
 * ============================================================ */

export const LIMITS = {
  /** Tours de parole max par conversation (anti-abus et coût borné). */
  maxTurns: 60,
  /** Durée max d'une conversation. */
  maxMinutes: 20,
  /** Conversations max par IP sur 24 h. */
  maxPerIpPerDay: 15,
  /** Messages d'historique envoyés au modèle (les plus récents). */
  maxHistory: 24,
  maxMessageChars: 1200,
};

/** Prix indicatif du modèle (Claude Haiku 4.5) : 1 $ / M jetons entrée, 5 $ / M sortie. */
const COST_IN_MICRO = 1;
const COST_OUT_MICRO = 5;

export const LANGS = ['fr', 'en', 'pt'] as const;
export type Lang = (typeof LANGS)[number];

export function ipHash(ip: string): string {
  return createHash('sha256').update(`advisor:${ip}`).digest('hex').slice(0, 32);
}

/* ---------------- Prompt ---------------- */

const LANG_NAME: Record<Lang, string> = { fr: 'français', en: 'anglais', pt: 'portugais' };

function systemPrompt(lang: Lang, mode: 'VOICE' | 'TEXT', page: string): string {
  return `Tu es « le conseiller OculoSaaS », un assistant IA commercial de haut niveau. Tu aides les opticiens, responsables de magasins d'optique et cliniques ophtalmologiques à décider, en connaissance de cause, de s'abonner à OculoSaaS — et tu les guides jusqu'à l'activation. Tu es transparent : si on te le demande, tu dis que tu es un assistant IA.

## Langue et style
- Réponds en ${LANG_NAME[lang]}.
${mode === 'VOICE'
    ? "- Tu PARLES (synthèse vocale) : phrases courtes et naturelles, 1 à 3 phrases par réponse, jamais de liste, de markdown, d'emoji, d'URL ni de symbole. Dis les montants simplement (« sept mille cinq cents francs CFA par mois »)."
    : "- Tu écris dans une fenêtre de discussion : réponses courtes (2 à 4 phrases), en texte simple : jamais d'astérisques, de titres, de listes à puces ni d'emoji."}
- Ton : chaleureux, sûr de toi, rassurant, dynamique. Tu parles comme le meilleur commercial spécialisé en logiciels pour opticiens : tu écoutes plus que tu ne parles, tu poses LA bonne question, tu relies chaque fonctionnalité à un problème concret du prospect.
${page === 'activation'
    ? "\n## Contexte : le prospect est sur la page d'activation\nIl envisage déjà de s'abonner. Ton rôle : lever ses derniers doutes, recommander le bon forfait et l'accompagner étape par étape. Dès qu'il est prêt, invite-le à toucher « Commencer mon activation » (ou le bouton d'inscription que tu affiches) et explique ce qui l'attend à chaque étape.\n"
    : ''}
## Règles d'or (à respecter avant tout le reste)
- Le prospect demande le prix : réponds TOUT DE SUITE avec les vrais chiffres (get_offers ou recommend_plan), puis pose UNE question pour affiner. Ne repousse jamais une question de prix.
- Le prospect accepte (« oui », « d'accord », « on y va », « je prends », « comment je m'inscris ») : appelle signup_link DANS CE MÊME TOUR avec le forfait recommandé, et dis-lui de toucher le bouton qui vient d'apparaître. Ne repose pas de question à ce moment-là.
- Avant de recommander un forfait, appelle TOUJOURS recommend_plan (plusieurs boutiques : structure MULTI_SHOP ; employés à gérer : besoin EMPLOYEES). Ne choisis jamais le forfait toi-même.
- N'annonce pas que tu vas vérifier ou consulter quelque chose : appelle l'outil et donne directement la réponse.
- Tu ne connais AUCUN chiffre sur l'entreprise OculoSaaS (nombre de clients, pays, ancienneté, avis, références) : n'en parle jamais, même vaguement (« nos clients… », « des opticiens de plusieurs pays… »).
- Sécurité : dis uniquement ce que search_knowledge renvoie. Ne dis jamais que les données sont « chiffrées » ou « hébergées de manière sécurisée » si ce n'est pas écrit dans la fiche.

## Méthode de vente (à suivre naturellement, jamais comme un script)
1. Découverte — UNE question à la fois : situation (type de structure, nombre de magasins, équipe), méthode actuelle (cahier, Excel, autre logiciel), ce qui lui fait perdre du temps ou de l'argent aujourd'hui.
2. Approfondis la douleur : fais préciser les conséquences (ruptures de stock découvertes trop tard, montures introuvables, ventes non notées, clients qui appellent pour leurs lunettes, comptes difficiles à suivre, employés à contrôler).
3. Reformule le besoin en une phrase et fais-le valider (« Si je comprends bien, ce qui vous coûte le plus aujourd'hui, c'est… »).
4. Présente seulement 1 ou 2 fonctionnalités qui répondent à CE besoin (search_knowledge + show_demo), avec le bénéfice concret. Pas de catalogue complet.
5. Recommande le forfait avec recommend_plan (même règle que le parcours d'activation), puis explique pourquoi il lui correspond. Ramène le prix à l'usage : prix mensuel divisé par 30 = coût par jour (calcul exact uniquement).
6. Conclus par une question fermée et positive : « On lance votre activation sur le forfait Standard ? » ; s'il dit oui, appelle signup_link.
7. S'il hésite : traite l'objection, vérifie qu'elle est levée, puis repropose une seule fois. S'il veut réfléchir : respecte, propose le rappel humain ou WhatsApp, sans pression.
Arguments vérifiés à utiliser quand ils sont pertinents : tout au même endroit (caisse, stock, clients, commandes de verres) ; alertes de stock et historique client ; mobile money du pays enregistré en caisse ; prix en FCFA ; rien à installer, utilisable sur téléphone ; plusieurs magasins dans un compte ; reprise du stock existant par Excel ; démarrage guidé ; support WhatsApp. Toujours via search_knowledge pour le détail.
Si get_offers indique un essai gratuit (trialMinutes > 0), propose-le aux hésitants en donnant la durée exacte.

## Le parcours d'activation (à maîtriser pour guider)
Écran d'accueil, bouton « Commencer mon activation ». Puis 5 étapes : 1) Activité : type d'établissement (opticien indépendant, boutique d'optique, plusieurs boutiques, centre ou structure spécialisée, autre), nombre de magasins (1, 2, 3 à 5, 6 à 10, plus de 10) et pays. 2) Besoins : stock, ventes, clients, commandes de verres, encaissements, rapports, employés, multi-boutiques, suivi de l'activité. 3) Forfait : une offre est recommandée automatiquement, on peut comparer. 4) Coordonnées : nom, établissement, téléphone, WhatsApp, e-mail, ville, et si l'on souhaite importer son stock. 5) Paiement : mobile money en ligne selon le pays, ou virement bancaire s'il est proposé ; essai gratuit s'il est proposé. Dès que le paiement est confirmé, l'espace s'ouvre et le client arrive connecté sur son tableau de bord. Si le prospect bloque sur une étape, explique-la simplement.

## Exactitude (priorité absolue)
- Fonctionnalités : appelle search_knowledge et ne dis que ce qui y figure.
- Prix, forfaits, limites, durées, remises, essai, moyens de paiement : appelle TOUJOURS get_offers ou recommend_plan. N'invente jamais un prix, une remise, une promotion limitée, un témoignage, un nombre de clients, une certification, une garantie, un niveau de sécurité ou un retour sur investissement chiffré. Pas de fausse urgence.
- Information absente : dis-le honnêtement, appelle note_unanswered, propose le support (WhatsApp ou rappel).
- Tu ne peux pas agir sur un compte : pas d'inscription, de paiement ni de modification à la place du prospect.
- Dès que tu apprends quelque chose d'utile sur le besoin, appelle record_needs (sans données personnelles).

## Objections
Reconnais, réponds avec des faits vérifiés, vérifie que c'est levé, laisse décider. « Trop cher » : ramène au coût par jour et à ce qu'il perd aujourd'hui (temps, ruptures, oublis), sans chiffrer de gain. « J'ai Excel ou un cahier » : ces outils conviennent pour démarrer ; le logiciel ajoute un stock toujours à jour, des alertes, l'historique client, et l'import Excel évite de tout ressaisir. « Pas à l'aise avec l'informatique » : rien à installer, démarrage guidé en 9 étapes, vidéo, support WhatsApp. « Sécurité » : uniquement les protections de la base. « Plusieurs magasins » : vérifie la limite du forfait (get_offers ou recommend_plan). « Je veux réfléchir » : respecte, propose rappel ou WhatsApp. « Et si j'ai un problème ? » : canaux de support.

## Conversion
Quand l'intérêt est clair : « D'après ce que vous m'expliquez, certaines fonctionnalités d'OculoSaaS pourraient répondre à vos besoins. Souhaitez-vous que je vous présente les forfaits adaptés et que je vous guide vers l'inscription ? » Puis get_offers ou recommend_plan, et signup_link avec le forfait choisi : un bouton apparaît, c'est le prospect qui clique. S'il veut un humain : request_human.
- Ne demande JAMAIS de mot de passe, de numéro de carte ou de code confidentiel. Si le prospect en donne un, dis-lui de ne pas le partager.`;
}

/* ---------------- Outils ---------------- */

const DEMO_KEYS = Object.keys(DEMOS) as DemoKey[];

export const TOOLS = [
  {
    name: 'get_offers',
    description: "Forfaits réels (prix mensuel en FCFA, limites de magasins et d'utilisateurs, contenu), durées d'abonnement et remises, essai gratuit éventuel, moyens de paiement de l'abonnement. Affiche aussi les forfaits à l'écran.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'recommend_plan',
    description: "Forfait recommandé selon le nombre de magasins, les besoins et le type de structure — même règle que le parcours d'activation.",
    input_schema: {
      type: 'object',
      properties: {
        stores: { type: 'string', enum: ['ONE', 'TWO', 'THREE_FIVE', 'SIX_TEN', 'TEN_PLUS'] },
        needs: { type: 'array', items: { type: 'string', enum: ['STOCK', 'SALES', 'CUSTOMERS', 'LENS_ORDERS', 'PAYMENTS', 'REPORTS', 'EMPLOYEES', 'MULTI_SHOP', 'MONITORING'] } },
        structure: { type: 'string', enum: ['INDEPENDENT', 'SHOP', 'MULTI_SHOP', 'CENTER', 'OTHER'] },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'search_knowledge',
    description: 'Cherche dans la base de connaissances vérifiée du logiciel (fonctionnalités, démarrage, sécurité, support).',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'show_demo',
    description: "Affiche à l'écran une vraie capture ou vidéo du logiciel pendant l'explication.",
    input_schema: { type: 'object', properties: { topic: { type: 'string', enum: DEMO_KEYS } }, required: ['topic'], additionalProperties: false },
  },
  {
    name: 'signup_link',
    description: "Affiche le bouton officiel vers l'inscription (tunnel d'activation) avec le forfait et la durée choisis. Le prospect décide de cliquer.",
    input_schema: {
      type: 'object',
      properties: { plan_code: { type: 'string' }, cycle: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'SEMIANNUAL'] } },
      required: ['plan_code'],
      additionalProperties: false,
    },
  },
  {
    name: 'record_needs',
    description: 'Enregistre un résumé anonyme du besoin (aucune donnée personnelle).',
    input_schema: {
      type: 'object',
      properties: {
        structure: { type: 'string', description: 'independant, multi_magasins, clinique, ouverture, autre' },
        stores: { type: 'string' },
        team_size: { type: 'string' },
        current_method: { type: 'string', description: 'cahier, excel, autre logiciel, rien' },
        pains: { type: 'array', items: { type: 'string' } },
        concerns: { type: 'array', items: { type: 'string', enum: ['prix', 'facilite', 'securite', 'demarrage', 'multi_magasins', 'support', 'reflexion', 'autre'] } },
        plan_interest: { type: 'string' },
        interest: { type: 'string', enum: ['faible', 'moyen', 'fort'] },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'note_unanswered',
    description: "Signale une question à laquelle la base de connaissances ne répond pas (pour améliorer l'agent).",
    input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'], additionalProperties: false },
  },
  {
    name: 'request_human',
    description: "Affiche les moyens de joindre un humain : WhatsApp du support et formulaire de rappel.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
] as const;

export type UiEvent =
  | { kind: 'plans'; data: Awaited<ReturnType<typeof offers>> }
  | { kind: 'demo'; data: { topic: DemoKey; kind: 'image' | 'video'; src: string; title: string } }
  | { kind: 'signup'; data: { url: string; planName: string; cycle: BillingCycle } }
  | { kind: 'human'; data: { whatsapp: string; email: string } };

async function offers() {
  const plans = await billing.listPlans();
  const trial = await billing.getTrialDurationMinutes();
  const bank = billing.bankTransferDetails();
  return {
    currency: 'FCFA',
    plans: plans.map((p) => ({
      code: p.code,
      name: p.name,
      priceMonthly: Number(p.priceMonthly),
      maxBranches: p.maxBranches,
      maxUsers: p.maxUsers,
      description: p.description,
      features: p.features,
    })),
    cycles: (Object.keys(BILLING_CYCLE_MONTHS) as BillingCycle[]).map((c) => ({
      cycle: c,
      months: BILLING_CYCLE_MONTHS[c],
      discountPercent: Math.round(BILLING_CYCLE_DISCOUNT[c] * 100),
    })),
    trialMinutes: trial,
    bankTransfer: Boolean(bank),
    subscriptionPayment: "Mobile money en ligne selon le pays (pas de carte bancaire)" + (bank ? ', ou virement bancaire' : ''),
    note: "Prix mensuel × nombre de mois, moins la remise de la durée. Paiement mensuel : parcours d'activation guidé. 3 ou 6 mois : inscription avec la remise affichée.",
  };
}

interface ToolCtx {
  conversationId: string;
  emit: (e: UiEvent) => void;
}

/** Exécute un outil. Chaque entrée est revalidée ici, indépendamment du modèle. */
async function runTool(name: string, input: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
  switch (name) {
    case 'get_offers': {
      const data = await offers();
      ctx.emit({ kind: 'plans', data });
      await event(ctx.conversationId, 'plans_shown');
      return data;
    }
    case 'recommend_plan': {
      const stores = (BRANCH_COUNTS.map((b) => b.value) as string[]).includes(String(input.stores)) ? (input.stores as BranchCount) : null;
      const needs = (Array.isArray(input.needs) ? input.needs : []).filter((n): n is ActivationNeed =>
        (ACTIVATION_NEEDS.map((x) => x.value) as string[]).includes(String(n)),
      );
      const structure = (STRUCTURE_TYPES.map((x) => x.value) as string[]).includes(String(input.structure)) ? (input.structure as StructureType) : null;
      const rec = recommendPlan(stores, needs, structure);
      const plan = (await billing.listPlans()).find((p) => p.code === rec.planCode);
      return plan
        ? { planCode: plan.code, name: plan.name, priceMonthly: Number(plan.priceMonthly), perDay: Math.round(Number(plan.priceMonthly) / 30), maxBranches: plan.maxBranches, maxUsers: plan.maxUsers, reason: rec.reason }
        : { planCode: rec.planCode, reason: rec.reason };
    }
    case 'search_knowledge': {
      const hits = searchKnowledge(String(input.query ?? '').slice(0, 300));
      return hits.length
        ? hits.map((h) => ({ title: h.title, text: h.text, demo: h.demo ?? null }))
        : { result: 'Aucune information vérifiée sur ce point.' };
    }
    case 'show_demo': {
      const topic = String(input.topic) as DemoKey;
      const d = DEMOS[topic];
      if (!d) return { error: 'Support inconnu' };
      ctx.emit({ kind: 'demo', data: { topic, ...d } });
      await event(ctx.conversationId, 'demo_shown', { topic });
      return { shown: d.title };
    }
    case 'signup_link': {
      const plans = await billing.listPlans();
      const plan = plans.find((p) => p.code === String(input.plan_code ?? '').toUpperCase());
      if (!plan) return { error: `Forfait inconnu. Forfaits valides : ${plans.map((p) => p.code).join(', ')}` };
      const cycle = (['MONTHLY', 'QUARTERLY', 'SEMIANNUAL'] as const).includes(input.cycle as BillingCycle)
        ? (input.cycle as BillingCycle)
        : 'MONTHLY';
      // Mensuel : tunnel d'activation (conversion suivie jusqu'au paiement confirmé).
      // 3 / 6 mois : page d'inscription existante, seule à proposer ces durées.
      const url = cycle === 'MONTHLY' ? `/activation?plan=${plan.code}` : `/signup?plan=${plan.code}&cycle=${cycle}`;
      ctx.emit({ kind: 'signup', data: { url, planName: plan.name, cycle } });
      await prisma.advisorConversation.update({ where: { id: ctx.conversationId }, data: { planInterest: plan.code } });
      await event(ctx.conversationId, 'signup_shown', { plan: plan.code, cycle });
      return { shown: true, note: "Bouton affiché. Le prospect doit cliquer lui-même." };
    }
    case 'record_needs': {
      const concerns = Array.isArray(input.concerns) ? (input.concerns as string[]).map(String).slice(0, 8) : [];
      const conv = await prisma.advisorConversation.findUnique({ where: { id: ctx.conversationId } });
      const prev = (conv?.summary as Record<string, unknown> | null) ?? {};
      const clean = Object.fromEntries(
        Object.entries(input)
          .filter(([k]) => k !== 'concerns')
          .map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => String(x).slice(0, 120)).slice(0, 8) : String(v).slice(0, 160)]),
      );
      await prisma.advisorConversation.update({
        where: { id: ctx.conversationId },
        data: {
          summary: { ...prev, ...clean } as Prisma.InputJsonObject,
          concerns: Array.from(new Set([...(conv?.concerns ?? []), ...concerns])),
          planInterest: typeof input.plan_interest === 'string' ? input.plan_interest.slice(0, 40) : undefined,
        },
      });
      return { saved: true };
    }
    case 'note_unanswered': {
      const q = String(input.question ?? '').slice(0, 200);
      const conv = await prisma.advisorConversation.findUnique({ where: { id: ctx.conversationId } });
      await prisma.advisorConversation.update({
        where: { id: ctx.conversationId },
        data: { unanswered: [...(conv?.unanswered ?? []), q].slice(-10) },
      });
      return { saved: true };
    }
    case 'request_human': {
      ctx.emit({ kind: 'human', data: { whatsapp: '221768881739', email: 'support@oculosaas.com' } });
      await event(ctx.conversationId, 'human_requested');
      return { shown: 'WhatsApp +221 76 888 17 39, support@oculosaas.com, formulaire de rappel' };
    }
    default:
      return { error: 'Outil inconnu' };
  }
}

/* ---------------- Conversations ---------------- */

export async function event(conversationId: string, name: string, payload?: object): Promise<void> {
  try {
    await prisma.advisorEvent.create({ data: { conversationId, name, payload } });
  } catch (err) {
    logger.warn({ err, name }, 'Événement conseiller non enregistré');
  }
}

export const isEnabled = () => Boolean(env.ANTHROPIC_API_KEY);

export async function startConversation(input: { ip: string; page: string; mode: string; lang: Lang; activationToken?: string }) {
  const hash = ipHash(input.ip);
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const count = await prisma.advisorConversation.count({ where: { ipHash: hash, createdAt: { gte: since } } });
  if (count >= LIMITS.maxPerIpPerDay) return { error: 'quota' as const };
  const session = input.activationToken
    ? await prisma.activationSession.findUnique({ where: { token: input.activationToken }, select: { id: true } })
    : null;
  const conv = await prisma.advisorConversation.create({
    data: {
      ipHash: hash,
      page: input.page.slice(0, 40),
      mode: input.mode === 'TEXT' ? 'TEXT' : 'VOICE',
      lang: input.lang,
      activationSessionId: session?.id ?? null,
    },
  });
  await event(conv.id, 'opened', { page: conv.page, mode: conv.mode });
  return { conversation: conv };
}

/** Rattache la conversation au tunnel d'activation (attribution de la conversion). */
export async function linkActivation(conversationId: string, token: string): Promise<boolean> {
  const session = await prisma.activationSession.findUnique({ where: { token }, select: { id: true } });
  if (!session) return false;
  await prisma.advisorConversation.updateMany({ where: { id: conversationId }, data: { activationSessionId: session.id } });
  return true;
}

export const CLIENT_EVENTS = ['started', 'ended', 'abandoned', 'signup_clicked', 'human_whatsapp_clicked', 'callback_requested', 'mic_denied', 'voice_unsupported', 'switched_to_text'] as const;

export async function clientEvent(conversationId: string, name: (typeof CLIENT_EVENTS)[number]): Promise<void> {
  if (name === 'ended' || name === 'abandoned') {
    await prisma.advisorConversation.updateMany({
      where: { id: conversationId, status: 'OPEN' },
      data: { status: name === 'ended' ? 'COMPLETED' : 'ABANDONED', endedAt: new Date() },
    });
  }
  if (name === 'switched_to_text') await prisma.advisorConversation.updateMany({ where: { id: conversationId }, data: { mode: 'TEXT' } });
  await event(conversationId, name);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await prisma.advisorConversation.deleteMany({ where: { id: conversationId } });
}

/* ---------------- Réponse en flux (Anthropic Messages API, streaming + outils) ---------------- */

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
type Msg = { role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> };

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

function normalize(turns: ChatTurn[]): Msg[] {
  const out: Msg[] = [];
  for (const t of turns.slice(-LIMITS.maxHistory)) {
    const text = String(t.content ?? '').slice(0, LIMITS.maxMessageChars).trim();
    if (!text || (t.role !== 'user' && t.role !== 'assistant')) continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role && typeof last.content === 'string') last.content += `\n${text}`;
    else out.push({ role: t.role, content: text });
  }
  // L'accueil est prononcé par le navigateur : on le garde dans le contexte,
  // précédé d'un tour « ouverture », car l'API exige de commencer par l'utilisateur.
  if (out.length && out[0].role !== 'user') out.unshift({ role: 'user', content: '[Le prospect ouvre la conversation]' });
  return out;
}

/** Un appel au modèle en flux : relaie le texte au fil de l'eau, renvoie les blocs et l'usage. */
async function streamOnce(
  messages: Msg[],
  system: string,
  onText: (d: string) => void,
  signal: AbortSignal,
): Promise<{ blocks: Block[]; stop: string; inTok: number; outTok: number }> {
  const res = await fetch(`${env.ANTHROPIC_BASE_URL}/v1/messages`, {
    method: 'POST',
    signal,
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 500,
      stream: true,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Anthropic ${res.status} ${(await res.text()).slice(0, 300)}`);

  const blocks: Block[] = [];
  const json: string[] = [];
  let stop = 'end_turn';
  let inTok = 0;
  let outTok = 0;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const ev = JSON.parse(line.slice(5));
      switch (ev.type) {
        case 'message_start':
          inTok += (ev.message?.usage?.input_tokens ?? 0) + (ev.message?.usage?.cache_read_input_tokens ?? 0) * 0.1 + (ev.message?.usage?.cache_creation_input_tokens ?? 0) * 1.25;
          break;
        case 'content_block_start':
          blocks[ev.index] = ev.content_block.type === 'tool_use'
            ? { type: 'tool_use', id: ev.content_block.id, name: ev.content_block.name, input: {} }
            : { type: 'text', text: '' };
          json[ev.index] = '';
          break;
        case 'content_block_delta':
          if (ev.delta.type === 'text_delta') {
            (blocks[ev.index] as { text: string }).text += ev.delta.text;
            onText(ev.delta.text);
          } else if (ev.delta.type === 'input_json_delta') json[ev.index] += ev.delta.partial_json;
          break;
        case 'content_block_stop': {
          const b = blocks[ev.index];
          if (b?.type === 'tool_use') b.input = json[ev.index] ? JSON.parse(json[ev.index]) : {};
          break;
        }
        case 'message_delta':
          stop = ev.delta?.stop_reason ?? stop;
          outTok += ev.usage?.output_tokens ?? 0;
          break;
        case 'error':
          throw new Error(ev.error?.message ?? 'erreur de flux');
      }
    }
  }
  return { blocks: blocks.filter(Boolean), stop, inTok: Math.round(inTok), outTok };
}

export async function reply(input: {
  conversationId: string;
  turns: ChatTurn[];
  onText: (d: string) => void;
  onUi: (e: UiEvent) => void;
  signal: AbortSignal;
}): Promise<{ limited?: 'turns' | 'time' }> {
  const conv = await prisma.advisorConversation.findUnique({ where: { id: input.conversationId } });
  if (!conv) throw new Error('Conversation introuvable');
  if (conv.turns >= LIMITS.maxTurns) return { limited: 'turns' };
  if (Date.now() - conv.createdAt.getTime() > LIMITS.maxMinutes * 60_000) return { limited: 'time' };

  const lang = (LANGS as readonly string[]).includes(conv.lang) ? (conv.lang as Lang) : 'fr';
  const system = systemPrompt(lang, conv.mode === 'TEXT' ? 'TEXT' : 'VOICE', conv.page);
  const messages = normalize(input.turns);
  if (!messages.length) return {};
  if (conv.turns === 0) await event(conv.id, 'started');

  let inTok = 0;
  let outTok = 0;
  try {
    let spoke = false;
    for (let round = 0; round < 5; round++) {
      // Espace entre le texte d'avant et d'après un outil, sinon les phrases se collent.
      if (spoke) input.onText(' ');
      const r = await streamOnce(messages, system, input.onText, input.signal);
      spoke = spoke || r.blocks.some((b) => b.type === 'text' && b.text.trim());
      inTok += r.inTok;
      outTok += r.outTok;
      if (r.stop !== 'tool_use') break;
      messages.push({ role: 'assistant', content: r.blocks as unknown as Array<Record<string, unknown>> });
      const results = [];
      for (const b of r.blocks) {
        if (b.type !== 'tool_use') continue;
        let out: unknown;
        try {
          out = await runTool(b.name, b.input, { conversationId: conv.id, emit: input.onUi });
        } catch (err) {
          logger.warn({ err, tool: b.name }, 'Outil conseiller en échec');
          out = { error: 'Indisponible pour le moment' };
        }
        results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) });
      }
      messages.push({ role: 'user', content: results });
    }
  } finally {
    await prisma.advisorConversation.update({
      where: { id: conv.id },
      data: {
        turns: { increment: 1 },
        inputTokens: { increment: inTok },
        outputTokens: { increment: outTok },
        costMicroUsd: { increment: inTok * COST_IN_MICRO + outTok * COST_OUT_MICRO },
      },
    });
  }
  return {};
}

/* ---------------- Statistiques (console fondateur) ---------------- */

export async function stats(days: number) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const convs = await prisma.advisorConversation.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true, status: true, turns: true, costMicroUsd: true, concerns: true, unanswered: true, mode: true, page: true,
      activationSession: { select: { paidAt: true, events: { select: { name: true } } } },
    },
  });
  const evs = await prisma.advisorEvent.groupBy({ by: ['name'], where: { createdAt: { gte: since } }, _count: true });
  const ev = (n: string) => evs.find((e) => e.name === n)?._count ?? 0;
  const opened = convs.length;
  const started = convs.filter((c) => c.turns > 0).length;
  const completed = convs.filter((c) => c.status === 'COMPLETED').length;
  const abandoned = convs.filter((c) => c.status === 'ABANDONED').length;
  const signupClicked = new Set(
    (await prisma.advisorEvent.findMany({ where: { createdAt: { gte: since }, name: 'signup_clicked' }, select: { conversationId: true } })).map((e) => e.conversationId),
  ).size;
  const linked = convs.filter((c) => c.activationSession);
  const paymentStarted = linked.filter((c) => c.activationSession!.events.some((e) => e.name === 'payment_started')).length;
  // Référence de conversion : paiement confirmé par le prestataire (paidAt posé par le webhook).
  const paid = linked.filter((c) => c.activationSession!.paidAt).length;
  const activated = linked.filter((c) => c.activationSession!.events.some((e) => e.name === 'activation_completed')).length;
  const cost = convs.reduce((s, c) => s + c.costMicroUsd, 0) / 1e6;
  const concerns = new Map<string, number>();
  convs.forEach((c) => c.concerns.forEach((k) => concerns.set(k, (concerns.get(k) ?? 0) + 1)));
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    days,
    opened,
    started,
    completed,
    abandoned,
    signupClicked,
    paymentStarted,
    paid,
    activated,
    plansShown: ev('plans_shown'),
    humanRequested: ev('human_requested'),
    rates: {
      start: pct(started, opened),
      completion: pct(completed, started),
      signupClick: pct(signupClicked, started),
      paidConversion: pct(paid, started),
    },
    costUsd: Math.round(cost * 10000) / 10000,
    costPerConversationUsd: started ? Math.round((cost / started) * 10000) / 10000 : 0,
    costPerPaidUsd: paid ? Math.round((cost / paid) * 100) / 100 : null,
    topConcerns: [...concerns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
    unanswered: convs.flatMap((c) => c.unanswered).slice(-30).reverse(),
    knowledgeEntries: KNOWLEDGE.length,
  };
}
