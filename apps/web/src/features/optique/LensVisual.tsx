import { useId, type ReactNode } from 'react';
import { lensVisualFor, type LensVisual as LensVisualKey } from '@oculo/shared-types';

/**
 * Icône d'un verre : un vrai verre rond « détouré » (biseau, reflet, ombre
 * douce), clair ou teinté selon le type, avec les marquages de centrage des
 * verres progressifs (croix de montage, cercle de loin, point de prisme,
 * cercle de près, lignes d'horizontalité, micro-gravures et indice).
 *  - clair     : unifocal, bureau, mi-distance, progressif, bifocal ;
 *  - dégradé   : photochromique (foncé en haut, clair en bas) ;
 *  - teinté    : solaire (gris ou brun selon la teinte) ;
 *  - reflet    : anti-reflet (vert-violet) / anti-lumière bleue (bleuté).
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

export function LensVisual({
  family,
  name,
  treatments,
  index,
  tint,
  className = '',
}: {
  family: string | null | undefined;
  /** Nom du verre : sert à deviner l'usage quand la famille n'est pas renseignée. */
  name?: string;
  treatments?: string[];
  /** Indice gravé sur les verres progressifs (ex. « 1.67 »). */
  index?: string;
  /** Teinte (« Brun »…) pour les verres solaires. */
  tint?: string;
  className?: string;
}) {
  const scene = guess(family, name, treatments);
  const id = useId().replace(/:/g, '');
  const u = (k: string) => `${id}-${k}`;
  const txt = `${name ?? ''} ${(treatments ?? []).join(' ')}`;
  const blue = scene === 'blue' || /bleu|blue/i.test(txt);
  const ar = !blue && /anti-?reflet|\bhmc\b|crizal|\bar\b/i.test(txt);
  const brown = /brun|brown|marron/i.test(`${tint ?? ''} ${name ?? ''}`);
  const idx = index || /\b1[.,](50|5|56|60|6|67|74)\b/.exec(name ?? '')?.[0]?.replace(',', '.') || '';

  const cx = 80, cy = 50, r = 40;
  const tinted = scene === 'photochromic' || scene === 'sun';

  // Fond du verre selon le type.
  const lensFill =
    scene === 'sun' ? `url(#${u('sun')})` : scene === 'photochromic' ? `url(#${u('photo')})` : `url(#${u('clear')})`;
  const mark = tinted ? 'rgba(255,255,255,0.55)' : 'rgba(55,65,81,0.55)';

  let markings: ReactNode = null;
  if (scene === 'progressive' || scene === 'computer') {
    // Marquage de centrage d'un verre progressif (vue de face, œil droit).
    const fy = cy - 6; // croix de montage
    markings = (
      <g stroke={mark} strokeWidth="0.9" fill="none" strokeLinecap="round">
        {/* Cercle de référence de loin */}
        <path d={`M${cx - 9} ${fy - 9} A9 9 0 0 1 ${cx + 9} ${fy - 9}`} />
        {/* Croix de montage */}
        <path d={`M${cx - 5} ${fy} H${cx + 5} M${cx} ${fy - 5} V${fy + 5}`} strokeWidth="1.1" />
        {/* Lignes d'horizontalité */}
        <path d={`M${cx - 33} ${fy + 6} H${cx - 18} M${cx + 18} ${fy + 6} H${cx + 33}`} strokeDasharray="3 2" />
        {/* Point de référence du prisme */}
        <circle cx={cx} cy={fy + 6} r="1.3" fill={mark} stroke="none" />
        {/* Cercle de près, décalé côté nasal */}
        <circle cx={cx - 4} cy={cy + 22} r="6" />
        {/* Micro-gravures (cercles) */}
        <circle cx={cx - 17} cy={fy + 6} r="1.6" />
        <circle cx={cx + 17} cy={fy + 6} r="1.6" />
        {/* Gravures : indice et addition */}
        {idx && (
          <text x={cx + 17} y={fy + 14} textAnchor="middle" fontSize="4.6" fill={mark} stroke="none" fontFamily="Arial, sans-serif">
            {idx}
          </text>
        )}
        <text x={cx - 17} y={fy + 14} textAnchor="middle" fontSize="4.6" fill={mark} stroke="none" fontFamily="Arial, sans-serif">
          {scene === 'computer' ? 'D' : 'P'}
        </text>
      </g>
    );
  } else if (scene === 'bifocal') {
    markings = (
      <path
        d={`M${cx - 16} ${cy + 12} Q${cx} ${cy + 6} ${cx + 16} ${cy + 12} Q${cx + 15} ${cy + 24} ${cx} ${cy + 25} Q${cx - 15} ${cy + 24} ${cx - 16} ${cy + 12} Z`}
        fill="rgba(255,255,255,0.55)"
        stroke="rgba(55,65,81,0.35)"
        strokeWidth="0.8"
      />
    );
  }

  return (
    <svg viewBox="0 0 160 100" className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={u('bg')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfbfd" />
          <stop offset="1" stopColor="#eef0f5" />
        </linearGradient>
        <radialGradient id={u('clear')} cx=".42" cy=".35" r=".75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".7" stopColor="#f7f8fa" />
          <stop offset="1" stopColor="#e4e7ec" />
        </radialGradient>
        <linearGradient id={u('photo')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brown ? '#6b5545' : '#5f6461'} />
          <stop offset=".55" stopColor={brown ? '#957b66' : '#878b88'} />
          <stop offset="1" stopColor={brown ? '#d8c8bb' : '#c9ccca'} />
        </linearGradient>
        <linearGradient id={u('sun')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brown ? '#5a4232' : '#4d514f'} />
          <stop offset="1" stopColor={brown ? '#7a5c46' : '#6f7371'} />
        </linearGradient>
        {/* Reflet coloré du traitement (vu sous un angle) */}
        <linearGradient id={u('coat')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={blue ? '#60a5fa' : '#86efac'} stopOpacity=".45" />
          <stop offset=".45" stopColor={blue ? '#a5b4fc' : '#c4b5fd'} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={u('rim')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor={tinted ? '#9ca3af' : '#cfd5dd'} />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <filter id={u('shadow')} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.2" floodColor="#1f2937" floodOpacity=".18" />
        </filter>
        <clipPath id={u('clip')}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>

      <rect width="160" height="100" fill={`url(#${u('bg')})`} />

      {/* Le verre */}
      <circle cx={cx} cy={cy} r={r} fill={lensFill} filter={`url(#${u('shadow')})`} />
      <g clipPath={`url(#${u('clip')})`}>
        {(ar || blue) && <circle cx={cx} cy={cy} r={r} fill={`url(#${u('coat')})`} />}
        {markings}
        {/* Reflet en biseau (coin lumineux en haut) */}
        <path d={`M${cx - 18} ${cy - 37} L${cx - 4} ${cy - 40} L${cx + 3} ${cy - 26} L${cx - 10} ${cy - 22} Z`} fill="#fff" opacity={tinted ? 0.28 : 0.85} />
        {/* Bord intérieur : épaisseur du verre */}
        <circle cx={cx} cy={cy} r={r - 2.2} fill="none" stroke={tinted ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)'} strokeWidth="1.4" />
      </g>
      {/* Biseau extérieur */}
      <circle cx={cx} cy={cy} r={r - 0.6} fill="none" stroke={`url(#${u('rim')})`} strokeWidth="1.6" />
    </svg>
  );
}
