import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { ot } from '../../features/oculotrack/api';
import { usePermission } from '../../store/auth';
import { formatDateTime } from '../../lib/format';
import { tr } from '../../lib/tr';

/**
 * Notifications de l'établissement (colis réceptionné, montage, retard,
 * anomalie…). Rafraîchies chaque minute ; un clic ouvre l'élément concerné.
 */
export function NotificationsBell() {
  const canView = usePermission('oculotrack.view');
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: ot.notifications, refetchInterval: 60_000, enabled: canView });
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  if (!canView) return null;
  const unread = data?.unread ?? 0;

  async function markAll() {
    await ot.readNotifications().catch(() => undefined);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost relative h-9 w-9 rounded-xl p-0" aria-label={tr('notif.title')}>
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,24rem)] overflow-hidden rounded-2xl border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-bold text-content">{tr('notif.title')}</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-primary">
                <CheckCheck className="h-3.5 w-3.5" /> {tr('notif.markAll')}
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {!data?.notifications.length ? (
              <li className="p-6 text-center text-sm text-content-muted">{tr('notif.empty')}</li>
            ) : (
              data.notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`block w-full px-4 py-3 text-left hover:bg-surface-2 ${n.readAt ? '' : 'bg-primary-soft/40'}`}
                    onClick={async () => {
                      setOpen(false);
                      if (!n.readAt) { await ot.readNotifications([n.id]).catch(() => undefined); qc.invalidateQueries({ queryKey: ['notifications'] }); }
                      if (n.link) nav(n.link);
                    }}
                  >
                    <p className="text-sm font-semibold text-content">{n.title}</p>
                    <p className="text-xs text-content-muted">{n.body}</p>
                    <p className="mt-0.5 text-[11px] text-content-faint">{formatDateTime(n.createdAt)}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
