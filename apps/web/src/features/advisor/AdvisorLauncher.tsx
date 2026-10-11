import { lazy, Suspense, useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import clsx from 'clsx';
import { advisorStatus } from './api';
import { advisorStrings } from './strings';

const AdvisorPanel = lazy(() => import('./AdvisorPanel').then((m) => ({ default: m.AdvisorPanel })));

let enabledOnce: Promise<boolean> | null = null;

/**
 * « Parler à notre conseiller IA » : bouton (flottant ou intégré) qui ouvre le
 * panneau vocal. Masqué si le conseiller n'est pas configuré côté serveur.
 */
export function AdvisorLauncher({
  page,
  variant = 'floating',
  className,
  label,
  always = false,
}: {
  page: string;
  variant?: 'floating' | 'inline' | 'block' | 'blockOnBrand';
  className?: string;
  label?: string;
  /** Toujours afficher (le panneau propose WhatsApp si le conseiller est indisponible). */
  always?: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const { s } = advisorStrings(document.documentElement.lang || navigator.language || 'fr');

  useEffect(() => {
    enabledOnce ??= advisorStatus();
    let alive = true;
    void enabledOnce.then((v) => alive && setEnabled(v));
    return () => {
      alive = false;
    };
  }, []);

  if (!enabled && !always) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          'inline-flex cursor-pointer items-center gap-2 font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
          variant === 'floating'
            ? 'fixed bottom-5 right-4 z-[70] rounded-full bg-[#0f172a] px-5 py-3.5 text-sm text-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.6)] hover:-translate-y-0.5 sm:bottom-6 sm:right-6'
            : variant === 'block'
              ? 'min-h-[52px] w-full justify-center rounded-xl border-2 border-[#0f172a] bg-[#0f172a] px-4 py-3 font-display font-bold text-white shadow-[0_8px_24px_-10px_rgba(15,23,42,0.75)] hover:-translate-y-0.5 hover:bg-[#1e293b] hover:shadow-[0_12px_28px_-10px_rgba(15,23,42,0.8)] active:translate-y-0 active:scale-[0.98]'
              : variant === 'blockOnBrand'
                ? 'min-h-[52px] w-full justify-center rounded-xl border-2 border-white bg-white px-4 py-3 font-display font-bold text-primary shadow-[0_8px_24px_-10px_rgba(15,23,42,0.55)] hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_12px_28px_-10px_rgba(15,23,42,0.65)] active:translate-y-0 active:scale-[0.98]'
                : 'rounded-full border border-primary/30 bg-white px-5 py-3 text-sm text-primary hover:bg-primary/5',
          className,
        )}
      >
        <span className={clsx(
          'grid h-7 w-7 place-items-center rounded-full',
          variant === 'floating'
            ? 'bg-brand'
            : variant === 'block'
              ? 'bg-white/15'
              : variant === 'blockOnBrand'
                ? 'bg-primary/10'
                : 'bg-primary/10',
        )}>
          <Mic className="h-4 w-4" aria-hidden />
        </span>
        {label ?? s.launch}
      </button>
      {open && (
        <Suspense fallback={null}>
          <AdvisorPanel open={open} onClose={() => setOpen(false)} page={page} />
        </Suspense>
      )}
    </>
  );
}
