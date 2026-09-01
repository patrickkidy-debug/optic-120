import { api } from '../../lib/api';
import type { StoreSetupStepKey } from '@oculo/shared-types';

export type StoreSetupStepStatus = 'not_started' | 'in_progress' | 'completed';

export interface StoreSetupStep {
  key: StoreSetupStepKey;
  status: StoreSetupStepStatus;
  overridden: boolean;
}

export interface StoreSetupProgress {
  steps: StoreSetupStep[];
  currentStep: StoreSetupStepKey | 'final_check';
  completedCount: number;
  totalSteps: number;
  finishedAt: string | null;
  isExistingTenant: boolean;
}

export async function getStoreSetupProgress(): Promise<StoreSetupProgress> {
  const { data } = await api.get<{ progress: StoreSetupProgress }>('/store-setup/progress');
  return data.progress;
}

export async function updateStoreSetupStep(
  key: StoreSetupStepKey,
  status: 'completed' | 'skipped' | 'reset',
): Promise<StoreSetupProgress> {
  const { data } = await api.patch<{ progress: StoreSetupProgress }>(`/store-setup/steps/${key}`, { status });
  return data.progress;
}

export async function finishStoreSetup(): Promise<StoreSetupProgress> {
  const { data } = await api.post<{ progress: StoreSetupProgress }>('/store-setup/finish');
  return data.progress;
}
