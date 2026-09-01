import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Settings2, ArrowRight, ChevronRight, X } from 'lucide-react';
import { getStoreSetupProgress } from '../../features/storeSetup/api';
import { STORE_SETUP_STEP_META } from '../../features/storeSetup/steps';
import { ProgressBar } from '../ui';

const MINIMIZED_KEY = 'oculo_store_setup_minimized';

/**
 * Carte de progression de l'assistant "Configuration boutique", affichée sur
 * le Dashboard tant que la configuration n'est pas terminée (finishedAt).
 * Peut être réduite (persistée en localStorage) sans jamais bloquer le reste
 * du Dashboard — l'assistant complet reste accessible via la barre latérale.
 */
export function StoreSetupCard() {
  const { t } = useTranslation();
  const { data: progress } = useQuery({
    queryKey: ['store-setup-progress'],
    queryFn: getStoreSetupProgress,
  });
  const [minimized, setMinimized] = useState(() => localStorage.getItem(MINIMIZED_KEY) === '1');

  if (!progress || progress.finishedAt) return null;

  const percent = Math.round((progress.completedCount / progress.totalSteps) * 100);

  function setMinimizedPersisted(value: boolean) {
    setMinimized(value);
    if (value) localStorage.setItem(MINIMIZED_KEY, '1');
    else localStorage.removeItem(MINIMIZED_KEY);
  }

  if (minimized) {
    return (
      <button
        onClick={() => setMinimizedPersisted(false)}
        className="mb-6 flex w-full items-center gap-3 rounded-xl border border-primary/15 bg-surface-2/60 px-4 py-2.5 text-left transition hover:border-primary/30"
      >
        <Settings2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-content">
          {t('storeSetup.expand', { percent })}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-content-faint" />
      </button>
    );
  }

  const currentStep = progress.currentStep === 'final_check' ? null : STORE_SETUP_STEP_META[progress.currentStep];
  const isExisting = progress.isExistingTenant;

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Settings2 className="h-6 w-6" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-content">
              {t(isExisting ? 'storeSetup.cardTitleExisting' : 'storeSetup.cardTitleNew')}
            </p>
            <p className="mt-0.5 max-w-xl text-sm text-content-muted">
              {t(isExisting ? 'storeSetup.cardSubtitleExisting' : 'storeSetup.cardSubtitleNew')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setMinimizedPersisted(true)}
          aria-label={t('storeSetup.minimize')}
          className="btn-ghost h-8 w-8 shrink-0 rounded-lg p-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 max-w-md">
        <ProgressBar
          value={progress.completedCount}
          max={progress.totalSteps}
          sublabel={t('storeSetup.progressLabel', { completed: progress.completedCount, total: progress.totalSteps })}
        />
      </div>

      {currentStep && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-surface-2/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-primary">
              <currentStep.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
                {t('storeSetup.nextStep')}
              </p>
              <p className="text-sm font-semibold text-content">{t(currentStep.titleKey)}</p>
            </div>
          </div>
          <Link
            to={`/configuration-boutique?step=${currentStep.key}`}
            className="btn-primary shrink-0 rounded-xl px-4 py-2 text-sm"
          >
            {t('storeSetup.continue')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
