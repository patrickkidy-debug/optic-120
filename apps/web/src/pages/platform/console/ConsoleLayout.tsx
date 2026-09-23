import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '../../../components/ui';
import type { FounderOverview } from '../../../features/billing/console';
import { NAV_GROUPS, findSection, type SectionId } from './navigation';

/**
 * Coquille de la console fondateur (§4, §25).
 *
 * Navigation HORIZONTALE : la barre latérale prenait environ 250 px sur toute
 * la hauteur, soit précisément la largeur qui manquait aux tableaux et aux
 * cartes. Les sections tiennent sur une bande qui défile ; le contenu garde
 * toute la largeur de l'écran.
 *
 * Ce que la refonte conserve de la version latérale :
 *  - les sections restent groupées par domaine, séparées par un filet vertical,
 *    au lieu d'une file de dix-neuf onglets sans hiérarchie ;
 *  - les pastilles d'action viennent de la MÊME lecture que le tableau de bord,
 *    donc « À confirmer 13 » dans la barre et « 13 » sur la carte ne peuvent
 *    pas se contredire ;
 *  - la section vit dans l'URL, donc un lien reste partageable.
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
  const current = findSection(section);
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Sans indice visuel, rien ne dit qu'il reste des sections hors champ : le
  // dernier onglet coupe net au bord passe pour la fin de la liste. Un fondu
  // apparait du cote ou il reste quelque chose a atteindre, et disparait en
  // bout de course.
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = stripRef.current;
    if (!el) return;
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  // La bande défile : l'onglet actif doit être visible même s'il est en bout de
  // course. Sans cela, ouvrir « Paramètres » par son URL laisserait la barre
  // calée à gauche, sur une section qui n'est pas celle affichée.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measure();
  }, [section, measure]);

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

  return (
    <div className="min-w-0">
      <header className="sticky top-16 z-30 border-b bg-surface/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
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
        </div>

        {/* Bande de sections. `overflow-x-auto` sur un conteneur `min-w-0`
            garantit qu'elle défile DANS sa zone au lieu d'élargir la page. */}
        <div className="relative">
          {edges.left && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-surface to-transparent"
            />
          )}
          {edges.right && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-surface to-transparent"
            />
          )}
          <nav
            ref={stripRef}
            aria-label="Sections de la console"
            className="flex min-w-0 items-stretch gap-0.5 overflow-x-auto px-3 pb-2 sm:px-4"
          >
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.id} className="flex shrink-0 items-stretch gap-0.5">
              {gi > 0 && <span className="mx-1.5 my-1 w-px shrink-0 bg-line" aria-hidden="true" />}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === section;
                const count = overview && item.badge ? item.badge(overview) : 0;
                return (
                  <button
                    key={item.id}
                    ref={active ? activeRef : undefined}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    aria-current={active ? 'page' : undefined}
                    title={item.subtitle}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-content-muted hover:bg-surface-2 hover:text-content'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                    {count > 0 && (
                      <span
                        className="rounded-full bg-surface-3 px-1.5 text-[11px] font-semibold text-content-muted"
                        aria-label={`${count} à traiter`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            ))}
          </nav>
        </div>
      </header>

      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
