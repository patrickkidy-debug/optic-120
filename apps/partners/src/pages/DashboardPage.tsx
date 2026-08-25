import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Clock, BadgeCheck, Building2, TrendingUp, Copy, Check } from 'lucide-react';
import { getDashboard } from '../lib/partnerApi';
import { usePartnerAuthStore } from '../store/auth';
import { formatCurrency } from '../lib/format';
import { StatCard, PageLoader } from '../components/ui';

const PERIODS = [
  { label: "Aujourd'hui", days: 1 },
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: '3 mois', days: 90 },
  { label: 'Cette année', days: 365 },
  { label: 'Tout', days: undefined },
];

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

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-content">
        Bonjour {partner?.firstName} 👋
      </h1>
      <p className="mt-1 text-sm text-content-muted">Voici vos performances OculoPartners.</p>

      {partner && (
        <div className="mt-4 card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-content-faint">Votre lien de parrainage</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 text-sm text-content">
              {partner.referralLink}
            </code>
            <button onClick={copyLink} className="btn-outline h-9 shrink-0 rounded-lg px-3 text-xs">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-content-faint">Code : {partner.referralCode}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
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

      {isLoading || !data ? (
        <div className="mt-6">
          <PageLoader />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard
            icon={Wallet}
            label="Commissions payées"
            value={formatCurrency(data.commissionPaid, data.currency)}
            tone="success"
          />
          <StatCard
            icon={Clock}
            label="En attente"
            value={formatCurrency(data.commissionPending, data.currency)}
            tone="accent"
          />
          <StatCard icon={Building2} label="Clients apportés" value={data.customersTotal} />
          <StatCard
            icon={BadgeCheck}
            label="Clients actifs"
            value={data.customersActive}
            tone="success"
          />
          <StatCard
            icon={TrendingUp}
            label="Taux de conversion"
            value={`${data.conversionRatePct}%`}
            hint={`${data.leadsTotal} prospect(s)`}
          />
          <StatCard
            icon={Wallet}
            label="Total généré"
            value={formatCurrency(data.commissionTotal, data.currency)}
          />
        </div>
      )}
    </div>
  );
}
