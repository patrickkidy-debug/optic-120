import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  ProspectPriority,
  ProspectSegment,
  ProspectSource,
  ProspectStatus,
  WhatsappStatus,
} from '@prisma/client';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { forbidden, badRequest } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import { getOperatorEmails } from '../../lib/operators.js';
import * as crm from './crm.service.js';
import type { ImportPreviewRow } from './crm.service.js';

/**
 * CRM strictement privé au fondateur : la garde est appliquée côté SERVEUR sur
 * toutes les routes (§20 du cahier des charges). Masquer la section dans le
 * frontend ne suffirait pas — un client qui devinerait l'URL de l'API serait
 * refusé ici.
 */
async function requirePlatformOperator(req: FastifyRequest): Promise<void> {
  const email = req.auth?.email?.toLowerCase();
  if (!email || !getOperatorEmails().has(email)) {
    throw forbidden('Réservé aux opérateurs de la plateforme');
  }
}

function enumOrUndefined<T extends Record<string, string>>(e: T, v?: string): T[keyof T] | undefined {
  if (!v) return undefined;
  return (Object.values(e) as string[]).includes(v) ? (v as T[keyof T]) : undefined;
}

export async function crmRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requirePlatformOperator);

  /* ------------------------------ Prospects ------------------------------ */

  app.get('/prospects', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const result = await crm.listProspects({
      search: q.search,
      status: enumOrUndefined(ProspectStatus, q.status),
      segment: enumOrUndefined(ProspectSegment, q.segment),
      priority: enumOrUndefined(ProspectPriority, q.priority),
      source: enumOrUndefined(ProspectSource, q.source),
      whatsappStatus: enumOrUndefined(WhatsappStatus, q.whatsappStatus),
      country: q.country,
      city: q.city,
      minScore: q.minScore ? Number(q.minScore) : undefined,
      dueOnly: q.dueOnly === 'true',
      hasEmail: q.hasEmail === 'true',
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    return reply.send(result);
  });

  app.get('/prospects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send({ prospect: await crm.getProspect(id) });
  });

  app.post('/prospects', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    if (!b.establishmentName || typeof b.establishmentName !== 'string') {
      throw badRequest("Nom d'établissement requis");
    }
    const rows: ImportPreviewRow[] = [
      {
        firstName: String(b.firstName ?? ''),
        lastName: String(b.lastName ?? ''),
        establishmentName: b.establishmentName,
        phone: String(b.phone ?? ''),
        phoneNormalized: null,
        phoneCountry: null,
        email: String(b.email ?? ''),
        country: String(b.country ?? ''),
        city: String(b.city ?? ''),
        address: String(b.address ?? ''),
        segment: enumOrUndefined(ProspectSegment, b.segment as string) ?? ProspectSegment.STANDARD,
        whatsappStatus: WhatsappStatus.PHONE_INVALID,
        leadScore: 0,
        outcome: 'new',
      },
    ];
    // On réutilise la normalisation de l'import pour rester cohérent.
    const { normalizePhone, whatsappStatusFromPhone } = await import('./prospect.utils.js');
    const n = normalizePhone(rows[0].phone, rows[0].country);
    rows[0].phoneNormalized = n.e164;
    rows[0].phoneCountry = n.country;
    rows[0].whatsappStatus = whatsappStatusFromPhone(n);
    if (!n.e164) throw badRequest('Numéro invalide ou pays non reconnu');

    const result = await crm.commitImport(rows, ProspectSource.MANUAL, req.auth!.userId);
    if (result.created === 0) throw badRequest('Ce numéro existe déjà dans le CRM');
    return reply.status(201).send({ ok: true });
  });

  app.patch('/prospects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = req.body as Record<string, unknown>;
    const prospect = await crm.updateProspect(
      id,
      {
        firstName: b.firstName as string | undefined,
        lastName: b.lastName as string | undefined,
        establishmentName: b.establishmentName as string | undefined,
        phone: b.phone as string | undefined,
        email: b.email as string | undefined,
        country: b.country as string | undefined,
        city: b.city as string | undefined,
        address: b.address as string | undefined,
        website: b.website as string | undefined,
        notes: b.notes as string | undefined,
        segment: enumOrUndefined(ProspectSegment, b.segment as string),
        priority: enumOrUndefined(ProspectPriority, b.priority as string),
        source: enumOrUndefined(ProspectSource, b.source as string),
        status: enumOrUndefined(ProspectStatus, b.status as string),
        nextFollowUpAt: b.nextFollowUpAt ? new Date(b.nextFollowUpAt as string) : undefined,
        demoDate: b.demoDate ? new Date(b.demoDate as string) : undefined,
        scoreOverride: b.scoreOverride == null ? undefined : Number(b.scoreOverride),
      },
      req.auth!.userId,
    );
    return reply.send({ prospect });
  });

  app.delete('/prospects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await crm.deleteProspect(id);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'CRM_PROSPECT_DELETED',
      entity: 'Prospect',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ ok: true });
  });

  /**
   * Suppression en masse. Deux modes exclusifs :
   *  - `ids` : une sélection cochée à l'écran.
   *  - `filters` + `expectedCount` : tout ce que le filtre courant renvoie,
   *    ce qui permet de retirer un fichier importé en filtrant sur son pays.
   * Le service refuse un filtre vide et refuse un total qui a bougé depuis
   * l'affichage — voir `deleteProspectsByFilter`.
   */
  app.post('/prospects/bulk-delete', async (req, reply) => {
    const b = req.body as {
      ids?: string[];
      filters?: Record<string, string | undefined>;
      expectedCount?: number;
      confirmAll?: boolean;
    };

    let deleted: number;
    let scope: string;

    if (b.ids?.length) {
      deleted = await crm.deleteProspectsByIds(b.ids);
      scope = `selection de ${b.ids.length}`;
    } else if (b.filters && typeof b.expectedCount === 'number') {
      const q = b.filters;
      deleted = await crm.deleteProspectsByFilter(
        {
          search: q.search,
          status: enumOrUndefined(ProspectStatus, q.status),
          segment: enumOrUndefined(ProspectSegment, q.segment),
          priority: enumOrUndefined(ProspectPriority, q.priority),
          source: enumOrUndefined(ProspectSource, q.source),
          whatsappStatus: enumOrUndefined(WhatsappStatus, q.whatsappStatus),
          country: q.country,
          city: q.city,
          minScore: q.minScore ? Number(q.minScore) : undefined,
          dueOnly: q.dueOnly === 'true',
          hasEmail: q.hasEmail === 'true',
        },
        b.expectedCount,
        b.confirmAll === true,
      );
      scope = `filtre ${JSON.stringify(q)}`;
    } else {
      throw badRequest('Fournissez soit une liste d’identifiants, soit un filtre avec son total attendu');
    }

    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'CRM_PROSPECTS_BULK_DELETED',
      entity: 'Prospect',
      metadata: { deleted, scope },
      ...requestMeta(req),
    });

    return reply.send({ deleted });
  });

  app.post('/prospects/:id/notes', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { text } = req.body as { text?: string };
    if (!text?.trim()) throw badRequest('Note vide');
    await crm.addEvent(id, 'NOTE', text.trim(), req.auth!.userId);
    return reply.status(201).send({ ok: true });
  });

  app.post('/prospects/:id/contacted', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { templateName } = req.body as { templateName?: string };
    const prospect = await crm.markContacted(id, req.auth!.userId, templateName ?? 'message personnalisé');
    return reply.send({ prospect });
  });

  app.post('/prospects/:id/whatsapp-status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status?: string };
    const parsed = enumOrUndefined(WhatsappStatus, status);
    if (!parsed) throw badRequest('Statut WhatsApp invalide');
    const prospect = await crm.setWhatsappStatus(id, parsed, req.auth!.userId);
    return reply.send({ prospect });
  });

  /* -------------------------------- Import -------------------------------- */

  app.post('/import/preview', async (req, reply) => {
    const file = await req.file();
    if (!file) throw badRequest('Fichier requis (.xlsx ou .csv)');
    const rows = await crm.previewImport(await file.toBuffer());
    if (rows.length === 0) throw badRequest('Aucune ligne exploitable dans ce fichier');
    return reply.send({ rows });
  });

  app.post('/import/commit', async (req, reply) => {
    const b = req.body as { rows?: ImportPreviewRow[]; source?: string };
    if (!b.rows?.length) throw badRequest('Aucune ligne à importer');
    const source = enumOrUndefined(ProspectSource, b.source) ?? ProspectSource.IMPORT_EXCEL;
    const result = await crm.commitImport(b.rows, source, req.auth!.userId);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'CRM_PROSPECTS_IMPORTED',
      entity: 'Prospect',
      metadata: result,
      ...requestMeta(req),
    });
    return reply.send(result);
  });

  /* ------------------------- Statistiques et réglages ------------------------- */

  app.get('/stats', async (_req, reply) => {
    return reply.send({ stats: await crm.getCrmStats() });
  });

  app.get('/templates', async (_req, reply) => {
    return reply.send({ templates: await crm.listTemplates() });
  });

  app.post('/templates', async (req, reply) => {
    const b = req.body as { id?: string; name?: string; body?: string };
    if (!b.name?.trim() || !b.body?.trim()) throw badRequest('Nom et contenu requis');
    const template = await crm.upsertTemplate({ id: b.id, name: b.name.trim(), body: b.body });
    return reply.send({ template });
  });

  app.delete('/templates/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await crm.deleteTemplate(id);
    return reply.send({ template });
  });

  app.get('/settings', async (_req, reply) => {
    return reply.send({ settings: await crm.getCrmSettings() });
  });

  app.put('/settings', async (req, reply) => {
    const b = req.body as { demoVideosUrl?: string; signupUrl?: string; demoBookingUrl?: string };
    const settings = await crm.updateCrmSettings({
      demoVideosUrl: b.demoVideosUrl?.trim() || null,
      signupUrl: b.signupUrl?.trim() || null,
      demoBookingUrl: b.demoBookingUrl?.trim() || null,
    });
    return reply.send({ settings });
  });

  /** Pays presents dans le CRM, deduits de l'indicatif telephonique. */
  app.get('/countries', async (_req, reply) => {
    return reply.send({ countries: await crm.listProspectCountries() });
  });

  /** Message e-mail pret a envoyer (objet + corps), envoi manuel comme WhatsApp. */
  app.get('/prospects/:id/email', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { templateId } = req.query as { templateId?: string };
    if (!templateId) throw badRequest('templateId requis');
    return reply.send(await crm.renderEmail(id, templateId));
  });

  /** Message prêt à envoyer (variables remplacées) — l'envoi reste manuel. */
  app.get('/prospects/:id/message', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { templateId } = req.query as { templateId?: string };
    if (!templateId) throw badRequest('templateId requis');
    return reply.send(await crm.renderMessage(id, templateId));
  });
}
