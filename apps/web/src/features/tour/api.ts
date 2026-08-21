import { api } from '../../lib/api';
import type { DemoEventName } from '@oculo/shared-types';

export interface DemoProgress {
  currentStepId: string | null;
  completedAt: string | null;
  skipped: boolean;
}

/** Progression serveur de la visite démo — survit à un changement d'appareil/navigateur. */
export async function getDemoProgress(): Promise<DemoProgress | null> {
  const { data } = await api.get<{ progress: DemoProgress | null }>('/demo/progress');
  return data.progress;
}

export async function saveDemoProgress(patch: Partial<DemoProgress>): Promise<void> {
  await api.put('/demo/progress', patch);
}

/** Suivi du tunnel démo (recordAudit côté serveur) : ne bloque jamais l'expérience si ça échoue. */
export function trackDemoEvent(event: DemoEventName, metadata?: Record<string, unknown>): void {
  void api.post('/demo/events', { event, metadata }).catch(() => undefined);
}
