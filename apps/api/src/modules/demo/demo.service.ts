import { SubscriptionStatus } from '@oculo/shared-types';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { createTenantSkeleton } from '../auth/auth.service.js';
import { notFound } from '../../lib/http-error.js';
import { seedSampleBusinessData, type SampleDataManifest } from './sample-data.js';

export const DEMO_TENANT_NAME = 'Optique Vision Plus';

/**
 * Crée un établissement démo complet ("Optique Vision Plus") avec produits,
 * stock (dont ruptures/stock faible), clients, ordonnances, ventes et
 * paiements factices cohérents entre eux. Réutilise `createTenantSkeleton`
 * (mêmes 12 rôles clonés + branche) partagé avec l'inscription classique.
 */
export async function createDemoTenant(opts: {
  tenantName?: string;
  branchName: string;
  email: string;
  username?: string | null;
  passwordHash: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
}): Promise<string> {
  const userId = await prisma.$transaction(
    async (tx) => {
      const skeleton = await createTenantSkeleton(tx, {
        tenantName: opts.tenantName?.trim() || DEMO_TENANT_NAME,
        branchName: opts.branchName,
        whatsapp: opts.whatsapp,
        isDemo: true,
      });

      const user = await tx.user.create({
        data: {
          tenantId: skeleton.tenantId,
          email: opts.email,
          username: opts.username ?? null,
          passwordHash: opts.passwordHash,
          firstName: opts.firstName,
          lastName: opts.lastName,
          phone: opts.whatsapp,
          roleId: skeleton.adminRoleId,
          branches: { create: { branchId: skeleton.branchId } },
          // Compte démo : pas besoin de vérification d'email pour explorer.
          emailVerifiedAt: new Date(),
        },
      });

      // Abonnement factice ACTIF (échéance lointaine) : aucune bannière de
      // paiement ne doit interrompre la visite guidée.
      const plan = await tx.subscriptionPlan.findFirst({ where: { code: 'STANDARD', isActive: true } });
      if (plan) {
        await tx.subscription.create({
          data: {
            tenantId: skeleton.tenantId,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            autoRenew: false,
          },
        });
      }

      await seedSampleBusinessData(tx, skeleton.tenantId, skeleton.branchId, user.id);

      return user.id;
    },
    { timeout: 25000, maxWait: 10000 },
  );

  return userId;
}

/**
 * Supprime toutes les données factices d'un établissement démo et repasse
 * `isDemo` à false — appelé juste avant le premier paiement réel (le tenant
 * démo devient le tenant réel du prospect, reparti d'un établissement vide).
 * Ordre des suppressions contraint par les clés étrangères (mêmes garanties
 * que `resetTenantHistoryByEmail`, dont ce code s'inspire directement).
 */
export async function purgeDemoData(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { isDemo: true } });
  if (!tenant) throw notFound('Établissement introuvable');
  if (!tenant.isDemo) return; // déjà converti (ou jamais démo) : rien à faire, idempotent

  await prisma.$transaction(
    async (tx) => {
      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.stockMovement.deleteMany({ where: { tenantId } });
      await tx.saleItem.deleteMany({ where: { sale: { tenantId } } });
      await tx.sale.deleteMany({ where: { tenantId } });
      await tx.stockItem.deleteMany({ where: { tenantId } });
      await tx.opticalPrescription.deleteMany({ where: { tenantId } });
      await tx.customer.deleteMany({ where: { tenantId } });
      await tx.product.deleteMany({ where: { tenantId } });
      await tx.supplier.deleteMany({ where: { tenantId } });
      // L'échéance passe à "maintenant" : le prochain paiement réel démarre sa
      // période à zéro, sans hériter de l'échéance lointaine du faux abonnement démo.
      await tx.subscription.updateMany({ where: { tenantId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
      await tx.demoProgress.deleteMany({ where: { tenantId } });
      await tx.tenant.update({ where: { id: tenantId }, data: { isDemo: false } });
    },
    { timeout: 15000 },
  );
}

/**
 * Efface les données d'exemple pré-remplies sur un compte RÉEL à l'inscription
 * (pour que le prospect comprenne le logiciel pendant la visite guidée), une
 * fois la visite terminée ou passée. À la différence de `purgeDemoData` (qui
 * vide tout un tenant isDemo entièrement factice), ici l'utilisateur peut déjà
 * avoir saisi ses propres vraies données pendant la visite — on ne supprime
 * donc QUE les identifiants listés dans `DemoProgress.seedManifest` (jamais
 * par simple tenantId), dans le même ordre FK-safe que `purgeDemoData`.
 * Idempotent : sans manifeste (déjà purgé, ou tenant jamais semé), ne fait rien.
 */
export async function purgeSampleData(tenantId: string): Promise<void> {
  const progress = await prisma.demoProgress.findUnique({ where: { tenantId }, select: { seedManifest: true } });
  const manifest = progress?.seedManifest as SampleDataManifest | null | undefined;
  if (!manifest) return;

  await prisma.$transaction(
    async (tx) => {
      await tx.payment.deleteMany({ where: { tenantId, id: { in: manifest.paymentIds } } });
      await tx.stockMovement.deleteMany({ where: { tenantId, id: { in: manifest.stockMovementIds } } });
      await tx.saleItem.deleteMany({ where: { id: { in: manifest.saleItemIds }, sale: { tenantId } } });
      await tx.sale.deleteMany({ where: { tenantId, id: { in: manifest.saleIds } } });
      await tx.stockItem.deleteMany({ where: { tenantId, id: { in: manifest.stockItemIds } } });
      await tx.opticalPrescription.deleteMany({ where: { tenantId, id: { in: manifest.prescriptionIds } } });
      await tx.customer.deleteMany({ where: { tenantId, id: { in: manifest.customerIds } } });
      await tx.product.deleteMany({ where: { tenantId, id: { in: manifest.productIds } } });
      await tx.supplier.deleteMany({ where: { tenantId, id: { in: manifest.supplierIds } } });
      await tx.demoProgress.update({ where: { tenantId }, data: { seedManifest: Prisma.JsonNull } });
    },
    { timeout: 15000 },
  );
}

/* ------------------------------ Progression ------------------------------ */

export async function getDemoProgress(tenantId: string) {
  return prisma.demoProgress.findUnique({ where: { tenantId } });
}

export async function saveDemoProgress(
  tenantId: string,
  data: { currentStepId?: string | null; completedAt?: Date | null; skipped?: boolean },
) {
  return prisma.demoProgress.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}
