import {
  forwardRef,
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
} from 'react';
import { Loader2, X, Eye, EyeOff, MoreHorizontal, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { formatCurrency } from '../lib/format';

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

/**
 * Champ mot de passe avec bascule afficher/masquer (icône œil). Transmet la ref
 * et toutes les props, donc compatible avec react-hook-form (`{...register()}`).
 */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...props }, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={show ? 'text' : 'password'}
          className={clsx('input pr-11', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-content-muted transition-colors hover:text-content"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);

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
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };
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

export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: 'danger' | 'default';
}

export function DropdownMenu({ items }: { items: DropdownItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="btn-ghost h-8 w-8 rounded-lg p-0 text-content-muted hover:text-content"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 origin-top-right rounded-xl border bg-surface p-1 shadow-card-md focus:outline-none animate-fade-in">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition',
                  item.variant === 'danger'
                    ? 'text-danger hover:bg-[color:var(--danger)]/10'
                    : 'text-content hover:bg-surface-2'
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  label,
  sublabel,
}: {
  value: number;
  max?: number;
  label?: string;
  sublabel?: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div className="w-full">
      {(label || sublabel) && (
        <div className="mb-1.5 flex items-center justify-between text-xs sm:text-sm">
          {label && <span className="font-semibold text-content">{label}</span>}
          {sublabel && <span className="text-content-muted">{sublabel}</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CurrencyDisplay({
  amount,
  currency,
  className,
}: {
  amount: number;
  currency?: string;
  className?: string;
}) {
  const formatted = formatCurrency(amount, currency);
  const parts = formatted.split(' ');
  const symbol = parts.pop();
  const value = parts.join(' ');
  return (
    <span className={className}>
      {value} <span className="text-[0.65em] font-normal text-content-muted tracking-normal">{symbol}</span>
    </span>
  );
}
