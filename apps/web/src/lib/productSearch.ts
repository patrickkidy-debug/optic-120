/**
 * Recherche de produit en caisse et dans les devis.
 *
 * Une recherche « mot à mot » sur le seul nom ne trouvait pas les verres : leur
 * nom (« Progressif Premium ») ne contient presque jamais le mot « verre », la
 * marque n'était pas consultée, « lumiere » ne trouvait pas « lumière » et
 * « premium progressif » échouait parce que les mots étaient inversés.
 *
 * Ici chaque mot tapé doit apparaître quelque part (nom, code, code-barres,
 * marque ou famille), dans n'importe quel ordre, sans tenir compte des
 * accents, des majuscules ni des tirets.
 */

/** Mots qui désignent chaque famille, pour que « verre » trouve tous les verres. */
const FAMILY_WORDS: Record<string, string> = {
  VERRE: 'verre verres lens lenses lente lentes',
  MONTURE: 'monture montures frame frames armacao',
  LENTILLE: 'lentille lentilles contact',
  ENTRETIEN: 'entretien produit',
  ACCESSOIRE: 'accessoire accessoires accessory',
  SERVICE: 'service prestation',
};

/** Minuscules, sans accents ; tirets, points, virgules et barres deviennent des espaces. */
export function foldSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_/.,;:'’()+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchableProduct {
  name: string;
  sku: string;
  ean?: string | null;
  brand?: string | null;
  category?: string | null;
}

/**
 * Mots qui trahissent un verre dans un nom de produit. Sert à retrouver les
 * verres enregistrés par erreur dans une autre famille (souvent « Montures »).
 * Les lentilles de contact ne sont pas concernées : elles ont leur famille.
 */
const LENS_NAME =
  /\b(verres?|lens(es)?|lentes?|unifocale?s?|monofocale?s?|progressi(f|fs|ve|ves|va|vas)|bifocale?s?|degressi(f|fs|ve|ves)|organiques?|minera(l|ux)|cr ?39|polycarbonate|trivex|anti ?reflets?|antireflets?|hmc|photochromiques?|photogray|transitions|anti ?lumiere|lumiere bleue|blue ?cut|blue ?control|1 (50?|53|56|59|60?|61|67|74))\b/;

export function looksLikeLens(p: Pick<SearchableProduct, 'name' | 'category'>): boolean {
  if (p.category === 'VERRE') return true;
  if (p.category === 'LENTILLE') return false;
  return LENS_NAME.test(foldSearch(p.name));
}

/** Le produit appartient-il à la famille ? Un verre mal rangé compte aussi dans « Verres ». */
export function inProductFamily(p: Pick<SearchableProduct, 'name' | 'category'>, family: string): boolean {
  return p.category === family || (family === 'VERRE' && looksLikeLens(p));
}

export function matchesProductSearch(p: SearchableProduct, query: string): boolean {
  const words = foldSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const family = FAMILY_WORDS[p.category ?? ''] ?? '';
  const lens = p.category !== 'VERRE' && looksLikeLens(p) ? FAMILY_WORDS.VERRE : '';
  const hay = foldSearch([p.name, p.sku, p.ean ?? '', p.brand ?? '', family, lens].join(' '));
  // Version sans espaces : « antireflet » trouve « Anti-reflet ».
  const compact = hay.replace(/ /g, '');
  return words.every((w) => hay.includes(w) || compact.includes(w));
}
