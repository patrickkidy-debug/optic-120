import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  Copy,
  Download,
  FileMinus,
  History,
  MessageCircle,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import { INVOICE_EVENT_LABELS } from '@oculo/shared-types';
import { Button, Modal, Spinner } from '../../../components/ui';
import { formatCurrency } from '../../../lib/format';
import { apiErrorMessage } from '../../../lib/api';
import {
  cancelBillingInvoice,
  duplicateBillingInvoice,
  getBillingInvoice,
  getBillingSettings,
  issueBillingCreditNote,
  type Invoice,
} from '../../../features/billing/invoicing';
import { printInvoice } from '../../../features/billing/invoiceDocument';
import { InvoiceStatusBadge, longDateTime, shortDate } from './shared';

/**
 * Fiche d'une facture : montants, lignes, règlements, remboursements et
 * journal (§19). Les actions destructrices en apparence ne le sont pas :
 * annuler, rembourser et avoirer AJOUTENT à l'historique, ils n'effacent rien.
 */
export function InvoiceDetailModal({
  invoiceId,
  onClose,
  onChanged,
  onRecordPayment,
  onRefund,
  onSendWhatsapp,
}: {
  invoiceId: string;
  onClose: () => void;
  onChanged: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onRefund: (invoice: Invoice) => void;
  onSendWhatsapp: (invoice: Invoice) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { data: invoice, isLoading, refetch } = useQuery({
    queryKey: ['platform-billing-invoice', invoiceId],
    queryFn: () => getBillingInvoice(invoiceId),
  });
  const { data: settings } = useQuery({
    queryKey: ['platform-billing-settings'],
    queryFn: getBillingSettings,
  });

  async function run(action: () => Promise<Invoice>) {
    setBusy(true);
    setError('');
    try {
      const updated = await action();
      onChanged(updated);
      await refetch();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const isCredit = invoice?.kind === 'CREDIT_NOTE';
  const settled = invoice ? invoice.balance <= 0 : false;
  const cancelled = invoice ? ['CANCELLED', 'VOID'].includes(invoice.status) : false;

  return (
    <Modal
      open
      onClose={onClose}
      title={invoice ? `${isCredit ? 'Avoir' : 'Facture'} ${invoice.number}` : 'Facture'}
      size="xl"
    >
      {isLoading || !invoice ? (
        <div className="py-12 text-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Résumé */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-bold text-content">{invoice.billing.name}</h3>
                <InvoiceStatusBadge invoice={invoice} />
              </div>
              <p className="text-sm text-content-muted">
                {invoice.planName} · émise le {shortDate(invoice.issueDate)} · échéance{' '}
                {shortDate(invoice.dueDate)}
              </p>
              {invoice.cancelReason && (
                <p className="mt-1 text-xs text-danger">Annulée : {invoice.cancelReason}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-content-muted">Total</p>
              <p className="font-display text-2xl font-bold text-content">
                {formatCurrency(invoice.total)}
              </p>
              {!isCredit && (
                <p className={`text-sm font-semibold ${invoice.balance > 0 ? 'text-warning' : 'text-success'}`}>
                  {invoice.balance > 0
                    ? `Solde : ${formatCurrency(invoice.balance)}`
                    : 'Solde : 0'}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 border-y py-3">
            <Button
              variant="outline"
              className="h-9 px-3 text-xs"
              disabled={!settings}
              onClick={() => settings && printInvoice(invoice, settings)}
            >
              <Download className="h-4 w-4" /> Télécharger PDF
            </Button>
            <Button className="h-9 px-3 text-xs" onClick={() => onSendWhatsapp(invoice)}>
              <MessageCircle className="h-4 w-4" /> Envoyer sur WhatsApp
            </Button>
            {!isCredit && !settled && !cancelled && (
              <Button variant="accent" className="h-9 px-3 text-xs" onClick={() => onRecordPayment(invoice)}>
                <Wallet className="h-4 w-4" /> Enregistrer un paiement
              </Button>
            )}
            {!isCredit && invoice.amountPaid > invoice.amountRefunded && (
              <Button variant="outline" className="h-9 px-3 text-xs" onClick={() => onRefund(invoice)}>
                <RotateCcw className="h-4 w-4" /> Rembourser
              </Button>
            )}
            {!isCredit && (
              <Button
                variant="outline"
                className="h-9 px-3 text-xs"
                loading={busy}
                onClick={() => run(() => duplicateBillingInvoice(invoice.id))}
              >
                <Copy className="h-4 w-4" /> Dupliquer
              </Button>
            )}
            {!isCredit && (
              <Button
                variant="outline"
                className="h-9 px-3 text-xs"
                loading={busy}
                onClick={() => {
                  if (confirm(`Émettre un avoir sur la facture ${invoice.number} ?`))
                    void run(() => issueBillingCreditNote(invoice.id));
                }}
              >
                <FileMinus className="h-4 w-4" /> Créer un avoir
              </Button>
            )}
            {!isCredit && !cancelled && invoice.amountPaid === 0 && (
              <Button
                variant="danger"
                className="h-9 px-3 text-xs"
                loading={busy}
                onClick={() => {
                  const reason = prompt("Motif de l'annulation :");
                  if (reason && reason.trim().length >= 3)
                    void run(() => cancelBillingInvoice(invoice.id, reason.trim()));
                }}
              >
                <Ban className="h-4 w-4" /> Annuler
              </Button>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          {/* Coordonnées et détail */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-xl bg-surface-2 p-3 text-sm">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">
                Facturé à
              </h4>
              <p className="font-semibold text-content">{invoice.billing.name}</p>
              {[
                invoice.billing.contact,
                invoice.billing.whatsapp,
                invoice.billing.email,
                invoice.billing.address,
                [invoice.billing.city, invoice.billing.country].filter(Boolean).join(', '),
              ]
                .filter((l) => l && String(l).trim())
                .map((l, i) => (
                  <p key={i} className="text-content-muted">
                    {l}
                  </p>
                ))}
            </section>

            <section className="rounded-xl bg-surface-2 p-3 text-sm lg:col-span-2">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">
                Détail
              </h4>
              <table className="w-full text-sm">
                <tbody>
                  {invoice.items.map((it) => (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">
                        <div className="text-content">{it.description}</div>
                        {it.periodLabel && (
                          <div className="text-xs text-content-faint">{it.periodLabel}</div>
                        )}
                      </td>
                      <td className="py-1.5 text-right text-content-muted">{it.quantity}</td>
                      <td className="py-1.5 text-right text-content-muted">
                        {formatCurrency(it.unitPrice)}
                      </td>
                      <td className="py-1.5 text-right font-semibold text-content">
                        {formatCurrency(it.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <dl className="mt-2 space-y-1 border-t pt-2 text-sm">
                <Row label="Sous-total" value={formatCurrency(invoice.subtotal)} />
                {invoice.discount > 0 && (
                  <Row label="Remise" value={`- ${formatCurrency(invoice.discount)}`} />
                )}
                {invoice.tax > 0 && <Row label="Taxes" value={formatCurrency(invoice.tax)} />}
                <Row label="Total à payer" value={formatCurrency(invoice.total)} strong />
                {!isCredit && (
                  <>
                    <Row label="Montant payé" value={formatCurrency(invoice.amountPaid)} tone="success" />
                    <Row
                      label="Solde restant"
                      value={formatCurrency(invoice.balance)}
                      strong
                      tone={invoice.balance > 0 ? 'warning' : 'success'}
                    />
                  </>
                )}
                {invoice.amountRefunded > 0 && (
                  <Row label="Dont remboursé" value={formatCurrency(invoice.amountRefunded)} tone="warning" />
                )}
              </dl>
            </section>
          </div>

          {/* Règlements */}
          {invoice.payments.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">
                Règlements
              </h4>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-content-faint">
                      <th className="px-3 py-2 font-semibold">Méthode</th>
                      <th className="px-3 py-2 font-semibold">Référence</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Statut</th>
                      <th className="px-3 py-2 text-right font-semibold">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-3 py-2 text-content">{p.methodLabel}</td>
                        <td className="px-3 py-2 font-mono text-xs text-content-muted">
                          {p.reference ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-content-muted">
                          {shortDate(p.paidAt ?? p.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-content-muted">{p.status}</td>
                        <td className="px-3 py-2 text-right font-semibold text-content">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Remboursements */}
          {invoice.refunds.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">
                Remboursements
              </h4>
              <ul className="space-y-1 text-sm">
                {invoice.refunds.map((r) => (
                  <li key={r.id} className="rounded-lg bg-surface-2 px-3 py-2">
                    <span className="font-semibold text-content">{formatCurrency(r.amount)}</span>{' '}
                    <span className="text-content-muted">
                      le {shortDate(r.refundedAt)} — {r.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Journal */}
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-content-faint">
              <History className="h-3.5 w-3.5" /> Historique
            </h4>
            {!invoice.events || invoice.events.length === 0 ? (
              <p className="text-sm text-content-muted">Aucun évènement enregistré.</p>
            ) : (
              <ol className="space-y-2 border-l-2 border-line pl-4">
                {invoice.events.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <div className="text-content">{e.message}</div>
                    <div className="text-xs text-content-faint">
                      {longDateTime(e.createdAt)}
                      {e.actorName ? ` · ${e.actorName}` : ''}
                      {e.reference ? ` · ${e.reference}` : ''}
                      {INVOICE_EVENT_LABELS[e.type] && e.message !== INVOICE_EVENT_LABELS[e.type]
                        ? ` · ${INVOICE_EVENT_LABELS[e.type]}`
                        : ''}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'success' | 'warning';
}) {
  const color = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-content';
  return (
    <div className="flex justify-between">
      <dt className="text-content-muted">{label}</dt>
      <dd className={`${strong ? 'font-display font-bold' : 'font-medium'} ${color}`}>{value}</dd>
    </div>
  );
}
