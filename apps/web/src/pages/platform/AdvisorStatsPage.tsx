import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CreditCard, DollarSign, MessageCircle, MousePointerClick, PlayCircle, Users, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader, PageLoader, StatCard } from '../../components/ui';

type Stats = {
  days: number;
  opened: number;
  started: number;
  completed: number;
  abandoned: number;
  signupClicked: number;
  paymentStarted: number;
  paid: number;
  activated: number;
  plansShown: number;
  humanRequested: number;
  rates: { start: number; completion: number; signupClick: number; paidConversion: number };
  costUsd: number;
  costPerConversationUsd: number;
  costPerPaidUsd: number | null;
  topConcerns: { name: string; count: number }[];
  unanswered: string[];
};

const CONCERN: Record<string, string> = {
  prix: 'Prix',
  facilite: 'Facilité d’utilisation',
  securite: 'Sécurité des données',
  demarrage: 'Mise en route',
  multi_magasins: 'Plusieurs magasins',
  support: 'Support',
  reflexion: 'Besoin de réfléchir',
  autre: 'Autre',
};

/**
 * Conseiller commercial IA — performance (console fondateur).
 * Conversion = paiement confirmé par le prestataire (webhook), jamais un simple clic.
 */
export function AdvisorStatsPage() {
  const [days, setDays] = useState(30);
  const q = useQuery({
    queryKey: ['advisor-stats', days],
    queryFn: async () => (await api.get<Stats>('/platform/advisor/stats', { params: { days } })).data,
  });
  if (q.isLoading) return <PageLoader />;
  const s = q.data;
  return (
    <div>
      <PageHeader
        title="Conseiller IA"
        subtitle="Conversations du conseiller commercial vocal et conversion en abonnements payés"
        actions={
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Période">
            {[7, 30, 90, 365].map((d) => (
              <option key={d} value={d}>
                {d} derniers jours
              </option>
            ))}
          </select>
        }
      />
      {q.isError || !s ? (
        <p className="text-danger">Statistiques indisponibles.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={MessageCircle} label="Interfaces ouvertes" value={s.opened} hint={`${s.started} conversations démarrées (${s.rates.start} %)`} />
            <StatCard icon={PlayCircle} label="Conversations terminées" value={s.completed} hint={`${s.rates.completion} % des démarrées · ${s.abandoned} abandonnées`} tone="accent" />
            <StatCard icon={MousePointerClick} label="Clics vers l’inscription" value={s.signupClicked} hint={`${s.rates.signupClick} % des démarrées`} />
            <StatCard icon={BadgeCheck} label="Abonnements payés" value={s.paid} hint={`${s.rates.paidConversion} % des démarrées · paiement confirmé`} tone="success" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={CreditCard} label="Paiements commencés" value={s.paymentStarted} hint={`${s.activated} abonnements activés`} />
            <StatCard icon={Users} label="Demandes d’humain" value={s.humanRequested} hint={`${s.plansShown} affichages des forfaits`} tone="accent" />
            <StatCard icon={DollarSign} label="Coût IA estimé" value={`${s.costUsd.toFixed(2)} $`} hint={`${s.costPerConversationUsd.toFixed(4)} $ par conversation`} />
            <StatCard icon={DollarSign} label="Coût par abonné payé" value={s.costPerPaidUsd == null ? '—' : `${s.costPerPaidUsd.toFixed(2)} $`} tone="success" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-3 font-display text-lg font-bold">Préoccupations les plus fréquentes</h2>
              {s.topConcerns.length ? (
                <ul className="space-y-2">
                  {s.topConcerns.map((c) => (
                    <li key={c.name} className="flex items-center justify-between text-sm">
                      <span>{CONCERN[c.name] ?? c.name}</span>
                      <b>{c.count}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-content-muted">Aucune pour le moment.</p>
              )}
            </section>
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                <XCircle className="h-5 w-5 text-danger" /> Questions sans réponse
              </h2>
              {s.unanswered.length ? (
                <ul className="space-y-2 text-sm">
                  {s.unanswered.map((u, i) => (
                    <li key={i} className="rounded-lg bg-surface-2 px-3 py-2">
                      {u}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-content-muted">Aucune pour le moment.</p>
              )}
            </section>
          </div>
          <p className="text-xs text-content-faint">
            Les inscriptions de 3 ou 6 mois passent par la page d’inscription classique : elles ne sont pas rattachées à la conversation. Le coût est
            une estimation à partir des jetons consommés (tarif Claude Haiku). Aucune transcription n’est conservée.
          </p>
        </div>
      )}
    </div>
  );
}
