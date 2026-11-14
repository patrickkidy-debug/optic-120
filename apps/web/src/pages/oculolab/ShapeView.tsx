import { mirrorRadii, radiiToPoints, shapeStats, type Pt2 } from '@oculo/shared-types';

/**
 * Forme d'un verre (ou de la paire) en SVG, unités en mm. Sert de vignette
 * dans la liste et d'aperçu interactif dans l'éditeur.
 */
export function ShapeView({
  radii,
  pair = false,
  dbl = 18,
  showBox = false,
  oc,
  className,
  strokeWidth = 0.6,
}: {
  radii: readonly number[];
  pair?: boolean;
  dbl?: number;
  showBox?: boolean;
  /** Centres optiques (repère « x vers le nez ») à marquer, par œil. */
  oc?: { od?: Pt2; og?: Pt2 };
  className?: string;
  strokeWidth?: number;
}) {
  const st = shapeStats(radii);
  const a = st.a, b = st.b;
  // Paire vue de face : OD à gauche de l'observateur, OG à droite, séparés du pont.
  const odCx = pair ? -(a + dbl) / 2 : 0;
  const ogCx = (a + dbl) / 2;
  const eyes = pair
    ? [
        { cx: odCx, radii, sx: 1, oc: oc?.od },
        { cx: ogCx, radii: mirrorRadii(radii), sx: -1, oc: oc?.og },
      ]
    : [{ cx: 0, radii, sx: 1, oc: oc?.od }];
  const halfW = pair ? a + dbl / 2 + 3 : a / 2 + 3;
  const halfH = b / 2 + 3;
  return (
    <svg viewBox={`${-halfW} ${-halfH} ${halfW * 2} ${halfH * 2}`} className={className} role="img" aria-label={`${a.toFixed(1)} × ${b.toFixed(1)} mm`}>
      {eyes.map((e, i) => {
        const pts = radiiToPoints(e.radii, e.cx, 0);
        const d = pts.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(' ') + 'Z';
        return (
          <g key={i}>
            {showBox && (
              <rect
                x={e.cx - a / 2}
                y={-b / 2}
                width={a}
                height={b}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.3}
                strokeWidth={strokeWidth * 0.5}
                strokeDasharray="1.2 1"
              />
            )}
            <path d={d} fill="url(#oculolab-fill)" stroke="url(#oculolab-stroke)" strokeWidth={strokeWidth} strokeLinejoin="round" />
            {e.oc && (
              <g stroke="#ec4899" strokeWidth={strokeWidth * 0.8}>
                <line x1={e.cx + e.oc.x * e.sx - 2} y1={-e.oc.y} x2={e.cx + e.oc.x * e.sx + 2} y2={-e.oc.y} />
                <line x1={e.cx + e.oc.x * e.sx} y1={-e.oc.y - 2} x2={e.cx + e.oc.x * e.sx} y2={-e.oc.y + 2} />
              </g>
            )}
          </g>
        );
      })}
      <defs>
        <linearGradient id="oculolab-stroke" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.5" stopColor="#ec4899" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id="oculolab-fill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#7c3aed" stopOpacity="0.14" />
          <stop offset="1" stopColor="#f97316" stopOpacity="0.08" />
        </linearGradient>
      </defs>
    </svg>
  );
}
