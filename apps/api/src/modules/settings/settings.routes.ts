import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { brandingUpdateSchema } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { prisma } from '../../lib/prisma.js';

/** Image de marque de l'établissement (nom + logo). Préfixe /settings. */
export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/branding', { preHandler: requirePermission('settings.branches.view') }, async (req, reply) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.auth!.tenantId },
      select: {
        name: true,
        logoUrl: true,
        location: true,
        contactPhone: true,
        contactEmail: true,
        vatRate: true,
        invoiceSettings: true,
        lensPricing: true,
        initialInvestment: true,
        whatsappTemplates: true,
      },
    });
    return reply.send({
      branding: {
        name: tenant?.name ?? '',
        logoUrl: tenant?.logoUrl ?? null,
        location: tenant?.location ?? null,
        contactPhone: tenant?.contactPhone ?? null,
        contactEmail: tenant?.contactEmail ?? null,
        vatRate: tenant?.vatRate ?? null,
        invoiceSettings: (tenant?.invoiceSettings as unknown) ?? null,
        lensPricing: (tenant?.lensPricing as unknown) ?? null,
        initialInvestment: tenant?.initialInvestment ?? null,
        whatsappTemplates: (tenant?.whatsappTemplates as unknown) ?? null,
      },
    });
  });

  app.patch('/branding', { preHandler: requirePermission('settings.branches.update') }, async (req, reply) => {
    const input = brandingUpdateSchema.parse(req.body);
    const tenant = await prisma.tenant.update({
      where: { id: req.auth!.tenantId },
      data: {
        name: input.name ?? undefined,
        logoUrl: input.logoUrl === undefined ? undefined : input.logoUrl || null,
        location: input.location === undefined ? undefined : input.location || null,
        contactPhone: input.contactPhone === undefined ? undefined : input.contactPhone || null,
        contactEmail: input.contactEmail === undefined ? undefined : input.contactEmail || null,
        vatRate: input.vatRate === undefined ? undefined : input.vatRate,
        // Remplacement complet du bloc de personnalisation quand fourni ;
        // un objet vide efface les réglages (retour aux valeurs par défaut).
        invoiceSettings:
          input.invoiceSettings === undefined
            ? undefined
            : Object.keys(input.invoiceSettings).length === 0
              ? Prisma.DbNull
              : input.invoiceSettings,
        lensPricing: input.lensPricing === undefined ? undefined : input.lensPricing,
        initialInvestment:
          input.initialInvestment === undefined ? undefined : input.initialInvestment,
        whatsappTemplates:
          input.whatsappTemplates === undefined ? undefined : input.whatsappTemplates,
      },
      select: {
        name: true,
        logoUrl: true,
        location: true,
        contactPhone: true,
        contactEmail: true,
        vatRate: true,
        invoiceSettings: true,
        lensPricing: true,
        initialInvestment: true,
        whatsappTemplates: true,
      },
    });
    return reply.send({
      branding: {
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        location: tenant.location,
        contactPhone: tenant.contactPhone,
        contactEmail: tenant.contactEmail,
        vatRate: tenant.vatRate ?? null,
        invoiceSettings: (tenant.invoiceSettings as unknown) ?? null,
        lensPricing: (tenant.lensPricing as unknown) ?? null,
        initialInvestment: tenant.initialInvestment ?? null,
        whatsappTemplates: (tenant.whatsappTemplates as unknown) ?? null,
      },
    });
  });
}
