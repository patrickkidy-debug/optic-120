import * as XLSX from 'xlsx';
import {
  Prisma,
  ProspectPriority,
  ProspectSegment,
  ProspectSource,
  ProspectStatus,
  WhatsappStatus,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/http-error.js';
import {
  normalizePhone,
  whatsappStatusFromPhone,
  computeLeadScore,
  fillTemplate,
} from './prospect.utils.js';

/* ----------------------------- Import fichier ----------------------------- */

type Field =
  | 'firstName'
  | 'lastName'
  | 'establishmentName'
  | 'phone'
  | 'email'
  | 'country'
  | 'city'
  | 'address'
  | 'segment';

const ALIASES: Record<Field, string[]> = {
  firstName: ['prenom', 'first name', 'firstname'],
  lastName: ['nom de famille', 'last name', 'lastname', 'nom du contact'],
  establishmentName: [
    'etablissement',
    'entreprise',
    'societe',
    'magasin',
    'optique',
    'raison sociale',
    'company',
    'nom',
  ],
  phone: ['telephone', 'tel', 'phone', 'whatsapp', 'mobile', 'numero', 'contact'],
  email: ['email', 'e-mail', 'mail', 'courriel'],
  country: ['pays', 'country'],
  city: ['ville', 'city', 'localite'],
  address: ['adresse', 'address', 'localisation'],
  segment: ['segment', 'categorie', 'type'],
};

// Du plus spécifique au plus générique : « nom de famille » doit être capté
// avant le « nom » générique de l'établissement, sinon la mauvaise colonne
// serait retenue.
const ORDER: Field[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'country',
  'city',
  'address',
  'segment',
  'establishmentName',
];

function stripAccents(s: string): string {
  let out = '';
  for (const ch of s.normalize('NFD')) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x0300 || c > 0x036f) out += ch;
  }
  return out;
}
const norm = (s: string) => stripAccents(s).toLowerCase().trim();

function detectColumns(sample: Record<string, unknown>): Partial<Record<Field, string>> {
  const keys = Object.keys(sample);
  const used = new Set<string>();
  const map: Partial<Record<Field, string>> = {};
  for (const field of ORDER) {
    const hit = keys.find(
      (k) => !used.has(k) && ALIASES[field].some((a) => norm(k) === norm(a) || norm(k).includes(norm(a))),
    );
    if (hit) {
      map[field] = hit;
      used.add(hit);
    }
  }
  return map;
}

export interface ImportPreviewRow {
  firstName: string;
  lastName: string;
  establishmentName: string;
  phone: string;
  phoneNormalized: string | null;
  phoneCountry: string | null;
  email: string;
  country: string;
  city: string;
  address: string;
  segment: ProspectSegment;
  whatsappStatus: WhatsappStatus;
  leadScore: number;
  /** new = à créer, duplicate = déjà connu, invalid = inexploitable. */
  outcome: 'new' | 'duplicate' | 'invalid';
  reason?: string;
}

function toSegment(raw: string): ProspectSegment {
  const v = norm(raw);
  if (v.startsWith('prem')) return ProspectSegment.PREMIUM;
  if (v.startsWith('disc') || v.startsWith('deco')) return ProspectSegment.DISCOVERY;
  return ProspectSegment.STANDARD;
}

/**
 * Lit un .xlsx/.csv, normalise chaque ligne et la confronte à la base pour
 * repérer les doublons — SANS rien écrire. Le fondateur valide ensuite.
 */
export async function previewImport(buffer: Buffer): Promise<ImportPreviewRow[]> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: '' });
  if (raw.length === 0) return [];

  const cols = detectColumns(raw[0]);
  const get = (row: Record<string, unknown>, f: Field) => {
    const k = cols[f];
    return k ? String(row[k] ?? '').trim() : '';
  };

  const parsed = raw.map((row) => {
    const country = get(row, 'country');
    const phoneRaw = get(row, 'phone');
    const phone = normalizePhone(phoneRaw, country);
    const segment = toSegment(get(row, 'segment'));
    const whatsappStatus = whatsappStatusFromPhone(phone);
    const establishmentName = get(row, 'establishmentName') || get(row, 'lastName') || get(row, 'firstName');
    return {
      firstName: get(row, 'firstName'),
      lastName: get(row, 'lastName'),
      establishmentName,
      phone: phoneRaw,
      phoneNormalized: phone.e164,
      phoneCountry: phone.country,
      email: get(row, 'email'),
      country,
      city: get(row, 'city'),
      address: get(row, 'address'),
      segment,
      whatsappStatus,
      leadScore: computeLeadScore({
        establishmentName,
        email: get(row, 'email'),
        segment,
        status: ProspectStatus.NEW,
        whatsappStatus,
      }),
    };
  });

  // Doublons déjà en base — une seule requête, pas de N+1.
  const numbers = parsed.map((p) => p.phoneNormalized).filter((n): n is string => Boolean(n));
  const existing = numbers.length
    ? await prisma.prospect.findMany({
        where: { phoneNormalized: { in: numbers } },
        select: { phoneNormalized: true },
      })
    : [];
  const known = new Set(existing.map((e) => e.phoneNormalized));
  // Doublons internes au fichier lui-même.
  const seen = new Set<string>();

  return parsed.map((p): ImportPreviewRow => {
    if (!p.establishmentName) return { ...p, outcome: 'invalid', reason: "Nom d'établissement manquant" };
    if (!p.phoneNormalized) return { ...p, outcome: 'invalid', reason: 'Numéro invalide ou pays inconnu' };
    if (known.has(p.phoneNormalized)) return { ...p, outcome: 'duplicate', reason: 'Déjà dans le CRM' };
    if (seen.has(p.phoneNormalized)) return { ...p, outcome: 'duplicate', reason: 'En double dans le fichier' };
    seen.add(p.phoneNormalized);
    return { ...p, outcome: 'new' };
  });
}

/** Crée les prospects retenus. Les doublons sont ignorés (skipDuplicates). */
export async function commitImport(
  rows: ImportPreviewRow[],
  source: ProspectSource,
  userId: string,
): Promise<{ created: number; skipped: number }> {
  const usable = rows.filter((r) => r.outcome === 'new' && r.phoneNormalized);
  if (usable.length === 0) return { created: 0, skipped: rows.length };

  const created = await prisma.$transaction(
    async (tx) => {
      const result = await tx.prospect.createMany({
        data: usable.map((r) => ({
          firstName: r.firstName || null,
          lastName: r.lastName || null,
          establishmentName: r.establishmentName,
          phone: r.phone || null,
          phoneNormalized: r.phoneNormalized,
          phoneCountry: r.phoneCountry,
          email: r.email || null,
          country: r.country || null,
          city: r.city || null,
          address: r.address || null,
          segment: r.segment,
          whatsappStatus: r.whatsappStatus,
          leadScore: r.leadScore,
          source,
        })),
        skipDuplicates: true,
      });
      const fresh = await tx.prospect.findMany({
        where: { phoneNormalized: { in: usable.map((r) => r.phoneNormalized as string) } },
        select: { id: true },
      });
      await tx.prospectEvent.createMany({
        data: fresh.map((p) => ({
          prospectId: p.id,
          type: 'IMPORTED',
          label: 'Prospect importé',
          createdById: userId,
        })),
      });
      return result.count;
    },
    { timeout: 30000 },
  );

  return { created, skipped: rows.length - created };
}

/* ------------------------------- Prospects ------------------------------- */

export interface ListFilters {
  search?: string;
  status?: ProspectStatus;
  segment?: ProspectSegment;
  priority?: ProspectPriority;
  source?: ProspectSource;
  whatsappStatus?: WhatsappStatus;
  country?: string;
  city?: string;
  minScore?: number;
  dueOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listProspects(f: ListFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 50));
  const where: Prisma.ProspectWhereInput = {};

  if (f.status) where.status = f.status;
  if (f.segment) where.segment = f.segment;
  if (f.priority) where.priority = f.priority;
  if (f.source) where.source = f.source;
  if (f.whatsappStatus) where.whatsappStatus = f.whatsappStatus;
  if (f.country) where.country = { equals: f.country, mode: 'insensitive' };
  if (f.city) where.city = { contains: f.city, mode: 'insensitive' };
  if (f.minScore != null) where.leadScore = { gte: f.minScore };
  if (f.dueOnly) where.nextFollowUpAt = { lte: new Date() };
  if (f.search) {
    where.OR = [
      { establishmentName: { contains: f.search, mode: 'insensitive' } },
      { firstName: { contains: f.search, mode: 'insensitive' } },
      { lastName: { contains: f.search, mode: 'insensitive' } },
      { phoneNormalized: { contains: f.search } },
      { email: { contains: f.search, mode: 'insensitive' } },
      { city: { contains: f.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy: [{ leadScore: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.prospect.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getProspect(id: string) {
  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: 'desc' }, take: 100 } },
  });
  if (!prospect) throw notFound('Prospect introuvable');
  return prospect;
}

/** Recalcule le score, sauf si le fondateur l'a forcé manuellement. */
async function refreshScore(tx: Prisma.TransactionClient, id: string) {
  const p = await tx.prospect.findUnique({ where: { id } });
  if (!p || p.scoreOverride != null) return;
  const leadScore = computeLeadScore({
    establishmentName: p.establishmentName,
    email: p.email,
    segment: p.segment,
    status: p.status,
    whatsappStatus: p.whatsappStatus,
    website: p.website,
  });
  if (leadScore !== p.leadScore) await tx.prospect.update({ where: { id }, data: { leadScore } });
}

export interface UpdateProspectInput {
  firstName?: string | null;
  lastName?: string | null;
  establishmentName?: string;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  segment?: ProspectSegment;
  priority?: ProspectPriority;
  source?: ProspectSource;
  status?: ProspectStatus;
  notes?: string | null;
  nextFollowUpAt?: Date | null;
  demoDate?: Date | null;
  scoreOverride?: number | null;
}

export async function updateProspect(id: string, input: UpdateProspectInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.prospect.findUnique({ where: { id } });
    if (!before) throw notFound('Prospect introuvable');

    const data: Prisma.ProspectUpdateInput = { ...input };

    // Renuméroter : on renormalise et on réévalue la joignabilité.
    if (input.phone !== undefined) {
      const n = normalizePhone(input.phone, input.country ?? before.country ?? undefined);
      data.phoneNormalized = n.e164;
      data.phoneCountry = n.country;
      // Un numéro déjà confirmé le reste ; sinon on repart du format.
      if (before.whatsappStatus !== WhatsappStatus.WHATSAPP_VERIFIED) {
        data.whatsappStatus = whatsappStatusFromPhone(n);
      }
    }
    if (input.scoreOverride != null) data.leadScore = input.scoreOverride;

    // Jalons du pipeline horodatés automatiquement.
    if (input.status && input.status !== before.status) {
      if (input.status === ProspectStatus.CONTACTED) data.lastContactAt = new Date();
      if (input.status === ProspectStatus.DEMO_COMPLETED) data.demoCompletedAt = new Date();
      if (input.status === ProspectStatus.TRIAL) data.trialStartDate = new Date();
      if (input.status === ProspectStatus.CUSTOMER) data.convertedAt = new Date();
      // Une réponse prouve que le numéro porte bien WhatsApp.
      if (input.status === ProspectStatus.REPLIED && before.whatsappStatus !== WhatsappStatus.WHATSAPP_VERIFIED) {
        data.whatsappStatus = WhatsappStatus.WHATSAPP_VERIFIED;
        data.whatsappVerifiedAt = new Date();
      }
    }

    await tx.prospect.update({ where: { id }, data });

    if (input.status && input.status !== before.status) {
      await tx.prospectEvent.create({
        data: {
          prospectId: id,
          type: 'STATUS_CHANGED',
          label: `Statut : ${before.status} vers ${input.status}`,
          createdById: userId,
        },
      });
    }
    await refreshScore(tx, id);
    return tx.prospect.findUnique({ where: { id } });
  });
}

export async function addEvent(prospectId: string, type: string, label: string, userId: string) {
  const exists = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { id: true } });
  if (!exists) throw notFound('Prospect introuvable');
  return prisma.prospectEvent.create({ data: { prospectId, type, label, createdById: userId } });
}

/** Marque un contact WhatsApp ouvert (le message reste envoyé à la main). */
export async function markContacted(id: string, userId: string, templateName: string) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.prospect.findUnique({ where: { id } });
    if (!p) throw notFound('Prospect introuvable');
    await tx.prospect.update({
      where: { id },
      data: {
        lastContactAt: new Date(),
        status: p.status === ProspectStatus.NEW ? ProspectStatus.CONTACTED : p.status,
      },
    });
    await tx.prospectEvent.create({
      data: {
        prospectId: id,
        type: 'CONTACTED',
        label: `WhatsApp ouvert — ${templateName}`,
        createdById: userId,
      },
    });
    await refreshScore(tx, id);
    return tx.prospect.findUnique({ where: { id } });
  });
}

/** Marquage manuel de la joignabilité WhatsApp (seule voie vers le vert). */
export async function setWhatsappStatus(id: string, status: WhatsappStatus, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.prospect.update({
      where: { id },
      data: {
        whatsappStatus: status,
        whatsappVerifiedAt: status === WhatsappStatus.WHATSAPP_VERIFIED ? new Date() : null,
      },
    });
    await tx.prospectEvent.create({
      data: {
        prospectId: id,
        type: 'WHATSAPP_MARKED',
        label: `WhatsApp : ${status}`,
        createdById: userId,
      },
    });
    await refreshScore(tx, id);
    return tx.prospect.findUnique({ where: { id } });
  });
}

export async function deleteProspect(id: string) {
  await prisma.prospect.delete({ where: { id } });
}

/* ------------------------------ Tableau de bord ------------------------------ */

export async function getCrmStats() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [byStatus, total, newThisMonth, dueToday, bySource] = await Promise.all([
    prisma.prospect.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.prospect.count(),
    prisma.prospect.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.prospect.count({ where: { nextFollowUpAt: { lte: new Date() } } }),
    prisma.prospect.groupBy({ by: ['source', 'status'], _count: { _all: true } }),
  ]);

  const count = (s: ProspectStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const contacted = total - count(ProspectStatus.NEW);
  const replied =
    count(ProspectStatus.REPLIED) +
    count(ProspectStatus.DEMO_SCHEDULED) +
    count(ProspectStatus.DEMO_COMPLETED) +
    count(ProspectStatus.TRIAL) +
    count(ProspectStatus.CUSTOMER);
  const demos =
    count(ProspectStatus.DEMO_COMPLETED) + count(ProspectStatus.TRIAL) + count(ProspectStatus.CUSTOMER);
  const trials = count(ProspectStatus.TRIAL) + count(ProspectStatus.CUSTOMER);
  const customers = count(ProspectStatus.CUSTOMER);

  const sources = [...new Set(bySource.map((b) => b.source))]
    .map((src) => {
      const rows = bySource.filter((b) => b.source === src);
      const n = (s: ProspectStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
      return {
        source: src,
        total: rows.reduce((s, r) => s + r._count._all, 0),
        trials: n(ProspectStatus.TRIAL) + n(ProspectStatus.CUSTOMER),
        customers: n(ProspectStatus.CUSTOMER),
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    total,
    newThisMonth,
    dueToday,
    contacted,
    replied,
    demosScheduled: count(ProspectStatus.DEMO_SCHEDULED),
    demos,
    trials,
    customers,
    lost: count(ProspectStatus.LOST),
    replyRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
    conversionRate: total > 0 ? Math.round((customers / total) * 100) : 0,
    funnel: [
      { key: 'Prospects', value: total },
      { key: 'Contactés', value: contacted },
      { key: 'Réponses', value: replied },
      { key: 'Démos', value: demos },
      { key: 'Essais', value: trials },
      { key: 'Clients', value: customers },
    ],
    sources,
  };
}

/* --------------------------- Modèles et réglages --------------------------- */

const FIRST_CONTACT_BODY = [
  'Bonjour {{first_name}},',
  '',
  "Je me permets de vous contacter concernant OculoSaaS, une solution conçue spécialement pour les professionnels de l'optique.",
  '',
  'OculoSaaS vous permet de gérer votre stock, vos ventes, vos clients, vos commandes et votre activité depuis une seule plateforme.',
  '',
  'Pour découvrir la solution, choisissez ce qui vous convient le mieux :',
  '',
  'Voir les vidéos de démonstration : {{demo_videos_url}}',
  'Créer votre compte et essayer : {{signup_url}}',
  'Réserver une démonstration avec notre équipe : {{demo_booking_url}}',
  '',
  'À bientôt,',
  "L'équipe OculoSaaS",
].join('\n');

export const DEFAULT_TEMPLATES: { key: string; name: string; body: string; sortOrder: number }[] = [
  { key: 'FIRST_CONTACT', name: 'Premier contact', sortOrder: 1, body: FIRST_CONTACT_BODY },
  {
    key: 'FOLLOW_UP_2',
    name: 'Relance J+2',
    sortOrder: 2,
    body: [
      'Bonjour {{first_name}},',
      '',
      "Je reviens vers vous au sujet d'OculoSaaS pour {{establishment_name}}.",
      '',
      'Souhaitez-vous voir concrètement ce que la solution peut vous apporter ? Les vidéos de démonstration sont ici : {{demo_videos_url}}',
      '',
      'Bien à vous,',
      "L'équipe OculoSaaS",
    ].join('\n'),
  },
  {
    key: 'FOLLOW_UP_7',
    name: 'Relance J+7',
    sortOrder: 3,
    body: [
      'Bonjour {{first_name}},',
      '',
      "Sans réponse de votre part, je me permets une dernière relance concernant OculoSaaS.",
      '',
      "Si le moment n'est pas opportun, dites-le-moi simplement. Sinon, vous pouvez créer votre compte en quelques minutes : {{signup_url}}",
      '',
      'Bien cordialement,',
      "L'équipe OculoSaaS",
    ].join('\n'),
  },
  {
    key: 'DEMO_CONFIRM',
    name: 'Confirmation démo',
    sortOrder: 4,
    body: [
      'Bonjour {{first_name}},',
      '',
      'Je vous confirme notre démonstration pour {{establishment_name}}.',
      '',
      'En attendant, vous pouvez déjà parcourir les vidéos : {{demo_videos_url}}',
      '',
      'À très vite,',
      "L'équipe OculoSaaS",
    ].join('\n'),
  },
  {
    key: 'AFTER_DEMO',
    name: 'Après démonstration',
    sortOrder: 5,
    body: [
      'Bonjour {{first_name}},',
      '',
      'Merci pour le temps accordé lors de la démonstration.',
      '',
      'Vous pouvez démarrer dès maintenant avec votre propre compte : {{signup_url}}',
      '',
      'Je reste disponible pour toute question.',
      "L'équipe OculoSaaS",
    ].join('\n'),
  },
  {
    key: 'TRIAL_START',
    name: "Début d'essai",
    sortOrder: 6,
    body: [
      'Bonjour {{first_name}},',
      '',
      "Votre essai d'OculoSaaS est actif. Prenez le temps de tester la caisse, le stock et le suivi de vos clients.",
      '',
      "Besoin d'aide pour configurer {{establishment_name}} ? Répondez simplement à ce message.",
      '',
      "L'équipe OculoSaaS",
    ].join('\n'),
  },
  {
    key: 'TRIAL_END',
    name: "Fin d'essai",
    sortOrder: 7,
    body: [
      'Bonjour {{first_name}},',
      '',
      "Votre période d'essai touche à sa fin. Pour continuer sans interruption, il suffit d'activer votre abonnement : {{signup_url}}",
      '',
      "L'équipe OculoSaaS",
    ].join('\n'),
  },
  {
    key: 'CONVERSION',
    name: 'Conversion',
    sortOrder: 8,
    body: [
      'Bonjour {{first_name}},',
      '',
      'Merci de votre confiance ! {{establishment_name}} fait désormais partie des établissements équipés OculoSaaS.',
      '',
      'Notre équipe reste disponible pour vous accompagner.',
      "L'équipe OculoSaaS",
    ].join('\n'),
  },
];

/** Crée les modèles par défaut manquants (idempotent). */
export async function ensureDefaultTemplates() {
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.prospectMessageTemplate.upsert({
      where: { key: t.key },
      create: { ...t, isDefault: true },
      update: {},
    });
  }
}

export async function listTemplates() {
  await ensureDefaultTemplates();
  return prisma.prospectMessageTemplate.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function upsertTemplate(input: { id?: string; key?: string; name: string; body: string }) {
  if (input.id) {
    return prisma.prospectMessageTemplate.update({
      where: { id: input.id },
      data: { name: input.name, body: input.body },
    });
  }
  const key = input.key || `CUSTOM_${Date.now()}`;
  return prisma.prospectMessageTemplate.create({
    data: { key, name: input.name, body: input.body, sortOrder: 99 },
  });
}

export async function deleteTemplate(id: string) {
  const t = await prisma.prospectMessageTemplate.findUnique({ where: { id } });
  if (!t) throw notFound('Modèle introuvable');
  if (t.isDefault) {
    // Un modèle livré serait recréé au prochain chargement : on le réinitialise
    // au lieu de le supprimer, ce qui serait déroutant.
    const src = DEFAULT_TEMPLATES.find((d) => d.key === t.key);
    if (src) {
      return prisma.prospectMessageTemplate.update({
        where: { id },
        data: { body: src.body, name: src.name },
      });
    }
  }
  await prisma.prospectMessageTemplate.delete({ where: { id } });
  return null;
}

const SETTINGS_ID = 'default';

export async function getCrmSettings() {
  const row = await prisma.crmSettings.findUnique({ where: { id: SETTINGS_ID } });
  return (
    row ?? {
      id: SETTINGS_ID,
      demoVideosUrl: null,
      signupUrl: null,
      demoBookingUrl: null,
      updatedAt: new Date(),
    }
  );
}

export async function updateCrmSettings(input: {
  demoVideosUrl?: string | null;
  signupUrl?: string | null;
  demoBookingUrl?: string | null;
}) {
  return prisma.crmSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...input },
    update: input,
  });
}

/** Message prêt à envoyer : variables du prospect + URLs de conversion. */
export async function renderMessage(prospectId: string, templateId: string) {
  const [prospect, template, settings] = await Promise.all([
    prisma.prospect.findUnique({ where: { id: prospectId } }),
    prisma.prospectMessageTemplate.findUnique({ where: { id: templateId } }),
    getCrmSettings(),
  ]);
  if (!prospect) throw notFound('Prospect introuvable');
  if (!template) throw notFound('Modèle introuvable');

  const body = fillTemplate(template.body, {
    first_name: prospect.firstName || prospect.establishmentName,
    last_name: prospect.lastName,
    establishment_name: prospect.establishmentName,
    city: prospect.city,
    country: prospect.country,
    demo_videos_url: settings.demoVideosUrl,
    signup_url: settings.signupUrl,
    demo_booking_url: settings.demoBookingUrl,
  });

  return { body, templateName: template.name, phone: prospect.phoneNormalized };
}
