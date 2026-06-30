import { randomInt } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/password.js';
import { badRequest, conflict, notFound } from '../../lib/http-error.js';
import { assertWithinLimit } from '../billing/billing.service.js';
import type { UserCreateInput } from '@oculo/shared-types';

// Alphabet sans caractères ambigus (pas de 0/O, 1/l/I) : lisible à l'oral/WhatsApp.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generateTempPassword(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}

export async function listUsers(tenantId: string) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    include: { role: true, branches: { include: { branch: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return users.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    username: u.username,
    phone: u.phone,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    role: { id: u.role.id, name: u.role.name, code: u.role.code },
    branches: u.branches.map((b) => ({ id: b.branch.id, name: b.branch.name })),
  }));
}

async function assertBranchesInTenant(tenantId: string, branchIds: string[]): Promise<void> {
  if (branchIds.length === 0) return;
  const count = await prisma.branch.count({ where: { tenantId, id: { in: branchIds } } });
  if (count !== branchIds.length) throw badRequest('Une ou plusieurs succursales sont invalides');
}

export async function createUser(tenantId: string, input: UserCreateInput) {
  await assertWithinLimit(tenantId, 'users');
  const role = await prisma.role.findFirst({ where: { id: input.roleId, tenantId } });
  if (!role) throw badRequest('Rôle invalide');
  await assertBranchesInTenant(tenantId, input.branchIds);

  const existing = await prisma.user.findFirst({
    where: { tenantId, email: input.email },
  });
  if (existing) throw conflict('Un utilisateur avec cet email existe déjà');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      tenantId,
      email: input.email,
      username: input.username ?? null,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      roleId: input.roleId,
      branches: { create: input.branchIds.map((branchId) => ({ branchId })) },
    },
  });
  return { id: user.id };
}

export async function updateUser(
  tenantId: string,
  id: string,
  input: Partial<UserCreateInput>,
) {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw notFound('Utilisateur introuvable');
  if (input.roleId) {
    const role = await prisma.role.findFirst({ where: { id: input.roleId, tenantId } });
    if (!role) throw badRequest('Rôle invalide');
  }
  if (input.branchIds) {
    await assertBranchesInTenant(tenantId, input.branchIds);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        username: input.username ?? undefined,
        phone: (input as { phone?: string }).phone ?? undefined,
        roleId: input.roleId ?? undefined,
        ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
      },
    });
    if (input.branchIds) {
      await tx.userBranch.deleteMany({ where: { userId: id } });
      if (input.branchIds.length > 0) {
        await tx.userBranch.createMany({
          data: input.branchIds.map((branchId) => ({ userId: id, branchId })),
        });
      }
    }
  });
  return { id };
}

/**
 * Réinitialisation de mot de passe SANS email (l'envoi automatique étant peu
 * fiable selon les boîtes mail) : un administrateur génère un mot de passe
 * temporaire affiché une seule fois à l'écran, à transmettre lui-même
 * (WhatsApp, SMS, en personne...) à l'utilisateur concerné.
 */
export async function resetUserPassword(tenantId: string, id: string): Promise<{ tempPassword: string }> {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw notFound('Utilisateur introuvable');

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return { tempPassword };
}

export async function deactivateUser(tenantId: string, id: string, currentUserId: string) {
  if (id === currentUserId) throw badRequest('Vous ne pouvez pas vous désactiver vous-même');
  const result = await prisma.user.updateMany({
    where: { id, tenantId },
    data: { isActive: false },
  });
  if (result.count === 0) throw notFound('Utilisateur introuvable');
}
