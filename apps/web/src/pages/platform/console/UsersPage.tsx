import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  Pause,
  Play,
  Power,
  Receipt,
  Search,
  Users as UsersIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  DropdownMenu,
  EmptyState,
  PageLoader,
  type DropdownItem,
} from '../../../components/ui';
import { apiErrorMessage } from '../../../lib/api';
import { formatDateTime } from '../../../lib/format';
import { useToast } from '../../../components/Toast';
import {
  forceLogoutUser,
  platformReactivate,
  platformResetPassword,
  platformSuspend,
  setUserActive,
  type PlatformUser,
} from '../../../features/billing/api';
import {
  SUB_STATE_META,
  listConsoleUsers,
  type ConsoleUser,
} from '../../../features/billing/console';
import {
  ActivateSubscriptionModal,
  ChangeEmailModal,
  ExtendTrialModal,
  PlatformResetPasswordModal,
} from './modals';
import { ContactWhatsappModal, type WhatsappContact } from './ContactWhatsappModal';
import { LiveActivity, ago } from './LiveActivity';
import { Avatar } from '../../../components/Avatar';

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'online', label: '🟢 En ligne' },
  { id: 'paying', label: 'Payants' },
  { id: 'trialing', label: 'En essai' },
  { id: 'expired', label: 'Expirés' },
  { id: 'suspended', label: 'Suspendus' },
  { id: 'active', label: 'Comptes actifs' },
  { id: 'inactive', label: 'Comptes inactifs' },
] as const;

const PAGE_SIZE = 25;

/**
 * Utilisateurs de la plateforme (§13, §28).
 *
 * Deux corrections structurelles par rapport à la version précédente :
 *
 *  1. La recherche, les filtres et la pagination sont faits par le SERVEUR.
 *     Avant, 200 comptes étaient rapatriés puis filtrés dans le navigateur :
 *     au-delà de ce plafond, un compte n'existait simplement pas pour la
 *     console, et la recherche ne pouvait pas le trouver.
 *  2. La colonne d'actions était une grille de six boutons large de 250 px, qui
 *     débordait et se faisait couper. Elle devient un menu « ••• » : la largeur
 *     du tableau ne dépend plus du nombre d'actions disponibles.
 */
export function ConsoleUsersPage({
  onOpenTenant,
  onOpenBilling,
}: {
  onOpenTenant: (tenantId: string) => void;
  onOpenBilling: (tenantId: string) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'activity' | 'recent'>('activity');

  const [activating, setActivating] = useState<{ tenantId: string; tenantName: string; planCode: string | null } | null>(null);
  const [extending, setExtending] = useState<{ tenantId: string; tenantName: string } | null>(null);
  const [resetResult, setResetResult] = useState<{ user: PlatformUser; tempPassword: string } | null>(null);
  const [editingEmail, setEditingEmail] = useState<ConsoleUser | null>(null);
  const [contacting, setContacting] = useState<WhatsappContact | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, filter, sort]);

  // Rafraîchie toutes les 30 s : les pastilles « en ligne » restent à jour.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['console-users', debounced, filter, page, sort],
    queryFn: () => listConsoleUsers({ search: debounced || undefined, filter, page, pageSize: PAGE_SIZE, sort }),
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['console-users'] });
    void qc.invalidateQueries({ queryKey: ['platform-overview'] });
    void qc.invalidateQueries({ queryKey: ['platform-stats'] });
    void qc.invalidateQueries({ queryKey: ['console-tenants'] });
  };

  const activeMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setUserActive(id, isActive),
    onSuccess: (_r, v) => {
      invalidate();
      toast.success(v.isActive ? 'Compte réactivé' : 'Compte désactivé');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const logoutMut = useMutation({
    mutationFn: forceLogoutUser,
    onSuccess: () => toast.success('Sessions révoquées : l’utilisateur devra se reconnecter'),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const resetPasswordMut = useMutation({
    mutationFn: platformResetPassword,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const suspendMut = useMutation({
    mutationFn: platformSuspend,
    onSuccess: () => {
      invalidate();
      toast.success('Abonnement suspendu');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const reactivateMut = useMutation({
    mutationFn: platformReactivate,
    onSuccess: () => {
      invalidate();
      toast.success('Abonnement réactivé');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rows = data?.users ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function actionsFor(u: ConsoleUser): DropdownItem[] {
    const items: DropdownItem[] = [
      { label: "Voir l'établissement", icon: Building2, onClick: () => onOpenTenant(u.tenantId) },
      { label: 'Facturation du client', icon: Receipt, onClick: () => onOpenBilling(u.tenantId) },
    ];
    if (u.phone) {
      items.push({
        label: 'Envoyer un WhatsApp',
        icon: MessageCircle,
        onClick: () =>
          setContacting({
            name: u.name,
            tenantName: u.tenantName,
            phone: u.phone,
            email: u.email,
            planName: u.planName,
            endsAt: u.subscriptionEndsAt,
            state: u.state,
            lastLoginAt: u.lastLoginAt,
          }),
      });
    }
    items.push({
      label: "Régler la durée d'essai",
      icon: Clock,
      onClick: () => setExtending({ tenantId: u.tenantId, tenantName: u.tenantName }),
    });

    if (u.state === 'paying') {
      items.push({
        label: "Prolonger l'abonnement",
        icon: BadgeCheck,
        onClick: () => setActivating({ tenantId: u.tenantId, tenantName: u.tenantName, planCode: u.planCode }),
      });
      items.push({
        label: "Suspendre l'abonnement",
        icon: Pause,
        variant: 'danger',
        onClick: () => {
          if (confirm(`Suspendre l'abonnement de ${u.tenantName} ? L'accès au logiciel sera coupé.`))
            suspendMut.mutate(u.tenantId);
        },
      });
    } else {
      if (u.subscriptionStatus === 'SUSPENDED') {
        items.push({
          label: "Réactiver l'abonnement",
          icon: Play,
          onClick: () => reactivateMut.mutate(u.tenantId),
        });
      }
      items.push({
        label: "Activer l'abonnement",
        icon: BadgeCheck,
        onClick: () => setActivating({ tenantId: u.tenantId, tenantName: u.tenantName, planCode: u.planCode }),
      });
    }

    items.push({
      label: "Modifier l'email",
      icon: Mail,
      onClick: () => setEditingEmail(u),
    });
    items.push({
      label: 'Réinitialiser le mot de passe',
      icon: KeyRound,
      onClick: () => {
        if (
          confirm(
            `Générer un nouveau mot de passe temporaire pour ${u.name} ? Ses sessions actives seront déconnectées.`,
          )
        ) {
          resetPasswordMut.mutate(u.id, {
            onSuccess: (res) =>
              setResetResult({ user: u as unknown as PlatformUser, tempPassword: res.tempPassword }),
          });
        }
      },
    });
    items.push({
      label: 'Déconnecter les sessions',
      icon: LogOut,
      onClick: () => {
        if (confirm(`Révoquer toutes les sessions de ${u.name} ?`)) logoutMut.mutate(u.id);
      },
    });
    items.push({
      label: u.isActive ? 'Désactiver le compte' : 'Réactiver le compte',
      icon: Power,
      variant: u.isActive ? 'danger' : 'default',
      onClick: () => {
        if (
          !u.isActive ||
          confirm(`Désactiver le compte de ${u.name} ? Il ne pourra plus se connecter.`)
        ) {
          activeMut.mutate({ id: u.id, isActive: !u.isActive });
        }
      },
    });
    return items;
  }

  return (
    <div>
      <LiveActivity onFilterOnline={() => setFilter('online')} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder="Nom, e-mail, téléphone, établissement…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as 'activity' | 'recent')} aria-label="Trier">
          <option value="activity">Dernière connexion d'abord</option>
          <option value="recent">Inscription la plus récente</option>
        </select>
        <span className="text-sm text-content-muted">
          {total} compte{total > 1 ? 's' : ''}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrer les comptes">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded-lg px-2.5 py-1.5 text-sm transition ${
              filter === f.id ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Aucun compte" hint="Aucun compte ne correspond à cette recherche ou à ce filtre." />
      ) : (
        <div className="card">
          <div className={`transition-opacity ${isFetching ? 'opacity-80' : ''}`}>
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-content-faint">
                  <th className="table-cell font-semibold">Utilisateur</th>
                  <th className="table-cell hidden font-semibold md:table-cell">Établissement</th>
                  <th className="table-cell font-semibold">Abonnement</th>
                  <th className="table-cell hidden font-semibold lg:table-cell">Échéance</th>
                  <th className="table-cell font-semibold">Activité</th>
                  <th className="table-cell w-12 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const [first, ...rest] = u.name.split(' ');
                  const ends = u.subscriptionEndsAt ? new Date(u.subscriptionEndsAt).getTime() : null;
                  const days = ends !== null ? Math.ceil((ends - Date.now()) / 86_400_000) : null;
                  const endTone = days === null ? 'text-content-faint' : days < 0 ? 'text-danger' : days <= 7 ? 'text-warning' : 'text-content-muted';
                  const endText = days === null ? '—' : days < 0 ? `expiré depuis ${-days} j` : days === 0 ? "expire aujourd'hui" : `dans ${days} j`;
                  const last = u.lastActiveAt ?? u.lastLoginAt;
                  return (
                    <tr key={u.id} className="group border-b transition-colors last:border-0 hover:bg-primary-soft/30">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <span className="relative shrink-0">
                            <Avatar firstName={first} lastName={rest.join(' ')} className="h-10 w-10 rounded-full text-xs" />
                            {u.online && (
                              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
                                <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-surface bg-success" />
                              </span>
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-content">
                              {u.name}
                              {!u.isActive && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-content-muted">désactivé</span>}
                            </p>
                            <p className="truncate text-xs text-content-faint">{u.email}</p>
                            <p className="truncate text-xs text-content-faint md:hidden">{u.tenantName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell hidden md:table-cell">
                        <button type="button" onClick={() => onOpenTenant(u.tenantId)} className="block max-w-[220px] truncate text-left font-medium text-content hover:text-primary hover:underline">
                          {u.tenantName}
                        </button>
                        <p className="text-xs text-content-faint">
                          {u.roleLabel}
                          {u.phone ? ` · ${u.phone}` : ''}
                        </p>
                      </td>
                      <td className="table-cell">
                        <div className="flex flex-col items-start gap-1">
                          {u.state ? (
                            <Badge tone={SUB_STATE_META[u.state].tone}>{SUB_STATE_META[u.state].label}</Badge>
                          ) : (
                            <Badge tone="neutral">Aucun</Badge>
                          )}
                          {u.planName && <span className="text-xs font-medium text-content-muted">{u.planName}</span>}
                        </div>
                      </td>
                      <td className="table-cell hidden lg:table-cell">
                        <p className={`text-sm font-medium ${endTone}`}>{endText}</p>
                        {u.subscriptionEndsAt && <p className="text-xs text-content-faint">{formatDateTime(u.subscriptionEndsAt)}</p>}
                      </td>
                      <td className="table-cell">
                        {u.online ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--success)]/12 px-2.5 py-1 text-xs font-semibold text-success">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> En ligne
                          </span>
                        ) : last ? (
                          <div title={formatDateTime(last)}>
                            <p className="text-sm font-medium text-content">{ago(last)}</p>
                            <p className="text-xs text-content-faint">{formatDateTime(last)}</p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[color:var(--warning)]/15 px-2.5 py-1 text-xs font-semibold text-warning">Jamais connecté</span>
                        )}
                      </td>
                      <td className="table-cell text-right">
                        <DropdownMenu items={actionsFor(u)} />
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
                <Button variant="outline" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Page précédente">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} aria-label="Page suivante">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {extending && (
        <ExtendTrialModal
          sub={extending}
          onClose={() => setExtending(null)}
          onDone={() => {
            setExtending(null);
            invalidate();
            toast.success('Essai reconduit');
          }}
        />
      )}
      {activating && (
        <ActivateSubscriptionModal
          sub={activating}
          onClose={() => setActivating(null)}
          onDone={() => {
            setActivating(null);
            invalidate();
            toast.success('Abonnement activé');
          }}
        />
      )}
      {contacting && <ContactWhatsappModal contact={contacting} onClose={() => setContacting(null)} />}
      {editingEmail && (
        <ChangeEmailModal
          user={editingEmail}
          onClose={() => setEditingEmail(null)}
          onDone={(email) => {
            setEditingEmail(null);
            invalidate();
            toast.success(`Email modifié : ${email}`);
          }}
        />
      )}
      {resetResult && (
        <PlatformResetPasswordModal
          user={resetResult.user}
          tempPassword={resetResult.tempPassword}
          onClose={() => setResetResult(null)}
        />
      )}
    </div>
  );
}
