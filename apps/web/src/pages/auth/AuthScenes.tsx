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

/**
 * Version compacte d'une scène (panneau étroit, à côté des cartes d'atouts) :
 * retire les tailles « sm: » pour garder le gabarit téléphone.
 */
function sized(compact: boolean | undefined, cls: string): string {
  return compact ? cls.split(' ').filter((c) => !c.startsWith('sm:')).join(' ') : cls;
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
export function EyeChartScene({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const step = READ_STEPS[useStep(READ_STEPS.length, 2200)];
  return (
    <div className={sized(compact, 'relative h-[230px] w-full max-w-[540px] sm:h-[290px]')}>
      {/* Tableau d'acuité au mur */}
      <div
        className={sized(
          compact,
          'absolute left-0 top-6 w-[140px] rounded-[20px] border-2 border-white/10 bg-white px-3 pb-3 pt-2.5 text-[#120a2b] shadow-[6px_6px_0_#7c3aed] sm:top-8 sm:w-[190px] sm:px-4',
        )}
      >
        <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-[0.25em] text-[#7c3aed]">{t('auth.arcade.chart')}</p>
        {CHART.map((r, i) => (
          <div
            key={r.l}
            className={clsx(
              'relative flex items-center justify-center rounded-lg font-arcade leading-[1.25] transition-all duration-300',
              sized(compact, r.size),
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
      <Mascot pose="point" pointAngle={step.angle} className={sized(compact, 'absolute bottom-0 right-0 w-[250px] sm:w-[350px]')} />
      <SpeechBubble text={t(step.say)} className={sized(compact, 'absolute right-0 top-0 max-w-[200px] rounded-br-sm sm:max-w-[240px]')} />
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
export function MirrorScene({ say, compact }: { say: string; compact?: boolean }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const i = useStep(FRAMES.length, 2400);
  const frame = FRAMES[i];
  return (
    <div className={sized(compact, 'relative h-[270px] w-full max-w-[540px] sm:h-[330px]')}>
      {/* Miroir sur pied */}
      <div className={sized(compact, 'absolute bottom-6 left-0 flex w-[130px] flex-col items-center sm:w-[170px]')}>
        <div className="relative w-full rounded-[999px] bg-brand p-[6px] shadow-[6px_6px_0_#4c1d95]">
          <div className={sized(compact, 'relative h-[170px] overflow-hidden rounded-[999px] bg-gradient-to-b from-[#f5f3ff] to-[#e0e7ff] sm:h-[220px]')}>
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
      <Mascot pose="try" frame={frame} className={sized(compact, 'absolute bottom-0 right-6 w-[150px] sm:w-[200px]')} />
      <SpeechBubble text={say} className={sized(compact, 'absolute right-0 top-0 max-w-[210px] rounded-br-sm sm:max-w-[260px]')} />
    </div>
  );
}

// Photo libre de droits (licence Unsplash, usage commercial gratuit) :
// CHUTTERSNAP — unsplash.com/photos/G8ioIHUDfNc
const PHOTO = '/images/auth/montures-vrac.webp';

/**
 * Fond des écrans d'accès : vraie photo de montures, teintée nuit violette
 * (dégradé plus dense côté texte) avec des reflets aux couleurs de la marque.
 */
export function PhotoBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <img
        src={PHOTO}
        alt=""
        className="h-full w-full scale-110 object-cover object-center opacity-30 blur-[2px]"
      />
      {/* Teinte de la marque : la photo prend les couleurs nuit violette */}
      <div className="absolute inset-0 bg-[#3b0764] mix-blend-color" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#120a2b]/95 via-[#120a2b]/80 to-[#120a2b]/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#120a2b]/90 via-transparent to-[#120a2b]/50" />
      <div className="absolute -right-24 top-1/4 h-[420px] w-[420px] rounded-full bg-[#ec4899]/25 blur-[120px]" />
      <div className="absolute -bottom-24 left-1/3 h-[360px] w-[360px] rounded-full bg-[#f97316]/15 blur-[120px]" />
    </div>
  );
}
