import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import clsx from 'clsx';
import { useUIStore } from '../store/ui';
import { LOCALES } from '../lib/locale-resolve';

/**
 * Sélecteur de langue de la vitrine : drapeau + nom, ouverture animée.
 *
 * Le choix est mémorisé par le store (localStorage) et prime ensuite sur la
 * détection GeoIP et sur la langue du navigateur, à toutes les visites.
 */
export function LanguagePicker({ className }: { className?: string }) {
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current.label}
        className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-content transition hover:border-primary/40 hover:bg-surface-2"
      >
        {/* Pas de drapeau emoji dans le bouton : Windows n'embarque aucune police
            pour les indicateurs régionaux, 🇫🇷 s'y affiche « FR » — ce qui
            doublonnait avec le code juste à côté. Globe + code marche partout. */}
        <Globe className="h-4 w-4 text-content-muted" aria-hidden />
        <span className="font-medium">{current.short}</span>
        <ChevronDown
          className={clsx('h-3.5 w-3.5 text-content-faint transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <div
        role="listbox"
        className={clsx(
          'absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-xl border bg-surface p-1.5 shadow-card-lg transition',
          open
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0',
        )}
      >
        {LOCALES.map((l) => (
          <button
            key={l.code}
            role="option"
            aria-selected={l.code === locale}
            onClick={() => {
              setLocale(l.code);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-content transition hover:bg-surface-2"
          >
            <span aria-hidden>{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            {l.code === locale && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}
