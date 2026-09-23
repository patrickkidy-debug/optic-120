import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CreditCard, Receipt, Search } from 'lucide-react';
import { Badge, Button, DropdownMenu, EmptyState, PageLoader } from '../../../components/ui';
import { formatCurrency, formatDateTime } from '../../../lib/format';
import { api } from '../../../lib/api';

interface PlatformPayment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  methodLabel: string;
  status: string;
  provider: string | null;
  reference: string | null;
  channel: string | null;
  date: string;
  createdAt: string;
  notes: string | null;
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
}

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  SUCCESS: { label: 'Réussi', tone: 'success' },
  PENDING: { label: 'En attente', tone: 'warning' },
  FAILED: { label: 'Échoué', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
  REFUNDED: { label: 'Remboursé', tone: 'neutral' },
};

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'SUCCESS', label: 'Réussis' },
  { id: 'PENDING', label: 'En attente' },
  { id: 'FAILED', label: 'Échoués' },
  { id: 'REFUNDED', label: 'Remboursés' },
] as const;

const PAGE_SIZE = 50;

async function listPayments(params: { status?: string; search?: string; page?: number }) {
  const { data } = await api.get<{
    payments: PlatformPayment[];
    total: number;
    page: number;
    pageSize: number;
  }>('/platform/billing/payments', { params: { ...params, pageSize: PAGE_SIZE } });
  return data;
}

/**
 * Mouvements de paiement (§16).
 *
 * Écran distinct de la liste des factures, et c'est volontaire : une facture
 * peut porter plusieurs règlements, et un règlement ÉCHOUÉ n'apparaît sur
 * aucune facture payée. Ne regarder que les factures revient à ne jamais voir
 * les échecs — qui sont pourtant exactement ce qu'il faut rattraper.
 *
 * La date affichée est celle de l'encaissement réel, pas celle de l'intention :
 * pour un virement, les deux peuvent différer de plusieurs jours.
 */
export function ConsolePaymentsPage({ onOpenInvoice }: { onOpenInvoice: (invoiceId: string) => void }) {
  const [status, setStatus] = useState<(typeof FILTERS)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['console-payments', status, debounced, page],
    queryFn: () => listPayments({ status, search: debounced || undefined, page }),
  });

  const rows = data?.payments ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder="Référence, numéro de facture, établissement…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-content-muted">
          {total} paiement{total > 1 ? 's' : ''}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrer les paiements">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatus(f.id)}
            aria-pressed={status === f.id}
            className={`rounded-lg px-2.5 py-1.5 text-sm transition ${
              status === f.id
                ? 'bg-primary text-white'
                : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Aucun paiement"
          hint="Aucun mouvement ne correspond à cette recherche ou à ce filtre."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">Date</th>
                  <th className="table-cell font-semibold">Client</th>
                  <th className="table-cell font-semibold">Facture</th>
                  <th className="table-cell text-right font-semibold">Montant</th>
                  <th className="table-cell font-semibold">Méthode</th>
                  <th className="table-cell font-semibold">Référence</th>
                  <th className="table-cell font-semibold">Statut</th>
                  <th className="table-cell w-12 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const meta = STATUS_META[p.status] ?? { label: p.status, tone: 'neutral' as const };
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-surface-2/50">
                      <td className="table-cell text-content-muted">{formatDateTime(p.date)}</td>
                      <td className="table-cell font-medium text-content">{p.tenantName}</td>
                      <td className="table-cell">
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(p.invoiceId)}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {p.invoiceNumber}
                        </button>
                      </td>
                      <td className="table-cell text-right font-semibold text-content">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="table-cell text-content-muted">{p.methodLabel}</td>
                      <td className="table-cell font-mono text-xs text-content-faint">
                        {p.reference ?? '—'}
                      </td>
                      <td className="table-cell">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="table-cell text-right">
                        <DropdownMenu
                          items={[
                            {
                              label: 'Ouvrir la facture',
                              icon: Receipt,
                              onClick: () => onOpenInvoice(p.invoiceId),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
              <span className="text-content-muted">
                Page {page} sur {pageCount}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Page précédente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Page suivante"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
