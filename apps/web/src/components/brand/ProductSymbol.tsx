import clsx from 'clsx';
import { FRAME_COLORS, FRAME_SHAPES } from '@oculo/shared-types';

/**
 * Vignette d'un produit, sans photo : une illustration « sticker » propre à
 * CHAQUE article plutôt qu'un pictogramme identique partout.
 *
 * - Monture : la silhouette suit la forme enregistrée (ronde, aviateur,
 *   cat-eye…) et se dessine dans la couleur réelle de la monture ; à défaut,
 *   forme et couleur sont tirées de façon stable de la référence.
 * - Fond pastel, motif et monogramme de la marque varient d'un produit à
 *   l'autre : deux montures voisines ne se ressemblent jamais.
 * - Autres familles : pictogramme à l'encre sur fond pastel, même principe.
 */
type Family = 'MONTURE' | 'VERRE' | 'LENTILLE' | 'ACCESSOIRE' | 'ENTRETIEN' | 'SERVICE' | 'AUTRE';
type Shape = (typeof FRAME_SHAPES)[number];

const INK = '#1a1033';
/** Pastels des modules Arcade Pro (fond) et leur teinte soutenue (motif, monogramme). */
const PALETTE = [
  { bg: '#ede9fe', deep: '#7c3aed' },
  { bg: '#fce7f3', deep: '#db2777' },
  { bg: '#ffedd5', deep: '#ea580c' },
  { bg: '#e0f2fe', deep: '#0284c7' },
  { bg: '#d1fae5', deep: '#059669' },
  { bg: '#fef3c7', deep: '#d97706' },
];
const PATTERNS = ['dots', 'stripes', 'grid', 'waves'] as const;
/** Couleurs de monture tirées au hasard quand aucune n'est renseignée. */
const FALLBACK_FRAME_COLORS = ['#111827', '#8b5e34', '#2563eb', '#dc2626', '#7c3aed', '#16a34a', '#d4af37', '#ec4899'];

/** Hachage FNV-1a : stable d'un rendu à l'autre pour une même référence. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initials(brand?: string | null, name?: string | null): string {
  const src = (brand || name || '').trim();
  if (!src) return '';
  const words = src.split(/[\s\-&.]+/).filter(Boolean);
  const two = words.length > 1 ? words[0]![0]! + words[1]![0]! : src.slice(0, 2);
  return two.toUpperCase();
}

/** Clair = contour sombre nécessaire pour rester lisible sur le pastel. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 190;
}

/** Contour d'un verre (centre cx, cy) selon la forme de la monture. */
function lens(shape: Shape, cx: number, cy: number, left: boolean): string {
  const s = left ? -1 : 1; // côté extérieur : -1 à gauche, +1 à droite
  switch (shape) {
    case 'Ronde':
      return `M${cx - 15} ${cy}a15 15 0 1 0 30 0a15 15 0 1 0 -30 0z`;
    case 'Ovale':
      return `M${cx - 18} ${cy}a18 12 0 1 0 36 0a18 12 0 1 0 -36 0z`;
    case 'Carrée':
      return `M${cx - 15} ${cy - 13}h30q3 0 3 3v20q0 6 -6 6h-24q-6 0 -6 -6v-20q0 -3 3 -3z`;
    case 'Papillon': {
      const o = cx + s * 19, i = cx - s * 15;
      return `M${i} ${cy - 11}L${o} ${cy - 14}Q${o + s * 2} ${cy + 2} ${cx + s * 8} ${cy + 13}Q${cx} ${cy + 15} ${i} ${cy + 5}Z`;
    }
    case 'Aviateur': {
      const o = cx + s * 18, i = cx - s * 15;
      return `M${i} ${cy - 11}L${o} ${cy - 11}Q${o + s * 1} ${cy + 8} ${cx + s * 4} ${cy + 15}Q${i - s * 3} ${cy + 12} ${i} ${cy - 11}Z`;
    }
    case 'Pantos':
      return `M${cx - 16} ${cy - 10}h32q1 0 1 3q0 20 -17 20q-17 0 -17 -20q0 -3 1 -3z`;
    case 'Cat-eye': {
      const o = cx + s * 19, i = cx - s * 15;
      return `M${i} ${cy - 6}Q${cx} ${cy - 12} ${o} ${cy - 15}Q${o - s * 1} ${cy + 6} ${cx + s * 6} ${cy + 12}Q${i - s * 1} ${cy + 12} ${i} ${cy - 6}Z`;
    }
    case 'Sans monture':
    case 'Rectangulaire':
    default:
      return `M${cx - 18} ${cy - 10}h36q3 0 3 3v12q0 7 -7 7h-28q-7 0 -7 -7v-12q0 -3 3 -3z`;
  }
}

function Frame({ shape, color }: { shape: Shape; color: string }) {
  const light = isLight(color);
  const rimless = shape === 'Sans monture';
  const L = lens(shape, 38, 34, true);
  const R = lens(shape, 82, 34, false);
  const bridge = shape === 'Aviateur' ? 'M53 27q7 -5 14 0M54 22h12' : shape === 'Ronde' ? 'M53 32q7 -6 14 0' : 'M56 30q4 -4 8 0';
  const sw = rimless ? 2 : 5;
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* Verres teintés, avec un reflet. */}
      <path d={L} fill="#ffffff" fillOpacity=".55" />
      <path d={R} fill="#ffffff" fillOpacity=".55" />
      {/* Contour sombre sous la couleur claire (or, argent, transparent…). */}
      {light && !rimless && (
        <g fill="none" stroke={INK} strokeWidth={sw + 3}>
          <path d={L} />
          <path d={R} />
        </g>
      )}
      <g fill="none" stroke={rimless ? INK : color} strokeWidth={sw} strokeDasharray={rimless ? '3 3' : undefined}>
        <path d={L} />
        <path d={R} />
      </g>
      <g fill="none" stroke={light ? INK : color} strokeWidth={4}>
        <path d={bridge} />
        <path d="M20 28l-12 -6M100 28l12 -6" />
      </g>
      <g fill="none" stroke="#fff" strokeWidth="2.6" strokeOpacity=".9">
        <path d="M27 30q4 -5 10 -5" />
        <path d="M71 30q4 -5 10 -5" />
      </g>
    </g>
  );
}

const GLYPHS: Record<Exclude<Family, 'MONTURE'>, JSX.Element> = {
  VERRE: (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <ellipse cx="60" cy="34" rx="17" ry="21" strokeWidth="4.5" fill="#fff" fillOpacity=".5" />
      <path d="M52 22q-5 12 0 24" strokeWidth="3" strokeOpacity=".6" />
      <path d="M86 14v8M82 18h8" strokeWidth="3" />
    </g>
  ),
  LENTILLE: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M40 40q20 -26 40 0" strokeWidth="4.5" />
      <path d="M40 40q20 8 40 0" strokeWidth="4.5" fill="#fff" fillOpacity=".5" />
      <path d="M50 32q4 -5 10 -6" strokeWidth="3" strokeOpacity=".6" />
    </g>
  ),
  ACCESSOIRE: (
    <g fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="30" y="20" width="60" height="28" rx="14" fill="#fff" fillOpacity=".5" />
      <path d="M30 34h60" strokeWidth="3" strokeOpacity=".6" />
      <circle cx="60" cy="34" r="3.5" fill="currentColor" stroke="none" />
    </g>
  ),
  ENTRETIEN: (
    <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M52 24h14v28a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3z" fill="#fff" fillOpacity=".5" />
      <path d="M54 24v-7h10v7M64 17h7l4 4" />
      <path d="M80 12l5-2M81 19h6M80 26l5 2" strokeWidth="3" strokeOpacity=".7" />
    </g>
  ),
  SERVICE: (
    <g fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M68 14a10 10 0 0 0-12 12L42 40a4.5 4.5 0 0 0 6.5 6.5L62 32a10 10 0 0 0 12-12l-7 7-5.5-1-1-5.5z" fill="#fff" fillOpacity=".5" />
    </g>
  ),
  AUTRE: (
    <g fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M40 22l20-10 20 10v22L60 54 40 44z" fill="#fff" fillOpacity=".5" />
      <path d="M40 22l20 10 20-10M60 32v22" strokeOpacity=".7" />
    </g>
  ),
};

function Pattern({ id, kind, color }: { id: string; kind: (typeof PATTERNS)[number]; color: string }) {
  return (
    <defs>
      <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform={kind === 'stripes' ? 'rotate(35)' : undefined}>
        {kind === 'dots' && <circle cx="2" cy="2" r="1.1" fill={color} />}
        {kind === 'stripes' && <rect width="3" height="10" fill={color} />}
        {kind === 'grid' && <path d="M10 0H0V10" fill="none" stroke={color} strokeWidth="0.8" />}
        {kind === 'waves' && <path d="M0 5q2.5 -3 5 0t5 0" fill="none" stroke={color} strokeWidth="0.9" />}
      </pattern>
    </defs>
  );
}

export function ProductSymbol({
  category,
  className,
  seed,
  name,
  brand,
  shape,
  color,
}: {
  category?: string | null;
  className?: string;
  /** Identifiant stable (référence, id) qui fixe les variations. */
  seed?: string | null;
  name?: string | null;
  brand?: string | null;
  /** Monture : forme enregistrée (FRAME_SHAPES). */
  shape?: string | null;
  /** Monture : couleur enregistrée (nom de FRAME_COLORS ou #hex). */
  color?: string | null;
}) {
  const family: Family = (category as Family) && ['MONTURE', 'VERRE', 'LENTILLE', 'ACCESSOIRE', 'ENTRETIEN', 'SERVICE'].includes(category as string) ? (category as Family) : 'AUTRE';
  const h = hash(`${seed ?? ''}|${name ?? ''}|${family}`);
  const pal = PALETTE[h % PALETTE.length]!;
  const pattern = PATTERNS[(h >>> 3) % PATTERNS.length]!;
  const tilt = ((h >>> 6) % 11) - 5; // -5° à +5°
  const pid = `ps-${h.toString(36)}`;
  const mono = initials(brand, name);

  const frameShape: Shape = (FRAME_SHAPES as readonly string[]).includes(shape ?? '')
    ? (shape as Shape)
    : FRAME_SHAPES.filter((s) => s !== 'Sans monture')[(h >>> 9) % (FRAME_SHAPES.length - 1)]!;
  const frameColor =
    (color?.startsWith('#') ? color : FRAME_COLORS.find((c) => c.name === color)?.hex) ??
    FALLBACK_FRAME_COLORS[(h >>> 12) % FALLBACK_FRAME_COLORS.length]!;

  return (
    <div aria-hidden className={clsx('relative overflow-hidden', className)} style={{ background: pal.bg }}>
      <svg viewBox="0 0 120 68" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <Pattern id={pid} kind={pattern} color={pal.deep} />
        <rect width="120" height="68" fill={`url(#${pid})`} opacity=".14" />
        {/* Pastille de couleur décalée derrière l'objet, façon autocollant. */}
        <ellipse cx={60 + (tilt > 0 ? 6 : -6)} cy="38" rx="44" ry="20" fill={pal.deep} opacity=".12" />
        {mono && (
          <text
            x="114"
            y="58"
            textAnchor="end"
            fontFamily="Bungee, Oxanium, sans-serif"
            fontSize="19"
            fill={pal.deep}
            opacity=".22"
          >
            {mono}
          </text>
        )}
        <g transform={`rotate(${tilt} 60 34)`} style={{ color: INK }}>
          {family === 'MONTURE' ? <Frame shape={frameShape} color={frameColor} /> : GLYPHS[family]}
        </g>
      </svg>
    </div>
  );
}
