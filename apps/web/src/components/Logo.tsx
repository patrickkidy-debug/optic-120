import { Eye } from 'lucide-react';
import clsx from 'clsx';

export function Logo({ withText = true, className }: { withText?: boolean; className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-card">
        <Eye className="h-5 w-5 text-white" strokeWidth={2.6} />
      </div>
      {withText && (
        <div className="font-display text-lg font-extrabold tracking-tight text-content">
          Oculo<span className="text-gradient">SaaS</span>
        </div>
      )}
    </div>
  );
}
