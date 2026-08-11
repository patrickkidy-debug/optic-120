#!/usr/bin/env node
/**
 * Réinitialise l'historique de vente ET de clients d'un établissement,
 * en conservant intégralement le stock (produits, quantités, mouvements).
 *
 * Supprime définitivement, pour le tenant de l'email donné :
 *   - Payment, SaleItem, Sale (tout l'historique de vente/devis/facture)
 *   - OpticalPrescription (ordonnances, rattachées aux clients)
 *   - Customer (fiches clients)
 * Détache (sans supprimer) :
 *   - LensOrder.customerId, Repair.customerId → mis à null (les commandes
 *     verres / réparations elles-mêmes sont conservées)
 * NE TOUCHE PAS : Product, StockItem, StockMovement, Branch, User, Role,
 * Tenant, Subscription, Insurer, AuditLog.
 *
 * Usage :
 *   node scripts/reset-tenant-history.cjs <email>              # dry-run (affiche les compteurs, ne supprime rien)
 *   node scripts/reset-tenant-history.cjs <email> --confirm    # exécute réellement, IRRÉVERSIBLE
 */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.argv[2];
  const confirm = process.argv.includes('--confirm');

  if (!email) {
    console.error('Usage: node scripts/reset-tenant-history.cjs <email> [--confirm]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, tenantId: true, tenant: { select: { name: true } } },
    });
    if (!user) {
      console.error(`Aucun utilisateur trouvé pour l'email "${email}".`);
      process.exit(1);
    }
    const { tenantId } = user;
    console.log(`Établissement : ${user.tenant.name} (tenantId ${tenantId})`);
    console.log(`Compte : ${user.email}`);
    console.log('');

    const [saleCount, saleItemCount, paymentCount, rxCount, customerCount, lensOrderCount, repairCount] =
      await Promise.all([
        prisma.sale.count({ where: { tenantId } }),
        prisma.saleItem.count({ where: { sale: { tenantId } } }),
        prisma.payment.count({ where: { tenantId } }),
        prisma.opticalPrescription.count({ where: { tenantId } }),
        prisma.customer.count({ where: { tenantId } }),
        prisma.lensOrder.count({ where: { tenantId, customerId: { not: null } } }),
        prisma.repair.count({ where: { tenantId, customerId: { not: null } } }),
      ]);

    console.log('À supprimer définitivement :');
    console.log(`  Ventes/devis (Sale)         : ${saleCount}`);
    console.log(`  Lignes de vente (SaleItem)  : ${saleItemCount}`);
    console.log(`  Paiements (Payment)         : ${paymentCount}`);
    console.log(`  Ordonnances (Prescription)  : ${rxCount}`);
    console.log(`  Clients (Customer)          : ${customerCount}`);
    console.log('');
    console.log('À détacher (conservés, client retiré) :');
    console.log(`  Commandes de verres (LensOrder) : ${lensOrderCount}`);
    console.log(`  Réparations (Repair)            : ${repairCount}`);
    console.log('');
    console.log('NE SERA PAS TOUCHÉ : Product, StockItem, StockMovement (stock intact).');
    console.log('');

    if (!confirm) {
      console.log('Dry-run — aucune suppression effectuée. Relancer avec --confirm pour exécuter.');
      return;
    }

    console.log('⚠️  --confirm reçu. Suppression en cours (transaction atomique)...');
    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.saleItem.deleteMany({ where: { sale: { tenantId } } });
      await tx.sale.deleteMany({ where: { tenantId } });
      await tx.opticalPrescription.deleteMany({ where: { tenantId } });
      await tx.lensOrder.updateMany({ where: { tenantId, customerId: { not: null } }, data: { customerId: null } });
      await tx.repair.updateMany({ where: { tenantId, customerId: { not: null } }, data: { customerId: null } });
      await tx.customer.deleteMany({ where: { tenantId } });
    });

    console.log('Terminé. Historique de vente et de clients supprimé, stock intact.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
