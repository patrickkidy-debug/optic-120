import { PrismaClient } from '@prisma/client';
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
} from '@oculo/shared-types';

const prisma = new PrismaClient();

async function seedPermissions() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { module_action: { module: p.module, action: p.action } },
      create: { module: p.module, action: p.action, label: p.label },
      update: { label: p.label },
    });
  }
  console.log(`✔ ${PERMISSIONS.length} permissions seedées`);
}

async function seedSystemRoles() {
  const perms = await prisma.permission.findMany();
  const idByKey = new Map(perms.map((p) => [`${p.module}.${p.action}`, p.id]));

  for (const r of SYSTEM_ROLES) {
    let role = await prisma.role.findFirst({ where: { tenantId: null, code: r.code } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          tenantId: null,
          code: r.code,
          name: r.label,
          isSystem: true,
          allBranches: r.allBranches,
        },
      });
    } else {
      role = await prisma.role.update({
        where: { id: role.id },
        data: { name: r.label, isSystem: true, allBranches: r.allBranches },
      });
    }

    const keys = DEFAULT_ROLE_PERMISSIONS[r.code] ?? [];
    const data = keys
      .map((k) => idByKey.get(k))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: role!.id, permissionId }));

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (data.length > 0) {
      await prisma.rolePermission.createMany({ data, skipDuplicates: true });
    }
  }
  console.log(`✔ ${SYSTEM_ROLES.length} rôles système (templates) seedés`);
}

async function main() {
  console.log('🌱 Seed OculoSaaS…');
  await seedPermissions();
  await seedSystemRoles();
  console.log('✅ Seed terminé.');
}

main()
  .catch((e) => {
    console.error('❌ Seed échoué :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
