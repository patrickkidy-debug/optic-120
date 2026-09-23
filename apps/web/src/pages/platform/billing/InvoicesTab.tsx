import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileMinus,
  FileText,
  MessageCircle,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react';
import {
  INVOICE_FILTERS,
  INVOICE_FILTER_LABELS,
  PaymentMethod,
  type InvoiceFilter,
} from '@oculo/shared-types';
import { Button, DropdownMenu, EmptyState, PageLoader } from '../../../components/ui';
import type { DropdownItem } from '../../../components/ui';
import { formatCurrency } from '../../../lib/format';
import { apiErrorMessage } from '../../../lib/api';
import {
  cancelBillingInvoice,
  duplicateBillingInvoice,
  getBillingSettings,
  issueBillingCreditNote,
  listBillingInvoices,
  markBillingInvoicePaid,
  type Invoice,
} from '../../../features/billing/invoicing';
import { printInvoice } from '../../../features/billing/invoiceDocument';
import { InvoiceStatusBadge, shortDate } from './shared';

const PAGE_SIZE = 25;

/**
 * Liste des factures de la plateforme (§14-15).
 *
 * La recherche est débattue à 350 ms : sans cela, chaque frappe déclenche une
 * requête, et les réponses reviennent dans le désordre — l'utilisateur voit le
 * résultat d'une recherche qu'il a déjà corrigée.
 */
export function BillingInvoicesTab({
  tenantId,
  onOpen,
  onCreate,
  onRecordPayment,
  onRefund,
  onSendWhatsapp,
  refreshToken,
}: {
  tenantId?: string;
  onOpen: (invoice: Invoice) => void;
  onCreate: () => void;
  onRecordPayment: (invoice: Invoice) => void;
  onRefund: (invoice: Invoice) => void;
  onSendWhatsapp: (invoice: Invoice) => void;
  refreshToken: number;
}) {
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => setPage(1), [filter, debounced, tenantId]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['platform-billing-invoices', filter, debounced, tenantId, page, refreshToken],
    queryFn: () =>
      listBillingInvoices({
        filter,
        search: debounced || undefined,
        tenantId,
        page,
        pageSize: PAGE_SIZE,
      }),
  });
  const { data: settings } = useQuery({
    queryKey: ['platform-billing-settings'],
    queryFn: getBillingSettings,
  });

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setError('');
    try {
      await action();
      await refetch();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
        <p className="mt-3 font-semibold text-content">Impossible de charger les factures</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          <RefreshCcw className="h-4 w-4" /> Réessayer
        </Button>
      </div>
    );
  }

  const invoices = data?.invoices ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder="Client, établissement, n° facture, WhatsApp, référence…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4" /> Nouvelle facture
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrer les factures">
        {INVOICE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-lg px-2.5 py-1.5 text-sm transition ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
            }`}
          >
            {INVOICE_FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {isLoading ? (
        <PageLoader />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune facture"
          hint={
            debounced || filter !== 'all'
              ? 'Aucune facture ne correspond à cette recherche ou à ce filtre.'
              : 'Les factures apparaissent ici dès qu’un abonnement est payé, ou dès que vous en créez une.'
          }
          action={
            <Button variant="outline" onClick={onCreate}>
              <Plus className="h-4 w-4" /> Créer une facture
            </Button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">N°</th>
                  <th className="table-cell font-semibold">Client</th>
                  <th className="table-cell font-semibold">Offre</th>
                  <th className="table-cell text-right font-semibold">Montant</th>
                  <th className="table-cell text-right font-semibold">Payé</th>
                  <th className="table-cell text-right font-semibold">Solde</th>
                  <th className="table-cell font-semibold">Émise</th>
                  <th className="table-cell font-semibold">Échéance</th>
                  <th className="table-cell font-semibold">Statut</th>
                  <th className="table-cell text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell">
                      <button
                        type="button"
                        onClick={() => onOpen(inv)}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {inv.number}
                      </button>
                    </td>
                    <td className="table-cell">
                      <div className="font-medium text-content">{inv.billing.name}</div>
                      {/* L'etablissement n'est rappele que s'il differe du nom
                          facture : repeter deux fois la meme ligne n'informe pas. */}
                      {inv.billing.name !== inv.tenantName && (
                        <div className="text-xs text-content-faint">{inv.tenantName}</div>
                      )}
                    </td>
                    <td className="table-cell text-content-muted">{inv.planName}</td>
                    <td className="table-cell text-right font-semibold text-content">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="table-cell text-right text-content-muted">
                      {formatCurrency(inv.amountPaid)}
                    </td>
                    <td
                      className={`table-cell text-right font-semibold ${
                        inv.balance > 0 ? 'text-warning' : 'text-content-faint'
                      }`}
                    >
                      {formatCurrency(inv.balance)}
                    </td>
                    <td className="table-cell text-content-muted">{shortDate(inv.issueDate)}</td>
                    <td className="table-cell text-content-muted">{shortDate(inv.dueDate)}</td>
                    <td className="table-cell">
                      <InvoiceStatusBadge invoice={inv} />
                    </td>
                    <td className="table-cell text-right">
                      <DropdownMenu
                        items={buildActions(inv, {
                          onOpen,
                          onRecordPayment,
                          onRefund,
                          onSendWhatsapp,
                          onPrint: () => settings && printInvoice(inv, settings),
                          onMarkPaid: () =>
                            run(inv.id, () => markBillingInvoicePaid(inv.id, PaymentMethod.OTHER)),
                          onDuplicate: () => run(inv.id, () => duplicateBillingInvoice(inv.id)),
                          onCreditNote: () => {
                            if (confirm(`Émettre un avoir sur la facture ${inv.number} ?`))
                              void run(inv.id, () => issueBillingCreditNote(inv.id));
                          },
                          onCancel: () => {
                            const reason = prompt("Motif de l'annulation :");
                            if (reason && reason.trim().length >= 3)
                              void run(inv.id, () => cancelBillingInvoice(inv.id, reason.trim()));
                          },
                          busy: busyId === inv.id,
                        })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
            <span className="text-content-muted">
              {total} facture{total > 1 ? 's' : ''}
            </span>
            {pageCount > 1 && (
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
                <span className="text-content-muted">
                  {page} / {pageCount}
                </span>
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Menu d'actions d'une ligne. Les actions impossibles ne sont pas affichées
 * plutôt que désactivées : un menu qui propose « Rembourser » sur une facture
 * jamais encaissée ne dit rien d'utile.
 */
function buildActions(
  invoice: Invoice,
  handlers: {
    onOpen: (i: Invoice) => void;
    onRecordPayment: (i: Invoice) => void;
    onRefund: (i: Invoice) => void;
    onSendWhatsapp: (i: Invoice) => void;
    onPrint: () => void;
    onMarkPaid: () => void;
    onDuplicate: () => void;
    onCreditNote: () => void;
    onCancel: () => void;
    busy: boolean;
  },
) {
  const isCredit = invoice.kind === 'CREDIT_NOTE';
  const cancelled = ['CANCELLED', 'VOID'].includes(invoice.status);
  const settled = invoice.balance <= 0;

  const items: DropdownItem[] = [
    { label: 'Voir', icon: Eye, onClick: () => handlers.onOpen(invoice) },
    { label: 'Télécharger PDF', icon: Download, onClick: handlers.onPrint },
    { label: 'Envoyer par WhatsApp', icon: MessageCircle, onClick: () => handlers.onSendWhatsapp(invoice) },
  ];

  if (!isCredit && !cancelled && !settled) {
    items.push({
      label: 'Enregistrer un paiement',
      icon: Wallet,
      onClick: () => handlers.onRecordPayment(invoice),
    });
    items.push({ label: 'Marquer comme payée', icon: BadgeCheck, onClick: handlers.onMarkPaid });
  }
  if (!isCredit && invoice.amountPaid > invoice.amountRefunded) {
    items.push({ label: 'Rembourser', icon: RotateCcw, onClick: () => handlers.onRefund(invoice) });
  }
  if (!isCredit) {
    items.push({ label: 'Dupliquer', icon: Copy, onClick: handlers.onDuplicate });
    items.push({ label: 'Créer un avoir', icon: FileMinus, onClick: handlers.onCreditNote });
  }
  if (!isCredit && !cancelled && invoice.amountPaid === 0) {
    items.push({ label: 'Annuler', icon: Ban, onClick: handlers.onCancel, variant: 'danger' });
  }
  return items;
}
