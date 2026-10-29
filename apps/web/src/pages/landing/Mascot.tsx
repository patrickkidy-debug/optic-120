import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Oculo, la mascotte de la landing : une opticienne aux couleurs de la marque.
 * Blouse blanche, grosses lunettes, échelle d'acuité à la main ; les yeux suivent
 * le pointeur et clignent, les sourcils se lèvent, l'autre main salue.
 */
export function Mascot({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const uid = useId().replace(/:/g, '');
  const id = (s: string) => `${uid}-${s}`;

  // Les pupilles suivent le pointeur (décalage borné à 3,5 px).
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 300) * 3.5;
        setLook({ x: (dx / d) * k, y: (dy / d) * k });
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, [reduce]);

  const repeat = (duration: number, times?: number[], delay = 0) =>
    reduce ? undefined : { duration, times, delay, repeat: Infinity, ease: 'easeInOut' as const };
  const origin = (o: string) => ({ transformBox: 'fill-box' as const, transformOrigin: o });

  return (
    <motion.svg
      ref={ref}
      viewBox="-24 0 196 158"
      className={className}
      aria-hidden
      animate={reduce ? undefined : { y: [0, -6, 0] }}
      transition={repeat(3.2)}
    >
      <defs>
        <linearGradient id={id('body')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="55%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <radialGradient id={id('shine')} cx="0.3" cy="0.22" r="0.55">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('iris')} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="60%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" />
        </radialGradient>
        <clipPath id={id('clip')}>
          <circle cx="80" cy="84" r="54" />
        </clipPath>
      </defs>

      <ellipse cx="80" cy="152" rx="38" ry="4.5" fill="#000" opacity="0.35" />
      {/* Pieds */}
      <ellipse cx="62" cy="140" rx="13" ry="7" fill="#4c1d95" />
      <ellipse cx="98" cy="140" rx="13" ry="7" fill="#4c1d95" />

      {/* Bras gauche + échelle d'acuité, qui se balance doucement */}
      <motion.g style={origin('100% 100%')} animate={reduce ? undefined : { rotate: [0, -4, 0] }} transition={repeat(2.4)}>
        <path d="M34 118 Q18 112 14 100" stroke="#8b5cf6" strokeWidth="10" strokeLinecap="round" fill="none" />
        <g transform="rotate(-8 6 72)">
          <rect x="-14" y="44" width="40" height="54" rx="5" fill="#fff" stroke="#ddd6fe" strokeWidth="2" />
          <g fill="#120a2b" fontFamily="'Bungee', 'Oxanium', sans-serif" textAnchor="middle">
            <text x="6" y="64" fontSize="17">E</text>
            <text x="6" y="75" fontSize="9" letterSpacing="2">FP</text>
            <text x="6" y="84" fontSize="6.5" letterSpacing="1.5">TOZ</text>
            <text x="6" y="91" fontSize="4.5" letterSpacing="1">LPED</text>
          </g>
          <rect x="-8" y="93.5" width="28" height="1.6" rx="0.8" fill="#ec4899" />
        </g>
        <circle cx="13" cy="98" r="7.5" fill="#a78bfa" />
      </motion.g>

      {/* Corps + blouse d'opticienne */}
      <circle cx="80" cy="84" r="54" fill={`url(#${id('body')})`} />
      <g clipPath={`url(#${id('clip')})`}>
        <rect x="20" y="112" width="120" height="40" fill="#fff" />
        <path d="M66 111 L80 134 L94 111z" fill="#ec4899" />
        <path d="M58 112 L80 140 L70 112z M102 112 L80 140 L90 112z" fill="#ede9fe" />
        <rect x="104" y="122" width="16" height="12" rx="2" fill="none" stroke="#c4b5fd" strokeWidth="2" />
        <rect x="108" y="114" width="3" height="12" rx="1.5" fill="#7c3aed" />
        <path d="M80 112 V150" stroke="#ede9fe" strokeWidth="1.5" />
      </g>
      {/* Nœud papillon */}
      <path d="M80 114 L70 108 L70 120z M80 114 L90 108 L90 120z" fill="#120a2b" />
      <circle cx="80" cy="114" r="2.6" fill="#120a2b" />
      <circle cx="80" cy="84" r="54" fill={`url(#${id('shine')})`} />

      {/* Étincelle */}
      <motion.path
        d="M80 14 l3.5 8 8 3.5 -8 3.5 -3.5 8 -3.5 -8 -8 -3.5 8 -3.5z"
        fill="#fde68a"
        style={origin('center')}
        animate={reduce ? undefined : { scale: [1, 1.25, 1], rotate: [0, 20, 0] }}
        transition={repeat(2)}
      />

      {/* Sourcils */}
      <motion.g animate={reduce ? undefined : { y: [0, 0, -4, 0, 0] }} transition={repeat(5, [0, 0.6, 0.68, 0.76, 1])}>
        <path d="M46 46 q12 -8 24 -2" stroke="#120a2b" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M90 44 q12 -6 24 2" stroke="#120a2b" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      </motion.g>

      {/* Yeux : suivent le pointeur et clignent */}
      <motion.g
        style={origin('center')}
        animate={reduce ? undefined : { scaleY: [1, 1, 0.08, 1] }}
        transition={reduce ? undefined : { duration: 4, times: [0, 0.9, 0.95, 1], repeat: Infinity }}
      >
        <circle cx="60" cy="70" r="17" fill="#fff" />
        <circle cx="100" cy="70" r="17" fill="#fff" />
        <g transform={`translate(${look.x} ${look.y})`}>
          <circle cx="60" cy="71" r="9.5" fill={`url(#${id('iris')})`} />
          <circle cx="100" cy="71" r="9.5" fill={`url(#${id('iris')})`} />
          <circle cx="60" cy="71" r="4.6" fill="#120a2b" />
          <circle cx="100" cy="71" r="4.6" fill="#120a2b" />
          <circle cx="63.5" cy="67.5" r="2.6" fill="#fff" />
          <circle cx="103.5" cy="67.5" r="2.6" fill="#fff" />
        </g>
      </motion.g>

      {/* Lunettes : grosse monture, verres teintés et reflets */}
      <path d="M39 66 L26 61 M121 66 L134 61" stroke="#120a2b" strokeWidth="5" strokeLinecap="round" />
      <rect x="39" y="49" width="42" height="42" rx="16" fill="#bae6fd" fillOpacity="0.22" stroke="#120a2b" strokeWidth="5.5" />
      <rect x="79" y="49" width="42" height="42" rx="16" fill="#bae6fd" fillOpacity="0.22" stroke="#120a2b" strokeWidth="5.5" />
      <path d="M48 62 l8 -8 M52 66 l4 -4 M88 62 l8 -8 M92 66 l4 -4" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />

      {/* Joues + sourire */}
      <ellipse cx="38" cy="98" rx="8" ry="4.5" fill="#fff" opacity="0.32" />
      <ellipse cx="122" cy="98" rx="8" ry="4.5" fill="#fff" opacity="0.32" />
      <path d="M63 95 q17 22 34 0 z" fill="#4c1d95" />
      <ellipse cx="80" cy="106" rx="7" ry="3.5" fill="#f9a8d4" />

      {/* Bras droit qui salue */}
      <motion.g
        style={origin('0% 100%')}
        animate={reduce ? undefined : { rotate: [0, -24, 8, -24, 0, 0] }}
        transition={repeat(2.6, [0, 0.15, 0.3, 0.45, 0.6, 1])}
      >
        <path d="M128 116 Q146 106 150 84" stroke="#f97316" strokeWidth="10" strokeLinecap="round" fill="none" />
        <circle cx="151" cy="80" r="8" fill="#fb923c" />
      </motion.g>
    </motion.svg>
  );
}
