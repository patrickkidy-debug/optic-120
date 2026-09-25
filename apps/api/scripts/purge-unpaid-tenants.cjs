#!/usr/bin/env node
/**
 * Supprime les établissements qui n'ont JAMAIS payé et dont l'accès est
 * inactif ou expiré.
 *
 * Supprimer un établissement supprime EN CASCADE tout ce qui lui appartient :
 * comptes utilisateurs, magasins, clients, ordonnances, produits, stock, ventes,
 * devis, abonnement, factures non payées, journal d'audit. C'est irréversible.
 *
 * Un établissement est candidat seulement s'il remplit TOUTES ces conditions :
 *
 *   1. Jamais payé : aucun paiement d'abonnement réussi, aucune facture réglée
 *      (même partiellement).
 *   2. Inactif ou expiré : abonnement expiré, suspendu ou annulé, période
 *      d'essai terminée, pas d'abonnement du tout, ou tous ses comptes
 *      désactivés.
 *   3. Plus ancien que le délai de grâce (7 jours par défaut). Sans ce délai, on
 *      supprimerait les prospects EN TRAIN de payer : le tunnel d'activation crée
 *      l'espace avec une période déjà échue, qui ne s'ouvre qu'au paiement.
 *   4. Pas un établissement d'opérateur de la console fondateur.
 *   5. Pas un établissement de démonstration (sauf --include-demo).
 *
 * Usage :
 *   node scripts/purge-unpaid-tenants.cjs
 *       Simulation : liste les candidats, ne supprime rien, écrit l'inventaire.
 *
 *   node scripts/purge-unpaid-tenants.cjs --skip-with-data
 *       Idem, en écartant les établissements qui ont saisi des ventes ou des
 *       clients pendant leur essai.
 *
 *   node scripts/purge-unpaid-tenants.cjs --confirm --expected=<N>
 *       Suppression réelle. <N> doit être exactement le nombre affiché par la
 *       simulation : si la base a bougé entre-temps, rien n'est supprimé.
 *
 * Options : --grace-days=<n> (défaut 7), --include-demo, --skip-with-data.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const DAY_MS = 24 * 60 * 60 * 1000;

function arg(name) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const [, value] = hit.split('=');
  return value ?? true;
}

/** Même règle que la console : le statut stocké ne suffit pas. */
function realState(sub, now) {
  if (!sub) return 'none';
  if (sub.status === 'SUSPENDED') return 'suspended';
  if (sub.status === 'CANCELLED') return 'cancelled';
  const expired = sub.currentPeriodEnd.getTime() < now;
  if (sub.status === 'TRIALING') return expired ? 'expired' : 'trialing';
  if (expired) return 'expired';
  return sub.status === 'ACTIVE' ? 'paying' : 'expired';
}

async function main() {
  const confirm = arg('confirm') === true;
  const expected = arg('expected') !== undefined ? Number(arg('expected')) : undefined;
  const graceDays = arg('grace-days') !== undefined ? Number(arg('grace-days')) : 7;
  const includeDemo = arg('include-demo') === true;
  const skipWithData = arg('skip-with-data') === true;

  if (!Number.isFinite(graceDays) || graceDays < 0) {
    console.error('--grace-days doit être un nombre positif.');
    process.exit(1);
  }
  if (confirm && !Number.isInteger(expected)) {
    console.error('--confirm exige --expected=<N>, le nombre affiché par la simulation.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const now = Date.now();
  const cutoff = new Date(now - graceDays * DAY_MS);

  try {
    // Opérateurs : l'établissement de l'équipe OculoSaaS n'est jamais candidat.
    const operatorEmails = new Set(
      [
        ...(process.env.PLATFORM_ADMIN_EMAILS || '').split(','),
        ...(await prisma.platformOperator.findMany({ select: { email: true } })).map((o) => o.email),
      ]
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );

    // Tout établissement ayant un paiement réussi ou une facture réglée, même
    // partiellement, est exclu d'office.
    const [paidByPayment, paidByInvoice] = await Promise.all([
      prisma.subscriptionPayment.findMany({
        where: { status: 'SUCCESS' },
        select: { tenantId: true },
        distinct: ['tenantId'],
      }),
      prisma.subscriptionInvoice.findMany({
        where: { OR: [{ status: { in: ['PAID', 'PARTIALLY_PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'] } }, { amountPaid: { gt: 0 } }] },
        select: { tenantId: true },
        distinct: ['tenantId'],
      }),
    ]);
    const everPaid = new Set([...paidByPayment, ...paidByInvoice].map((r) => r.tenantId));

    const tenants = await prisma.tenant.findMany({
      where: {
        createdAt: { lt: cutoff },
        ...(includeDemo ? {} : { isDemo: false }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isDemo: true,
        whatsappPhone: true,
        contactEmail: true,
        createdAt: true,
        subscription: { select: { status: true, currentPeriodEnd: true, plan: { select: { name: true } } } },
        users: { select: { email: true, isActive: true, lastLoginAt: true } },
        _count: { select: { sales: true, customers: true, products: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const excluded = { paid: 0, active: 0, operator: 0, withData: 0 };
    const candidates = [];

    for (const t of tenants) {
      if (everPaid.has(t.id)) { excluded.paid += 1; continue; }
      if (t.users.some((u) => operatorEmails.has(u.email.toLowerCase()))) { excluded.operator += 1; continue; }

      const state = realState(t.subscription, now);
      const allUsersInactive = t.users.length > 0 && t.users.every((u) => !u.isActive);
      const inactiveOrExpired = ['expired', 'suspended', 'cancelled', 'none'].includes(state) || allUsersInactive;
      if (!inactiveOrExpired) { excluded.active += 1; continue; }

      const hasData = t._count.sales > 0 || t._count.customers > 0;
      if (skipWithData && hasData) { excluded.withData += 1; continue; }

      const lastLogin = t.users
        .map((u) => u.lastLoginAt)
        .filter(Boolean)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

      candidates.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        isDemo: t.isDemo,
        state: allUsersInactive && state === 'trialing' ? 'comptes désactivés' : state,
        plan: t.subscription?.plan.name ?? null,
        createdAt: t.createdAt.toISOString(),
        lastLogin: lastLogin ? lastLogin.toISOString() : null,
        users: t.users.map((u) => u.email),
        whatsapp: t.whatsappPhone,
        email: t.contactEmail,
        sales: t._count.sales,
        customers: t._count.customers,
        products: t._count.products,
        hasData,
      });
    }

    // --- Rapport ---
    const fmt = (d) => (d ? d.slice(0, 10) : 'jamais');
    console.log(`\nÉtablissements examinés (créés avant le ${cutoff.toISOString().slice(0, 10)}) : ${tenants.length}`);
    console.log(`  exclus — ont déjà payé      : ${excluded.paid}`);
    console.log(`  exclus — accès encore actif : ${excluded.active}`);
    console.log(`  exclus — opérateur          : ${excluded.operator}`);
    if (skipWithData) console.log(`  exclus — ont des données    : ${excluded.withData}`);
    console.log(`\nCANDIDATS À LA SUPPRESSION : ${candidates.length}`);
    const withData = candidates.filter((c) => c.hasData);
    if (withData.length) {
      console.log(`  dont ${withData.length} avec des données saisies pendant l'essai (ventes ou clients) — elles seront perdues.`);
    }
    console.log('');
    for (const c of candidates) {
      console.log(
        `  - ${c.name.padEnd(38).slice(0, 38)}  ${c.state.padEnd(18)} créé ${fmt(c.createdAt)}  ` +
          `dernière connexion ${fmt(c.lastLogin)}  ${c.users.length} compte(s)` +
          (c.hasData ? `  [${c.sales} ventes, ${c.customers} clients]` : ''),
      );
    }

    // Inventaire écrit AVANT toute suppression : c'est la seule trace de qui
    // était là, une fois la cascade passée.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(process.cwd(), `purge-unpaid-${confirm ? 'applied' : 'dryrun'}-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), graceDays, includeDemo, skipWithData, candidates }, null, 2));
    console.log(`\nInventaire écrit : ${file}`);

    if (!confirm) {
      console.log('\nSIMULATION — rien n\'a été supprimé.');
      console.log(`Pour supprimer : node scripts/purge-unpaid-tenants.cjs --confirm --expected=${candidates.length}` +
        (skipWithData ? ' --skip-with-data' : '') + (includeDemo ? ' --include-demo' : '') +
        (graceDays !== 7 ? ` --grace-days=${graceDays}` : ''));
      return;
    }

    if (expected !== candidates.length) {
      console.error(`\nARRÊT : ${candidates.length} candidats trouvés, ${expected} attendus. La base a changé depuis la simulation — relancez-la.`);
      process.exit(1);
    }

    // --- Suppression ---
    // Un établissement à la fois : un échec (contrainte inattendue) n'emporte
    // pas les autres, et le rapport dit exactement lequel a échoué.
    let deleted = 0;
    const failed = [];
    for (const c of candidates) {
      try {
        // Délai relevé : un établissement avec des centaines de ventes dépasse
        // les 5 s par défaut d'une transaction interactive Prisma.
        await prisma.$transaction(async (tx) => {
          // Revérification au dernier moment : un paiement a pu arriver
          // pendant l'exécution.
          const paidNow = await tx.subscriptionPayment.count({ where: { tenantId: c.id, status: 'SUCCESS' } });
          if (paidNow > 0) throw new Error('un paiement réussi est apparu entre-temps');
          // La cascade seule échoue dès qu'il y a des ventes : cinq clés
          // étrangères sont en RESTRICT (Sale → Branch, Sale → User,
          // SaleItem → Product, Anomaly → User, StockTransfer / CashRegister →
          // Branch), et Postgres tente d'effacer les magasins, produits et
          // comptes avant les ventes qui les référencent. On efface donc
          // d'abord ces enfants — les lignes de vente et paiements partent en
          // cascade avec leur vente —, puis l'établissement.
          await tx.anomaly.deleteMany({ where: { tenantId: c.id } });
          await tx.sale.deleteMany({ where: { tenantId: c.id } });
          await tx.stockTransfer.deleteMany({ where: { tenantId: c.id } });
          await tx.cashRegister.deleteMany({ where: { tenantId: c.id } });
          await tx.tenant.delete({ where: { id: c.id } });
        }, { timeout: 120_000, maxWait: 10_000 });
        deleted += 1;
        console.log(`  supprimé : ${c.name}`);
      } catch (e) {
        failed.push({ name: c.name, id: c.id, error: e.message });
        console.error(`  ÉCHEC   : ${c.name} — ${e.message.split('\n').slice(-1)[0]}`);
      }
    }

    console.log(`\n${deleted} établissement(s) supprimé(s), ${failed.length} échec(s).`);
    if (failed.length) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
