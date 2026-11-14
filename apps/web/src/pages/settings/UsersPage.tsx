import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  UserX,
  UserCheck,
  Users as UsersIcon,
  Pencil,
  KeyRound,
  Copy,
  Check,
  Search,
  Activity,
  Clock,
  ShieldCheck,
  Lock,
  MessageCircle,
  Store,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import i18n from 'i18next';
import { userCreateSchema, type UserCreateInput } from '@oculo/shared-types';
import {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
  listRoles,
  type UserDto,
} from '../../features/rbac/api';
import { listBranches } from '../../features/optique/api';
import { getSubscription } from '../../features/billing/api';
import { useAuthStore, usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDate, initials } from '../../lib/format';
import { waLink } from '../../lib/whatsapp';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState, STICKER_TONES } from '../../components/ui';
import { tr } from '../../lib/tr';
import { trFr } from '../../lib/sharedLabels';

const DAY = 24 * 3600 * 1000;

/** Teinte stable par rôle : même rôle = même couleur d'avatar et de pastille. */
const ROLE_TONES = [STICKER_TONES.primary, STICKER_TONES.accent, STICKER_TONES.success, STICKER_TONES.pink] as const;
function roleTone(roleId: string) {
  let h = 0;
  for (const c of roleId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ROLE_TONES[h % ROLE_TONES.length];
}

/** « il y a 3 h », « hier »… dans la langue de l'interface. */
function timeAgo(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(i18n.language || 'fr', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60 * 1000) return tr('usersV4.justNow');
  if (abs < 3600 * 1000) return rtf.format(Math.round(diff / 60000), 'minute');
  if (abs < DAY) return rtf.format(Math.round(diff / 3600000), 'hour');
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), 'day');
  return formatDate(iso);
}

/** Présence : vert = connecté dans les 24 h, ambre = dans les 7 jours, gris sinon. */
function presence(u: UserDto): 'online' | 'recent' | 'idle' | 'never' {
  if (!u.lastLoginAt) return 'never';
  const age = Date.now() - new Date(u.lastLoginAt).getTime();
  if (age < DAY) return 'online';
  if (age < 7 * DAY) return 'recent';
  return 'idle';
}
const PRESENCE_DOT = { online: 'bg-[#22c55e]', recent: 'bg-[#f59e0b]', idle: 'bg-[#94a3b8]', never: 'bg-[#94a3b8]' };

/** Mot de passe temporaire lisible (sans 0/O ni 1/l), 10 caractères. */
function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/** Message WhatsApp pré-rempli avec les accès de l'employé. */
function credentialsLink(user: { firstName: string; email: string; phone: string | null }, password: string): string | null {
  const base = waLink(user.phone);
  if (!base) return null;
  const text = tr('usersV4.waMessage', {
    firstName: user.firstName,
    url: `${window.location.origin}/login`,
    email: user.email,
    password,
  });
  return `${base}?text=${encodeURIComponent(text)}`;
}

type StatusFilter = 'active' | 'inactive' | 'all';

export function UsersPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const canCreate = usePermission('rbac.users.create');
  const canUpdate = usePermission('rbac.users.update');
  const canDeactivate = usePermission('rbac.users.deactivate');
  const canSeeBilling = usePermission('billing.view');
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [credentials, setCredentials] = useState<{
    user: { firstName: string; lastName: string; email: string; phone: string | null };
    password: string;
    created: boolean;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [status, setStatus] = useState<StatusFilter>('active');

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: listUsers });
  // Quota de l'offre (lecture seule) : visible seulement avec le droit de
  // consulter l'abonnement, sinon la carte affiche simplement l'effectif.
  const { data: sub } = useQuery({
    queryKey: ['subscription'],
    queryFn: getSubscription,
    enabled: canSeeBilling,
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });
  const deactivateMut = useMutation({ mutationFn: deactivateUser, onSuccess: invalidate, onError: (e) => alert(apiErrorMessage(e)) });
  const reactivateMut = useMutation({ mutationFn: reactivateUser, onSuccess: invalidate, onError: (e) => alert(apiErrorMessage(e)) });
  const resetPasswordMut = useMutation({ mutationFn: resetUserPassword, onSuccess: invalidate, onError: (e) => alert(apiErrorMessage(e)) });

  const all = users ?? [];
  const stats = useMemo(() => {
    const active = all.filter((u) => u.isActive);
    return {
      active: active.length,
      inactive: all.length - active.length,
      week: active.filter((u) => u.lastLoginAt && Date.now() - new Date(u.lastLoginAt).getTime() < 7 * DAY).length,
      never: active.filter((u) => !u.lastLoginAt).length,
    };
  }, [all]);

  // Les pastilles de rôle comptent selon le statut affiché (actifs, désactivés, tous).
  const byStatus = all.filter((u) => (status === 'all' ? true : status === 'active' ? u.isActive : !u.isActive));
  const roles = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of byStatus) map.set(u.role.id, u.role.name);
    return [...map.entries()];
  }, [byStatus]);

  const q = search.trim().toLowerCase();
  const shown = byStatus
    .filter((u) => roleFilter === 'ALL' || u.role.id === roleFilter)
    .filter(
      (u) =>
        !q ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? '').includes(q),
    );

  const maxUsers = sub?.plan.maxUsers ?? null;
  const seatsUsed = sub?.usage.users ?? all.length;
  const seatsFull = maxUsers != null && seatsUsed >= maxUsers;

  const askReset = (u: UserDto) => {
    if (!confirm(tr('ui.UsersPage.genererUnNouveauMotDe', { firstName: u.firstName, lastName: u.lastName }))) return;
    resetPasswordMut.mutate(u.id, {
      onSuccess: (res) => setCredentials({ user: u, password: res.tempPassword, created: false }),
    });
  };

  return (
    <div>
      <PageHeader
        title={tr('ui.UsersPage.utilisateurs')}
        subtitle={tr('ui.UsersPage.gerezLesComptesEmployesEt')}
        actions={
          canCreate && (
            <Button onClick={() => setModalOpen(true)} disabled={seatsFull} title={seatsFull ? tr('usersV4.seatsFull') : undefined}>
              <Plus className="h-4 w-4" /> {tr('ui.UsersPage.nouvelUtilisateur')}
            </Button>
          )
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : all.length === 0 ? (
        <EmptyState icon={UsersIcon} title={tr('ui.UsersPage.aucunUtilisateur')} />
      ) : (
        <>
          {/* Chiffres clés de l'équipe */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MiniSticker
              icon={UsersIcon}
              tone="primary"
              label={tr('usersV4.team')}
              value={maxUsers != null ? `${seatsUsed} / ${maxUsers}` : String(stats.active)}
              hint={maxUsers != null ? tr('usersV4.seatsHint', { plan: sub?.plan.name ?? '' }) : tr('usersV4.activeAccounts')}
              progress={maxUsers != null ? Math.min(100, Math.round((seatsUsed / maxUsers) * 100)) : undefined}
            />
            <MiniSticker icon={Activity} tone="success" label={tr('usersV4.week')} value={String(stats.week)} hint={tr('usersV4.weekHint')} />
            <MiniSticker icon={Clock} tone="accent" label={tr('usersV4.never')} value={String(stats.never)} hint={tr('usersV4.neverHint')} />
            <MiniSticker icon={UserX} tone="pink" label={tr('usersV4.inactive')} value={String(stats.inactive)} hint={tr('usersV4.inactiveHint')} />
          </div>

          {seatsFull && canCreate && (
            <p className="mt-4 rounded-xl bg-[color:var(--warning)]/10 px-4 py-2.5 text-sm text-warning">{tr('usersV4.seatsFull')}</p>
          )}

          {/* Recherche et filtres */}
          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
              <input
                className="input pl-9"
                placeholder={tr('usersV4.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex rounded-xl border bg-surface p-1">
              {(['active', 'inactive', 'all'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStatus(s);
                    setRoleFilter('ALL');
                  }}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    status === s ? 'bg-brand text-white' : 'text-content-muted hover:text-content',
                  )}
                >
                  {tr(`usersV4.status_${s}`)}
                </button>
              ))}
            </div>
          </div>
          {roles.length > 1 && (
            <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {[['ALL', tr('usersV4.allRoles')] as const, ...roles].map(([id, name]) => {
                const count = id === 'ALL' ? byStatus.length : byStatus.filter((u) => u.role.id === id).length;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRoleFilter(id)}
                    className={clsx(
                      'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition',
                      roleFilter === id ? 'border-primary bg-primary-soft font-semibold text-content' : 'text-content-muted hover:text-content',
                    )}
                  >
                    {id === 'ALL' ? name : trFr(name)}
                    <span className="rounded-full bg-surface-2 px-1.5 text-[11px]">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Cartes employés */}
          {shown.length === 0 ? (
            <p className="mt-8 text-center text-sm text-content-muted">{tr('usersV4.noMatch')}</p>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {shown.map((u) => (
                <UserCard
                  key={u.id}
                  user={u}
                  isMe={u.id === me?.id}
                  canUpdate={canUpdate}
                  canDeactivate={canDeactivate}
                  onEdit={() => setEditUser(u)}
                  onReset={() => askReset(u)}
                  onDeactivate={() => {
                    if (confirm(tr('ui.UsersPage.desactiverFirstnameLastname', { firstName: u.firstName, lastName: u.lastName }))) deactivateMut.mutate(u.id);
                  }}
                  onReactivate={() => reactivateMut.mutate(u.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <CreateUserModal
          onClose={() => setModalOpen(false)}
          onCreated={(v) =>
            setCredentials({
              user: { firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone ?? null },
              password: v.password,
              created: true,
            })
          }
        />
      )}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
      {credentials && (
        <CredentialsModal
          user={credentials.user}
          password={credentials.password}
          created={credentials.created}
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  );
}

function MiniSticker({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  progress,
}: {
  icon: LucideIcon;
  tone: keyof typeof STICKER_TONES;
  label: string;
  value: string;
  hint: string;
  progress?: number;
}) {
  const t = STICKER_TONES[tone];
  return (
    <div className="card card-sticker p-4" style={{ '--sticker': t.shadow } as CSSProperties}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-content-muted">{label}</p>
          <p className="mt-1.5 font-arcade text-[22px] leading-tight text-content">{value}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#120a2b]" style={{ background: t.chip }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7c3aed,#ec4899,#f97316)' }} />
        </div>
      )}
      <p className="mt-1.5 truncate text-[11px] text-content-faint">{hint}</p>
    </div>
  );
}

function UserCard({
  user: u,
  isMe,
  canUpdate,
  canDeactivate,
  onEdit,
  onReset,
  onDeactivate,
  onReactivate,
}: {
  user: UserDto;
  isMe: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
  onEdit: () => void;
  onReset: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const tone = roleTone(u.role.id);
  const p = presence(u);
  const wa = waLink(u.phone);
  return (
    <div
      className={clsx('card card-sticker flex flex-col p-5', !u.isActive && 'opacity-70')}
      style={{ '--sticker': u.isActive ? tone.shadow : '#64748b' } as CSSProperties}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl font-arcade text-sm text-[#120a2b]"
            style={{ background: tone.chip, boxShadow: `3px 3px 0 ${tone.shadow}` }}
          >
            {initials(u.firstName, u.lastName)}
          </span>
          {u.isActive && (
            <span
              className={clsx('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[color:var(--surface)]', PRESENCE_DOT[p])}
              aria-hidden
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold text-content">
            <span className="truncate">{u.firstName} {u.lastName}</span>
            {isMe && <Badge tone="accent">{tr('usersV4.me')}</Badge>}
          </p>
          <p className="truncate text-xs text-content-faint">{u.email}</p>
          {u.phone && <p className="truncate text-xs text-content-faint">{u.phone}</p>}
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold text-[#120a2b]" style={{ background: tone.chip }}>
          {trFr(u.role.name)}
        </span>
      </div>

      {/* Magasins */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {u.role.allBranches ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs text-content-muted">
            <Store className="h-3 w-3" /> {tr('usersV4.allBranches')}
          </span>
        ) : u.branches.length ? (
          u.branches.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs text-content-muted">
              <Store className="h-3 w-3" /> {b.name}
            </span>
          ))
        ) : (
          <span className="rounded-lg bg-[color:var(--warning)]/10 px-2 py-1 text-xs text-warning">{tr('usersV4.noBranch')}</span>
        )}
      </div>

      {/* État */}
      <div className="mb-4 mt-3 flex flex-wrap items-center gap-2 text-xs">
        {!u.isActive ? (
          <Badge tone="danger">{tr('ui.UsersPage.inactif')}</Badge>
        ) : u.locked ? (
          <Badge tone="warning">
            <Lock className="h-3 w-3" /> {tr('usersV4.locked')}
          </Badge>
        ) : (
          <Badge tone="success">{tr('ui.UsersPage.actif')}</Badge>
        )}
        <span className="text-content-faint">
          {u.lastLoginAt ? tr('usersV4.lastSeen', { when: timeAgo(u.lastLoginAt) }) : tr('ui.UsersPage.jamaisConnecte')}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-[11px] text-content-faint">
          {u.createdAt ? tr('usersV4.since', { date: formatDate(u.createdAt) }) : ''}
        </span>
        <div className="flex items-center gap-1">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn-ghost h-8 w-8 rounded-lg p-0 text-success" title="WhatsApp" aria-label={`WhatsApp ${u.firstName}`}>
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
          {canUpdate && u.isActive && (
            <button onClick={onEdit} className="btn-ghost h-8 w-8 rounded-lg p-0 text-content-muted" title={tr('ui.UsersPage.modifierLeRoleLesMagasins')} aria-label={tr('ui.UsersPage.modifierLeRoleLesMagasins')}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canUpdate && u.isActive && (
            <button
              onClick={onReset}
              className={clsx('btn-ghost h-8 w-8 rounded-lg p-0', u.locked ? 'text-warning' : 'text-content-muted')}
              title={u.locked ? tr('usersV4.unlock') : tr('ui.UsersPage.reinitialiserLeMotDePasse')}
              aria-label={tr('ui.UsersPage.reinitialiserLeMotDePasse')}
            >
              <KeyRound className="h-4 w-4" />
            </button>
          )}
          {canDeactivate && u.isActive && !isMe && (
            <button onClick={onDeactivate} className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger" title={tr('ui.UsersPage.desactiver')} aria-label={tr('ui.UsersPage.desactiver')}>
              <UserX className="h-4 w-4" />
            </button>
          )}
          {canDeactivate && !u.isActive && (
            <Button variant="outline" className="h-8 px-3 text-xs" onClick={onReactivate}>
              <UserCheck className="h-3.5 w-3.5" /> {tr('usersV4.reactivate')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Accès de l'employé, affichés UNE SEULE FOIS (le mot de passe n'est jamais
 * stocké en clair côté serveur) : copie ou envoi direct par WhatsApp au
 * numéro de l'employé, message pré-rempli.
 */
function CredentialsModal({
  user,
  password,
  created,
  onClose,
}: {
  user: { firstName: string; lastName: string; email: string; phone: string | null };
  password: string;
  created: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const wa = credentialsLink(user, password);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${user.email}\n${password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible (contexte non sécurisé) : copie manuelle.
    }
  }

  return (
    <Modal open onClose={onClose} title={created ? tr('usersV4.createdTitle') : tr('ui.UsersPage.motDePasseTemporaire')} size="sm">
      <p className="text-sm text-content-muted">
        {created ? tr('usersV4.createdIntro') : tr('ui.UsersPage.nouveauMotDePassePour')}{' '}
        <b className="text-content">{user.firstName} {user.lastName}</b>
      </p>
      <div className="mt-4 space-y-2 rounded-xl border bg-surface-2 p-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-content-faint">{tr('usersV4.login')}</p>
          <p className="select-all break-all font-mono text-sm text-content">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-content-faint">{tr('usersV4.password')}</p>
            <p className="select-all font-mono text-lg font-bold tracking-wider text-content">{password}</p>
          </div>
          <button onClick={copy} className="btn-ghost h-9 w-9 rounded-lg p-0" title={tr('ui.UsersPage.copier')} aria-label={tr('ui.UsersPage.copier')}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {!created && (
        <p className="mt-3 text-xs text-content-faint">{tr('usersV4.sessionsRevoked')}</p>
      )}
      <div className="mt-5 grid gap-2">
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="btn-primary h-10 rounded-xl text-sm">
            <MessageCircle className="h-4 w-4" /> {tr('usersV4.sendWhatsapp')}
          </a>
        )}
        <Button variant={wa ? 'outline' : 'primary'} onClick={onClose}>
          {tr('ui.UsersPage.jAiNoteLeMot')}
        </Button>
      </div>
    </Modal>
  );
}

function BranchPicker({
  branches,
  selected,
  onToggle,
}: {
  branches: { id: string; name: string }[] | undefined;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {branches?.map((b) => {
        const on = selected.includes(b.id);
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onToggle(b.id)}
            aria-pressed={on}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition',
              on ? 'border-primary bg-primary-soft font-semibold text-content' : 'text-content-muted hover:text-content',
            )}
          >
            {on ? <Check className="h-3.5 w-3.5 text-primary" /> : <Store className="h-3.5 w-3.5" />}
            {b.name}
          </button>
        );
      })}
    </div>
  );
}

function EditUserModal({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [email, setEmail] = useState(user.email);
  const [roleId, setRoleId] = useState(user.role.id);
  const [branchIds, setBranchIds] = useState<string[]>(user.branches.map((b) => b.id));
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: listBranches });
  const allBranches = roles?.find((r) => r.id === roleId)?.allBranches;

  const toggleBranch = (id: string) =>
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const mut = useMutation({
    mutationFn: () =>
      updateUser(user.id, {
        roleId,
        branchIds,
        // Email envoyé seulement s'il change (correction de faute de frappe).
        ...(email.trim() && email.trim() !== user.email ? { email: email.trim() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={tr('ui.UsersPage.modifierFirstnameLastname', { firstName: user.firstName, lastName: user.lastName })}>
      <div className="space-y-4">
        <Field label={tr('ui.UsersPage.emailIdentifiantDeConnexion')}>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="mt-1 text-xs text-content-faint">{tr('ui.UsersPage.corrigerUneFauteDeFrappe')}</p>
        </Field>
        <Field label={tr('ui.UsersPage.role')}>
          <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles?.map((r) => (
              <option key={r.id} value={r.id}>{trFr(r.name)}</option>
            ))}
          </select>
        </Field>
        <Field label={tr('ui.UsersPage.magasinsAssignes')}>
          {allBranches ? (
            <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-content-muted">
              <ShieldCheck className="h-4 w-4 text-primary" /> {tr('usersV4.roleAllBranches')}
            </p>
          ) : (
            <>
              <BranchPicker branches={branches} selected={branchIds} onToggle={toggleBranch} />
              <p className="mt-1 text-xs text-content-faint">{tr('ui.UsersPage.sansEffetPourLesRoles')}</p>
            </>
          )}
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{tr('ui.UsersPage.annuler')}</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending}>{tr('ui.UsersPage.enregistrer')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (v: UserCreateInput) => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: listBranches });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { branchIds: [], password: generatePassword() },
  });
  const branchIds = watch('branchIds') ?? [];
  const roleId = watch('roleId');
  const allBranches = roles?.find((r) => r.id === roleId)?.allBranches;
  // Un seul magasin : il est forcément le bon, on le coche d'office.
  const onlyBranch = branches?.length === 1 ? branches[0]!.id : null;
  useEffect(() => {
    if (onlyBranch) setValue('branchIds', [onlyBranch]);
  }, [onlyBranch, setValue]);

  const mut = useMutation({
    mutationFn: (v: UserCreateInput) => createUser(v),
    onSuccess: (_res, v) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      onClose();
      onCreated(v);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={tr('ui.UsersPage.nouvelUtilisateur')}>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={tr('ui.UsersPage.prenom')}>
            <input className="input" autoFocus {...register('firstName')} />
            {errors.firstName && <p className="mt-1 text-xs text-danger">{trFr(errors.firstName.message)}</p>}
          </Field>
          <Field label={tr('ui.UsersPage.nom')}>
            <input className="input" {...register('lastName')} />
            {errors.lastName && <p className="mt-1 text-xs text-danger">{trFr(errors.lastName.message)}</p>}
          </Field>
        </div>
        <Field label="Email">
          <input className="input" type="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-danger">{trFr(errors.email.message)}</p>}
        </Field>
        <Field label={tr('ui.UsersPage.telephoneWhatsapp')}>
          <input className="input" type="tel" placeholder="+225 07 00 00 00 00" {...register('phone')} />
          {errors.phone && <p className="mt-1 text-xs text-danger">{trFr(errors.phone.message)}</p>}
        </Field>
        <Field label={tr('ui.UsersPage.motDePasseTemporaire')}>
          <div className="flex gap-2">
            <input className="input font-mono" type="text" {...register('password')} placeholder={tr('ui.UsersPage.auMoins8Caracteres')} />
            <button
              type="button"
              onClick={() => setValue('password', generatePassword(), { shouldValidate: true })}
              className="btn-outline h-10 shrink-0 rounded-xl px-3 text-sm"
              title={tr('usersV4.generate')}
            >
              <Wand2 className="h-4 w-4" /> <span className="hidden sm:inline">{tr('usersV4.generate')}</span>
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-danger">{trFr(errors.password.message)}</p>}
        </Field>
        <Field label={tr('ui.UsersPage.role')}>
          <select className="input" {...register('roleId')}>
            <option value="">{tr('ui.UsersPage.choisir')}</option>
            {roles?.map((r) => (
              <option key={r.id} value={r.id}>{trFr(r.name)}</option>
            ))}
          </select>
          {errors.roleId && <p className="mt-1 text-xs text-danger">{trFr(errors.roleId.message)}</p>}
        </Field>
        <Field label={tr('ui.UsersPage.magasinsAssignes')}>
          {allBranches ? (
            <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-content-muted">
              <ShieldCheck className="h-4 w-4 text-primary" /> {tr('usersV4.roleAllBranches')}
            </p>
          ) : (
            <BranchPicker
              branches={branches}
              selected={branchIds}
              onToggle={(id) =>
                setValue('branchIds', branchIds.includes(id) ? branchIds.filter((x) => x !== id) : [...branchIds, id])
              }
            />
          )}
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{tr('ui.UsersPage.annuler')}</Button>
          <Button type="submit" loading={mut.isPending}>{tr('ui.UsersPage.creer')}</Button>
        </div>
      </form>
    </Modal>
  );
}
