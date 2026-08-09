import { lensVisualFor } from '@oculo/shared-types';

/**
 * Illustration d'un verre, dérivée de sa famille. Un opticien reconnaît le
 * type de verre au premier coup d'œil, sans lire la fiche :
 *  - progressif : les trois zones de vision dégradées,
 *  - bifocal    : le segment de près marqué,
 *  - photochromique : moitié claire / moitié foncée,
 *  - solaire    : teinte pleine et reflet,
 *  - ordinateur : bande intermédiaire large.
 * Purement décoratif (aria-hidden) : l'information reste dans le texte.
 */
export function LensVisual({
  family,
  className = '',
}: {
  family: string | null | undefined;
  className?: string;
}) {
  const visual = lensVisualFor(family);
  // Identifiants uniques : plusieurs cartes coexistent sur la même page et des
  // ids de dégradé dupliqués se voleraient mutuellement le rendu.
  const uid = `lv-${visual}-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      viewBox="0 0 120 90"
      className={className}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`${uid}-prog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--primary-rgb))" stopOpacity="0.30" />
          <stop offset="45%" stopColor="rgb(var(--primary-rgb))" stopOpacity="0.14" />
          <stop offset="100%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id={`${uid}-photo`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(var(--primary-rgb))" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id={`${uid}-sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#78350f" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#b45309" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${uid}-mid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--primary-rgb))" stopOpacity="0.10" />
          <stop offset="100%" stopColor="rgb(var(--primary-rgb))" stopOpacity="0.30" />
        </linearGradient>
      </defs>

      {/* Galbe du verre, commun à toutes les familles */}
      <ellipse
        cx="60"
        cy="45"
        rx="46"
        ry="34"
        fill={
          visual === 'progressive'
            ? `url(#${uid}-prog)`
            : visual === 'photochromic'
              ? `url(#${uid}-photo)`
              : visual === 'sun'
                ? `url(#${uid}-sun)`
                : visual === 'mid' || visual === 'computer'
                  ? `url(#${uid}-mid)`
                  : 'rgb(var(--primary-rgb) / 0.10)'
        }
        stroke="rgb(var(--primary-rgb) / 0.45)"
        strokeWidth="1.5"
      />

      {/* Progressif : séparations des zones loin / intermédiaire / près */}
      {visual === 'progressive' && (
        <>
          <path d="M22 38 Q60 32 98 38" fill="none" stroke="rgb(var(--primary-rgb) / 0.5)" strokeWidth="1" strokeDasharray="3 3" />
          <path d="M30 58 Q60 54 90 58" fill="none" stroke="rgb(var(--accent-rgb) / 0.6)" strokeWidth="1" strokeDasharray="3 3" />
          <text x="60" y="28" textAnchor="middle" fontSize="7" fill="rgb(var(--text-muted-rgb))">loin</text>
          <text x="60" y="51" textAnchor="middle" fontSize="7" fill="rgb(var(--text-muted-rgb))">inter.</text>
          <text x="60" y="72" textAnchor="middle" fontSize="7" fill="rgb(var(--text-muted-rgb))">près</text>
        </>
      )}

      {/* Bifocal : le segment de près, franc */}
      {visual === 'bifocal' && (
        <>
          <path
            d="M34 60 A26 26 0 0 0 86 60 Z"
            fill="rgb(var(--accent-rgb) / 0.28)"
            stroke="rgb(var(--accent-rgb) / 0.6)"
            strokeWidth="1"
          />
          <text x="60" y="40" textAnchor="middle" fontSize="7" fill="rgb(var(--text-muted-rgb))">loin</text>
          <text x="60" y="72" textAnchor="middle" fontSize="7" fill="rgb(var(--text-muted-rgb))">près</text>
        </>
      )}

      {/* Photochromique : la transition clair → foncé */}
      {visual === 'photochromic' && (
        <>
          <line x1="60" y1="11" x2="60" y2="79" stroke="rgb(var(--border-strong))" strokeWidth="1" strokeDasharray="2 3" />
          <text x="32" y="48" textAnchor="middle" fontSize="7" fill="rgb(var(--text-muted-rgb))">clair</text>
          <text x="88" y="48" textAnchor="middle" fontSize="7" fill="#f1f5f9">foncé</text>
        </>
      )}

      {/* Solaire : reflet lumineux sur la teinte */}
      {visual === 'sun' && (
        <ellipse cx="44" cy="32" rx="16" ry="9" fill="#ffffff" opacity="0.22" transform="rotate(-24 44 32)" />
      )}

      {/* Ordinateur : la large zone intermédiaire de travail */}
      {visual === 'computer' && (
        <>
          <rect x="30" y="34" width="60" height="22" rx="4" fill="rgb(var(--primary-rgb) / 0.16)" />
          <text x="60" y="48" textAnchor="middle" fontSize="7" fill="rgb(var(--text-muted-rgb))">écran</text>
        </>
      )}

      {/* Mi-distance : repère de profondeur */}
      {visual === 'mid' && (
        <path d="M26 50 Q60 44 94 50" fill="none" stroke="rgb(var(--primary-rgb) / 0.5)" strokeWidth="1" strokeDasharray="3 3" />
      )}
    </svg>
  );
}
