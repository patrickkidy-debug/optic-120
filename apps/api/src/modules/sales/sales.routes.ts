import type { FastifyInstance } from 'fastify';
import { saleCreateSchema, saleUpdateSchema, paymentCreateSchema, SaleType } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { forbidden, notFound, conflict } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import * as salesService from './sales.service.js';

export async function salesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('optique.sales.view') }, async (req, reply) => {
    const q = req.query as {
      branchId?: string;
      status?: string;
      type?: string;
      search?: string;
      page?: string;
      pageSize?: string;
    };
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? '25', 10)));
    const where: Record<string, unknown> = {};
    if (q.branchId) where.branchId = q.branchId;
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    // Recherche sur toute l'historique, sans restriction de période : numéro de
    // pièce, nom du client ou téléphone. C'est le seul moyen de retrouver une
    // vente ancienne, la liste étant paginée du plus récent au plus ancien.
    const search = q.search?.trim();
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customer: { firstName: { contains: search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    const [rows, total] = await Promise.all([
      req.db!.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: true,
          branch: true,
          insurer: { select: { name: true } },
          _count: { select: { items: true } },
          // Moyens d'encaissement réellement utilisés (paiements réussis).
          payments: { where: { status: 'SUCCESS' }, select: { method: true } },
        },
      }),
      req.db!.sale.count({ where }),
    ]);
    // Méthodes distinctes par vente (une vente échelonnée peut cumuler plusieurs
    // moyens : espèces + Wave, par exemple). La part prise en charge par une
    // assurance n'est pas un paiement enregistré : on l'expose explicitement
    // pour qu'elle apparaisse comme les autres moyens.
    const items = rows.map((s) => ({
      ...s,
      paymentMethods: [
        ...(Number(s.insuranceAmount) > 0 ? ['INSURANCE'] : []),
        ...new Set(s.payments.map((p) => p.method)),
      ],
      insurerName: s.insurer?.name ?? null,
    }));
    return reply.send({ items, total, page, pageSize });
  });

  // Créances : ventes non soldées (solde restant dû ou part assurance non encore encaissée).
  app.get('/receivables', { preHandler: requirePermission('optique.sales.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string };
    const where: Record<string, unknown> = {
      type: SaleType.SALE,
      status: { in: ['CONFIRMED', 'PARTIALLY_PAID', 'PAID'] },
    };
    if (q.branchId) where.branchId = q.branchId;
    const sales = await req.db!.sale.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { customer: true, branch: true, insurer: true },
    });
    const items = sales
      .map((s) => {
        const total = Number(s.totalAmount);
        const paid = Number(s.paidAmount);
        const balance = Math.max(0, total - paid);
        const insuranceAmount = Number(s.insuranceAmount);
        const insurerPaidAmount = Math.min(insuranceAmount, Number(s.insurerPaidAmount ?? 0));
        const insuranceRemaining = Math.max(0, insuranceAmount - insurerPaidAmount);
        const isInsuranceUnpaid = insuranceRemaining > 0;
        return {
          id: s.id,
          number: s.number,
          customer: s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : null,
          customerPhone: s.customer?.phone ?? null,
          branch: s.branch.name,
          total,
          paid,
          balance,
          insuranceAmount,
          insurerPaidAmount,
          insuranceRemaining,
          insurerName: s.insurer?.name ?? null,
          insurerId: s.insurerId,
          insurerPaidAt: s.insurerPaidAt,
          isInsuranceUnpaid,
          createdAt: s.createdAt,
        };
      })
      .filter((s) => s.balance > 0 || s.isInsuranceUnpaid);
    const totalOutstanding = items.reduce((sum, s) => sum + s.balance, 0);
    const totalInsuranceOutstanding = items.reduce(
      (sum, s) => sum + (s.isInsuranceUnpaid ? s.insuranceRemaining : 0),
      0,
    );
    return reply.send({
      totalOutstanding,
      totalInsuranceOutstanding,
      count: items.length,
      items,
    });
  });

  // Rapport de ventes sur une période (résumé + lignes) pour l'export CSV.
  app.get('/report', { preHandler: requirePermission('optique.sales.view') }, async (req, reply) => {
    const q = req.query as { from?: string; to?: string; branchId?: string };
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const to = q.to ? new Date(q.to) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    const where: Record<string, unknown> = {
      type: SaleType.SALE,
      createdAt: { gte: from, lte: to },
    };
    if (q.branchId) where.branchId = q.branchId;
    const sales = await req.db!.sale.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { customer: true, branch: true },
    });
    const rows = sales.map((s) => ({
      number: s.number,
      date: s.createdAt,
      customer: s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : '',
      branch: s.branch.name,
      status: s.status,
      total: Number(s.totalAmount),
      paid: Number(s.paidAmount),
      balance: Number(s.totalAmount) - Number(s.paidAmount),
    }));
    const active = rows.filter((r) => r.status !== 'CANCELLED');
    const revenue = active.reduce((sum, r) => sum + r.paid, 0);
    const count = active.length;
    const avgBasket = count > 0 ? Math.round(revenue / count) : 0;
    return reply.send({ from, to, summary: { revenue, count, avgBasket }, rows });
  });

  app.get('/:id', { preHandler: requirePermission('optique.sales.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sale = await req.db!.sale.findFirst({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
        branch: true,
        payments: true,
        insurer: { select: { name: true } },
        // Ordonnance jointe : reprise sur le devis / la facture imprimés.
        prescription: true,
        cashier: { select: { firstName: true, lastName: true } },
      },
    });
    if (!sale) throw notFound('Vente introuvable');
    // Nom de l'assureur exposé à plat : la part prise en charge s'affiche comme
    // un moyen de règlement dans le détail de la vente.
    return reply.send({ sale: { ...sale, insurerName: sale.insurer?.name ?? null } });
  });

  app.post('/', async (req, reply) => {
    const input = saleCreateSchema.parse(req.body);
    // Un devis n'engage rien (ni stock ni encaissement) : savoir vendre suffit
    // à savoir chiffrer. On accepte donc l'une ou l'autre permission, plutôt
    // que de bloquer un caissier ou une secrétaire sur une simple estimation.
    const allowed =
      input.type === SaleType.QUOTE
        ? ['optique.quotes.create', 'optique.sales.create']
        : ['optique.sales.create'];
    if (!allowed.some((p) => req.auth!.permissions.has(p))) {
      throw forbidden(`Permission requise : ${allowed.join(' ou ')}`);
    }
    assertBranchAccess(req, input.branchId);

    const sale = await salesService.createSale(req.auth!.tenantId, req.auth!.userId, input);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: input.type === SaleType.QUOTE ? 'QUOTE_CREATED' : 'SALE_CREATED',
      entity: 'Sale',
      entityId: sale.id,
      metadata: { number: sale.number, total: Number(sale.totalAmount) },
      ...requestMeta(req),
    });
    return reply.status(201).send({ sale });
  });

  // Modification d'une vente ou d'un devis (articles, remise, prise en charge,
  // assureur, TVA, client). Le stock et les montants sont réajustés côté serveur.
  app.patch('/:id', { preHandler: requirePermission('optique.sales.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = saleUpdateSchema.parse(req.body);
    const sale = await salesService.updateSale(req.auth!.tenantId, id, req.auth!.userId, input);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: sale.type === SaleType.QUOTE ? 'QUOTE_UPDATED' : 'SALE_UPDATED',
      entity: 'Sale',
      entityId: id,
      metadata: { number: sale.number, total: Number(sale.totalAmount) },
      ...requestMeta(req),
    });
    return reply.send({ sale });
  });

  app.patch('/:id/cancel', { preHandler: requirePermission('optique.sales.cancel') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sale = await salesService.cancelSale(req.auth!.tenantId, id, req.auth!.userId);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'SALE_CANCELLED',
      entity: 'Sale',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ sale });
  });

  app.post('/:id/convert-quote', { preHandler: requirePermission('optique.quotes.convert') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sale = await salesService.convertQuote(req.auth!.tenantId, id, req.auth!.userId);
    return reply.send({ sale });
  });

  // Retour / avoir : rembourse une vente et réapprovisionne le stock.
  app.post('/:id/return', { preHandler: requirePermission('optique.sales.refund') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sale = await salesService.createReturn(req.auth!.tenantId, id, req.auth!.userId);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'SALE_RETURNED',
      entity: 'Sale',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.status(201).send({ sale });
  });

  app.post('/:id/payments', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = paymentCreateSchema.parse(req.body);

    // Aucun encaissement sans session de caisse ouverte : sinon l'argent
    // rentre en dehors de toute session et le fond de caisse ne peut plus
    // être rapproché à la fermeture.
    const sale = await req.db!.sale.findFirst({ where: { id }, select: { branchId: true } });
    if (!sale) throw notFound('Vente introuvable');
    const openRegister = await req.db!.cashRegister.findFirst({
      where: { branchId: sale.branchId, status: 'OPEN' },
      select: { id: true },
    });
    if (!openRegister) {
      throw conflict("La caisse n'est pas ouverte. Ouvrez la caisse avant d'encaisser cette vente.");
    }

    const result = await salesService.addPayment(req.auth!.tenantId, req.auth!.userId, id, input);
    return reply.status(201).send(result);
  });
}
