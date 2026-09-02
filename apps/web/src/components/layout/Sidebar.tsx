import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { NAV } from './nav';
import { Logo } from '../Logo';
import { useAuthStore } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import { lowStockCount, lensOverdueCount } from '../../features/optique/api';
import { prefetchRoute } from '../../lib/routePrefetch';

export function Sidebar() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useUIStore((s) => s.activeBranchId);
  const setSidebar = useUIStore((s) => s.setSidebar);

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
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-4 py-6">
      <div className="px-2">
        <Logo />
      </div>

      <div className="flex-1 space-y-4">
        {NAV.map((group) => {
          const items = group.items.filter((it) =>
            it.operatorOnly ? isOperator : it.soon || can(it.permission),
          );
          if (items.length === 0) return null;
          const isCollapsed = collapsedGroups[group.titleKey] ?? false;

          return (
            <div key={group.titleKey} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.titleKey)}
                className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-content-faint hover:text-content transition"
              >
                <span>{t(group.titleKey)}</span>
                <ChevronDown
                  className={clsx(
                    'h-3.5 w-3.5 text-content-faint transition-transform duration-200',
                    isCollapsed && '-rotate-90'
                  )}
                />
              </button>
              
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
                      className="nav-link cursor-not-allowed select-none opacity-45 py-2"
                      title={t('common.phase2')}
                    >
                      <it.icon className="h-[18px] w-[18px]" />
                      <span className="flex-1 truncate">{t(it.labelKey)}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    </div>
                  ) : (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      onClick={() => setSidebar(false)}
                      onMouseEnter={() => prefetchRoute(it.to)}
                      onFocus={() => prefetchRoute(it.to)}
                      className={({ isActive }) =>
                        clsx('nav-link py-2 px-2.5 rounded-lg text-xs', isActive && 'nav-link-active')
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <it.icon
                            className={clsx('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-content-muted')}
                          />
                          <span className="flex-1 truncate">{t(it.labelKey)}</span>
                          {it.badge === 'lowStock' && lowCount ? (
                            <span className="badge bg-[color:var(--danger)]/10 text-danger text-[10px] px-1.5">
                              {lowCount}
                            </span>
                          ) : null}
                          {it.badge === 'lensOverdue' && overdueCount ? (
                            <span
                              className="badge bg-[color:var(--danger)]/10 text-danger text-[10px] px-1.5"
                              title="Commandes de verres en retard de livraison"
                            >
                              {overdueCount}
                            </span>
                          ) : null}
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

      <div className="px-2 text-[10px] text-content-faint border-t pt-4">
        OculoSaaS · v2.0 — Premium Dashboard
      </div>
    </nav>
  );
}
