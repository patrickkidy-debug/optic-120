import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { AlertTriangle, CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { useNetworkStore, useSyncStore, syncNow } from '../lib/offline';
import { currentOfflineDb, type OutboxOp } from '../lib/offline/db';
import { dismissRejected, rejectedOperations } from '../lib/offline/outbox';
import { refreshCounters } from '../lib/offline/sync';
import { useAuthStore } from '../store/auth';

const KIND_KEY: Record<string, string> = {
  SALE_CREATE: 'sync.kindSale',
  STOCK_ADJUST: 'sync.kindStock',
};

function formatWhen(iso: string | null): string {
  if (!iso) return i18n.t('sync.never');
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  return sameDay
    ? i18n.t('sync.todayAt', { time })
    : i18n.t('sync.dateAt', { date: d.toLocaleDateString(i18n.language), time });
}

/**
 * État du réseau et de la synchronisation, dans la barre du haut.
 *
 * Trois états seulement, lisibles d'un coup d'œil :
 *   vert   — en ligne, tout est envoyé ;
 *   orange — envoi en cours, ou des modifications attendent ;
 *   rouge  — hors connexion (on continue à travailler).
 * Les détails s'ouvrent au clic : jamais de fenêtre qui s'impose d'elle-même.
 */
export function SyncStatus() {
  const { t } = useTranslation();
  const online = useNetworkStore((s) => s.online);
  const offlineSession = useAuthStore((s) => s.offline);
  const { phase, pending, rejected, lastSyncAt, lastError } = useSyncStore();
  const [open, setOpen] = useState(false);
  const [rejectedOps, setRejectedOps] = useState<OutboxOp[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const db = currentOfflineDb();
    if (db) void rejectedOperations(db).then(setRejectedOps);
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, rejected]);

  const isOffline = !online;
  const syncing = phase === 'syncing';
  const tone = isOffline ? 'danger' : syncing || pending > 0 ? 'warning' : 'success';
  const label = isOffline
    ? t('sync.offline')
    : syncing
      ? t('sync.syncing')
      : pending > 0
        ? t('sync.pendingCount', { count: pending })
        : t('sync.online');

  const toneClass = {
    danger: 'bg-[color:var(--danger)]/10 text-danger',
    warning: 'bg-[color:var(--warning)]/10 text-warning',
    success: 'bg-[color:var(--success)]/10 text-success',
  }[tone];

  const Icon = isOffline ? CloudOff : syncing ? RefreshCw : Wifi;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('sync.statusAria', { label })}
        className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold ${toneClass}`}
      >
        <Icon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
        <span className="hidden md:inline">{label}</span>
        {rejected > 0 && (
          <AlertTriangle className="h-3.5 w-3.5 text-danger" aria-label={t('sync.rejectedAria', { count: rejected })} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[90vw] rounded-2xl border bg-surface p-4 text-sm shadow-card-lg">
          <p className="font-semibold text-content">{label}</p>
          <p className="mt-1 text-content-muted">
            {isOffline
              ? t('sync.offlineHint')
              : pending > 0
                ? t('sync.sendingHint')
                : t('sync.allSavedHint')}
          </p>
          {offlineSession && !isOffline && (
            <p className="mt-2 text-xs text-content-muted">{t('sync.reconnecting')}</p>
          )}

          <dl className="mt-3 space-y-1 border-t pt-3 text-xs">
            <div className="flex justify-between">
              <dt className="text-content-muted">{t('sync.lastSync')}</dt>
              <dd className="text-content">{formatWhen(lastSyncAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-content-muted">{t('sync.pending')}</dt>
              <dd className="text-content">{pending}</dd>
            </div>
            {lastError && pending > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-content-muted">{t('sync.lastAttempt')}</dt>
                <dd className="text-right text-content">{lastError}</dd>
              </div>
            )}
          </dl>

          {rejectedOps.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="text-xs font-semibold text-danger">
                {t('sync.rejectedTitle', { count: rejectedOps.length })}
              </p>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {rejectedOps.map((op) => (
                  <li key={op.opId} className="rounded-lg bg-surface-2 p-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-content">{KIND_KEY[op.kind] ? t(KIND_KEY[op.kind]!) : op.kind}</span>
                      <span className="text-content-faint">{formatWhen(op.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-content-muted">{op.lastError}</p>
                    <button
                      type="button"
                      className="mt-1 text-primary hover:underline"
                      onClick={async () => {
                        const db = currentOfflineDb();
                        if (!db) return;
                        await dismissRejected(db, op.opId);
                        await refreshCounters(db);
                        setRejectedOps(await rejectedOperations(db));
                      }}
                    >
                      {t('sync.acknowledge')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            disabled={isOffline || syncing}
            onClick={() => void syncNow()}
            className="btn-outline mt-3 h-9 w-full rounded-xl text-xs disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> {t('sync.syncNow')}
          </button>
        </div>
      )}
    </div>
  );
}
