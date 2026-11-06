import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PartyPopper, Check, ArrowRight, Undo2, Clock, ChevronDown, Info, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { usePermission } from '../../store/auth';
import { getStoreSetupProgress, updateStoreSetupStep, finishStoreSetup } from '../../features/storeSetup/api';
import { STORE_SETUP_STEP_META, type StoreSetupStepMeta } from '../../features/storeSetup/steps';
import { SETUP_ORDER, SETUP_PHASES, STEP_GUIDES } from '../../features/storeSetup/guide';
import type { StoreSetupStep, StoreSetupStepStatus } from '../../features/storeSetup/api';
import type { StoreSetupStepKey } from '@oculo/shared-types';
import { PageHeader, Badge, Button, PageLoader } from '../../components/ui';

function statusTone(status: StoreSetupStepStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'warning';
  return 'neutral';
}

/** Numéro d'étape (1 à 9) dans l'ordre méthodique. */
const numberOf = (key: StoreSetupStepKey) => SETUP_ORDER.indexOf(key) + 1;

/** Mode d'emploi d'une étape : actions numérotées + condition de validation. */
function HowTo({ stepKey }: { stepKey: StoreSetupStepKey }) {
  const g = STEP_GUIDES[stepKey];
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {g.howTo.map((line, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-content">
            <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
              {i + 1}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-2 rounded-lg bg-[color:var(--success)]/10 px-3 py-2 text-xs text-content-muted">
        <Check className="mt-px h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
        <span>
          <strong className="text-content">Validée automatiquement</strong> quand : {g.doneWhen.charAt(0).toLowerCase() + g.doneWhen.slice(1)}
        </span>
      </p>
    </div>
  );
}

/** Boutons « déjà fait / passer / annuler » d'une étape. */
function StepActions({ meta, step }: { meta: StoreSetupStepMeta; step: StoreSetupStep }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canAct = usePermission(meta.permission);
  const mut = useMutation({
    mutationFn: (status: 'completed' | 'skipped' | 'reset') => updateStoreSetupStep(meta.key, status),
    onSuccess: (progress) => qc.setQueryData(['store-setup-progress'], progress),
  });

  if (!canAct) {
    return step.status === 'completed' ? null : (
      <span className="text-xs text-content-faint">{t('storeSetup.noPermission')}</span>
    );
  }
  if (step.overridden) {
    return (
      <Button variant="ghost" className="h-9 px-2.5 text-xs" onClick={() => mut.mutate('reset')} loading={mut.isPending}>
        <Undo2 className="h-3.5 w-3.5" /> Remettre à faire
      </Button>
    );
  }
  if (step.status === 'completed') return null;
  return (
    <>
      <Button
        variant="ghost"
        className="h-9 px-2.5 text-xs text-content-muted"
        onClick={() => mut.mutate('completed')}
        loading={mut.isPending}
        title="À utiliser si vous avez déjà fait cette étape autrement"
      >
        <Check className="h-3.5 w-3.5" /> Déjà fait
      </Button>
      {STEP_GUIDES[meta.key].optional && (
        <Button
          variant="ghost"
          className="h-9 px-2.5 text-xs text-content-faint"
          onClick={() => mut.mutate('skipped')}
          loading={mut.isPending}
        >
          Pas concerné
        </Button>
      )}
    </>
  );
}

/** Carte mise en avant : la prochaine chose à faire, avec son mode d'emploi. */
function NextStepCard({ meta, step }: { meta: StoreSetupStepMeta; step: StoreSetupStep }) {
  const { t } = useTranslation();
  const g = STEP_GUIDES[meta.key];
  return (
    <section className="card mb-6 overflow-hidden border border-primary/30">
      <div className="flex items-center gap-2 bg-primary/10 px-5 py-2 text-xs font-bold uppercase tracking-wide text-primary">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> À faire maintenant · étape {numberOf(meta.key)} sur {SETUP_ORDER.length}
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-white">
              <meta.icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-content">{t(meta.titleKey)}</h2>
              <p className="flex items-center gap-1 text-xs text-content-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> environ {g.minutes} min
                {g.optional && <span className="ml-1 text-content-faint">· facultatif</span>}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-content-muted">{t(meta.descKey)}</p>
          <p className="mt-2 flex items-start gap-2 text-xs text-content-faint">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {t(meta.whyKey)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link to={meta.route} className="btn-primary h-11 rounded-xl px-5 text-sm font-semibold shadow-sm">
              Commencer cette étape <ArrowRight className="h-4 w-4" />
            </Link>
            <StepActions meta={meta} step={step} />
          </div>
        </div>
        <div className="rounded-xl bg-surface-2/70 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-muted">Comment faire</p>
          <HowTo stepKey={meta.key} />
        </div>
      </div>
    </section>
  );
}

/** Ligne d'étape dans sa phase : repliée par défaut, dépliable pour lire le mode d'emploi. */
function StepRow({
  meta,
  step,
  isNext,
  open,
  onToggle,
}: {
  meta: StoreSetupStepMeta;
  step: StoreSetupStep;
  isNext: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const done = step.status === 'completed';
  const g = STEP_GUIDES[meta.key];
  const statusLabel = done
    ? step.overridden
      ? 'Validé à la main'
      : t('storeSetup.statusCompleted')
    : step.status === 'in_progress'
      ? t('storeSetup.statusInProgress')
      : t('storeSetup.statusNotStarted');

  return (
    <li className="relative pl-12">
      {/* Pastille numérotée de la frise. */}
      <span
        className={clsx(
          'absolute left-0 top-3 grid h-8 w-8 place-items-center rounded-full border-2 text-sm font-bold',
          done
            ? 'border-[color:var(--success)] bg-[color:var(--success)] text-white'
            : isNext
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-line bg-surface text-content-faint',
        )}
      >
        {done ? <Check className="h-4 w-4" /> : numberOf(meta.key)}
      </span>

      <div
        className={clsx(
          'rounded-xl border transition',
          isNext ? 'border-primary/40 bg-primary/5' : 'border-line bg-surface',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <meta.icon className={clsx('h-5 w-5 shrink-0', done ? 'text-success' : 'text-primary')} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className={clsx('font-semibold', done ? 'text-content-muted' : 'text-content')}>{t(meta.titleKey)}</span>
              <Badge tone={statusTone(step.status)}>{statusLabel}</Badge>
              {g.optional && !done && <span className="text-xs text-content-faint">facultatif</span>}
            </span>
            <span className="mt-0.5 block truncate text-xs text-content-muted">{t(meta.descKey)}</span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 text-xs text-content-faint sm:flex">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {g.minutes} min
          </span>
          <ChevronDown className={clsx('h-4 w-4 shrink-0 text-content-faint transition', open && 'rotate-180')} aria-hidden="true" />
        </button>

        {open && (
          <div className="border-t border-line px-4 py-4">
            <p className="mb-3 flex items-start gap-2 text-xs text-content-faint">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {t(meta.whyKey)}
            </p>
            <HowTo stepKey={meta.key} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                to={meta.route}
                className={clsx(
                  'h-9 rounded-lg px-4 text-sm font-semibold',
                  done ? 'btn-outline' : 'btn-primary shadow-sm',
                )}
              >
                {done ? 'Modifier' : 'Commencer'} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <StepActions meta={meta} step={step} />
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export function StoreSetupPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const highlightStep = params.get('step') as StoreSetupStepKey | null;
  const qc = useQueryClient();
  const [openKey, setOpenKey] = useState<StoreSetupStepKey | null>(highlightStep);

  const { data: progress, isLoading } = useQuery({
    queryKey: ['store-setup-progress'],
    queryFn: getStoreSetupProgress,
  });

  const finishMut = useMutation({
    mutationFn: finishStoreSetup,
    onSuccess: (p) => qc.setQueryData(['store-setup-progress'], p),
  });

  if (isLoading || !progress) return <PageLoader />;

  const stepByKey = new Map(progress.steps.map((s) => [s.key, s]));
  const allDone = progress.completedCount === progress.totalSteps;
  // Prochaine étape : celle demandée dans l'URL si elle reste à faire, sinon la
  // première non terminée dans l'ordre méthodique.
  const nextKey =
    (highlightStep && stepByKey.get(highlightStep)?.status !== 'completed' && stepByKey.has(highlightStep)
      ? highlightStep
      : SETUP_ORDER.find((k) => stepByKey.get(k) && stepByKey.get(k)!.status !== 'completed')) ?? null;
  const nextStep = nextKey ? stepByKey.get(nextKey) : undefined;
  const percent = Math.round((progress.completedCount / Math.max(1, progress.totalSteps)) * 100);
  const minutesLeft = SETUP_ORDER.filter((k) => stepByKey.get(k)?.status !== 'completed').reduce(
    (sum, k) => sum + STEP_GUIDES[k].minutes,
    0,
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('storeSetup.pageTitle')}
        subtitle="Suivez les étapes dans l’ordre : chaque étape explique quoi faire et se coche toute seule une fois terminée."
      />

      {/* Avancement global + phases. */}
      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-extrabold text-content">{percent} %</p>
            <p className="text-sm text-content-muted">
              {t('storeSetup.progressLabel', { completed: progress.completedCount, total: progress.totalSteps })}
            </p>
          </div>
          {!allDone && (
            <p className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs text-content-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> encore environ {minutesLeft} min
            </p>
          )}
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {SETUP_PHASES.map((phase, i) => {
            const done = phase.steps.filter((k) => stepByKey.get(k)?.status === 'completed').length;
            const complete = done === phase.steps.length;
            return (
              <a
                key={phase.title}
                href={`#phase-${i + 1}`}
                className={clsx(
                  'rounded-xl border px-3 py-2 transition hover:border-primary/40',
                  complete ? 'border-[color:var(--success)]/40 bg-[color:var(--success)]/5' : 'border-line',
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-content-faint">Phase {i + 1}</p>
                <p className="text-sm font-semibold text-content">{phase.title}</p>
                <p className={clsx('text-xs', complete ? 'text-success' : 'text-content-muted')}>
                  {complete ? 'Terminée' : `${done} / ${phase.steps.length} étapes`}
                </p>
              </a>
            );
          })}
        </div>
      </div>

      {allDone && !progress.finishedAt && (
        <div className="card mb-6 flex flex-col items-center gap-3 border border-primary/20 p-8 text-center">
          <PartyPopper className="h-10 w-10 text-primary" />
          <h2 className="font-display text-xl font-bold text-content">{t('storeSetup.finalCheck.title')}</h2>
          <p className="text-sm text-content-muted">Toutes les étapes sont faites. Vous pouvez travailler normalement.</p>
          <Button onClick={() => finishMut.mutate()} loading={finishMut.isPending} className="mt-2">
            {t('storeSetup.finalCheck.cta')} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {nextKey && nextStep && <NextStepCard meta={STORE_SETUP_STEP_META[nextKey]} step={nextStep} />}

      {/* Toutes les étapes, rangées par phase. */}
      <div className="space-y-8">
        {SETUP_PHASES.map((phase, i) => (
          <section key={phase.title} id={`phase-${i + 1}`} className="scroll-mt-20">
            <div className="mb-3">
              <h3 className="font-display text-lg font-bold text-content">
                <span className="text-primary">Phase {i + 1}</span> · {phase.title}
              </h3>
              <p className="text-sm text-content-muted">{phase.subtitle}</p>
            </div>
            <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-line">
              {phase.steps.map((key) => {
                const step = stepByKey.get(key);
                if (!step) return null;
                return (
                  <StepRow
                    key={key}
                    meta={STORE_SETUP_STEP_META[key]}
                    step={step}
                    isNext={key === nextKey}
                    open={openKey === key}
                    onToggle={() => setOpenKey((k) => (k === key ? null : key))}
                  />
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <p className="mt-8 flex items-start gap-2 rounded-xl bg-surface-2/70 px-4 py-3 text-xs text-content-muted">
        <Info className="mt-px h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          Vous pouvez quitter cette page à tout moment : votre avancement est enregistré. Revenez-y depuis le menu
          pour reprendre là où vous en étiez. Une étape déjà faite reste modifiable avec « Modifier ».
        </span>
      </p>
    </div>
  );
}
