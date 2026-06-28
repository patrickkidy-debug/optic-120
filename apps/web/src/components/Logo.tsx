import { Eye } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/auth';

export function Logo({ withText = true, className }: { withText?: boolean; className?: string }) {
  const logoUrl = useAuthStore((s) => s.user?.tenantLogoUrl);
  const tenantName = useAuthStore((s) => s.user?.tenantName);

  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover shadow-card" />
      ) : (
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-card">
          <Eye className="h-5 w-5 text-white" strokeWidth={2.6} />
        </div>
      )}
      {withText && (
        <div className="font-display text-lg font-extrabold tracking-tight text-content">
          {logoUrl && tenantName ? (
            <span className="line-clamp-1 max-w-[150px]">{tenantName}</span>
          ) : (
            <>
              Oculo<span className="text-gradient">SaaS</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
