import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** Formes de monture que le nounours peut porter. */
export type FrameShape = 'round' | 'cat' | 'rect' | 'aviator';
export type MascotFrame = { shape: FrameShape; color: string };

/**
 * Pose du nounours :
 * - wave  : salue d'une patte, tient une mini échelle d'acuité de l'autre ;
 * - point : tient une baguette (angle réglable) pour faire lire un tableau ;
 * - try   : ajuste ses lunettes des deux pattes (essayage devant le miroir).
 */
export type MascotPose = 'wave' | 'point' | 'try';

const VIEWBOX: Record<MascotPose, string> = {
  wave: '-6 0 212 236',
  point: '-140 0 346 236',
  try: '0 0 200 236',
};

const DEFAULT_FRAME: MascotFrame = { shape: 'round', color: '#7c3aed' };

/** Contour d'un verre selon la forme de monture, centré sur (cx, cy). */
function lensPath(shape: FrameShape, cx: number, cy: number): string {
  switch (shape) {
    case 'rect':
      return `M${cx - 22} ${cy - 14} q0 -4 4 -4 h36 q4 0 4 4 v24 q0 6 -6 6 h-32 q-6 0 -6 -6 z`;
    case 'cat':
      return `M${cx - 23} ${cy - 12} q12 -10 30 -8 q14 0 16 -6 q2 18 -6 30 q-8 10 -22 9 q-16 -1 -19 -14 q-2 -6 1 -11 z`;
    case 'aviator':
      return `M${cx - 21} ${cy - 13} h42 q2 0 1 4 q-4 26 -22 28 q-18 -2 -22 -28 q-1 -4 1 -4 z`;
    default:
      return `M${cx - 20} ${cy} a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 z`;
  }
}

/**
 * Oculo, l'ourson opticien de la marque (landing, accès, logiciel) : fourrure
 * caramel, blouse blanche et nœud papillon, grosses lunettes. Les yeux suivent
 * le pointeur et clignent ; chaque pose a ses propres gestes animés.
 */
export function Mascot({
  className,
  pose = 'wave',
  frame = DEFAULT_FRAME,
  pointAngle = 0,
  mirrored = false,
}: {
  className?: string;
  pose?: MascotPose;
  frame?: MascotFrame;
  /** Pose « point » : inclinaison de la baguette en degrés (négatif = vers le haut). */
  pointAngle?: number;
  /** Reflet dans un miroir : regard inversé, pas de suivi du pointeur. */
  mirrored?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const uid = useId().replace(/:/g, '');
  const id = (s: string) => `${uid}-${s}`;
  const still = reduce || mirrored;

  // Les pupilles suivent le pointeur (décalage borné à 3 px).
  useEffect(() => {
    if (still) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 3);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 300) * 3;
        setLook({ x: (dx / d) * k, y: (dy / d) * k });
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, [still]);

  const loop = (duration: number, times?: number[], delay = 0) =>
    reduce ? undefined : { duration, times, delay, repeat: Infinity, ease: 'easeInOut' as const };
  // Rotation autour d'un point exprimé dans le repère du dessin.
  const pivot = (x: number, y: number) => ({ transformBox: 'view-box' as const, transformOrigin: `${x}px ${y}px` });

  const FUR = `url(#${id('fur')})`;
  const paw = (cx: number, cy: number) => (
    <g>
      <circle cx={cx} cy={cy} r="12" fill={FUR} />
      <ellipse cx={cx} cy={cy + 2} rx="6.5" ry="5" fill="#f6dcc0" />
    </g>
  );

  return (
    <motion.svg
      ref={ref}
      viewBox={VIEWBOX[pose]}
      className={className}
      aria-hidden
      animate={reduce ? undefined : { y: [0, -4, 0] }}
      transition={loop(3.4)}
    >
      <defs>
        <radialGradient id={id('fur')} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#e7b07a" />
          <stop offset="60%" stopColor="#c98b55" />
          <stop offset="100%" stopColor="#9b6235" />
        </radialGradient>
        <radialGradient id={id('shine')} cx="0.32" cy="0.22" r="0.5">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('tie')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="60%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <clipPath id={id('body')}>
          <ellipse cx="100" cy="182" rx="54" ry="44" />
        </clipPath>
      </defs>

      <ellipse cx="100" cy="229" rx="54" ry="5" fill="#000" opacity="0.3" />

      {/* Pieds */}
      <ellipse cx="72" cy="216" rx="20" ry="11" fill={FUR} />
      <ellipse cx="128" cy="216" rx="20" ry="11" fill={FUR} />
      <ellipse cx="72" cy="219" rx="10" ry="5.5" fill="#f6dcc0" />
      <ellipse cx="128" cy="219" rx="10" ry="5.5" fill="#f6dcc0" />

      {/* Corps + blouse d'opticien */}
      <ellipse cx="100" cy="182" rx="54" ry="44" fill={FUR} />
      <g clipPath={`url(#${id('body')})`}>
        <ellipse cx="100" cy="194" rx="24" ry="36" fill="#f6dcc0" />
        <path d="M40 148 L95 148 L86 232 L36 232 Z" fill="#fff" />
        <path d="M160 148 L105 148 L114 232 L164 232 Z" fill="#fff" />
        <path d="M95 148 L80 178 L72 148 Z M105 148 L120 178 L128 148 Z" fill="#ede9fe" />
        <rect x="122" y="188" width="17" height="13" rx="2.5" fill="none" stroke="#c4b5fd" strokeWidth="2" />
        <rect x="126" y="180" width="3.2" height="13" rx="1.6" fill="#7c3aed" />
        <circle cx="84" cy="200" r="2.2" fill="#ddd6fe" />
        <circle cx="83" cy="214" r="2.2" fill="#ddd6fe" />
      </g>
      {/* Nœud papillon */}
      <path d="M100 152 L86 144 L86 160 Z M100 152 L114 144 L114 160 Z" fill={`url(#${id('tie')})`} />
      <circle cx="100" cy="152" r="3.6" fill="#7c3aed" />

      {/* Bras selon la pose */}
      {pose === 'wave' && (
        <>
          <motion.g style={pivot(56, 162)} animate={reduce ? undefined : { rotate: [0, -5, 0] }} transition={loop(2.6)}>
            <path d="M56 162 Q36 152 30 136" stroke={FUR} strokeWidth="18" strokeLinecap="round" fill="none" />
            <g transform="rotate(-10 18 112)">
              <rect x="-2" y="84" width="40" height="52" rx="6" fill="#fff" stroke="#ddd6fe" strokeWidth="2" />
              <g fill="#120a2b" fontFamily="'Bungee', 'Oxanium', sans-serif" textAnchor="middle">
                <text x="18" y="104" fontSize="17">E</text>
                <text x="18" y="115" fontSize="9" letterSpacing="2">FP</text>
                <text x="18" y="124" fontSize="6.5" letterSpacing="1.5">TOZ</text>
                <text x="18" y="131" fontSize="4.5" letterSpacing="1">LPED</text>
              </g>
            </g>
            {paw(30, 134)}
          </motion.g>
          <motion.g
            style={pivot(146, 162)}
            animate={reduce ? undefined : { rotate: [0, -22, 6, -22, 0, 0] }}
            transition={loop(2.8, [0, 0.15, 0.3, 0.45, 0.6, 1])}
          >
            <path d="M146 162 Q170 150 174 124" stroke={FUR} strokeWidth="18" strokeLinecap="round" fill="none" />
            {paw(175, 118)}
          </motion.g>
        </>
      )}
      {pose === 'point' && (
        <>
          <path d="M146 166 Q156 186 138 196" stroke={FUR} strokeWidth="18" strokeLinecap="round" fill="none" />
          {paw(136, 196)}
          <motion.g style={pivot(56, 162)} initial={false} animate={{ rotate: pointAngle }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
            <path d="M56 162 Q40 156 26 150" stroke={FUR} strokeWidth="18" strokeLinecap="round" fill="none" />
            <path d="M24 150 L-130 118" stroke="#4c1d95" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="-130" cy="118" r="6" fill="#f97316" />
            {paw(24, 150)}
          </motion.g>
        </>
      )}

      {/* Tête */}
      <circle cx="48" cy="52" r="25" fill={FUR} />
      <circle cx="152" cy="52" r="25" fill={FUR} />
      <circle cx="49" cy="54" r="14" fill="#f2c4a0" />
      <circle cx="151" cy="54" r="14" fill="#f2c4a0" />
      <ellipse cx="100" cy="96" rx="64" ry="58" fill={FUR} />
      <ellipse cx="100" cy="96" rx="64" ry="58" fill={`url(#${id('shine')})`} />
      <path d="M90 42 q6 -16 18 -6 q-6 -2 -8 6 q-4 -6 -10 0 z" fill="#9b6235" />
      <ellipse cx="100" cy="124" rx="29" ry="21" fill="#f6dcc0" />
      <ellipse cx="58" cy="120" rx="10" ry="6" fill="#f472b6" opacity="0.35" />
      <ellipse cx="142" cy="120" rx="10" ry="6" fill="#f472b6" opacity="0.35" />
      {/* Truffe + sourire */}
      <path d="M89 111 q11 -7 22 0 q-2 11 -11 13 q-9 -2 -11 -13 z" fill="#3b2416" />
      <ellipse cx="96" cy="112" rx="3.5" ry="2" fill="#fff" opacity="0.55" />
      <path d="M100 124 v4 M100 128 q-7 7 -13 1 M100 128 q7 7 13 1" stroke="#3b2416" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Sourcils */}
      <motion.g animate={reduce ? undefined : { y: [0, 0, -4, 0, 0] }} transition={loop(5, [0, 0.6, 0.68, 0.76, 1])}>
        <path d="M62 62 q12 -7 24 -2" stroke="#6b3f1f" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M114 60 q12 -5 24 2" stroke="#6b3f1f" strokeWidth="4" strokeLinecap="round" fill="none" />
      </motion.g>

      {/* Yeux : suivent le pointeur et clignent */}
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={reduce ? undefined : { scaleY: [1, 1, 0.08, 1] }}
        transition={reduce ? undefined : { duration: 4.2, times: [0, 0.9, 0.95, 1], repeat: Infinity }}
      >
        <g transform={`translate(${mirrored ? -2 : look.x} ${mirrored ? 0 : look.y})`}>
          <ellipse cx="76" cy="92" rx="8.5" ry="10" fill="#1c1209" />
          <ellipse cx="124" cy="92" rx="8.5" ry="10" fill="#1c1209" />
          <circle cx="79" cy="88" r="3.2" fill="#fff" />
          <circle cx="127" cy="88" r="3.2" fill="#fff" />
          <circle cx="73.5" cy="96" r="1.5" fill="#fff" opacity="0.8" />
          <circle cx="121.5" cy="96" r="1.5" fill="#fff" opacity="0.8" />
        </g>
      </motion.g>

      {/* Lunettes : la monture change (essayage) avec un petit rebond */}
      <motion.g
        key={`${frame.shape}-${frame.color}`}
        initial={reduce ? false : { y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      >
        <path d="M54 88 L36 80 M146 88 L164 80" stroke={frame.color} strokeWidth="4.5" strokeLinecap="round" />
        <path d={lensPath(frame.shape, 76, 92)} fill="#e0f2fe" fillOpacity="0.22" stroke={frame.color} strokeWidth="5" strokeLinejoin="round" />
        <path d={lensPath(frame.shape, 124, 92)} fill="#e0f2fe" fillOpacity="0.22" stroke={frame.color} strokeWidth="5" strokeLinejoin="round" />
        <path d="M96 89 q4 -6 8 0" stroke={frame.color} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path d="M64 84 l7 -7 M68 89 l3 -3 M112 84 l7 -7 M116 89 l3 -3" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.85" />
      </motion.g>

      {/* Pose « essayage » : les deux pattes ajustent la monture */}
      {pose === 'try' && (
        <>
          <motion.g style={pivot(56, 162)} animate={reduce ? undefined : { rotate: [0, -3, 0] }} transition={loop(1.6)}>
            <path d="M56 162 Q26 132 40 94" stroke={FUR} strokeWidth="18" strokeLinecap="round" fill="none" />
            {paw(40, 90)}
          </motion.g>
          <motion.g style={pivot(144, 162)} animate={reduce ? undefined : { rotate: [0, 3, 0] }} transition={loop(1.6)}>
            <path d="M144 162 Q174 132 160 94" stroke={FUR} strokeWidth="18" strokeLinecap="round" fill="none" />
            {paw(160, 90)}
          </motion.g>
        </>
      )}
    </motion.svg>
  );
}
