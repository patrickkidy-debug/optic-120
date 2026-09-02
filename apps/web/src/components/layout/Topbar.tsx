import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
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
import type { ThemeMode } from '../../lib/theme';
import { useNavigate } from 'react-router-dom';

function ThemeToggle() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const order: ThemeMode[] = ['dark', 'light', 'auto'];
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <button
      className="btn-ghost h-9 w-9 rounded-xl p-0"
      title={`Thème : ${theme}`}
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
        aria-label="Langue"
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
  const setActiveBranch = useUIStore((s) => s.setActiveBranch);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: listBranches });

  useEffect(() => {
    if (branches && branches.length > 0 && !branches.find((b) => b.id === activeBranchId)) {
      setActiveBranch(branches[0].id);
    }
  }, [branches, activeBranchId, setActiveBranch]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const active = branches?.find((b) => b.id === activeBranchId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-outline h-9 rounded-xl px-3 text-sm"
      >
        <Store className="h-4 w-4 text-primary" />
        <span className="max-w-[140px] truncate">{active?.name ?? '—'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-content-faint" />
      </button>
      {open && branches && (
        <div className="absolute left-0 z-30 mt-2 w-56 rounded-xl border bg-surface p-1.5 shadow-card-lg">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setActiveBranch(b.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-content hover:bg-surface-2"
            >
              <span className="truncate">{b.name}</span>
              {b.id === activeBranchId && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
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
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2">
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
          <span className="block text-[11px] leading-tight text-content-muted">{user?.roleName}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-content-faint" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border bg-surface p-1.5 shadow-card-lg">
          <button
            onClick={() => {
              navigate('/parametres/profil');
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-content hover:bg-surface-2"
          >
            <UserCircle className="h-4 w-4" /> Mon profil
          </button>
          <button
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-[color:var(--danger)]/10"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const shortcuts = [
    { category: 'Raccourcis rapides', label: 'Nouvelle vente / Caisse', to: '/optique/caisse', icon: ShoppingCart },
    { category: 'Raccourcis rapides', label: 'Enregistrer un nouveau client', to: '/optique/clients', icon: UserPlus },
    { category: 'Raccourcis rapides', label: 'Voir l\'état des stocks', to: '/optique/stock', icon: Boxes },
    { category: 'Navigation', label: 'Tableau de bord principal', to: '/dashboard', icon: LayoutDashboard },
    { category: 'Navigation', label: 'Suivi financier et dépenses', to: '/gestion/finance', icon: Wallet },
    { category: 'Navigation', label: 'Gestion du personnel', to: '/gestion/personnel', icon: UserCog },
    { category: 'Configuration', label: 'Magasins et succursales', to: '/parametres/magasins', icon: Store },
    { category: 'Configuration', label: 'Rôles & Permissions', to: '/parametres/roles', icon: ShieldHalf },
    { category: 'Assistance', label: 'Aide et support technique', to: '/aide', icon: HelpCircle },
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
            placeholder="Rechercher une page, un raccourci ou une action..."
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
              Aucun résultat trouvé pour "{query}"
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
                            <span className="text-[10px] text-content-faint font-medium">Aller à</span>
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
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-bg/80 px-4 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(4rem + env(safe-area-inset-top))' }}
    >
      <button onClick={toggleSidebar} className="btn-ghost h-9 w-9 rounded-xl p-0 lg:hidden">
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
          <span>Rechercher...</span>
          <span className="flex items-center gap-0.5 rounded bg-surface-3 px-1.5 py-0.5 text-[9px] font-bold border">
            <Command className="h-2 w-2" />K
          </span>
        </button>
      </div>

      <div className="flex-1" />
      <ThemeToggle />
      <LanguageToggle />
      <div className="mx-1 h-6 w-px bg-line" />
      <UserMenu />

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
