import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SUPPORTED_COUNTRIES } from '@oculo/shared-types';

/** Indicatif présélectionné : Sénégal. */
const DEFAULT_DIAL = '+221';

function splitNumber(value: string): { dial: string; local: string } {
  const cleaned = value.replace(/[\s().-]/g, '');
  const match = SUPPORTED_COUNTRIES.find((c) => cleaned.startsWith(c.dial));
  if (match) return { dial: match.dial, local: cleaned.slice(match.dial.length) };
  return { dial: DEFAULT_DIAL, local: '' };
}

/**
 * Saisie d'un numéro WhatsApp avec sélecteur d'indicatif couvrant tous les pays
 * d'Afrique de l'Ouest (CEDEAO + Mauritanie). Le sélecteur est un menu déroulant
 * sur mesure : fermé il n'affiche que l'indicatif (ex : « +221 »), ouvert il
 * liste les pays lisiblement — évite la troncature et les drapeaux emoji non
 * rendus sur certains systèmes. Émet la valeur combinée « +indicatif numéro »
 * via onChange, ou une chaîne vide tant qu'aucun numéro n'est saisi.
 */
export function WhatsappField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (full: string) => void;
  autoFocus?: boolean;
}) {
  const initial = splitNumber(value);
  const [dial, setDial] = useState(initial.dial);
  const [local, setLocal] = useState(initial.local);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const emit = (d: string, l: string) => {
    const digits = l.replace(/[^\d]/g, '');
    onChange(digits ? `${d} ${digits}` : '');
  };

  // Fermeture au clic extérieur / touche Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="flex gap-2">
      <div ref={ref} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Indicatif pays"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="input flex h-full w-[5.75rem] items-center justify-between gap-1 px-3"
        >
          <span className="font-medium text-content">{dial}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-content-faint transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <ul
            role="listbox"
            className="absolute left-0 z-30 mt-1 max-h-64 w-64 overflow-auto rounded-xl border bg-surface-3 p-1 shadow-card"
          >
            {SUPPORTED_COUNTRIES.map((c) => (
              <li key={c.code} role="option" aria-selected={c.dial === dial}>
                <button
                  type="button"
                  onClick={() => {
                    setDial(c.dial);
                    emit(c.dial, local);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-2 ${
                    c.dial === dial ? 'bg-primary-soft text-content' : 'text-content-muted'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 font-medium text-content-faint">{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        className="input flex-1"
        type="tel"
        inputMode="tel"
        autoFocus={autoFocus}
        placeholder="77 123 45 67"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          emit(dial, e.target.value);
        }}
      />
    </div>
  );
}
