import type { FastifyInstance } from 'fastify';
import {
  patientCreateSchema,
  consultationCreateSchema,
  appointmentCreateSchema,
  appointmentUpdateSchema,
  surgeryCreateSchema,
  surgeryUpdateSchema,
} from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound } from '../../lib/http-error.js';
import { assertWithinLimit } from '../billing/billing.service.js';

/** Convertit une chaîne ISO (éventuellement vide) en Date ou null. */
function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}
/** Nettoie les champs '' -> null pour le stockage. */
function clean<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === '') (out as Record<string, unknown>)[k] = null;
  }
  return out;
}

async function patientsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('clinic.patients.view') }, async (req, reply) => {
    const q = req.query as { search?: string };
    const where = q.search
      ? {
          OR: [
            { firstName: { contains: q.search, mode: 'insensitive' as const } },
            { lastName: { contains: q.search, mode: 'insensitive' as const } },
            { phone: { contains: q.search } },
          ],
        }
      : {};
    const patients = await req.db!.patient.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    return reply.send({ patients });
  });

  app.get('/:id', { preHandler: requirePermission('clinic.patients.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const patient = await req.db!.patient.findFirst({
      where: { id },
      include: {
        consultations: { orderBy: { date: 'desc' } },
        appointments: { orderBy: { scheduledAt: 'desc' } },
        surgeries: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!patient) throw notFound('Patient introuvable');
    return reply.send({ patient });
  });

  app.post('/', { preHandler: requirePermission('clinic.patients.create') }, async (req, reply) => {
    const input = clean(patientCreateSchema.parse(req.body));
    await assertWithinLimit(req.auth!.tenantId, 'patients');
    const patient = await req.db!.patient.create({
      data: {
        tenantId: req.auth!.tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        gender: input.gender ?? null,
        dateOfBirth: toDate(input.dateOfBirth),
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        bloodGroup: input.bloodGroup ?? null,
        allergies: input.allergies ?? null,
        medicalHistory: input.medicalHistory ?? null,
      },
    });
    return reply.status(201).send({ patient });
  });

  app.patch('/:id', { preHandler: requirePermission('clinic.patients.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(patientCreateSchema.partial().parse(req.body));
    const data: Record<string, unknown> = { ...input };
    if ('dateOfBirth' in input) data.dateOfBirth = toDate(input.dateOfBirth as string);
    const res = await req.db!.patient.updateMany({ where: { id }, data });
    if (res.count === 0) throw notFound('Patient introuvable');
    const patient = await req.db!.patient.findFirst({ where: { id } });
    return reply.send({ patient });
  });

  app.delete('/:id', { preHandler: requirePermission('clinic.patients.delete') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await req.db!.patient.deleteMany({ where: { id } });
    if (res.count === 0) throw notFound('Patient introuvable');
    return reply.send({ ok: true });
  });
}

async function consultationsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('clinic.consultations.view') }, async (req, reply) => {
    const q = req.query as { patientId?: string };
    const where = q.patientId ? { patientId: q.patientId } : {};
    const consultations = await req.db!.consultation.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 200,
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return reply.send({ consultations });
  });

  app.post('/', { preHandler: requirePermission('clinic.consultations.create') }, async (req, reply) => {
    const input = clean(consultationCreateSchema.parse(req.body));
    const { patientId, date, ...rest } = input;
    const consultation = await req.db!.consultation.create({
      data: {
        tenantId: req.auth!.tenantId,
        patientId,
        date: toDate(date) ?? new Date(),
        createdById: req.auth!.userId,
        ...rest,
      },
    });
    return reply.status(201).send({ consultation });
  });
}

async function appointmentsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('clinic.appointments.view') }, async (req, reply) => {
    const q = req.query as { status?: string; from?: string; to?: string };
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.from || q.to) {
      where.scheduledAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }
    const appointments = await req.db!.appointment.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take: 300,
      include: { patient: { select: { firstName: true, lastName: true, phone: true } } },
    });
    return reply.send({ appointments });
  });

  app.post('/', { preHandler: requirePermission('clinic.appointments.create') }, async (req, reply) => {
    const input = clean(appointmentCreateSchema.parse(req.body));
    const appointment = await req.db!.appointment.create({
      data: {
        tenantId: req.auth!.tenantId,
        patientId: input.patientId,
        scheduledAt: new Date(input.scheduledAt),
        reason: input.reason ?? null,
        practitionerName: input.practitionerName ?? null,
        status: input.status,
        notes: input.notes ?? null,
      },
    });
    return reply.status(201).send({ appointment });
  });

  app.patch('/:id', { preHandler: requirePermission('clinic.appointments.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(appointmentUpdateSchema.parse(req.body));
    const data: Record<string, unknown> = { ...input };
    if (input.scheduledAt) data.scheduledAt = new Date(input.scheduledAt);
    const res = await req.db!.appointment.updateMany({ where: { id }, data });
    if (res.count === 0) throw notFound('Rendez-vous introuvable');
    const appointment = await req.db!.appointment.findFirst({ where: { id } });
    return reply.send({ appointment });
  });
}

async function surgeriesRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requirePermission('clinic.surgeries.view') }, async (req, reply) => {
    const q = req.query as { status?: string; patientId?: string };
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.patientId) where.patientId = q.patientId;
    const surgeries = await req.db!.surgery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return reply.send({ surgeries });
  });

  app.post('/', { preHandler: requirePermission('clinic.surgeries.create') }, async (req, reply) => {
    const input = clean(surgeryCreateSchema.parse(req.body));
    const surgery = await req.db!.surgery.create({
      data: {
        tenantId: req.auth!.tenantId,
        patientId: input.patientId,
        type: input.type,
        eye: input.eye,
        surgeonName: input.surgeonName ?? null,
        scheduledAt: toDate(input.scheduledAt),
        status: input.status,
        outcome: input.outcome ?? null,
        followUpNotes: input.followUpNotes ?? null,
      },
    });
    return reply.status(201).send({ surgery });
  });

  app.patch('/:id', { preHandler: requirePermission('clinic.surgeries.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = clean(surgeryUpdateSchema.parse(req.body));
    const data: Record<string, unknown> = { ...input };
    if ('scheduledAt' in input) data.scheduledAt = toDate(input.scheduledAt as string);
    const res = await req.db!.surgery.updateMany({ where: { id }, data });
    if (res.count === 0) throw notFound('Chirurgie introuvable');
    const surgery = await req.db!.surgery.findFirst({ where: { id } });
    return reply.send({ surgery });
  });
}

export async function clinicRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  await app.register(patientsRoutes, { prefix: '/patients' });
  await app.register(consultationsRoutes, { prefix: '/consultations' });
  await app.register(appointmentsRoutes, { prefix: '/appointments' });
  await app.register(surgeriesRoutes, { prefix: '/surgeries' });
}
