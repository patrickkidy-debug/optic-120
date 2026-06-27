import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Loader2, X, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-4 w-4 animate-spin', className)} />;
}

export function PageLoader() {
  return (
    <div className="grid place-items-center py-20 text-content-muted">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-content-muted',
  success: 'bg-[color:var(--success)]/15 text-success',
  warning: 'bg-[color:var(--warning)]/15 text-warning',
  danger: 'bg-[color:var(--danger)]/15 text-danger',
  info: 'bg-primary-soft text-primary',
  accent: 'bg-accent-soft text-accent',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={clsx('badge', badgeTones[tone])}>{children}</span>;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'primary',
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'primary' | 'accent' | 'success' | 'danger';
}) {
  const toneClasses: Record<string, string> = {
    primary: 'bg-primary-soft text-primary',
    accent: 'bg-accent-soft text-accent',
    success: 'bg-[color:var(--success)]/15 text-success',
    danger: 'bg-[color:var(--danger)]/15 text-danger',
  };
  return (
    <div className="card p-5 transition hover:shadow-card-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-content-muted">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-content">{value}</p>
          {hint && <p className="mt-1 text-xs text-content-faint">{hint}</p>}
        </div>
        <div className={clsx('grid h-11 w-11 place-items-center rounded-xl', toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-content">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-content-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-content-faint">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-4 font-medium text-content">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-content-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div
        className={clsx(
          'card w-full animate-fade-in p-0 shadow-card-lg',
          sizes[size],
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-display text-lg font-bold text-content">{title}</h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 rounded-lg p-0" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Button({
  variant = 'primary',
  loading,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'accent' | 'ghost' | 'outline' | 'danger';
  loading?: boolean;
}) {
  const cls = {
    primary: 'btn-primary',
    accent: 'btn-accent',
    ghost: 'btn-ghost',
    outline: 'btn-outline',
    danger: 'btn-danger',
  }[variant];
  return (
    <button className={clsx(cls, className)} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}
