import { api } from '../../lib/api';
import type { DemoEventName } from '@oculo/shared-types';

/** Suivi du tunnel démo (recordAudit côté serveur) : ne bloque jamais l'expérience si ça échoue. */
export function trackDemoEvent(event: DemoEventName, metadata?: Record<string, unknown>): void {
  void api.post('/demo/events', { event, metadata }).catch(() => undefined);
}

export interface DemoVideoProgress {
  videoKey: string;
  lastPositionSeconds: number;
  durationSeconds: number | null;
  maxPercent: number;
  viewCount: number;
  completedAt: string | null;
  understood: 'YES' | 'UNSURE' | 'NO' | null;
}

export async function getVideoProgress(): Promise<DemoVideoProgress[]> {
  const { data } = await api.get<{ progress: DemoVideoProgress[] }>('/demo/videos/progress');
  return data.progress;
}

/** Envoi de position : silencieux en cas d'échec (ne doit jamais gêner la lecture). */
export function saveVideoProgress(
  videoKey: string,
  body: { positionSeconds: number; durationSeconds?: number; isNewView?: boolean },
): void {
  void api.put(`/demo/videos/${videoKey}/progress`, body).catch(() => undefined);
}

export async function saveVideoFeedback(
  videoKey: string,
  understood: 'YES' | 'UNSURE' | 'NO',
): Promise<void> {
  await api.post(`/demo/videos/${videoKey}/feedback`, { understood });
}
