/**
 * Seed d'un compte administrateur + son entreprise (tenant), à partir de
 * variables d'environnement. Reproduit le flux `signupTenant` de l'API pour
 * bootstrapper une base de production sans passer par la page d'inscription.
 *
 * Prérequis : le seed principal doit déjà avoir tourné (`npm run db:seed`)
 * pour que les rôles système (templates) et les offres existent.
 *
 * Usage (variables d'env) :
 *   ADMIN_EMAIL=admin@exemple.com \
 *   ADMIN_PASSWORD='MotDePasseFort!' \
 *   TENANT_NAME="Ma Clinique" \
 *   npm run db:seed:admin --workspace @oculo/api
 *
 * Variables optionnelles : ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_USERNAME,
 * BRANCH_NAME. Idempotent : ne fait rien si l'email admin existe déjà.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

// Mêmes paramètres Argon2id que apps/api/src/lib/password.ts.
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`❌ Variable d'environnement requise manquante : ${name}`);
    process.exit(1);
  }
  return v.trim();
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'clinique'
  );
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let i = 1;
  while (await prisma.tenant.findUnique({ where: { slug: candidate } })) {
    candidate = `${root}-${i++}`;
  }
  return candidate;
}

async function main() {
  const adminEmail = required('ADMIN_EMAIL').toLowerCase();
  const adminPassword = required('ADMIN_PASSWORD');
  const tenantName = required('TENANT_NAME');
  const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'Admin';
  const lastName = process.env.ADMIN_LAST_NAME?.trim() || tenantName;
  const username = process.env.ADMIN_USERNAME?.trim() || null;
  const branchName = process.env.BRANCH_NAME?.trim() || 'Siège';

  console.log(`🌱 Seed admin pour « ${tenantName} » (${adminEmail})…`);

  const existing = await prisma.user.findFirst({ where: { email: adminEmail } });
  if (existing) {
    console.log('ℹ️  Un compte existe déjà avec cet email — rien à faire.');
    return;
  }

  const templates = await prisma.role.findMany({
    where: { tenantId: null },
    include: { permissions: true },
  });
  if (templates.length === 0) {
    console.error(
      "❌ Rôles système absents. Lance d'abord le seed principal : npm run db:seed --workspace @oculo/api",
    );
    process.exit(1);
  }

  const slug = await uniqueSlug(tenantName);
  const passwordHash = await hash(adminPassword, ARGON2_OPTIONS);

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: tenantName, slug } });
    const branch = await tx.branch.create({
      data: { tenantId: tenant.id, name: branchName, city: '' },
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
    if (!adminRoleId) throw new Error("Rôle 'admin' introuvable dans les templates système");

    await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        username,
        passwordHash,
        firstName,
        lastName,
        roleId: adminRoleId,
        branches: { create: { branchId: branch.id } },
      },
    });

    // Abonnement d'essai (offre Découverte), comme à l'inscription.
    const trial = await tx.subscriptionPlan.findFirst({ where: { code: 'TRIAL' } });
    if (trial) {
      const end = new Date(Date.now() + trial.trialDays * 24 * 60 * 60 * 1000);
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: trial.id,
          status: 'TRIALING',
          currentPeriodEnd: end,
          trialEndsAt: end,
        },
      });
    }
  });

  console.log(`✅ Admin créé. Connecte-toi avec ${adminEmail} sur le frontend.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed admin échoué :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
