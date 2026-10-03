import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { ANOMALY_CATEGORIES, type AnomalyCategory } from '@oculo/shared-types';
import { getAnomalyDashboard } from '../../features/anomalies/api';
import { formatCurrency } from '../../lib/format';
import { StatCard, PageLoader } from '../../components/ui';
import { ANOMALY_CATEGORY_LABELS } from './shared';
import { tr } from '../../lib/tr';

export function OverviewTab() {
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['anomalies-dashboard', category, from, to],
    queryFn: () =>
      getAnomalyDashboard({
        category: (category as AnomalyCategory) || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input h-9 w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{tr('ui.OverviewTab.toutesCategories')}</option>
          {ANOMALY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ANOMALY_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input aria-label={tr('ui.OverviewTab.depuis')} className="input h-9 w-auto" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input aria-label={tr('ui.OverviewTab.jusquAu')} className="input h-9 w-auto" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {isLoading || !data ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={FolderOpen} label={tr('ui.OverviewTab.anomaliesOuvertes')} value={data.counts.open} tone="primary" />
            <StatCard icon={Clock} label={tr('ui.OverviewTab.enAttenteDeValidation')} value={data.counts.pendingValidation} tone="accent" />
            <StatCard icon={CheckCircle2} label={tr('ui.OverviewTab.corrigees')} value={data.counts.corrected} tone="success" />
            <StatCard icon={XCircle} label={tr('ui.OverviewTab.rejetees')} value={data.counts.rejected} tone="danger" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={FolderOpen}
              label={tr('ui.OverviewTab.impactFinancierTotal')}
              value={formatCurrency(data.financialImpact)}
              hint={tr('ui.OverviewTab.approvedApprouveeSEnAttente', { approved: data.counts.approved, cancelled: data.counts.cancelled })}
              tone={data.financialImpact >= 0 ? 'success' : 'danger'}
            />
            <StatCard
              icon={FolderOpen}
              label={tr('ui.OverviewTab.impactStockTotal')}
              value={data.stockImpact}
              tone={data.stockImpact >= 0 ? 'success' : 'danger'}
            />
          </div>
        </>
      )}
    </div>
  );
}
