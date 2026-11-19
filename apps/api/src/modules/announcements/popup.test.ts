import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  announcement: { findMany: vi.fn(), findFirst: vi.fn() },
  announcementImpression: { count: vi.fn(), create: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: db }));
const { popupQueue, recordPopupShown } = await import('./announcements.service.js');

const row = (id: string) => ({
  id, kind: 'FEATURE', title: 't', body: 'b', images: ['https://x/1.jpg'], whatsappMessage: null, linkedinPost: null,
  publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
});

describe('popupQueue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renvoie toutes les annonces publiées non lues, sans limite de fréquence', async () => {
    db.announcement.findMany.mockResolvedValue([row('a'), row('b')]);
    const q = await popupQueue('u1');
    expect(q.map((a) => a.id)).toEqual(['a', 'b']);
    expect(q[0].images).toEqual(['https://x/1.jpg']);
    const where = db.announcement.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ publishedAt: { not: null }, reads: { none: { userId: 'u1' } } });
  });
});

describe('recordPopupShown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ignore une annonce déjà lue ou non publiée', async () => {
    db.announcement.findFirst.mockResolvedValue(null);
    expect(await recordPopupShown('u1', 'a')).toBe(false);
    expect(db.announcementImpression.create).not.toHaveBeenCalled();
  });

  it('ne compte pas deux fois un affichage dans la même minute', async () => {
    db.announcement.findFirst.mockResolvedValue({ id: 'a' });
    db.announcementImpression.count.mockResolvedValue(1);
    expect(await recordPopupShown('u1', 'a')).toBe(false);
  });

  it('consigne un nouvel affichage', async () => {
    db.announcement.findFirst.mockResolvedValue({ id: 'a' });
    db.announcementImpression.count.mockResolvedValue(0);
    expect(await recordPopupShown('u1', 'a')).toBe(true);
    expect(db.announcementImpression.create).toHaveBeenCalledOnce();
  });
});
