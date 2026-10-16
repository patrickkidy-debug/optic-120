import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WhatsNewBell } from './WhatsNewBell';
import { NotificationsBell } from './NotificationsBell';
import { SyncStatus } from '../SyncStatus';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Menu,
  Sun,
  Moon,
  Monitor,
  Store,
  ChevronDown,
  LogOut,
  UserCircle,
  Check,
  Search,
  Command,
  ShoppingCart,
  UserPlus,
  Boxes,
  LayoutDashboard,
  Wallet,
  UserCog,
  ShieldHalf,
  HelpCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { useUIStore } from '../../store/ui';
import { useAuthStore } from '../../store/auth';
import { listBranches } from '../../features/optique/api';
import { logout } from '../../features/auth/api';
import { Avatar } from '../Avatar';
import i18n, { LOCALES } from '../../lib/i18n';
import { trFr } from '../../lib/sharedLabels';
import type { ThemeMode } from '../../lib/theme';
import { useLocation, useNavigate } from 'react-router-dom';
import { tr } from '../../lib/tr';
import { rememberedBranch, switchBranch } from '../../features/branches/context';

function ThemeToggle() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const order: ThemeMode[] = ['dark', 'light', 'auto'];
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <button
      className="btn-ghost h-9 w-9 rounded-xl p-0"
      title={tr('ui.Topbar.themeTheme', { theme: theme })}
      onClick={() => setTheme(order[(order.indexOf(theme) + 1) % order.length])}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

/** Sélecteur de langue. Liste alimentée par LOCALES (lib/i18n). */
function LanguageToggle() {
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function choose(code: string) {
    setLocale(code);
    void i18n.changeLanguage(code);
    setOpen(false);
  }

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost h-9 rounded-xl px-2.5 text-xs font-bold uppercase"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={tr('ui.Topbar.langue')}
      >
        {current.short}
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-2 w-40 rounded-xl border bg-surface p-1.5 shadow-card-lg"
        >
          {LOCALES.map((l) => (
            <button
              key={l.code}
              role="option"
              aria-selected={l.code === locale}
              onClick={() => choose(l.code)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-content transition hover:bg-surface-2"
            >
              {l.label}
              {l.code === locale && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchSelector() {
  const activeBranchId = useUIStore((s) => s.activeBranchId);
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canManage = useAuthStore((s) => s.user?.permissions?.includes('settings.branches.view'));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Magasins autorisés et non archivés (le serveur applique le périmètre du rôle).
  const { data: branches, isError } = useQuery({ queryKey: ['branches'], queryFn: listBranches });

  // Contexte valide en permanence : magasin mémorisé pour cet utilisateur,
  // sinon le magasin principal, sinon le premier autorisé.
  // À la connexion (ou changement de compte sur l'appareil), on reprend le
  // dernier magasin choisi par CET utilisateur plutôt que celui du précédent.
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!branches || branches.length === 0 || !userId || restoredFor.current === userId) return;
    restoredFor.current = userId;
    const remembered = rememberedBranch(userId);
    if (remembered && remembered !== activeBranchId && branches.some((b) => b.id === remembered)) {
      switchBranch(remembered, qc, { silent: true });
    }
  }, [branches, userId, activeBranchId, qc]);

  useEffect(() => {
    if (!branches || branches.length === 0) return;
    if (branches.some((b) => b.id === activeBranchId)) return;
    const remembered = rememberedBranch(userId);
    const next =
      branches.find((b) => b.id === remembered) ?? branches.find((b) => b.isMain) ?? branches[0];
    switchBranch(next.id, qc, { silent: true });
  }, [branches, activeBranchId, userId, qc]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const active = branches?.find((b) => b.id === activeBranchId);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-outline h-9 max-w-full rounded-xl px-2.5 text-sm sm:px-3"
        title={active ? tr('br.ctx.activeTitle', { name: active.name }) : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={tr('br.ctx.switch')}
      >
        <Store className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 max-w-[28vw] truncate sm:max-w-[160px]">{active?.name ?? (isError ? tr('br.ctx.unavailable') : '…')}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-content-faint" />
      </button>
      {open && branches && (
        <div role="listbox" aria-label={tr('br.ctx.switch')} className="absolute left-0 z-30 mt-2 w-64 max-w-[calc(100vw-1rem)] rounded-xl border bg-surface p-1.5 shadow-card-lg">
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-faint">{tr('br.ctx.switch')}</p>
          <div className="max-h-72 overflow-y-auto">
            {branches.map((b) => (
              <button
                key={b.id}
                role="option"
                aria-selected={b.id === activeBranchId}
                onClick={() => {
                  if (switchBranch(b.id, qc)) setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-content hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{b.name}</span>
                  {(b.city || b.isMain) && (
                    <span className="block truncate text-[11px] text-content-muted">
                      {[b.city, b.isMain ? tr('br.mainBadge') : ''].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                {b.id === activeBranchId && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
          {canManage && (
            <button
              onClick={() => {
                setOpen(false);
                navigate('/parametres/magasins');
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t px-3 py-2 text-left text-xs font-semibold text-primary hover:bg-surface-2"
            >
              <Store className="h-3.5 w-3.5" /> {tr('br.ctx.manage')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Thème et langue dans le menu utilisateur, sur téléphone uniquement. */
function MobilePrefs() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);
  const themes: { mode: ThemeMode; icon: typeof Sun }[] = [
    { mode: 'light', icon: Sun },
    { mode: 'dark', icon: Moon },
    { mode: 'auto', icon: Monitor },
  ];
  const chip = (active: boolean) =>
    clsx(
      'flex h-8 flex-1 items-center justify-center rounded-lg border text-xs font-bold uppercase transition',
      active ? 'border-primary bg-primary-soft text-primary' : 'text-content-muted hover:bg-surface-2',
    );
  return (
    <div className="space-y-2 border-b px-2 py-2 sm:hidden">
      <div className="flex gap-1.5">
        {themes.map(({ mode, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            className={chip(theme === mode)}
            onClick={() => setTheme(mode)}
            aria-label={tr('ui.Topbar.themeTheme', { theme: mode })}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            className={chip(locale === l.code)}
            onClick={() => {
              setLocale(l.code);
              void i18n.changeLanguage(l.code);
            }}
            aria-label={l.label}
          >
            {l.short}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1 hover:bg-surface-2 sm:pr-2">
        <Avatar
          photoUrl={user?.photoUrl}
          firstName={user?.firstName}
          lastName={user?.lastName}
          className="h-8 w-8 rounded-lg text-xs"
        />
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-content">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="block text-[11px] leading-tight text-content-muted">{trFr(user?.roleName)}</span>
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-content-faint sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-60 max-w-[calc(100vw-1rem)] rounded-xl border bg-surface p-1.5 shadow-card-lg">
          {/* Téléphone : identité, thème et langue (masqués de la barre faute de place). */}
          <div className="border-b px-3 pb-2 pt-1 sm:hidden">
            <p className="truncate text-sm font-semibold text-content">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-[11px] text-content-muted">{trFr(user?.roleName)}</p>
          </div>
          <MobilePrefs />
          <button
            onClick={() => {
              navigate('/parametres/profil');
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-content hover:bg-surface-2"
          >
            <UserCircle className="h-4 w-4" /> {tr('ui.Topbar.monProfil')}
          </button>
          <button
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-[color:var(--danger)]/10"
          >
            <LogOut className="h-4 w-4" /> {tr('ui.Topbar.deconnexion')}
          </button>
        </div>
      )}
    </div>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const shortcuts = [
    { category: t('shell.catShortcuts'), label: t('shell.scNewSale'), to: '/optique/caisse', icon: ShoppingCart },
    { category: t('shell.catShortcuts'), label: t('shell.scNewClient'), to: '/optique/clients', icon: UserPlus },
    { category: t('shell.catShortcuts'), label: t('shell.scStock'), to: '/optique/stock', icon: Boxes },
    { category: t('shell.catNavigation'), label: t('shell.scDashboard'), to: '/dashboard', icon: LayoutDashboard },
    { category: t('shell.catNavigation'), label: t('shell.scFinance'), to: '/gestion/finance', icon: Wallet },
    { category: t('shell.catNavigation'), label: t('shell.scStaff'), to: '/gestion/personnel', icon: UserCog },
    { category: t('shell.catSettings'), label: t('shell.scStores'), to: '/parametres/magasins', icon: Store },
    { category: t('shell.catSettings'), label: t('shell.scRoles'), to: '/parametres/roles', icon: ShieldHalf },
    { category: t('shell.catHelp'), label: t('shell.scHelp'), to: '/aide', icon: HelpCircle },
  ];

  const filtered = query
    ? shortcuts.filter((s) => s.label.toLowerCase().includes(query.toLowerCase()))
    : shortcuts;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      window.addEventListener('keydown', onKeyDown);
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh] backdrop-blur-sm sm:items-start" onClick={onClose}>
      <div 
        className="card w-full max-w-xl p-0 shadow-card-lg border bg-surface overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center border-b px-4 py-3">
          <Search className="h-5 w-5 text-content-faint mr-3" />
          <input
            autoFocus
            type="text"
            className="flex-1 bg-transparent text-sm text-content outline-none placeholder:text-content-faint"
            placeholder={t('shell.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-surface-3 text-content-muted border"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[350px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-content-muted">
              {t('shell.noResultFor', { query })}
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(new Set(filtered.map((f) => f.category))).map((cat) => (
                <div key={cat} className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-faint">
                    {cat}
                  </div>
                  <div className="space-y-0.5">
                    {filtered
                      .filter((f) => f.category === cat)
                      .map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              navigate(item.to);
                              onClose();
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-content transition hover:bg-surface-2"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="grid h-6 w-6 place-items-center rounded bg-surface-3 text-content-muted">
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                              <span>{item.label}</span>
                            </div>
                            <span className="text-[10px] text-content-faint font-medium">{t('shell.goTo')}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Topbar() {
  const { t } = useTranslation();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();

  // La console fondateur a sa propre recherche globale, liee a Ctrl+K.
  // Laisser celle de l'application active ferait ouvrir deux recherches
  // differentes sur la meme frappe.
  const isConsole = pathname === '/plateforme' || pathname.startsWith('/plateforme/');

  useEffect(() => {
    if (isConsole) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConsole]);

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-1 border-b bg-bg/80 px-2 backdrop-blur-md sm:gap-3 sm:px-4"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(4rem + env(safe-area-inset-top))' }}
    >
      <button onClick={toggleSidebar} className="btn-ghost h-9 w-9 shrink-0 rounded-xl p-0 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <BranchSelector />
      
      {/* Barre de recherche premium */}
      <div className="hidden md:block">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2.5 rounded-xl border bg-surface-2 px-3 py-1.5 text-xs text-content-muted transition hover:bg-surface-3 hover:text-content select-none"
        >
          <Search className="h-3.5 w-3.5" />
          <span>{t('shell.search')}</span>
          <span className="flex items-center gap-0.5 rounded bg-surface-3 px-1.5 py-0.5 text-[9px] font-bold border">
            <Command className="h-2 w-2" />K
          </span>
        </button>
      </div>

      <div className="flex-1" />
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-3">
        <SyncStatus />
        <NotificationsBell />
        <WhatsNewBell />
        <div className="hidden items-center gap-3 sm:flex">
          <ThemeToggle />
          <LanguageToggle />
          <div className="mx-1 h-6 w-px bg-line" />
        </div>
        <UserMenu />
      </div>

      {/* Rendue dans <body> : le flou de l'en-tête enfermait le voile de la recherche. */}
      {createPortal(<CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />, document.body)}
    </header>
  );
}
