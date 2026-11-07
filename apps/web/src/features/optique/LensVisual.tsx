import { useId, type ReactNode } from 'react';
import { lensVisualFor, type LensVisual as LensVisualKey } from '@oculo/shared-types';

/**
 * Illustration d'un verre « vue à travers la monture » : une scène du
 * quotidien, nette à travers le verre et floue autour, qui montre l'usage du
 * verre au premier coup d'œil :
 *  - unifocal      : une rue nette, de loin ;
 *  - progressif    : loin en haut, téléphone net en bas du verre ;
 *  - bifocal       : segment de près marqué en bas ;
 *  - ordinateur    : écran de travail net (verres de bureau, dégressifs) ;
 *  - mi-distance   : tableau de bord / distance intermédiaire ;
 *  - photochromique: verre qui fonce au soleil ;
 *  - solaire       : teinte pleine ;
 *  - lumière bleue : reflet bleu filtré devant un écran.
 * La famille manque souvent (catalogues importés) : le nom et les traitements
 * servent alors à la deviner. Purement décoratif (aria-hidden).
 */
type Scene = LensVisualKey | 'blue';

function guess(family: string | null | undefined, name = '', treatments: string[] = []): Scene {
  const txt = `${name} ${treatments.join(' ')}`.toLowerCase();
  if (family) {
    const v = lensVisualFor(family);
    if (v !== 'single') return v;
  }
  if (/d[ée]gressif|office|bureau|ordinateur|computer/.test(txt)) return 'computer';
  if (/progress/.test(txt)) return 'progressive';
  if (/bifocal|double foyer/.test(txt)) return 'bifocal';
  if (/mi-distance|interm/.test(txt)) return 'mid';
  if (/photo|transition|sensity|teinte variable/.test(txt)) return 'photochromic';
  if (/solaire|polaris|sun/.test(txt)) return 'sun';
  if (/bleu|blue|ecran|écran/.test(txt)) return 'blue';
  return family ? lensVisualFor(family) : 'single';
}

/** Contour du verre (monture épaisse, vue de face, une seule lentille). */
const LENS = 'M24 22 Q26 13 40 12 L120 12 Q136 13 137 24 L136 58 Q133 86 104 89 L56 89 Q27 86 24 58 Z';

/** Décor commun : ville au loin (ciel, immeubles rayés, rue). */
function City() {
  return (
    <g>
      <rect width="160" height="100" fill="#cfd8e3" />
      <rect width="160" height="46" fill="#dce6f0" />
      {[0, 22, 44, 66, 88, 110, 132].map((x, i) => (
        <g key={x}>
          <rect x={x} y={14 + (i % 3) * 7} width="20" height={60 - (i % 3) * 7} fill={i % 2 ? '#b7c3d1' : '#a9b6c6'} />
          {[0, 1, 2, 3, 4].map((r) => (
            <rect key={r} x={x + 4} y={20 + (i % 3) * 7 + r * 9} width="12" height="3" fill="#e9eff5" opacity=".8" />
          ))}
        </g>
      ))}
      <path d="M0 74 L160 74 L160 100 L0 100 Z" fill="#8e9aa8" />
      <path d="M78 74 L82 74 L90 100 L70 100 Z" fill="#f1f5f9" opacity=".7" />
    </g>
  );
}

function Road() {
  return (
    <g>
      <rect width="160" height="100" fill="#9fc4e8" />
      <ellipse cx="96" cy="30" rx="14" ry="6" fill="#fff" opacity=".9" />
      <ellipse cx="108" cy="27" rx="10" ry="5" fill="#fff" opacity=".9" />
      <rect y="52" width="160" height="48" fill="#b9c1ca" />
      <path d="M70 52 L90 52 L130 100 L30 100 Z" fill="#8f98a3" />
      {[58, 66, 76, 88].map((y, i) => (
        <rect key={y} x={79.5 - i * 0.6} y={y} width={1 + i * 1.2} height={3 + i * 1.5} fill="#f8fafc" />
      ))}
      <path d="M0 84 Q80 70 160 84 L160 100 L0 100 Z" fill="#2b313a" />
    </g>
  );
}

function Desk() {
  return (
    <g>
      <rect width="160" height="100" fill="#d9dee6" />
      <rect y="70" width="160" height="30" fill="#b9a38b" />
      <rect x="46" y="26" width="68" height="42" rx="3" fill="#1f2937" />
      <rect x="49" y="29" width="62" height="36" rx="1.5" fill="#e0ecff" />
      {[0, 1, 2, 3].map((r) => (
        <rect key={r} x="54" y={34 + r * 7} width={r % 2 ? 36 : 50} height="3" rx="1.5" fill="#94a3b8" />
      ))}
      <rect x="40" y="68" width="80" height="4" rx="2" fill="#374151" />
    </g>
  );
}

function Phone({ x = 66, y = 58, glow = false }: { x?: number; y?: number; glow?: boolean }) {
  return (
    <g>
      {glow && <rect x={x - 6} y={y - 6} width="40" height="50" rx="10" fill="#60a5fa" opacity=".35" />}
      <rect x={x} y={y} width="28" height="40" rx="5" fill="#111827" />
      <rect x={x + 2} y={y + 3} width="24" height="35" rx="3.5" fill="url(#phoneScreen)" />
      <text x={x + 14} y={y + 16} textAnchor="middle" fontSize="7" fontWeight="700" fill="#1e293b" fontFamily="Arial, sans-serif">
        12:30
      </text>
    </g>
  );
}

export function LensVisual({
  family,
  name,
  treatments,
  className = '',
}: {
  family: string | null | undefined;
  /** Nom du verre : sert à deviner l'usage quand la famille n'est pas renseignée. */
  name?: string;
  treatments?: string[];
  className?: string;
}) {
  const scene = guess(family, name, treatments);
  const id = useId().replace(/:/g, '');
  const ar = /anti-?reflet|ar\b|hmc|crizal|reflet/i.test(`${name ?? ''} ${(treatments ?? []).join(' ')}`);

  const background: ReactNode =
    scene === 'mid' || scene === 'sun' ? <Road /> : scene === 'computer' ? <Desk /> : <City />;
  const nearPhone = scene === 'progressive' || scene === 'bifocal' || scene === 'blue';

  return (
    <svg viewBox="0 0 160 100" className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <defs>
        <clipPath id={`${id}-lens`}>
          <path d={LENS} />
        </clipPath>
        <filter id={`${id}-blur`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <linearGradient id="phoneScreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bae6fd" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id={`${id}-photo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3f3a36" stopOpacity=".72" />
          <stop offset=".55" stopColor="#5b524b" stopOpacity=".45" />
          <stop offset="1" stopColor="#7a7068" stopOpacity=".12" />
        </linearGradient>
        <linearGradient id={`${id}-prog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
          <stop offset=".62" stopColor="#fff" stopOpacity=".18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Autour du verre : la scène floue et désaturée */}
      <g filter={`url(#${id}-blur)`} opacity=".7">
        {background}
        {nearPhone && <g opacity=".9"><Phone x={66} y={58} /></g>}
      </g>
      <rect width="160" height="100" fill="#eef1f5" opacity=".45" />

      {/* À travers le verre : la même scène, nette */}
      <g clipPath={`url(#${id}-lens)`}>
        {background}
        {/* Progressif / bifocal / lumière bleue : le téléphone net en bas du verre */}
        {nearPhone && <Phone x={66} y={58} glow={scene === 'blue'} />}
        {scene === 'progressive' && <rect width="160" height="100" fill={`url(#${id}-prog)`} />}
        {scene === 'bifocal' && <path d="M58 89 Q60 62 90 60 Q120 62 122 89 Z" fill="#fff" opacity=".22" stroke="#fff" strokeOpacity=".7" strokeWidth="1" />}
        {scene === 'photochromic' && <rect width="160" height="100" fill={`url(#${id}-photo)`} />}
        {scene === 'sun' && <rect width="160" height="100" fill="#4a3426" opacity=".55" />}
        {scene === 'blue' && <path d={LENS} fill="none" stroke="#60a5fa" strokeOpacity=".55" strokeWidth="6" />}
        {/* Reflet : léger, plus marqué pour l'anti-reflet absent */}
        <path d="M34 30 Q60 16 96 18" fill="none" stroke="#fff" strokeOpacity={ar ? 0.25 : 0.45} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Soleil pour les verres qui foncent / solaires */}
      {(scene === 'photochromic' || scene === 'sun') && (
        <g>
          <circle cx="146" cy="10" r="7" fill="#fbbf24" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <rect key={a} x="145" y="-3" width="2" height="5" rx="1" fill="#fbbf24" transform={`rotate(${a} 146 10)`} />
          ))}
        </g>
      )}

      {/* Monture épaisse noire + amorce du pont et de la branche */}
      <path d={LENS} fill="none" stroke="#141414" strokeWidth="7" strokeLinejoin="round" />
      <path d="M137 26 L160 22" stroke="#141414" strokeWidth="7" strokeLinecap="round" />
      <path d="M24 28 Q12 26 0 30" stroke="#141414" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
