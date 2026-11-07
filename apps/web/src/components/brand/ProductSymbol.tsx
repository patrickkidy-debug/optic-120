import clsx from 'clsx';
import { FRAME_COLORS } from '@oculo/shared-types';
import { FRAME_SILHOUETTES, SHAPE_TO_SILHOUETTE, SILHOUETTE_KEYS } from './frameSilhouettes';
import { LensVisual } from '../../features/optique/LensVisual';

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

/** Monture solaire reconnue à son nom (« Solaire », « Sun », « Polarisé »…). */
const SUN_RE = /solaire|soleil|\bsun\b|sunglass|polaris/i;

/** Octogone d'un verre solaire, centré sur (cx, cy). */
function octagon(cx: number, cy: number, rx: number, ry: number): string {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = ((22.5 + i * 45) * Math.PI) / 180;
    return `${(cx + rx * Math.cos(a)).toFixed(2)},${(cy + ry * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join(' L')} Z`;
}

/**
 * Icône de monture solaire : cerclage octogonal noir, pont métal double,
 * branches fines et verres en dégradé brun → bleu, avec reflet.
 */
function SunFrame({ id }: { id: string }) {
  const L = octagon(39, 35, 17, 16);
  const R = octagon(81, 35, 17, 16);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3330" />
          <stop offset=".55" stopColor="#5b6670" />
          <stop offset="1" stopColor="#8fb7cf" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="58" rx="40" ry="2.2" fill={INK} opacity=".07" />
      {/* Branches */}
      <path d="M22 27 L8 25.5 M98 27 L112 25.5" stroke="#1a1a1a" strokeWidth="2.6" strokeLinecap="round" />
      {/* Verres teintés */}
      <path d={L} fill={`url(#${id}-sun)`} />
      <path d={R} fill={`url(#${id}-sun)`} />
      <path d="M28 27 L40 22" stroke="#fff" strokeOpacity=".35" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M70 27 L82 22" stroke="#fff" strokeOpacity=".35" strokeWidth="2.4" strokeLinecap="round" />
      {/* Cerclage acétate noir */}
      <path d={L} fill="none" stroke="#141414" strokeWidth="4.2" strokeLinejoin="round" />
      <path d={R} fill="none" stroke="#141414" strokeWidth="4.2" strokeLinejoin="round" />
      {/* Pont métal double */}
      <path d="M55 26 Q60 23.5 65 26" fill="none" stroke="#2a2a2a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M54.5 21.5 H65.5" stroke="#2a2a2a" strokeWidth="1.6" strokeLinecap="round" />
    </g>
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
  if (family === 'VERRE') {
    return (
      <div aria-hidden className={clsx('relative overflow-hidden bg-white', className)}>
        <LensVisual family={null} name={name ?? undefined} className="absolute inset-0 h-full w-full" />
      </div>
    );
  }
  const h = hash(`${seed ?? ''}|${name ?? ''}|${family}`);
  const pal = PALETTE[h % PALETTE.length]!;
  const pid = `ps-${h.toString(36)}`;
  const mono = initials(brand, name);

  // Silhouette : celle de la forme enregistrée, sinon tirée de la référence.
  const silKey = SHAPE_TO_SILHOUETTE[shape ?? ''] ?? SILHOUETTE_KEYS[(h >>> 9) % SILHOUETTE_KEYS.length]!;
  const sil = FRAME_SILHOUETTES[silKey]!;
  // Montures toujours en noir : une seule couleur, plus sobre (demande boutique).
  void color;
  const frameColor = '#141414';
  const light = false;
  const sun = SUN_RE.test(`${name ?? ''} ${shape ?? ''}`);
  // Monture à ~78 % de la largeur, centrée.
  const k = Math.min(94 / sil.w, 40 / sil.h);
  const fx = 60 - (sil.w * k) / 2;
  const fy = 36 - (sil.h * k) / 2;

  return (
    <div aria-hidden className={clsx('relative overflow-hidden bg-white', className)}>
      <svg viewBox="0 0 120 68" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
        {mono && (
          <g>
            <rect x="5" y="5" width={mono.length * 6.4 + 7} height="11" rx="5.5" fill={pal.bg} />
            <text x={8.5} y="13" fontFamily="Bungee, Oxanium, sans-serif" fontSize="7" fill={pal.deep} letterSpacing=".4">
              {mono}
            </text>
          </g>
        )}
        {family === 'MONTURE' && sun ? (
          <SunFrame id={pid} />
        ) : family === 'MONTURE' ? (
          <g>
            {/* Ombre douce sous la monture. */}
            <ellipse cx="60" cy={fy + sil.h * k + 5} rx={sil.w * k * 0.42} ry="2.2" fill={INK} opacity=".07" />
            <path
              d={sil.d}
              transform={`translate(${fx} ${fy}) scale(${k})`}
              fill={frameColor}
              fillRule="evenodd"
              stroke={light ? INK : 'none'}
              strokeOpacity=".55"
              strokeWidth={light ? 0.9 / k : 0}
              strokeLinejoin="round"
            />
          </g>
        ) : (
          <g transform="translate(60 35) scale(.68) translate(-60 -34)" style={{ color: pal.deep }}>
            {GLYPHS[family]}
          </g>
        )}
      </svg>
    </div>
  );
}
