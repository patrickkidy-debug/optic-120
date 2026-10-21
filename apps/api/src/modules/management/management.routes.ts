import type { FastifyInstance } from 'fastify';
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  expenseCreateSchema,
  expenseUpdateSchema,
  cashTransferCreateSchema,
  financeCancelSchema,
  bankAccountCreateSchema,
  TRANSFER_KIND_EFFECT,
  type TransferKind,
  supplierCreateSchema,
  supplierUpdateSchema,
  SaleType,
  SaleStatus,
} from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, branchScope } from '../../middlewares/rbac-guard.js';
import type { FastifyRequest } from 'fastify';
import { notFound, badRequest } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import { insuranceRoutes } from './insurance.routes.js';

/**
 * Périmètre des dépenses / versements : magasin demandé (vérifié), ou les
 * magasins autorisés + les écritures communes à l'établissement (sans magasin).
 */
function scopeWithShared(req: FastifyRequest, branchId?: string) {
  const scope = branchScope(req, branchId);
  if (branchId || !scope.branchId) return scope;
  return { OR: [scope, { branchId: null }] };
}

function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}
function clean<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === '') (out as Record<string, unknown>)[k] = null;
  }
  return out;
}
/** Statuts comptant comme recette (une vente annulée ne rapporte rien). */
const PAID_LIKE = [SaleStatus.PAID, SaleStatus.PARTIALLY_PAID, SaleStatus.CONFIRMED];

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function employeesRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('hr.employees.view') }, async (req, reply) => {
    const employees = await req.db!.employee.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    return reply.send({ employees });
  });

  app.post('/', { preHandler: requirePermission('hr.employees.create') }, async (req, reply) => {
    const input = clean(employeeCreateSchema.parse(req.body));
    const employee = await req.db!.employee.create({
      data: {
        tenantId: req.auth!.tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        position: input.position,
        salary: input.salary ?? null,
        hireDate: toDate(input.hireDate),
        status: input.status,
        branchId: input.branchId ?? null,
      },
    });
    return reply.status(201).send({ employee });
  });

  app.patch('/:id', { preHandler: requirePermission('hr.employees.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(employeeUpdateSchema.parse(req.body));
    const data: Record<string, unknown> = { ...input };
    if ('hireDate' in input) data.hireDate = toDate(input.hireDate as string);
    const res = await req.db!.employee.updateMany({ where: { id }, data });
    if (res.count === 0) throw notFound('Employé introuvable');
    const employee = await req.db!.employee.findFirst({ where: { id } });
    return reply.send({ employee });
  });
}

/** Noms des personnes (saisie, annulation) pour l'historique, sans N+1. */
async function userNames(req: FastifyRequest, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const users = await req.db!.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
  return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
}

/** Filtres communs des listes : période et écritures annulées. */
function periodFilter(q: { from?: string; to?: string; includeCancelled?: string }) {
  const date: Record<string, Date> = {};
  if (q.from) date.gte = new Date(q.from);
  if (q.to) date.lte = new Date(`${q.to}T23:59:59.999Z`);
  return {
    ...(Object.keys(date).length ? { date } : {}),
    ...(q.includeCancelled === 'true' ? {} : { cancelledAt: null }),
  };
}

/** Un compte bancaire désigné doit exister dans l'établissement. */
async function assertBankAccount(req: FastifyRequest, id?: string | null): Promise<string | null> {
  if (!id) return null;
  const acc = await req.db!.bankAccount.findFirst({ where: { id }, select: { id: true } });
  if (!acc) throw badRequest('Compte bancaire introuvable');
  return acc.id;
}

async function expensesRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('finance.expenses.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string; from?: string; to?: string; includeCancelled?: string };
    const expenses = await req.db!.expense.findMany({
      where: { AND: [scopeWithShared(req, q.branchId), periodFilter(q)] },
      orderBy: { date: 'desc' },
      take: 500,
      include: { bankAccount: { select: { bankName: true, accountName: true, type: true, provider: true } } },
    });
    const names = await userNames(req, expenses.flatMap((e) => [e.createdById, e.cancelledById]));
    return reply.send({
      expenses: expenses.map((e) => ({
        ...e,
        createdByName: e.createdById ? names.get(e.createdById) ?? null : null,
        cancelledByName: e.cancelledById ? names.get(e.cancelledById) ?? null : null,
      })),
    });
  });

  app.get('/summary', { preHandler: requirePermission('finance.expenses.view') }, async (req, reply) => {
    const from = startOfMonth();
    const [revenueAgg, expenseAgg, byCategory] = await Promise.all([
      req.db!.sale.aggregate({
        where: { type: SaleType.SALE, status: { in: PAID_LIKE }, createdAt: { gte: from } },
        _sum: { paidAmount: true },
      }),
      req.db!.expense.aggregate({ where: { date: { gte: from }, cancelledAt: null }, _sum: { amount: true } }),
      req.db!.expense.groupBy({
        by: ['category'],
        where: { date: { gte: from }, cancelledAt: null },
        _sum: { amount: true },
      }),
    ]);
    const monthRevenue = Number(revenueAgg._sum.paidAmount ?? 0);
    const monthExpenses = Number(expenseAgg._sum.amount ?? 0);
    return reply.send({
      monthRevenue,
      monthExpenses,
      net: monthRevenue - monthExpenses,
      byCategory: byCategory.map((c) => ({ category: c.category, total: Number(c._sum.amount ?? 0) })),
    });
  });

  app.post('/', { preHandler: requirePermission('finance.expenses.create') }, async (req, reply) => {
    const input = clean(expenseCreateSchema.parse(req.body));
    const source = input.paymentSource ?? 'CASH';
    // Banque, mobile money, chèque, carte : le compte débité peut être précisé
    // (obligatoire pour la banque) ; les espèces sortent de la caisse.
    const bankAccountId = source !== 'CASH' ? await assertBankAccount(req, input.bankAccountId) : null;
    if (source === 'BANK' && !bankAccountId) throw badRequest('Choisissez le compte bancaire débité');
    const expense = await req.db!.expense.create({
      data: {
        tenantId: req.auth!.tenantId,
        category: input.category,
        label: input.label,
        amount: input.amount,
        date: toDate(input.date) ?? new Date(),
        branchId: input.branchId ?? null,
        notes: input.notes ?? null,
        createdById: req.auth!.userId,
        paymentSource: source,
        affectsCash: source === 'CASH',
        bankAccountId,
        payee: input.payee ?? null,
        reference: input.reference ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
        links: input.links?.length ? input.links : undefined,
      },
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'EXPENSE_CREATED',
      entity: 'Expense',
      entityId: expense.id,
      metadata: { label: expense.label, amount: Number(expense.amount), source },
      ...requestMeta(req),
    });
    return reply.status(201).send({ expense });
  });

  app.patch('/:id', { preHandler: requirePermission('finance.expenses.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(expenseUpdateSchema.parse(req.body));
    const existing = await req.db!.expense.findFirst({ where: { id } });
    if (!existing) throw notFound('Dépense introuvable');
    if (existing.cancelledAt) throw badRequest('Dépense annulée : modification impossible');
    const data: Record<string, unknown> = { ...input };
    if ('date' in input) data.date = toDate(input.date as string) ?? new Date();
    if (input.paymentSource) {
      data.affectsCash = input.paymentSource === 'CASH';
      data.bankAccountId = input.paymentSource !== 'CASH' ? await assertBankAccount(req, input.bankAccountId ?? existing.bankAccountId) : null;
    } else if ('bankAccountId' in input) {
      data.bankAccountId = await assertBankAccount(req, input.bankAccountId);
    }
    await req.db!.expense.updateMany({ where: { id }, data });
    const expense = await req.db!.expense.findFirst({ where: { id } });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'EXPENSE_UPDATED',
      entity: 'Expense',
      entityId: id,
      metadata: { before: { label: existing.label, amount: Number(existing.amount) }, changes: Object.keys(input) },
      ...requestMeta(req),
    });
    return reply.send({ expense });
  });

  // Annulation tracée (motif obligatoire) : l'écriture reste visible, barrée.
  const cancelExpense = async (req: FastifyRequest, reason: string) => {
    const { id } = req.params as { id: string };
    const res = await req.db!.expense.updateMany({
      where: { id, cancelledAt: null },
      data: { cancelledAt: new Date(), cancelledById: req.auth!.userId, cancelReason: reason },
    });
    if (res.count === 0) throw notFound('Dépense introuvable ou déjà annulée');
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'EXPENSE_CANCELLED',
      entity: 'Expense',
      entityId: id,
      metadata: { reason },
      ...requestMeta(req),
    });
  };
  app.post('/:id/cancel', { preHandler: requirePermission('finance.expenses.delete') }, async (req, reply) => {
    await cancelExpense(req, financeCancelSchema.parse(req.body).reason);
    return reply.send({ ok: true });
  });
  // Compatibilité : l'ancienne suppression devient une annulation tracée.
  app.delete('/:id', { preHandler: requirePermission('finance.expenses.delete') }, async (req, reply) => {
    await cancelExpense(req, 'Supprimée (sans motif)');
    return reply.send({ ok: true });
  });
}

/**
 * Versements : apports et retraits d'espèces, dépôts et retraits bancaires,
 * virements reçus et émis. Réutilise les permissions Finance — qui gère les
 * dépenses gère aussi les versements.
 */
async function cashTransfersRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('finance.expenses.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string; from?: string; to?: string; includeCancelled?: string };
    const transfers = await req.db!.cashTransfer.findMany({
      where: { AND: [scopeWithShared(req, q.branchId), periodFilter(q)] },
      orderBy: { date: 'desc' },
      take: 500,
      include: { bankAccount: { select: { bankName: true, accountName: true, type: true, provider: true } }, toAccount: { select: { bankName: true, accountName: true, type: true, provider: true } } },
    });
    const names = await userNames(req, transfers.flatMap((t) => [t.createdById, t.cancelledById]));
    // Totaux sur les écritures valides : caisse (espèces) et banque séparées.
    const totals = { in: 0, out: 0, cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0 };
    for (const t of transfers) {
      // Un virement de compte à compte ne fait ni entrer ni sortir d'argent.
      if (t.cancelledAt || t.kind === 'ACCOUNT_TRANSFER') continue;
      const amount = Number(t.amount);
      if (t.direction === 'IN') totals.in += amount;
      else totals.out += amount;
      if (t.affectsCash) {
        if (t.direction === 'IN') totals.cashIn += amount;
        else totals.cashOut += amount;
      }
      const kind = (t.kind ?? (t.direction === 'IN' ? 'CASH_IN' : 'CASH_OUT')) as TransferKind;
      const bank = TRANSFER_KIND_EFFECT[kind]?.bank ?? 0;
      if (bank > 0) totals.bankIn += amount;
      if (bank < 0) totals.bankOut += amount;
    }
    return reply.send({
      transfers: transfers.map((t) => ({
        ...t,
        kind: t.kind ?? (t.direction === 'IN' ? 'CASH_IN' : 'CASH_OUT'),
        createdByName: t.createdById ? names.get(t.createdById) ?? null : null,
        cancelledByName: t.cancelledById ? names.get(t.cancelledById) ?? null : null,
      })),
      totals: { ...totals, net: totals.in - totals.out },
    });
  });

  app.post('/', { preHandler: requirePermission('finance.expenses.create') }, async (req, reply) => {
    const input = clean(cashTransferCreateSchema.parse(req.body));
    const kind: TransferKind = input.kind ?? (input.direction === 'OUT' ? 'CASH_OUT' : 'CASH_IN');
    const effect = TRANSFER_KIND_EFFECT[kind];
    const bankAccountId = await assertBankAccount(req, input.bankAccountId);
    if (effect.bank !== 0 && !bankAccountId) throw badRequest('Choisissez le compte concerné');
    const toAccountId = kind === 'ACCOUNT_TRANSFER' ? await assertBankAccount(req, input.toAccountId) : null;
    if (kind === 'ACCOUNT_TRANSFER' && (!toAccountId || toAccountId === bankAccountId)) {
      throw badRequest('Choisissez un compte destinataire différent du compte source');
    }
    const transfer = await req.db!.cashTransfer.create({
      data: {
        tenantId: req.auth!.tenantId,
        direction: effect.direction,
        kind,
        affectsCash: effect.affectsCash,
        bankAccountId: effect.bank !== 0 ? bankAccountId : null,
        toAccountId,
        links: input.links?.length ? input.links : undefined,
        label: input.label,
        amount: input.amount,
        date: toDate(input.date) ?? new Date(),
        branchId: input.branchId || null,
        notes: input.notes ?? null,
        method: input.method || null,
        reference: input.reference ?? null,
        counterparty: input.counterparty ?? null,
        handledBy: input.handledBy ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
        createdById: req.auth!.userId,
      },
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'CASH_TRANSFER_CREATED',
      entity: 'CashTransfer',
      entityId: transfer.id,
      metadata: { kind, label: transfer.label, amount: Number(transfer.amount), reference: transfer.reference },
      ...requestMeta(req),
    });
    return reply.status(201).send({ transfer });
  });

  const cancelTransfer = async (req: FastifyRequest, reason: string) => {
    const { id } = req.params as { id: string };
    const res = await req.db!.cashTransfer.updateMany({
      where: { id, cancelledAt: null },
      data: { cancelledAt: new Date(), cancelledById: req.auth!.userId, cancelReason: reason },
    });
    if (res.count === 0) throw notFound('Versement introuvable ou déjà annulé');
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'CASH_TRANSFER_CANCELLED',
      entity: 'CashTransfer',
      entityId: id,
      metadata: { reason },
      ...requestMeta(req),
    });
  };
  // Historique d'une écriture (création, modification, annulation) : qui, quand, quoi.
  app.get('/history/:entity/:id', { preHandler: requirePermission('finance.expenses.view') }, async (req, reply) => {
    const { entity, id } = req.params as { entity: string; id: string };
    if (!['Expense', 'CashTransfer'].includes(entity)) throw badRequest('Écriture inconnue');
    const logs = await req.db!.auditLog.findMany({
      where: { entity, entityId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, action: true, createdAt: true, metadata: true, ipAddress: true, user: { select: { firstName: true, lastName: true } } },
    });
    return reply.send({ history: logs });
  });

  app.post('/:id/cancel', { preHandler: requirePermission('finance.expenses.delete') }, async (req, reply) => {
    await cancelTransfer(req, financeCancelSchema.parse(req.body).reason);
    return reply.send({ ok: true });
  });
  app.delete('/:id', { preHandler: requirePermission('finance.expenses.delete') }, async (req, reply) => {
    await cancelTransfer(req, 'Supprimé (sans motif)');
    return reply.send({ ok: true });
  });
}

/** Mouvements valides d'un ou plusieurs comptes (signés : + crédit, - débit). */
async function bankMovements(req: FastifyRequest, accountIds: string[]) {
  const [transfers, expenses] = await Promise.all([
    req.db!.cashTransfer.findMany({
      where: { cancelledAt: null, OR: [{ bankAccountId: { in: accountIds } }, { toAccountId: { in: accountIds } }] },
      select: {
        id: true,
        bankAccountId: true,
        toAccountId: true,
        kind: true,
        label: true,
        amount: true,
        date: true,
        reference: true,
        counterparty: true,
        method: true,
      },
    }),
    req.db!.expense.findMany({
      where: { bankAccountId: { in: accountIds }, paymentSource: { not: 'CASH' }, cancelledAt: null },
      select: { id: true, bankAccountId: true, label: true, amount: true, date: true, reference: true, payee: true, category: true },
    }),
  ]);
  const out: {
    id: string;
    type: 'TRANSFER' | 'EXPENSE';
    bankAccountId: string;
    kind: string | null;
    label: string;
    date: Date;
    reference: string | null;
    counterparty: string | null;
    method: string | null;
    signed: number;
  }[] = [];
  for (const t of transfers) {
    const amount = Number(t.amount);
    const base = { id: t.id, type: 'TRANSFER' as const, kind: t.kind, label: t.label, date: t.date, reference: t.reference, counterparty: t.counterparty, method: t.method };
    if (t.bankAccountId && accountIds.includes(t.bankAccountId)) {
      const sign = TRANSFER_KIND_EFFECT[(t.kind ?? 'CASH_IN') as TransferKind]?.bank ?? 0;
      if (sign !== 0) out.push({ ...base, bankAccountId: t.bankAccountId, signed: sign * amount });
    }
    if (t.kind === 'ACCOUNT_TRANSFER' && t.toAccountId && accountIds.includes(t.toAccountId)) {
      out.push({ ...base, bankAccountId: t.toAccountId, signed: amount });
    }
  }
  for (const e of expenses) {
    out.push({
      id: e.id,
      type: 'EXPENSE',
      bankAccountId: e.bankAccountId!,
      kind: 'EXPENSE',
      label: e.label,
      date: e.date,
      reference: e.reference,
      counterparty: e.payee,
      method: null,
      signed: -Number(e.amount),
    });
  }
  return out;
}

/** Comptes bancaires de l'établissement : coordonnées, solde, relevé. */
async function bankAccountsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('finance.expenses.view') }, async (req, reply) => {
    const accounts = await req.db!.bankAccount.findMany({ orderBy: [{ active: 'desc' }, { bankName: 'asc' }] });
    const moves = accounts.length ? await bankMovements(req, accounts.map((a) => a.id)) : [];
    return reply.send({
      accounts: accounts.map((a) => {
        const mine = moves.filter((m) => m.bankAccountId === a.id);
        const credits = mine.filter((m) => m.signed > 0).reduce((s, m) => s + m.signed, 0);
        const debits = mine.filter((m) => m.signed < 0).reduce((s, m) => s - m.signed, 0);
        return { ...a, credits, debits, balance: Number(a.openingBalance) + credits - debits, movements: mine.length };
      }),
    });
  });

  app.get('/:id/statement', { preHandler: requirePermission('finance.expenses.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const account = await req.db!.bankAccount.findFirst({ where: { id } });
    if (!account) throw notFound('Compte bancaire introuvable');
    const moves = (await bankMovements(req, [id])).sort((a, b) => a.date.getTime() - b.date.getTime());
    let balance = Number(account.openingBalance);
    const lines = moves.map((m) => {
      balance += m.signed;
      return { ...m, balance };
    });
    return reply.send({ account, openingBalance: Number(account.openingBalance), lines: lines.reverse(), balance });
  });

  app.post('/', { preHandler: requirePermission('finance.expenses.create') }, async (req, reply) => {
    const input = clean(bankAccountCreateSchema.parse(req.body));
    const account = await req.db!.bankAccount.create({
      data: {
        tenantId: req.auth!.tenantId,
        type: input.type ?? 'BANK',
        provider: input.provider || null,
        phoneNumber: input.phoneNumber ?? null,
        bankName: input.bankName,
        accountName: input.accountName,
        accountNumber: input.accountNumber ?? null,
        iban: input.iban ?? null,
        swift: input.swift ?? null,
        openingBalance: input.openingBalance ?? 0,
        branchId: input.branchId || null,
        notes: input.notes ?? null,
        createdById: req.auth!.userId,
      },
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'BANK_ACCOUNT_CREATED',
      entity: 'BankAccount',
      entityId: account.id,
      metadata: { bankName: account.bankName, accountName: account.accountName },
      ...requestMeta(req),
    });
    return reply.status(201).send({ account });
  });

  app.patch('/:id', { preHandler: requirePermission('finance.expenses.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(bankAccountCreateSchema.partial().parse(req.body));
    const res = await req.db!.bankAccount.updateMany({
      where: { id },
      data: { ...input, ...(input.branchId !== undefined ? { branchId: input.branchId || null } : {}) },
    });
    if (res.count === 0) throw notFound('Compte bancaire introuvable');
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'BANK_ACCOUNT_UPDATED',
      entity: 'BankAccount',
      entityId: id,
      metadata: { changes: Object.keys(input) },
      ...requestMeta(req),
    });
    const account = await req.db!.bankAccount.findFirst({ where: { id } });
    return reply.send({ account });
  });
}

async function suppliersRoutes(app: FastifyInstance) {
  /**
   * Liste avec indicateurs : commandes de verres en cours (rattachées par nom
   * de laboratoire, champ libre de la commande) et réceptions de stock.
   */
  app.get('/', { preHandler: requirePermission('suppliers.view') }, async (req, reply) => {
    const suppliers = await req.db!.supplier.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }], take: 500 });
    const [lensGroups, receptions] = await Promise.all([
      req.db!.lensOrder.groupBy({
        by: ['supplierName', 'status'],
        where: { supplierName: { not: null } },
        _count: { _all: true },
      }),
      req.db!.stockMovement.groupBy({
        by: ['supplierId'],
        where: { supplierId: { not: null } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ]);
    const key = (n: string | null) => (n ?? '').trim().toLowerCase();
    const open = new Map<string, number>();
    const total = new Map<string, number>();
    for (const g of lensGroups) {
      const k = key(g.supplierName);
      total.set(k, (total.get(k) ?? 0) + g._count._all);
      if (g.status !== 'DELIVERED' && g.status !== 'CANCELLED') open.set(k, (open.get(k) ?? 0) + g._count._all);
    }
    const rec = new Map(receptions.map((r) => [r.supplierId!, r]));
    return reply.send({
      suppliers: suppliers.map((s) => ({
        ...s,
        stats: {
          openLensOrders: open.get(key(s.name)) ?? 0,
          lensOrders: total.get(key(s.name)) ?? 0,
          receptions: rec.get(s.id)?._count._all ?? 0,
          lastReceptionAt: rec.get(s.id)?._max.createdAt ?? null,
        },
      })),
    });
  });

  /** Fiche détaillée : commandes de verres et dernières réceptions de stock. */
  app.get('/:id/activity', { preHandler: requirePermission('suppliers.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const supplier = await req.db!.supplier.findFirst({ where: { id } });
    if (!supplier) throw notFound('Fournisseur introuvable');
    const [lensOrders, movements] = await Promise.all([
      req.db!.lensOrder.findMany({
        where: { supplierName: { equals: supplier.name, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          number: true,
          status: true,
          description: true,
          expectedAt: true,
          createdAt: true,
          cost: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      }),
      req.db!.stockMovement.findMany({
        where: { supplierId: id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          quantity: true,
          unitCost: true,
          reason: true,
          createdAt: true,
          stockItem: { select: { product: { select: { name: true, sku: true } } } },
        },
      }),
    ]);
    return reply.send({
      lensOrders: lensOrders.map((o) => ({ ...o, cost: o.cost == null ? null : Number(o.cost) })),
      receptions: movements.map((m) => ({
        id: m.id,
        quantity: m.quantity,
        unitCost: m.unitCost == null ? null : Number(m.unitCost),
        reason: m.reason,
        createdAt: m.createdAt,
        productName: m.stockItem.product.name,
        sku: m.stockItem.product.sku,
      })),
    });
  });

  app.post('/', { preHandler: requirePermission('suppliers.create') }, async (req, reply) => {
    const input = clean(supplierCreateSchema.parse(req.body));
    const supplier = await req.db!.supplier.create({
      data: {
        tenantId: req.auth!.tenantId,
        name: input.name,
        type: input.type,
        contactName: input.contactName ?? null,
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        website: input.website ?? null,
        paymentTerms: input.paymentTerms ?? null,
        deliveryDays: input.deliveryDays ?? null,
        categories: input.categories ?? [],
        notes: input.notes ?? null,
      },
    });
    return reply.status(201).send({ supplier });
  });

  app.patch('/:id', { preHandler: requirePermission('suppliers.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(supplierUpdateSchema.parse(req.body));
    const res = await req.db!.supplier.updateMany({ where: { id }, data: input });
    if (res.count === 0) throw notFound('Fournisseur introuvable');
    const supplier = await req.db!.supplier.findFirst({ where: { id } });
    return reply.send({ supplier });
  });
}

export async function managementRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  await app.register(employeesRoutes, { prefix: '/employees' });
  await app.register(expensesRoutes, { prefix: '/expenses' });
  await app.register(cashTransfersRoutes, { prefix: '/cash-transfers' });
  await app.register(bankAccountsRoutes, { prefix: '/bank-accounts' });
  await app.register(suppliersRoutes, { prefix: '/suppliers' });
  // Assurances : contrats, garanties, bénéficiaires, prises en charge et
  // remboursements — voir insurance.routes.ts.
  await app.register(insuranceRoutes, { prefix: '/insurance' });
}
