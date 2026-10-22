/**
 * Décor « fluide technologique » de la marque : nuit violette profonde avec
 * halos et aurore lumineuse, ruban liquide, bulles irisées en verre liquide
 * (violet → rose → orange, reflet cyan) sur deux plans de profondeur, et
 * réseau de points lumineux. Purement décoratif (aria-hidden), sans image et
 * sans animation : rien ne bouge, pour garder des pages légères.
 */

/** Une bulle : position (%), taille (px), plan (net ou flou au loin) et rythme. */
interface Blob {
  left: string;
  top: string;
  size: number;
  far?: boolean;
  /** Palette : couleur de cœur, reflet bas, reflet haut (voir PALETTES). */
  palette: number;
  delay: number;
  duration: number;
}

/** Palettes irisées de la marque : cœur, reflet bas, reflet haut. */
const PALETTES: [string, string, string][] = [
  ['#c026d3', '#fb923c', '#67e8f9'],
  ['#7c3aed', '#ec4899', '#a5f3fc'],
  ['#db2777', '#fbbf24', '#c4b5fd'],
  ['#9333ea', '#f472b6', '#fde68a'],
];

const BLOBS_RIGHT: Blob[] = [
  { left: '58%', top: '-6%', size: 260, far: true, palette: 0, delay: 0, duration: 18 },
  { left: '66%', top: '8%', size: 150, palette: 0, delay: -3, duration: 14 },
  { left: '86%', top: '26%', size: 96, palette: 2, delay: -6, duration: 12 },
  { left: '72%', top: '58%', size: 210, palette: 0, delay: -2, duration: 16 },
  { left: '90%', top: '74%', size: 80, palette: 1, delay: -8, duration: 11 },
  { left: '52%', top: '80%', size: 120, far: true, palette: 3, delay: -5, duration: 15 },
];

const BLOBS_SPREAD: Blob[] = [
  { left: '-8%', top: '-10%', size: 240, palette: 0, delay: 0, duration: 17 },
  { left: '70%', top: '2%', size: 150, palette: 1, delay: -4, duration: 13 },
  { left: '40%', top: '30%', size: 300, far: true, palette: 3, delay: -6, duration: 20 },
  { left: '78%', top: '72%', size: 190, palette: 0, delay: -7, duration: 15 },
  { left: '2%', top: '74%', size: 120, palette: 1, delay: -2, duration: 12 },
];

/** Points du réseau (coordonnées en % de la zone). */
const NODES: [number, number][] = [
  [8, 14], [22, 30], [14, 52], [30, 72], [46, 18], [58, 40], [52, 64], [70, 22],
  [76, 48], [88, 30], [92, 66], [70, 84], [38, 88], [24, 92],
];
const LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [3, 6], [4, 7], [7, 8], [5, 8],
  [7, 9], [8, 10], [6, 11], [10, 11], [11, 12], [12, 13], [3, 13], [8, 9],
];

export function FluidScene({ layout = 'right', className = '' }: { layout?: 'right' | 'spread'; className?: string }) {
  const blobs = layout === 'right' ? BLOBS_RIGHT : BLOBS_SPREAD;
  const ribbon =
    layout === 'right'
      ? 'M 38 108 C 52 78, 48 58, 66 44 S 92 22, 104 -6'
      : 'M -6 82 C 18 62, 34 74, 52 54 S 84 18, 106 10';
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Fond : nuit violette profonde, halos de la marque */}
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#07031a_0%,#140735_40%,#24094f_72%,#2e0b5e_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_82%_8%,rgba(124,58,237,0.55)_0%,transparent_70%),radial-gradient(50%_45%_at_8%_92%,rgba(219,39,119,0.35)_0%,transparent_70%),radial-gradient(40%_40%_at_96%_96%,rgba(249,115,22,0.28)_0%,transparent_70%)]" />
      {/* Aurore : lumière tournante très douce */}
      <div className="absolute left-1/2 top-1/2 h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 opacity-[0.22] blur-[90px] [background:conic-gradient(from_0deg,#7c3aed,#d946ef,#f97316,#22d3ee,#7c3aed)]" />

      {/* Ruban liquide lumineux */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="fluid-ribbon" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0" />
            <stop offset="25%" stopColor="#a855f7" />
            <stop offset="55%" stopColor="#ec4899" />
            <stop offset="80%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={ribbon} fill="none" stroke="url(#fluid-ribbon)" strokeWidth="16" strokeLinecap="round" opacity="0.18" style={{ filter: 'blur(6px)' }} vectorEffect="non-scaling-stroke" />
        <path d={ribbon} fill="none" stroke="url(#fluid-ribbon)" strokeWidth="5" strokeLinecap="round" opacity="0.55" vectorEffect="non-scaling-stroke" />
        <path d={ribbon} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1" strokeLinecap="round" opacity="0.5" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* Réseau de points lumineux */}
      <svg className="absolute inset-0 h-full w-full opacity-50" preserveAspectRatio="none" viewBox="0 0 100 100">
        {LINKS.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={NODES[a][0]}
            y1={NODES[a][1]}
            x2={NODES[b][0]}
            y2={NODES[b][1]}
            stroke="rgba(216,180,254,0.25)"
            strokeWidth="0.12"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {NODES.map(([x, y], i) => (
        <span
          key={i}
          className="fluid-node absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_3px_rgba(216,180,254,0.8)]"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}

      {/* Bulles irisées : plan lointain flou, premier plan net */}
      {blobs.map((b, i) => (
        <span
          key={i}
          className={`fluid-blob absolute ${b.far ? 'fluid-blob-far' : ''}`}
          style={{
            left: b.left,
            top: b.top,
            // Taille modulée par --fluid-k (réduite sur téléphone, voir index.css).
            width: `calc(${b.size}px * var(--fluid-k, 1))`,
            height: `calc(${b.size}px * var(--fluid-k, 1))`,
            ['--c1' as string]: PALETTES[b.palette][0],
            ['--c2' as string]: PALETTES[b.palette][1],
            ['--c3' as string]: PALETTES[b.palette][2],
          }}
        />
      ))}

      {/* Trame fine et vignettage */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_55%,rgba(5,2,20,0.55)_100%)]" />
    </div>
  );
}
