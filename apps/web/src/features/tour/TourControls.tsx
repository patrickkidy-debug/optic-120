import { memo } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { TourTheme } from './theme';

interface TourControlsProps {
  isFirst: boolean;
  isLast: boolean;
  theme: TourTheme;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

export const TourControls = memo(function TourControls({
  isFirst,
  isLast,
  theme,
  onNext,
  onPrevious,
  onSkip,
}: TourControlsProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onSkip}
        className="rounded-lg px-2 py-1 text-xs font-medium text-content-faint transition hover:text-content"
      >
        {theme.labels.skip}
      </button>

      <div className="flex items-center gap-2">
        {!isFirst && (
          <button
            type="button"
            onClick={onPrevious}
            className="btn-outline h-9 rounded-lg px-3 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {theme.labels.previous}
          </button>
        )}
        {/* Action par défaut : reçoit le focus à l'ouverture, Entrée la déclenche. */}
        <button
          type="button"
          onClick={onNext}
          data-tour-primary
          className="btn-primary h-9 rounded-lg px-4 text-xs"
        >
          {isLast ? theme.labels.finish : theme.labels.next}
          {isLast ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
});
