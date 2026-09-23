import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

/**
 * Retours d'action discrets (§31).
 *
 * Remplace `alert()` là où l'action a réussi : une boîte modale bloquante pour
 * dire « c'est fait » interrompt le travail sans rien apprendre. En revanche,
 * une confirmation avant action destructive reste bloquante — c'est justement
 * le cas où l'on veut arrêter la main de l'utilisateur.
 *
 * Volontairement sans dépendance : une bibliothèque de toasts pèse plus que ces
 * quelques lignes et impose ses conventions à toute l'application.
 */

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: typeof Check; className: string }> = {
  success: { icon: Check, className: 'border-[color:var(--success)]/40 text-success' },
  error: { icon: AlertTriangle, className: 'border-[color:var(--danger)]/40 text-danger' },
  info: { icon: Info, className: 'border-[color:var(--primary)]/40 text-primary' },
};

/** Durée d'affichage. Assez long pour être lu, assez court pour ne pas gêner. */
const LIFETIME_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: ToastTone, message: string) => {
    // L'identifiant combine l'horloge et un aléa : deux actions dans la même
    // milliseconde produiraient sinon la même clé React.
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            onDismiss={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const { icon: Icon, className } = TONE_STYLES[item.tone];
  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-3 text-sm shadow-card-lg animate-fade-in ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-content">{item.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer"
        className="shrink-0 text-content-faint transition-colors hover:text-content"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Hors d'un `ToastProvider`, les messages retombent sur la console du
 * navigateur plutôt que de faire planter l'écran : un retour d'action manquant
 * est gênant, une page blanche est pire.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return (
    ctx ?? {
      success: (m) => console.info('[toast]', m),
      error: (m) => console.error('[toast]', m),
      info: (m) => console.info('[toast]', m),
    }
  );
}
