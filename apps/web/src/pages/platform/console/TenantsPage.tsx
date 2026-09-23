import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Receipt,
  Search,
  Users as UsersIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  DropdownMenu,
  EmptyState,
  Modal,
  PageLoader,
  Spinner,
  type DropdownItem,
} from '../../../components/ui';
import { formatCurrency, formatDate, formatDateTime } from '../../../lib/format';
import {
  SUB_STATE_META,
  getConsoleTenant,
  listConsoleTenants,
  type RealSubState,
} from '../../../features/billing/console';

const STATES: { id: RealSubState | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'paying', label: 'Payants' },
  { id: 'trialing', label: 'En essai' },
  { id: 'expired', label: 'Expirés' },
  { id: 'suspended', label: 'Suspendus' },
  { id: 'cancelled', label: 'Annulés' },
];

const PAGE_SIZE = 25;

/**
 * Établissements (§15).
 *
 * C'est l'écran qui manquait : la console ne savait parler que d'utilisateurs,
 * alors que le client d'OculoSaaS est l'établissement. Un établissement peut
 * avoir dix comptes et un seul abonnement ; les compter ensemble donnait une
 * lecture fausse du parc.
 */
export function ConsoleTenantsPage({
  onOpenBilling,
  openTenantId,
  onCloseTenant,
  onOpenTenant,
}: {
  onOpenBilling: (tenantId: string) => void;
  openTenantId: string | null;
  onCloseTenant: () => void;
  onOpenTenant: (tenantId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [state, setState] = useState<RealSubState | 'all'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, state]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['console-tenants', debounced, state, page],
    queryFn: () =>
      listConsoleTenants({ search: debounced || undefined, state, page, pageSize: PAGE_SIZE }),
  });

  const rows = data?.tenants ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder="Nom, identifiant, e-mail, WhatsApp…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-content-muted">
          {total} établissement{total > 1 ? 's' : ''}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par état">
        {STATES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setState(s.id)}
            aria-pressed={state === s.id}
            className={`rounded-lg px-2.5 py-1.5 text-sm transition ${
              state === s.id
                ? 'bg-primary text-white'
                : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState icon={Building2} title="Aucun établissement" hint="Aucun résultat pour ce filtre." />
      ) : (
        <div className="card overflow-hidden">
          <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">Établissement</th>
                  <th className="table-cell font-semibold">Contact</th>
                  <th className="table-cell text-right font-semibold">Comptes</th>
                  <th className="table-cell font-semibold">Offre</th>
                  <th className="table-cell text-right font-semibold">MRR</th>
                  <th className="table-cell font-semibold">Abonnement</th>
                  <th className="table-cell font-semibold">Échéance</th>
                  <th className="table-cell w-12 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const items: DropdownItem[] = [
                    { label: 'Ouvrir la fiche', icon: Building2, onClick: () => onOpenTenant(t.id) },
                    { label: 'Facturation', icon: Receipt, onClick: () => onOpenBilling(t.id) },
                  ];
                  if (t.whatsapp) {
                    items.push({
                      label: 'Envoyer un WhatsApp',
                      icon: MessageCircle,
                      onClick: () =>
                        window.open(
                          `https://wa.me/${t.whatsapp!.replace(/[^0-9]/g, '')}`,
                          '_blank',
                          'noopener,noreferrer',
                        ),
                    });
                  }
                  return (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-surface-2/50">
                      <td className="table-cell">
                        <button
                          type="button"
                          onClick={() => onOpenTenant(t.id)}
                          className="text-left font-medium text-content hover:text-primary hover:underline"
                        >
                          {t.name}
                        </button>
                        <div className="text-xs text-content-faint">
                          Inscrit le {formatDate(t.createdAt)}
                          {t.country ? ` · ${t.country}` : ''}
                        </div>
                      </td>
                      <td className="table-cell text-content-muted">
                        <div>{t.whatsapp ?? '—'}</div>
                        <div className="text-xs text-content-faint">{t.email ?? ''}</div>
                      </td>
                      <td className="table-cell text-right text-content-muted">{t.userCount}</td>
                      <td className="table-cell text-content-muted">{t.planName ?? '—'}</td>
                      <td className="table-cell text-right font-semibold text-content">
                        {t.mrr > 0 ? formatCurrency(t.mrr) : '—'}
                      </td>
                      <td className="table-cell">
                        {t.state ? (
                          <Badge tone={SUB_STATE_META[t.state].tone}>
                            {SUB_STATE_META[t.state].label}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Aucun</Badge>
                        )}
                      </td>
                      <td className="table-cell text-content-muted">
                        {t.currentPeriodEnd ? formatDate(t.currentPeriodEnd) : '—'}
                      </td>
                      <td className="table-cell text-right">
                        <DropdownMenu items={items} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
              <span className="text-content-muted">
                Page {page} sur {pageCount}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Page précédente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Page suivante"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {openTenantId && (
        <TenantDetailModal
          tenantId={openTenantId}
          onClose={onCloseTenant}
          onOpenBilling={onOpenBilling}
        />
      )}
    </div>
  );
}

/** Fiche établissement : ce que la console sait réellement, sans agrégat inventé. */
export function TenantDetailModal({
  tenantId,
  onClose,
  onOpenBilling,
}: {
  tenantId: string;
  onClose: () => void;
  onOpenBilling: (tenantId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['console-tenant', tenantId],
    queryFn: () => getConsoleTenant(tenantId),
  });

  return (
    <Modal open onClose={onClose} title={data ? data.name : 'Établissement'} size="xl">
      {isLoading || !data ? (
        <div className="py-12 text-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl bg-surface-2 p-4 lg:col-span-2">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">
                Identité
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Cell label="Identifiant" value={data.slug} />
                <Cell label="WhatsApp" value={data.whatsapp ?? '—'} />
                <Cell label="E-mail" value={data.email ?? '—'} />
                <Cell label="Pays" value={data.country ?? '—'} />
                <Cell label="Adresse" value={data.location ?? '—'} />
                <Cell label="Inscrit le" value={formatDate(data.createdAt)} />
                <Cell label="Comptes" value={String(data.users.length)} />
                <Cell label="Magasins" value={String(data.branches.length)} />
                <Cell label="Devise" value={data.currency} />
              </div>
            </div>

            <div className="rounded-xl bg-surface-2 p-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">
                Abonnement
              </h4>
              {!data.subscription ? (
                <p className="text-sm text-content-muted">Aucun abonnement rattaché.</p>
              ) : (
                <dl className="space-y-1.5 text-sm">
                  <Row label="Offre" value={data.subscription.planName} />
                  <Row
                    label="Prix"
                    value={`${formatCurrency(data.subscription.priceMonthly)}/mois`}
                  />
                  <div className="flex items-center justify-between">
                    <dt className="text-content-muted">État</dt>
                    <dd>
                      <Badge tone={SUB_STATE_META[data.subscription.state].tone}>
                        {SUB_STATE_META[data.subscription.state].label}
                      </Badge>
                    </dd>
                  </div>
                  <Row label="Échéance" value={formatDate(data.subscription.currentPeriodEnd)} />
                  <Row
                    label="MRR généré"
                    value={data.mrr > 0 ? formatCurrency(data.mrr) : '0'}
                  />
                </dl>
              )}
              <Button className="mt-4 w-full" onClick={() => onOpenBilling(data.id)}>
                <Receipt className="h-4 w-4" /> Ouvrir la facturation
              </Button>
            </div>
          </div>

          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-content-faint">
              <UsersIcon className="h-3.5 w-3.5" /> Comptes de l’établissement
            </h4>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-content-faint">
                    <th className="px-3 py-2 font-semibold">Nom</th>
                    <th className="px-3 py-2 font-semibold">Rôle</th>
                    <th className="px-3 py-2 font-semibold">Téléphone</th>
                    <th className="px-3 py-2 font-semibold">Dernière connexion</th>
                    <th className="px-3 py-2 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <div className="text-content">{u.name}</div>
                        <div className="text-xs text-content-faint">{u.email}</div>
                      </td>
                      <td className="px-3 py-2 text-content-muted">{u.roleLabel}</td>
                      <td className="px-3 py-2 text-content-muted">{u.phone ?? '—'}</td>
                      <td className="px-3 py-2 text-content-muted">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Jamais'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={u.isActive ? 'success' : 'neutral'}>
                          {u.isActive ? 'Actif' : 'Désactivé'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-content-faint">{label}</p>
      <p className="mt-0.5 truncate font-medium text-content">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-content-muted">{label}</dt>
      <dd className="font-medium text-content">{value}</dd>
    </div>
  );
}
