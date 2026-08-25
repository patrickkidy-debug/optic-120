import {
  PartnerStatus,
  PartnerTierCode,
  PartnerLeadStatus,
  PartnerCommissionStatus,
  SubscriptionStatus,
  DEFAULT_ATTRIBUTION_DAYS,
  type PartnerSignupInput,
  type PartnerLoginInput,
  type PartnerTrackInput,
  type PartnerLeadCreateInput,
  type PartnerLeadUpdateInput,
  type PartnerCommissionRuleUpsertInput,
  type PartnerCommissionActionInput,
  type PartnerAuthUser,
  type PartnerDashboardStats,
  type PartnerProfileUpdateInput,
} from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { signPartnerAccessToken } from '../../lib/jwt.js';
import { generateRefreshToken, hashRefreshToken } from '../../lib/tokens.js';
import { badRequest, notFound, unauthorized, conflict } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';
import { env, appOrigin } from '../../config/env.js';

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/* ------------------------------- Utilitaires ------------------------------- */

function slugifyUpper(input: string): string {
  return input
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 20);
}

/** Génère un code unique du type OCULO-KONAN, avec suffixe numérique si besoin. */
async function uniqueReferralCode(lastName: string): Promise<string> {
  const root = slugifyUpper(lastName) || 'PARTNER';
  let candidate = `OCULO-${root}`;
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.partner.findFirst({ where: { referralCode: candidate } })) {
    candidate = `OCULO-${root}${i++}`;
  }
  return candidate;
}

function referralLink(code: string): string {
  return `${appOrigin}/?ref=${encodeURIComponent(code)}`;
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function toPartnerAuthUser(p: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  countryCode: string | null;
  city: string | null;
  payoutMethod: string | null;
  status: string;
  tier: string;
  referralCode: string;
}): PartnerAuthUser {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    whatsapp: p.whatsapp,
    countryCode: p.countryCode,
    city: p.city,
    payoutMethod: p.payoutMethod,
    status: p.status as PartnerStatus,
    tier: p.tier as PartnerTierCode,
    referralCode: p.referralCode,
    referralLink: referralLink(p.referralCode),
  };
}

/**
 * Journal d'audit OculoPartners. N'échoue jamais l'opération métier : une
 * erreur d'écriture est seulement journalisée (même contrat que recordAudit).
 */
export async function recordPartnerAudit(input: {
  partnerId?: string | null;
  actorType: 'PARTNER' | 'OPERATOR' | 'SYSTEM';
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.partnerAuditLog.create({
      data: {
        partnerId: input.partnerId ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        before: (input.before ?? undefined) as object | undefined,
        after: (input.after ?? undefined) as object | undefined,
        ipAddress: input.ipAddress ?? null,
        metadata: input.metadata ? (input.metadata as object) : undefined,
      },
    });
  } catch (err) {
    logger.error({ err, action: input.action }, "Échec d'écriture du journal d'audit partenaire");
  }
}

/* --------------------------------- Auth --------------------------------- */

async function issuePartnerSession(
  partnerId: string,
  meta: RequestMeta,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signPartnerAccessToken(partnerId);
  const refreshToken = generateRefreshToken();
  await prisma.partnerSession.create({
    data: {
      partnerId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiry(),
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  return { accessToken, refreshToken };
}

export async function signupPartner(input: PartnerSignupInput, meta: RequestMeta) {
  const existing = await prisma.partner.findFirst({
    where: { OR: [{ email: input.email.toLowerCase() }, { whatsapp: input.whatsapp }] },
  });
  if (existing) throw conflict('Un compte partenaire existe déjà avec cet email ou ce numéro WhatsApp');

  const passwordHash = await hashPassword(input.password);
  const referralCode = await uniqueReferralCode(input.lastName);

  const partner = await prisma.partner.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      whatsapp: input.whatsapp,
      countryCode: input.countryCode ?? null,
      city: input.city ?? null,
      passwordHash,
      referralCode,
      payoutMethod: input.payoutMethod ?? null,
      payoutDetails: input.payoutDetails ?? undefined,
      termsAcceptedAt: new Date(),
    },
  });

  await recordPartnerAudit({
    partnerId: partner.id,
    actorType: 'PARTNER',
    actorId: partner.id,
    action: 'PARTNER_SIGNUP',
    entity: 'Partner',
    entityId: partner.id,
    ipAddress: meta.ipAddress,
  });

  const session = await issuePartnerSession(partner.id, meta);
  return { ...session, partner: toPartnerAuthUser(partner) };
}

export async function loginPartner(input: PartnerLoginInput, meta: RequestMeta) {
  const partner = await prisma.partner.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!partner || !(await verifyPassword(partner.passwordHash, input.password))) {
    throw unauthorized('Email ou mot de passe incorrect');
  }
  if (partner.status === PartnerStatus.SUSPENDED) throw unauthorized('Compte partenaire suspendu');
  if (partner.status === PartnerStatus.REJECTED) throw unauthorized('Candidature refusée');

  const session = await issuePartnerSession(partner.id, meta);
  return { ...session, partner: toPartnerAuthUser(partner) };
}

export async function refreshPartnerSession(refreshToken: string, meta: RequestMeta) {
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.partnerSession.findUnique({ where: { tokenHash }, include: { partner: true } });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Session expirée, reconnectez-vous');
  }
  // Rotation simple : l'ancien jeton est révoqué, un nouveau est émis.
  await prisma.partnerSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  const next = await issuePartnerSession(session.partnerId, meta);
  return { ...next, partner: toPartnerAuthUser(session.partner) };
}

export async function logoutPartner(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const tokenHash = hashRefreshToken(refreshToken);
  await prisma.partnerSession.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
}

export async function getPartnerAuthUser(partnerId: string): Promise<PartnerAuthUser> {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw notFound('Partenaire introuvable');
  return toPartnerAuthUser(partner);
}

/**
 * Mise à jour du profil par le partenaire lui-même. Ne touche jamais
 * `status`, `tier` ni `referralCode` — ces champs-là sont réservés à
 * l'opérateur (voir setPartnerStatus/setPartnerTier) ou immuables.
 */
export async function updatePartnerProfile(
  partnerId: string,
  input: PartnerProfileUpdateInput,
): Promise<PartnerAuthUser> {
  if (input.email || input.whatsapp) {
    const existing = await prisma.partner.findFirst({
      where: {
        id: { not: partnerId },
        OR: [
          ...(input.email ? [{ email: input.email.toLowerCase() }] : []),
          ...(input.whatsapp ? [{ whatsapp: input.whatsapp }] : []),
        ],
      },
    });
    if (existing) {
      throw conflict('Cet email ou ce numéro WhatsApp est déjà utilisé par un autre compte partenaire');
    }
  }

  const partner = await prisma.partner.update({
    where: { id: partnerId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ? input.email.toLowerCase() : undefined,
      whatsapp: input.whatsapp,
      countryCode: input.countryCode === '' ? null : input.countryCode,
      city: input.city === '' ? null : input.city,
      payoutMethod: input.payoutMethod === '' ? null : input.payoutMethod,
      payoutDetails: input.payoutDetails ?? undefined,
    },
  });

  await recordPartnerAudit({
    partnerId,
    actorType: 'PARTNER',
    actorId: partnerId,
    action: 'PARTNER_PROFILE_UPDATED',
    entity: 'Partner',
    entityId: partnerId,
  });

  return toPartnerAuthUser(partner);
}

/**
 * Change le mot de passe (exige l'ancien). Révoque toutes les sessions
 * actives — y compris l'appel courant — par sécurité : le frontend doit
 * renvoyer le partenaire à l'écran de connexion juste après.
 */
export async function changePartnerPassword(
  partnerId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw notFound('Partenaire introuvable');
  if (!(await verifyPassword(partner.passwordHash, currentPassword))) {
    throw badRequest('Mot de passe actuel incorrect');
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.partner.update({ where: { id: partnerId }, data: { passwordHash } });
  await prisma.partnerSession.updateMany({
    where: { partnerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await recordPartnerAudit({
    partnerId,
    actorType: 'PARTNER',
    actorId: partnerId,
    action: 'PARTNER_PASSWORD_CHANGED',
    entity: 'Partner',
    entityId: partnerId,
  });
}

/* ------------------------------ Attribution ------------------------------ */

/**
 * Enregistre le clic sur un lien de parrainage (page publique, avant toute
 * inscription). Un visiteur (identifiant anonyme généré côté client) ne peut
 * être rattaché qu'à UNE seule attribution active à la fois : le premier
 * partenaire valide la conserve jusqu'à expiration (règle « premier arrivé »).
 */
export async function trackReferralClick(input: PartnerTrackInput): Promise<{ expiresAt: Date }> {
  const partner = await prisma.partner.findUnique({ where: { referralCode: input.referralCode } });
  // Code inconnu : on ne crée rien, mais on ne fait jamais échouer la page publique.
  if (!partner || partner.status === PartnerStatus.REJECTED) {
    return { expiresAt: new Date(Date.now() + DEFAULT_ATTRIBUTION_DAYS * 86_400_000) };
  }

  const existing = await prisma.partnerAttribution.findFirst({
    where: { visitorId: input.visitorId, tenantId: null, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (existing) return { expiresAt: existing.expiresAt };

  const expiresAt = new Date(Date.now() + DEFAULT_ATTRIBUTION_DAYS * 86_400_000);
  await prisma.partnerAttribution.create({
    data: {
      partnerId: partner.id,
      referralCode: partner.referralCode,
      visitorId: input.visitorId,
      expiresAt,
    },
  });
  return { expiresAt };
}

/**
 * Lie une inscription magasin à son attribution, s'il y en a une valide.
 * Appelée depuis signupTenant — JAMAIS bloquante : une erreur ici ne doit
 * jamais empêcher un magasin de s'inscrire.
 *
 * Anti auto-parrainage : un partenaire ne peut pas s'attribuer son propre
 * magasin (comparaison email/WhatsApp).
 */
export async function linkAttributionOnSignup(
  tenantId: string,
  referralCode: string | undefined,
  admin: { email: string; whatsapp: string },
  visitorId: string | undefined,
  meta: RequestMeta,
): Promise<void> {
  if (!referralCode) return;
  try {
    const partner = await prisma.partner.findUnique({ where: { referralCode } });
    if (!partner || partner.status === PartnerStatus.REJECTED || partner.status === PartnerStatus.SUSPENDED) return;

    if (
      partner.email.toLowerCase() === admin.email.toLowerCase() ||
      (admin.whatsapp && partner.whatsapp === admin.whatsapp)
    ) {
      logger.warn({ partnerId: partner.id, tenantId }, 'Tentative de auto-parrainage bloquée');
      return;
    }

    // Attribution anonyme déjà posée pour ce visiteur (clic préalable) : on la
    // récupère si elle vise le même partenaire et n'a pas expiré. Sinon, on en
    // crée une nouvelle directement liée (lien collé/partagé sans clic public).
    const now = new Date();
    let attribution = visitorId
      ? await prisma.partnerAttribution.findFirst({
          where: {
            visitorId,
            partnerId: partner.id,
            tenantId: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'asc' },
        })
      : null;

    if (!attribution) {
      attribution = await prisma.partnerAttribution.create({
        data: {
          partnerId: partner.id,
          referralCode: partner.referralCode,
          visitorId: visitorId ?? null,
          expiresAt: new Date(now.getTime() + DEFAULT_ATTRIBUTION_DAYS * 86_400_000),
        },
      });
    }

    await prisma.partnerAttribution.update({
      where: { id: attribution.id },
      data: { tenantId, linkedAt: now },
    });

    await recordPartnerAudit({
      partnerId: partner.id,
      actorType: 'SYSTEM',
      action: 'ATTRIBUTION_LINKED',
      entity: 'PartnerAttribution',
      entityId: attribution.id,
      after: { tenantId },
      ipAddress: meta.ipAddress,
    });
  } catch (err) {
    // tenantId + code déjà attribué à un autre tenant (contrainte unique sur
    // PartnerAttribution.tenantId) ou toute autre erreur : ne jamais bloquer
    // l'inscription magasin pour un problème d'attribution.
    logger.error({ err, tenantId, referralCode }, 'Liaison attribution partenaire échouée');
  }
}

/* ---------------------------------- Leads --------------------------------- */

export async function createLead(partnerId: string, input: PartnerLeadCreateInput) {
  return prisma.partnerLead.create({
    data: {
      partnerId,
      establishmentName: input.establishmentName,
      contactName: input.contactName || null,
      phone: input.phone || null,
      email: input.email || null,
      countryCode: input.countryCode || null,
      city: input.city || null,
      source: 'MANUAL',
    },
  });
}

export async function updateLead(partnerId: string, leadId: string, input: PartnerLeadUpdateInput) {
  const lead = await prisma.partnerLead.findFirst({ where: { id: leadId, partnerId } });
  if (!lead) throw notFound('Prospect introuvable');
  return prisma.partnerLead.update({
    where: { id: leadId },
    data: {
      status: input.status as PartnerLeadStatus | undefined,
      contactName: input.contactName,
      phone: input.phone,
      email: input.email,
      lastActivityAt: new Date(),
    },
  });
}

export async function listLeads(partnerId: string) {
  return prisma.partnerLead.findMany({ where: { partnerId }, orderBy: { createdAt: 'desc' } });
}

/** Clients apportés : attributions liées à un tenant, avec l'abonnement associé. */
export async function listPartnerCustomers(partnerId: string) {
  const attributions = await prisma.partnerAttribution.findMany({
    where: { partnerId, tenantId: { not: null } },
    orderBy: { linkedAt: 'desc' },
  });
  const tenantIds = attributions.map((a) => a.tenantId!).filter(Boolean);
  if (tenantIds.length === 0) return [];
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: {
      id: true,
      name: true,
      countryCode: true,
      createdAt: true,
      subscription: { select: { status: true, currentPeriodEnd: true, plan: { select: { name: true, code: true } } } },
    },
  });
  const byId = new Map(tenants.map((t) => [t.id, t]));
  const commissions = await prisma.partnerCommission.findMany({ where: { partnerId } });
  const commissionByTenant = new Map<string, number>();
  for (const c of commissions) {
    commissionByTenant.set(c.tenantId, (commissionByTenant.get(c.tenantId) ?? 0) + Number(c.amount));
  }
  return attributions
    .map((a) => {
      const t = byId.get(a.tenantId!);
      if (!t) return null;
      const sub = t.subscription;
      const active = !!sub && sub.status === SubscriptionStatus.ACTIVE && sub.currentPeriodEnd.getTime() > Date.now();
      return {
        tenantId: t.id,
        tenantName: t.name,
        countryCode: t.countryCode,
        linkedAt: a.linkedAt,
        subscriptionStatus: sub?.status ?? null,
        planName: sub?.plan.name ?? null,
        active,
        commissionGenerated: commissionByTenant.get(t.id) ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/* ------------------------------ Commissions ------------------------------ */

/** Règle active pour une offre + un niveau, à la date donnée (par défaut maintenant). */
async function findActiveCommissionRule(planCode: string, tier: PartnerTierCode, at = new Date()) {
  return prisma.partnerCommissionRule.findFirst({
    where: {
      planCode,
      tier,
      isActive: true,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
}

/**
 * Calcule et enregistre la commission d'un paiement d'abonnement RÉELLEMENT
 * confirmé (jamais sur une simple inscription). Appelée après
 * settleSubscriptionPayment — ne doit JAMAIS faire échouer le règlement du
 * client : toute erreur est journalisée et avalée.
 *
 * Idempotence : `subscriptionPaymentId` est unique sur PartnerCommission, donc
 * un même paiement (webhook rejoué, confirmation manuelle relancée) ne peut
 * générer qu'une seule commission.
 *
 * Portée MVP validée : commission UNIQUEMENT sur le premier paiement
 * d'abonnement confirmé du tenant (pas de commission récurrente).
 */
export async function recordCommissionForPayment(payment: {
  id: string;
  invoiceId: string;
  tenantId: string;
  amount: number;
  currency: string;
  planCode: string;
}): Promise<void> {
  try {
    const attribution = await prisma.partnerAttribution.findUnique({
      where: { tenantId: payment.tenantId },
    });
    if (!attribution || attribution.revokedAt) return;

    // Commission au premier paiement seulement : si ce tenant a déjà une
    // commission, on s'arrête là (protège aussi contre un double appel).
    const already = await prisma.partnerCommission.findFirst({ where: { tenantId: payment.tenantId } });
    if (already) return;

    const partner = await prisma.partner.findUnique({ where: { id: attribution.partnerId } });
    if (!partner || partner.status === PartnerStatus.SUSPENDED || partner.status === PartnerStatus.REJECTED) return;

    const rule = await findActiveCommissionRule(payment.planCode, partner.tier as PartnerTierCode);
    if (!rule) {
      logger.warn(
        { planCode: payment.planCode, tier: partner.tier },
        'Aucune règle de commission active pour cette offre/niveau',
      );
      return;
    }

    await prisma.partnerCommission.create({
      data: {
        partnerId: partner.id,
        tenantId: payment.tenantId,
        subscriptionPaymentId: payment.id,
        subscriptionInvoiceId: payment.invoiceId,
        planCode: payment.planCode,
        customerAmount: payment.amount,
        amount: rule.amount,
        currency: rule.currency,
        status: PartnerCommissionStatus.PENDING,
        ruleSnapshot: { planCode: rule.planCode, tier: rule.tier, amount: Number(rule.amount), currency: rule.currency },
      },
    });

    await recordPartnerAudit({
      partnerId: partner.id,
      actorType: 'SYSTEM',
      action: 'COMMISSION_CREATED',
      entity: 'PartnerCommission',
      entityId: payment.id,
      after: { tenantId: payment.tenantId, amount: Number(rule.amount) },
    });
  } catch (err) {
    // Contrainte unique (paiement déjà traité) ou autre erreur : jamais
    // bloquant pour le règlement du client.
    logger.error({ err, paymentId: payment.id }, 'Calcul de commission partenaire échoué');
  }
}

export async function listPartnerCommissions(partnerId: string) {
  return prisma.partnerCommission.findMany({ where: { partnerId }, orderBy: { createdAt: 'desc' } });
}

export async function getPartnerDashboardStats(
  partnerId: string,
  since?: Date,
): Promise<PartnerDashboardStats> {
  const [leads, commissions] = await Promise.all([
    prisma.partnerLead.findMany({ where: { partnerId, ...(since ? { createdAt: { gte: since } } : {}) } }),
    prisma.partnerCommission.findMany({ where: { partnerId, ...(since ? { createdAt: { gte: since } } : {}) } }),
  ]);
  const customers = await listPartnerCustomers(partnerId);

  const sum = (status: PartnerCommissionStatus) =>
    commissions.filter((c) => c.status === status).reduce((s, c) => s + Number(c.amount), 0);
  const commissionPending = sum(PartnerCommissionStatus.PENDING) + sum(PartnerCommissionStatus.APPROVED);
  const commissionPaid = sum(PartnerCommissionStatus.PAID);
  const commissionTotal = commissions
    .filter((c) => c.status !== PartnerCommissionStatus.CANCELLED && c.status !== PartnerCommissionStatus.REVERSED)
    .reduce((s, c) => s + Number(c.amount), 0);

  const leadsTotal = leads.length;
  const subscribedLeads = leads.filter((l) => l.status === PartnerLeadStatus.SUBSCRIBED).length;
  const conversionRatePct = leadsTotal > 0 ? Math.round((subscribedLeads / leadsTotal) * 1000) / 10 : 0;

  return {
    leadsTotal,
    customersTotal: customers.length,
    customersActive: customers.filter((c) => c.active).length,
    conversionRatePct,
    commissionPending,
    commissionApproved: sum(PartnerCommissionStatus.APPROVED),
    commissionPaid,
    commissionTotal,
    currency: commissions[0]?.currency ?? 'XOF',
  };
}

/* ------------------------------ Console admin ----------------------------- */

export async function listPartnersForAdmin(status?: PartnerStatus) {
  return prisma.partner.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { leads: true, commissions: true } } },
  });
}

export async function setPartnerStatus(
  partnerId: string,
  status: PartnerStatus,
  actorId: string,
  meta: RequestMeta,
) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw notFound('Partenaire introuvable');
  const updated = await prisma.partner.update({
    where: { id: partnerId },
    data: {
      status,
      approvedAt: status === PartnerStatus.ACTIVE ? new Date() : partner.approvedAt,
      suspendedAt: status === PartnerStatus.SUSPENDED ? new Date() : null,
    },
  });
  await recordPartnerAudit({
    partnerId,
    actorType: 'OPERATOR',
    actorId,
    action: 'PARTNER_STATUS_CHANGED',
    entity: 'Partner',
    entityId: partnerId,
    before: { status: partner.status },
    after: { status },
    ipAddress: meta.ipAddress,
  });
  return updated;
}

export async function setPartnerTier(partnerId: string, tier: PartnerTierCode, actorId: string, meta: RequestMeta) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw notFound('Partenaire introuvable');
  const updated = await prisma.partner.update({ where: { id: partnerId }, data: { tier } });
  await recordPartnerAudit({
    partnerId,
    actorType: 'OPERATOR',
    actorId,
    action: 'PARTNER_TIER_CHANGED',
    entity: 'Partner',
    entityId: partnerId,
    before: { tier: partner.tier },
    after: { tier },
    ipAddress: meta.ipAddress,
  });
  return updated;
}

export async function listCommissionRules() {
  return prisma.partnerCommissionRule.findMany({ where: { isActive: true }, orderBy: [{ planCode: 'asc' }, { tier: 'asc' }] });
}

/**
 * Change le montant d'une règle : ferme l'ancienne (effectiveTo = maintenant)
 * et en ouvre une nouvelle. Les commissions déjà générées gardent leur
 * `ruleSnapshot` figé — changer un taux n'affecte jamais le passé.
 */
export async function upsertCommissionRule(
  input: PartnerCommissionRuleUpsertInput,
  actorId: string,
  meta: RequestMeta,
) {
  const now = new Date();
  const previous = await findActiveCommissionRule(input.planCode, input.tier as PartnerTierCode, now);
  if (previous) {
    await prisma.partnerCommissionRule.update({
      where: { id: previous.id },
      data: { isActive: false, effectiveTo: now },
    });
  }
  const rule = await prisma.partnerCommissionRule.create({
    data: {
      planCode: input.planCode,
      tier: input.tier,
      amount: input.amount,
      currency: input.currency,
      isActive: input.isActive,
    },
  });
  await recordPartnerAudit({
    actorType: 'OPERATOR',
    actorId,
    action: 'COMMISSION_RULE_UPDATED',
    entity: 'PartnerCommissionRule',
    entityId: rule.id,
    before: previous ? { amount: Number(previous.amount) } : null,
    after: { amount: input.amount, planCode: input.planCode, tier: input.tier },
    ipAddress: meta.ipAddress,
  });
  return rule;
}

export async function listAllCommissionsForAdmin(status?: PartnerCommissionStatus) {
  return prisma.partnerCommission.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    include: { partner: { select: { firstName: true, lastName: true, email: true } } },
  });
}

const NEXT_STATUS: Record<PartnerCommissionActionInput['action'], PartnerCommissionStatus> = {
  APPROVE: PartnerCommissionStatus.APPROVED,
  CANCEL: PartnerCommissionStatus.CANCELLED,
  REVERSE: PartnerCommissionStatus.REVERSED,
  MARK_PAID: PartnerCommissionStatus.PAID,
};

/** Transition manuelle du statut d'une commission (console opérateur), auditée. */
export async function applyCommissionAction(
  commissionId: string,
  input: PartnerCommissionActionInput,
  actorId: string,
  meta: RequestMeta,
) {
  const commission = await prisma.partnerCommission.findUnique({ where: { id: commissionId } });
  if (!commission) throw notFound('Commission introuvable');

  const nextStatus = NEXT_STATUS[input.action];
  const now = new Date();
  const updated = await prisma.partnerCommission.update({
    where: { id: commissionId },
    data: {
      status: nextStatus,
      approvedAt: input.action === 'APPROVE' ? now : commission.approvedAt,
      paidAt: input.action === 'MARK_PAID' ? now : commission.paidAt,
    },
  });

  await recordPartnerAudit({
    partnerId: commission.partnerId,
    actorType: 'OPERATOR',
    actorId,
    action: `COMMISSION_${input.action}`,
    entity: 'PartnerCommission',
    entityId: commissionId,
    before: { status: commission.status },
    after: { status: nextStatus, note: input.note },
    ipAddress: meta.ipAddress,
  });

  return updated;
}

export async function getPartnerAuditLog(partnerId?: string, limit = 200) {
  return prisma.partnerAuditLog.findMany({
    where: partnerId ? { partnerId } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
