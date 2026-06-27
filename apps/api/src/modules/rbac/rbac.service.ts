import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error.js';

const PROTECTED_ROLES = new Set(['admin', 'super_admin']);

function roleCode(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return `${base || 'role'}-${randomBytes(3).toString('hex')}`;
}

async function permIdMap(): Promise<Map<string, string>> {
  const perms = await prisma.permission.findMany();
  return new Map(perms.map((p) => [`${p.module}.${p.action}`, p.id]));
}

function toPermKeys(role: {
  permissions: { permission: { module: string; action: string } }[];
}): string[] {
  return role.permissions.map((rp) => `${rp.permission.module}.${rp.permission.action}`);
}

export async function listRoles(tenantId: string) {
  const roles = await prisma.role.findMany({
    where: { tenantId },
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
  return roles.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    isSystem: r.isSystem,
    isCustom: r.isCustom,
    allBranches: r.allBranches,
    userCount: r._count.users,
    permissions: toPermKeys(r),
  }));
}

export async function createRole(tenantId: string, name: string, permKeys: string[]) {
  const idByKey = await permIdMap();
  const data = permKeys
    .map((k) => idByKey.get(k))
    .filter((id): id is string => Boolean(id))
    .map((permissionId) => ({ permissionId }));

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        tenantId,
        code: roleCode(name),
        name,
        isCustom: true,
        isSystem: false,
        allBranches: false,
      },
    });
    if (data.length > 0) {
      await tx.rolePermission.createMany({
        data: data.map((d) => ({ roleId: role.id, permissionId: d.permissionId })),
      });
    }
    return role;
  });
}

export async function updateRole(
  tenantId: string,
  id: string,
  input: { name?: string; permissions?: string[] },
) {
  const role = await prisma.role.findFirst({ where: { id, tenantId } });
  if (!role) throw notFound('Rôle introuvable');
  if (PROTECTED_ROLES.has(role.code)) {
    throw forbidden('Ce rôle système ne peut pas être modifié');
  }

  if (input.permissions) {
    const idByKey = await permIdMap();
    const data = input.permissions
      .map((k) => idByKey.get(k))
      .filter((pid): pid is string => Boolean(pid))
      .map((permissionId) => ({ roleId: id, permissionId }));
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      ...(data.length > 0 ? [prisma.rolePermission.createMany({ data })] : []),
    ]);
  }
  if (input.name && role.isCustom) {
    await prisma.role.update({ where: { id }, data: { name: input.name } });
  }
  return listRoles(tenantId).then((roles) => roles.find((r) => r.id === id));
}

export async function deleteRole(tenantId: string, id: string) {
  const role = await prisma.role.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw notFound('Rôle introuvable');
  if (!role.isCustom) throw forbidden('Un rôle système ne peut pas être supprimé');
  if (role._count.users > 0) throw conflict('Ce rôle est attribué à des utilisateurs');
  await prisma.role.delete({ where: { id } });
}

export async function ensureRoleInTenant(tenantId: string, roleId: string): Promise<void> {
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw badRequest('Rôle invalide');
}
