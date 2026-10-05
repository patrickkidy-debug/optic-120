import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, LogIn, Monitor, Smartphone, UserX, Users as UsersIcon, Wifi } from 'lucide-react';
import { getUsersActivity, type UsersActivity } from '../../../features/billing/console';
import { Avatar } from '../../../components/Avatar';
import { useToast } from '../../../components/Toast';
import { formatDateTime } from '../../../lib/format';

/** « à l'instant », « il y a 4 min », « il y a 2 h », « hier »… */
export function ago(iso?: string | null): string {
  if (!iso) return 'Jamais';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `il y a ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86_400);
  if (d === 1) return 'hier';
  if (d < 30) return `il y a ${d} j`;
  if (d < 365) return `il y a ${Math.floor(d / 30)} mois`;
  return `il y a ${Math.floor(d / 365)} an(s)`;
}

const split = (name: string) => {
  const [first, ...rest] = name.split(' ');
  return { first, last: rest.join(' ') };
};

/**
 * Activité en direct : rafraîchie toutes les 15 s. Une nouvelle connexion
 * déclenche une notification dans la console.
 */
export function LiveActivity({ onFilterOnline }: { onFilterOnline: () => void }) {
  const toast = useToast();
  const { data } = useQuery({
    queryKey: ['console-users-activity'],
    queryFn: getUsersActivity,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
  const lastSeen = useRef<string | null>(null);
  const [, tick] = useState(0);
  // Les « il y a … » se mettent à jour même entre deux rafraîchissements.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const first = data?.recentLogins[0];
    if (!first) return;
    if (lastSeen.current && lastSeen.current !== first.id) {
      toast.info(`🟢 ${first.name} vient de se connecter${first.tenantName ? ` — ${first.tenantName}` : ''}`);
    }
    lastSeen.current = first.id;
  }, [data, toast]);

  return (
    <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            icon={Wifi}
            label="En ligne maintenant"
            value={data?.onlineCount}
            tone="success"
            live
            onClick={onFilterOnline}
            hint="Voir qui"
          />
          <Kpi icon={LogIn} label="Connexions aujourd'hui" value={data?.loginsToday} />
          <Kpi icon={Activity} label="Actifs sur 24 h" value={data?.active24h} />
          <Kpi icon={UserX} label="Jamais connectés" value={data?.neverLogged} tone="warning" />
        </div>
        <OnlineStrip data={data} />
      </div>

      <section className="card flex max-h-[300px] flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-content">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            Connexions en direct
          </h3>
          <span className="text-[11px] text-content-faint">actualisé toutes les 15 s</span>
        </header>
        <ul className="flex-1 divide-y overflow-y-auto">
          {!data ? (
            Array.from({ length: 4 }).map((_, i) => <li key={i} className="m-3 h-10 animate-pulse rounded-lg bg-surface-2" />)
          ) : data.recentLogins.length === 0 ? (
            <li className="p-4 text-sm text-content-muted">Aucune connexion enregistrée.</li>
          ) : (
            data.recentLogins.map((l, i) => {
              const n = split(l.name);
              const mobile = /iPhone|Android|iPad/.test(l.device ?? '');
              return (
                <li key={l.id} className={`flex items-center gap-3 px-4 py-2.5 ${i === 0 ? 'bg-[color:var(--success)]/5' : ''}`}>
                  <Avatar firstName={n.first} lastName={n.last} className="h-8 w-8 shrink-0 rounded-full text-[10px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content">{l.name}</p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-content-faint">
                      {mobile ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                      {[l.tenantName, l.device, l.method === 'google' ? 'Google' : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-[11px] text-content-muted" title={formatDateTime(l.at)}>
                    {ago(l.at)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}

function OnlineStrip({ data }: { data?: UsersActivity }) {
  if (!data) return <div className="card h-[88px] animate-pulse" />;
  return (
    <div className="card px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-content-faint">
        <UsersIcon className="h-3.5 w-3.5" /> En ligne maintenant
      </p>
      {data.online.length === 0 ? (
        <p className="text-sm text-content-muted">Personne n'utilise le logiciel en ce moment.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.online.map((u) => {
            const n = split(u.name);
            return (
              <span key={u.id} className="inline-flex items-center gap-2 rounded-full border bg-surface py-1 pl-1 pr-3 text-xs" title={u.lastSeenAt ? `Actif ${ago(u.lastSeenAt)}` : undefined}>
                <span className="relative">
                  <Avatar firstName={n.first} lastName={n.last} className="h-6 w-6 rounded-full text-[9px]" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" />
                </span>
                <span className="font-medium text-content">{u.name}</span>
                <span className="text-content-faint">· {u.tenantName}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
  live,
  hint,
  onClick,
}: {
  icon: typeof Wifi;
  label: string;
  value?: number;
  tone?: 'success' | 'warning';
  live?: boolean;
  hint?: string;
  onClick?: () => void;
}) {
  const color = tone === 'success' ? 'bg-[color:var(--success)]/12 text-success' : tone === 'warning' ? 'bg-[color:var(--warning)]/15 text-warning' : 'bg-primary-soft text-primary';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`card p-4 text-left ${onClick ? 'transition hover:-translate-y-0.5 hover:shadow-card-lg' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-content-muted">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {value === undefined ? (
        <div className="mt-2 h-7 w-10 animate-pulse rounded bg-surface-2" />
      ) : (
        <p className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-content">
          {value}
          {live && value > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-success" />}
        </p>
      )}
      {hint && onClick && <p className="text-[11px] text-primary">{hint} →</p>}
    </Tag>
  );
}
