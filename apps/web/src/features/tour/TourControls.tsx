import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import type { TourTheme } from './theme';
import type { useSpeechNarration } from './useSpeechNarration';

interface TourControlsProps {
  isFirst: boolean;
  isLast: boolean;
  theme: TourTheme;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  /** Vrai tant que l'action attendue par l'étape n'a pas eu lieu. */
  nextDisabled?: boolean;
  /** Présent uniquement pour une visite narrée : affiche mute/relire. */
  narration?: ReturnType<typeof useSpeechNarration>;
}

export const TourControls = memo(function TourControls({
  isFirst,
  isLast,
  theme,
  onNext,
  onPrevious,
  onSkip,
  nextDisabled,
  narration,
}: TourControlsProps) {
  const { i18n } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg px-2 py-1 text-xs font-medium text-content-faint transition hover:text-content"
        >
          {theme.labels.skip}
        </button>
        {narration?.supported && (
          <>
            <button
              type="button"
              onClick={() => narration.replay(i18n.language)}
              title="Réécouter"
              aria-label="Réécouter"
              className="rounded-lg p-1.5 text-content-faint transition hover:bg-surface-2 hover:text-content"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={narration.toggleMute}
              title={narration.muted ? 'Activer le son' : 'Couper le son'}
              aria-label={narration.muted ? 'Activer le son' : 'Couper le son'}
              className="rounded-lg p-1.5 text-content-faint transition hover:bg-surface-2 hover:text-content"
            >
              {narration.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
      </div>

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
          disabled={nextDisabled}
          data-tour-primary
          className="btn-primary h-9 rounded-lg px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLast ? theme.labels.finish : theme.labels.next}
          {isLast ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
});
