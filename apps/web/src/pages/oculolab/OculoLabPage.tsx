import { useMemo, useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, FileCheck2, FilePen, Plus, ScanLine, Search, Trash2 } from 'lucide-react';
import { Badge, EmptyState, PageHeader, PageLoader, STICKER_TONES } from '../../components/ui';
import { deleteTrace, listTraces } from '../../features/oculolab/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { tr } from '../../lib/tr';
import { ShapeView } from './ShapeView';

const L = (k: string, o?: Record<string, unknown>) => tr(`oculolab.list.${k}`, o);

export function OculoLabPage() {
  const qc = useQueryClient();
  const canEdit = usePermission('optique.prescriptions.create');
  const [q, setQ] = useState('');
  const { data: traces, isLoading } = useQuery({ queryKey: ['oculolab-traces'], queryFn: () => listTraces() });
  const del = useMutation({
    mutationFn: deleteTrace,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oculolab-traces'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const all = traces ?? [];
  const stats = useMemo(() => {
    const month = new Date();
    month.setDate(1);
    month.setHours(0, 0, 0, 0);
    return {
      month: all.filter((t) => new Date(t.createdAt) >= month).length,
      sent: all.filter((t) => t.status === 'SENT').length,
      draft: all.filter((t) => t.status === 'DRAFT').length,
    };
  }, [all]);

  const needle = q.trim().toLowerCase();
  const shown = all.filter(
    (t) =>
      !needle ||
      t.number.toLowerCase().includes(needle) ||
      (t.label ?? '').toLowerCase().includes(needle) ||
      (t.frameRef ?? '').toLowerCase().includes(needle) ||
      (t.supplier?.name ?? '').toLowerCase().includes(needle) ||
      `${t.customer?.firstName ?? ''} ${t.customer?.lastName ?? ''}`.toLowerCase().includes(needle),
  );

  return (
    <div>
      <PageHeader
        title="OculoLab"
        subtitle={L('subtitle')}
        actions={
          canEdit && (
            <Link to="/oculolab/nouveau" className="btn-primary h-10 rounded-xl px-4 text-sm">
              <Plus className="h-4 w-4" /> {L('new')}
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(
          [
            [CalendarDays, 'primary', L('statMonth'), stats.month],
            [FileCheck2, 'success', L('statSent'), stats.sent],
            [FilePen, 'accent', L('statDraft'), stats.draft],
          ] as const
        ).map(([Icon, tone, label, value]) => (
          <div key={label} className="card card-sticker p-4" style={{ '--sticker': STICKER_TONES[tone].shadow } as CSSProperties}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-content-muted">{label}</p>
                <p className="mt-1.5 font-arcade text-[22px] text-content">{value}</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl text-[#120a2b]" style={{ background: STICKER_TONES[tone].chip }}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : all.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={ScanLine}
            title={L('emptyTitle')}
            hint={L('emptyHint')}
            action={
              canEdit && (
                <Link to="/oculolab/nouveau" className="btn-primary h-10 rounded-xl px-4 text-sm">
                  <ScanLine className="h-4 w-4" /> {L('firstScan')}
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
            <input className="input pl-9" placeholder={L('search')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {shown.map((t) => (
              <div key={t.id} className="card card-sticker flex flex-col p-4" style={{ '--sticker': t.status === 'SENT' ? '#10b981' : '#7c3aed' } as CSSProperties}>
                <Link to={`/oculolab/${t.id}`} className="block">
                  <div className="rounded-xl bg-surface-2 px-3 py-2 text-content">
                    <ShapeView radii={t.radii} pair dbl={t.dbl} className="mx-auto h-24 w-full" />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-content">{t.number}</p>
                      <p className="truncate text-xs text-content-muted">
                        {t.customer ? `${t.customer.firstName} ${t.customer.lastName}` : t.label || L('noClient')}
                      </p>
                    </div>
                    <Badge tone={t.status === 'SENT' ? 'success' : 'neutral'}>{tr(`oculolab.status_${t.status}`)}</Badge>
                  </div>
                  <p className="mt-2 font-mono text-xs text-content">
                    {t.boxA.toFixed(1)}□{t.dbl.toFixed(1)} · B {t.boxB.toFixed(1)} · ED {t.ed.toFixed(1)}
                  </p>
                </Link>
                <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-content-faint" style={{ marginTop: 12 }}>
                  <span className="truncate">
                    {formatDate(t.createdAt)}
                    {t.supplier ? ` · ${t.supplier.name}` : ''}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn-ghost h-7 w-7 shrink-0 rounded-lg p-0 text-danger"
                      aria-label={L('delete')}
                      title={L('delete')}
                      onClick={() => {
                        if (confirm(L('confirmDelete', { number: t.number }))) del.mutate(t.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {shown.length === 0 && <p className="mt-8 text-center text-sm text-content-muted">{L('noMatch')}</p>}
        </>
      )}
    </div>
  );
}
