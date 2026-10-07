import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number | null | undefined;
  onChange: (n: number) => void;
  /** Borne basse, appliquée pendant la saisie (0 par défaut). */
  min?: number;
  max?: number;
  /** Décimales autorisées (0 = entiers). */
  decimals?: number;
  /** Valeur transmise quand le champ est vidé (min par défaut). */
  emptyValue?: number;
  /** Valeur minimale imposée seulement en quittant le champ (ex. quantité ≥ 1). */
  minOnBlur?: number;
};

const toText = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? '' : String(n));

/**
 * Champ numérique à saisie libre : on peut effacer entièrement la valeur, taper
 * 0, utiliser la virgule décimale. Le parent reçoit toujours un nombre valide,
 * le brouillon texte n'est normalisé qu'à la sortie du champ.
 */
export function NumberInput({ value, onChange, min = 0, max, decimals = 0, emptyValue, minOnBlur, onBlur, onFocus, ...rest }: Props) {
  const [draft, setDraft] = useState(toText(value));
  const editing = useRef(false);

  // Valeur modifiée de l'extérieur (bouton « tout utiliser », reprise…) : on suit.
  useEffect(() => {
    if (!editing.current) setDraft(toText(value));
  }, [value]);

  const clamp = (n: number) => {
    let x = Math.max(min, n);
    if (max != null) x = Math.min(max, x);
    const f = 10 ** decimals;
    return Math.round(x * f) / f;
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      value={draft}
      onFocus={(e) => {
        editing.current = true;
        e.target.select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/\s/g, '').replace(',', '.');
        const pattern = decimals > 0 ? /^\d*\.?\d*$/ : /^\d*$/;
        if (!pattern.test(raw)) return;
        setDraft(e.target.value.replace(/\s/g, ''));
        if (raw === '' || raw === '.') onChange(emptyValue ?? min);
        else onChange(clamp(Number(raw)));
      }}
      onBlur={(e) => {
        editing.current = false;
        const raw = draft.replace(',', '.');
        let n = raw === '' || raw === '.' ? emptyValue ?? min : clamp(Number(raw));
        if (minOnBlur != null && n < minOnBlur) n = minOnBlur;
        if (n !== value) onChange(n);
        setDraft(toText(n));
        onBlur?.(e);
      }}
    />
  );
}
