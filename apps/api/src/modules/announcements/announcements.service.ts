import type { AnnouncementUpsertInput } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/http-error.js';

/**
 * Annonces produit : rédigées en console fondateur, lues par tous les
 * utilisateurs de la plateforme.
 *
 * Globales, sans `tenantId` : une nouveauté concerne tout le monde. Elles
 * n'utilisent donc PAS `req.db` (le client cloisonné par établissement) mais
 * `prisma` directement — l'accès est gardé par la route : opérateur plateforme
 * pour écrire, simple authentification pour lire.
 */

/** Les `images` sont stockées en JSON : ce parsing est la frontière de confiance. */
function toImages(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function shape(a: {
  id: string;
  kind: string;
  title: string;
  body: string;
  images: unknown;
  whatsappMessage: string | null;
  linkedinPost: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...a, images: toImages(a.images) };
}

/** Toutes les annonces, brouillons compris — console fondateur uniquement. */
export async function listAll() {
  const rows = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map(shape);
}

export async function create(input: AnnouncementUpsertInput) {
  const row = await prisma.announcement.create({
    data: {
      kind: input.kind,
      title: input.title,
      body: input.body,
      images: input.images,
      whatsappMessage: input.whatsappMessage || null,
      linkedinPost: input.linkedinPost || null,
    },
  });
  return shape(row);
}

export async function update(id: string, input: AnnouncementUpsertInput) {
  const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Annonce introuvable');
  const row = await prisma.announcement.update({
    where: { id },
    data: {
      kind: input.kind,
      title: input.title,
      body: input.body,
      images: input.images,
      whatsappMessage: input.whatsappMessage || null,
      linkedinPost: input.linkedinPost || null,
    },
  });
  return shape(row);
}

/**
 * Publie ou remet en brouillon. La date de première publication est conservée
 * si l'annonce est republiée : la dépublier puis la republier ne doit pas la
 * faire remonter en tête comme une nouveauté auprès de ceux qui l'ont déjà lue.
 */
export async function setPublished(id: string, published: boolean) {
  const existing = await prisma.announcement.findUnique({
    where: { id },
    select: { publishedAt: true },
  });
  if (!existing) throw notFound('Annonce introuvable');
  const row = await prisma.announcement.update({
    where: { id },
    data: { publishedAt: published ? (existing.publishedAt ?? new Date()) : null },
  });
  return shape(row);
}

export async function remove(id: string) {
  const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Annonce introuvable');
  // Les accusés de lecture disparaissent avec l'annonce (cascade) : ils n'ont
  // aucun sens sans elle.
  await prisma.announcement.delete({ where: { id } });
}

/** Annonces publiées, avec l'état de lecture de l'utilisateur courant. */
export async function listForUser(userId: string) {
  const rows = await prisma.announcement.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    include: { reads: { where: { userId }, select: { readAt: true } } },
  });
  return rows.map((a) => ({ ...shape(a), read: a.reads.length > 0, reads: undefined }));
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.announcement.count({
    where: { publishedAt: { not: null }, reads: { none: { userId } } },
  });
}

/** Marque une annonce lue. Idempotent : relire n'écrase pas la première date. */
export async function markRead(userId: string, announcementId: string): Promise<void> {
  const exists = await prisma.announcement.findFirst({
    where: { id: announcementId, publishedAt: { not: null } },
    select: { id: true },
  });
  if (!exists) throw notFound('Annonce introuvable');
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId, userId } },
    update: {},
    create: { announcementId, userId },
  });
}

/** Marque toutes les annonces publiées comme lues. */
export async function markAllRead(userId: string): Promise<number> {
  const ids = await prisma.announcement.findMany({
    where: { publishedAt: { not: null }, reads: { none: { userId } } },
    select: { id: true },
  });
  if (ids.length === 0) return 0;
  await prisma.announcementRead.createMany({
    data: ids.map((a) => ({ announcementId: a.id, userId })),
    skipDuplicates: true,
  });
  return ids.length;
}

/* ------------------------- Fenêtre surgissante (rappel) ------------------------- */

/**
 * Tant qu'une annonce n'est pas lue, elle s'ouvre d'elle-même : au plus 2 fois
 * par jour, à 4 h d'écart au moins, 6 fois en tout (3 jours d'utilisation).
 * Au-delà de 30 jours après sa publication, elle ne reste que dans la cloche.
 */
export const POPUP_RULES = {
  maxTotal: 6,
  maxPerDay: 2,
  minGapMs: 4 * 60 * 60 * 1000,
  maxAgeDays: 30,
} as const;

/** Vrai si l'annonce peut encore s'ouvrir, d'après ses affichages passés. */
export function popupEligible(shownAts: Date[], now: Date = new Date()): boolean {
  if (shownAts.length >= POPUP_RULES.maxTotal) return false;
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (shownAts.filter((d) => d.getTime() >= dayStart).length >= POPUP_RULES.maxPerDay) return false;
  const last = Math.max(0, ...shownAts.map((d) => d.getTime()));
  return now.getTime() - last >= POPUP_RULES.minGapMs;
}

async function popupCandidates(userId: string, now: Date) {
  const since = new Date(now.getTime() - POPUP_RULES.maxAgeDays * 24 * 60 * 60 * 1000);
  return prisma.announcement.findMany({
    where: { publishedAt: { gte: since }, reads: { none: { userId } } },
    orderBy: { publishedAt: 'desc' },
    take: 10,
    include: { impressions: { where: { userId }, select: { shownAt: true } } },
  });
}

/** Annonce à ouvrir maintenant pour cet utilisateur, ou null. */
export async function nextPopup(userId: string, now: Date = new Date()) {
  const rows = await popupCandidates(userId, now);
  const pick = rows.find((a) => popupEligible(a.impressions.map((i) => i.shownAt), now));
  if (!pick) return null;
  const { impressions, ...rest } = pick;
  return { ...shape(rest), read: false, remaining: POPUP_RULES.maxTotal - impressions.length - 1 };
}

/**
 * Consigne un affichage. Les règles sont revérifiées : deux onglets ouverts en
 * même temps ne doivent pas compter double.
 */
export async function recordPopupShown(userId: string, announcementId: string, now: Date = new Date()) {
  const rows = await popupCandidates(userId, now);
  const a = rows.find((r) => r.id === announcementId);
  if (!a || !popupEligible(a.impressions.map((i) => i.shownAt), now)) return false;
  await prisma.announcementImpression.create({ data: { announcementId, userId, shownAt: now } });
  return true;
}

/**
 * Lecture d'une annonce, pour la console : qui l'a lue (« J'ai lu » ou dépliée
 * dans la cloche), et combien l'ont vue s'ouvrir sans la lire.
 */
export async function readStats(announcementId: string) {
  const existing = await prisma.announcement.findUnique({ where: { id: announcementId }, select: { id: true } });
  if (!existing) throw notFound('Annonce introuvable');
  const [reads, seen] = await Promise.all([
    prisma.announcementRead.findMany({
      where: { announcementId },
      select: { user: { select: { tenantId: true } } },
    }),
    prisma.announcementImpression.findMany({
      where: { announcementId },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);
  return {
    readers: reads.length,
    readTenantIds: [...new Set(reads.map((r) => r.user.tenantId))],
    popupUsers: seen.length,
  };
}
