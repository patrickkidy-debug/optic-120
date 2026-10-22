/**
 * Écarts pupillaires de loin par œil. Sources, dans l'ordre : champs dédiés
 * de l'ordonnance (EP de loin OD / OG), puis un écart saisi « 32/31 » dans le
 * champ écart pupillaire. Jamais déduit d'un écart binoculaire / 2 : une
 * erreur de centrage coûte une paire.
 */
export function monoFarPd(rx?: { odFarPd?: string | null; ogFarPd?: string | null; pupillaryDistance?: string | null } | null): {
  od: string | null;
  og: string | null;
} {
  if (!rx) return { od: null, og: null };
  let od = rx.odFarPd?.trim() || null;
  let og = rx.ogFarPd?.trim() || null;
  const split = rx.pupillaryDistance?.match(/^\s*(\d+(?:[.,]\d+)?)\s*[/\-]\s*(\d+(?:[.,]\d+)?)\s*$/);
  if (split) {
    od ??= split[1];
    og ??= split[2];
  }
  return { od, og };
}

/** Écart binoculaire de loin : saisi, sinon somme des deux écarts monoculaires. */
export function totalFarPd(rx?: { odFarPd?: string | null; ogFarPd?: string | null; pupillaryDistance?: string | null } | null): string | null {
  if (!rx) return null;
  const typed = rx.pupillaryDistance?.trim();
  if (typed && !/[/\-]/.test(typed)) return typed;
  const { od, og } = monoFarPd(rx);
  const n = (v: string | null) => (v ? Number(v.replace(',', '.')) : NaN);
  const sum = n(od) + n(og);
  return Number.isFinite(sum) ? String(Math.round(sum * 10) / 10).replace('.', ',') : typed || null;
}
