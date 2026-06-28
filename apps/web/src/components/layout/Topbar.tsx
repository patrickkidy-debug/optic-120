import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Menu, Sun, Moon, Monitor, Store, ChevronDown, LogOut, UserCircle, Check } from 'lucide-react';
import clsx from 'clsx';
import { useUIStore } from '../../store/ui';
import { useAuthStore } from '../../store/auth';
import { listBranches } from '../../features/optique/api';
import { logout } from '../../features/auth/api';
import { Avatar } from '../Avatar';
import i18n from '../../lib/i18n';
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

function LanguageToggle() {
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);
  function toggle() {
    const next = locale === 'fr' ? 'en' : 'fr';
    setLocale(next);
    void i18n.changeLanguage(next);
  }
  return (
    <button onClick={toggle} className="btn-ghost h-9 rounded-xl px-2.5 text-xs font-bold uppercase">
      {locale}
    </button>
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

export function Topbar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-bg/80 px-4 backdrop-blur-md">
      <button onClick={toggleSidebar} className="btn-ghost h-9 w-9 rounded-xl p-0 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <BranchSelector />
      <div className="flex-1" />
      <ThemeToggle />
      <LanguageToggle />
      <div className="mx-1 h-6 w-px bg-line" />
      <UserMenu />
    </header>
  );
}
