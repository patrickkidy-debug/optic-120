import { randomBytes } from 'node:crypto';
import {
  ActivationStep,
  SubscriptionStatus,
  type ActivationActivityInput,
  type ActivationEventName,
  type ActivationInformationInput,
  type ActivationNeedsInput,
  type ActivationPlanInput,
  type PaymentMethod,
} from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';
import { appOrigin } from '../../config/env.js';
import { createTenantWithAdmin, issueSession } from '../auth/auth.service.js';
import { hashPassword } from '../../lib/password.js';
import * as billing from '../billing/billing.service.js';

/**
 * Tunnel d'activation : qualification, offre, coordonnées, paiement.
 *
 * Règle centrale, valable à chaque ligne de ce fichier : AUCUN accès n'est
 * ouvert avant la confirmation du paiement par Moneroo. L'établissement est
 * bien créé à l'étape « informations » — la facturation a besoin d'un
 * établissement auquel rattacher la facture — mais son abonnement naît avec
 * une période DÉJÀ expirée. Le garde d'abonnement refuse alors tout accès,
 * exactement comme pour un abonnement échu. Rien ne s'ouvre tant que
 * `settleSubscriptionPayment` n'a pas basculé l'abonnement en ACTIVE, ce que
 * seul le webhook de paiement déclenche.
 */

const TOKEN_BYTES = 24;

/** Identifiant opaque remis au navigateur, jamais l'id de la ligne. */
function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

function toNeeds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export interface ActivationSessionView {
  token: string;
  step: string;
  structureType: string | null;
  branchCount: string | null;
  country: string | null;
  needs: string[];
  planCode: string | null;
  billingCycle: string | null;
  fullName: string | null;
  establishmentName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  wantsStockImport: boolean;
  hasExistingData: boolean;
  /** Vrai une fois le paiement confirmé : l'espace est ouvert. */
  activated: boolean;
}

function view(s: {
  token: string;
  step: string;
  structureType: string | null;
  branchCount: string | null;
  country: string | null;
  needs: unknown;
  planCode: string | null;
  billingCycle: string | null;
  fullName: string | null;
  establishmentName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  wantsStockImport: boolean;
  hasExistingData: boolean;
  paidAt: Date | null;
}): ActivationSessionView {
  return { ...s, needs: toNeeds(s.needs), activated: Boolean(s.paidAt) };
}

async function require_(token: string) {
  const session = await prisma.activationSession.findUnique({ where: { token } });
  if (!session) throw notFound('Parcours introuvable ou expiré');
  return session;
}

/** Trace une étape franchie. Ne fait jamais échouer le parcours. */
async function track(sessionId: string, name: ActivationEventName, payload?: object): Promise<void> {
  try {
    await prisma.activationEvent.create({ data: { sessionId, name, payload } });
  } catch (err) {
    logger.warn({ err, name }, 'Événement de tunnel non enregistré');
  }
}

export async function startSession(utm: {
  source?: string;
  medium?: string;
  campaign?: string;
}): Promise<ActivationSessionView> {
  const session = await prisma.activationSession.create({
    data: {
      token: newToken(),
      utmSource: utm.source ?? null,
      utmMedium: utm.medium ?? null,
      utmCampaign: utm.campaign ?? null,
    },
  });
  await track(session.id, 'activation_started');
  return view(session);
}

export async function getSession(token: string): Promise<ActivationSessionView> {
  const session = await require_(token);
  // Dernière activité : sert à distinguer un abandon d'un parcours en cours.
  await prisma.activationSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });
  return view(session);
}

export async function saveActivity(
  token: string,
  input: ActivationActivityInput,
): Promise<ActivationSessionView> {
  const session = await require_(token);
  const updated = await prisma.activationSession.update({
    where: { id: session.id },
    data: { ...input, step: ActivationStep.NEEDS, lastSeenAt: new Date() },
  });
  await track(session.id, 'activity_completed', input);
  return view(updated);
}

export async function saveNeeds(
  token: string,
  input: ActivationNeedsInput,
): Promise<ActivationSessionView> {
  const session = await require_(token);
  const updated = await prisma.activationSession.update({
    where: { id: session.id },
    data: { needs: input.needs, step: ActivationStep.PLAN, lastSeenAt: new Date() },
  });
  await track(session.id, 'needs_completed', { needs: input.needs });
  return view(updated);
}

export async function savePlan(
  token: string,
  input: ActivationPlanInput,
): Promise<ActivationSessionView> {
  const session = await require_(token);
  const updated = await prisma.activationSession.update({
    where: { id: session.id },
    data: { ...input, step: ActivationStep.INFORMATION, lastSeenAt: new Date() },
  });
  await track(session.id, 'plan_selected', input);
  return view(updated);
}

/**
 * Coordonnées + création de l'établissement, SANS accès.
 *
 * L'abonnement est ramené à une période déjà échue juste après la création :
 * `ensurePendingSubscription` pose par défaut un essai gratuit, qui ouvrirait
 * l'espace avant tout paiement — exactement ce que ce parcours interdit.
 */
export async function saveInformation(
  token: string,
  input: ActivationInformationInput,
): Promise<ActivationSessionView> {
  const session = await require_(token);
  if (session.tenantId) {
    // Retour en arrière sur une étape déjà validée : on ne recrée pas un
    // second établissement pour le même parcours.
    const updated = await prisma.activationSession.update({
      where: { id: session.id },
      data: { step: ActivationStep.PAYMENT, lastSeenAt: new Date() },
    });
    return view(updated);
  }

  const planCode = (session.planCode ?? 'STARTER') as 'STARTER' | 'STANDARD' | 'GROWTH';
  const [firstName, ...rest] = input.fullName.trim().split(/\s+/);
  const passwordHash = await hashPassword(input.password);

  const userId = await createTenantWithAdmin({
    tenantName: input.establishmentName,
    branchName: input.establishmentName,
    email: input.email,
    passwordHash,
    firstName: firstName || input.establishmentName,
    lastName: rest.join(' ') || '-',
    whatsapp: input.whatsapp,
    plan: planCode,
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
  if (!user) throw badRequest("Échec de création de l'espace");

  // Fermeture immédiate de l'accès : période expirée, donc garde d'abonnement
  // bloquant. Seul le paiement confirmé rouvrira l'espace.
  const now = new Date();
  await prisma.subscription.updateMany({
    where: { tenantId: user.tenantId },
    data: { status: SubscriptionStatus.PAST_DUE, currentPeriodEnd: now, trialEndsAt: now },
  });

  const updated = await prisma.activationSession.update({
    where: { id: session.id },
    data: {
      fullName: input.fullName,
      establishmentName: input.establishmentName,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      country: input.country,
      city: input.city || null,
      wantsStockImport: input.wantsStockImport,
      hasExistingData: input.hasExistingData,
      tenantId: user.tenantId,
      step: ActivationStep.PAYMENT,
      lastSeenAt: now,
    },
  });
  await track(session.id, 'information_completed', { establishmentName: input.establishmentName });
  return view(updated);
}

export interface StartPaymentResult {
  redirectUrl?: string;
  instruction?: string;
  simulation: boolean;
  paymentId: string;
}

/**
 * Lance le paiement Moneroo. Le retour ramène DANS le tunnel : le prospect n'a
 * pas encore accès à l'application, l'y renvoyer le mettrait face à un écran
 * de blocage sans explication.
 */
export async function startPayment(
  token: string,
  method: PaymentMethod,
): Promise<StartPaymentResult> {
  const session = await require_(token);
  if (!session.tenantId) throw badRequest('Renseignez vos informations avant de payer');
  if (session.paidAt) throw conflict('Ce parcours est déjà réglé');

  const plans = await prisma.subscriptionPlan.findMany({ where: { isActive: true } });
  const plan =
    plans.find((p) => p.code === session.planCode) ?? plans.find((p) => p.code === 'STARTER');
  if (!plan) throw badRequest('Aucune offre disponible');

  const result = await billing.subscribe(
    session.tenantId,
    plan.id,
    method,
    session.whatsapp ?? undefined,
    undefined,
    (session.billingCycle as never) ?? undefined,
    `${appOrigin}/activation/retour?session=${encodeURIComponent(token)}`,
  );

  await prisma.activationSession.update({
    where: { id: session.id },
    data: { invoiceId: result.invoiceId, lastSeenAt: new Date() },
  });
  await track(session.id, 'payment_started', { method, planCode: plan.code });
  return {
    redirectUrl: result.redirectUrl,
    instruction: result.instruction,
    simulation: result.simulation,
    paymentId: result.paymentId,
  };
}

export interface ActivationStatus {
  activated: boolean;
  /** Session ouverte uniquement quand le paiement est confirmé. */
  accessToken?: string;
  refreshToken?: string;
  whatsapp?: string;
}

/**
 * État du paiement, interrogé au retour du checkout.
 *
 * Ne se fie jamais au fait que le navigateur soit revenu : c'est l'abonnement
 * en base, passé ACTIVE par le webhook, qui fait foi. Un prospect qui
 * fermerait Moneroo sans payer puis reviendrait sur l'URL de retour n'obtient
 * donc rien.
 */
export async function getActivationStatus(
  token: string,
  meta: { ipAddress?: string; userAgent?: string },
): Promise<ActivationStatus> {
  const session = await require_(token);
  if (!session.tenantId) return { activated: false };

  const sub = await prisma.subscription.findUnique({
    where: { tenantId: session.tenantId },
    select: { status: true, currentPeriodEnd: true },
  });
  const active =
    sub?.status === SubscriptionStatus.ACTIVE && sub.currentPeriodEnd.getTime() > Date.now();
  if (!active) return { activated: false };

  if (!session.paidAt) {
    await prisma.activationSession.update({
      where: { id: session.id },
      data: { paidAt: new Date(), step: ActivationStep.DONE },
    });
    await track(session.id, 'payment_success');
    await track(session.id, 'activation_completed');
  }

  // Ouverture de session : le compte vient d'être activé, le prospect doit
  // arriver connecté sur son tableau de bord sans ressaisir son mot de passe.
  const admin = await prisma.user.findFirst({
    where: { tenantId: session.tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, tenantId: true, roleId: true },
  });
  if (!admin) return { activated: true };

  const tokens = await issueSession(admin, meta);
  return { activated: true, ...tokens };
}

export async function recordEvent(token: string, name: ActivationEventName): Promise<void> {
  const session = await require_(token);
  await track(session.id, name);
}

export async function requestCallback(input: {
  name: string;
  phone: string;
  moment: string;
  token?: string;
}): Promise<void> {
  let sessionId: string | null = null;
  if (input.token) {
    const s = await prisma.activationSession.findUnique({ where: { token: input.token } });
    sessionId = s?.id ?? null;
    if (s) await track(s.id, 'callback_requested');
  }
  await prisma.callbackRequest.create({
    data: { name: input.name, phone: input.phone, moment: input.moment, sessionId },
  });
}
