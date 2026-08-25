import type { FastifyInstance } from 'fastify';
import {
  partnerSignupSchema,
  partnerLoginSchema,
  partnerTrackSchema,
  partnerLeadCreateSchema,
  partnerLeadUpdateSchema,
} from '@oculo/shared-types';
import * as partnerService from './partner.service.js';
import {
  PARTNER_REFRESH_COOKIE,
  setPartnerRefreshCookie,
  clearPartnerRefreshCookie,
} from './partner-cookies.js';
import { requirePartnerAuth } from '../../middlewares/partner-auth-guard.js';
import { unauthorized } from '../../lib/http-error.js';

function requestMeta(req: { ip: string; headers: Record<string, unknown> }) {
  return { ipAddress: req.ip, userAgent: (req.headers['user-agent'] as string) ?? null };
}

/** Routes OculoPartners : publiques (tracking, auth) + partenaire authentifié. */
export async function partnerRoutes(app: FastifyInstance): Promise<void> {
  const strictLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
  const refreshLimit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };
  const trackLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

  /* --------------------------- Public : tracking --------------------------- */

  // Clic sur un lien de parrainage (`/?ref=CODE`), avant toute inscription.
  // Ne renvoie jamais d'erreur métier : un code invalide est silencieusement ignoré.
  app.post('/track', trackLimit, async (req, reply) => {
    const input = partnerTrackSchema.parse(req.body);
    const result = await partnerService.trackReferralClick(input);
    return reply.send(result);
  });

  /* ------------------------------ Public : auth ----------------------------- */

  app.post('/auth/signup', strictLimit, async (req, reply) => {
    const input = partnerSignupSchema.parse(req.body);
    const { accessToken, refreshToken, partner } = await partnerService.signupPartner(
      input,
      requestMeta(req),
    );
    setPartnerRefreshCookie(reply, refreshToken);
    return reply.status(201).send({ accessToken, partner });
  });

  app.post('/auth/login', strictLimit, async (req, reply) => {
    const input = partnerLoginSchema.parse(req.body);
    const { accessToken, refreshToken, partner } = await partnerService.loginPartner(
      input,
      requestMeta(req),
    );
    setPartnerRefreshCookie(reply, refreshToken);
    return reply.send({ accessToken, partner });
  });

  app.post('/auth/refresh', refreshLimit, async (req, reply) => {
    const token = req.cookies[PARTNER_REFRESH_COOKIE];
    if (!token) throw unauthorized('Aucune session');
    const { accessToken, refreshToken, partner } = await partnerService.refreshPartnerSession(
      token,
      requestMeta(req),
    );
    setPartnerRefreshCookie(reply, refreshToken);
    return reply.send({ accessToken, partner });
  });

  app.post('/auth/logout', async (req, reply) => {
    await partnerService.logoutPartner(req.cookies[PARTNER_REFRESH_COOKIE]);
    clearPartnerRefreshCookie(reply);
    return reply.send({ ok: true });
  });

  /* ----------------------------- Espace partenaire ---------------------------- */

  app.register(async (partner) => {
    partner.addHook('preHandler', requirePartnerAuth);

    partner.get('/me', async (req, reply) => {
      const me = await partnerService.getPartnerAuthUser(req.partnerAuth!.partnerId);
      return reply.send({ partner: me });
    });

    // period en jours (7/30/90/365) ; absent = depuis toujours.
    partner.get('/dashboard', async (req, reply) => {
      const { period } = req.query as { period?: string };
      const days = period ? Number(period) : undefined;
      const since = days && Number.isFinite(days) && days > 0 ? new Date(Date.now() - days * 86_400_000) : undefined;
      const stats = await partnerService.getPartnerDashboardStats(req.partnerAuth!.partnerId, since);
      return reply.send({ stats });
    });

    partner.get('/leads', async (req, reply) => {
      const leads = await partnerService.listLeads(req.partnerAuth!.partnerId);
      return reply.send({ leads });
    });

    partner.post('/leads', async (req, reply) => {
      const input = partnerLeadCreateSchema.parse(req.body);
      const lead = await partnerService.createLead(req.partnerAuth!.partnerId, input);
      return reply.status(201).send({ lead });
    });

    partner.patch('/leads/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const input = partnerLeadUpdateSchema.parse(req.body);
      const lead = await partnerService.updateLead(req.partnerAuth!.partnerId, id, input);
      return reply.send({ lead });
    });

    partner.get('/customers', async (req, reply) => {
      const customers = await partnerService.listPartnerCustomers(req.partnerAuth!.partnerId);
      return reply.send({ customers });
    });

    partner.get('/commissions', async (req, reply) => {
      const commissions = await partnerService.listPartnerCommissions(req.partnerAuth!.partnerId);
      return reply.send({ commissions });
    });
  });
}
