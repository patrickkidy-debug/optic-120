import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const ROOT_ID = 'oculo-tour-root';

/**
 * Monte la visite à la racine du document, hors de l'arbre applicatif : le halo
 * et la bulle échappent ainsi à tout `overflow: hidden` ou contexte
 * d'empilement d'un écran.
 */
export function TourPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let el = document.getElementById(ROOT_ID);
    let created = false;
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT_ID;
      document.body.appendChild(el);
      created = true;
    }
    setHost(el);
    return () => {
      if (created && el && el.childElementCount === 0) el.remove();
    };
  }, []);

  if (!host) return null;
  return createPortal(children, host);
}
