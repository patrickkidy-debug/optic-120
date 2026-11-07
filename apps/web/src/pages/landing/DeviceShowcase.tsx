import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Mascot } from '../../components/brand/Mascot';

/**
 * Vitrine « ordinateur + téléphone » : de vraies captures du logiciel (compte
 * de démonstration, données fictives) qui défilent chaque seconde dans les
 * deux écrans, et Oculo assis sur le rebord de l'écran d'ordinateur.
 */
const DESK = ['dashboard', 'caisse', 'produits', 'clients', 'oculorx', 'oculotrack', 'etiquettes', 'configuration'] as const;
const MOBILE = ['dashboard', 'caisse', 'clients', 'produits', 'oculotrack'] as const;
const INTERVAL = 1000;

/** Pile d'images en fondu : seule l'image active est opaque. */
function Slides({ dir, keys, active, alt, eagerFirst }: { dir: 'd' | 'm'; keys: readonly string[]; active: number; alt: (k: string) => string; eagerFirst?: boolean }) {
  return (
    <>
      {keys.map((k, i) => (
        <img
          key={k}
          src={`/images/landing/showcase/${dir}-${k}.webp`}
          alt={i === active ? alt(k) : ''}
          aria-hidden={i !== active}
          width={dir === 'd' ? 1280 : 520}
          height={dir === 'd' ? 800 : 1125}
          loading={i === 0 && eagerFirst ? 'eager' : 'lazy'}
          decoding="async"
          className={clsx(
            'absolute inset-0 h-full w-full object-cover object-left-top transition-opacity duration-500',
            i === active ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
    </>
  );
}

/**
 * Écran d'ordinateur + téléphone du hero de la landing (bande sombre).
 * Le défilement se met en pause au survol des appareils.
 */
export function Devices() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setInterval(() => setTick((v) => v + 1), INTERVAL);
    return () => window.clearInterval(id);
  }, [reduce, paused]);

  const d = tick % DESK.length;
  // Le téléphone change un pas sur deux : moins agité que l'écran.
  const m = Math.floor(tick / 2) % MOBILE.length;
  const label = (k: string) => t(`landing.showcase.screen.${k}`);

  return (
    <div aria-label={t('landing.showcase.aria')}>
    <div
      className="relative mx-auto w-full max-w-[1040px] pb-6 pr-[13%] pt-[92px] sm:pt-[130px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Ordinateur */}
      <figure className="relative">
        <div className="relative">
          {/* Oculo assis sur le rebord, en haut à droite de l'écran : le
              siège (≈ 75 % de la hauteur du dessin) affleure le bord. */}
          <div className="pointer-events-none absolute right-[6%] top-0 z-20 w-[96px] -translate-y-[73%] sm:w-[150px]">
            <Mascot pose="sit" className="w-full drop-shadow-[0_16px_20px_rgba(0,0,0,0.45)]" />
          </div>
          <div className="rounded-[22px] border-[3px] border-[#c4b5fd] bg-[#0d0820] p-2 shadow-[8px_8px_0_#7c3aed,0_40px_90px_-30px_rgba(0,0,0,0.8)] sm:rounded-[28px] sm:p-3">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-[#120a2b] sm:rounded-[18px]">
              <Slides dir="d" keys={DESK} active={d} alt={(k) => t('landing.showcase.altDesk', { screen: label(k) })} eagerFirst />
            </div>
          </div>
          {/* Pied */}
          <div className="mx-auto h-8 w-[22%] bg-gradient-to-b from-[#2a1d55] to-[#1a1240] sm:h-12" style={{ clipPath: 'polygon(18% 0, 82% 0, 100% 100%, 0 100%)' }} />
          <div className="mx-auto h-2.5 w-[38%] rounded-full bg-[#2a1d55] shadow-[0_10px_30px_rgba(0,0,0,0.5)] sm:h-3.5" />
        </div>
        <figcaption className="mt-4 text-center text-sm text-white/70">
          {t('landing.showcase.computer')} · <span className="font-semibold text-white">{label(DESK[d]!)}</span>
        </figcaption>
      </figure>

      {/* Téléphone, posé devant l'écran en bas à droite */}
      <figure className="absolute bottom-0 right-0 z-30 w-[27%] min-w-[110px] max-w-[250px]">
        <div className="rounded-[26px] border-[3px] border-[#f9a8d4] bg-[#0d0820] p-1.5 shadow-[6px_6px_0_#ec4899,0_30px_60px_-20px_rgba(0,0,0,0.8)] sm:rounded-[34px] sm:p-2">
          <div className="relative aspect-[520/1125] overflow-hidden rounded-[20px] bg-[#120a2b] sm:rounded-[27px]">
            <Slides dir="m" keys={MOBILE} active={m} alt={(k) => t('landing.showcase.altPhone', { screen: label(k) })} />
            <span className="absolute left-1/2 top-1.5 h-1.5 w-12 -translate-x-1/2 rounded-full bg-black/50" />
          </div>
        </div>
        <figcaption className="mt-3 hidden text-center text-sm text-white/70 sm:block">
          {t('landing.showcase.phone')} · <span className="font-semibold text-white">{label(MOBILE[m]!)}</span>
        </figcaption>
      </figure>
    </div>

    {/* Repères : l'écran affiché, cliquable */}
    <div className="mt-8 hidden flex-wrap justify-center gap-2 sm:flex">
      {DESK.map((k, i) => (
        <button
          key={k}
          type="button"
          onClick={() => setTick(i)}
          className={clsx(
            'rounded-full border px-3 py-1 text-xs font-semibold transition',
            i === d ? 'border-transparent bg-brand text-white' : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white',
          )}
        >
          {label(k)}
        </button>
      ))}
    </div>
    </div>
  );
}
