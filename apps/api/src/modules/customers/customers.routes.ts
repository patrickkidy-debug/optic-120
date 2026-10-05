import type { FastifyInstance } from 'fastify';
import { customerCreateSchema, prescriptionCreateSchema, type Gender } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { notFound, badRequest, forbidden } from '../../lib/http-error.js';
import type { FastifyRequest } from 'fastify';
import { getOpticalSettings, addMonths } from '../../lib/optical-settings.js';
import {
  DIRECTORY_SEGMENTS,
  DIRECTORY_VISITS,
  customerCode,
  getCustomerSummary,
  getDirectory,
  type DirectorySegment,
  type DirectorySort,
  type DirectoryVisit,
} from './customers.directory.js';

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

  // Annuaire de la page Clients : paginé, filtrable, enrichi (dernière visite,
  // dernier achat, ordonnance, total dépensé) + compteurs du haut de page.
  // GET / reste inchangé : la caisse et d'autres écrans s'en servent.
  app.get('/directory', { preHandler: requirePermission('optique.customers.view') }, async (req, reply) => {
    const q = req.query as {
      search?: string;
      branchId?: string;
      page?: string;
      pageSize?: string;
      segments?: string;
      visit?: string;
      sort?: string;
    };
    const segments = (q.segments ?? '')
      .split(',')
      .filter((x): x is DirectorySegment => (DIRECTORY_SEGMENTS as readonly string[]).includes(x));
    const visit = (DIRECTORY_VISITS as readonly string[]).includes(q.visit ?? '') ? (q.visit as DirectoryVisit) : undefined;
    const sort = (['recent', 'visit', 'name', 'spent'] as const).includes(q.sort as DirectorySort) ? (q.sort as DirectorySort) : 'recent';
    const result = await getDirectory(req.db!, req.auth!.tenantId, {
      scope: customerScope(req, q.branchId),
      search: q.search?.slice(0, 80),
      segments,
      visit,
      sort,
      page: Math.max(1, Number.parseInt(q.page ?? '1', 10) || 1),
      pageSize: Math.min(100, Math.max(10, Number.parseInt(q.pageSize ?? '25', 10) || 25)),
    });
    return reply.send(result);
  });

  // Anniversaires à venir (aujourd'hui → `days` jours), pour souhaiter
  // l'anniversaire des clients. Calculé en UTC sur le jour et le mois.
  app.get('/birthdays', { preHandler: requirePermission('optique.customers.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string; days?: string };
    const days = Math.min(60, Math.max(0, Number.parseInt(q.days ?? '30', 10) || 30));
    const rows = await req.db!.customer.findMany({
      where: { AND: [customerScope(req, q.branchId), { dateOfBirth: { not: null } }] },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, dateOfBirth: true },
    });
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const DAY = 86_400_000;
    const birthdays = rows
      .map((c) => {
        const dob = c.dateOfBirth!;
        const m = dob.getUTCMonth();
        const d = dob.getUTCDate();
        // Prochain anniversaire ; un 29 février se fête le 28 les années non bissextiles.
        const at = (y: number) => {
          const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
          return Date.UTC(y, m, m === 1 && d === 29 && !leap ? 28 : d);
        };
        let year = now.getUTCFullYear();
        let next = at(year);
        if (next < today) next = at(++year);
        return {
          ...c,
          nextBirthday: new Date(next).toISOString(),
          daysUntil: Math.round((next - today) / DAY),
          turning: year - dob.getUTCFullYear(),
        };
      })
      .filter((c) => c.daysUntil <= days && c.turning > 0)
      .sort((a, b) => a.daysUntil - b.daysUntil || a.lastName.localeCompare(b.lastName));
    return reply.send({ birthdays, withBirthDate: rows.length });
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
    // Dossier patient : synthèse sur tout l'historique, et volet clinique
    // (consultations, rendez-vous) seulement pour qui a le droit de le voir.
    const perms = req.auth!.permissions;
    const canConsult = perms.has('clinic.consultations.view');
    const canAppoint = perms.has('clinic.appointments.view');
    const [summary, patient] = await Promise.all([
      getCustomerSummary(req.db!, id),
      canConsult || canAppoint
        ? req.db!.patient.findFirst({
            where: { customerId: id },
            select: {
              id: true,
              consultations: canConsult
                ? {
                    orderBy: { date: 'desc' },
                    take: 20,
                    select: { id: true, date: true, practitionerName: true, diagnosis: true, visualAcuityRight: true, visualAcuityLeft: true, lensType: true },
                  }
                : false,
              appointments: canAppoint
                ? {
                    orderBy: { scheduledAt: 'desc' },
                    take: 20,
                    select: { id: true, scheduledAt: true, status: true, reason: true },
                  }
                : false,
            },
          })
        : Promise.resolve(null),
    ]);
    return reply.send({ customer: { ...customer, code: customerCode(customer.id), summary, clinic: patient } });
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
