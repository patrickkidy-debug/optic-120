import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { ACTIVATION_STEP_COUNT, ACTIVATION_STEP_ORDER, type ActivationStep } from '@oculo/shared-types';

/**
 * Briques communes du tunnel d'activation.
 *
 * Mobile d'abord : les prospects arrivent d'une publicité Facebook ou
 * Instagram, donc sur un téléphone. Une question à la fois, cibles tactiles
 * larges, et rien d'essentiel hors de portée du pouce.
 *
 * Le tunnel est FORCÉ en clair via la classe `.light`, appliquée au conteneur
 * et non au document : une page de conversion doit avoir le même rendu pour
 * tout le monde, sans dépendre du thème sombre par défaut de l'application, et
 * sans modifier la préférence du visiteur.
 */

export function ActivationShell({
  step,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  step?: ActivationStep;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="light min-h-screen bg-surface-2 text-content">
      <div className={`mx-auto w-full px-4 py-6 sm:py-10 ${wide ? 'max-w-3xl' : 'max-w-2xl'}`}>
        <Brand />
        {step && <StepBar current={step} />}

        {title && (
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-content sm:text-3xl">
            {title}
          </h1>
        )}
        {subtitle && <p className="mt-2 text-sm text-content-muted sm:text-base">{subtitle}</p>}

        <div className={title ? 'mt-6' : ''}>{children}</div>
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Logo et nom : ramenent a la presentation du tunnel (l'ecran d'accueil de
 * /activation), pas au site vitrine. Le prospect est en train de s'activer ;
 * le renvoyer ailleurs lui ferait perdre le fil.
 *
 * La presentation n'a pas de route propre — c'est un etat de la page — donc le
 * lien passe l'intention par l'etat de navigation. La progression enregistree
 * n'est pas effacee : « Commencer » reprend ou le prospect s'etait arrete.
 */
export function Brand() {
  return (
    <Link
      to="/activation"
      state={{ intro: true }}
      aria-label="OculoSaaS — revenir à la présentation"
      className="mb-6 inline-flex items-center gap-2 rounded-xl transition-opacity hover:opacity-80"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-sm font-bold text-white shadow-sm">
        O
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight text-content">OculoSaaS</span>
    </Link>
  );
}

/** « Étape 2 sur 5 » + jauge : le prospect doit toujours savoir où il en est. */
export function StepBar({ current }: { current: ActivationStep }) {
  const index = ACTIVATION_STEP_ORDER.indexOf(current);
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-1.5">
        {ACTIVATION_STEP_ORDER.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= index ? 'bg-gradient-to-r from-primary to-accent' : 'bg-surface-3'
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

/** Pastille d'accroche avec point animé : signale une page vivante. */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 shadow-sm ring-1 ring-line">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{children}</span>
    </span>
  );
}

/** Fond lumineux diffus derrière le hero. Purement décoratif. */
export function Glow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-to-tr from-primary/20 via-accent/15 to-transparent blur-3xl"
    />
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
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
        selected
          ? 'border-primary bg-primary-soft shadow-sm'
          : 'border-line bg-surface hover:border-primary/40 hover:shadow-sm'
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

/** Choix multiple : case carrée, pour distinguer du choix unique. */
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
      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.99] ${
        selected
          ? 'border-primary bg-primary-soft shadow-sm'
          : 'border-line bg-surface hover:border-primary/40 hover:shadow-sm'
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
 * Action principale : dégradé et halo, pour qu'aucun doute ne subsiste sur
 * l'endroit où appuyer.
 */
export function PrimaryAction({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3.5 font-display font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.35)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

/**
 * Barre d'action collée en bas sur mobile : « Continuer » reste atteignable
 * sans faire défiler toute la liste de choix.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-surface-2/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      {children}
    </div>
  );
}
