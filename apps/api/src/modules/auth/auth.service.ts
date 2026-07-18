import type {
  AuthUser,
  SignupInput,
  LoginInput,
  ProfileUpdateInput,
  GoogleSignupInput,
  EstablishmentChoice,
  InvoiceSettings,
} from '@oculo/shared-types';
import { countryFromPhone, DEFAULT_VAT_BY_COUNTRY } from '@oculo/shared-types';
import { verifyGoogleIdToken } from '../../lib/google-auth.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import {
  signAccessToken,
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
  signLoginSelection,
  verifyLoginSelection,
} from '../../lib/jwt.js';
import { generateTotpSecret, otpauthURL, qrDataUrl, verifyTotp } from '../../lib/totp.js';
import { encryptSecret, decryptSecret } from '../../lib/crypto.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  newTokenFamily,
  generateResetToken,
} from '../../lib/tokens.js';
import { recordAudit } from '../../lib/audit.js';
import { mailer } from '../../lib/mailer.js';
import { logger } from '../../lib/logger.js';
import { ensurePendingSubscription } from '../billing/billing.service.js';
import { env, appOrigin } from '../../config/env.js';
import { isOperatorEmail, isFounderEmail } from '../../lib/operators.js';
import { badRequest, conflict, locked, unauthorized } from '../../lib/http-error.js';

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const USER_INCLUDE = {
  role: { include: { permissions: { include: { permission: true } } } },
  branches: true,
  tenant: true,
} as const;

type UserWithCtx = Awaited<ReturnType<typeof loadUser>>;

async function loadUser(where: { id: string }) {
  return prisma.user.findUnique({ where, include: USER_INCLUDE });
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}


function buildAuthUser(user: NonNullable<UserWithCtx>): AuthUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    isPlatformOperator: isOperatorEmail(user.email),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    roleId: user.roleId,
    roleCode: user.role.code,
    roleName: user.role.name,
    permissions: user.role.permissions.map(
      (rp) => `${rp.permission.module}.${rp.permission.action}`,
    ),
    branchIds: user.branches.map((b) => b.branchId),
    allBranches: user.role.allBranches,
    tenantName: user.tenant.name,
    tenantLogoUrl: user.tenant.logoUrl,
    tenantCurrency: user.tenant.currency ?? 'XOF',
    tenantCountryCode: user.tenant.countryCode ?? null,
    tenantLocation: user.tenant.location,
    tenantContactPhone: user.tenant.contactPhone,
    tenantContactEmail: user.tenant.contactEmail,
    tenantVatRate: user.tenant.vatRate ?? null,
    tenantInvoiceSettings: (user.tenant.invoiceSettings as InvoiceSettings | null) ?? null,
    emailVerified: user.emailVerifiedAt != null,
  };
}

/** Génère un jeton de confirmation, le stocke (haché) et envoie l'email. */
async function sendVerificationEmail(user: { id: string; email: string; firstName: string }): Promise<void> {
  const token = generateResetToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verifyTokenHash: hashRefreshToken(token),
      verifyTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const link = `${appOrigin}/verifier-email?token=${token}`;
  await mailer.send({
    to: user.email,
    subject: 'Confirmez votre adresse email — OculoSaaS',
    text: `Bonjour ${user.firstName},\n\nBienvenue sur OculoSaaS ! Confirmez votre adresse email en cliquant sur ce lien (valable 24 h) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez cet email.`,
    html: `<p>Bonjour ${user.firstName},</p><p>Bienvenue sur <b>OculoSaaS</b> ! Confirmez votre adresse email :</p><p><a href="${link}">Confirmer mon adresse email</a> (lien valable 24 h)</p><p>Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.</p>`,
  });
}

/** Confirme l'email à partir du jeton reçu par lien. */
export async function verifyEmail(token: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { verifyTokenHash: hashRefreshToken(token), verifyTokenExpiresAt: { gt: new Date() } },
  });
  if (!user) throw badRequest('Lien de confirmation invalide ou expiré');
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), verifyTokenHash: null, verifyTokenExpiresAt: null },
  });
}

/** Renvoie l'email de confirmation à l'utilisateur connecté (si non vérifié). */
export async function resendVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerifiedAt) return;
  try {
    await sendVerificationEmail(user);
  } catch (err) {
    logger.error({ err }, 'Renvoi email de confirmation échoué');
  }
}

async function issueSession(
  user: { id: string; tenantId: string; roleId: string },
  meta: RequestMeta,
  family?: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    roleId: user.roleId,
  });
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      family: family ?? newTokenFamily(),
      expiresAt: refreshExpiry(),
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  return { accessToken, refreshToken };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'clinique';
  let candidate = root;
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.tenant.findUnique({ where: { slug: candidate } })) {
    candidate = `${root}-${i++}`;
  }
  return candidate;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** Résultat de login : session, défi 2FA, ou choix d'établissement (multi-tenant). */
export type LoginResult = SessionResult | { twoFactorRequired: true; challenge: string };
export type LoginOrSelect =
  | LoginResult
  | { chooseEstablishment: EstablishmentChoice[]; selectionToken: string };

interface NewTenantAdmin {
  tenantName: string;
  branchName: string;
  email: string;
  username?: string | null;
  passwordHash: string;
  firstName: string;
  lastName: string;
  /** Numéro WhatsApp du responsable (contact fondateur). */
  whatsapp: string;
  plan?: 'STARTER' | 'STANDARD' | 'GROWTH';
  /** Vrai pour Google (email déjà vérifié par Google) : saute notre propre vérification. */
  emailVerifiedNow?: boolean;
}

/**
 * Crée le tenant, sa succursale par défaut, clone les 12 rôles système
 * (templates tenantId=null) avec leurs permissions, et crée l'administrateur.
 * Partagé par l'inscription classique et l'inscription via Google.
 */
async function createTenantWithAdmin(opts: NewTenantAdmin): Promise<string> {
  const slug = await uniqueSlug(opts.tenantName);
  const templates = await prisma.role.findMany({
    where: { tenantId: null },
    include: { permissions: true },
  });
  if (templates.length === 0) {
    throw badRequest(
      "Les rôles système ne sont pas initialisés. Lancez le seed (npm run db:seed).",
    );
  }

  // Le formulaire ne demande pas le pays : on le déduit de l'indicatif du
  // numéro WhatsApp, qui est obligatoire et validé. Il fixe la devise, la TVA
  // par défaut et les moyens d'encaissement proposés en caisse.
  const country = countryFromPhone(opts.whatsapp);

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: opts.tenantName,
        slug,
        whatsappPhone: opts.whatsapp,
        countryCode: country?.code ?? null,
        currency: country?.currency ?? 'XOF',
        vatRate: country ? DEFAULT_VAT_BY_COUNTRY[country.code] ?? null : null,
      },
    });
    const branch = await tx.branch.create({
      data: { tenantId: tenant.id, name: opts.branchName, city: '' },
    });

    let adminRoleId: string | null = null;
    for (const tpl of templates) {
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          code: tpl.code,
          name: tpl.name,
          isSystem: true,
          allBranches: tpl.allBranches,
        },
      });
      if (tpl.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: tpl.permissions.map((p) => ({ roleId: role.id, permissionId: p.permissionId })),
        });
      }
      if (tpl.code === 'admin') adminRoleId = role.id;
    }
    if (!adminRoleId) throw badRequest("Rôle administrateur introuvable dans les templates");

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: opts.email,
        username: opts.username ?? null,
        passwordHash: opts.passwordHash,
        firstName: opts.firstName,
        lastName: opts.lastName,
        phone: opts.whatsapp,
        roleId: adminRoleId,
        branches: { create: { branchId: branch.id } },
        emailVerifiedAt: opts.emailVerifiedNow ? new Date() : undefined,
      },
    });

    // Plus d'essai gratuit : l'abonnement est créé bloqué, l'accès au dashboard
    // n'est débloqué qu'à la confirmation du paiement (settleSubscriptionPayment).
    await ensurePendingSubscription(tx, tenant.id, opts.plan);

    return user.id;
  });
}

/** Inscription classique (email + mot de passe) d'une nouvelle entreprise. */
export async function signupTenant(input: SignupInput, meta: RequestMeta): Promise<SessionResult> {
  // Multi-établissement : un même email peut créer plusieurs établissements
  // (l'unicité de l'email est garantie PAR établissement, pas globalement). On
  // ne bloque donc pas si l'email existe déjà dans un autre établissement — la
  // connexion proposera de choisir l'établissement.
  // Exception : l'email du fondateur (accès total) est réservé — on empêche
  // toute usurpation par inscription mot de passe une fois qu'il est utilisé.
  if (isFounderEmail(input.adminEmail)) {
    const exists = await prisma.user.findFirst({
      where: { email: { equals: input.adminEmail, mode: 'insensitive' } },
    });
    if (exists) throw conflict('Cet email est réservé.');
  }
  const passwordHash = await hashPassword(input.adminPassword);
  const userId = await createTenantWithAdmin({
    tenantName: input.tenantName,
    branchName: input.branchName,
    email: input.adminEmail,
    username: input.adminUsername,
    passwordHash,
    firstName: input.adminFirstName,
    lastName: input.adminLastName,
    whatsapp: input.whatsapp,
    plan: input.plan,
  });

  const user = await loadUser({ id: userId });
  if (!user) throw badRequest("Échec de création du compte");

  await recordAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: 'TENANT_SIGNUP',
    entity: 'Tenant',
    entityId: user.tenantId,
    ...meta,
  });

  // Envoi de l'email de confirmation (non bloquant : ne fait pas échouer l'inscription).
  try {
    await sendVerificationEmail(user);
  } catch (err) {
    logger.error({ err }, 'Envoi email de confirmation échoué');
  }

  const session = await issueSession(user, meta);
  return { ...session, user: buildAuthUser(user) };
}

/**
 * Connexion « Se connecter avec Google ». Si l'email Google correspond à un
 * compte existant (créé par mot de passe), on lie le compte automatiquement.
 * Sinon, renvoie `needsSignup` pour que le frontend bascule vers l'inscription
 * Google (sans redemander le consentement Google).
 */
export async function loginWithGoogle(
  idToken: string,
  meta: RequestMeta,
): Promise<LoginResult | { needsSignup: true; email: string; firstName: string; lastName: string }> {
  const profile = await verifyGoogleIdToken(idToken);

  let found = await prisma.user.findFirst({ where: { googleId: profile.googleId }, include: USER_INCLUDE });
  if (!found) {
    // Liaison auto par email UNIQUEMENT si l'email est présent dans un seul
    // établissement (sinon ambigu en multi-tenant → on propose l'inscription).
    const byEmail = await prisma.user.findMany({ where: { email: profile.email }, include: USER_INCLUDE });
    if (byEmail.length === 1) {
      found = await prisma.user.update({
        where: { id: byEmail[0].id },
        data: { googleId: profile.googleId, emailVerifiedAt: byEmail[0].emailVerifiedAt ?? new Date() },
        include: USER_INCLUDE,
      });
    }
  }

  if (!found) {
    return { needsSignup: true, email: profile.email, firstName: profile.firstName, lastName: profile.lastName };
  }
  if (!found.isActive) throw unauthorized('Compte désactivé');

  if (found.twoFactorEnabled && found.twoFactorSecret) {
    await recordAudit({ tenantId: found.tenantId, userId: found.id, action: 'LOGIN_2FA_REQUIRED', ...meta });
    return { twoFactorRequired: true, challenge: await signTwoFactorChallenge(found.id) };
  }

  await prisma.user.update({ where: { id: found.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({ tenantId: found.tenantId, userId: found.id, action: 'LOGIN_GOOGLE_SUCCESS', ...meta });

  const session = await issueSession(found, meta);
  return { ...session, user: buildAuthUser(found) };
}

/**
 * Inscription d'une nouvelle entreprise via Google : l'identité (nom, email
 * déjà vérifié) vient du jeton Google, seul le nom de l'établissement est
 * demandé. Un mot de passe aléatoire est généré (jamais communiqué) — le
 * compte reste utilisable via « Mot de passe oublié » si besoin plus tard.
 */
export async function signupWithGoogle(input: GoogleSignupInput, meta: RequestMeta): Promise<SessionResult> {
  const profile = await verifyGoogleIdToken(input.idToken);

  // Un compte Google (googleId) reste lié à UN seul établissement. En revanche
  // l'email peut déjà exister ailleurs (multi-établissement) : on l'autorise.
  const existingByGoogle = await prisma.user.findFirst({ where: { googleId: profile.googleId } });
  if (existingByGoogle) throw conflict('Ce compte Google est déjà lié à un établissement existant');

  const passwordHash = await hashPassword(generateResetToken());
  const userId = await createTenantWithAdmin({
    tenantName: input.tenantName,
    branchName: input.branchName,
    email: profile.email,
    passwordHash,
    firstName: profile.firstName,
    lastName: profile.lastName,
    whatsapp: input.whatsapp,
    plan: input.plan,
    emailVerifiedNow: true,
  });
  await prisma.user.update({
    where: { id: userId },
    data: { googleId: profile.googleId, photoUrl: profile.pictureUrl },
  });

  const user = await loadUser({ id: userId });
  if (!user) throw badRequest("Échec de création du compte");

  await recordAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: 'TENANT_SIGNUP_GOOGLE',
    entity: 'Tenant',
    entityId: user.tenantId,
    ...meta,
  });

  const session = await issueSession(user, meta);
  return { ...session, user: buildAuthUser(user) };
}

type UserWithCtxRow = NonNullable<UserWithCtx>;

/** Finalise une connexion réussie : renvoie un défi 2FA si activé, sinon la session. */
async function finalizeLogin(user: UserWithCtxRow, meta: RequestMeta): Promise<LoginResult> {
  // 2FA active : on n'ouvre PAS de session ; on renvoie un défi à compléter.
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    await recordAudit({ tenantId: user.tenantId, userId: user.id, action: 'LOGIN_2FA_REQUIRED', ...meta });
    return { twoFactorRequired: true, challenge: await signTwoFactorChallenge(user.id) };
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({ tenantId: user.tenantId, userId: user.id, action: 'LOGIN_SUCCESS', ...meta });
  const session = await issueSession(user, meta);
  return { ...session, user: buildAuthUser(user) };
}

/** Incrémente le compteur d'échec d'un compte et le verrouille au seuil atteint. */
async function registerFailedAttempt(user: UserWithCtxRow, meta: RequestMeta): Promise<void> {
  const failed = user.failedLoginCount + 1;
  const reachedLimit = failed >= env.MAX_FAILED_LOGINS;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: reachedLimit ? 0 : failed,
      lockedUntil: reachedLimit ? new Date(Date.now() + env.ACCOUNT_LOCK_MINUTES * 60 * 1000) : null,
    },
  });
  await recordAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: reachedLimit ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
    ...meta,
  });
}

/**
 * Connexion par email OU nom d'utilisateur + mot de passe, avec verrouillage.
 * Multi-tenant : un même email peut exister dans plusieurs établissements. On
 * valide le mot de passe contre chaque compte correspondant ; si plusieurs
 * établissements correspondent, on renvoie la liste pour que l'utilisateur
 * choisisse (2ᵉ étape sécurisée via `loginSelectTenant`).
 */
export async function login(input: LoginInput, meta: RequestMeta): Promise<LoginOrSelect> {
  const candidates = await prisma.user.findMany({
    where: { OR: [{ email: input.identifier }, { username: input.identifier }] },
    include: USER_INCLUDE,
  });
  // Réponse identique si aucun compte (anti-énumération).
  if (candidates.length === 0) throw unauthorized('Identifiants invalides');

  const now = new Date();
  const matched: UserWithCtxRow[] = [];
  let anyLocked = false;
  for (const c of candidates) {
    if (!c.isActive) continue;
    if (c.lockedUntil && c.lockedUntil > now) {
      anyLocked = true;
      continue; // compte verrouillé : exclu de la connexion
    }
    // eslint-disable-next-line no-await-in-loop
    if (await verifyPassword(c.passwordHash, input.password)) matched.push(c);
  }

  if (matched.length === 0) {
    // Mot de passe faux pour tous : on incrémente les compteurs d'échec.
    const active = candidates.filter((c) => c.isActive && !(c.lockedUntil && c.lockedUntil > now));
    await Promise.all(active.map((c) => registerFailedAttempt(c, meta)));
    if (active.length === 0 && anyLocked) {
      throw locked('Compte temporairement verrouillé suite à trop de tentatives. Réessayez plus tard.');
    }
    throw unauthorized('Identifiants invalides');
  }

  // Comptes validés : on remet à zéro leurs compteurs d'échec.
  await prisma.user.updateMany({
    where: { id: { in: matched.map((m) => m.id) } },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  if (matched.length === 1) {
    return finalizeLogin(matched[0], meta);
  }

  // Plusieurs établissements pour ce compte : on demande lequel activer.
  const selectionToken = await signLoginSelection(matched.map((m) => m.id));
  return {
    chooseEstablishment: matched
      .map((m) => ({ tenantId: m.tenantId, tenantName: m.tenant.name }))
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName)),
    selectionToken,
  };
}

/**
 * 2ᵉ étape de connexion multi-établissement : échange le jeton de sélection +
 * l'établissement choisi contre une session (ou un défi 2FA). La sélection est
 * bornée aux comptes dont le mot de passe a déjà été validé à l'étape 1.
 */
export async function loginSelectTenant(
  selectionToken: string,
  tenantId: string,
  meta: RequestMeta,
): Promise<LoginResult> {
  let eligibleIds: string[];
  try {
    eligibleIds = await verifyLoginSelection(selectionToken);
  } catch {
    throw unauthorized('Session de sélection expirée. Reconnectez-vous.');
  }
  const user = await prisma.user.findFirst({
    where: { id: { in: eligibleIds }, tenantId },
    include: USER_INCLUDE,
  });
  if (!user || !user.isActive) throw unauthorized('Établissement invalide');
  return finalizeLogin(user, meta);
}

/** 2ᵉ étape de connexion : valide le code TOTP et ouvre la session. */
export async function loginTwoFactor(
  challenge: string,
  code: string,
  meta: RequestMeta,
): Promise<SessionResult> {
  let userId: string;
  try {
    userId = await verifyTwoFactorChallenge(challenge);
  } catch {
    throw unauthorized('Session de vérification expirée. Reconnectez-vous.');
  }
  const found = await loadUser({ id: userId });
  if (!found || !found.isActive || !found.twoFactorEnabled || !found.twoFactorSecret) {
    throw unauthorized('Vérification 2FA impossible');
  }
  const secret = decryptSecret(found.twoFactorSecret);
  if (!verifyTotp(code, secret)) {
    await recordAudit({ tenantId: found.tenantId, userId: found.id, action: 'LOGIN_2FA_FAILED', ...meta });
    throw unauthorized('Code de vérification invalide');
  }
  await prisma.user.update({ where: { id: found.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({ tenantId: found.tenantId, userId: found.id, action: 'LOGIN_SUCCESS', ...meta });
  const session = await issueSession(found, meta);
  return { ...session, user: buildAuthUser(found) };
}

/* ----------------------------- 2FA (TOTP) ----------------------------- */

export async function getTwoFactorStatus(userId: string): Promise<{ enabled: boolean }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } });
  return { enabled: u?.twoFactorEnabled ?? false };
}

/** Génère un secret (non encore activé) et renvoie le QR à scanner. */
export async function startTwoFactorSetup(
  userId: string,
): Promise<{ qrDataUrl: string; secret: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();
  // Ne jamais réinitialiser en silence une 2FA déjà active : sans ce garde,
  // ouvrir la page de configuration remplacerait le secret et remettrait
  // `twoFactorEnabled` à false, désactivant de fait la protection existante.
  // La reconfiguration passe donc par une désactivation explicite (mot de passe
  // + code, cf. disableTwoFactor).
  if (user.twoFactorEnabled) {
    throw badRequest(
      'La double authentification est déjà activée. Désactivez-la d\'abord pour la reconfigurer.',
    );
  }
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: encryptSecret(secret), twoFactorEnabled: false },
  });
  const url = otpauthURL(secret, user.email);
  return { qrDataUrl: await qrDataUrl(url), secret };
}

/** Confirme l'activation après vérification d'un premier code. */
export async function enableTwoFactor(userId: string, code: string, meta: RequestMeta): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) throw badRequest("Configuration 2FA non initiée");
  if (!verifyTotp(code, decryptSecret(user.twoFactorSecret))) throw badRequest('Code invalide');
  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  await recordAudit({ tenantId: user.tenantId, userId, action: '2FA_ENABLED', ...meta });
}

/** Désactive la 2FA (exige mot de passe + code valides). */
export async function disableTwoFactor(
  userId: string,
  password: string,
  code: string,
  meta: RequestMeta,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();
  if (!(await verifyPassword(user.passwordHash, password))) throw badRequest('Mot de passe incorrect');
  if (!user.twoFactorSecret || !verifyTotp(code, decryptSecret(user.twoFactorSecret))) {
    throw badRequest('Code invalide');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  await recordAudit({ tenantId: user.tenantId, userId, action: '2FA_DISABLED', ...meta });
}

/** Rotation du refresh token avec détection de rejeu (token volé). */
export async function refresh(oldToken: string, meta: RequestMeta): Promise<SessionResult> {
  const tokenHash = hashRefreshToken(oldToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) throw unauthorized('Session invalide');

  if (existing.revokedAt) {
    // Rejeu d'un token déjà révoqué : compromission probable → révoquer la famille.
    await prisma.refreshToken.updateMany({
      where: { family: existing.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const u = await prisma.user.findUnique({ where: { id: existing.userId } });
    if (u) {
      await recordAudit({
        tenantId: u.tenantId,
        userId: u.id,
        action: 'SECURITY_REFRESH_REUSE_DETECTED',
        ...meta,
      });
    }
    throw unauthorized('Session compromise détectée. Reconnectez-vous.');
  }

  if (existing.expiresAt < new Date()) throw unauthorized('Session expirée');

  const user = await loadUser({ id: existing.userId });
  if (!user || !user.isActive) throw unauthorized('Session invalide');

  const newToken = generateRefreshToken();
  const newHash = hashRefreshToken(newToken);
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBy: newHash },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newHash,
        family: existing.family,
        expiresAt: refreshExpiry(),
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      },
    }),
  ]);

  const accessToken = await signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    roleId: user.roleId,
  });
  return { accessToken, refreshToken: newToken, user: buildAuthUser(user) };
}

/** Déconnexion : révoque le refresh token présenté. */
export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Demande de réinitialisation : réponse silencieuse, email via mailer pluggable. */
export async function forgotPassword(email: string, meta: RequestMeta): Promise<void> {
  // Multi-tenant : l'email peut correspondre à plusieurs établissements. On
  // génère un lien de réinitialisation PAR compte et on envoie un seul email
  // regroupant les liens (par établissement).
  const users = await prisma.user.findMany({ where: { email }, include: { tenant: true } });
  if (users.length === 0) return; // ne révèle pas l'existence du compte

  const links: { tenantName: string; link: string }[] = [];
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  for (const user of users) {
    const token = generateResetToken();
    // eslint-disable-next-line no-await-in-loop
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: hashRefreshToken(token), resetTokenExpiresAt: expires },
    });
    links.push({ tenantName: user.tenant.name, link: `${appOrigin}/reset-password?token=${token}` });
    // eslint-disable-next-line no-await-in-loop
    await recordAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      ...meta,
    });
  }

  const single = links.length === 1;
  const textBody = single
    ? `Bonjour,\n\nVous avez demandé à réinitialiser votre mot de passe.\nCliquez sur ce lien (valable 15 minutes) :\n${links[0].link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`
    : `Bonjour,\n\nVotre email gère plusieurs établissements. Choisissez celui dont vous voulez réinitialiser le mot de passe (liens valables 15 minutes) :\n\n${links
        .map((l) => `• ${l.tenantName} : ${l.link}`)
        .join('\n')}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;
  const htmlBody = single
    ? `<p>Bonjour,</p><p>Vous avez demandé à réinitialiser votre mot de passe.</p><p><a href="${links[0].link}">Réinitialiser mon mot de passe</a> (valable 15 minutes)</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`
    : `<p>Bonjour,</p><p>Votre email gère plusieurs établissements. Choisissez celui dont vous voulez réinitialiser le mot de passe (liens valables 15 minutes) :</p><ul>${links
        .map((l) => `<li><a href="${l.link}">${l.tenantName}</a></li>`)
        .join('')}</ul><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`;

  // Non bloquant : un email qui échoue ne doit pas faire échouer la requête.
  try {
    await mailer.send({
      to: email,
      subject: 'Réinitialisation de votre mot de passe OculoSaaS',
      text: textBody,
      html: htmlBody,
    });
  } catch (err) {
    logger.error({ err }, 'Envoi email de réinitialisation échoué');
  }
}

/** Réinitialise le mot de passe et invalide toutes les sessions actives. */
export async function resetPassword(
  token: string,
  newPassword: string,
  meta: RequestMeta,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { resetTokenHash: hashRefreshToken(token), resetTokenExpiresAt: { gt: new Date() } },
  });
  if (!user) throw badRequest('Lien de réinitialisation invalide ou expiré');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await recordAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: 'PASSWORD_RESET_COMPLETED',
    ...meta,
  });
}

/** Vérifie le mot de passe de l'utilisateur courant (déverrouillage d'inactivité). */
export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  return verifyPassword(user.passwordHash, password);
}

/**
 * Changement de mot de passe par l'utilisateur connecté : vérifie l'ancien,
 * enregistre le nouveau, révoque toutes les sessions actives (sécurité), puis
 * ouvre une session fraîche pour l'appareil courant (pas de déconnexion ici).
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  meta: RequestMeta,
): Promise<SessionResult> {
  const user = await loadUser({ id: userId });
  if (!user) throw unauthorized();
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw badRequest('Mot de passe actuel incorrect');
  }
  const newHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  await recordAudit({ tenantId: user.tenantId, userId, action: 'PASSWORD_CHANGED', ...meta });
  const session = await issueSession(user, meta);
  return { ...session, user: buildAuthUser(user) };
}

export async function getCurrentAuthUser(userId: string): Promise<AuthUser | null> {
  const user = await loadUser({ id: userId });
  return user ? buildAuthUser(user) : null;
}

/** Met à jour le profil de l'utilisateur courant (nom, photo). */
export async function updateOwnProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<AuthUser | null> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName ?? undefined,
      lastName: input.lastName ?? undefined,
      photoUrl: input.photoUrl === undefined ? undefined : input.photoUrl || null,
    },
  });
  return getCurrentAuthUser(userId);
}
