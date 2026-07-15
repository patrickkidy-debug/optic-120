import { useMemo } from 'react';
import type { Rect } from './useTargetRect';
import type { TourPlacement } from './types';

export interface Placed {
  side: Exclude<TourPlacement, 'auto'>;
  /** Position de la bulle (coordonnées viewport, `position: fixed`). */
  top: number;
  left: number;
  /** Centre de la flèche, relatif à la bulle. */
  arrow: { top?: number; left?: number };
}

const GAP = 14;
const EDGE = 12;

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/**
 * Choisit le côté de la bulle en fonction de la place réellement disponible,
 * puis la contraint dans le viewport et recale la flèche sur le centre de la
 * cible. Sur écran étroit, on force haut/bas : à gauche ou à droite, il ne
 * reste jamais assez de largeur pour une bulle lisible.
 */
export function usePlacement(
  target: Rect | null,
  size: { width: number; height: number },
  preferred: TourPlacement = 'auto',
): Placed {
  return useMemo(() => {
    const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
    const vh = typeof window === 'undefined' ? 768 : window.innerHeight;
    const w = size.width || 340;
    const h = size.height || 180;

    // Étape sans cible, ou demandée centrée : bulle au milieu de l'écran.
    if (!target || preferred === 'center') {
      return {
        side: 'center',
        top: Math.round((vh - h) / 2),
        left: Math.round((vw - w) / 2),
        arrow: {},
      };
    }

    const narrow = vw < 720;
    const space = {
      top: target.top,
      bottom: vh - (target.top + target.height),
      left: target.left,
      right: vw - (target.left + target.width),
    };

    const fits: Record<string, boolean> = {
      top: space.top >= h + GAP + EDGE,
      bottom: space.bottom >= h + GAP + EDGE,
      left: !narrow && space.left >= w + GAP + EDGE,
      right: !narrow && space.right >= w + GAP + EDGE,
    };

    // Ordre d'essai : le côté demandé d'abord, puis le plus spacieux.
    const order: Exclude<TourPlacement, 'auto' | 'center'>[] =
      preferred !== 'auto'
        ? ([preferred, 'bottom', 'top', 'right', 'left'].filter(
            (s, i, a) => a.indexOf(s) === i,
          ) as Exclude<TourPlacement, 'auto' | 'center'>[])
        : (['bottom', 'top', 'right', 'left'] as const)
            .slice()
            .sort((a, b) => space[b] - space[a]);

    const side = order.find((s) => fits[s]) ?? (space.bottom >= space.top ? 'bottom' : 'top');

    let top: number;
    let left: number;
    const arrow: Placed['arrow'] = {};

    if (side === 'top' || side === 'bottom') {
      top = side === 'top' ? target.top - h - GAP : target.top + target.height + GAP;
      const ideal = target.left + target.width / 2 - w / 2;
      left = clamp(ideal, EDGE, Math.max(EDGE, vw - w - EDGE));
      arrow.left = clamp(target.left + target.width / 2 - left, 18, w - 18);
    } else {
      left = side === 'left' ? target.left - w - GAP : target.left + target.width + GAP;
      const ideal = target.top + target.height / 2 - h / 2;
      top = clamp(ideal, EDGE, Math.max(EDGE, vh - h - EDGE));
      arrow.top = clamp(target.top + target.height / 2 - top, 18, h - 18);
    }

    // Dernier filet : jamais hors écran, même si la cible est en bordure.
    top = clamp(top, EDGE, Math.max(EDGE, vh - h - EDGE));
    left = clamp(left, EDGE, Math.max(EDGE, vw - w - EDGE));

    return { side, top: Math.round(top), left: Math.round(left), arrow };
  }, [target, size.width, size.height, preferred]);
}
