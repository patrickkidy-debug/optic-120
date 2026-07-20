import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
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

  const canSeeStock = user?.permissions.includes('optique.stock.view') ?? false;
  const canSeeSales = user?.permissions.includes('optique.sales.view') ?? false;
  const { data: lowCount } = useQuery({
    queryKey: ['lowStock', activeBranchId],
    queryFn: () => lowStockCount(activeBranchId!),
    enabled: Boolean(activeBranchId) && canSeeStock,
    refetchInterval: 60_000,
  });
  // Rappel : commandes de verres en retard de livraison.
  const { data: overdueCount } = useQuery({
    queryKey: ['lensOverdue'],
    queryFn: lensOverdueCount,
    enabled: canSeeSales,
    refetchInterval: 60_000,
  });

  const isOperator = user?.isPlatformOperator ?? false;
  // Le fondateur / opérateur voit toutes les sections (aucune restriction).
  const can = (perm?: string) => !perm || isOperator || (user?.permissions.includes(perm) ?? false);

  return (
    <nav data-tour="sidebar" className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="px-2">
        <Logo />
      </div>

      <div className="flex-1 space-y-5">
        {NAV.map((group) => {
          const items = group.items.filter((it) =>
            it.operatorOnly ? isOperator : it.soon || can(it.permission),
          );
          if (items.length === 0) return null;
          return (
            <div key={group.titleKey}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-content-faint">
                {t(group.titleKey)}
              </p>
              <div className="space-y-0.5">
                {items.map((it) =>
                  it.soon ? (
                    <div
                      key={it.to}
                      className="nav-link cursor-not-allowed select-none opacity-45"
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
                      data-tour={`nav:${it.to}`}
                      onClick={() => setSidebar(false)}
                      onMouseEnter={() => prefetchRoute(it.to)}
                      onFocus={() => prefetchRoute(it.to)}
                      className={({ isActive }) => clsx('nav-link', isActive && 'nav-link-active')}
                    >
                      {({ isActive }) => (
                        <>
                          <it.icon
                            className={clsx('h-[18px] w-[18px]', isActive && 'text-primary')}
                          />
                          <span className="flex-1 truncate">{t(it.labelKey)}</span>
                          {it.badge === 'lowStock' && lowCount ? (
                            <span className="badge bg-[color:var(--danger)]/15 text-danger">
                              {lowCount}
                            </span>
                          ) : null}
                          {it.badge === 'lensOverdue' && overdueCount ? (
                            <span
                              className="badge bg-[color:var(--danger)]/15 text-danger"
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

      <div className="px-3 text-[11px] text-content-faint">
        OculoSaaS · v1.0 — Phase 1
      </div>
    </nav>
  );
}
