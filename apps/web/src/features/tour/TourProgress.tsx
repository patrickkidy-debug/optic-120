import { memo } from 'react';
import { motion } from 'framer-motion';
import type { TourTheme } from './theme';

interface TourProgressProps {
  current: number;
  total: number;
  theme: TourTheme;
}

/** « Étape X / Y » + barre de progression. */
export const TourProgress = memo(function TourProgress({
  current,
  total,
  theme,
}: TourProgressProps) {
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-content-faint">
        {theme.labels.stepOf(current + 1, total)}
      </span>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={theme.labels.stepOf(current + 1, total)}
      >
        <motion.div
          className="h-full rounded-full bg-brand"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        />
      </div>
    </div>
  );
});
