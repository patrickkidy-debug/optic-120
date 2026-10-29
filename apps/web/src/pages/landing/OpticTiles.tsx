import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

const RX = [
  { eye: 'od', tone: 'bg-[#ede9fe] text-[#6d28d9]', v: ['-1,25', '-0,50', '90°', '+1,50'] },
  { eye: 'og', tone: 'bg-[#fce7f3] text-[#be185d]', v: ['-1,00', '-0,75', '85°', '+1,50'] },
];

/** Mini-ordonnance façon fiche client : OD / OG, sphère, cylindre, axe, addition. */
export function RxCard() {
  const { t } = useTranslation();
  const k = (s: string) => t(`landing.bold.rx.${s}`);
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 bg-white px-2.5 py-2 text-[#120a2b]">
      <div className="grid grid-cols-[30px_repeat(4,1fr)] text-center text-[9px] font-semibold uppercase tracking-wide text-[#120a2b]/45 sm:text-[10px]">
        <span />
        <span>{k('sph')}</span>
        <span>{k('cyl')}</span>
        <span>{k('axis')}</span>
        <span>{k('add')}</span>
      </div>
      {RX.map((r) => (
        <div key={r.eye} className="grid grid-cols-[30px_repeat(4,1fr)] items-center text-center font-mono text-[10px] font-bold sm:text-[12px]">
          <span className={`rounded-md py-0.5 font-sans text-[10px] font-extrabold ${r.tone}`}>{k(r.eye)}</span>
          {r.v.map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Centrage : monture, pupilles repérées, écart pupillaire et hauteur, ligne de scan animée. */
export function CenteringCard() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  return (
    <div className="relative h-full overflow-hidden bg-white text-[#120a2b]">
      <svg viewBox="0 0 220 96" className="h-full w-full" aria-hidden>
        {/* Monture */}
        <rect x="22" y="18" width="76" height="52" rx="22" fill="#f5f3ff" stroke="#120a2b" strokeWidth="4" />
        <rect x="122" y="18" width="76" height="52" rx="22" fill="#f5f3ff" stroke="#120a2b" strokeWidth="4" />
        <path d="M98 34 q12 -9 24 0" stroke="#120a2b" strokeWidth="4" fill="none" />
        {/* Pupilles + mire */}
        {[59, 161].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="40" r="7" fill="#7c3aed" />
            <circle cx={cx + 2} cy="38" r="2" fill="#fff" />
            <path d={`M${cx - 14} 40 h28 M${cx} 26 v28`} stroke="#ec4899" strokeWidth="1.2" strokeDasharray="2 2" />
          </g>
        ))}
        {/* Écart pupillaire */}
        <path d="M59 84 H161" stroke="#f97316" strokeWidth="2" markerStart="url(#c-a)" markerEnd="url(#c-a)" />
        <path d="M59 78 v12 M161 78 v12 M110 78 v12" stroke="#f97316" strokeWidth="1.5" />
        {/* Hauteur */}
        <path d="M204 40 V70" stroke="#7c3aed" strokeWidth="2" />
        <path d="M199 40 h10 M199 70 h10" stroke="#7c3aed" strokeWidth="1.5" />
        <defs>
          <marker id="c-a" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L6 3 L0 6z" fill="#f97316" />
          </marker>
        </defs>
      </svg>
      {/* Ligne de scan de la caméra */}
      {!reduce && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-[#a78bfa]/40 to-transparent"
          animate={{ top: ['-10%', '90%', '-10%'] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div className="absolute bottom-1 left-1.5 flex gap-1">
        <span className="rounded-full bg-[#ffedd5] px-1.5 py-0.5 text-[9px] font-bold text-[#c2410c] sm:text-[10px]">
          {t('landing.bold.rx.pd')} 31,5 / 32,0
        </span>
        <span className="rounded-full bg-[#ede9fe] px-1.5 py-0.5 text-[9px] font-bold text-[#6d28d9] sm:text-[10px]">
          {t('landing.bold.rx.height')} 22,0
        </span>
      </div>
    </div>
  );
}
