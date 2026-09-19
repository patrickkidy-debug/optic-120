import type { AnnouncementKind, AnnouncementUpsertInput } from '@oculo/shared-types';
import { api } from '../../lib/api';

export interface Announcement {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  images: string[];
  whatsappMessage: string | null;
  linkedinPost: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Présent uniquement sur les annonces servies aux utilisateurs. */
  read?: boolean;
}

/* ------------------------------ Utilisateurs ------------------------------ */

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get<{ announcements: Announcement[] }>('/announcements');
  return data.announcements;
}

export async function announcementsUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/announcements/unread-count');
  return data.count;
}

export async function markAnnouncementRead(id: string): Promise<void> {
  await api.post(`/announcements/${id}/read`);
}

export async function markAllAnnouncementsRead(): Promise<void> {
  await api.post('/announcements/read-all');
}

/* ------------------------------ Console fondateur ------------------------------ */

export async function listAllAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get<{ announcements: Announcement[] }>('/platform/announcements');
  return data.announcements;
}

export async function createAnnouncement(input: AnnouncementUpsertInput): Promise<Announcement> {
  const { data } = await api.post('/platform/announcements', input);
  return data.announcement as Announcement;
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementUpsertInput,
): Promise<Announcement> {
  const { data } = await api.patch(`/platform/announcements/${id}`, input);
  return data.announcement as Announcement;
}

export async function publishAnnouncement(id: string, published: boolean): Promise<Announcement> {
  const { data } = await api.post(`/platform/announcements/${id}/publish`, { published });
  return data.announcement as Announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/platform/announcements/${id}`);
}

/** Établissements déjà prévenus sur WhatsApp pour cette annonce. */
export async function getNotifiedTenants(id: string): Promise<string[]> {
  const { data } = await api.get<{ tenantIds: string[] }>(`/platform/announcements/${id}/notified`);
  return data.tenantIds;
}

export async function markTenantNotified(id: string, tenantId: string): Promise<void> {
  await api.post(`/platform/announcements/${id}/notified/${tenantId}`);
}
