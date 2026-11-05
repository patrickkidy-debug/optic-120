import clsx from 'clsx';

/**
 * Symbole d'une famille de produits, aux couleurs d'OculoSaaS : remplace les
 * photos produit (montures, verres, entretien…) partout où un visuel est
 * affiché. Un dégradé et un pictogramme propres à chaque famille.
 */
type Family = 'MONTURE' | 'VERRE' | 'LENTILLE' | 'ACCESSOIRE' | 'ENTRETIEN' | 'SERVICE' | 'AUTRE';

const STYLE: Record<Family, { from: string; to: string; glyph: JSX.Element }> = {
  // Monture : une paire de lunettes, pont et branches.
  MONTURE: {
    from: '#7c3aed',
    to: '#ec4899',
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="24" width="20" height="15" rx="7" />
        <rect x="36" y="24" width="20" height="15" rx="7" />
        <path d="M28 29q4-4 8 0" />
        <path d="M8 27l-4-5M56 27l4-5" />
        <path d="M13 29q3-2 6-1" strokeOpacity=".55" strokeWidth="2.2" />
      </g>
    ),
  },
  // Verre : une lentille ophtalmique vue de face, reflet et étincelle.
  VERRE: {
    from: '#6366f1',
    to: '#38bdf8',
    glyph: (
      <g fill="none" stroke="#fff" strokeLinecap="round">
        <circle cx="30" cy="34" r="17" strokeWidth="3.2" />
        <path d="M20 29a11 11 0 0 1 9-7" strokeWidth="2.6" strokeOpacity=".7" />
        <path d="M49 12v8M45 16h8" strokeWidth="2.6" />
        <path d="M54 26v4M52 28h4" strokeWidth="2" strokeOpacity=".8" />
      </g>
    ),
  },
  // Lentille de contact : une coupelle posée sur le doigt.
  LENTILLE: {
    from: '#ec4899',
    to: '#f97316',
    glyph: (
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 38q18-22 36 0" strokeWidth="3.2" />
        <path d="M14 38q18 6 36 0" strokeWidth="3.2" />
        <path d="M22 31q4-4 9-5" strokeWidth="2.2" strokeOpacity=".7" />
        <circle cx="32" cy="48" r="2" fill="#fff" stroke="none" />
      </g>
    ),
  },
  // Accessoire : un étui à lunettes à charnière.
  ACCESSOIRE: {
    from: '#f97316',
    to: '#facc15',
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="22" width="46" height="22" rx="11" />
        <path d="M9 33h46" strokeOpacity=".7" strokeWidth="2.4" />
        <circle cx="32" cy="33" r="3" fill="#fff" stroke="none" />
      </g>
    ),
  },
  // Entretien : un spray nettoyant et sa brume.
  ENTRETIEN: {
    from: '#10b981',
    to: '#22d3ee',
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 26h12v24a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3z" />
        <path d="M26 26v-6h8v6M34 20h6l3 3" />
        <path d="M48 16l4-2M49 22h5M48 28l4 2" strokeWidth="2.4" strokeOpacity=".8" />
        <path d="M27 36h6" strokeOpacity=".6" strokeWidth="2.2" />
      </g>
    ),
  },
  // Service : une clé d'atelier et une étincelle (ajustage, réparation…).
  SERVICE: {
    from: '#8b5cf6',
    to: '#6366f1',
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M38 18a9 9 0 0 0-11 11L14 42a4 4 0 0 0 6 6l13-13a9 9 0 0 0 11-11l-6 6-5-1-1-5z" />
        <path d="M50 40v7M46.5 43.5h7" strokeWidth="2.4" />
      </g>
    ),
  },
  // Divers : un carton.
  AUTRE: {
    from: '#64748b',
    to: '#7c3aed',
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 24l20-10 20 10v20L32 54 12 44z" />
        <path d="M12 24l20 10 20-10M32 34v20" strokeOpacity=".75" />
      </g>
    ),
  },
};

export function ProductSymbol({ category, className }: { category?: string | null; className?: string }) {
  const s = STYLE[(category as Family) in STYLE ? (category as Family) : 'AUTRE'];
  return (
    <div
      aria-hidden
      className={clsx('relative grid place-items-center overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
    >
      {/* Halo clair en haut à gauche : relief discret. */}
      <span className="pointer-events-none absolute -left-1/4 -top-1/4 h-3/4 w-3/4 rounded-full bg-white/20 blur-xl" />
      <svg viewBox="0 0 64 64" className="relative h-[78%] max-h-32 w-[78%] max-w-32 drop-shadow-[0_2px_3px_rgba(18,10,43,0.35)]">
        {s.glyph}
      </svg>
    </div>
  );
}
