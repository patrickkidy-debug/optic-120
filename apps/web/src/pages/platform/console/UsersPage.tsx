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
import { ActivateSubscriptionModal, ExtendTrialModal, PlatformResetPasswordModal } from './modals';

const FILTERS = [
  { id: 'all', label: 'Tous' },
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

  const [activating, setActivating] = useState<{ tenantId: string; tenantName: string; planCode: string | null } | null>(null);
  const [extending, setExtending] = useState<{ tenantId: string; tenantName: string } | null>(null);
  const [resetResult, setResetResult] = useState<{ user: PlatformUser; tempPassword: string } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, filter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['console-users', debounced, filter, page],
    queryFn: () => listConsoleUsers({ search: debounced || undefined, filter, page, pageSize: PAGE_SIZE }),
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
        onClick: () => {
          const digits = u.phone!.replace(/[^0-9]/g, '');
          const text = `Bonjour ${u.name}, ici l'équipe OculoSaaS.`;
          window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
        },
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder="Nom, e-mail, téléphone, établissement…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
              filter === f.id
                ? 'bg-primary text-white'
                : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Aucun compte"
          hint="Aucun compte ne correspond à cette recherche ou à ce filtre."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">Utilisateur</th>
                  <th className="table-cell font-semibold">Établissement</th>
                  <th className="table-cell font-semibold">Téléphone</th>
                  <th className="table-cell font-semibold">Offre</th>
                  <th className="table-cell font-semibold">Abonnement</th>
                  <th className="table-cell font-semibold">Échéance</th>
                  <th className="table-cell font-semibold">Dernière connexion</th>
                  {/* Largeur fixe et minimale : le menu tient dans un bouton,
                      la colonne ne peut plus être poussée hors de l'écran. */}
                  <th className="table-cell w-12 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell">
                      <div className="font-medium text-content">{u.name}</div>
                      <div className="text-xs text-content-faint">{u.email}</div>
                      {!u.isActive && (
                        <Badge tone="neutral">Compte désactivé</Badge>
                      )}
                    </td>
                    <td className="table-cell">
                      <button
                        type="button"
                        onClick={() => onOpenTenant(u.tenantId)}
                        className="text-left text-content-muted hover:text-primary hover:underline"
                      >
                        {u.tenantName}
                      </button>
                      <div className="text-xs text-content-faint">{u.roleLabel}</div>
                    </td>
                    <td className="table-cell text-content-muted">{u.phone ?? '—'}</td>
                    <td className="table-cell text-content-muted">{u.planName ?? '—'}</td>
                    <td className="table-cell">
                      {u.state ? (
                        <Badge tone={SUB_STATE_META[u.state].tone}>{SUB_STATE_META[u.state].label}</Badge>
                      ) : (
                        <Badge tone="neutral">Aucun</Badge>
                      )}
                    </td>
                    <td className="table-cell text-content-muted">
                      {u.subscriptionEndsAt ? formatDateTime(u.subscriptionEndsAt) : '—'}
                    </td>
                    <td className="table-cell text-content-muted">
                      {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Jamais'}
                    </td>
                    <td className="table-cell text-right">
                      <DropdownMenu items={actionsFor(u)} />
                    </td>
                  </tr>
                ))}
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
