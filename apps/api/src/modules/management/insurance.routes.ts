import type { FastifyInstance } from 'fastify';
import {
  insurerCreateSchema,
  insurerUpdateSchema,
  insuranceContractCreateSchema,
  insuranceContractUpdateSchema,
  insuranceGuaranteeCreateSchema,
  insuranceGuaranteeUpdateSchema,
  insuranceBeneficiaryCreateSchema,
  insuranceClaimCreateSchema,
  insuranceClaimUpdateSchema,
  insuranceRefundCreateSchema,
  InsuranceClaimStatus,
  InsuranceContractStatus,
  claimExpectedAmount,
  claimRemainingAmount,
} from '@oculo/shared-types';
import type { ClaimAmounts } from '@oculo/shared-types';
import { z } from 'zod';
import type { TenantPrisma } from '../../lib/prisma-tenant.js';
import { retryOnDuplicateNumber } from '../../lib/prisma-retry.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound, badRequest } from '../../lib/http-error.js';

/* ------------------------------ utilitaires ------------------------------ */

function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}

/** Remplace les chaînes vides par null : le formulaire envoie '' pour « vide ». */
function clean<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === '') (out as Record<string, unknown>)[k] = null;
  }
  return out;
}

const n = (v: unknown): number => Number(v ?? 0);

/** Statuts pour lesquels l'assureur s'est prononcé : le montant accepté fait foi. */
const ARBITRATED: string[] = [
  InsuranceClaimStatus.ACCEPTED,
  InsuranceClaimStatus.PARTIALLY_ACCEPTED,
  InsuranceClaimStatus.INVOICED,
  InsuranceClaimStatus.PARTIALLY_PAID,
  InsuranceClaimStatus.PAID,
];

interface ClaimRow extends ClaimAmounts {
  id: string;
  insurerId: string;
  dueAt: Date | null;
  requestedAt: Date;
}

/** Lit les montants d'un dossier sous la forme attendue par les calculs partagés. */
function amountsOf(c: {
  status: string;
  requestedAmount: unknown;
  acceptedAmount: unknown;
  paidAmount: unknown;
}): ClaimAmounts {
  return {
    status: c.status as ClaimAmounts['status'],
    requestedAmount: n(c.requestedAmount),
    acceptedAmount: n(c.acceptedAmount),
    paidAmount: n(c.paidAmount),
  };
}

/** Numéro de dossier : PEC-AAAA-00001, continu par établissement et par année. */
async function nextClaimNumber(db: TenantPrisma, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.insuranceClaim.count({
    where: { tenantId, number: { startsWith: `PEC-${year}-` } },
  });
  return `PEC-${year}-${String(count + 1).padStart(5, '0')}`;
}

/** Échéance par défaut : le 1er du mois suivant la demande. */
function defaultDueAt(from: Date): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

const claimInclude = {
  insurer: { select: { id: true, name: true, type: true } },
  contract: { select: { id: true, name: true, reference: true } },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  sale: { select: { id: true, number: true, createdAt: true, totalAmount: true } },
  beneficiary: { select: { id: true, membershipNumber: true } },
  refunds: { orderBy: { receivedAt: 'desc' as const } },
} as const;

/**
 * Recalcule `paidAmount` d'un dossier depuis ses remboursements — un montant
 * reçu ne se saisit jamais directement — puis fait suivre le statut et la
 * vente d'origine.
 *
 * La vente conserve `insurerPaidAmount` / `insurerPaidAt` pour que la page
 * Créances, le widget et le tableau de bord continuent de fonctionner sans
 * modification. Un dossier soldé sur un montant accepté inférieur au montant
 * porté par la vente solde aussi la vente : le reste n'est pas une créance
 * assurance, l'assureur ne le doit pas.
 */
async function syncClaim(db: TenantPrisma, claimId: string): Promise<void> {
  const claim = await db.insuranceClaim.findFirst({
    where: { id: claimId },
    include: { refunds: { select: { receivedAmount: true } } },
  });
  if (!claim) return;

  const paid = claim.refunds.reduce((s, r) => s + n(r.receivedAmount), 0);
  const requested = n(claim.requestedAmount);
  let status = claim.status as string;
  let accepted = n(claim.acceptedAmount);

  if (status !== InsuranceClaimStatus.REJECTED) {
    if (paid > 0) {
      // Un assureur qui verse a, de fait, accepté : un dossier encore « en
      // attente » qui reçoit de l'argent est arbitré au montant demandé.
      if (!ARBITRATED.includes(status)) accepted = requested;
      status = paid >= accepted && accepted > 0 ? InsuranceClaimStatus.PAID : InsuranceClaimStatus.PARTIALLY_PAID;
    } else if (status === InsuranceClaimStatus.PAID || status === InsuranceClaimStatus.PARTIALLY_PAID) {
      // Le dernier versement a été retiré : le dossier redevient à recouvrer.
      status = accepted > 0 ? InsuranceClaimStatus.INVOICED : InsuranceClaimStatus.PENDING;
    }
  }

  const expected = claimExpectedAmount({
    status: status as never,
    requestedAmount: requested,
    acceptedAmount: accepted,
    paidAmount: paid,
  });

  await db.insuranceClaim.updateMany({
    where: { id: claimId },
    data: {
      paidAmount: paid,
      acceptedAmount: accepted,
      status: status as never,
      patientAmount: Math.max(0, n(claim.totalAmount) - expected),
    },
  });

  if (claim.saleId) {
    const settled = expected > 0 && paid >= expected;
    const sale = await db.sale.findFirst({
      where: { id: claim.saleId },
      select: { insuranceAmount: true },
    });
    if (sale) {
      const insured = n(sale.insuranceAmount);
      await db.sale.updateMany({
        where: { id: claim.saleId },
        data: {
          insurerPaidAmount: settled ? insured : Math.min(paid, insured),
          insurerPaidAt: settled ? new Date() : null,
        },
      });
    }
  }
}

/* -------------------------------- assureurs ------------------------------- */

async function insurersSection(app: FastifyInstance) {
  // Liste des assureurs, enrichie des compteurs du module : contrats,
  // bénéficiaires, dossiers, montant en attente et montant remboursé.
  app.get('/', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const db = req.db!;
    // Compteurs agrégés côté base : le nombre de dossiers ne doit pas dicter
    // le coût de l'écran. Les montants restent exacts car ils ne dépendent,
    // à statut donné, que de sommes.
    const [insurers, contracts, beneficiaries, claimStats] = await Promise.all([
      db.insurer.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }),
      db.insuranceContract.findMany({ select: { id: true, insurerId: true } }),
      db.insuranceBeneficiary.groupBy({ by: ['contractId'], _count: { _all: true } }),
      db.insuranceClaim.groupBy({
        by: ['insurerId', 'status'],
        _count: { _all: true },
        _sum: { requestedAmount: true, acceptedAmount: true, paidAmount: true },
      }),
    ]);

    // Les bénéficiaires sont portés par le contrat : on remonte à l'assureur.
    const contractOwner = new Map(contracts.map((c) => [c.id, c.insurerId]));
    const contractCount = new Map<string, number>();
    for (const c of contracts) contractCount.set(c.insurerId, (contractCount.get(c.insurerId) ?? 0) + 1);
    const beneficiaryCount = new Map<string, number>();
    for (const b of beneficiaries) {
      const insurerId = contractOwner.get(b.contractId);
      if (insurerId) {
        beneficiaryCount.set(insurerId, (beneficiaryCount.get(insurerId) ?? 0) + b._count._all);
      }
    }

    const stats = new Map<string, { claims: number; pending: number; refunded: number }>();
    for (const row of claimStats) {
      const cur = stats.get(row.insurerId) ?? { claims: 0, pending: 0, refunded: 0 };
      cur.claims += row._count._all;
      cur.pending += claimRemainingAmount({
        status: row.status as never,
        requestedAmount: n(row._sum.requestedAmount),
        acceptedAmount: n(row._sum.acceptedAmount),
        paidAmount: n(row._sum.paidAmount),
      });
      cur.refunded += n(row._sum.paidAmount);
      stats.set(row.insurerId, cur);
    }

    return reply.send({
      insurers: insurers.map((i) => {
        const s = stats.get(i.id);
        return {
          ...i,
          contractCount: contractCount.get(i.id) ?? 0,
          beneficiaryCount: beneficiaryCount.get(i.id) ?? 0,
          claimCount: s?.claims ?? 0,
          pendingAmount: s?.pending ?? 0,
          refundedAmount: s?.refunded ?? 0,
        };
      }),
    });
  });

  app.post('/', { preHandler: requirePermission('insurance.create') }, async (req, reply) => {
    const input = clean(insurerCreateSchema.parse(req.body));
    const insurer = await req.db!.insurer.create({
      data: {
        tenantId: req.auth!.tenantId,
        name: input.name,
        type: input.type,
        coveragePercent: input.coveragePercent,
        phone: input.phone ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,
      },
    });
    return reply.status(201).send({ insurer });
  });

  app.patch('/:id', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(insurerUpdateSchema.parse(req.body));
    const res = await req.db!.insurer.updateMany({ where: { id }, data: input });
    if (res.count === 0) throw notFound('Assurance introuvable');
    const insurer = await req.db!.insurer.findFirst({ where: { id } });
    return reply.send({ insurer });
  });
}

/* ------------------------- contrats et garanties -------------------------- */

async function contractsSection(app: FastifyInstance) {
  app.get('/contracts', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const q = req.query as { insurerId?: string; status?: string };
    const contracts = await req.db!.insuranceContract.findMany({
      where: {
        ...(q.insurerId ? { insurerId: q.insurerId } : {}),
        ...(q.status ? { status: q.status as never } : {}),
      },
      include: {
        insurer: { select: { id: true, name: true, type: true } },
        guarantees: { orderBy: { category: 'asc' } },
        _count: { select: { beneficiaries: true, claims: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return reply.send({ contracts });
  });

  app.get('/contracts/:id', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const contract = await req.db!.insuranceContract.findFirst({
      where: { id },
      include: {
        insurer: { select: { id: true, name: true, type: true } },
        guarantees: { orderBy: { category: 'asc' } },
        beneficiaries: {
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!contract) throw notFound('Contrat introuvable');
    return reply.send({ contract });
  });

  app.post('/contracts', { preHandler: requirePermission('insurance.create') }, async (req, reply) => {
    const input = clean(insuranceContractCreateSchema.parse(req.body));
    const insurer = await req.db!.insurer.findFirst({ where: { id: input.insurerId } });
    if (!insurer) throw badRequest('Assureur invalide');
    const contract = await req.db!.insuranceContract.create({
      data: {
        tenantId: req.auth!.tenantId,
        insurerId: input.insurerId,
        name: input.name,
        reference: input.reference ?? null,
        startsAt: toDate(input.startsAt),
        endsAt: toDate(input.endsAt),
        status: input.status,
        notes: input.notes ?? null,
        createdById: req.auth!.userId,
      },
      include: { guarantees: true },
    });
    return reply.status(201).send({ contract });
  });

  app.patch('/contracts/:id', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(insuranceContractUpdateSchema.parse(req.body));
    const data: Record<string, unknown> = { ...input };
    if ('startsAt' in input) data.startsAt = toDate(input.startsAt as string);
    if ('endsAt' in input) data.endsAt = toDate(input.endsAt as string);
    const res = await req.db!.insuranceContract.updateMany({ where: { id }, data });
    if (res.count === 0) throw notFound('Contrat introuvable');
    const contract = await req.db!.insuranceContract.findFirst({
      where: { id },
      include: { guarantees: true },
    });
    return reply.send({ contract });
  });

  /* ----------------------------- garanties ----------------------------- */

  app.post('/contracts/:id/guarantees', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(insuranceGuaranteeCreateSchema.parse(req.body));
    const contract = await req.db!.insuranceContract.findFirst({ where: { id } });
    if (!contract) throw notFound('Contrat introuvable');
    const exists = await req.db!.insuranceGuarantee.findFirst({
      where: { contractId: id, category: input.category },
    });
    if (exists) throw badRequest('Une garantie existe déjà pour cette catégorie');
    const guarantee = await req.db!.insuranceGuarantee.create({
      data: {
        tenantId: req.auth!.tenantId,
        contractId: id,
        category: input.category,
        coveragePercent: input.coveragePercent,
        ceilingAmount: input.ceilingAmount ?? null,
        maxAmount: input.maxAmount ?? null,
        deductibleAmount: input.deductibleAmount ?? null,
        conditions: input.conditions ?? null,
      },
    });
    return reply.status(201).send({ guarantee });
  });

  app.patch('/guarantees/:id', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(insuranceGuaranteeUpdateSchema.parse(req.body));
    const res = await req.db!.insuranceGuarantee.updateMany({ where: { id }, data: input });
    if (res.count === 0) throw notFound('Garantie introuvable');
    const guarantee = await req.db!.insuranceGuarantee.findFirst({ where: { id } });
    return reply.send({ guarantee });
  });

  app.delete('/guarantees/:id', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await req.db!.insuranceGuarantee.deleteMany({ where: { id } });
    if (res.count === 0) throw notFound('Garantie introuvable');
    return reply.send({ ok: true });
  });

  /* --------------------------- bénéficiaires --------------------------- */

  app.post('/contracts/:id/beneficiaries', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(insuranceBeneficiaryCreateSchema.parse(req.body));
    const contract = await req.db!.insuranceContract.findFirst({ where: { id } });
    if (!contract) throw notFound('Contrat introuvable');
    const customer = await req.db!.customer.findFirst({ where: { id: input.customerId } });
    if (!customer) throw badRequest('Client invalide');
    const exists = await req.db!.insuranceBeneficiary.findFirst({
      where: { contractId: id, customerId: input.customerId },
    });
    if (exists) throw badRequest('Ce client est déjà rattaché à ce contrat');
    const beneficiary = await req.db!.insuranceBeneficiary.create({
      data: {
        tenantId: req.auth!.tenantId,
        contractId: id,
        customerId: input.customerId,
        membershipNumber: input.membershipNumber ?? null,
        notes: input.notes ?? null,
      },
      include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    });
    return reply.status(201).send({ beneficiary });
  });

  app.delete('/beneficiaries/:id', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await req.db!.insuranceBeneficiary.deleteMany({ where: { id } });
    if (res.count === 0) throw notFound('Bénéficiaire introuvable');
    return reply.send({ ok: true });
  });

  /**
   * Couverture applicable à un client : garanties du premier contrat actif
   * dont il est bénéficiaire. La caisse s'en sert pour calculer la part
   * assurance par catégorie ; sans contrat, elle retombe sur le taux de
   * l'assureur (`matched: false`).
   */
  app.get('/coverage', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const q = req.query as { customerId?: string; insurerId?: string };
    if (!q.customerId) throw badRequest('Client requis');
    const now = new Date();
    const memberships = await req.db!.insuranceBeneficiary.findMany({
      where: {
        customerId: q.customerId,
        contract: {
          status: InsuranceContractStatus.ACTIVE as never,
          ...(q.insurerId ? { insurerId: q.insurerId } : {}),
        },
      },
      include: {
        contract: {
          include: {
            insurer: { select: { id: true, name: true, coveragePercent: true } },
            guarantees: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Un contrat daté qui n'a pas commencé ou qui est fini ne s'applique pas.
    const active = memberships.find((m) => {
      const c = m.contract;
      if (c.startsAt && c.startsAt > now) return false;
      if (c.endsAt && c.endsAt < now) return false;
      return true;
    });
    if (!active) return reply.send({ matched: false });

    return reply.send({
      matched: true,
      beneficiaryId: active.id,
      membershipNumber: active.membershipNumber,
      contract: {
        id: active.contract.id,
        name: active.contract.name,
        reference: active.contract.reference,
        insurer: active.contract.insurer,
      },
      guarantees: active.contract.guarantees.map((g) => ({
        category: g.category,
        coveragePercent: g.coveragePercent,
        ceilingAmount: g.ceilingAmount == null ? null : n(g.ceilingAmount),
        maxAmount: g.maxAmount == null ? null : n(g.maxAmount),
        deductibleAmount: g.deductibleAmount == null ? null : n(g.deductibleAmount),
        conditions: g.conditions,
      })),
    });
  });
}

/* --------------------- prises en charge et remboursements ------------------ */

async function claimsSection(app: FastifyInstance) {
  app.get('/claims', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const q = req.query as { insurerId?: string; status?: string; from?: string; to?: string; customerId?: string };
    const from = toDate(q.from);
    const to = toDate(q.to);
    const claims = await req.db!.insuranceClaim.findMany({
      where: {
        ...(q.insurerId ? { insurerId: q.insurerId } : {}),
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.customerId ? { customerId: q.customerId } : {}),
        ...(from || to
          ? { requestedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      include: claimInclude,
      orderBy: { requestedAt: 'desc' },
      take: 300,
    });
    return reply.send({
      claims: claims.map((c) => ({
        ...c,
        expectedAmount: claimExpectedAmount(amountsOf(c)),
        remainingAmount: claimRemainingAmount(amountsOf(c)),
      })),
    });
  });

  app.get('/claims/:id', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const claim = await req.db!.insuranceClaim.findFirst({ where: { id }, include: claimInclude });
    if (!claim) throw notFound('Dossier introuvable');
    return reply.send({
      claim: {
        ...claim,
        expectedAmount: claimExpectedAmount(amountsOf(claim)),
        remainingAmount: claimRemainingAmount(amountsOf(claim)),
      },
    });
  });

  app.post('/claims', { preHandler: requirePermission('insurance.create') }, async (req, reply) => {
    const input = clean(insuranceClaimCreateSchema.parse(req.body));
    const db = req.db!;
    const insurer = await db.insurer.findFirst({ where: { id: input.insurerId } });
    if (!insurer) throw badRequest('Assureur invalide');
    if (input.saleId) {
      const sale = await db.sale.findFirst({ where: { id: input.saleId } });
      if (!sale) throw badRequest('Vente invalide');
      const already = await db.insuranceClaim.findFirst({ where: { saleId: input.saleId } });
      if (already) throw badRequest('Un dossier existe déjà pour cette vente');
    }

    const requestedAt = toDate(input.requestedAt) ?? new Date();
    const expected = ARBITRATED.includes(input.status) ? input.acceptedAmount : input.requestedAmount;

    const claim = await retryOnDuplicateNumber(async () =>
      db.insuranceClaim.create({
        data: {
          tenantId: req.auth!.tenantId,
          number: await nextClaimNumber(db, req.auth!.tenantId),
          insurerId: input.insurerId,
          contractId: input.contractId ?? null,
          beneficiaryId: input.beneficiaryId ?? null,
          customerId: input.customerId ?? null,
          saleId: input.saleId ?? null,
          status: input.status as never,
          totalAmount: input.totalAmount,
          requestedAmount: input.requestedAmount,
          acceptedAmount: input.acceptedAmount,
          patientAmount: Math.max(0, input.totalAmount - expected),
          requestedAt,
          acceptedAt: ARBITRATED.includes(input.status) ? requestedAt : null,
          dueAt: toDate(input.dueAt) ?? defaultDueAt(requestedAt),
          notes: input.notes ?? null,
          createdById: req.auth!.userId,
        },
        include: claimInclude,
      }),
    );
    return reply.status(201).send({ claim });
  });

  /**
   * Fait avancer un dossier. Le montant payé n'est jamais modifiable ici : il
   * ne provient que des remboursements enregistrés.
   */
  app.patch('/claims/:id', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(insuranceClaimUpdateSchema.parse(req.body));
    const db = req.db!;
    const current = await db.insuranceClaim.findFirst({ where: { id } });
    if (!current) throw notFound('Dossier introuvable');

    const status = (input.status ?? current.status) as string;
    const requested = input.requestedAmount ?? n(current.requestedAmount);
    let accepted = input.acceptedAmount ?? n(current.acceptedAmount);

    // Cohérence des montants selon le statut demandé.
    if (status === InsuranceClaimStatus.REJECTED) {
      // Un dossier déjà remboursé ne peut pas devenir un refus : l'argent est
      // arrivé. Il faut d'abord retirer le versement.
      if (n(current.paidAmount) > 0) {
        throw badRequest('Ce dossier a déjà été remboursé : supprimez le versement avant de le refuser.');
      }
      accepted = 0;
    }
    if (status === InsuranceClaimStatus.ACCEPTED) accepted = accepted > 0 ? accepted : requested;
    if (status === InsuranceClaimStatus.PARTIALLY_ACCEPTED && (accepted <= 0 || accepted >= requested)) {
      throw badRequest('Une acceptation partielle doit être comprise entre 0 et le montant demandé');
    }
    if (accepted > requested) throw badRequest('Le montant accepté dépasse le montant demandé');

    const total = input.totalAmount ?? n(current.totalAmount);
    const expected = ARBITRATED.includes(status) ? accepted : requested;
    const paid = n(current.paidAmount);
    if (ARBITRATED.includes(status) && paid > accepted) {
      throw badRequest(
        `Déjà remboursé ${paid} : le montant accepté ne peut pas être inférieur.`,
      );
    }

    const data: Record<string, unknown> = {
      status: status as never,
      requestedAmount: requested,
      acceptedAmount: accepted,
      totalAmount: total,
      patientAmount: Math.max(0, total - expected),
    };
    if (input.contractId !== undefined) data.contractId = input.contractId;
    if (input.beneficiaryId !== undefined) data.beneficiaryId = input.beneficiaryId;
    if (input.customerId !== undefined) data.customerId = input.customerId;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.requestedAt !== undefined) data.requestedAt = toDate(input.requestedAt as string);
    if (input.dueAt !== undefined) data.dueAt = toDate(input.dueAt as string);
    // Horodate la décision de l'assureur la première fois qu'elle est connue.
    if (ARBITRATED.includes(status) && !current.acceptedAt) data.acceptedAt = new Date();
    if (status === InsuranceClaimStatus.REJECTED && !current.acceptedAt) data.acceptedAt = new Date();

    await db.insuranceClaim.updateMany({ where: { id }, data });
    await syncClaim(db, id);
    const claim = await db.insuranceClaim.findFirst({ where: { id }, include: claimInclude });
    return reply.send({
      claim: claim && {
        ...claim,
        expectedAmount: claimExpectedAmount(amountsOf(claim)),
        remainingAmount: claimRemainingAmount(amountsOf(claim)),
      },
    });
  });

  /* --------------------------- remboursements --------------------------- */

  app.get('/refunds', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const q = req.query as { insurerId?: string; from?: string; to?: string };
    const from = toDate(q.from);
    const to = toDate(q.to);
    const refunds = await req.db!.insuranceRefund.findMany({
      where: {
        ...(q.insurerId ? { insurerId: q.insurerId } : {}),
        ...(from || to
          ? { receivedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      include: {
        insurer: { select: { id: true, name: true } },
        claim: { select: { id: true, number: true, saleId: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 300,
    });
    return reply.send({
      refunds,
      total: refunds.reduce((s, r) => s + n(r.receivedAmount), 0),
    });
  });

  app.post('/claims/:id/refunds', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(insuranceRefundCreateSchema.parse(req.body));
    const db = req.db!;
    const claim = await db.insuranceClaim.findFirst({ where: { id } });
    if (!claim) throw notFound('Dossier introuvable');
    if (claim.status === InsuranceClaimStatus.REJECTED) {
      throw badRequest('Dossier refusé : aucun remboursement attendu');
    }
    const remaining = claimRemainingAmount(amountsOf(claim));
    if (input.receivedAmount > remaining) {
      throw badRequest(`Le montant dépasse le restant dû (${remaining}).`);
    }

    const refund = await db.insuranceRefund.create({
      data: {
        tenantId: req.auth!.tenantId,
        claimId: id,
        insurerId: claim.insurerId,
        expectedAmount: remaining,
        receivedAmount: input.receivedAmount,
        receivedAt: toDate(input.receivedAt) ?? new Date(),
        reference: input.reference ?? null,
        method: (input.method ?? null) as never,
        notes: input.notes ?? null,
        createdById: req.auth!.userId,
      },
    });
    await syncClaim(db, id);
    const updated = await db.insuranceClaim.findFirst({ where: { id }, include: claimInclude });
    return reply.status(201).send({
      refund,
      claim: updated && {
        ...updated,
        expectedAmount: claimExpectedAmount(amountsOf(updated)),
        remainingAmount: claimRemainingAmount(amountsOf(updated)),
      },
    });
  });

  app.delete('/refunds/:id', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = req.db!;
    const refund = await db.insuranceRefund.findFirst({ where: { id } });
    if (!refund) throw notFound('Remboursement introuvable');
    await db.insuranceRefund.deleteMany({ where: { id } });
    await syncClaim(db, refund.claimId);
    return reply.send({ ok: true });
  });
}

/* --------------------------- créances et pilotage -------------------------- */

/** Dossiers servant aux agrégats, sur une fenêtre bornée (24 mois). */
async function loadClaimRows(db: TenantPrisma): Promise<ClaimRow[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - 24);
  const rows = await db.insuranceClaim.findMany({
    where: { requestedAt: { gte: since } },
    select: {
      id: true,
      insurerId: true,
      status: true,
      requestedAmount: true,
      acceptedAmount: true,
      paidAmount: true,
      dueAt: true,
      requestedAt: true,
    },
  });
  return rows.map((r) => ({ ...amountsOf(r), id: r.id, insurerId: r.insurerId, dueAt: r.dueAt, requestedAt: r.requestedAt }));
}

function isLate(row: ClaimRow, now: Date): boolean {
  return row.dueAt != null && row.dueAt < now && claimRemainingAmount(row) > 0;
}

async function analyticsSection(app: FastifyInstance) {
  /**
   * Résumé pour le tableau de bord (widget Assurances et alertes du jour).
   * Même forme qu'avant, mais alimenté par les dossiers : « payé » ne
   * compte plus que ce qui a réellement été remboursé.
   */
  app.get('/summary', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const now = new Date();
    const rows = await loadClaimRows(req.db!);
    let paid = 0;
    let pending = 0;
    let late = 0;
    for (const row of rows) {
      paid += row.paidAmount;
      const remaining = claimRemainingAmount(row);
      if (remaining <= 0) continue;
      if (isLate(row, now)) late += remaining;
      else pending += remaining;
    }
    return reply.send({ paid, pending, late, toCollect: pending + late });
  });

  /**
   * Bandeau mensuel. Conserve la forme historique (utilisée par le tableau de
   * bord) et ajoute ce qu'exige le nouveau bandeau : reçu ce mois, en attente,
   * en retard et prochaine échéance — tous calculés, jamais saisis.
   */
  app.get('/upcoming', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const { month } = req.query as { month?: string };
    const parsed = month ? new Date(`${month}-01T00:00:00`) : new Date();
    if (Number.isNaN(parsed.getTime())) throw badRequest('Mois invalide');
    const monthStart = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    const monthEnd = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 1);
    const now = new Date();
    const db = req.db!;

    const [claims, insurers, refunds, nextDue] = await Promise.all([
      db.insuranceClaim.findMany({
        where: { requestedAt: { gte: monthStart, lt: monthEnd } },
        select: {
          insurerId: true,
          status: true,
          requestedAmount: true,
          acceptedAmount: true,
          paidAmount: true,
        },
      }),
      db.insurer.findMany({ select: { id: true, name: true } }),
      db.insuranceRefund.aggregate({
        where: { receivedAt: { gte: monthStart, lt: monthEnd } },
        _sum: { receivedAmount: true },
      }),
      db.insuranceClaim.findFirst({
        where: { dueAt: { gte: now }, status: { notIn: [InsuranceClaimStatus.PAID, InsuranceClaimStatus.REJECTED] as never } },
        orderBy: { dueAt: 'asc' },
        select: { dueAt: true },
      }),
    ]);

    const byInsurer = new Map<string, { expected: number; received: number; remaining: number; salesCount: number }>();
    for (const c of claims) {
      const a = amountsOf(c);
      const cur = byInsurer.get(c.insurerId) ?? { expected: 0, received: 0, remaining: 0, salesCount: 0 };
      cur.expected += claimExpectedAmount(a);
      cur.received += a.paidAmount;
      cur.remaining += claimRemainingAmount(a);
      cur.salesCount += 1;
      byInsurer.set(c.insurerId, cur);
    }
    const items = [...byInsurer.entries()]
      .map(([insurerId, x]) => ({
        insurerId,
        name: insurers.find((i) => i.id === insurerId)?.name ?? '—',
        amount: x.remaining,
        expectedAmount: x.expected,
        receivedAmount: x.received,
        remainingAmount: x.remaining,
        salesCount: x.salesCount,
      }))
      .filter((x) => x.remainingAmount > 0)
      .sort((a, b) => b.amount - a.amount);

    // Vue globale (tous mois confondus) pour « en attente » et « en retard ».
    const rows = await loadClaimRows(db);
    let pendingTotal = 0;
    let lateTotal = 0;
    for (const row of rows) {
      const remaining = claimRemainingAmount(row);
      if (remaining <= 0) continue;
      if (isLate(row, now)) lateTotal += remaining;
      else pendingTotal += remaining;
    }

    return reply.send({
      items,
      total: items.reduce((s, x) => s + x.remainingAmount, 0),
      expectedTotal: items.reduce((s, x) => s + x.expectedAmount, 0),
      receivedTotal: items.reduce((s, x) => s + x.receivedAmount, 0),
      monthStart: monthStart.toISOString(),
      dueDate: monthEnd.toISOString(),
      receivedThisMonth: n(refunds._sum.receivedAmount),
      pendingTotal,
      lateTotal,
      nextDueDate: nextDue?.dueAt ? nextDue.dueAt.toISOString() : null,
    });
  });

  /** Créances assurance : totaux par statut et détail filtrable. */
  app.get('/receivables', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const q = req.query as { insurerId?: string; status?: string; from?: string; to?: string; minAmount?: string };
    const from = toDate(q.from);
    const to = toDate(q.to);
    const now = new Date();
    const claims = await req.db!.insuranceClaim.findMany({
      where: {
        ...(q.insurerId ? { insurerId: q.insurerId } : {}),
        ...(q.status ? { status: q.status as never } : {}),
        ...(from || to
          ? { requestedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      include: {
        insurer: { select: { id: true, name: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
        sale: { select: { id: true, number: true } },
      },
      orderBy: { dueAt: 'asc' },
      take: 500,
    });

    const minAmount = q.minAmount ? Number(q.minAmount) : 0;
    const totals = { due: 0, pending: 0, late: 0, partiallyPaid: 0, paid: 0 };
    const items = [];
    for (const c of claims) {
      const a = amountsOf(c);
      const remaining = claimRemainingAmount(a);
      const expected = claimExpectedAmount(a);
      const late = c.dueAt != null && c.dueAt < now && remaining > 0;
      totals.due += remaining;
      totals.paid += a.paidAmount;
      if (remaining > 0) {
        if (late) totals.late += remaining;
        else totals.pending += remaining;
        if (a.paidAmount > 0) totals.partiallyPaid += remaining;
      }
      if (expected < minAmount) continue;
      items.push({ ...c, expectedAmount: expected, remainingAmount: remaining, late });
    }
    return reply.send({ totals, items });
  });

  /** Pilotage du module : totaux, évolution, répartition, classement. */
  app.get('/dashboard', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const db = req.db!;
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [rows, refunds, insurers] = await Promise.all([
      loadClaimRows(db),
      db.insuranceRefund.findMany({
        where: { receivedAt: { gte: since } },
        select: { receivedAmount: true, receivedAt: true, insurerId: true },
      }),
      db.insurer.findMany({ select: { id: true, name: true } }),
    ]);

    const totals = {
      requested: 0,
      accepted: 0,
      pending: 0,
      invoiced: 0,
      received: 0,
      remaining: 0,
      late: 0,
    };
    const byStatus = new Map<string, { count: number; amount: number }>();
    const byInsurer = new Map<string, { requested: number; received: number; remaining: number; claims: number }>();

    for (const row of rows) {
      const remaining = claimRemainingAmount(row);
      const expected = claimExpectedAmount(row);
      if (row.status !== InsuranceClaimStatus.REJECTED) totals.requested += row.requestedAmount;
      totals.accepted += row.acceptedAmount;
      totals.received += row.paidAmount;
      totals.remaining += remaining;
      if (row.status === InsuranceClaimStatus.INVOICED) totals.invoiced += expected;
      if (remaining > 0) {
        if (isLate(row, now)) totals.late += remaining;
        else totals.pending += remaining;
      }

      const s = byStatus.get(row.status) ?? { count: 0, amount: 0 };
      s.count += 1;
      s.amount += expected;
      byStatus.set(row.status, s);

      const i = byInsurer.get(row.insurerId) ?? { requested: 0, received: 0, remaining: 0, claims: 0 };
      i.requested += row.requestedAmount;
      i.received += row.paidAmount;
      i.remaining += remaining;
      i.claims += 1;
      byInsurer.set(row.insurerId, i);
    }

    // Évolution sur 12 mois : ce qui a été demandé, et ce qui a été encaissé.
    const months: { month: string; requested: number; received: number }[] = [];
    for (let k = 11; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      months.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, requested: 0, received: 0 });
    }
    const index = new Map(months.map((m, i) => [m.month, i]));
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    for (const row of rows) {
      const i = index.get(key(row.requestedAt));
      if (i != null) months[i].requested += row.requestedAmount;
    }
    for (const r of refunds) {
      const i = index.get(key(r.receivedAt));
      if (i != null) months[i].received += n(r.receivedAmount);
    }

    const name = (id: string) => insurers.find((x) => x.id === id)?.name ?? '—';
    return reply.send({
      totals,
      months,
      byStatus: [...byStatus.entries()].map(([status, x]) => ({ status, ...x })),
      byInsurer: [...byInsurer.entries()]
        .map(([insurerId, x]) => ({ insurerId, name: name(insurerId), ...x }))
        .sort((a, b) => b.requested - a.requested),
    });
  });
}

/* -------------------------------------------------------------------------- */

const legacyPaymentSchema = z.object({
  insurerId: z.string().uuid(),
  monthStart: z.string().min(1),
  amount: z.number().positive().optional(),
});

/**
 * Module Assurances : assureurs, contrats, garanties, bénéficiaires, prises en
 * charge, remboursements et pilotage. Monté sous `/insurance`, il réutilise
 * les permissions existantes `insurance.view | create | update`.
 */
export async function insuranceRoutes(app: FastifyInstance): Promise<void> {
  await insurersSection(app);
  await contractsSection(app);
  await claimsSection(app);
  await analyticsSection(app);

  /**
   * Ancien enregistrement « au mois », remplacé par la saisie d'un
   * remboursement sur un dossier. Plus aucune interface ne l'appelle ; conservé
   * le temps qu'un ancien onglet resté ouvert cesse de s'en servir, il répartit
   * le montant sur les dossiers du mois, du plus ancien au plus récent.
   */
  app.post('/mark-paid', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { insurerId, monthStart, amount } = legacyPaymentSchema.parse(req.body);
    const start = new Date(monthStart);
    if (Number.isNaN(start.getTime())) throw badRequest('Mois invalide');
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const db = req.db!;

    const claims = await db.insuranceClaim.findMany({
      where: { insurerId, requestedAt: { gte: start, lt: end } },
      orderBy: { requestedAt: 'asc' },
    });
    const totalRemaining = claims.reduce((s, c) => s + claimRemainingAmount(amountsOf(c)), 0);
    let left = amount == null ? totalRemaining : Math.min(amount, totalRemaining);
    if (left <= 0) {
      return reply.send({ ok: true, count: 0, receivedAmount: 0, remainingAmount: totalRemaining });
    }

    let count = 0;
    let receivedAmount = 0;
    for (const claim of claims) {
      const remaining = claimRemainingAmount(amountsOf(claim));
      if (remaining <= 0) continue;
      const applied = Math.min(remaining, left);
      await db.insuranceRefund.create({
        data: {
          tenantId: req.auth!.tenantId,
          claimId: claim.id,
          insurerId,
          expectedAmount: remaining,
          receivedAmount: applied,
          receivedAt: new Date(),
          notes: 'Saisie mensuelle',
          createdById: req.auth!.userId,
        },
      });
      await syncClaim(db, claim.id);
      count += 1;
      receivedAmount += applied;
      left -= applied;
      if (left <= 0) break;
    }

    return reply.send({
      ok: true,
      count,
      receivedAmount,
      remainingAmount: Math.max(0, totalRemaining - receivedAmount),
    });
  });
}
