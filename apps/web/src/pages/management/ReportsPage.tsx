import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Package, Wallet, Receipt, TrendingUp, ShoppingBag } from 'lucide-react';
import { getSalesReport, getStock } from '../../features/optique/api';
import { listExpenses } from '../../features/management/api';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { downloadCsv } from '../../lib/csv';
import { formatCurrency } from '../../lib/format';
import { PageHeader, PageLoader, Button, Field } from '../../components/ui';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmée',
  PARTIALLY_PAID: 'Partiel',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

export function ReportsPage() {
  const branchId = useUIStore((s) => s.activeBranchId);
  const canStock = usePermission('optique.stock.view');
  const canExpenses = usePermission('finance.expenses.view');

  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const [busy, setBusy] = useState('');

  const { data: report, isLoading } = useQuery({
    queryKey: ['sales-report', from, to, branchId],
    queryFn: () => getSalesReport({ from, to, branchId: branchId ?? undefined }),
  });

  function exportSales() {
    if (!report) return;
    downloadCsv(
      `ventes_${from}_${to}.csv`,
      ['N°', 'Date', 'Client', 'Magasin', 'Statut', 'Total', 'Payé', 'Reste'],
      report.rows.map((r) => [
        r.number,
        new Date(r.date).toLocaleString('fr-FR'),
        r.customer,
        r.branch,
        STATUS_LABEL[r.status] ?? r.status,
        r.total,
        r.paid,
        r.balance,
      ]),
    );
  }

  async function exportStock() {
    if (!branchId) return;
    setBusy('stock');
    try {
      const rows = await getStock(branchId);
      downloadCsv(
        `stock_${iso(new Date())}.csv`,
        ['SKU', 'Produit', 'Catégorie', 'Quantité', 'Seuil', 'Prix vente'],
        rows.map((r) => [r.sku, r.name, r.category, r.quantity, r.minAlert, r.sellPrice]),
      );
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setBusy('');
    }
  }

  async function exportExpenses() {
    setBusy('expenses');
    try {
      const rows = await listExpenses();
      downloadCsv(
        `depenses_${iso(new Date())}.csv`,
        ['Date', 'Catégorie', 'Libellé', 'Montant', 'Notes'],
        rows.map((e) => [e.date.slice(0, 10), e.category, e.label, Number(e.amount), e.notes ?? '']),
      );
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <div>
      <PageHeader title="Rapports" subtitle="Synthèse et export des données (CSV)" />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="Du">
          <input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Au">
          <input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={TrendingUp} label="Chiffre d'affaires encaissé" value={formatCurrency(report?.summary.revenue ?? 0)} />
            <StatCard icon={ShoppingBag} label="Ventes" value={String(report?.summary.count ?? 0)} />
            <StatCard icon={Receipt} label="Panier moyen" value={formatCurrency(report?.summary.avgBasket ?? 0)} />
          </div>

          <div className="card mb-4 p-4">
            <h3 className="mb-3 font-display font-bold text-content">Exports</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportSales} disabled={!report || report.rows.length === 0}>
                <Download className="h-4 w-4" /> Ventes (période)
              </Button>
              {canStock && (
                <Button variant="outline" onClick={exportStock} loading={busy === 'stock'}>
                  <Package className="h-4 w-4" /> Stock actuel
                </Button>
              )}
              {canExpenses && (
                <Button variant="outline" onClick={exportExpenses} loading={busy === 'expenses'}>
                  <Wallet className="h-4 w-4" /> Dépenses
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-content-faint">
              Fichiers CSV compatibles Excel (séparateur « ; », UTF-8).
            </p>
          </div>

          {report && report.rows.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                    <th className="table-cell font-semibold">N°</th>
                    <th className="table-cell font-semibold">Client</th>
                    <th className="table-cell font-semibold">Statut</th>
                    <th className="table-cell text-right font-semibold">Total</th>
                    <th className="table-cell text-right font-semibold">Payé</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.slice(0, 50).map((r) => (
                    <tr key={r.number} className="border-b last:border-0 hover:bg-surface-2/50">
                      <td className="table-cell font-medium text-content">{r.number}</td>
                      <td className="table-cell text-content-muted">{r.customer || '—'}</td>
                      <td className="table-cell text-content-muted">{STATUS_LABEL[r.status] ?? r.status}</td>
                      <td className="table-cell text-right text-content">{formatCurrency(r.total)}</td>
                      <td className="table-cell text-right text-content-muted">{formatCurrency(r.paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.rows.length > 50 && (
                <p className="p-3 text-center text-xs text-content-faint">
                  {report.rows.length} ventes au total — exportez le CSV pour la liste complète.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center gap-2 text-content-muted">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold text-content">{value}</p>
    </div>
  );
}
