import { useId, type ReactNode } from 'react';
import { lensVisualFor, type LensVisual as LensVisualKey } from '@oculo/shared-types';

/**
 * Icône d'un verre, style Arcade Pro : un verre « objet » (épaisseur, reflet,
 * ombre décalée) sur un fond pastel propre à son usage, et de petits symboles
 * blancs placés dans les zones du verre :
 *  - unifocal       : une seule zone nette ;
 *  - progressif     : loin / écran / lecture, du haut vers le bas ;
 *  - bifocal        : loin en haut, segment de lecture marqué en bas ;
 *  - ordinateur     : large zone écran ;
 *  - mi-distance    : route / distance intermédiaire ;
 *  - photochromique : moitié claire, moitié teintée, soleil ;
 *  - solaire        : teinte pleine, soleil ;
 *  - lumière bleue  : écran et halo bleu filtré.
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
  if (/solaire|polaris/.test(txt)) return 'sun';
  if (/bleu|blue/.test(txt)) return 'blue';
  return family ? lensVisualFor(family) : 'single';
}

/** Couleurs par usage : fond pastel, teinte du verre, couleur d'accent. */
const THEME: Record<Scene, { bg: [string, string]; glass: [string, string]; ink: string }> = {
  single: { bg: ['#ede9fe', '#ddd6fe'], glass: ['#ffffff', '#a78bfa'], ink: '#7c3aed' },
  progressive: { bg: ['#fce7f3', '#ede9fe'], glass: ['#a78bfa', '#f472b6'], ink: '#7c3aed' },
  bifocal: { bg: ['#ffedd5', '#fce7f3'], glass: ['#ffffff', '#fb923c'], ink: '#ea580c' },
  computer: { bg: ['#e0f2fe', '#ede9fe'], glass: ['#ffffff', '#38bdf8'], ink: '#0284c7' },
  mid: { bg: ['#d1fae5', '#e0f2fe'], glass: ['#ffffff', '#34d399'], ink: '#059669' },
  photochromic: { bg: ['#fef3c7', '#ffedd5'], glass: ['#ffffff', '#a8a29e'], ink: '#b45309' },
  sun: { bg: ['#ffedd5', '#fef3c7'], glass: ['#92400e', '#292524'], ink: '#c2410c' },
  blue: { bg: ['#dbeafe', '#e0e7ff'], glass: ['#ffffff', '#60a5fa'], ink: '#2563eb' },
};

const W = 'rgba(255,255,255,0.96)';

/* Petits symboles blancs, centrés sur (x, y). */
const Mountain = ({ x, y }: { x: number; y: number }) => (
  <path d={`M${x - 9} ${y + 5} L${x - 3} ${y - 4} L${x + 1} ${y + 1} L${x + 4} ${y - 2} L${x + 9} ${y + 5} Z`} fill={W} />
);
const Laptop = ({ x, y }: { x: number; y: number }) => (
  <g fill="none" stroke={W} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x={x - 7} y={y - 5} width="14" height="9" rx="1.5" />
    <path d={`M${x - 10} ${y + 6.5} H${x + 10}`} />
  </g>
);
const Book = ({ x, y }: { x: number; y: number }) => (
  <g fill="none" stroke={W} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={`M${x} ${y - 4} Q${x - 5} ${y - 6} ${x - 9} ${y - 4} V${y + 5} Q${x - 5} ${y + 3} ${x} ${y + 5} Q${x + 5} ${y + 3} ${x + 9} ${y + 5} V${y - 4} Q${x + 5} ${y - 6} ${x} ${y - 4} Z`} />
    <path d={`M${x} ${y - 4} V${y + 5}`} />
  </g>
);
const Road = ({ x, y }: { x: number; y: number }) => (
  <g>
    <path d={`M${x - 3} ${y - 7} H${x + 3} L${x + 9} ${y + 7} H${x - 9} Z`} fill={W} />
    <path d={`M${x} ${y - 5} V${y - 2} M${x} ${y + 1} V${y + 5}`} stroke="rgba(0,0,0,0.25)" strokeWidth="1.4" strokeLinecap="round" />
  </g>
);
const Sun = ({ x, y, c }: { x: number; y: number; c: string }) => (
  <g>
    <circle cx={x} cy={y} r="6" fill={c} />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <rect key={a} x={x - 1} y={y - 12} width="2" height="4" rx="1" fill={c} transform={`rotate(${a} ${x} ${y})`} />
    ))}
  </g>
);
const Phone = ({ x, y }: { x: number; y: number }) => (
  <g fill="none" stroke={W} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x={x - 6} y={y - 8} width="12" height="16" rx="2.5" />
    <path d={`M${x - 2} ${y + 5} H${x + 2}`} />
  </g>
);

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
  const th = THEME[scene];
  const id = useId().replace(/:/g, '');
  const u = (k: string) => `${id}-${k}`;

  const cx = 80, cy = 50, rx = 40, ry = 34;
  let zones: ReactNode;
  switch (scene) {
    case 'progressive':
      zones = (
        <>
          {/* Couloir de progression : loin (haut) → écran → lecture (bas) */}
          <path d={`M${cx - 13} ${cy - 32} Q${cx} ${cy} ${cx - 7} ${cy + 32} L${cx + 7} ${cy + 32} Q${cx} ${cy} ${cx + 13} ${cy - 32} Z`} fill="#fff" opacity=".2" />
          <Mountain x={cx} y={cy - 19} />
          <Laptop x={cx} y={cy + 1} />
          <Book x={cx} y={cy + 21} />
        </>
      );
      break;
    case 'bifocal':
      zones = (
        <>
          <Mountain x={cx} y={cy - 12} />
          <path d={`M${cx - 20} ${cy + 13} Q${cx} ${cy + 5} ${cx + 20} ${cy + 13} Q${cx + 18} ${cy + 28} ${cx} ${cy + 29} Q${cx - 18} ${cy + 28} ${cx - 20} ${cy + 13} Z`} fill="#fff" opacity=".32" stroke="#fff" strokeWidth="1.5" />
          <Book x={cx} y={cy + 19} />
        </>
      );
      break;
    case 'computer':
      zones = (
        <>
          <rect x={cx - 30} y={cy - 13} width="60" height="27" rx="13.5" fill="#fff" opacity=".22" />
          <Laptop x={cx} y={cy} />
          <Book x={cx} y={cy + 23} />
        </>
      );
      break;
    case 'mid':
      zones = (
        <>
          <Road x={cx} y={cy - 5} />
          <Laptop x={cx} y={cy + 19} />
        </>
      );
      break;
    case 'photochromic':
      zones = <Mountain x={cx - 12} y={cy + 6} />;
      break;
    case 'sun':
      zones = <Mountain x={cx} y={cy + 6} />;
      break;
    case 'blue':
      zones = <Phone x={cx} y={cy + 2} />;
      break;
    default:
      zones = (
        <>
          <circle cx={cx} cy={cy} r="14" fill="none" stroke="#fff" strokeWidth="2.2" opacity=".9" />
          <circle cx={cx} cy={cy} r="3.2" fill="#fff" />
          <path d={`M${cx - 26} ${cy} H${cx - 18} M${cx + 18} ${cy} H${cx + 26} M${cx} ${cy - 26} V${cy - 18} M${cx} ${cy + 18} V${cy + 26}`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
        </>
      );
  }

  return (
    <svg viewBox="0 0 160 100" className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={u('bg')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={th.bg[0]} />
          <stop offset="1" stopColor={th.bg[1]} />
        </linearGradient>
        <linearGradient id={u('glass')} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={th.glass[0]} stopOpacity={scene === 'sun' ? 0.95 : 0.5} />
          <stop offset="1" stopColor={th.glass[1]} stopOpacity="1" />
        </linearGradient>
        {/* Photochromique : teinté en haut à droite, clair en bas à gauche */}
        <linearGradient id={u('photo')} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#292524" stopOpacity=".9" />
          <stop offset=".5" stopColor="#57534e" stopOpacity=".5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={u('glow')} cx=".5" cy=".5" r=".5">
          <stop offset=".55" stopColor="#2563eb" stopOpacity="0" />
          <stop offset="1" stopColor="#2563eb" stopOpacity=".6" />
        </radialGradient>
        <clipPath id={u('clip')}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        </clipPath>
      </defs>

      <rect width="160" height="100" fill={`url(#${u('bg')})`} />
      {[[18, 18], [142, 16], [146, 84], [14, 82], [28, 50], [134, 52]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" fill={th.ink} opacity=".2" />
      ))}

      {/* Ombre décalée (Arcade Pro) et tranche du verre */}
      <ellipse cx={cx + 6} cy={cy + 6} rx={rx} ry={ry} fill={th.ink} opacity=".25" />
      <ellipse cx={cx} cy={cy + 2} rx={rx} ry={ry} fill={th.ink} opacity=".45" />

      <g clipPath={`url(#${u('clip')})`}>
        <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} fill={`url(#${u('glass')})`} />
        {scene === 'photochromic' && <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} fill={`url(#${u('photo')})`} />}
        {scene === 'blue' && <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${u('glow')})`} />}
        {zones}
        {/* Reflets */}
        <path d={`M${cx - 29} ${cy - 12} Q${cx - 24} ${cy - 27} ${cx - 6} ${cy - 30}`} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".7" />
        <circle cx={cx - 31} cy={cy - 2} r="2" fill="#fff" opacity=".65" />
      </g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#fff" strokeWidth="2.5" opacity=".95" />

      {(scene === 'photochromic' || scene === 'sun') && <Sun x={cx + 38} y={cy - 28} c="#f59e0b" />}
      {scene === 'blue' && (
        <g stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" opacity=".7">
          <path d={`M${cx + 46} ${cy - 18} l8 -6 M${cx + 48} ${cy - 4} h9 M${cx + 46} ${cy + 10} l8 6`} />
        </g>
      )}
    </svg>
  );
}
