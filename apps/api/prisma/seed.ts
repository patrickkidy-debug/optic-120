import { PrismaClient } from '@prisma/client';
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PLAN_CATALOG,
  DEFAULT_PLAN_CODE,
} from '@oculo/shared-types';

const prisma = new PrismaClient();

async function seedPlans() {
  for (const p of PLAN_CATALOG) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        priceMonthly: p.priceMonthly,
        trialDays: p.trialDays,
        maxUsers: p.maxUsers,
        maxBranches: p.maxBranches,
        maxPatients: p.maxPatients,
        maxSales: p.maxSales,
        features: p.features,
        sortOrder: p.sortOrder,
        isActive: true,
      },
      update: {
        name: p.name,
        description: p.description,
        priceMonthly: p.priceMonthly,
        trialDays: p.trialDays,
        maxUsers: p.maxUsers,
        maxBranches: p.maxBranches,
        maxPatients: p.maxPatients,
        maxSales: p.maxSales,
        features: p.features,
        sortOrder: p.sortOrder,
        isActive: true,
      },
    });
  }
  console.log(`✔ ${PLAN_CATALOG.length} offres d'abonnement seedées`);

  // Désactive les anciennes offres (ex. essai gratuit "Découverte" / "Premium"
  // renommée "Growth") : conservées pour les abonnements existants qui y
  // référent encore, mais plus proposées à la souscription.
  const currentCodes = PLAN_CATALOG.map((p) => p.code);
  const deactivated = await prisma.subscriptionPlan.updateMany({
    where: { code: { notIn: currentCodes }, isActive: true },
    data: { isActive: false },
  });
  if (deactivated.count > 0) {
    console.log(`✔ ${deactivated.count} ancienne(s) offre(s) désactivée(s)`);
  }
}

/**
 * Donne un abonnement (bloqué, en attente de paiement) aux tenants existants
 * qui n'en ont pas encore. Plus d'essai gratuit : seul un paiement confirmé
 * débloque l'accès.
 */
async function backfillPendingSubscriptions() {
  const plan =
    (await prisma.subscriptionPlan.findUnique({ where: { code: DEFAULT_PLAN_CODE } })) ??
    (await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }));
  if (!plan) return;
  const tenants = await prisma.tenant.findMany({ where: { subscription: { is: null } } });
  for (const t of tenants) {
    await prisma.subscription.create({
      data: {
        tenantId: t.id,
        planId: plan.id,
        status: 'TRIALING',
        currentPeriodEnd: new Date(Date.now() - 1000),
        trialEndsAt: null,
      },
    });
  }
  if (tenants.length > 0) console.log(`✔ ${tenants.length} abonnement(s) créé(s) (backfill, en attente de paiement)`);
}

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

/**
 * Resynchronise les rôles SYSTÈME déjà clonés dans les tenants existants avec
 * la matrice de permissions à jour. Idempotent : permet de propager de
 * nouvelles permissions (ex : modules Phase 2) aux tenants créés avant l'ajout.
 */
async function resyncTenantSystemRoles() {
  const perms = await prisma.permission.findMany();
  const idByKey = new Map(perms.map((p) => [`${p.module}.${p.action}`, p.id]));

  const roles = await prisma.role.findMany({
    where: { tenantId: { not: null }, isSystem: true },
  });
  let updated = 0;
  for (const role of roles) {
    const keys = DEFAULT_ROLE_PERMISSIONS[role.code];
    if (!keys) continue;
    const data = keys
      .map((k) => idByKey.get(k))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: role.id, permissionId }));
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (data.length > 0) {
      await prisma.rolePermission.createMany({ data, skipDuplicates: true });
    }
    updated++;
  }
  console.log(`✔ ${updated} rôle(s) système de tenants existants resynchronisés`);
}

async function main() {
  console.log('🌱 Seed OculoSaaS…');
  await seedPermissions();
  await seedSystemRoles();
  await resyncTenantSystemRoles();
  await seedPlans();
  await backfillPendingSubscriptions();
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
