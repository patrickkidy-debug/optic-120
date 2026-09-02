import type { FastifyInstance } from 'fastify';
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  expenseCreateSchema,
  expenseUpdateSchema,
  supplierCreateSchema,
  supplierUpdateSchema,
  insurerCreateSchema,
  insurerUpdateSchema,
  SaleType,
  SaleStatus,
} from '@oculo/shared-types';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound, badRequest } from '../../lib/http-error.js';

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

const insurancePaymentSchema = z.object({
  insurerId: z.string().uuid(),
  monthStart: z.string().min(1),
  amount: z.number().positive().optional(),
});

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

async function expensesRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('finance.expenses.view') }, async (req, reply) => {
    const expenses = await req.db!.expense.findMany({ orderBy: { date: 'desc' }, take: 300 });
    return reply.send({ expenses });
  });

  app.get('/summary', { preHandler: requirePermission('finance.expenses.view') }, async (req, reply) => {
    const from = startOfMonth();
    const [revenueAgg, expenseAgg, byCategory] = await Promise.all([
      req.db!.sale.aggregate({
        where: { type: SaleType.SALE, status: { in: PAID_LIKE }, createdAt: { gte: from } },
        _sum: { paidAmount: true },
      }),
      req.db!.expense.aggregate({ where: { date: { gte: from } }, _sum: { amount: true } }),
      req.db!.expense.groupBy({
        by: ['category'],
        where: { date: { gte: from } },
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
      },
    });
    return reply.status(201).send({ expense });
  });

  app.patch('/:id', { preHandler: requirePermission('finance.expenses.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(expenseUpdateSchema.parse(req.body));
    const data: Record<string, unknown> = { ...input };
    if ('date' in input) data.date = toDate(input.date as string) ?? new Date();
    const res = await req.db!.expense.updateMany({ where: { id }, data });
    if (res.count === 0) throw notFound('Dépense introuvable');
    const expense = await req.db!.expense.findFirst({ where: { id } });
    return reply.send({ expense });
  });

  app.delete('/:id', { preHandler: requirePermission('finance.expenses.delete') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await req.db!.expense.deleteMany({ where: { id } });
    if (res.count === 0) throw notFound('Dépense introuvable');
    return reply.send({ ok: true });
  });
}

async function suppliersRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('suppliers.view') }, async (req, reply) => {
    const suppliers = await req.db!.supplier.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    return reply.send({ suppliers });
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
        email: input.email ?? null,
        address: input.address ?? null,
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

async function insurersRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const insurers = await req.db!.insurer.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    return reply.send({ insurers });
  });

  // Paiements mensuels à recevoir : permet de valider chaque mois séparément.
  app.get('/upcoming', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const { month } = req.query as { month?: string };
    const parsedMonth = month ? new Date(`${month}-01T00:00:00`) : new Date();
    if (Number.isNaN(parsedMonth.getTime())) throw badRequest('Mois invalide');
    const monthStart = new Date(parsedMonth.getFullYear(), parsedMonth.getMonth(), 1);
    const monthEnd = new Date(parsedMonth.getFullYear(), parsedMonth.getMonth() + 1, 1);

    const sales = await req.db!.sale.findMany({
      where: {
        type: SaleType.SALE,
        status: { in: PAID_LIKE },
        insurerId: { not: null },
        insuranceAmount: { gt: 0 },
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      select: { insurerId: true, insuranceAmount: true, insurerPaidAmount: true },
    });
    const insurers = await req.db!.insurer.findMany({ select: { id: true, name: true } });
    const byInsurer = new Map<string, { expected: number; received: number; remaining: number; salesCount: number }>();
    for (const sale of sales) {
      if (!sale.insurerId) continue;
      const expected = Number(sale.insuranceAmount);
      const received = Math.min(expected, Number(sale.insurerPaidAmount ?? 0));
      const remaining = Math.max(0, expected - received);
      const current = byInsurer.get(sale.insurerId) ?? { expected: 0, received: 0, remaining: 0, salesCount: 0 };
      current.expected += expected;
      current.received += received;
      current.remaining += remaining;
      current.salesCount += 1;
      byInsurer.set(sale.insurerId, current);
    }
    const items = [...byInsurer.entries()]
      .map(([insurerId, amounts]) => ({
        insurerId,
        name: insurers.find((i) => i.id === insurerId)?.name ?? '—',
        amount: amounts.remaining,
        expectedAmount: amounts.expected,
        receivedAmount: amounts.received,
        remainingAmount: amounts.remaining,
        salesCount: amounts.salesCount,
      }))
      .filter((x) => x.remainingAmount > 0)
      .sort((a, b) => b.amount - a.amount);

    return reply.send({
      items,
      total: items.reduce((s, x) => s + x.remainingAmount, 0),
      expectedTotal: items.reduce((s, x) => s + x.expectedAmount, 0),
      receivedTotal: items.reduce((s, x) => s + x.receivedAmount, 0),
      monthStart: monthStart.toISOString(),
      dueDate: monthEnd.toISOString(),
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

  // Résumé des remboursements assurance (widget tableau de bord) : payé
  // (marqué manuellement), en attente (mois en cours) et en retard
  // (échéance passée). Fenêtre glissante de 24 mois pour borner le scan.
  app.get('/summary', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const now = new Date();
    const since = new Date(now);
    since.setMonth(since.getMonth() - 24);
    const sales = await req.db!.sale.findMany({
      where: {
        type: SaleType.SALE,
        status: { in: PAID_LIKE },
        insurerId: { not: null },
        insuranceAmount: { gt: 0 },
        createdAt: { gte: since },
      },
      select: { insuranceAmount: true, insurerPaidAmount: true, createdAt: true },
    });

    let paid = 0;
    let pending = 0;
    let late = 0;
    for (const s of sales) {
      const amount = Number(s.insuranceAmount);
      const received = Math.min(amount, Number(s.insurerPaidAmount ?? 0));
      const remaining = Math.max(0, amount - received);
      paid += received;
      if (remaining <= 0) continue;
      const dueDate = new Date(s.createdAt.getFullYear(), s.createdAt.getMonth() + 1, 1);
      if (dueDate < now) late += remaining;
      else pending += remaining;
    }

    return reply.send({ paid, pending, late, toCollect: pending + late });
  });

  // Enregistre un montant reçu de l'assureur pour un mois donné. Sans montant,
  // le solde restant du mois est marqué comme reçu.
  app.post('/mark-paid', { preHandler: requirePermission('insurance.update') }, async (req, reply) => {
    const { insurerId, monthStart, amount } = insurancePaymentSchema.parse(req.body);
    const start = new Date(monthStart);
    if (Number.isNaN(start.getTime())) throw badRequest('Mois invalide');
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const sales = await req.db!.sale.findMany({
      where: {
        insurerId,
        type: SaleType.SALE,
        status: { in: PAID_LIKE },
        insuranceAmount: { gt: 0 },
        createdAt: { gte: start, lt: end },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, insuranceAmount: true, insurerPaidAmount: true },
    });
    const totalRemaining = sales.reduce(
      (sum, sale) => sum + Math.max(0, Number(sale.insuranceAmount) - Number(sale.insurerPaidAmount ?? 0)),
      0,
    );
    let remainingToApply = amount == null ? totalRemaining : Math.min(amount, totalRemaining);
    if (remainingToApply <= 0) return reply.send({ ok: true, count: 0, receivedAmount: 0, remainingAmount: totalRemaining });

    const now = new Date();
    let count = 0;
    let receivedAmount = 0;
    for (const sale of sales) {
      const expected = Number(sale.insuranceAmount);
      const alreadyReceived = Number(sale.insurerPaidAmount ?? 0);
      const saleRemaining = Math.max(0, expected - alreadyReceived);
      if (saleRemaining <= 0) continue;
      const applied = Math.min(saleRemaining, remainingToApply);
      const nextPaidAmount = alreadyReceived + applied;
      await req.db!.sale.update({
        where: { id: sale.id },
        data: {
          insurerPaidAmount: nextPaidAmount,
          insurerPaidAt: nextPaidAmount >= expected ? now : null,
        },
      });
      count += 1;
      receivedAmount += applied;
      remainingToApply -= applied;
      if (remainingToApply <= 0) break;
    }

    return reply.send({
      ok: true,
      count,
      receivedAmount,
      remainingAmount: Math.max(0, totalRemaining - receivedAmount),
    });
  });
}

export async function managementRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  await app.register(employeesRoutes, { prefix: '/employees' });
  await app.register(expensesRoutes, { prefix: '/expenses' });
  await app.register(suppliersRoutes, { prefix: '/suppliers' });
  await app.register(insurersRoutes, { prefix: '/insurance' });
}
