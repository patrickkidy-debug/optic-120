import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { ACTIVATION_STEP_COUNT, ACTIVATION_STEP_ORDER, type ActivationStep } from '@oculo/shared-types';

/**
 * Briques communes du tunnel d'activation.
 *
 * Pensé mobile d'abord : la majorité des prospects arrivent d'une publicité
 * Facebook ou Instagram, donc sur un téléphone. Une question à la fois, des
 * cibles tactiles larges, aucun écran à faire défiler longuement.
 */

export function ActivationShell({
  step,
  title,
  subtitle,
  children,
  footer,
}: {
  step?: ActivationStep;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-2">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
            O
          </span>
          <span className="font-display text-lg font-extrabold text-content">OculoSaaS</span>
        </div>

        {step && <StepBar current={step} />}

        <h1 className="font-display text-2xl font-extrabold leading-tight text-content sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-sm text-content-muted sm:text-base">{subtitle}</p>}

        <div className="mt-6">{children}</div>

        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}

/** « Étape 2 sur 5 » + points de progression : le prospect doit se situer. */
export function StepBar({ current }: { current: ActivationStep }) {
  const index = ACTIVATION_STEP_ORDER.indexOf(current);
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-1.5">
        {ACTIVATION_STEP_ORDER.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= index ? 'bg-primary' : 'bg-surface-3'
            }`}
          />
        ))}
      </div>
      <p className="text-xs font-medium text-content-muted">
        Étape {index + 1} sur {ACTIVATION_STEP_COUNT}
      </p>
    </div>
  );
}

/**
 * Choix unique. Bouton pleine largeur plutôt qu'un bouton radio : sur un
 * téléphone, la cible doit être atteignable au pouce sans viser.
 */
export function ChoiceCard({
  label,
  selected,
  onSelect,
  hint,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all ${
        selected
          ? 'border-primary bg-primary-soft shadow-sm'
          : 'border-line bg-surface hover:border-primary/40 hover:bg-surface-2'
      }`}
    >
      <span className="min-w-0">
        <span className={`block font-medium ${selected ? 'text-primary' : 'text-content'}`}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-content-muted">{hint}</span>}
      </span>
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
          selected ? 'border-primary bg-primary text-white' : 'border-line'
        }`}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

/** Choix multiple : même gabarit, case carrée pour distinguer du choix unique. */
export function MultiChoiceCard({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
        selected
          ? 'border-primary bg-primary-soft shadow-sm'
          : 'border-line bg-surface hover:border-primary/40 hover:bg-surface-2'
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors ${
          selected ? 'border-primary bg-primary text-white' : 'border-line'
        }`}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
      <span className={`font-medium ${selected ? 'text-primary' : 'text-content'}`}>{label}</span>
    </button>
  );
}

/**
 * Barre d'action collée en bas sur mobile : le bouton « Continuer » reste
 * atteignable sans faire défiler jusqu'au bout de la liste de choix.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 border-t bg-surface-2/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      {children}
    </div>
  );
}
