import { memo } from 'react';
import { motion } from 'framer-motion';
import type { Rect } from './useTargetRect';
import type { TourTheme } from './theme';

interface SpotlightProps {
  rect: Rect | null;
  padding: number;
  theme: TourTheme;
  /** Laisse passer les clics sur la cible (étape « fais-le toi-même »). */
  interactive?: boolean;
  onOutsideClick?: () => void;
}

/**
 * Voile sombre percé d'un trou sur la cible.
 *
 * Le trou est obtenu avec quatre panneaux (haut / bas / gauche / droite) plutôt
 * qu'un `box-shadow` géant ou un masque SVG : chaque panneau s'anime en
 * `transform`/`size` sur sa propre couche, ce qui reste fluide, et les clics
 * hors cible sont bloqués par les panneaux eux-mêmes — la cible, elle, reste
 * cliquable ou non selon `interactive`, sans code de capture d'événements.
 */
export const Spotlight = memo(function Spotlight({
  rect,
  padding,
  theme,
  interactive = false,
  onOutsideClick,
}: SpotlightProps) {
  const veil = `rgb(2 6 23 / ${theme.overlayOpacity})`;
  const t = theme.spotlightTransition;

  // Aucune cible : voile plein (étape centrée).
  if (!rect) {
    return (
      <motion.div
        className="fixed inset-0 z-[1000]"
        style={{ background: veil }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onOutsideClick}
        aria-hidden
      />
    );
  }

  const top = Math.max(0, rect.top - padding);
  const left = Math.max(0, rect.left - padding);
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;

  const panel = 'fixed z-[1000]';
  const style = { background: veil };

  return (
    <div aria-hidden onClick={onOutsideClick}>
      <motion.div
        className={panel}
        style={style}
        initial={false}
        animate={{ top: 0, left: 0, right: 0, height: top }}
        transition={t}
      />
      <motion.div
        className={panel}
        style={style}
        initial={false}
        animate={{ top: top + height, left: 0, right: 0, bottom: 0 }}
        transition={t}
      />
      <motion.div
        className={panel}
        style={style}
        initial={false}
        animate={{ top, left: 0, width: left, height }}
        transition={t}
      />
      <motion.div
        className={panel}
        style={style}
        initial={false}
        animate={{ top, left: left + width, right: 0, height }}
        transition={t}
      />

      {/* Anneau autour de la cible. Ne capture jamais le pointeur : c'est la
          cible dessous qui reçoit le clic quand l'étape est interactive. */}
      <motion.div
        className="pointer-events-none fixed z-[1001]"
        initial={false}
        animate={{ top, left, width, height }}
        transition={t}
        style={{
          borderRadius: theme.spotlightRadius,
          boxShadow: `0 0 0 ${theme.ringWidth}px ${theme.ringColor}, 0 0 0 6px rgb(124 58 237 / 0.18)`,
        }}
      />

      {/* Bloque les clics SUR la cible pour les étapes non interactives, afin
          que l'utilisateur ne quitte pas l'écran en plein milieu de l'étape. */}
      {!interactive && (
        <motion.div
          className="fixed z-[1001]"
          initial={false}
          animate={{ top, left, width, height }}
          transition={t}
          style={{ borderRadius: theme.spotlightRadius }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
});
