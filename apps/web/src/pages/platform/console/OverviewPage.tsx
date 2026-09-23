import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import '../../../lib/chart-setup';
import { Line } from 'react-chartjs-2';
import type { Chart as ChartJS } from 'chart.js';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarClock,
  ChevronRight,
  CreditCard,
  RefreshCcw,
  Repeat,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Button } from '../../../components/ui';
import { formatCurrency } from '../../../lib/format';
import { useAuthStore } from '../../../store/auth';
import { getFounderOverview, type FounderOverview } from '../../../features/billing/console';
import type { SectionId } from './navigation';

const PERIODS = [
  { id: 'today', label: "Aujourd'hui", days: 1 },
  { id: '7d', label: '7 jours', days: 7 },
  { id: '30d', label: '30 jours', days: 30 },
  { id: '3m', label: '3 mois', days: 90 },
  { id: '12m', label: '12 mois', days: 365 },
  { id: 'custom', label: 'Personnalisé', days: 30 },
] as const;

type PeriodId = (typeof PERIODS)[number]['id'];

function boundsForDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * Tableau de bord du fondateur (§5-11, §21).
 *
 * Règle tenue partout sur cet écran : un utilisateur n'est pas un
 * établissement, et un établissement n'est pas un client payant. Les trois sont
 * comptés séparément et jamais additionnés — c'est la confusion qui fait croire
 * à deux cents clients quand douze paient.
 */
export function ConsoleOverviewPage({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const firstName = useAuthStore((s) => s.user?.firstName);
  const [period, setPeriod] = useState<PeriodId>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const bounds = useMemo(() => {
    if (period === 'custom') {
      return customFrom && customTo ? { from: customFrom, to: customTo } : boundsForDays(30);
    }
    return boundsForDays(PERIODS.find((p) => p.id === period)!.days);
  }, [period, customFrom, customTo]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['platform-overview', bounds.from, bounds.to],
    queryFn: () => getFounderOverview(bounds),
  });

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
        <p className="mt-3 font-semibold text-content">Impossible de charger les indicateurs</p>
        <p className="mt-1 text-sm text-content-muted">
          Aucun chiffre n’est affiché plutôt que d’en afficher de faux.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          <RefreshCcw className="h-4 w-4" /> Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-content">
            Bonjour {firstName ?? ''} 👋
          </h2>
          <p className="text-sm text-content-muted">
            Voici ce qui se passe sur OculoSaaS aujourd’hui.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                period === p.id
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl bg-surface-2 p-3">
          <label className="block">
            <span className="label">Du</span>
            <input type="date" className="input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Au</span>
            <input type="date" className="input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </label>
          {(!customFrom || !customTo) && (
            <p className="pb-2 text-xs text-content-faint">
              Choisissez les deux bornes — en attendant, les 30 derniers jours sont affichés.
            </p>
          )}
        </div>
      )}

      {isLoading || !data ? (
        <SkeletonGrid />
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <KpiRow data={data} onNavigate={onNavigate} />
          <ActionRequired data={data} onNavigate={onNavigate} />
          <SubscriptionBreakdown data={data} onNavigate={onNavigate} />
          <Charts data={data} />
        </div>
      )}
    </div>
  );
}

/* --------------------------------- KPI (§6-7) --------------------------------- */

function KpiRow({ data, onNavigate }: { data: FounderOverview; onNavigate: (id: SectionId) => void }) {
  const revenueDelta = delta(data.revenue.collected, data.revenue.collectedPrevious);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Kpi
        icon={Building2}
        tone="primary"
        label="Établissements"
        value={String(data.tenants.total)}
        sub={<Delta value={data.tenants.created} previous={data.tenants.previous} suffix="sur la période" />}
        onClick={() => onNavigate('etablissements')}
      />
      <Kpi
        icon={Users}
        tone="info"
        label="Utilisateurs"
        value={String(data.users.total)}
        sub={<Delta value={data.users.created} previous={data.users.previous} suffix="sur la période" />}
        onClick={() => onNavigate('utilisateurs')}
      />
      <Kpi
        icon={Repeat}
        tone="accent"
        label="Abonnements payants"
        value={String(data.subscriptions.paying)}
        sub={
          <span className="text-content-faint">
            sur {data.subscriptions.total} abonnements — un utilisateur n’est pas un client payant
          </span>
        }
        onClick={() => onNavigate('abonnements')}
      />
      <Kpi
        icon={Wallet}
        tone="success"
        label="Revenu mensuel (MRR)"
        value={formatCurrency(data.revenue.mrr)}
        sub={<span className="text-content-faint">soit {formatCurrency(data.revenue.arr)} par an</span>}
        onClick={() => onNavigate('finances')}
      />
      <Kpi
        icon={CreditCard}
        tone="success"
        // « Net » figure dans le libellé : la carte retranche les
        // remboursements, la ligne « Encaissé sur la période » ci-dessous ne
        // les retranche pas. Sans le dire, deux montants differents pour la
        // meme periode passent pour une incoherence.
        label="Revenus encaissés (net)"
        value={formatCurrency(data.revenue.net)}
        sub={
          data.revenue.refunded > 0 ? (
            <span className="text-content-faint">
              {formatCurrency(data.revenue.collected)} encaissés, moins{' '}
              {formatCurrency(data.revenue.refunded)} remboursés
            </span>
          ) : revenueDelta == null ? (
            <span className="text-content-faint">
              {data.revenue.collectedPrevious > 0
                ? 'période précédente trop faible pour une comparaison'
                : 'aucun encaissement sur la période précédente'}
            </span>
          ) : (
            <span className={revenueDelta >= 0 ? 'text-success' : 'text-danger'}>
              {revenueDelta >= 0 ? '+' : ''}
              {revenueDelta.toFixed(0)} % vs période précédente
            </span>
          )
        }
        onClick={() => onNavigate('revenus')}
      />
      <Kpi
        icon={data.renewals.rate != null && data.renewals.rate >= 70 ? TrendingUp : TrendingDown}
        tone={data.renewals.rate != null && data.renewals.rate < 50 ? 'danger' : 'primary'}
        label="Taux de renouvellement"
        value={data.renewals.rate == null ? '—' : `${Math.round(data.renewals.rate)} %`}
        sub={
          data.renewals.rate == null ? (
            <span className="text-content-faint">aucune échéance n’est tombée sur la période</span>
          ) : (
            <span className="text-content-faint">
              {data.renewals.renewed} renouvelés, {data.renewals.expired} expirés
            </span>
          )
        }
        onClick={() => onNavigate('renouvellements')}
      />
    </div>
  );
}

/**
 * Variation en pourcentage.
 *
 * null dès que la base est trop faible pour porter un pourcentage. Passer de 2
 * à 31 établissements affichait « +1450 % » : arithmétiquement exact, mais le
 * chiffre ne dit rien d'autre que « la base était minuscule ». Sous ce seuil,
 * seule la valeur absolue est montrée, qui est la vraie information.
 */
const MIN_BASE_FOR_PERCENT = 5;

function delta(current: number, previous: number): number | null {
  if (previous < MIN_BASE_FOR_PERCENT) return null;
  return ((current - previous) / previous) * 100;
}

function Delta({ value, previous, suffix }: { value: number; previous: number; suffix: string }) {
  const d = delta(value, previous);
  return (
    <span className="text-content-faint">
      +{value} {suffix}
      {d != null && (
        <span className={`ml-1.5 ${d >= 0 ? 'text-success' : 'text-danger'}`}>
          ({d >= 0 ? '+' : ''}
          {d.toFixed(0)} %)
        </span>
      )}
    </span>
  );
}

const TONES = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-[color:var(--success)]/10 text-success',
  warning: 'bg-[color:var(--warning)]/10 text-warning',
  danger: 'bg-[color:var(--danger)]/10 text-danger',
  info: 'bg-[color:var(--info,var(--primary))]/10 text-primary',
} as const;

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone: keyof typeof TONES;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card group p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-content-muted">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold text-content">{value}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {sub && <div className="mt-2 text-xs">{sub}</div>}
      <span className="mt-2 flex items-center gap-0.5 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Ouvrir <ChevronRight className="h-3 w-3" />
      </span>
    </button>
  );
}

/* ----------------------------- Action requise (§8, §21) ----------------------------- */

function ActionRequired({
  data,
  onNavigate,
}: {
  data: FounderOverview;
  onNavigate: (id: SectionId) => void;
}) {
  const a = data.actionRequired;
  const cards = [
    { count: a.failedPayments, label: 'Paiements échoués', tone: 'danger' as const, icon: AlertTriangle, to: 'paiements' as SectionId },
    { count: a.renewalsToday, label: "Renouvellements aujourd'hui", tone: 'warning' as const, icon: Repeat, to: 'renouvellements' as SectionId },
    { count: a.pendingConfirmations, label: 'Paiements à confirmer', tone: 'warning' as const, icon: BadgeCheck, to: 'a-confirmer' as SectionId },
    { count: a.demosToProcess, label: 'Démos à traiter', tone: 'accent' as const, icon: CalendarClock, to: 'demos' as SectionId },
    { count: a.expiredClients, label: 'Clients expirés', tone: 'danger' as const, icon: Building2, to: 'etablissements' as SectionId },
    { count: a.overdueInvoices, label: 'Factures en retard', tone: 'warning' as const, icon: CreditCard, to: 'factures' as SectionId },
  ].filter((c) => c.count > 0);

  return (
    <section className="mt-5" aria-label="Action requise">
      <h3 className="mb-2 font-display text-base font-bold text-content">Action requise</h3>
      {cards.length === 0 ? (
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--success)]/10 text-success">
            <BadgeCheck className="h-4 w-4" />
          </span>
          <p className="text-sm text-content-muted">
            Rien n’attend votre intervention : aucun paiement échoué, aucune échéance du jour,
            aucune démo en attente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => onNavigate(c.to)}
                className="card p-3 text-left transition hover:-translate-y-0.5 hover:shadow-card-lg"
              >
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${TONES[c.tone]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-2 font-display text-xl font-bold text-content">{c.count}</p>
                <p className="text-xs text-content-muted">{c.label}</p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* --------------------------- État des abonnements (§11) --------------------------- */

function SubscriptionBreakdown({
  data,
  onNavigate,
}: {
  data: FounderOverview;
  onNavigate: (id: SectionId) => void;
}) {
  const s = data.subscriptions;
  const rows = [
    { label: 'Payants', count: s.paying, tone: 'success' as const },
    { label: 'En essai', count: s.trialing, tone: 'info' as const },
    { label: 'Expirés', count: s.expired, tone: 'danger' as const },
    { label: 'Suspendus', count: s.suspended, tone: 'warning' as const },
    { label: 'Annulés', count: s.cancelled, tone: 'neutral' as const },
  ];
  const total = Math.max(1, s.total);

  return (
    <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="État des abonnements">
      <div className="card p-4 lg:col-span-2">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="font-display text-base font-bold text-content">État des abonnements</h3>
          <button
            type="button"
            onClick={() => onNavigate('abonnements')}
            className="text-xs text-primary hover:underline"
          >
            Tout voir
          </button>
        </div>
        <p className="mb-3 text-xs text-content-faint">
          L’état est calculé, pas lu tel quel : un abonnement dont la période est terminée est
          « expiré », même si la base dit encore « actif ».
        </p>
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone={r.tone}>{r.label}</Badge>
                </span>
                <span className="font-semibold text-content">{r.count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={`h-full rounded-full ${BAR_TONES[r.tone]}`}
                  style={{ width: `${(r.count / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-display text-base font-bold text-content">Encours</h3>
        <dl className="space-y-2.5 text-sm">
          <Line2 label="Reste à encaisser" value={formatCurrency(data.revenue.outstanding)} tone="warning" />
          <Line2 label="Encaissé brut" value={formatCurrency(data.revenue.collected)} tone="success" />
          <Line2 label="Remboursé" value={formatCurrency(data.revenue.refunded)} />
          <Line2 label="Encaissé net" value={formatCurrency(data.revenue.net)} tone="success" />
          <Line2 label="Échéances sous 48 h" value={String(data.renewals.next48h)} />
        </dl>
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => onNavigate('factures')}
        >
          Ouvrir la facturation
        </Button>
      </div>
    </section>
  );
}

const BAR_TONES: Record<string, string> = {
  success: 'bg-[color:var(--success)]',
  info: 'bg-primary',
  danger: 'bg-[color:var(--danger)]',
  warning: 'bg-[color:var(--warning)]',
  neutral: 'bg-surface-3 ring-1 ring-line',
};

function Line2({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-content';
  return (
    <div className="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
      <dt className="text-content-muted">{label}</dt>
      <dd className={`font-display font-bold ${color}`}>{value}</dd>
    </div>
  );
}

/* ------------------------------- Graphiques (§9-10) ------------------------------- */

type Metric = 'revenue' | 'tenants' | 'users';

const METRICS: { key: Metric; label: string; color: string; money: boolean }[] = [
  { key: 'revenue', label: 'Revenus encaissés', color: '#0d9488', money: true },
  { key: 'tenants', label: 'Nouveaux établissements', color: '#7c3aed', money: false },
  { key: 'users', label: 'Nouveaux utilisateurs', color: '#2563eb', money: false },
];

function Charts({ data }: { data: FounderOverview }) {
  const [active, setActive] = useState<Metric[]>(['revenue']);

  const toggle = (m: Metric) =>
    setActive((prev) => {
      // Au moins une série reste affichée : un graphique vide ne dit rien de
      // plus qu'un graphique absent, et perd l'échelle de lecture.
      if (prev.includes(m)) return prev.length === 1 ? prev : prev.filter((x) => x !== m);
      return [...prev, m];
    });

  const empty = data.series.every((p) => p.revenue === 0 && p.tenants === 0 && p.users === 0);

  return (
    <section className="card mt-5 p-4" aria-label="Évolution">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-content">Évolution d’OculoSaaS</h3>
          <p className="text-xs text-content-faint">
            Jour par jour. Les jours sans évènement valent zéro et ne sont pas sautés.
          </p>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Séries affichées">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => toggle(m.key)}
              aria-pressed={active.includes(m.key)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                active.includes(m.key)
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <p className="py-16 text-center text-sm text-content-muted">
          Aucun mouvement sur cette période : il n’y a rien à représenter.
        </p>
      ) : (
        <div className="h-[280px]">
          <Line
            data={{
              labels: data.series.map((p) => p.date.slice(5)),
              datasets: METRICS.filter((m) => active.includes(m.key)).map((m) => ({
                label: m.label,
                data: data.series.map((p) => p[m.key]),
                borderColor: m.color,
                backgroundColor: (ctx: { chart: ChartJS }) => {
                  const { ctx: c, chartArea } = ctx.chart;
                  if (!chartArea) return `${m.color}22`;
                  const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                  g.addColorStop(0, `${m.color}33`);
                  g.addColorStop(1, `${m.color}00`);
                  return g;
                },
                fill: active.length === 1,
                tension: 0.35,
                borderWidth: 2,
                pointRadius: data.series.length > 45 ? 0 : 2,
                pointHoverRadius: 5,
                // Les montants et les décomptes n'ont pas la même échelle :
                // une courbe de revenus écraserait « 3 nouveaux comptes » à plat.
                yAxisID: m.money ? 'y' : 'yCount',
              })),
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: { legend: { display: active.length > 1, position: 'bottom' } },
              scales: {
                y: {
                  display: active.some((m) => m === 'revenue'),
                  beginAtZero: true,
                  position: 'left',
                  ticks: { callback: (v) => formatCurrency(Number(v)), maxTicksLimit: 5 },
                  grid: { color: 'rgba(148,163,184,0.18)' },
                },
                yCount: {
                  display: active.some((m) => m !== 'revenue'),
                  beginAtZero: true,
                  position: 'right',
                  ticks: { precision: 0, maxTicksLimit: 5 },
                  grid: { display: false },
                },
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12, autoSkip: true } },
              },
            }}
          />
        </div>
      )}
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="card h-28 animate-pulse bg-surface-2" />
      ))}
    </div>
  );
}
