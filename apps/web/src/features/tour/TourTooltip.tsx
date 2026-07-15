import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { usePlacement } from './usePlacement';
import { TourProgress } from './TourProgress';
import { TourControls } from './TourControls';
import type { Rect } from './useTargetRect';
import type { TourStep } from './types';
import type { TourTheme } from './theme';

interface TourTooltipProps {
  step: TourStep;
  rect: Rect | null;
  index: number;
  total: number;
  theme: TourTheme;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

/** Décalage d'entrée : la bulle glisse depuis la cible, pas depuis le néant. */
const SLIDE: Record<string, { x: number; y: number }> = {
  top: { x: 0, y: 8 },
  bottom: { x: 0, y: -8 },
  left: { x: 8, y: 0 },
  right: { x: -8, y: 0 },
  center: { x: 0, y: 0 },
};

export const TourTooltip = memo(function TourTooltip({
  step,
  rect,
  index,
  total,
  theme,
  onNext,
  onPrevious,
  onSkip,
}: TourTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 340, height: 190 });

  // Mesure réelle avant peinture : le placement doit connaître la hauteur de la
  // bulle (variable selon la longueur du texte) pour choisir son côté.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) =>
        Math.abs(s.width - r.width) > 1 || Math.abs(s.height - r.height) > 1
          ? { width: r.width, height: r.height }
          : s,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step.id]);

  const placed = usePlacement(rect, size, step.placement ?? 'auto');

  // Focus sur l'action par défaut à chaque étape : Entrée enchaîne, et les
  // lecteurs d'écran annoncent la nouvelle étape.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>('[data-tour-primary]');
    el?.focus({ preventScroll: true });
  }, [step.id]);

  // Piège à focus : Tab ne doit pas sortir de la bulle vers la page masquée.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const items = ref.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const Icon = step.icon;
  const slide = SLIDE[placed.side] ?? SLIDE.center;

  const arrowStyle: React.CSSProperties = { position: 'absolute', width: 10, height: 10 };
  if (placed.side === 'top') Object.assign(arrowStyle, { bottom: -5, left: placed.arrow.left });
  if (placed.side === 'bottom') Object.assign(arrowStyle, { top: -5, left: placed.arrow.left });
  if (placed.side === 'left') Object.assign(arrowStyle, { right: -5, top: placed.arrow.top });
  if (placed.side === 'right') Object.assign(arrowStyle, { left: -5, top: placed.arrow.top });

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tour-title-${step.id}`}
      aria-describedby={`tour-body-${step.id}`}
      className="fixed z-[1002] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border bg-surface p-4 shadow-card-lg"
      initial={{ opacity: 0, scale: 0.96, x: slide.x, y: slide.y }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0, top: placed.top, left: placed.left }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
      transition={theme.tooltipTransition}
    >
      {placed.side !== 'center' && (
        <span
          aria-hidden
          style={arrowStyle}
          className="rotate-45 border-b border-r border-[color:var(--border)] bg-surface"
        />
      )}

      <div className="mb-3 flex items-start gap-3">
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4.5 w-4.5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3
            id={`tour-title-${step.id}`}
            className="font-display text-sm font-bold text-content"
          >
            {step.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onSkip}
          aria-label={theme.labels.close}
          className="-mr-1 -mt-1 rounded-lg p-1 text-content-faint transition hover:bg-surface-2 hover:text-content"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p
        id={`tour-body-${step.id}`}
        className="mb-4 text-sm leading-relaxed text-content-muted"
      >
        {step.content}
      </p>

      <div className="mb-3">
        <TourProgress current={index} total={total} theme={theme} />
      </div>

      <TourControls
        isFirst={index === 0}
        isLast={index === total - 1}
        theme={theme}
        onNext={onNext}
        onPrevious={onPrevious}
        onSkip={onSkip}
      />
    </motion.div>
  );
});
