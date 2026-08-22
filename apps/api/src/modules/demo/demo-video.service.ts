import { prisma } from '../../lib/prisma.js';

/** Clés des 4 vidéos du parcours de démonstration. */
export const DEMO_VIDEO_KEYS = ['1', '2', '3', '4'] as const;
export type DemoVideoKey = (typeof DEMO_VIDEO_KEYS)[number];

/** Un lecteur atteint rarement 100 % pile (dernière frame, arrondis) : 95 % = vue. */
const COMPLETION_THRESHOLD = 95;

export function isValidVideoKey(key: string): key is DemoVideoKey {
  return (DEMO_VIDEO_KEYS as readonly string[]).includes(key);
}

/** Progression de l'utilisateur sur les 4 vidéos (lignes manquantes = jamais ouvertes). */
export async function getMyProgress(tenantId: string, userId: string) {
  const rows = await prisma.demoVideoProgress.findMany({
    where: { tenantId, userId },
    orderBy: { videoKey: 'asc' },
  });
  return DEMO_VIDEO_KEYS.map((key) => {
    const row = rows.find((r) => r.videoKey === key);
    return {
      videoKey: key,
      lastPositionSeconds: row?.lastPositionSeconds ?? 0,
      durationSeconds: row?.durationSeconds ?? null,
      maxPercent: row?.maxPercent ?? 0,
      viewCount: row?.viewCount ?? 0,
      completedAt: row?.completedAt ?? null,
      understood: row?.understood ?? null,
    };
  });
}

/**
 * Enregistre la position de lecture. `maxPercent` ne redescend JAMAIS : c'est
 * le meilleur point atteint qui mesure l'intérêt, pas la position courante
 * (qui recule si l'utilisateur revient en arrière).
 */
export async function saveProgress(
  tenantId: string,
  userId: string,
  videoKey: DemoVideoKey,
  input: { positionSeconds: number; durationSeconds?: number; isNewView?: boolean },
) {
  const position = Math.max(0, Math.round(input.positionSeconds));
  const duration = input.durationSeconds ? Math.round(input.durationSeconds) : null;
  const percent = duration && duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;
  const completed = percent >= COMPLETION_THRESHOLD;

  const existing = await prisma.demoVideoProgress.findUnique({
    where: { userId_videoKey: { userId, videoKey } },
  });

  if (!existing) {
    return prisma.demoVideoProgress.create({
      data: {
        tenantId,
        userId,
        videoKey,
        lastPositionSeconds: position,
        durationSeconds: duration,
        maxPercent: percent,
        viewCount: 1,
        completedAt: completed ? new Date() : null,
      },
    });
  }

  return prisma.demoVideoProgress.update({
    where: { id: existing.id },
    data: {
      lastPositionSeconds: position,
      durationSeconds: duration ?? existing.durationSeconds,
      maxPercent: Math.max(existing.maxPercent, percent),
      viewCount: input.isNewView ? existing.viewCount + 1 : existing.viewCount,
      // Une fois marquée vue, la vidéo le reste (revoir un extrait ne l'annule pas).
      completedAt: existing.completedAt ?? (completed ? new Date() : null),
    },
  });
}

/** Réponse au questionnaire de compréhension (YES | UNSURE | NO). */
export async function saveFeedback(
  tenantId: string,
  userId: string,
  videoKey: DemoVideoKey,
  understood: string,
) {
  return prisma.demoVideoProgress.upsert({
    where: { userId_videoKey: { userId, videoKey } },
    create: { tenantId, userId, videoKey, understood },
    update: { understood },
  });
}

export interface DemoEngagementRow {
  tenantId: string;
  tenantName: string;
  whatsappPhone: string | null;
  contactName: string | null;
  contactEmail: string | null;
  videosCompleted: number;
  avgPercent: number;
  totalViews: number;
  notUnderstoodCount: number;
  lastActivityAt: Date | null;
  /** Score d'intérêt : sert au tri, pour savoir qui rappeler en priorité. */
  score: number;
}

/**
 * Engagement démo de tous les établissements (console fondateur).
 * Trié par score d'intérêt décroissant : les prospects les plus chauds en tête.
 */
export async function getEngagementForFounder(): Promise<DemoEngagementRow[]> {
  const rows = await prisma.demoVideoProgress.findMany({
    include: {
      tenant: { select: { id: true, name: true, whatsappPhone: true, isDemo: true } },
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const byTenant = new Map<string, DemoEngagementRow & { percentSum: number; percentCount: number }>();

  for (const row of rows) {
    // Les établissements de démonstration internes ne sont pas des prospects.
    if (row.tenant.isDemo) continue;
    let entry = byTenant.get(row.tenantId);
    if (!entry) {
      entry = {
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        whatsappPhone: row.tenant.whatsappPhone,
        contactName: `${row.user.firstName} ${row.user.lastName}`.trim(),
        contactEmail: row.user.email,
        videosCompleted: 0,
        avgPercent: 0,
        totalViews: 0,
        notUnderstoodCount: 0,
        lastActivityAt: null,
        score: 0,
        percentSum: 0,
        percentCount: 0,
      };
      byTenant.set(row.tenantId, entry);
    }
    if (row.completedAt) entry.videosCompleted += 1;
    entry.totalViews += row.viewCount;
    if (row.understood === 'NO') entry.notUnderstoodCount += 1;
    entry.percentSum += row.maxPercent;
    entry.percentCount += 1;
    if (!entry.lastActivityAt || row.updatedAt > entry.lastActivityAt) {
      entry.lastActivityAt = row.updatedAt;
    }
  }

  return [...byTenant.values()]
    .map((e) => {
      const avgPercent = e.percentCount > 0 ? Math.round(e.percentSum / e.percentCount) : 0;
      // Terminer une vidéo pèse plus que la survoler ; un « pas compris » est un
      // signal d'achat (le prospect s'implique) et non une pénalité.
      const score = Math.round(e.videosCompleted * 25 + avgPercent * 0.5 + e.notUnderstoodCount * 10);
      const { percentSum: _s, percentCount: _c, ...rest } = e;
      return { ...rest, avgPercent, score };
    })
    .sort((a, b) => b.score - a.score);
}
