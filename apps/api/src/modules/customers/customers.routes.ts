import type { FastifyInstance } from 'fastify';
import { customerCreateSchema, prescriptionCreateSchema, type Gender } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { notFound, badRequest, forbidden } from '../../lib/http-error.js';
import type { FastifyRequest } from 'fastify';
import { getOpticalSettings, addMonths } from '../../lib/optical-settings.js';

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


/**
 * Portée client d'une requête : le magasin demandé, plus les fiches qui ne
 * sont rattachées à aucun magasin (clients antérieurs au cloisonnement, sans
 * vente). Le filtre est posé côté serveur et non dans l'interface : un
 * `branchId` fourni par le client est d'abord vérifié contre les droits de
 * l'utilisateur, sinon n'importe qui lirait le fichier d'un autre magasin en
 * changeant un paramètre d'URL.
 *
 * Sans `branchId` demandé, on retombe sur les magasins de l'utilisateur —
 * aucune portée implicite « tout l'établissement » pour un vendeur rattaché à
 * un seul magasin.
 */
function customerScope(req: FastifyRequest, branchId?: string) {
  if (branchId) {
    assertBranchAccess(req, branchId);
    return { OR: [{ branchId }, { branchId: null }] };
  }
  if (req.auth!.allBranches) return {};
  const ids = req.auth!.branchIds ?? [];
  return { OR: [{ branchId: { in: ids } }, { branchId: null }] };
}

/** Refuse la lecture d'une fiche appartenant à un magasin non autorisé. */
function assertCustomerVisible(req: FastifyRequest, customerBranchId: string | null): void {
  if (customerBranchId === null) return;
  if (req.auth!.allBranches) return;
  if (!(req.auth!.branchIds ?? []).includes(customerBranchId)) {
    throw forbidden("Ce client appartient à un autre magasin");
  }
}

export async function customersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('optique.customers.view') }, async (req, reply) => {
    const q = req.query as { search?: string; branchId?: string };
    const search = q.search
      ? {
          OR: [
            { firstName: { contains: q.search, mode: 'insensitive' as const } },
            { lastName: { contains: q.search, mode: 'insensitive' as const } },
            { phone: { contains: q.search } },
          ],
        }
      : {};
    const where = { AND: [search, customerScope(req, q.branchId)] };
    const customers = await req.db!.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return reply.send({ customers });
  });

  app.post('/', { preHandler: requirePermission('optique.customers.create') }, async (req, reply) => {
    const input = customerCreateSchema.parse(req.body);
    // Le magasin propriétaire est obligatoire à la création : une fiche créée
    // sans rattachement serait visible par tous les magasins, exactement ce que
    // le cloisonnement doit empêcher.
    const branchId = (req.body as { branchId?: string }).branchId;
    if (!branchId) throw badRequest('Magasin requis pour créer un client');
    assertBranchAccess(req, branchId);
    const customer = await req.db!.customer.create({
      data: {
        tenantId: req.auth!.tenantId,
        branchId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email || null,
        dateOfBirth: toDate(input.dateOfBirth),
        gender: input.gender || null,
        address: input.address || null,
        profession: input.profession || null,
        notes: input.notes || null,
      },
    });
    return reply.status(201).send({ customer });
  });

  app.patch('/:id', { preHandler: requirePermission('optique.customers.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = customerCreateSchema.partial().parse(req.body);
    // Modifier suppose de pouvoir voir : sans ce contrôle, un magasin éditerait
    // la fiche d'un autre en connaissant seulement son identifiant.
    const existing = await req.db!.customer.findFirst({ where: { id }, select: { branchId: true } });
    if (!existing) throw notFound('Client introuvable');
    assertCustomerVisible(req, existing.branchId);
    // `clean` remplace les chaînes vides par null (champ effacé) ; la date de
    // naissance et le genre demandent une conversion explicite.
    const { dateOfBirth, gender, ...rest } = clean(input);
    const result = await req.db!.customer.updateMany({
      where: { id },
      data: {
        ...rest,
        ...(dateOfBirth === undefined ? {} : { dateOfBirth: toDate(dateOfBirth as string | null) }),
        ...(gender === undefined ? {} : { gender: (gender as Gender | null) || null }),
      },
    });
    if (result.count === 0) throw notFound('Client introuvable');
    const customer = await req.db!.customer.findFirst({ where: { id } });
    // Quand la fiche est liée à la clinique, les coordonnées communes restent
    // cohérentes sans toucher aux données médicales du patient.
    if (customer) {
      await req.db!.patient.updateMany({
        where: { customerId: customer.id },
        data: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          gender: customer.gender,
          dateOfBirth: customer.dateOfBirth,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
        },
      });
    }
    return reply.send({ customer });
  });

  // Fiche client complète : ordonnances, achats (avec articles), commandes
  // de verres et réparations — tout ce qui est rattaché au client.
  app.get('/:id', { preHandler: requirePermission('optique.customers.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const customer = await req.db!.customer.findFirst({
      where: { id },
      include: {
        prescriptions: { orderBy: { date: 'desc' } },
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            items: { include: { product: { select: { name: true, sku: true, category: true } } } },
            branch: { select: { name: true } },
          },
        },
        lensOrders: { orderBy: { createdAt: 'desc' }, take: 20 },
        repairs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!customer) throw notFound('Client introuvable');
    assertCustomerVisible(req, customer.branchId);
    return reply.send({ customer });
  });

  // Ordonnances optiques d'un client.
  app.get(
    '/:id/prescriptions',
    { preHandler: requirePermission('optique.prescriptions.view') },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const prescriptions = await req.db!.opticalPrescription.findMany({
        where: { customerId: id },
        orderBy: { date: 'desc' },
      });
      return reply.send({ prescriptions });
    },
  );

  app.post(
    '/:id/prescriptions',
    { preHandler: requirePermission('optique.prescriptions.create') },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const customer = await req.db!.customer.findFirst({ where: { id } });
      if (!customer) throw notFound('Client introuvable');
      const input = clean(prescriptionCreateSchema.parse(req.body));
      const { date, expiresAt, ...rest } = input;
      const issuedAt = toDate(date) ?? new Date();
      // Fin de validité : celle saisie, sinon calculée depuis les réglages.
      const settings = await getOpticalSettings(req.auth!.tenantId);
      const prescription = await req.db!.opticalPrescription.create({
        data: {
          tenantId: req.auth!.tenantId,
          customerId: id,
          date: issuedAt,
          expiresAt: toDate(expiresAt) ?? addMonths(issuedAt, settings.prescriptionValidityMonths),
          createdById: req.auth!.userId,
          ...rest,
        },
      });
      return reply.status(201).send({ prescription });
    },
  );

  app.patch(
    '/:id/prescriptions/:prescriptionId',
    { preHandler: requirePermission('optique.prescriptions.create') },
    async (req, reply) => {
      const { id, prescriptionId } = req.params as { id: string; prescriptionId: string };
      const existing = await req.db!.opticalPrescription.findFirst({
        where: { id: prescriptionId, customerId: id },
      });
      if (!existing) throw notFound('Ordonnance introuvable');
      const input = clean(prescriptionCreateSchema.partial().parse(req.body));
      const { date, expiresAt, ...rest } = input;
      const result = await req.db!.opticalPrescription.updateMany({
        where: { id: prescriptionId },
        data: {
          ...(date ? { date: new Date(date) } : {}),
          ...(expiresAt !== undefined ? { expiresAt: toDate(expiresAt) } : {}),
          ...rest,
        },
      });
      if (result.count === 0) throw notFound('Ordonnance introuvable');
      const prescription = await req.db!.opticalPrescription.findFirst({
        where: { id: prescriptionId },
      });
      return reply.send({ prescription });
    },
  );

  app.delete(
    '/:id/prescriptions/:prescriptionId',
    { preHandler: requirePermission('optique.prescriptions.create') },
    async (req, reply) => {
      const { id, prescriptionId } = req.params as { id: string; prescriptionId: string };
      const existing = await req.db!.opticalPrescription.findFirst({
        where: { id: prescriptionId, customerId: id },
      });
      if (!existing) throw notFound('Ordonnance introuvable');
      const result = await req.db!.opticalPrescription.deleteMany({ where: { id: prescriptionId } });
      if (result.count === 0) throw notFound('Ordonnance introuvable');
      return reply.send({ ok: true });
    },
  );
}
