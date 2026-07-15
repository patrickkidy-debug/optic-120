import { useState } from 'react';
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
  Banknote,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import {
  listSales,
  cancelSale,
  convertQuote,
  createSaleReturn,
  getSale,
  getStock,
  listCustomers,
  createSale,
  type SaleListItem,
} from '../../features/optique/api';
import { printSaleDocument } from '../../features/optique/saleDocument';
import { PaymentModal } from './PosPage';
import { downloadCsv } from '../../lib/csv';
import { useAuthStore, usePermission } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';
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

export function SalesPage({ kind }: { kind: 'SALE' | 'QUOTE' }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canCancel = usePermission('optique.sales.cancel');
  const canConvert = usePermission('optique.quotes.convert');
  const canQuote = usePermission('optique.quotes.create');
  const canRefund = usePermission('optique.sales.refund');
  const canPay = usePermission('optique.sales.create');
  const user = useAuthStore((s) => s.user);
  const [quoteOpen, setQuoteOpen] = useState(false);
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
        ['N°', 'Date', 'Client', 'Statut', 'Total', 'Payé', 'Reste'],
        rows.map((s) => [
          s.number,
          new Date(s.createdAt).toLocaleString('fr-FR'),
          clientName(s),
          STATUS_LABEL[s.status] ?? s.status,
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
          title={isQuote ? 'Aucun devis' : 'Aucune vente'}
          hint={isQuote ? 'Créez un devis avec le bouton « Nouveau devis ».' : 'Les ventes créées en caisse apparaîtront ici.'}
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
                <th className="table-cell text-right font-semibold">{t('sales.amount')}</th>
                {!isQuote && <th className="table-cell text-right font-semibold">{t('sales.paid')}</th>}
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
                  <td className="table-cell text-right font-semibold text-content">
                    {formatCurrency(Number(s.totalAmount))}
                  </td>
                  {!isQuote && (
                    <td className="table-cell text-right text-content-muted">
                      {formatCurrency(Number(s.paidAmount))}
                    </td>
                  )}
                  <td className="table-cell text-right text-content-muted">
                    {formatDateTime(s.createdAt)}
                  </td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
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
                            title="Encaisser le solde"
                          >
                            <Banknote className="h-3.5 w-3.5" /> Encaisser
                          </button>
                        )}
                      {isQuote && canConvert && s.status !== 'CANCELLED' && (
                        <button
                          onClick={() => convertMut.mutate(s.id)}
                          className="btn-outline h-8 rounded-lg px-2.5 text-xs"
                          title="Convertir en vente"
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
                          title="Retour / avoir"
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
                          title="Annuler"
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

      {paySale && (
        <PaymentModal
          sale={paySale}
          onPaidLabel="Terminer"
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

interface QuoteLine {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

function QuoteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (saleId: string) => void;
}) {
  const branchId = useUIStore((s) => s.activeBranchId);
  const vatPct = useAuthStore((s) => s.user?.tenantVatRate) ?? 18;
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [lines, setLines] = useState<QuoteLine[]>([]);

  const { data: stock, isLoading } = useQuery({
    queryKey: ['pos-stock', branchId],
    queryFn: () => getStock(branchId!),
    enabled: Boolean(branchId),
  });
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() });

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

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const taxBase = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxBase * (vatPct / 100));
  const total = taxBase + taxAmount;

  const createMut = useMutation({
    mutationFn: () =>
      createSale({
        branchId: branchId!,
        customerId: customerId || undefined,
        type: 'QUOTE',
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
        discountAmount: discount,
        insuranceAmount: insurance,
      }),
    onSuccess: (sale) => onCreated(sale.id),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Nouveau devis" size="lg">
      {!branchId ? (
        <PageLoader />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Catalogue */}
          <div>
            <input
              className="input mb-2"
              placeholder="Rechercher un produit…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {isLoading ? (
                <PageLoader />
              ) : products.length === 0 ? (
                <p className="py-6 text-center text-sm text-content-muted">Aucun produit.</p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.productId}
                    onClick={() => addLine({ productId: p.productId, name: p.name, sku: p.sku, sellPrice: p.sellPrice })}
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-content">{p.name}</p>
                      <p className="text-xs text-content-faint">Stock : {p.quantity}</p>
                    </div>
                    <span className="ml-2 shrink-0 font-semibold text-primary">{formatCurrency(p.sellPrice)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Devis en cours */}
          <div className="flex flex-col">
            <select className="input mb-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Client comptant</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>

            <div className="max-h-44 flex-1 space-y-1 overflow-y-auto">
              {lines.length === 0 ? (
                <p className="py-8 text-center text-sm text-content-muted">Ajoutez des produits au devis.</p>
              ) : (
                lines.map((l) => (
                  <div key={l.productId} className="flex items-center gap-2 rounded-lg bg-surface-2 p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-content">{l.name}</p>
                      <input
                        type="number"
                        min={0}
                        value={l.unitPrice || ''}
                        onChange={(e) => setPrice(l.productId, Number(e.target.value) || 0)}
                        className="mt-0.5 h-7 w-24 rounded-lg border bg-surface px-2 text-xs text-content"
                        title="Prix unitaire (modifiable)"
                        placeholder="Prix"
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

            <div className="mt-3 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between text-content-muted">
                <span>Sous-total</span>
                <span className="text-content">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-content-muted">
                <span>TVA ({vatPct} %)</span>
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
                Créer le devis
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
