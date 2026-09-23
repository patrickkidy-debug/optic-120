import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Menu, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '../../../components/ui';
import type { FounderOverview } from '../../../features/billing/console';
import { NAV_GROUPS, findSection, type SectionId } from './navigation';

/**
 * Coquille de la console fondateur (§3, §4, §25).
 *
 * La navigation passe d'une barre horizontale de treize onglets — qui
 * débordait, coupait des entrées et n'offrait aucune hiérarchie — à une barre
 * latérale groupée par domaine.
 *
 * Trois propriétés tenues :
 *  - la largeur du contenu ne dépend plus du nombre de sections. Ajouter une
 *    rubrique ne rétrécit plus les autres ;
 *  - sur mobile, la barre devient un tiroir. Elle n'est jamais compressée en
 *    une rangée d'icônes illisibles ;
 *  - les pastilles d'action viennent de la MÊME lecture que le tableau de bord,
 *    donc « À confirmer 7 » dans le menu et « 7 » sur la carte ne peuvent pas
 *    se contredire.
 */
export function ConsoleLayout({
  section,
  overview,
  onNavigate,
  onOpenSearch,
  onRunBillingCycle,
  billingCycleRunning,
  notificationSlot,
  children,
}: {
  section: SectionId;
  overview?: FounderOverview;
  onNavigate: (id: SectionId) => void;
  onOpenSearch: () => void;
  onRunBillingCycle: () => void;
  billingCycleRunning: boolean;
  notificationSlot: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const current = findSection(section);

  // Une navigation referme le tiroir : sur mobile, rester sur le menu après
  // avoir choisi cacherait justement l'écran demandé.
  useEffect(() => {
    setDrawerOpen(false);
  }, [section]);

  // Raccourci clavier de la recherche, comme partout ailleurs dans l'app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onOpenSearch]);

  const sidebar = (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3" aria-label="Sections de la console">
      {NAV_GROUPS.map((group) => {
        const isCollapsed = collapsed[group.id] ?? false;
        return (
          <div key={group.id} className="mb-1">
            {group.label && (
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-content-faint transition-colors hover:text-content-muted"
              >
                {group.label}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                  aria-hidden="true"
                />
              </button>
            )}
            {!isCollapsed &&
              group.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === section;
                const count = overview && item.badge ? item.badge(overview) : 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-content-muted hover:bg-surface-2 hover:text-content'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    {count > 0 && (
                      <span
                        className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-content-muted"
                        aria-label={`${count} à traiter`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)] gap-0">
      {/* Barre latérale fixe — masquée sous lg, où elle devient un tiroir. */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r lg:block">
        {sidebar}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r bg-surface shadow-card-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="font-display text-sm font-bold text-content">Console fondateur</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-lg p-1 text-content-faint hover:text-content"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(100%-3.25rem)]">{sidebar}</div>
          </div>
        </div>
      )}

      {/* Contenu. `min-w-0` est indispensable : sans lui, un tableau large
          pousse le conteneur flex et déborde la page entière au lieu de
          défiler dans sa propre zone. */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-16 z-30 flex flex-wrap items-center gap-2 border-b bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-lg p-2 text-content-muted hover:bg-surface-2 hover:text-content lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-bold text-content">
              {current.pageTitle ?? current.label}
            </h1>
            {current.subtitle && (
              <p className="truncate text-xs text-content-faint">{current.subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2 rounded-lg border bg-surface-2 px-3 py-2 text-sm text-content-faint transition-colors hover:text-content"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Rechercher…</span>
            <kbd className="hidden rounded border px-1 text-[10px] md:inline">Ctrl K</kbd>
          </button>

          {notificationSlot}

          <Button
            variant="outline"
            className="h-9 px-3 text-xs"
            onClick={onRunBillingCycle}
            loading={billingCycleRunning}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Cycle de facturation</span>
          </Button>
        </header>

        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
