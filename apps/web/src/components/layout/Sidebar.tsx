import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react';
import clsx from 'clsx';
import { NAV } from './nav';
import { Logo } from '../Logo';
import { useAuthStore } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import { lowStockCount, lensOverdueCount } from '../../features/optique/api';
import { prefetchRoute } from '../../lib/routePrefetch';
import { tr } from '../../lib/tr';

export function Sidebar({ collapsed = false, premium = false }: { collapsed?: boolean; premium?: boolean }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useUIStore((s) => s.activeBranchId);
  const setSidebar = useUIStore((s) => s.setSidebar);
  const toggleCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);

  // Mémorise les groupes repliés localement. Par défaut, tous sont ouverts (false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('oculo_sidebar_collapsed');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleGroup = (titleKey: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [titleKey]: !prev[titleKey] };
      localStorage.setItem('oculo_sidebar_collapsed', JSON.stringify(next));
      return next;
    });
  };

  const canSeeStock = user?.permissions.includes('optique.stock.view') ?? false;
  const canSeeSales = user?.permissions.includes('optique.sales.view') ?? false;
  
  const { data: lowCount } = useQuery({
    queryKey: ['lowStock', activeBranchId],
    queryFn: () => lowStockCount(activeBranchId!),
    enabled: Boolean(activeBranchId) && canSeeStock,
    refetchInterval: 60_000,
  });

  const { data: overdueCount } = useQuery({
    queryKey: ['lensOverdue'],
    queryFn: lensOverdueCount,
    enabled: canSeeSales,
    refetchInterval: 60_000,
  });

  const isOperator = user?.isPlatformOperator ?? false;
  const can = (perm?: string) => !perm || isOperator || (user?.permissions.includes(perm) ?? false);

  return (
    <nav className={clsx('flex h-full flex-col gap-5 overflow-y-auto py-6', collapsed ? 'items-center px-3' : 'px-4')}>
      <div className={collapsed ? '' : 'px-2'}>
        <Logo withText={!collapsed} />
      </div>

      <div className={clsx('flex-1', collapsed ? 'w-full space-y-3' : 'space-y-4')}>
        {NAV.map((group) => {
          const items = group.items.filter((it) =>
            it.operatorOnly ? isOperator : it.soon || can(it.permission),
          );
          if (items.length === 0) return null;
          // Menu replié : tous les groupes restent visibles, séparés d'un trait.
          const isCollapsed = collapsed ? false : collapsedGroups[group.titleKey] ?? false;

          return (
            <div key={group.titleKey} className="space-y-1">
              {collapsed ? (
                <div className="mx-auto my-1 h-px w-8 bg-line" />
              ) : (
              <button
                onClick={() => toggleGroup(group.titleKey)}
                className="flex w-full items-center justify-between px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-content-faint hover:text-content transition"
              >
                <span>{t(group.titleKey)}</span>
                <ChevronDown
                  className={clsx(
                    'h-3.5 w-3.5 text-content-faint transition-transform duration-200',
                    isCollapsed && '-rotate-90'
                  )}
                />
              </button>
              )}
              
              <div
                className={clsx(
                  'space-y-0.5 transition-all duration-200 overflow-hidden',
                  isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
                )}
              >
                {items.map((it) =>
                  it.soon ? (
                    <div
                      key={it.to}
                      className={clsx('nav-link cursor-not-allowed select-none opacity-45 py-2', collapsed && 'mx-auto h-11 w-11 justify-center px-0')}
                      title={collapsed ? t(it.labelKey) : t('common.phase2')}
                    >
                      <it.icon className="h-[18px] w-[18px]" strokeWidth={premium ? 2.2 : 2} />
                      {!collapsed && <span className="flex-1 truncate">{t(it.labelKey)}</span>}
                      {!collapsed && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </div>
                  ) : (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      onClick={() => setSidebar(false)}
                      onMouseEnter={() => prefetchRoute(it.to)}
                      onFocus={() => prefetchRoute(it.to)}
                      title={collapsed ? t(it.labelKey) : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'nav-link relative',
                          collapsed
                            ? 'mx-auto h-11 w-11 justify-center px-0'
                            : premium
                              ? 'px-3 py-2.5 text-[13px]'
                              : 'rounded-lg px-2.5 py-2 text-xs',
                          isActive && 'nav-link-active',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <it.icon
                            className={clsx(premium ? 'h-[18px] w-[18px]' : 'h-4 w-4', 'shrink-0 transition-colors', isActive ? 'text-primary' : 'text-content-muted')}
                            strokeWidth={premium ? 2.2 : 2}
                          />
                          {collapsed ? (
                            ((it.badge === 'lowStock' && lowCount) || (it.badge === 'lensOverdue' && overdueCount)) ? (
                              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-[color:rgb(var(--surface-rgb))]" />
                            ) : null
                          ) : (
                          <>
                          <span className="flex-1 truncate">{t(it.labelKey)}</span>
                          {it.badge === 'lowStock' && lowCount ? (
                            <span className="badge bg-[color:var(--danger)]/10 text-danger text-[10px] px-1.5">
                              {lowCount}
                            </span>
                          ) : null}
                          {it.badge === 'lensOverdue' && overdueCount ? (
                            <span
                              className="badge bg-[color:var(--danger)]/10 text-danger text-[10px] px-1.5"
                              title={t('shell.lateLensOrders')}
                            >
                              {overdueCount}
                            </span>
                          ) : null}
                          </>
                          )}
                        </>
                      )}
                    </NavLink>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={clsx('border-t pt-4', collapsed ? 'flex w-full justify-center' : 'flex items-center justify-between gap-2 px-2')}>
        {!collapsed && <span className="text-[10px] text-content-faint">{tr('ui.Sidebar.oculosaasV20PremiumDashboard')}</span>}
        {/* Grand écran : replier / déplier le menu (mémorisé, interface premium). */}
        {premium && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl text-content-muted transition hover:bg-surface-2 hover:text-primary lg:grid"
          title={collapsed ? t('shell.expandMenu') : t('shell.collapseMenu')}
          aria-label={collapsed ? t('shell.expandMenu') : t('shell.collapseMenu')}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
        )}
      </div>
    </nav>
  );
}
