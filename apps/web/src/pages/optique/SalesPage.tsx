import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Receipt,
  FileText,
  XCircle,
  ArrowRightLeft,
  Undo2,
  Download,
  Plus,
  Trash2,
  Loader2,
  Pencil,
  Eye,
  Banknote,
  ShieldCheck,
  Glasses,
  FileSpreadsheet,
  Printer,
  MessageCircle,
} from 'lucide-react';
import {
  listSales,
  cancelSale,
  convertQuote,
  createSaleReturn,
  getSale,
  getStock,
  createSale,
  updateSale,
  listPrescriptions,
  type SaleListItem,
  type SaleDetail,
} from '../../features/optique/api';
import { CustomerSearch, LensComposer, VatSelect } from '../../features/optique/SaleTools';
import { PrescriptionForm } from '../../features/optique/PrescriptionForm';
import { DEFAULT_LENS_PRICING } from '@oculo/shared-types';
import { listInsurers } from '../../features/management/api';
import { printSaleDocument } from '../../features/optique/saleDocument';
import { PaymentModal } from './PosPage';
import { downloadCsv } from '../../lib/csv';
import { useAuthStore, usePermission } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { sendWhatsappForStage } from '../../lib/whatsapp';
import { PageHeader, Badge, PageLoader, EmptyState, Modal, Button } from '../../components/ui';

function statusTone(status: string) {
  if (status === 'PAID') return 'success' as const;
  if (status === 'PARTIALLY_PAID' || status === 'CONFIRMED') return 'warning' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'neutral' as const;
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmée',
  PARTIALLY_PAID: 'Partiel',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};
const PAYMENT_LABEL: Record<string, string> = {
  INSURANCE: 'Assurance',
  CASH: 'Espèces', CARD: 'Carte', CHEQUE: 'Chèque', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN MoMo', MOOV_MONEY: 'Moov Money', FREE_MONEY: 'Free Money',
  MPESA: 'M-Pesa', EMOLA: 'e-Mola', MKESH: 'mKesh', MULTICAIXA: 'Multicaixa',
  UNITEL_MONEY: 'Unitel Money', VINTI4: 'Vinti4',
};

export function SalesPage({ kind }: { kind: 'SALE' | 'QUOTE' }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canCancel = usePermission('optique.sales.cancel');
  const canConvert = usePermission('optique.quotes.convert');
  const canQuote = usePermission('optique.quotes.create');
  const canRefund = usePermission('optique.sales.refund');
  const canPay = usePermission('optique.sales.create');
  const canUpdate = usePermission('optique.sales.update');
  const user = useAuthStore((s) => s.user);
  const [quoteOpen, setQuoteOpen] = useState(false);
  // Pièce en cours de modification (chargée en détail avant d'ouvrir la modale).
  const [editing, setEditing] = useState<SaleDetail | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);
  // Fiche détaillée (articles, montants, encaissements) affichée à la demande.
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [paySale, setPaySale] = useState<{ id: string; due: number; number: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', kind],
    queryFn: () => listSales({ type: kind }),
  });

  // Rafraîchit les vues impactées par un changement de vente (liste + tableau
  // de bord + créances).
  function refreshSalesViews() {
    qc.invalidateQueries({ queryKey: ['sales'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    qc.invalidateQueries({ queryKey: ['forecast'] });
    qc.invalidateQueries({ queryKey: ['sales-report'] });
    qc.invalidateQueries({ queryKey: ['receivables'] });
    qc.invalidateQueries({ queryKey: ['finance-summary'] });
    // Le stock bouge (conversion de devis, retour) : synchronise stock et caisse.
    qc.invalidateQueries({ queryKey: ['stock'] });
    qc.invalidateQueries({ queryKey: ['pos-stock'] });
    qc.invalidateQueries({ queryKey: ['insurer-upcoming'] });
    qc.invalidateQueries({ queryKey: ['cash-summary'] });
  }

  const cancelMut = useMutation({
    mutationFn: cancelSale,
    onSuccess: refreshSalesViews,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const convertMut = useMutation({
    mutationFn: convertQuote,
    onSuccess: () => {
      refreshSalesViews();
      alert('Devis converti en vente.');
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const returnMut = useMutation({
    mutationFn: createSaleReturn,
    onSuccess: () => {
      refreshSalesViews();
      alert('Retour enregistré : stock réapprovisionné et avoir créé.');
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const isQuote = kind === 'QUOTE';

  async function handleDownload(id: string) {
    setDownloadingId(id);
    try {
      const sale = await getSale(id);
      printSaleDocument(sale, {
        name: user?.tenantName ?? 'OculoSaaS',
        logoUrl: user?.tenantLogoUrl,
        location: user?.tenantLocation,
        contactPhone: user?.tenantContactPhone,
        contactEmail: user?.tenantContactEmail,
        ...user?.tenantInvoiceSettings,
      });
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setDownloadingId(null);
    }
  }

  const clientName = (s: SaleListItem) =>
    s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : '';

  /** Charge le détail de la pièce puis ouvre la modale de modification. */
  async function openEdit(id: string) {
    setLoadingEdit(id);
    try {
      setEditing(await getSale(id));
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setLoadingEdit(null);
    }
  }

  /** Ouvre la fiche détaillée (articles, montants, encaissements). */
  async function openDetail(id: string) {
    setLoadingDetail(id);
    try {
      setDetail(await getSale(id));
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setLoadingDetail(null);
    }
  }

  /** Récupère TOUT l'historique (toutes les pages) pour l'export. */
  async function fetchAllSales(): Promise<SaleListItem[]> {
    const all: SaleListItem[] = [];
    let page = 1;
    for (;;) {
      const res = await listSales({ type: kind, page, pageSize: 100 });
      all.push(...res.items);
      if (all.length >= res.total || res.items.length === 0) break;
      page += 1;
    }
    return all;
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = await fetchAllSales();
      downloadCsv(
        `${isQuote ? 'devis' : 'ventes'}_${new Date().toISOString().slice(0, 10)}.csv`,
        ['N°', 'Date', 'Client', 'Statut', 'Moyen', 'Total', 'Payé', 'Reste'],
        rows.map((s) => [
          s.number,
          new Date(s.createdAt).toLocaleString('fr-FR'),
          clientName(s),
          STATUS_LABEL[s.status] ?? s.status,
          (s.paymentMethods ?? [])
            .map((m) => (m === 'INSURANCE' && s.insurerName ? s.insurerName : PAYMENT_LABEL[m] ?? m))
            .join(' + '),
          Number(s.totalAmount),
          Number(s.paidAmount),
          Number(s.totalAmount) - Number(s.paidAmount),
        ]),
      );
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const rows = await fetchAllSales();
      const esc = (v: unknown) =>
        String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const money = (n: number) =>
        `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} FCFA`;
      const total = rows
        .filter((s) => s.status !== 'CANCELLED')
        .reduce((sum, s) => sum + Number(s.paidAmount), 0);
      const title = isQuote ? 'Historique des devis' : 'Historique des ventes';
      const body = rows
        .map(
          (s) => `<tr>
            <td>${esc(s.number)}</td>
            <td>${esc(new Date(s.createdAt).toLocaleDateString('fr-FR'))}</td>
            <td>${esc(clientName(s) || '—')}</td>
            <td>${esc(STATUS_LABEL[s.status] ?? s.status)}</td>
            <td style="text-align:right">${money(Number(s.totalAmount))}</td>
            <td style="text-align:right">${money(Number(s.paidAmount))}</td>
          </tr>`,
        )
        .join('');
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          body { font-family: -apple-system,'Segoe UI',Roboto,Arial,sans-serif; color:#1e293b; padding:20px; }
          h1 { font-size:20px; margin:0 0 2px; color:#0d9488; }
          .muted { color:#64748b; font-size:12px; }
          table { width:100%; border-collapse:collapse; margin-top:16px; font-size:12px; }
          th { background:#0d9488; color:#fff; padding:8px 10px; text-align:left; }
          td { padding:7px 10px; border-bottom:1px solid #e2e8f0; }
          tfoot td { font-weight:700; border-top:2px solid #0d9488; }
        </style></head><body>
        <h1>${esc(user?.tenantName ?? 'OculoSaaS')}</h1>
        <div class="muted">${title} — édité le ${new Date().toLocaleDateString('fr-FR')} · ${rows.length} lignes</div>
        <table>
          <thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Statut</th>
            <th style="text-align:right">Total</th><th style="text-align:right">Payé</th></tr></thead>
          <tbody>${body}</tbody>
          <tfoot><tr><td colspan="5" style="text-align:right">Total encaissé</td>
            <td style="text-align:right">${money(total)}</td></tr></tfoot>
        </table></body></html>`;
      const win = window.open('', '_blank', 'width=900,height=1100');
      if (!win) {
        alert('Veuillez autoriser les fenêtres pop-up pour générer le PDF.');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.onload = () => {
        win.focus();
        win.print();
      };
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          /* déjà imprimé */
        }
      }, 600);
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={isQuote ? 'Devis' : 'Historique des ventes'}
        subtitle={isQuote ? 'Devis en attente de conversion' : 'Toutes les ventes du magasin'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv} loading={exporting}>
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={exportPdf} loading={exporting}>
              <Printer className="h-4 w-4" /> PDF
            </Button>
            {isQuote && canQuote && (
              <Button onClick={() => setQuoteOpen(true)}>
                <Plus className="h-4 w-4" /> Nouveau devis
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={isQuote ? FileText : Receipt}
          title={isQuote ? t('sales.noQuote') : t('sales.noSale')}
          hint={isQuote ? t('sales.hintQuote') : t('sales.hintSale')}
          action={
            isQuote && canQuote ? (
              <Button onClick={() => setQuoteOpen(true)}>
                <Plus className="h-4 w-4" /> Nouveau devis
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">{t('sales.number')}</th>
                <th className="table-cell font-semibold">{t('sales.customer')}</th>
                <th className="table-cell font-semibold">{t('common.status')}</th>
                {!isQuote && <th className="table-cell font-semibold">Moyen</th>}
                <th className="table-cell text-right font-semibold">{t('sales.amount')}</th>
                {!isQuote && <th className="table-cell text-right font-semibold">{t('sales.paid')}</th>}
                {!isQuote && <th className="table-cell text-right font-semibold">Reste</th>}
                <th className="table-cell text-right font-semibold">{t('sales.date')}</th>
                <th className="table-cell text-right font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s: SaleListItem) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell font-medium text-content">{s.number}</td>
                  <td className="table-cell text-content-muted">
                    {s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : '—'}
                  </td>
                  <td className="table-cell">
                    <Badge tone={statusTone(s.status)}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                  </td>
                  {!isQuote && (
                    <td className="table-cell text-content-muted">
                      {s.paymentMethods && s.paymentMethods.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {s.paymentMethods.map((m) => (
                            <span
                              key={m}
                              className={`badge px-2 py-0.5 text-[11px] ${
                                m === 'INSURANCE'
                                  ? 'bg-accent/15 text-accent'
                                  : 'bg-surface-3 text-content-muted'
                              }`}
                              title={m === 'INSURANCE' ? s.insurerName ?? 'Prise en charge assurance' : undefined}
                            >
                              {m === 'INSURANCE' && s.insurerName
                                ? s.insurerName
                                : PAYMENT_LABEL[m] ?? m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs">Non encaissée</span>
                      )}
                    </td>
                  )}
                  <td className="table-cell text-right font-semibold text-content">
                    {formatCurrency(Number(s.totalAmount))}
                  </td>
                  {!isQuote && (
                    <td className="table-cell text-right text-content-muted">
                      {formatCurrency(Number(s.paidAmount))}
                    </td>
                  )}
                  {!isQuote &&
                    (() => {
                      const due = Number(s.totalAmount) - Number(s.paidAmount);
                      return (
                        <td className="table-cell text-right">
                          {s.status === 'CANCELLED' ? (
                            <span className="text-content-faint">—</span>
                          ) : due > 0 ? (
                            <span className="font-semibold text-warning">{formatCurrency(due)}</span>
                          ) : (
                            <span className="text-success">Soldé</span>
                          )}
                        </td>
                      );
                    })()}
                  <td className="table-cell text-right text-content-muted">
                    {formatDateTime(s.createdAt)}
                  </td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
                      {s.customer?.phone && s.status !== 'CANCELLED' && (
                        <button
                          onClick={() =>
                            sendWhatsappForStage(
                              isQuote ? 'quote' : 'sale_paid',
                              s.customer?.phone,
                              {
                                client: s.customer?.firstName ?? '',
                                etablissement: user?.tenantName ?? 'OculoSaaS',
                                numero: s.number,
                                montant: formatCurrency(Number(s.totalAmount)),
                                reste: formatCurrency(Number(s.totalAmount) - Number(s.paidAmount)),
                              },
                            )
                          }
                          className="btn-outline h-8 rounded-lg px-2.5 text-xs text-success"
                          title="Envoyer un message WhatsApp au client"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(s.id)}
                        disabled={downloadingId === s.id}
                        className="btn-outline h-8 rounded-lg px-2.5 text-xs"
                        title={isQuote ? 'Télécharger le devis (PDF)' : 'Télécharger la facture (PDF)'}
                      >
                        {downloadingId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        PDF
                      </button>
                      <button
                        onClick={() => openDetail(s.id)}
                        disabled={loadingDetail === s.id}
                        className="btn-ghost h-8 rounded-lg px-2.5 text-xs"
                        title="Voir le détail et les encaissements"
                      >
                        {loadingDetail === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        Détails
                      </button>
                      {canUpdate && s.status !== 'CANCELLED' && (
                        <button
                          onClick={() => openEdit(s.id)}
                          disabled={loadingEdit === s.id}
                          className="btn-outline h-8 rounded-lg px-2.5 text-xs"
                          title={isQuote ? 'Modifier ce devis' : 'Modifier cette vente'}
                        >
                          {loadingEdit === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Pencil className="h-3.5 w-3.5" />
                          )}
                          Modifier
                        </button>
                      )}
                      {!isQuote &&
                        canPay &&
                        s.status !== 'CANCELLED' &&
                        Number(s.totalAmount) - Number(s.paidAmount) > 0 && (
                          <button
                            onClick={() =>
                              setPaySale({
                                id: s.id,
                                due: Number(s.totalAmount) - Number(s.paidAmount),
                                number: s.number,
                              })
                            }
                            className="btn-outline h-8 rounded-lg px-2.5 text-xs text-primary"
                            title={t('sales.collectBalance')}
                          >
                            <Banknote className="h-3.5 w-3.5" /> Encaisser
                          </button>
                        )}
                      {isQuote && canConvert && s.status !== 'CANCELLED' && (
                        <button
                          onClick={() => convertMut.mutate(s.id)}
                          className="btn-outline h-8 rounded-lg px-2.5 text-xs"
                          title={t('sales.convertToSale')}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" /> Convertir
                        </button>
                      )}
                      {!isQuote && canRefund && s.status !== 'CANCELLED' && (
                        <button
                          onClick={() => {
                            if (confirm(`Enregistrer un retour / avoir pour la vente ${s.number} ? Le stock sera réapprovisionné.`))
                              returnMut.mutate(s.id);
                          }}
                          className="btn-outline h-8 rounded-lg px-2.5 text-xs text-accent"
                          title={t('sales.returnCredit')}
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Retour
                        </button>
                      )}
                      {!isQuote && canCancel && s.status !== 'CANCELLED' && (
                        <button
                          onClick={() => {
                            if (confirm(`Annuler la vente ${s.number} ?`)) cancelMut.mutate(s.id);
                          }}
                          className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                          title={t('sales.cancelSale')}
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {quoteOpen && (
        <QuoteModal
          onClose={() => setQuoteOpen(false)}
          onCreated={(saleId) => {
            setQuoteOpen(false);
            qc.invalidateQueries({ queryKey: ['sales'] });
            if (confirm('Devis créé. Télécharger le PDF ?')) handleDownload(saleId);
          }}
        />
      )}

      {editing && (
        <QuoteModal
          editing={editing}
          onClose={() => setEditing(null)}
          onCreated={async (saleId) => {
            setEditing(null);
            // Le stock et les montants ont bougé : on rafraîchit toutes les vues.
            refreshSalesViews();
            // Enchaîne sur l'encaissement s'il reste un solde à percevoir.
            try {
              const fresh = await getSale(saleId);
              const due = Number(fresh.totalAmount) - Number(fresh.paidAmount);
              if (fresh.type === 'SALE' && due > 0 && canPay) {
                setPaySale({ id: fresh.id, due, number: fresh.number });
              }
            } catch {
              /* la liste est déjà à jour : on n'interrompt pas l'utilisateur */
            }
          }}
        />
      )}

      {detail && (
        <SaleDetailModal
          sale={detail}
          onClose={() => setDetail(null)}
          onCollect={
            detail.type === 'SALE' &&
            canPay &&
            detail.status !== 'CANCELLED' &&
            Number(detail.totalAmount) - Number(detail.paidAmount) > 0
              ? () => {
                  setPaySale({
                    id: detail.id,
                    due: Number(detail.totalAmount) - Number(detail.paidAmount),
                    number: detail.number,
                  });
                  setDetail(null);
                }
              : undefined
          }
        />
      )}

      {paySale && (
        <PaymentModal
          sale={paySale}
          onPaidLabel={t('sales.finish')}
          onClose={() => setPaySale(null)}
          onPaid={() => {
            setPaySale(null);
            refreshSalesViews();
          }}
        />
      )}
    </div>
  );
}

/** Libellé lisible d'un statut d'encaissement. */
const PAYMENT_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  SUCCESS: { label: 'Réussi', tone: 'success' },
  PENDING: { label: 'En attente', tone: 'warning' },
  FAILED: { label: 'Échoué', tone: 'danger' },
};

/**
 * Fiche détaillée d'une vente / d'un devis : articles, décomposition des
 * montants et historique des encaissements par moyen de paiement. Propose
 * d'encaisser le solde directement s'il en reste un.
 */
function SaleDetailModal({
  sale,
  onClose,
  onCollect,
}: {
  sale: SaleDetail;
  onClose: () => void;
  onCollect?: () => void;
}) {
  const due = Number(sale.totalAmount) - Number(sale.paidAmount);
  const payments = sale.payments ?? [];
  const insured = Number(sale.insuranceAmount ?? 0);

  return (
    <Modal open onClose={onClose} title={`Détail — ${sale.number}`} size="lg">
      <div className="space-y-4">
        {/* En-tête : client, statut, date */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3 text-sm">
          <div>
            <p className="font-medium text-content">
              {sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Client de passage'}
              {sale.customer?.phone ? ` · ${sale.customer.phone}` : ''}
            </p>
            <p className="text-xs text-content-faint">
              {formatDateTime(sale.createdAt)}
              {sale.cashier ? ` · ${sale.cashier.firstName} ${sale.cashier.lastName}` : ''}
            </p>
          </div>
          <Badge tone={statusTone(sale.status)}>{STATUS_LABEL[sale.status] ?? sale.status}</Badge>
        </div>

        {/* Articles */}
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Article</th>
                <th className="table-cell text-center font-semibold">Qté</th>
                <th className="table-cell text-right font-semibold">P.U.</th>
                <th className="table-cell text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="table-cell">
                    <div className="text-content">{i.product.name}</div>
                    <div className="font-mono text-[11px] text-content-faint">{i.product.sku}</div>
                    {i.reference && (
                      <div className="text-[11px] text-content-faint">Réf. {i.reference}</div>
                    )}
                  </td>
                  <td className="table-cell text-center text-content-muted">{i.quantity}</td>
                  <td className="table-cell text-right text-content-muted">{formatCurrency(Number(i.unitPrice))}</td>
                  <td className="table-cell text-right font-medium text-content">
                    {formatCurrency(Number(i.lineTotal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Décomposition des montants */}
        <div className="space-y-1 rounded-xl border p-3 text-sm">
          <AmountRow label="Sous-total" value={Number(sale.subtotal)} />
          {Number(sale.discountAmount) > 0 && (
            <AmountRow label="Remise" value={-Number(sale.discountAmount)} />
          )}
          <AmountRow
            label={Number(sale.taxAmount) === 0 ? 'TVA — exonéré' : 'TVA'}
            value={Number(sale.taxAmount)}
          />
          {Number(sale.insuranceAmount) > 0 && (
            <AmountRow label="Prise en charge assurance" value={Number(sale.insuranceAmount)} />
          )}
          <div className="my-1 border-t" />
          <div className="flex justify-between font-display text-lg font-bold text-content">
            <span>Total</span>
            <span>{formatCurrency(Number(sale.totalAmount))}</span>
          </div>
          <AmountRow label="Déjà encaissé" value={Number(sale.paidAmount)} />
          <div className="flex justify-between font-semibold">
            <span className="text-content-muted">Reste à payer</span>
            <span className={due > 0 ? 'text-warning' : 'text-success'}>
              {due > 0 ? formatCurrency(due) : 'Soldé'}
            </span>
          </div>
        </div>

        {/* Encaissements par moyen de paiement */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-content">Encaissements</h4>
          {payments.length === 0 && insured <= 0 ? (
            <p className="rounded-xl bg-surface-2 p-3 text-sm text-content-muted">
              Aucun encaissement enregistré pour cette pièce.
            </p>
          ) : (
            <div className="space-y-1.5">
              {/* La part assurance n'est pas un paiement encaissé au comptoir :
                  on l'affiche comme moyen à part entière pour que le détail
                  soit complet, même sur une vente 100 % prise en charge. */}
              {insured > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                    <span className="font-medium text-content">
                      {sale.insurerName ?? 'Assurance'}
                    </span>
                    <Badge tone="info">Prise en charge</Badge>
                  </div>
                  <span className="font-display font-bold text-content">{formatCurrency(insured)}</span>
                </div>
              )}
              {payments.map((p) => {
                const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: 'neutral' as const };
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-primary" />
                      <span className="font-medium text-content">
                        {PAYMENT_LABEL[p.method] ?? p.method}
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-content-faint">{formatDateTime(p.createdAt)}</span>
                      <span className="font-display font-bold text-content">
                        {formatCurrency(Number(p.amount))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {onCollect && (
            <Button variant="accent" onClick={onCollect}>
              <Banknote className="h-4 w-4" /> Encaisser {formatCurrency(due)}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function AmountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-content-muted">
      <span>{label}</span>
      <span className="text-content">{formatCurrency(value)}</span>
    </div>
  );
}

interface QuoteLine {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  // Référence libre de l'article remis (ex. référence fabricant d'une
  // monture), indépendante du stock — voir SaleItem.reference côté API.
  reference?: string;
}

/**
 * Modale de composition d'une vente / d'un devis. Sans `editing`, elle crée un
 * devis ; avec `editing`, elle modifie la pièce existante (articles, prix,
 * remise, prise en charge, TVA, client) — le serveur réajuste stock et montants.
 */
function QuoteModal({
  onClose,
  onCreated,
  editing,
}: {
  onClose: () => void;
  onCreated: (saleId: string) => void;
  editing?: SaleDetail;
}) {
  const { t } = useTranslation();
  const branchId = useUIStore((s) => s.activeBranchId);
  const vatPct = useAuthStore((s) => s.user?.tenantVatRate) ?? 18;
  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;
  const isEdit = Boolean(editing);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState(editing?.customerId ?? '');
  const [discount, setDiscount] = useState(Number(editing?.discountAmount ?? 0));
  const [insurerId, setInsurerId] = useState(editing?.insurerId ?? '');
  const [insurance, setInsurance] = useState(Number(editing?.insuranceAmount ?? 0));
  const [lines, setLines] = useState<QuoteLine[]>(
    editing
      ? editing.items.map((i) => ({
          productId: i.productId,
          name: i.product.name,
          sku: i.product.sku,
          unitPrice: Number(i.unitPrice),
          quantity: i.quantity,
          reference: i.reference ?? undefined,
        }))
      : [],
  );
  // Taux de TVA appliqué (null = taux de l'établissement). En modification, on
  // repart du taux réellement appliqué à la pièce.
  const [vatRate, setVatRate] = useState<number | null>(() => {
    if (!editing) return null;
    const base = Math.max(0, Number(editing.subtotal) - Number(editing.discountAmount));
    if (base <= 0) return null;
    return Math.round((Number(editing.taxAmount) / base) * 10000) / 100;
  });
  // Ordonnance jointe au document (facultative), et saisie à la volée si le
  // client n'en a pas encore d'enregistrée.
  const [prescriptionId, setPrescriptionId] = useState(editing?.prescriptionId ?? '');
  const [addingRx, setAddingRx] = useState(false);
  const canCreateRx = usePermission('optique.prescriptions.create');
  const qc = useQueryClient();

  const { data: stock, isLoading } = useQuery({
    queryKey: ['pos-stock', branchId],
    queryFn: () => getStock(branchId!),
    enabled: Boolean(branchId),
  });

  // Ordonnances du client sélectionné : proposées pour être jointes au devis.
  const { data: prescriptions } = useQuery({
    queryKey: ['prescriptions', customerId],
    queryFn: () => listPrescriptions(customerId),
    enabled: Boolean(customerId),
  });
  // Si le client a une ordonnance enregistrée, on la joint automatiquement
  // (la plus récente) pour qu'elle apparaisse sur le document imprimé sans
  // action manuelle. Ne touche jamais une pièce déjà enregistrée (édition),
  // ni un choix déjà fait par l'utilisateur.
  useEffect(() => {
    if (editing || prescriptionId || !prescriptions || prescriptions.length === 0) return;
    setPrescriptionId(prescriptions[0].id);
  }, [prescriptions, editing, prescriptionId]);
  const canSeeInsurers = usePermission('insurance.view');
  const { data: insurers } = useQuery({
    queryKey: ['insurers'],
    queryFn: listInsurers,
    enabled: canSeeInsurers,
  });

  const products = (stock ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()),
  );

  function addLine(p: { productId: string; name: string; sku: string; sellPrice: number }) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === p.productId ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { productId: p.productId, name: p.name, sku: p.sku, unitPrice: p.sellPrice, quantity: 1 }];
    });
  }
  function setQty(productId: string, qty: number) {
    if (qty <= 0) return setLines((prev) => prev.filter((l) => l.productId !== productId));
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)));
  }
  function setPrice(productId: string, price: number) {
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, unitPrice: Math.max(0, price) } : l)),
    );
  }
  function setReference(productId: string, reference: string) {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, reference } : l)));
  }

  // Taux effectif : celui choisi pour ce devis, sinon celui de l'établissement.
  const effectiveVat = vatRate ?? vatPct;
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const taxBase = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxBase * (effectiveVat / 100));
  const total = taxBase + taxAmount;

  // Prise en charge synchronisée avec l'assureur : suit le total en temps réel.
  const selectedInsurer = insurers?.find((x) => x.id === insurerId);
  useEffect(() => {
    if (!selectedInsurer) return;
    setInsurance(Math.round((total * selectedInsurer.coveragePercent) / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInsurer?.id, selectedInsurer?.coveragePercent, total]);

  const items = lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    reference: l.reference || undefined,
  }));

  const createMut = useMutation({
    mutationFn: () =>
      editing
        ? updateSale(editing.id, {
            customerId: customerId || null,
            items,
            discountAmount: discount,
            insuranceAmount: insurance,
            insurerId: insurance > 0 && insurerId ? insurerId : null,
            vatRate: vatRate ?? undefined,
            prescriptionId: prescriptionId || null,
          })
        : createSale({
            branchId: branchId!,
            customerId: customerId || undefined,
            type: 'QUOTE',
            items,
            discountAmount: discount,
            insuranceAmount: insurance,
            // Trace l'assureur pour le suivi des paiements trimestriels.
            insurerId: insurance > 0 && insurerId ? insurerId : undefined,
            // Taux de TVA choisi pour ce devis (omis = taux de l'établissement).
            vatRate: vatRate ?? undefined,
            // Ordonnance jointe au document (facultative).
            prescriptionId: prescriptionId || undefined,
          }),
    onSuccess: (sale) => onCreated(sale.id),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Modifier ${editing!.number}` : t('sales.newQuote')}
      size="lg"
    >
      {!branchId ? (
        <PageLoader />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Catalogue */}
          <div>
            <input
              className="input mb-2"
              placeholder={t('pos.searchProduct')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mb-2">
              <LensComposer
                pricing={pricing}
                onAdd={(line) =>
                  addLine({ productId: line.productId, name: line.name, sku: line.sku, sellPrice: line.unitPrice })
                }
              />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {isLoading ? (
                <PageLoader />
              ) : products.length === 0 ? (
                <p className="py-6 text-center text-sm text-content-muted">{t('common.noProduct')}</p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.productId}
                    onClick={() => addLine({ productId: p.productId, name: p.name, sku: p.sku, sellPrice: p.sellPrice })}
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-content">{p.name}</p>
                      <p className="font-mono text-[11px] text-content-faint">{p.sku}</p>
                      <p className="text-xs text-content-faint">
                        {p.unlimited ? 'Stock : illimité' : `Stock : ${p.quantity}`}
                      </p>
                    </div>
                    <span className="ml-2 shrink-0 font-semibold text-primary">{formatCurrency(p.sellPrice)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Devis en cours */}
          <div className="flex flex-col">
            <div className="mb-2">
              <CustomerSearch
                value={customerId || null}
                onChange={(id) => {
                  setCustomerId(id ?? '');
                  // L'ordonnance appartient au client précédent : on la détache.
                  setPrescriptionId('');
                }}
              />
            </div>

            <div className="max-h-44 flex-1 space-y-1 overflow-y-auto">
              {lines.length === 0 ? (
                <p className="py-8 text-center text-sm text-content-muted">{t('sales.addProducts')}</p>
              ) : (
                lines.map((l) => (
                  <div key={l.productId} className="flex items-center gap-2 rounded-lg bg-surface-2 p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-content">{l.name}</p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          value={l.unitPrice || ''}
                          onChange={(e) => setPrice(l.productId, Number(e.target.value) || 0)}
                          className="h-7 w-24 rounded-lg border bg-surface px-2 text-xs text-content"
                          title={t('pos.unitPriceEditable')}
                          placeholder={t('pos.pricePlaceholder')}
                        />
                      </div>
                      {/* Référence libre de l'article remis, indépendante du stock. */}
                      <input
                        type="text"
                        value={l.reference ?? ''}
                        onChange={(e) => setReference(l.productId, e.target.value)}
                        className="mt-1 h-7 w-full rounded-lg border bg-surface px-2 text-xs text-content"
                        placeholder="Référence (optionnel)"
                        maxLength={80}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) => setQty(l.productId, Number(e.target.value) || 1)}
                      className="input h-8 w-16 px-2 text-center"
                    />
                    <button
                      onClick={() => setQty(l.productId, 0)}
                      className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-content-muted">
                Remise
                <input
                  type="number"
                  className="input mt-1"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                />
              </label>
              <label className="text-xs text-content-muted">
                Prise en charge
                <input
                  type="number"
                  className="input mt-1"
                  value={insurance || ''}
                  onChange={(e) => setInsurance(Number(e.target.value) || 0)}
                />
              </label>
            </div>

            {/* Assurance : choisir un assureur enregistré applique automatiquement
                son taux de prise en charge (montant restant modifiable). */}
            {canSeeInsurers && insurers && insurers.length > 0 && (
              <label className="mt-2 block text-xs text-content-muted">
                Assurance
                <select
                  className="input mt-1"
                  value={insurerId}
                  onChange={(e) => {
                    setInsurerId(e.target.value);
                    if (!e.target.value) setInsurance(0);
                  }}
                >
                  <option value="">Aucune (client paie tout)</option>
                  {insurers.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.name} — {ins.coveragePercent}%
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* TVA : exonérer ou appliquer un taux différent pour ce devis. */}
            <div className="mt-2">
              <VatSelect value={vatRate} defaultRate={vatPct} onChange={setVatRate} />
            </div>

            {/* Ordonnance jointe (facultative) : reprise sur le document imprimé.
                Si le client n'en a pas encore, on peut la saisir ici même. */}
            {customerId && (
              <div className="mt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-content-muted">
                    <Glasses className="h-3.5 w-3.5 text-primary" /> Joindre une ordonnance
                  </span>
                  {canCreateRx && !addingRx && (
                    <button
                      type="button"
                      onClick={() => setAddingRx(true)}
                      className="btn-ghost h-7 rounded-lg px-2 text-xs text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" /> Nouvelle
                    </button>
                  )}
                </div>
                <select
                  className="input mt-1"
                  value={prescriptionId}
                  onChange={(e) => setPrescriptionId(e.target.value)}
                  disabled={!prescriptions || prescriptions.length === 0}
                >
                  <option value="">Aucune</option>
                  {prescriptions?.map((rx) => (
                    <option key={rx.id} value={rx.id}>
                      {formatDate(rx.date)}
                      {rx.lensType ? ` — ${rx.lensType}` : ''}
                    </option>
                  ))}
                </select>
                {prescriptions && prescriptions.length === 0 && !addingRx && (
                  <span className="mt-1 block text-[11px] text-content-faint">
                    Ce client n'a pas encore d'ordonnance —{' '}
                    {canCreateRx ? 'cliquez sur « Nouvelle » pour la saisir.' : 'aucune à joindre.'}
                  </span>
                )}

                {addingRx && (
                  <div className="mt-2">
                    <PrescriptionForm
                      customerId={customerId}
                      title="Ordonnance du client"
                      onClose={() => setAddingRx(false)}
                      onSaved={(rx) => {
                        // Disponible aussitôt dans la liste, et jointe au devis.
                        qc.invalidateQueries({ queryKey: ['prescriptions', customerId] });
                        qc.invalidateQueries({ queryKey: ['customer', customerId] });
                        setPrescriptionId(rx.id);
                        setAddingRx(false);
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between text-content-muted">
                <span>{t('common.subtotal')}</span>
                <span className="text-content">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-content-muted">
                <span>{effectiveVat === 0 ? 'TVA — exonéré' : `TVA (${effectiveVat} %)`}</span>
                <span className="text-content">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-display text-lg font-bold text-content">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button
                disabled={lines.length === 0}
                loading={createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {isEdit ? 'Enregistrer les modifications' : 'Créer le devis'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
