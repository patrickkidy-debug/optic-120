import clsx from 'clsx';

/* ============================================================
 * Logos des moyens de paiement acceptés (via Moneroo).
 * Badges de marque reconstitués en SVG/CSS — aucune dépendance
 * externe, donc 100 % fiables hors-ligne et en production. Pour
 * des logos officiels, déposer des SVG dans apps/web/public/ et
 * remplacer le rendu ci-dessous par des <img>.
 * ============================================================ */

interface BrandPill {
  label: string;
  bg: string;
  fg: string;
  /** Bordure visible quand le fond est clair/blanc. */
  border?: boolean;
}

const MOBILE_BRANDS: BrandPill[] = [
  { label: 'Wave', bg: '#1DC9FF', fg: '#003049' },
  { label: 'Orange Money', bg: '#FF7900', fg: '#ffffff' },
  { label: 'Free Money', bg: '#CD1A2B', fg: '#ffffff' },
  { label: 'Wizall', bg: '#00A94F', fg: '#ffffff' },
];

function Pill({ brand }: { brand: BrandPill }) {
  return (
    <span
      title={brand.label}
      className={clsx(
        'inline-flex h-8 select-none items-center rounded-lg px-3 text-xs font-extrabold tracking-tight shadow-sm',
        brand.border && 'border border-black/10',
      )}
      style={{ backgroundColor: brand.bg, color: brand.fg }}
    >
      {brand.label}
    </span>
  );
}

export function PaymentMethodLogos({ className }: { className?: string }) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {MOBILE_BRANDS.map((b) => (
        <Pill key={b.label} brand={b} />
      ))}
    </div>
  );
}
