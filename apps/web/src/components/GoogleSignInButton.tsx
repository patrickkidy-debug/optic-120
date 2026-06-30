import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/**
 * Bouton « Se connecter avec Google » (Google Identity Services, script chargé
 * dans index.html). Ne s'affiche pas si VITE_GOOGLE_CLIENT_ID n'est pas
 * configuré — évite un bouton cassé tant que Google Cloud n'est pas paramétré.
 */
export function GoogleSignInButton({
  onCredential,
  text = 'continue_with',
}: {
  onCredential: (idToken: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
    let iv: number | undefined;

    function render() {
      const el = ref.current;
      if (cancelled || !el || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId as string,
        callback: (resp) => callbackRef.current(resp.credential),
      });
      window.google.accounts.id.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text,
        shape: 'pill',
        width: 320,
      });
    }

    if (window.google?.accounts?.id) {
      render();
    } else {
      iv = window.setInterval(() => {
        if (window.google?.accounts?.id) {
          render();
          window.clearInterval(iv);
        }
      }, 200);
    }
    return () => {
      cancelled = true;
      if (iv) window.clearInterval(iv);
    };
  }, [clientId, text]);

  if (!clientId) return null;
  return <div ref={ref} className="flex justify-center" />;
}
