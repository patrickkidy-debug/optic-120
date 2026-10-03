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
import { tr } from '../../../lib/tr';
import { displayLocale } from '../../../lib/format';

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
      title: tr('ui.ExportsCard.ventes'),
      description: tr('ui.ExportsCard.toutesLesVentesCorrespondantAux', { matchedCount: matchedCount, v: matchedCount > 1 ? 's' : '', v2: matchedCount > 1 ? 's' : '' }),
      visible: true,
      run: async () => {
        const full = await getSalesReport({ ...params, page: 1, pageSize: EXPORT_PAGE_SIZE });
        downloadCsv(
          `ventes_${params.from}_${params.to}.csv`,
          ['N°', 'Date', 'Client', tr('ui.ExportsCard.telephone'), tr('ui.ExportsCard.magasin'), tr('ui.ExportsCard.vendeur'), tr('ui.ExportsCard.statut'), tr('ui.ExportsCard.modeDePaiement'), 'Total', tr('ui.ExportsCard.paye'), tr('ui.ExportsCard.reste')],
          full.rows.map((r) => [
            r.number,
            new Date(r.date).toLocaleString(displayLocale()),
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
      title: tr('ui.ExportsCard.paiements'),
      description: tr('ui.ExportsCard.lesEncaissementsReellementEnregistresSur'),
      visible: true,
      run: async () => {
        const payments = await getReportPayments(params);
        downloadCsv(
          `encaissements_${params.from}_${params.to}.csv`,
          ['Date', tr('ui.ExportsCard.vente'), 'Client', 'Mode', tr('ui.ExportsCard.montant')],
          payments.map((p) => [
            new Date(p.date).toLocaleString(displayLocale()),
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
      description: tr('ui.ExportsCard.leStockActuelDuMagasin'),
      visible: canStock && Boolean(branchId),
      run: async () => {
        const rows = await getStock(branchId!);
        downloadCsv(
          `stock_${iso(new Date())}.csv`,
          ['SKU', tr('ui.ExportsCard.produit'), tr('ui.ExportsCard.categorie'), tr('ui.ExportsCard.quantite'), tr('ui.ExportsCard.seuil'), tr('ui.ExportsCard.prixVente')],
          rows.map((r) => [r.sku, r.name, r.category, r.quantity, r.minAlert, r.sellPrice]),
        );
        return rows.length;
      },
    },
    {
      key: 'expenses',
      icon: Banknote,
      title: tr('ui.ExportsCard.depenses'),
      description: tr('ui.ExportsCard.lesDepensesEnregistreesPourCe'),
      visible: canExpenses,
      run: async () => {
        const rows = await listExpenses(branchId ?? undefined);
        downloadCsv(
          `depenses_${iso(new Date())}.csv`,
          ['Date', tr('ui.ExportsCard.categorie'), tr('ui.ExportsCard.libelle'), tr('ui.ExportsCard.montant'), 'Notes'],
          rows.map((e) => [e.date.slice(0, 10), e.category, e.label, Number(e.amount), e.notes ?? '']),
        );
        return rows.length;
      },
    },
    {
      key: 'customers',
      icon: Users,
      title: 'Clients',
      description: tr('ui.ExportsCard.leFichierClientsDuMagasin'),
      visible: canCustomers,
      run: async () => {
        const rows = await listCustomers(undefined, branchId ?? undefined);
        downloadCsv(
          `clients_${iso(new Date())}.csv`,
          [tr('ui.ExportsCard.nom'), tr('ui.ExportsCard.prenom'), tr('ui.ExportsCard.telephone'), 'Email', tr('ui.ExportsCard.pointsFidelite')],
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
          ? tr('ui.ExportsCard.titleAucuneLigneAExporter', { title: card.title })
          : tr('ui.ExportsCard.titleCountLigneVExportee', { title: card.title, count: count, v: count > 1 ? 's' : '', v2: count > 1 ? 's' : '' }),
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="card mb-4 p-4" aria-label={tr('ui.ExportsCard.exports')}>
      <h3 className="font-display text-base font-bold text-content">{tr('ui.ExportsCard.exporterVosDonnees')}</h3>
      <p className="mb-4 text-xs text-content-faint">
        {tr('ui.ExportsCard.telechargezVosDonneesAuFormat')}
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
                <Download className="h-4 w-4" /> {tr('ui.ExportsCard.exporterCsv')}
              </Button>
            </div>
          ))}
      </div>

      <p className="mt-3 text-xs text-content-faint">
        {tr('reports.csvNote')}
      </p>

      <div aria-live="polite">
        {done && <p className="mt-2 text-sm text-success">{done}</p>}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}
