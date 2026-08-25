import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Link as LinkIcon,
  Copy,
  Check,
  MessageCircle,
  Wallet,
  Clock,
  Building2,
  BadgeCheck,
  Percent,
  Star,
  Filter,
  LineChart,
  Gift,
} from 'lucide-react';
import { getDashboard } from '../lib/partnerApi';
import { usePartnerAuthStore } from '../store/auth';
import { formatCurrency } from '../lib/format';
import { PageLoader } from '../components/ui';

const PERIODS = [
  { label: "Aujourd'hui", days: 1 },
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: '3 mois', days: 90 },
  { label: 'Cette année', days: 365 },
  { label: 'Tout', days: undefined },
];

const TIER_LABEL: Record<string, string> = {
  AMBASSADOR: 'Ambassador',
  PARTNER_PRO: 'Partner Pro',
  PARTNER_EXPERT: 'Partner Expert',
};

function shareMessage(link: string): string {
  return (
    `OculoSaaS : le logiciel tout-en-un pour gérer votre optique — caisse, stocks, ` +
    `patients, paiements Mobile Money et rapports. À partir de 7 500 FCFA/mois.\n\n${link}`
  );
}

export function DashboardPage() {
  const partner = usePartnerAuthStore((s) => s.partner);
  const [days, setDays] = useState<number | undefined>(undefined);
  const { data, isLoading } = useQuery({
    queryKey: ['partner-dashboard', days],
    queryFn: () => getDashboard(days),
  });
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!partner) return;
    navigator.clipboard.writeText(partner.referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!partner) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div>
        <h1 className="font-display text-2xl font-bold text-content-heading sm:text-3xl">
          Bonjour {partner.firstName} 👋
        </h1>
        <p className="mt-1 text-content-muted">Voici votre performance OculoPartners.</p>
      </div>

      {/* Lien de parrainage + revenus */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="gradient-border-card p-6 lg:col-span-8">
          <div className="mb-2 flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold text-content">Votre lien partenaire</h3>
          </div>
          <p className="mb-5 text-sm text-content-muted">
            Chaque inscription provenant de ce lien est automatiquement associée à votre compte.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center justify-between gap-2 rounded-lg border bg-bg-subtle px-3 py-2.5">
              <code className="truncate text-sm text-content">{partner.referralLink}</code>
              <button onClick={copyLink} className="shrink-0 text-primary transition hover:text-primary-hover" title="Copier">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareMessage(partner.referralLink))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn shrink-0 bg-[#25D366] text-white hover:bg-[#1ebe57]"
            >
              <MessageCircle className="h-4 w-4" /> Partager
            </a>
          </div>
          <p className="mt-3 text-xs text-content-faint">Code : {partner.referralCode}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border bg-surface p-6 lg:col-span-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          <p className="text-sm text-content-muted">Vos revenus</p>
          {isLoading || !data ? (
            <div className="mt-2 h-9 w-32 animate-pulse rounded bg-surface-3" />
          ) : (
            <p className="mt-1 font-display text-3xl font-extrabold text-content-heading">
              {formatCurrency(data.commissionTotal, data.currency)}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4">
            <div>
              <p className="text-xs text-content-faint">Payées</p>
              <p className="font-semibold text-content">{data ? formatCurrency(data.commissionPaid, data.currency) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-content-faint">En attente</p>
              <p className="font-semibold text-accent">{data ? formatCurrency(data.commissionPending, data.currency) : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtre de période */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Filter className="h-3.5 w-3.5 text-content-faint" />
        {PERIODS.map((p) => (
          <button
            key={p.label}
            onClick={() => setDays(p.days)}
            className={`badge px-3 py-1.5 text-xs ${
              days === p.days ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Statistiques */}
      {isLoading || !data ? (
        <PageLoader />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile icon={Building2} tone="primary" label="Prospects" value={data.leadsTotal} />
          <StatTile icon={BadgeCheck} tone="secondary" label="Clients apportés" value={data.customersTotal} />
          <StatTile icon={Star} tone="success" label="Clients actifs" value={data.customersActive} />
          <StatTile icon={Percent} tone="accent" label="Conversion" value={`${data.conversionRatePct}%`} />
          <StatTile
            icon={Wallet}
            tone="primary"
            label="Total généré"
            value={formatCurrency(data.commissionTotal, data.currency)}
            wide
          />
        </div>
      )}

      {/* Niveau + analytics à venir */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-2xl border bg-surface p-6 lg:col-span-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">
              <Star className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-content-faint">Niveau actuel</p>
              <p className="font-display font-bold text-content">{TIER_LABEL[partner.tier] ?? partner.tier}</p>
            </div>
          </div>
          <p className="text-sm text-content-muted">
            Le niveau détermine votre taux de commission. Apportez plus de clients actifs pour
            progresser — les paliers seront bientôt visibles ici.
          </p>
        </div>

        <ComingSoonCard
          icon={LineChart}
          title="Tunnel de conversion & performances"
          description="Clics sur votre lien, prospects, inscriptions, clients — le détail de votre entonnoir et son évolution dans le temps arrivent prochainement."
          className="lg:col-span-8"
        />
      </div>

      <ComingSoonCard
        icon={Gift}
        title="Objectifs & bonus"
        description="Des paliers de bonus (ex. +10 000 FCFA à 5 clients) récompenseront bientôt votre volume, en plus de la commission par client."
      />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  wide,
}: {
  icon: typeof Wallet;
  label: string;
  value: string | number;
  tone: 'primary' | 'secondary' | 'success' | 'accent';
  wide?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    primary: 'bg-primary-soft text-primary',
    secondary: 'bg-secondary-soft text-secondary',
    success: 'bg-[color:var(--success)]/15 text-success',
    accent: 'bg-accent-soft text-accent',
  };
  return (
    <div className={`rounded-xl border bg-surface p-4 transition hover:border-line-strong ${wide ? 'col-span-2' : ''}`}>
      <span className={`mb-3 grid h-8 w-8 place-items-center rounded-full ${toneClasses[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm text-content-muted">{label}</p>
      <p className="font-display text-xl font-bold text-content">{value}</p>
    </div>
  );
}

function ComingSoonCard({
  icon: Icon,
  title,
  description,
  className = '',
}: {
  icon: typeof LineChart;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-dashed bg-surface/50 p-6 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-3 text-content-faint">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-display font-bold text-content">{title}</h4>
            <span className="badge bg-surface-3 text-content-faint">Bientôt disponible</span>
          </div>
          <p className="mt-1 text-sm text-content-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
