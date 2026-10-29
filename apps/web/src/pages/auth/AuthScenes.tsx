import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Mascot, type MascotFrame } from '../../components/brand/Mascot';

/** Bulle de dialogue du nounours (blanche, ombre décalée violette). */
export function SpeechBubble({ text, className }: { text: string; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={text}
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className={clsx(
          'rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold leading-snug text-[#120a2b] shadow-[5px_5px_0_#7c3aed] sm:text-base',
          className,
        )}
      >
        {text}
      </motion.p>
    </AnimatePresence>
  );
}

/** Boucle d'étapes (désactivée si l'utilisateur réduit les animations). */
function useStep(count: number, ms: number) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setStep((s) => (s + 1) % count), ms);
    return () => window.clearInterval(t);
  }, [count, ms, reduce]);
  return step;
}

const CHART = [
  { l: 'E', size: 'text-[34px] sm:text-[44px]', score: '1/10' },
  { l: 'F P', size: 'text-[24px] sm:text-[30px]', score: '2/10' },
  { l: 'T O Z', size: 'text-[18px] sm:text-[22px]', score: '4/10' },
  { l: 'L P E D', size: 'text-[14px] sm:text-[17px]', score: '6/10' },
  { l: 'P E C F D', size: 'text-[11px] sm:text-[13px]', score: '8/10' },
  { l: 'E D F C Z P', size: 'text-[9px] sm:text-[10px]', score: '10/10' },
];
// Étapes de lecture : ligne montrée, inclinaison de la baguette, réplique.
const READ_STEPS = [
  { row: 0, angle: 20, say: 'auth.arcade.read1' },
  { row: 2, angle: 2, say: 'auth.arcade.read2' },
  { row: 4, angle: -10, say: 'auth.arcade.read3' },
  { row: 5, angle: -15, say: 'auth.arcade.read4' },
];

/** Connexion : le nounours fait lire le tableau d'acuité, ligne après ligne. */
export function EyeChartScene() {
  const { t } = useTranslation();
  const step = READ_STEPS[useStep(READ_STEPS.length, 2200)];
  return (
    <div className="relative h-[230px] w-full max-w-[540px] sm:h-[290px]">
      {/* Tableau d'acuité au mur */}
      <div className="absolute left-0 top-6 w-[140px] rounded-[20px] border-2 border-white/10 bg-white px-3 pb-3 pt-2.5 text-[#120a2b] shadow-[6px_6px_0_#7c3aed] sm:top-8 sm:w-[190px] sm:px-4">
        <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-[0.25em] text-[#7c3aed]">{t('auth.arcade.chart')}</p>
        {CHART.map((r, i) => (
          <div
            key={r.l}
            className={clsx(
              'relative flex items-center justify-center rounded-lg font-arcade leading-[1.25] transition-all duration-300',
              r.size,
              i === step.row ? 'bg-[#ede9fe] text-[#120a2b]' : 'text-[#120a2b]/35',
            )}
          >
            {r.l}
            {i === step.row && (
              <span className="absolute right-1 font-sans text-[8px] font-bold text-[#7c3aed] sm:text-[9px]">{r.score}</span>
            )}
          </div>
        ))}
      </div>
      {/* Le nounours et sa baguette */}
      <Mascot pose="point" pointAngle={step.angle} className="absolute bottom-0 right-0 w-[250px] sm:w-[350px]" />
      <SpeechBubble text={t(step.say)} className="absolute right-0 top-0 max-w-[200px] rounded-br-sm sm:max-w-[240px]" />
    </div>
  );
}

const FRAMES: (MascotFrame & { name: string })[] = [
  { shape: 'round', color: '#7c3aed', name: 'auth.arcade.frame1' },
  { shape: 'cat', color: '#ec4899', name: 'auth.arcade.frame2' },
  { shape: 'rect', color: '#120a2b', name: 'auth.arcade.frame3' },
  { shape: 'aviator', color: '#f97316', name: 'auth.arcade.frame4' },
];

/** Création de compte : le nounours essaie des montures devant un miroir. */
export function MirrorScene({ say }: { say: string }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const i = useStep(FRAMES.length, 2400);
  const frame = FRAMES[i];
  return (
    <div className="relative h-[270px] w-full max-w-[540px] sm:h-[330px]">
      {/* Miroir sur pied */}
      <div className="absolute bottom-6 left-0 flex w-[130px] flex-col items-center sm:w-[170px]">
        <div className="relative w-full rounded-[999px] bg-brand p-[6px] shadow-[6px_6px_0_#4c1d95]">
          <div className="relative h-[170px] overflow-hidden rounded-[999px] bg-gradient-to-b from-[#f5f3ff] to-[#e0e7ff] sm:h-[220px]">
            <div className="absolute inset-y-0 left-[18%] w-6 -skew-x-12 bg-white/60 blur-[1px]" />
            {/* Reflet : même monture, vu de face et inversé */}
            <div className="absolute left-1/2 top-[14%] w-[150%] -translate-x-1/2 -scale-x-100">
              <Mascot pose="try" frame={frame} mirrored className="w-full" />
            </div>
            {/* Étincelles à chaque changement de monture */}
            {!reduce && (
              <AnimatePresence>
                <motion.div key={i} className="pointer-events-none absolute inset-0" initial="a" animate="b" exit={{ opacity: 0 }}>
                  {[
                    [18, 22],
                    [78, 30],
                    [70, 70],
                  ].map(([x, y], k) => (
                    <motion.svg
                      key={k}
                      viewBox="0 0 20 20"
                      className="absolute h-5 w-5"
                      style={{ left: `${x}%`, top: `${y}%` }}
                      variants={{ a: { scale: 0, opacity: 0 }, b: { scale: [0, 1.3, 0], opacity: [0, 1, 0] } }}
                      transition={{ duration: 0.9, delay: k * 0.12 }}
                    >
                      <path d="M10 0 l2.5 7.5 7.5 2.5 -7.5 2.5 -2.5 7.5 -2.5 -7.5 -7.5 -2.5 7.5 -2.5z" fill="#f59e0b" />
                    </motion.svg>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
        <div className="h-4 w-2 bg-[#4c1d95]" />
        <div className="h-2 w-16 rounded-full bg-[#4c1d95]" />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#120a2b] shadow-[3px_3px_0_#ec4899] sm:text-xs">
          {t(frame.name)}
        </span>
      </div>
      <Mascot pose="try" frame={frame} className="absolute bottom-0 right-6 w-[150px] sm:w-[200px]" />
      <SpeechBubble text={say} className="absolute right-0 top-0 max-w-[210px] rounded-br-sm sm:max-w-[260px]" />
    </div>
  );
}

/**
 * Décor de fond des écrans d'accès : un présentoir de lunettes illustré
 * (étagères lumineuses, montures pastel), en fondu vers le haut.
 */
export function OpticalDisplayBackdrop() {
  const colors = ['#ddd6fe', '#fbcfe8', '#fed7aa', '#c7d2fe', '#a7f3d0', '#ffffff'];
  const shelves = [70, 170, 270];
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 340"
      preserveAspectRatio="xMidYMax slice"
      className="auth-display pointer-events-none absolute inset-x-0 bottom-0 h-[46vh] w-full"
    >
      <defs>
        <linearGradient id="shelf-glow" x1="0" x2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <radialGradient id="spot" cx="0.5" cy="0" r="0.8">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Spots du magasin */}
      {[200, 600, 1000].map((x) => (
        <ellipse key={x} cx={x} cy="0" rx="260" ry="340" fill="url(#spot)" />
      ))}
      {shelves.map((y, si) => (
        <g key={y}>
          {Array.from({ length: 11 }, (_, k) => {
            const x = 60 + k * 108 + (si % 2) * 30;
            const c = colors[(k + si * 2) % colors.length];
            const shape = (k + si) % 3;
            const lens =
              shape === 0
                ? (cx: number) => <circle cx={cx} cy={y - 22} r="15" />
                : shape === 1
                  ? (cx: number) => <rect x={cx - 17} y={y - 35} width="34" height="24" rx="7" />
                  : (cx: number) => <path d={`M${cx - 17} ${y - 34} h34 q-2 22 -17 24 q-15 -2 -17 -24z`} />;
            return (
              <g key={k} fill="none" stroke={c} strokeWidth="4" opacity="0.9">
                {lens(x - 20)}
                {lens(x + 20)}
                <path d={`M${x - 4} ${y - 26} q4 -5 8 0`} />
                <path d={`M${x - 8} ${y - 6} v6 M${x + 8} ${y - 6} v6`} stroke="#4c1d95" />
              </g>
            );
          })}
          {/* Étagère lumineuse */}
          <rect x="0" y={y} width="1200" height="8" rx="4" fill="#241850" />
          <rect x="0" y={y} width="1200" height="2.5" fill="url(#shelf-glow)" opacity="0.9" />
        </g>
      ))}
    </svg>
  );
}
