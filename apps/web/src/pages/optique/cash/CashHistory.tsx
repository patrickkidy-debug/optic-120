import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  History,
  Printer,
  Receipt,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  getCashHistory,
  getCashSessionReport,
  type CashSessionReport,
  type CashSessionRow,
} from '../../../features/cashregister/api';
import { useAuthStore } from '../../../store/auth';
import { displayLocale, formatCurrency, formatDate, formatDateTime } from '../../../lib/format';
import { expenseCategoryLabel, paymentMethodLabel } from '../../../lib/labels';
import { Badge, Button, EmptyState, Modal, Spinner } from '../../../components/ui';
import { tr } from '../../../lib/tr';

type Period = '7d' | '30d' | 'month' | 'lastMonth' | 'custom';
const PAGE_SIZE = 10;

const iso = (d: Date) => d.toISOString().slice(0, 10);
function rangeOf(p: Period, custom: { from: string; to: string }): { from?: string; to?: string } {
  const now = new Date();
  if (p === '7d') return { from: iso(new Date(now.getTime() - 6 * 86_400_000)), to: iso(now) };
  if (p === '30d') return { from: iso(new Date(now.getTime() - 29 * 86_400_000)), to: iso(now) };
  if (p === 'month') return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), to: iso(now) };
  if (p === 'lastMonth') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { from: iso(start), to: iso(end) };
  }
  return { from: custom.from || undefined, to: custom.to || undefined };
}

const methodIcon = (m: string) => (m === 'CASH' ? Banknote : m === 'CARD' ? CreditCard : Smartphone);

function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

function time(v: string | Date): string {
  return new Intl.DateTimeFormat(displayLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}

/** Écart de caisse : juste, manque ou excédent — lisible d'un coup d'œil. */
export function VarianceBadge({ value, open }: { value: number | null; open?: boolean }) {
  if (open) return <Badge tone="info">{tr('cashHistory.inProgress')}</Badge>;
  if (value == null) return <span className="text-xs text-content-faint">—</span>;
  if (Math.abs(value) < 1)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--success)]/12 px-2 py-0.5 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> {tr('cashHistory.balanced')}
      </span>
    );
  const short = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
        short ? 'bg-[color:var(--danger)]/10 text-danger' : 'bg-[color:var(--warning)]/15 text-warning'
      }`}
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {short ? tr('cashHistory.shortage') : tr('cashHistory.surplus')} {value > 0 ? '+' : '−'}
      {formatCurrency(Math.abs(value))}
    </span>
  );
}

export function CashHistory({ branchId, refreshKey }: { branchId: string; refreshKey?: unknown }) {
  const [period, setPeriod] = useState<Period>('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const range = useMemo(() => rangeOf(period, custom), [period, custom]);
  useEffect(() => setPage(1), [period, custom, branchId]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['cash-history', branchId, range.from, range.to, page, refreshKey],
    queryFn: () => getCashHistory({ branchId, ...range, page, pageSize: PAGE_SIZE }),
    // Garde la page précédente pendant une recherche / pagination, mais JAMAIS
    // après un changement de magasin (les données d'un autre magasin
    // s'afficheraient le temps du chargement).
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === branchId ? keepPreviousData(prev) : undefined),
  });
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const PERIODS: { id: Period; label: string }[] = [
    { id: '7d', label: tr('cashHistory.p7d') },
    { id: '30d', label: tr('cashHistory.p30d') },
    { id: 'month', label: tr('cashHistory.pMonth') },
    { id: 'lastMonth', label: tr('cashHistory.pLastMonth') },
    { id: 'custom', label: tr('cashHistory.pCustom') },
  ];

  return (
    <section className="card p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-content">{tr('cashHistory.title')}</h2>
            <p className="text-xs text-content-muted">{tr('cashHistory.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={tr('cashHistory.period')}>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                period === p.id ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted hover:text-content'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3 text-sm">
          <CalendarRange className="h-4 w-4 text-content-faint" />
          <input type="date" className="input h-9 w-auto" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <span className="text-content-faint">→</span>
          <input type="date" className="input h-9 w-auto" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </div>
      )}

      {/* Totaux de la période */}
      <div className="grid grid-cols-2 gap-px border-b bg-line md:grid-cols-4">
        <Stat label={tr('cashHistory.sessions')} value={data ? String(data.stats.sessions) : undefined} />
        <Stat label={tr('cashHistory.collected')} value={data ? formatCurrency(data.stats.salesTotal) : undefined} />
        <Stat
          label={tr('cashHistory.varianceTotal')}
          value={data ? `${data.stats.varianceTotal > 0 ? '+' : data.stats.varianceTotal < 0 ? '−' : ''}${formatCurrency(Math.abs(data.stats.varianceTotal))}` : undefined}
          tone={data && Math.abs(data.stats.varianceTotal) >= 1 ? (data.stats.varianceTotal < 0 ? 'danger' : 'warning') : 'success'}
        />
        <Stat
          label={tr('cashHistory.withVariance')}
          value={data ? `${data.stats.withVariance} / ${data.stats.closed}` : undefined}
          tone={data && data.stats.withVariance > 0 ? 'warning' : undefined}
        />
      </div>

      {isError ? (
        <div className="p-6">
          <EmptyState icon={History} title={tr('cashHistory.loadError')} action={<Button variant="outline" onClick={() => void refetch()}>{tr('crm.retry')}</Button>} />
        </div>
      ) : isLoading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : !data || data.sessions.length === 0 ? (
        <div className="p-6">
          <EmptyState icon={History} title={tr('cashHistory.empty')} hint={tr('cashHistory.emptyHint')} />
        </div>
      ) : (
        <div className={`transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {/* Tableau (tablette et ordinateur) */}
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-content-faint">
                <th className="table-cell font-semibold">{tr('cashHistory.colSession')}</th>
                <th className="table-cell text-right font-semibold">{tr('cashHistory.colCollected')}</th>
                <th className="table-cell text-right font-semibold">{tr('cashHistory.colNet')}</th>
                <th className="table-cell text-right font-semibold">{tr('cashHistory.colVariance')}</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.id} onClick={() => setOpenId(s.id)} className="group cursor-pointer border-b transition-colors last:border-0 hover:bg-primary-soft/40">
                  <td className="table-cell">
                    <p className="whitespace-nowrap font-medium text-content group-hover:text-primary">{formatDate(s.openedAt)}</p>
                    <p className="flex items-center gap-1 whitespace-nowrap text-xs text-content-faint">
                      <Clock className="h-3 w-3" />
                      {time(s.openedAt)} → {s.closedAt ? time(s.closedAt) : tr('cashHistory.now')} · {duration(s.durationMinutes)}
                    </p>
                    <p className="whitespace-nowrap text-xs text-content-muted">{s.openedBy ?? '—'}{s.closedBy && s.closedBy !== s.openedBy ? ` · ${tr('cashHistory.closedBy', { name: s.closedBy })}` : ''}</p>
                  </td>
                  <td className="table-cell text-right">
                    <p className="whitespace-nowrap font-medium text-content">{formatCurrency(s.salesTotal)}</p>
                    <p className="whitespace-nowrap text-xs text-content-faint">{tr('cashHistory.payments', { n: s.paymentsCount })}</p>
                  </td>
                  <td className="table-cell whitespace-nowrap text-right font-semibold text-content">{formatCurrency(s.netTotal)}</td>
                  <td className="table-cell text-right">
                    <VarianceBadge value={s.variance} open={s.status === 'OPEN'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Cartes (mobile) */}
          <ul className="divide-y md:hidden">
            {data.sessions.map((s) => (
              <li key={s.id}>
                <button className="w-full p-4 text-left" onClick={() => setOpenId(s.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-content">{formatDate(s.openedAt)}</p>
                    <VarianceBadge value={s.variance} open={s.status === 'OPEN'} />
                  </div>
                  <p className="text-xs text-content-faint">
                    {time(s.openedAt)} → {s.closedAt ? time(s.closedAt) : tr('cashHistory.now')} · {s.openedBy ?? '—'}
                  </p>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-content-muted">{tr('cashHistory.colCollected')}</span>
                    <span className="font-medium text-content">{formatCurrency(s.salesTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-content-muted">{tr('cashHistory.colNet')}</span>
                    <span className="font-semibold text-content">{formatCurrency(s.netTotal)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
              <span className="text-content-muted">
                {page} / {pageCount}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={tr('crm.prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} aria-label={tr('crm.next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {openId && <SessionReportModal id={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value?: string; tone?: 'success' | 'danger' | 'warning' }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-content';
  return (
    <div className="bg-surface px-5 py-3">
      <p className="text-xs text-content-faint">{label}</p>
      {value === undefined ? <div className="mt-1 h-6 w-20 animate-pulse rounded bg-surface-2" /> : <p className={`mt-0.5 font-display text-lg font-bold ${color}`}>{value}</p>}
    </div>
  );
}

/* ------------------------------ Rapport détaillé ------------------------------ */

function SessionReportModal({ id, onClose }: { id: string; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { data: r, isLoading } = useQuery({ queryKey: ['cash-report', id], queryFn: () => getCashSessionReport(id) });

  return (
    <Modal open onClose={onClose} title={tr('cashHistory.reportTitle')} size="xl">
      {isLoading || !r ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          {/* En-tête */}
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-surface-2 p-4">
            <div>
              <p className="font-display text-lg font-bold text-content">
                {formatDate(r.openedAt)}
                {r.branchName && <span className="font-normal text-content-muted"> · {r.branchName}</span>}
              </p>
              <p className="text-sm text-content-muted">
                {tr('cashHistory.openedAtBy', { time: time(r.openedAt), name: r.openedBy ?? '—' })}
                {r.closedAt && <> · {tr('cashHistory.closedAtBy', { time: formatDateTime(r.closedAt), name: r.closedBy ?? '—' })}</>}
              </p>
              <p className="text-xs text-content-faint">{tr('cashHistory.duration', { d: duration(r.durationMinutes) })}</p>
            </div>
            <div className="flex items-center gap-2">
              <VarianceBadge value={r.variance} open={r.status === 'OPEN'} />
              <Button variant="outline" onClick={() => printReport(r, { name: user?.tenantName ?? 'OculoSaaS', logoUrl: user?.tenantLogoUrl, location: user?.tenantLocation, phone: user?.tenantContactPhone })}>
                <Printer className="h-4 w-4" /> {tr('cashHistory.print')}
              </Button>
            </div>
          </div>

          {/* Chiffres clés */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icon={Wallet} label={tr('cashHistory.collected')} value={formatCurrency(r.salesTotal)} sub={tr('cashHistory.salesAndPayments', { s: r.salesCount, p: r.paymentsCount })} />
            <Kpi icon={Receipt} label={tr('cashHistory.colExpenses')} value={r.expensesTotal ? `− ${formatCurrency(r.expensesTotal)}` : formatCurrency(0)} sub={tr('cashHistory.items', { n: r.expensesCount })} tone={r.expensesTotal ? 'danger' : undefined} />
            <Kpi icon={ArrowDownLeft} label={tr('cashHistory.transfersNet')} value={`${r.transfersIn - r.transfersOut >= 0 ? '+' : '−'} ${formatCurrency(Math.abs(r.transfersIn - r.transfersOut))}`} sub={`+${formatCurrency(r.transfersIn)} / −${formatCurrency(r.transfersOut)}`} />
            <Kpi icon={CheckCircle2} label={tr('cashHistory.colNet')} value={formatCurrency(r.netTotal)} sub={tr('cashHistory.netHint')} strong />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Répartition par moyen de paiement */}
            <Block title={tr('cashHistory.byMethod')}>
              {r.byMethod.length === 0 ? (
                <p className="text-sm text-content-muted">{tr('cash.noPayments')}</p>
              ) : (
                <div className="space-y-3">
                  {r.byMethod.map((m) => {
                    const Icon = methodIcon(m.method);
                    const pct = r.salesTotal ? Math.round((m.amount / r.salesTotal) * 100) : 0;
                    return (
                      <div key={m.method}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-content">
                            <Icon className="h-4 w-4 text-primary" />
                            {paymentMethodLabel(m.method)}
                            <span className="text-xs text-content-faint">· {m.count}</span>
                          </span>
                          <span className="font-medium text-content">
                            {formatCurrency(m.amount)} <span className="text-xs text-content-faint">({pct} %)</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Block>

            {/* Rapprochement des espèces */}
            <Block title={tr('cashHistory.reconciliation')}>
              <Line label={tr('cash.openingFloat')} value={formatCurrency(r.openingAmount)} />
              <Line label={tr('cash.cashSales')} value={`+ ${formatCurrency(r.cashSales)}`} />
              {r.transfersIn > 0 && <Line label={tr('cashHistory.transfersIn')} value={`+ ${formatCurrency(r.transfersIn)}`} />}
              {r.transfersOut > 0 && <Line label={tr('cashHistory.transfersOut')} value={`− ${formatCurrency(r.transfersOut)}`} />}
              {r.expensesTotal > 0 && <Line label={tr('cash.expensesDeducted')} value={`− ${formatCurrency(r.expensesTotal)}`} />}
              <div className="my-1.5 border-t" />
              <Line label={tr('cash.expectedInRegister')} value={formatCurrency(r.expectedAmount)} strong />
              <Line label={tr('cash.countedAmount')} value={r.countedAmount != null ? formatCurrency(r.countedAmount) : '—'} />
              <div className="my-1.5 border-t" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-content">{tr('cash.variance')}</span>
                <VarianceBadge value={r.variance} open={r.status === 'OPEN'} />
              </div>
            </Block>
          </div>

          {/* Encaissements un par un */}
          <Block title={tr('cashHistory.paymentsList', { n: r.payments.length })}>
            {r.payments.length === 0 ? (
              <p className="text-sm text-content-muted">{tr('cash.noPayments')}</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-content-faint">
                      <th className="py-1.5 font-semibold">{tr('cashHistory.colTime')}</th>
                      <th className="py-1.5 font-semibold">{tr('cashHistory.colSale')}</th>
                      <th className="hidden py-1.5 font-semibold sm:table-cell">{tr('cashHistory.colCustomer')}</th>
                      <th className="py-1.5 font-semibold">{tr('cashHistory.colMethod')}</th>
                      <th className="py-1.5 text-right font-semibold">{tr('cashHistory.colAmount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.payments.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="py-1.5 text-content-muted">{time(p.at)}</td>
                        <td className="py-1.5">
                          <span className="font-mono text-xs text-content">{p.saleNumber}</span>
                          {p.cancelled && <span className="ml-1.5 text-[11px] font-semibold text-danger">{tr('cashHistory.cancelledTag')}</span>}
                        </td>
                        <td className="hidden py-1.5 text-content-muted sm:table-cell">{p.customerName ?? '—'}</td>
                        <td className="py-1.5 text-content-muted">{paymentMethodLabel(p.method)}</td>
                        <td className="py-1.5 text-right font-medium text-content">{formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Block>

          <div className="grid gap-4 lg:grid-cols-2">
            <Block title={tr('cashHistory.expensesList', { n: r.expenses.length })}>
              {r.expenses.length === 0 ? (
                <p className="text-sm text-content-muted">{tr('cashHistory.noExpense')}</p>
              ) : (
                r.expenses.map((e) => (
                  <Row key={e.id} left={e.label} sub={`${expenseCategoryLabel(e.category)} · ${time(e.createdAt)}`} right={`− ${formatCurrency(e.amount)}`} tone="danger" />
                ))
              )}
            </Block>
            <Block title={tr('cashHistory.transfersList', { n: r.transfers.length })}>
              {r.transfers.length === 0 ? (
                <p className="text-sm text-content-muted">{tr('cashHistory.noTransfer')}</p>
              ) : (
                r.transfers.map((t) => (
                  <Row
                    key={t.id}
                    left={
                      <span className="flex items-center gap-1.5">
                        {t.direction === 'IN' ? <ArrowDownLeft className="h-3.5 w-3.5 text-success" /> : <ArrowUpRight className="h-3.5 w-3.5 text-danger" />}
                        {t.label}
                      </span>
                    }
                    sub={time(t.createdAt)}
                    right={`${t.direction === 'IN' ? '+' : '−'} ${formatCurrency(t.amount)}`}
                    tone={t.direction === 'IN' ? 'success' : 'danger'}
                  />
                ))
              )}
            </Block>
          </div>

          {r.cancelled.length > 0 && (
            <Block title={tr('cashHistory.cancelledList', { n: r.cancelled.length })} danger>
              {r.cancelled.map((s) => (
                <Row key={s.id} left={<span className="font-mono text-xs">{s.number}</span>} sub={[s.customerName, time(s.at)].filter(Boolean).join(' · ')} right={formatCurrency(s.total)} />
              ))}
            </Block>
          )}
        </div>
      )}
    </Modal>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone, strong }: { icon: typeof Wallet; label: string; value: string; sub?: string; tone?: 'danger'; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${strong ? 'border-primary/30 bg-primary-soft/40' : 'bg-surface'}`}>
      <p className="flex items-center gap-1.5 text-xs text-content-faint">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className={`mt-1 font-display text-lg font-bold ${tone === 'danger' ? 'text-danger' : 'text-content'}`}>{value}</p>
      {sub && <p className="text-xs text-content-faint">{sub}</p>}
    </div>
  );
}

function Block({ title, children, danger }: { title: string; children: ReactNode; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${danger ? 'border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5' : 'bg-surface'}`}>
      <h3 className={`mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${danger ? 'text-danger' : 'text-content-faint'}`}>
        {danger && <XCircle className="h-3.5 w-3.5" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className={strong ? 'font-semibold text-content' : 'text-content-muted'}>{label}</span>
      <span className={strong ? 'font-display font-bold text-content' : 'font-medium text-content'}>{value}</span>
    </div>
  );
}

function Row({ left, sub, right, tone }: { left: ReactNode; sub?: string; right: string; tone?: 'danger' | 'success' }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-1.5 text-sm last:border-0">
      <div className="min-w-0">
        <div className="truncate text-content">{left}</div>
        {sub && <p className="text-xs text-content-faint">{sub}</p>}
      </div>
      <span className={`shrink-0 font-medium ${tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-content'}`}>{right}</span>
    </div>
  );
}

type ReportTenant = { name: string; logoUrl?: string | null; location?: string | null; phone?: string | null };

/**
 * Rapport Z imprimable (même technique que les factures : fenêtre + impression).
 * Document A4 : en-tête du magasin, bandeau d'infos, chiffres clés, répartition,
 * rapprochement des espèces, détail des opérations et cadres de signature.
 */
function printReport(r: CashSessionReport, tenant: ReportTenant) {
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const money = (v: number) => esc(formatCurrency(v));
  const line = (l: string, v: string, cls = '') => `<tr class="${cls}"><td>${esc(l)}</td><td class="num">${esc(v)}</td></tr>`;
  const open = r.status === 'OPEN';
  const v = r.variance;
  const balanced = v != null && Math.abs(v) < 1;
  const tone = open || v == null ? 'neutral' : balanced ? 'ok' : v < 0 ? 'bad' : 'warn';
  const varianceLabel = open ? tr('cashHistory.inProgress') : v == null ? '—' : balanced ? tr('cashHistory.balanced') : v < 0 ? tr('cashHistory.shortage') : tr('cashHistory.surplus');
  const varianceValue = v == null ? '—' : `${v > 0 ? '+ ' : v < 0 ? '− ' : ''}${formatCurrency(Math.abs(v))}`;
  const transfersNet = r.transfersIn - r.transfersOut;
  const initials = tenant.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const section = (title: string, body: string, extra = '') => `<section class="block ${extra}"><h2>${esc(title)}</h2>${body}</section>`;
  const kpi = (label: string, value: string, sub: string, cls = '') => `<div class="kpi ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(sub)}</small></div>`;

  const methods = r.byMethod.length
    ? r.byMethod
        .map((m) => {
          const pct = r.salesTotal ? Math.round((m.amount / r.salesTotal) * 100) : 0;
          return `<div class="bar"><div class="bar-head"><span>${esc(paymentMethodLabel(m.method))} <em>· ${m.count}</em></span><span><b>${money(m.amount)}</b> <em>${pct} %</em></span></div><i><u style="width:${pct}%"></u></i></div>`;
        })
        .join('')
    : `<p class="empty">${esc(tr('cash.noPayments'))}</p>`;

  const payments = r.payments.length
    ? `<table class="list"><thead><tr><th>${esc(tr('cashHistory.colTime'))}</th><th>${esc(tr('cashHistory.colSale'))}</th><th>${esc(tr('cashHistory.colCustomer'))}</th><th>${esc(tr('cashHistory.colMethod'))}</th><th class="num">${esc(tr('cashHistory.colAmount'))}</th></tr></thead><tbody>
      ${r.payments.map((p) => `<tr class="${p.cancelled ? 'cancelled' : ''}"><td>${esc(time(p.at))}</td><td class="mono">${esc(p.saleNumber)}${p.cancelled ? ` <span class="tag">${esc(tr('cashHistory.cancelledTag'))}</span>` : ''}</td><td>${esc(p.customerName ?? '—')}</td><td>${esc(paymentMethodLabel(p.method))}</td><td class="num">${money(p.amount)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="4">${esc(tr('cashHistory.collected'))}</td><td class="num">${money(r.salesTotal)}</td></tr></tfoot></table>`
    : `<p class="empty">${esc(tr('cash.noPayments'))}</p>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(tr('cashHistory.reportTitle'))} · ${esc(formatDate(r.openedAt))}</title>
  <style>
  @page{size:A4;margin:12mm}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html{color-scheme:light}
  body{margin:0;background:#fff;font-family:'Segoe UI',Inter,Arial,sans-serif;color:#1e1b2e;font-size:11.5px;line-height:1.45}
  .page{max-width:186mm;margin:0 auto}
  .band{height:6px;border-radius:6px;background:linear-gradient(90deg,#7c3aed,#ec4899 55%,#f97316)}
  header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px 0 14px}
  .brand{display:flex;gap:12px;align-items:center}
  .logo{width:52px;height:52px;border-radius:14px;object-fit:contain;background:#f5f3ff}
  .mono-logo{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:18px;background:linear-gradient(135deg,#7c3aed,#ec4899)}
  .brand h1{margin:0;font-size:17px;font-weight:800}
  .brand p{margin:2px 0 0;color:#6b6585}
  .doc{text-align:right}
  .doc .kind{display:inline-block;padding:3px 10px;border-radius:999px;background:#120a2b;color:#fff;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
  .doc h2{margin:6px 0 0;font-size:15px;font-weight:800}
  .doc p{margin:2px 0 0;color:#6b6585}
  .info{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #e7e3f3;border-radius:12px;overflow:hidden;margin-bottom:14px}
  .info div{padding:9px 12px;border-right:1px solid #e7e3f3}
  .info div:last-child{border-right:0}
  .info span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:#8a84a3}
  .info b{display:block;margin-top:2px;font-size:11.5px}
  .info small{display:block;color:#8a84a3;font-size:10px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
  .kpi{border:1px solid #e7e3f3;border-radius:12px;padding:10px 12px;background:#fbfaff}
  .kpi span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:#8a84a3}
  .kpi b{display:block;margin-top:3px;font-size:16px;font-weight:800}
  .kpi small{display:block;margin-top:1px;color:#8a84a3;font-size:10px}
  .kpi.danger b{color:#dc2626}
  .kpi.main{background:#120a2b;border-color:#120a2b;color:#fff}
  .kpi.main span,.kpi.main small{color:#c4b5fd}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .block{border:1px solid #e7e3f3;border-radius:12px;padding:12px 14px;margin-bottom:12px;break-inside:avoid}
  .block h2{margin:0 0 9px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7c3aed}
  .block.danger{border-color:#fecaca;background:#fff7f7}
  .block.danger h2{color:#dc2626}
  .bar{margin-bottom:9px}
  .bar-head{display:flex;justify-content:space-between}
  .bar em{font-style:normal;color:#8a84a3;font-size:10px}
  .bar i{display:block;height:6px;margin-top:4px;border-radius:6px;background:#f1eefa;overflow:hidden}
  .bar u{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#7c3aed,#ec4899)}
  table{width:100%;border-collapse:collapse}
  td,th{padding:5px 4px;text-align:left}
  .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .recon td{border-bottom:1px dashed #e7e3f3}
  .recon tr.total td{border-bottom:1px solid #1e1b2e;font-weight:800}
  .variance{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:9px 12px;border-radius:10px;font-weight:800}
  .variance small{display:block;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;opacity:.8}
  .variance b{font-size:15px}
  .v-ok{background:#dcfce7;color:#166534}.v-bad{background:#fee2e2;color:#991b1b}.v-warn{background:#fef3c7;color:#92400e}.v-neutral{background:#f1eefa;color:#4c1d95}
  .list th{font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:#8a84a3;border-bottom:1.5px solid #1e1b2e}
  .list tbody tr:nth-child(even) td{background:#faf9fe}
  .list tbody td{border-bottom:1px solid #f1eefa}
  .list tfoot td{padding-top:8px;font-weight:800;border-top:1.5px solid #1e1b2e}
  .list tr.cancelled td{color:#a19bb8;text-decoration:line-through}
  .list tr.cancelled .tag{text-decoration:none}
  .mono{font-family:Consolas,'Courier New',monospace;font-size:10.5px}
  .tag{display:inline-block;padding:0 6px;border-radius:999px;background:#fee2e2;color:#dc2626;font-size:9px;font-weight:700;font-family:inherit}
  .rows td{border-bottom:1px solid #f1eefa}.rows tr:last-child td{border-bottom:0}
  .rows small{display:block;color:#8a84a3;font-size:10px}
  .neg{color:#dc2626}.pos{color:#15803d}
  .empty{margin:0;color:#8a84a3}
  .signs{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px;break-inside:avoid}
  .signs div{border:1px dashed #c9c2e0;border-radius:12px;height:88px;padding:9px 12px}
  .signs span{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#8a84a3}
  .signs p{margin:2px 0 0;font-weight:600}
  footer{display:flex;justify-content:space-between;margin-top:16px;padding-top:8px;border-top:1px solid #e7e3f3;color:#8a84a3;font-size:9.5px}
  </style></head><body><div class="page">
  <div class="band"></div>
  <header>
    <div class="brand">
      ${tenant.logoUrl ? `<img class="logo" src="${esc(tenant.logoUrl)}" alt="">` : `<div class="mono-logo">${esc(initials || 'O')}</div>`}
      <div><h1>${esc(tenant.name)}</h1><p>${esc([r.branchName, tenant.location].filter(Boolean).join(' · '))}${tenant.phone ? `<br>${esc(tenant.phone)}` : ''}</p></div>
    </div>
    <div class="doc"><span class="kind">${esc(tr('cashHistory.zReport'))}</span><h2>${esc(tr('cashHistory.reportTitle'))}</h2><p>${esc(formatDate(r.openedAt))}</p></div>
  </header>

  <div class="info">
    <div><span>${esc(tr('cashHistory.openedLabel'))}</span><b>${esc(time(r.openedAt))}</b><small>${esc(r.openedBy ?? '—')}</small></div>
    <div><span>${esc(tr('cashHistory.closedLabel'))}</span><b>${r.closedAt ? esc(formatDateTime(r.closedAt)) : esc(tr('cashHistory.inProgress'))}</b><small>${esc(r.closedBy ?? '—')}</small></div>
    <div><span>${esc(tr('cashHistory.durationLabel'))}</span><b>${esc(duration(r.durationMinutes))}</b></div>
    <div><span>${esc(tr('cash.variance'))}</span><b>${esc(varianceLabel)}</b></div>
  </div>

  <div class="kpis">
    ${kpi(tr('cashHistory.collected'), formatCurrency(r.salesTotal), tr('cashHistory.salesAndPayments', { s: r.salesCount, p: r.paymentsCount }))}
    ${kpi(tr('cashHistory.colExpenses'), r.expensesTotal ? `− ${formatCurrency(r.expensesTotal)}` : formatCurrency(0), tr('cashHistory.items', { n: r.expensesCount }), r.expensesTotal ? 'danger' : '')}
    ${kpi(tr('cashHistory.transfersNet'), `${transfersNet >= 0 ? '+' : '−'} ${formatCurrency(Math.abs(transfersNet))}`, `+${formatCurrency(r.transfersIn)} / −${formatCurrency(r.transfersOut)}`)}
    ${kpi(tr('cashHistory.colNet'), formatCurrency(r.netTotal), tr('cashHistory.netHint'), 'main')}
  </div>

  <div class="cols">
    ${section(tr('cashHistory.byMethod'), methods)}
    ${section(
      tr('cashHistory.reconciliation'),
      `<table class="recon">
      ${line(tr('cash.openingFloat'), formatCurrency(r.openingAmount))}
      ${line(tr('cash.cashSales'), '+ ' + formatCurrency(r.cashSales))}
      ${r.transfersIn ? line(tr('cashHistory.transfersIn'), '+ ' + formatCurrency(r.transfersIn)) : ''}
      ${r.transfersOut ? line(tr('cashHistory.transfersOut'), '− ' + formatCurrency(r.transfersOut)) : ''}
      ${r.expensesTotal ? line(tr('cash.expensesDeducted'), '− ' + formatCurrency(r.expensesTotal)) : ''}
      ${line(tr('cash.expectedInRegister'), formatCurrency(r.expectedAmount), 'total')}
      ${line(tr('cash.countedAmount'), r.countedAmount != null ? formatCurrency(r.countedAmount) : '—')}
      </table>
      <div class="variance v-${tone}"><div><small>${esc(tr('cash.variance'))}</small>${esc(varianceLabel)}</div><b>${esc(varianceValue)}</b></div>`,
    )}
  </div>

  ${section(tr('cashHistory.paymentsList', { n: r.payments.length }), payments)}

  ${
    r.expenses.length || r.transfers.length
      ? `<div class="cols">
    ${section(tr('cashHistory.expensesList', { n: r.expenses.length }), r.expenses.length ? `<table class="rows">${r.expenses.map((e) => `<tr><td>${esc(e.label)}<small>${esc(expenseCategoryLabel(e.category))} · ${esc(time(e.createdAt))}</small></td><td class="num neg">− ${money(e.amount)}</td></tr>`).join('')}</table>` : `<p class="empty">${esc(tr('cashHistory.noExpense'))}</p>`)}
    ${section(tr('cashHistory.transfersList', { n: r.transfers.length }), r.transfers.length ? `<table class="rows">${r.transfers.map((t) => `<tr><td>${esc(t.label)}<small>${esc(t.direction === 'IN' ? tr('cashHistory.transfersIn') : tr('cashHistory.transfersOut'))} · ${esc(time(t.createdAt))}</small></td><td class="num ${t.direction === 'IN' ? 'pos' : 'neg'}">${t.direction === 'IN' ? '+' : '−'} ${money(t.amount)}</td></tr>`).join('')}</table>` : `<p class="empty">${esc(tr('cashHistory.noTransfer'))}</p>`)}
  </div>`
      : ''
  }

  ${r.cancelled.length ? section(tr('cashHistory.cancelledList', { n: r.cancelled.length }), `<table class="rows">${r.cancelled.map((c) => `<tr><td><span class="mono">${esc(c.number)}</span><small>${esc([c.customerName, time(c.at)].filter(Boolean).join(' · '))}</small></td><td class="num">${money(c.total)}</td></tr>`).join('')}</table>`, 'danger') : ''}

  <div class="signs">
    <div><span>${esc(tr('cashHistory.signCashier'))}</span><p>${esc(r.closedBy ?? r.openedBy ?? '')}</p></div>
    <div><span>${esc(tr('cashHistory.signManager'))}</span></div>
  </div>
  <footer><span>${esc(tr('cashHistory.generatedOn', { date: formatDateTime(new Date()) }))}</span><span>OculoSaaS</span></footer>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print()},150)}</script>
  </body></html>`;
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) return alert(tr('ui.ClientsPage.veuillezAutoriserLesFenetresPop'));
  win.document.write(html);
  win.document.close();
}
