import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Banknote, Minus, Percent, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import type { ReportTotals } from '../../../features/optique/api';
import { formatCurrency } from '../../../lib/format';
import { Skeleton, computeDelta, formatDelta, formatPercent } from './shared';
import type { Delta } from './shared';

/**
 * Six indicateurs, tous issus du même agrégat serveur que le tableau.
 * Chaque carte est cliquable et applique le filtre correspondant : c'est ce qui
 * transforme un tableau de bord en outil d'analyse — voir une anomalie, cliquer,
 * obtenir la liste des ventes concernées.
 */

function DeltaBadge({ delta, suffix = 'vs période précédente' }: { delta: Delta; suffix?: string }) {
  const tone =
    delta.percent === null
      ? 'text-content-faint'
      : delta.direction === 'up'
        ? 'text-success'
        : delta.direction === 'down'
          ? 'text-danger'
          : 'text-content-muted';
  const Icon =
    delta.percent === null || delta.direction === 'flat'
      ? Minus
      : delta.direction === 'up'
        ? ArrowUpRight
        : ArrowDownRight;
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs ${tone}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="font-semibold">{formatDelta(delta)}</span>
      <span className="text-content-faint">{suffix}</span>
    </p>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  children,
  onClick,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  children?: React.ReactNode;
  onClick?: () => void;
  hint?: string;
}) {
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      title={hint}
      className={`card p-4 text-left transition-shadow ${
        interactive
          ? 'cursor-pointer hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]'
          : 'cursor-default'
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2 text-content-muted">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display text-xl font-bold text-content sm:text-2xl">{value}</p>
      {children}
    </button>
  );
}

export function KpiGridSkeleton() {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="card p-4">
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="mb-2 h-7 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function KpiGrid({
  summary,
  previous,
  onShowUnpaid,
  onShowAll,
}: {
  summary: ReportTotals;
  previous: ReportTotals;
  onShowUnpaid: () => void;
  onShowAll: () => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        icon={TrendingUp}
        label="Chiffre d'affaires"
        value={formatCurrency(summary.revenue)}
        onClick={onShowAll}
        hint="Montant facturé sur la période. Voir toutes les ventes."
      >
        <DeltaBadge delta={computeDelta(summary.revenue, previous.revenue)} />
      </KpiCard>

      <KpiCard
        icon={Wallet}
        label="Encaissements"
        value={formatCurrency(summary.collected)}
        onClick={onShowAll}
        hint="Montant réellement encaissé, part assurance comprise."
      >
        <p className="mt-1 text-xs text-content-faint">
          {formatPercent(summary.collectionRate)} du CA encaissé
        </p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-[color:var(--success)] transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, summary.collectionRate))}%` }}
          />
        </div>
      </KpiCard>

      <KpiCard
        icon={Banknote}
        label="Reste à encaisser"
        value={formatCurrency(summary.outstanding)}
        onClick={onShowUnpaid}
        hint="Filtrer sur les ventes partielles et impayées."
      >
        <p className="mt-1 text-xs text-content-faint">
          {summary.unpaidCount} {summary.unpaidCount > 1 ? 'ventes concernées' : 'vente concernée'}
        </p>
      </KpiCard>

      <KpiCard
        icon={ShoppingBag}
        label="Ventes"
        value={String(summary.count)}
        onClick={onShowAll}
        hint="Voir toutes les ventes de la période."
      >
        <DeltaBadge delta={computeDelta(summary.count, previous.count)} />
      </KpiCard>

      <KpiCard icon={Receipt} label="Panier moyen" value={formatCurrency(summary.avgBasket)}>
        <p className="mt-1 text-xs text-content-faint">par vente</p>
        <DeltaBadge delta={computeDelta(summary.avgBasket, previous.avgBasket)} suffix="" />
      </KpiCard>

      <KpiCard icon={Percent} label="Taux d'encaissement" value={formatPercent(summary.collectionRate)}>
        <p className="mt-1 text-xs text-content-faint">sur la période</p>
        <DeltaBadge
          delta={computeDelta(summary.collectionRate, previous.collectionRate)}
          suffix=""
        />
      </KpiCard>
    </div>
  );
}
