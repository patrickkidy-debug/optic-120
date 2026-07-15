import { useCallback, useEffect, useRef, useState } from 'react';

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const OFFSCREEN_MARGIN = 24;

function toRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function isFullyVisible(r: DOMRect): boolean {
  return (
    r.top >= OFFSCREEN_MARGIN &&
    r.left >= 0 &&
    r.bottom <= window.innerHeight - OFFSCREEN_MARGIN &&
    r.right <= window.innerWidth
  );
}

/**
 * Attend la fin du défilement puis résout. `scrollend` n'est pas encore partout
 * (Safari) : on se rabat sur une fenêtre d'inactivité du scroll, et un plafond
 * dur garantit qu'on ne bloque jamais la visite.
 */
function waitForScrollEnd(timeoutMs = 900): Promise<void> {
  return new Promise((resolve) => {
    let idle: number;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(idle);
      window.clearTimeout(hard);
      window.removeEventListener('scroll', onScroll, true);
      resolve();
    };
    const onScroll = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(finish, 120);
    };
    const hard = window.setTimeout(finish, timeoutMs);
    window.addEventListener('scroll', onScroll, true);
    idle = window.setTimeout(finish, 180); // aucun scroll déclenché = déjà en place
  });
}

export interface UseTargetRectResult {
  rect: Rect | null;
  /** Vrai tant qu'on centre la cible : l'étape attend avant de s'afficher. */
  settling: boolean;
  /** Vrai si le sélecteur ne correspond à aucun élément. */
  missing: boolean;
}

/**
 * Suit la position d'une cible : centre l'élément s'il est hors écran, puis
 * recalcule sa boîte à chaque défilement, redimensionnement ou changement de
 * mise en page. Le halo colle ainsi à la cible même si la page bouge.
 */
export function useTargetRect(selector: string | undefined, deps: unknown[] = []): UseTargetRectResult {
  const [rect, setRect] = useState<Rect | null>(null);
  const [settling, setSettling] = useState(false);
  const [missing, setMissing] = useState(false);
  const raf = useRef<number>();

  const measure = useCallback(() => {
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;
    cancelAnimationFrame(raf.current!);
    raf.current = requestAnimationFrame(() => setRect(toRect(el)));
  }, [selector]);

  useEffect(() => {
    let cancelled = false;

    if (!selector) {
      setRect(null);
      setMissing(false);
      setSettling(false);
      return;
    }

    setSettling(true);

    // La cible peut ne pas être encore montée (navigation vers l'écran de
    // l'étape) : on la sonde brièvement avant d'abandonner.
    let tries = 0;
    const findAndCenter = async () => {
      const el = document.querySelector(selector);
      if (!el) {
        if (tries++ < 25 && !cancelled) {
          window.setTimeout(findAndCenter, 80);
          return;
        }
        if (!cancelled) {
          setMissing(true);
          setSettling(false);
        }
        return;
      }

      setMissing(false);
      if (!isFullyVisible(el.getBoundingClientRect())) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        await waitForScrollEnd();
      }
      if (cancelled) return;
      setRect(toRect(el));
      setSettling(false);
    };

    void findAndCenter();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, ...deps]);

  // Garde le halo collé à la cible quand la page bouge.
  useEffect(() => {
    if (!selector) return;
    const el = document.querySelector(selector);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    const ro = el ? new ResizeObserver(measure) : null;
    if (el) ro!.observe(el);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [selector, measure, rect === null]);

  return { rect, settling, missing };
}
