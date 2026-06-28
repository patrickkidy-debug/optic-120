import { type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { LockScreen } from './LockScreen';
import { SuspensionGate } from './SuspensionGate';

export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const locked = useAuthStore((s) => s.locked);
  const suspended = useAuthStore((s) => s.suspended);

  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (locked) return <LockScreen />;
  if (suspended) return <SuspensionGate />;
  return <Outlet />;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const allowed = useAuthStore((s) => s.user?.permissions.includes(permission) ?? false);
  if (!allowed) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--danger)]/15 text-danger">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="mt-4 font-display text-lg font-bold text-content">Accès refusé</p>
        <p className="mt-1 max-w-sm text-sm text-content-muted">
          Vous n'avez pas la permission requise pour cette section.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
