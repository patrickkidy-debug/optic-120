import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PartyPopper, Check, ArrowRight, ExternalLink, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { usePermission } from '../../store/auth';
import { getStoreSetupProgress, updateStoreSetupStep, finishStoreSetup } from '../../features/storeSetup/api';
import { STORE_SETUP_STEP_LIST, type StoreSetupStepMeta } from '../../features/storeSetup/steps';
import type { StoreSetupStep, StoreSetupStepStatus } from '../../features/storeSetup/api';
import { PageHeader, ProgressBar, Badge, Button, PageLoader } from '../../components/ui';

function statusTone(status: StoreSetupStepStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'warning';
  return 'neutral';
}

function StepRow({
  meta,
  step,
  highlighted,
}: {
  meta: StoreSetupStepMeta;
  step: StoreSetupStep;
  highlighted: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canAct = usePermission(meta.permission);

  const mut = useMutation({
    mutationFn: (status: 'completed' | 'skipped' | 'reset') => updateStoreSetupStep(meta.key, status),
    onSuccess: (progress) => qc.setQueryData(['store-setup-progress'], progress),
  });

  const statusLabel = {
    completed: t('storeSetup.statusCompleted'),
    in_progress: t('storeSetup.statusInProgress'),
    not_started: t('storeSetup.statusNotStarted'),
  }[step.status];

  return (
    <div
      className={clsx(
        'flex flex-col gap-3 rounded-xl border p-4 transition sm:flex-row sm:items-center sm:justify-between',
        highlighted ? 'border-primary/40 bg-primary/5' : 'border-transparent bg-surface-2/60',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
            step.status === 'completed' ? 'bg-[color:var(--success)]/15 text-success' : 'bg-surface text-primary',
          )}
        >
          <meta.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-content">{t(meta.titleKey)}</p>
            <Badge tone={statusTone(step.status)}>{statusLabel}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-content-muted">{t(meta.descKey)}</p>
          <p className="mt-1 text-xs text-content-faint">{t(meta.whyKey)}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Link to={meta.route} className="btn-outline h-9 rounded-lg px-3 text-xs">
          {t('storeSetup.goTo')} <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        {canAct && step.overridden && (
          <Button variant="ghost" className="h-9 px-2.5 text-xs" onClick={() => mut.mutate('reset')} loading={mut.isPending}>
            <Undo2 className="h-3.5 w-3.5" /> {t('storeSetup.undo')}
          </Button>
        )}
        {canAct && !step.overridden && step.status !== 'completed' && (
          <>
            <Button variant="outline" className="h-9 px-2.5 text-xs" onClick={() => mut.mutate('skipped')} loading={mut.isPending}>
              {t('storeSetup.skip')}
            </Button>
            <Button className="h-9 px-2.5 text-xs" onClick={() => mut.mutate('completed')} loading={mut.isPending}>
              <Check className="h-3.5 w-3.5" /> {t('storeSetup.markDone')}
            </Button>
          </>
        )}
        {!canAct && step.status !== 'completed' && (
          <span className="text-xs text-content-faint" title={t('storeSetup.noPermission')}>
            {t('storeSetup.noPermission')}
          </span>
        )}
      </div>
    </div>
  );
}

export function StoreSetupPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const highlightStep = params.get('step');
  const qc = useQueryClient();

  const { data: progress, isLoading } = useQuery({
    queryKey: ['store-setup-progress'],
    queryFn: getStoreSetupProgress,
  });

  const finishMut = useMutation({
    mutationFn: finishStoreSetup,
    onSuccess: (p) => qc.setQueryData(['store-setup-progress'], p),
  });

  if (isLoading || !progress) return <PageLoader />;

  const allDone = progress.completedCount === progress.totalSteps;
  const stepByKey = new Map(progress.steps.map((s) => [s.key, s]));

  return (
    <div>
      <PageHeader title={t('storeSetup.pageTitle')} subtitle={t('storeSetup.pageSubtitle')} />

      <div className="card mb-6 p-5">
        <ProgressBar
          value={progress.completedCount}
          max={progress.totalSteps}
          label={t(progress.isExistingTenant ? 'storeSetup.cardTitleExisting' : 'storeSetup.cardTitleNew')}
          sublabel={t('storeSetup.progressLabel', { completed: progress.completedCount, total: progress.totalSteps })}
        />
      </div>

      {allDone && !progress.finishedAt && (
        <div className="card mb-6 flex flex-col items-center gap-3 border border-primary/20 p-8 text-center">
          <PartyPopper className="h-10 w-10 text-primary" />
          <h2 className="font-display text-xl font-bold text-content">{t('storeSetup.finalCheck.title')}</h2>
          <p className="text-sm text-content-muted">{t('storeSetup.finalCheck.subtitle')}</p>
          <Button onClick={() => finishMut.mutate()} loading={finishMut.isPending} className="mt-2">
            {t('storeSetup.finalCheck.cta')} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {STORE_SETUP_STEP_LIST.map((meta) => {
          const step = stepByKey.get(meta.key);
          if (!step) return null;
          return <StepRow key={meta.key} meta={meta} step={step} highlighted={highlightStep === meta.key} />;
        })}
      </div>
    </div>
  );
}
