import { useState } from 'react';
import { WEST_AFRICA_COUNTRIES } from '@oculo/shared-types';

/** Indicatif présélectionné : Sénégal. */
const DEFAULT_DIAL = '+221';

function splitNumber(value: string): { dial: string; local: string } {
  const cleaned = value.replace(/[\s().-]/g, '');
  const match = WEST_AFRICA_COUNTRIES.find((c) => cleaned.startsWith(c.dial));
  if (match) return { dial: match.dial, local: cleaned.slice(match.dial.length) };
  return { dial: DEFAULT_DIAL, local: '' };
}

/**
 * Saisie d'un numéro WhatsApp avec sélecteur d'indicatif couvrant tous les pays
 * d'Afrique de l'Ouest (CEDEAO + Mauritanie). Émet la valeur combinée
 * « +indicatif numéro » (ex : « +221 771234567 ») via onChange, ou une chaîne
 * vide tant qu'aucun numéro n'est saisi.
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

  const emit = (d: string, l: string) => {
    const digits = l.replace(/[^\d]/g, '');
    onChange(digits ? `${d} ${digits}` : '');
  };

  return (
    <div className="flex gap-2">
      <select
        aria-label="Indicatif pays"
        className="input w-[8.5rem] shrink-0 px-2"
        value={dial}
        onChange={(e) => {
          setDial(e.target.value);
          emit(e.target.value, local);
        }}
      >
        {WEST_AFRICA_COUNTRIES.map((c) => (
          <option key={c.code} value={c.dial}>
            {c.flag} {c.dial} · {c.name}
          </option>
        ))}
      </select>
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
