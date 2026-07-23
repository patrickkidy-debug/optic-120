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
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound } from '../../lib/http-error.js';

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

  // Paiements trimestriels à venir : montants pris en charge par chaque assureur
  // sur le trimestre civil en cours, payables au début du trimestre suivant.
  app.get('/upcoming', { preHandler: requirePermission('insurance.view') }, async (req, reply) => {
    const now = new Date();
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const quarterStart = new Date(now.getFullYear(), qStartMonth, 1);
    const dueDate = new Date(now.getFullYear(), qStartMonth + 3, 1);

    const groups = await req.db!.sale.groupBy({
      by: ['insurerId'],
      where: {
        type: SaleType.SALE,
        status: { in: PAID_LIKE },
        insurerId: { not: null },
        insuranceAmount: { gt: 0 },
        createdAt: { gte: quarterStart },
      },
      _sum: { insuranceAmount: true },
      _count: { _all: true },
    });
    const insurers = await req.db!.insurer.findMany({ select: { id: true, name: true } });
    const items = groups
      .map((g) => ({
        insurerId: g.insurerId as string,
        name: insurers.find((i) => i.id === g.insurerId)?.name ?? '—',
        amount: Number(g._sum.insuranceAmount ?? 0),
        salesCount: g._count._all,
      }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return reply.send({
      items,
      total: items.reduce((s, x) => s + x.amount, 0),
      quarterStart: quarterStart.toISOString(),
      dueDate: dueDate.toISOString(),
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

export async function managementRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  await app.register(employeesRoutes, { prefix: '/employees' });
  await app.register(expensesRoutes, { prefix: '/expenses' });
  await app.register(suppliersRoutes, { prefix: '/suppliers' });
  await app.register(insurersRoutes, { prefix: '/insurance' });
}
