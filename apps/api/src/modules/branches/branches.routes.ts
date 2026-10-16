import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { BRANCH_PERIODS, branchCreateSchema, branchTeamSchema, branchUpdateSchema, type BranchPeriod } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { assertBranchAccess, hasAllBranches, requirePermission } from '../../middlewares/rbac-guard.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { isOperatorEmail } from '../../lib/operators.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import { assertWithinLimit } from '../billing/billing.service.js';
import * as svc from './branches.service.js';

/** Même règle que requirePermission : le fondateur / opérateur plateforme a tous les droits. */
const allowed = (req: FastifyRequest, p: string) => req.auth!.permissions.has(p) || isOperatorEmail(req.auth!.email);

const scopeOf = (req: FastifyRequest): svc.BranchScope => (hasAllBranches(req) ? null : req.auth!.branchIds);
const periodOf = (v: unknown): BranchPeriod => (BRANCH_PERIODS.includes(v as BranchPeriod) ? (v as BranchPeriod) : 'month');
/** Chaîne vide du formulaire → null en base (champ effacé). */
const nul = (v: string | undefined) => (v === undefined ? undefined : v.trim() === '' ? null : v.trim());

async function assertManager(tenantId: string, managerId: string | null | undefined) {
  if (!managerId) return;
  const u = await prisma.user.findFirst({ where: { id: managerId, tenantId, isActive: true }, select: { id: true } });
  if (!u) throw badRequest('Responsable introuvable ou désactivé');
}

/** Un nom identique (hors archives) dans le même établissement est presque toujours un doublon. */
async function assertNoDuplicate(tenantId: string, name: string, city: string | null | undefined, exceptId?: string) {
  const same = await prisma.branch.findFirst({
    where: { tenantId, archivedAt: null, name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { name: true, city: true },
  });
  if (same && (!city || !same.city || same.city.toLowerCase() === city.toLowerCase())) {
    throw conflict(`Un magasin « ${same.name} »${same.city ? ` (${same.city})` : ''} existe déjà.`);
  }
}

function uniqueCodeError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

export async function branchesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // Liste simple (sélecteurs) : magasins autorisés, archivés exclus sauf demande.
  app.get('/', async (req, reply) => {
    const q = req.query as { includeArchived?: string };
    const scope = scopeOf(req);
    const [tenant, branches] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: req.auth!.tenantId }, select: { mainBranchId: true } }),
      req.db!.branch.findMany({
        where: { ...(scope ? { id: { in: scope.length ? scope : ['__none__'] } } : {}), ...(q.includeArchived === '1' ? {} : { archivedAt: null }) },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, code: true, city: true, address: true, phone: true, isActive: true, archivedAt: true, createdAt: true, logoUrl: true },
      }),
    ]);
    return reply.send({ branches: branches.map((b) => ({ ...b, isMain: b.id === tenant?.mainBranchId })) });
  });

  // Synthèse de la page Magasins : indicateurs par magasin et totaux.
  app.get('/overview', { preHandler: requirePermission('settings.branches.view') }, async (req, reply) => {
    const q = req.query as { period?: string; includeArchived?: string };
    const data = await svc.getOverview(req.auth!.tenantId, scopeOf(req), {
      period: periodOf(q.period),
      // Même droit que le tableau de bord, qui affiche déjà le CA du magasin.
      revenue: allowed(req, 'dashboard.view'),
      includeArchived: q.includeArchived === '1',
    });
    return reply.send({
      ...data,
      permissions: {
        revenue: allowed(req, 'dashboard.view'),
        create: allowed(req, 'settings.branches.create'),
        update: allowed(req, 'settings.branches.update'),
        team: allowed(req, 'rbac.users.update'),
        allBranches: hasAllBranches(req),
      },
    });
  });

  // Code interne proposé pour un nouveau magasin.
  app.get('/next-code', { preHandler: requirePermission('settings.branches.create') }, async (req, reply) => {
    return reply.send({ code: await svc.nextBranchCode(req.auth!.tenantId) });
  });

  // Fiche détaillée : chaque bloc n'est calculé que si l'utilisateur y a droit.
  app.get('/:id', { preHandler: requirePermission('settings.branches.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { period?: string };
    assertBranchAccess(req, id);
    const data = await svc.getBranchDetail(req.auth!.tenantId, id, {
      period: periodOf(q.period),
      revenue: allowed(req, 'dashboard.view'),
      sales: allowed(req, 'optique.sales.view'),
      team: allowed(req, 'rbac.users.view'),
      stock: allowed(req, 'optique.stock.view'),
    });
    if (!data) throw notFound('Magasin introuvable');
    return reply.send({
      ...data,
      permissions: {
        revenue: allowed(req, 'dashboard.view'),
        sales: allowed(req, 'optique.sales.view'),
        team: allowed(req, 'rbac.users.view'),
        teamEdit: allowed(req, 'rbac.users.update'),
        stock: allowed(req, 'optique.stock.view'),
        transfer: allowed(req, 'optique.stock.transfer'),
        update: allowed(req, 'settings.branches.update'),
        setMain: allowed(req, 'settings.branches.update') && hasAllBranches(req),
      },
    });
  });

  app.post('/', { preHandler: requirePermission('settings.branches.create') }, async (req, reply) => {
    const input = branchCreateSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;
    await assertWithinLimit(tenantId, 'branches');
    await assertNoDuplicate(tenantId, input.name, input.city);
    await assertManager(tenantId, input.managerId);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { countryCode: true, mainBranchId: true } });

    let branch;
    for (let attempt = 0; ; attempt++) {
      const code = input.code || (await svc.nextBranchCode(tenantId));
      try {
        branch = await prisma.$transaction(async (tx) => {
          const b = await tx.branch.create({
            data: {
              tenantId,
              name: input.name.trim(),
              code,
              city: nul(input.city) ?? '',
              countryCode: nul(input.countryCode) ?? tenant?.countryCode ?? null,
              address: nul(input.address),
              phone: nul(input.phone),
              whatsapp: nul(input.whatsapp),
              email: nul(input.email),
              logoUrl: nul(input.logoUrl),
              managerId: input.managerId ?? null,
              openingHours: input.openingHours ?? Prisma.JsonNull,
              isActive: input.isActive ?? true,
            },
          });
          // Un créateur limité à ses magasins garde l'accès à celui qu'il crée,
          // et le responsable désigné y est affecté.
          const assign = new Set<string>();
          if (!hasAllBranches(req)) assign.add(req.auth!.userId);
          if (input.managerId) assign.add(input.managerId);
          if (assign.size) await tx.userBranch.createMany({ data: [...assign].map((userId) => ({ userId, branchId: b.id })), skipDuplicates: true });
          if (!tenant?.mainBranchId) await tx.tenant.update({ where: { id: tenantId }, data: { mainBranchId: b.id } });
          return b;
        });
        break;
      } catch (e) {
        if (!uniqueCodeError(e)) throw e;
        if (input.code) throw conflict(`Le code « ${input.code} » est déjà utilisé par un autre magasin.`);
        if (attempt >= 2) throw e; // course improbable sur le code généré : nouvel essai
      }
    }
    await recordAudit({
      tenantId, userId: req.auth!.userId, action: 'BRANCH_CREATED', entity: 'Branch', entityId: branch.id,
      metadata: { name: branch.name, code: branch.code, managerId: branch.managerId }, ...requestMeta(req),
    });
    return reply.status(201).send({ branch });
  });

  app.patch('/:id', { preHandler: requirePermission('settings.branches.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    assertBranchAccess(req, id);
    const input = branchUpdateSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;
    const before = await prisma.branch.findFirst({ where: { id, tenantId } });
    if (!before) throw notFound('Magasin introuvable');
    if (before.archivedAt) throw badRequest('Magasin archivé : restaurez-le avant de le modifier.');
    if (input.name) await assertNoDuplicate(tenantId, input.name, input.city ?? before.city, id);
    if (input.managerId !== undefined) await assertManager(tenantId, input.managerId);
    if (input.isActive === false) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { mainBranchId: true } });
      if (tenant?.mainBranchId === id) throw badRequest("Le magasin principal ne peut pas être désactivé : définissez d'abord un autre magasin principal.");
    }

    const data: Prisma.BranchUncheckedUpdateInput = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.code !== undefined && input.code !== '' ? { code: input.code } : {}),
      ...(input.city !== undefined ? { city: nul(input.city) ?? '' } : {}),
      ...(input.countryCode !== undefined ? { countryCode: nul(input.countryCode) } : {}),
      ...(input.address !== undefined ? { address: nul(input.address) } : {}),
      ...(input.phone !== undefined ? { phone: nul(input.phone) } : {}),
      ...(input.whatsapp !== undefined ? { whatsapp: nul(input.whatsapp) } : {}),
      ...(input.email !== undefined ? { email: nul(input.email) } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: nul(input.logoUrl) } : {}),
      ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
      ...(input.openingHours !== undefined ? { openingHours: input.openingHours ?? Prisma.JsonNull } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
    let branch;
    try {
      branch = await prisma.$transaction(async (tx) => {
        const b = await tx.branch.update({ where: { id }, data });
        // Le responsable doit avoir accès au magasin qu'il dirige.
        if (input.managerId) await tx.userBranch.createMany({ data: [{ userId: input.managerId, branchId: id }], skipDuplicates: true });
        return b;
      });
    } catch (e) {
      if (uniqueCodeError(e)) throw conflict(`Le code « ${input.code} » est déjà utilisé par un autre magasin.`);
      throw e;
    }

    const changed = Object.keys(data).filter((k) => k !== 'logoUrl' && JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify((branch as Record<string, unknown>)[k] ?? null));
    if (input.logoUrl !== undefined && before.logoUrl !== branch.logoUrl) changed.push('logoUrl');
    const meta = requestMeta(req);
    if (changed.length) {
      await recordAudit({ tenantId, userId: req.auth!.userId, action: 'BRANCH_UPDATED', entity: 'Branch', entityId: id, metadata: { name: branch.name, changed }, ...meta });
    }
    if (before.managerId !== branch.managerId) {
      await recordAudit({ tenantId, userId: req.auth!.userId, action: 'BRANCH_MANAGER_CHANGED', entity: 'Branch', entityId: id, metadata: { name: branch.name, from: before.managerId, to: branch.managerId }, ...meta });
    }
    return reply.send({ branch });
  });

  // Équipe : remplace la liste des collaborateurs AFFECTÉS à ce magasin (les
  // rôles « tous les magasins » y ont accès sans affectation).
  app.put('/:id/team', { preHandler: requirePermission('rbac.users.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    assertBranchAccess(req, id);
    const tenantId = req.auth!.tenantId;
    const { userIds } = branchTeamSchema.parse(req.body);
    const branch = await prisma.branch.findFirst({ where: { id, tenantId }, select: { id: true, name: true, managerId: true, archivedAt: true } });
    if (!branch) throw notFound('Magasin introuvable');
    if (branch.archivedAt) throw badRequest('Magasin archivé : son équipe ne peut plus être modifiée.');
    const wanted = new Set(userIds);
    const valid = await prisma.user.count({ where: { tenantId, id: { in: [...wanted] } } });
    if (valid !== wanted.size) throw badRequest('Un ou plusieurs collaborateurs sont invalides');

    const current = await prisma.userBranch.findMany({ where: { branchId: id, user: { tenantId } }, select: { userId: true } });
    const added = [...wanted].filter((u) => !current.some((c) => c.userId === u));
    const removed = current.map((c) => c.userId).filter((u) => !wanted.has(u));
    if (branch.managerId && removed.includes(branch.managerId)) {
      throw badRequest("Le responsable du magasin ne peut pas être retiré de l'équipe : changez d'abord de responsable.");
    }
    // Un collaborateur limité à ses magasins ne doit pas se retrouver sans aucun magasin.
    if (removed.length) {
      const orphans = await prisma.user.findMany({
        where: { id: { in: removed }, isActive: true, role: { allBranches: false }, branches: { every: { branchId: id } } },
        select: { firstName: true, lastName: true },
      });
      if (orphans.length) {
        throw badRequest(`${orphans.map((o) => `${o.firstName} ${o.lastName}`).join(', ')} n'aurai${orphans.length > 1 ? 'en' : ''}t plus accès à aucun magasin. Affectez-le${orphans.length > 1 ? 's' : ''} d'abord à un autre magasin.`);
      }
    }
    await prisma.$transaction([
      prisma.userBranch.deleteMany({ where: { branchId: id, userId: { in: removed } } }),
      prisma.userBranch.createMany({ data: added.map((userId) => ({ userId, branchId: id })), skipDuplicates: true }),
    ]);
    if (added.length || removed.length) {
      await recordAudit({ tenantId, userId: req.auth!.userId, action: 'BRANCH_TEAM_UPDATED', entity: 'Branch', entityId: id, metadata: { name: branch.name, added, removed }, ...requestMeta(req) });
    }
    return reply.send({ added: added.length, removed: removed.length });
  });

  // Magasin principal (siège) : réglage d'établissement, réservé aux rôles multi-magasins.
  app.post('/:id/main', { preHandler: requirePermission('settings.branches.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!hasAllBranches(req)) throw forbidden('Seul un rôle ayant accès à tous les magasins peut changer le magasin principal.');
    const tenantId = req.auth!.tenantId;
    const b = await prisma.branch.findFirst({ where: { id, tenantId }, select: { id: true, name: true, isActive: true, archivedAt: true } });
    if (!b) throw notFound('Magasin introuvable');
    if (b.archivedAt || !b.isActive) throw badRequest('Seul un magasin actif peut devenir le magasin principal.');
    const before = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { mainBranchId: true } });
    await prisma.tenant.update({ where: { id: tenantId }, data: { mainBranchId: id } });
    await recordAudit({ tenantId, userId: req.auth!.userId, action: 'BRANCH_MAIN_CHANGED', entity: 'Branch', entityId: id, metadata: { name: b.name, from: before?.mainBranchId ?? null }, ...requestMeta(req) });
    return reply.send({ mainBranchId: id });
  });

  app.get('/:id/archive-check', { preHandler: requirePermission('settings.branches.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    assertBranchAccess(req, id);
    const check = await svc.archiveCheck(req.auth!.tenantId, id);
    if (!check) throw notFound('Magasin introuvable');
    return reply.send(check);
  });

  // Archivage : le magasin sort des sélecteurs, tout son historique est conservé.
  app.post('/:id/archive', { preHandler: requirePermission('settings.branches.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    assertBranchAccess(req, id);
    const tenantId = req.auth!.tenantId;
    const check = await svc.archiveCheck(tenantId, id);
    if (!check) throw notFound('Magasin introuvable');
    if (!check.canArchive) return reply.status(409).send({ error: { code: 'ARCHIVE_BLOCKED', message: 'Archivage impossible pour le moment.', details: check } });
    // Conditionné sur « non archivé » : deux clics simultanés n'archivent qu'une fois.
    const res = await prisma.branch.updateMany({ where: { id, tenantId, archivedAt: null }, data: { archivedAt: new Date(), isActive: false } });
    if (res.count === 0) throw conflict('Ce magasin est déjà archivé.');
    const b = await prisma.branch.findFirst({ where: { id }, select: { name: true } });
    await recordAudit({ tenantId, userId: req.auth!.userId, action: 'BRANCH_ARCHIVED', entity: 'Branch', entityId: id, metadata: { name: b?.name, warnings: check.warnings.map((w) => w.code) }, ...requestMeta(req) });
    return reply.send({ archived: true });
  });

  app.post('/:id/restore', { preHandler: requirePermission('settings.branches.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    assertBranchAccess(req, id);
    const tenantId = req.auth!.tenantId;
    const b = await prisma.branch.findFirst({ where: { id, tenantId }, select: { name: true, city: true, archivedAt: true } });
    if (!b) throw notFound('Magasin introuvable');
    if (!b.archivedAt) throw badRequest("Ce magasin n'est pas archivé.");
    await assertNoDuplicate(tenantId, b.name, b.city, id);
    await prisma.branch.update({ where: { id }, data: { archivedAt: null, isActive: true } });
    await recordAudit({ tenantId, userId: req.auth!.userId, action: 'BRANCH_RESTORED', entity: 'Branch', entityId: id, metadata: { name: b.name }, ...requestMeta(req) });
    return reply.send({ restored: true });
  });
}
