import type { AuthUser, SignupInput, LoginInput, ProfileUpdateInput } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { signAccessToken, signTwoFactorChallenge, verifyTwoFactorChallenge } from '../../lib/jwt.js';
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
import { ensureTrialSubscription } from '../billing/billing.service.js';
import { env, appOrigin } from '../../config/env.js';
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
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    roleId: user.roleId,
    roleName: user.role.name,
    permissions: user.role.permissions.map(
      (rp) => `${rp.permission.module}.${rp.permission.action}`,
    ),
    branchIds: user.branches.map((b) => b.branchId),
    allBranches: user.role.allBranches,
    tenantName: user.tenant.name,
    tenantLogoUrl: user.tenant.logoUrl,
  };
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

/** Résultat de login : soit une session, soit un défi 2FA à compléter. */
export type LoginResult = SessionResult | { twoFactorRequired: true; challenge: string };

/**
 * Inscription d'une nouvelle entreprise : crée le tenant, sa succursale par
 * défaut, clone les 12 rôles système (templates tenantId=null) avec leurs
 * permissions, crée l'administrateur, et ouvre une session.
 */
export async function signupTenant(input: SignupInput, meta: RequestMeta): Promise<SessionResult> {
  const existing = await prisma.user.findFirst({ where: { email: input.adminEmail } });
  if (existing) throw conflict('Un compte existe déjà avec cet email');

  const slug = await uniqueSlug(input.tenantName);
  const passwordHash = await hashPassword(input.adminPassword);

  const templates = await prisma.role.findMany({
    where: { tenantId: null },
    include: { permissions: true },
  });
  if (templates.length === 0) {
    throw badRequest(
      "Les rôles système ne sont pas initialisés. Lancez le seed (npm run db:seed).",
    );
  }

  const userId = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: input.tenantName, slug },
    });
    const branch = await tx.branch.create({
      data: { tenantId: tenant.id, name: input.branchName, city: '' },
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
        email: input.adminEmail,
        username: input.adminUsername ?? null,
        passwordHash,
        firstName: input.adminFirstName,
        lastName: input.adminLastName,
        roleId: adminRoleId,
        branches: { create: { branchId: branch.id } },
      },
    });

    // Abonnement d'essai (offre Découverte) à l'inscription.
    await ensureTrialSubscription(tx, tenant.id);

    return user.id;
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

  const session = await issueSession(user, meta);
  return { ...session, user: buildAuthUser(user) };
}

/** Connexion par email OU nom d'utilisateur + mot de passe, avec verrouillage. */
export async function login(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
  const found = await prisma.user.findFirst({
    where: { OR: [{ email: input.identifier }, { username: input.identifier }] },
    include: USER_INCLUDE,
  });

  // Réponse identique si l'utilisateur n'existe pas (anti-énumération).
  if (!found) throw unauthorized('Identifiants invalides');

  if (found.lockedUntil && found.lockedUntil > new Date()) {
    throw locked('Compte temporairement verrouillé suite à trop de tentatives. Réessayez plus tard.');
  }
  if (!found.isActive) throw unauthorized('Compte désactivé');

  const ok = await verifyPassword(found.passwordHash, input.password);
  if (!ok) {
    const failed = found.failedLoginCount + 1;
    const reachedLimit = failed >= env.MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: found.id },
      data: {
        failedLoginCount: reachedLimit ? 0 : failed,
        lockedUntil: reachedLimit
          ? new Date(Date.now() + env.ACCOUNT_LOCK_MINUTES * 60 * 1000)
          : null,
      },
    });
    await recordAudit({
      tenantId: found.tenantId,
      userId: found.id,
      action: reachedLimit ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
      ...meta,
    });
    throw unauthorized('Identifiants invalides');
  }

  // Mot de passe correct : on réinitialise les compteurs d'échec.
  await prisma.user.update({
    where: { id: found.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  // 2FA active : on n'ouvre PAS de session ; on renvoie un défi à compléter.
  if (found.twoFactorEnabled && found.twoFactorSecret) {
    await recordAudit({ tenantId: found.tenantId, userId: found.id, action: 'LOGIN_2FA_REQUIRED', ...meta });
    return { twoFactorRequired: true, challenge: await signTwoFactorChallenge(found.id) };
  }

  await prisma.user.update({ where: { id: found.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({ tenantId: found.tenantId, userId: found.id, action: 'LOGIN_SUCCESS', ...meta });

  const session = await issueSession(found, meta);
  return { ...session, user: buildAuthUser(found) };
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
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) return; // ne révèle pas l'existence du compte

  const token = generateResetToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: hashRefreshToken(token),
      resetTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const link = `${appOrigin}/reset-password?token=${token}`;
  await mailer.send({
    to: email,
    subject: 'Réinitialisation de votre mot de passe OculoSaaS',
    text: `Bonjour,\n\nVous avez demandé à réinitialiser votre mot de passe.\nCliquez sur ce lien (valable 15 minutes) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    html: `<p>Bonjour,</p><p>Vous avez demandé à réinitialiser votre mot de passe.</p><p><a href="${link}">Réinitialiser mon mot de passe</a> (valable 15 minutes)</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
  });

  await recordAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    ...meta,
  });
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
