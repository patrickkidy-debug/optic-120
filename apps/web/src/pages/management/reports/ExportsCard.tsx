import { useState } from 'react';
import { Banknote, Download, Package, Receipt, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getReportPayments,
  getSalesReport,
  getStock,
  listCustomers,
  type SalesReportParams,
} from '../../../features/optique/api';
import { listExpenses } from '../../../features/management/api';
import { apiErrorMessage } from '../../../lib/api';
import { downloadCsv } from '../../../lib/csv';
import { Button } from '../../../components/ui';
import { iso, methodLabel, statusLabel } from './shared';

/**
 * Exports CSV. Ceux qui portent sur les ventes rejouent la requête du rapport
 * avec les MÊMES filtres et une grande taille de page : le fichier contient
 * donc toutes les lignes du périmètre, pas seulement la page affichée — sans
 * quoi l'utilisateur exporterait 20 lignes en croyant en exporter 124.
 */

const EXPORT_PAGE_SIZE = 1000;

interface ExportCard {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  run: () => Promise<number>;
  visible: boolean;
}

export function ExportsCard({
  params,
  matchedCount,
  branchId,
  canStock,
  canExpenses,
  canCustomers,
}: {
  params: SalesReportParams;
  matchedCount: number;
  branchId?: string | null;
  canStock: boolean;
  canExpenses: boolean;
  canCustomers: boolean;
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const cards: ExportCard[] = [
    {
      key: 'sales',
      icon: Receipt,
      title: 'Ventes',
      description: `Toutes les ventes correspondant aux filtres — ${matchedCount} ligne${
        matchedCount > 1 ? 's' : ''
      } sera exportée${matchedCount > 1 ? 's' : ''}.`,
      visible: true,
      run: async () => {
        const full = await getSalesReport({ ...params, page: 1, pageSize: EXPORT_PAGE_SIZE });
        downloadCsv(
          `ventes_${params.from}_${params.to}.csv`,
          ['N°', 'Date', 'Client', 'Téléphone', 'Magasin', 'Vendeur', 'Statut', 'Mode de paiement', 'Total', 'Payé', 'Reste'],
          full.rows.map((r) => [
            r.number,
            new Date(r.date).toLocaleString('fr-FR'),
            r.customer,
            r.customerPhone ?? '',
            r.branch,
            r.cashier,
            statusLabel(r.status),
            r.methods.map(methodLabel).join(' + '),
            r.total,
            r.paid,
            r.balance,
          ]),
        );
        return full.rows.length;
      },
    },
    {
      key: 'payments',
      icon: Wallet,
      title: 'Paiements',
      description: 'Les encaissements réellement enregistrés sur la période.',
      visible: true,
      run: async () => {
        const payments = await getReportPayments(params);
        downloadCsv(
          `encaissements_${params.from}_${params.to}.csv`,
          ['Date', 'Vente', 'Client', 'Mode', 'Montant'],
          payments.map((p) => [
            new Date(p.date).toLocaleString('fr-FR'),
            p.saleNumber,
            p.customer,
            methodLabel(p.method),
            p.amount,
          ]),
        );
        return payments.length;
      },
    },
    {
      key: 'stock',
      icon: Package,
      title: 'Stock',
      description: 'Le stock actuel du magasin sélectionné.',
      visible: canStock && Boolean(branchId),
      run: async () => {
        const rows = await getStock(branchId!);
        downloadCsv(
          `stock_${iso(new Date())}.csv`,
          ['SKU', 'Produit', 'Catégorie', 'Quantité', 'Seuil', 'Prix vente'],
          rows.map((r) => [r.sku, r.name, r.category, r.quantity, r.minAlert, r.sellPrice]),
        );
        return rows.length;
      },
    },
    {
      key: 'expenses',
      icon: Banknote,
      title: 'Dépenses',
      description: 'Les dépenses enregistrées pour ce magasin.',
      visible: canExpenses,
      run: async () => {
        const rows = await listExpenses(branchId ?? undefined);
        downloadCsv(
          `depenses_${iso(new Date())}.csv`,
          ['Date', 'Catégorie', 'Libellé', 'Montant', 'Notes'],
          rows.map((e) => [e.date.slice(0, 10), e.category, e.label, Number(e.amount), e.notes ?? '']),
        );
        return rows.length;
      },
    },
    {
      key: 'customers',
      icon: Users,
      title: 'Clients',
      description: 'Le fichier clients du magasin sélectionné.',
      visible: canCustomers,
      run: async () => {
        const rows = await listCustomers(undefined, branchId ?? undefined);
        downloadCsv(
          `clients_${iso(new Date())}.csv`,
          ['Nom', 'Prénom', 'Téléphone', 'Email', 'Points fidélité'],
          rows.map((c) => [c.lastName, c.firstName, c.phone ?? '', c.email ?? '', c.loyaltyPoints ?? 0]),
        );
        return rows.length;
      },
    },
  ];

  async function run(card: ExportCard) {
    setBusy(card.key);
    setError('');
    setDone('');
    try {
      const count = await card.run();
      setDone(
        count === 0
          ? `${card.title} : aucune ligne à exporter.`
          : `${card.title} : ${count} ligne${count > 1 ? 's' : ''} exportée${count > 1 ? 's' : ''}.`,
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="card mb-4 p-4" aria-label="Exports">
      <h3 className="font-display text-base font-bold text-content">Exporter vos données</h3>
      <p className="mb-4 text-xs text-content-faint">
        Téléchargez vos données au format CSV pour les analyser dans Excel ou Google Sheets.
        Les exports de ventes et de paiements respectent les filtres actifs.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards
          .filter((c) => c.visible)
          .map((c) => (
            <div key={c.key} className="flex flex-col justify-between rounded-xl border p-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <c.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-semibold uppercase tracking-wide text-content">
                    {c.title}
                  </span>
                </div>
                <p className="mb-3 text-xs text-content-muted">{c.description}</p>
              </div>
              <Button variant="outline" loading={busy === c.key} onClick={() => run(c)}>
                <Download className="h-4 w-4" /> Exporter CSV
              </Button>
            </div>
          ))}
      </div>

      <p className="mt-3 text-xs text-content-faint">
        Fichiers CSV compatibles Excel (séparateur « ; », UTF-8).
      </p>

      <div aria-live="polite">
        {done && <p className="mt-2 text-sm text-success">{done}</p>}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}
