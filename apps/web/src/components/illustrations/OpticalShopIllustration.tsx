/**
 * Illustration plate d'une vitrine de magasin d'optique — dessinée en SVG
 * (pas une photo/asset externe) pour rester légère, nette à toute résolution,
 * et automatiquement cohérente avec la palette de marque (classes Tailwind
 * fill/stroke liées aux tokens de couleur, pas de couleurs codées en dur).
 */
export function OpticalShopIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Illustration d'une vitrine de magasin d'optique"
    >
      {/* Ombre au sol */}
      <ellipse cx="200" cy="272" rx="150" ry="12" className="fill-content/10" />
      {/* Trottoir */}
      <rect x="30" y="262" width="340" height="14" rx="7" className="fill-surface-3" />

      {/* Façade */}
      <rect x="55" y="70" width="290" height="192" rx="18" className="fill-surface" stroke="currentColor" strokeOpacity="0.08" />
      <rect x="55" y="70" width="290" height="16" rx="8" className="fill-surface-3" />

      {/* Enseigne */}
      <rect x="148" y="34" width="104" height="30" rx="15" className="fill-primary" />
      <circle cx="184" cy="49" r="7" className="fill-none stroke-white" strokeWidth="2.5" />
      <circle cx="202" cy="49" r="7" className="fill-none stroke-white" strokeWidth="2.5" />
      <line x1="191" y1="49" x2="195" y2="49" className="stroke-white" strokeWidth="2.5" />

      {/* Auvent rayé */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const xTop = 62 + i * ((338 - 62) / 7);
        const xTopNext = 62 + (i + 1) * ((338 - 62) / 7);
        const xBot = 78 + i * ((322 - 78) / 7);
        const xBotNext = 78 + (i + 1) * ((322 - 78) / 7);
        return (
          <path
            key={i}
            d={`M${xTop} 86 L${xTopNext} 86 L${xBotNext} 122 L${xBot} 122 Z`}
            className={i % 2 === 0 ? 'fill-primary' : 'fill-accent'}
          />
        );
      })}
      {/* Bord festonné de l'auvent */}
      {Array.from({ length: 8 }).map((_, i) => {
        const cx = 78 + i * ((322 - 78) / 7);
        return <circle key={i} cx={cx} cy="122" r="7" className={i % 2 === 0 ? 'fill-primary' : 'fill-accent'} />;
      })}

      {/* Vitrine */}
      <rect x="90" y="138" width="140" height="100" rx="12" className="fill-primary/10" stroke="currentColor" strokeOpacity="0.1" />
      {/* Étagère dans la vitrine */}
      <rect x="98" y="205" width="124" height="4" rx="2" className="fill-primary/20" />

      {/* Lunettes 1 (posées sur un présentoir) */}
      <rect x="122" y="196" width="4" height="12" className="fill-primary/40" />
      <ellipse cx="124" cy="209" rx="10" ry="3" className="fill-primary/25" />
      <g transform="translate(108 168) rotate(-6)">
        <circle cx="0" cy="8" r="13" className="fill-none stroke-primary" strokeWidth="3" />
        <circle cx="30" cy="8" r="13" className="fill-none stroke-primary" strokeWidth="3" />
        <line x1="13" y1="8" x2="17" y2="8" className="stroke-primary" strokeWidth="3" />
        <line x1="-13" y1="6" x2="-24" y2="2" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Lunettes 2 (soleil, plus petites) */}
      <rect x="188" y="200" width="4" height="8" className="fill-accent/40" />
      <ellipse cx="190" cy="209" rx="9" ry="2.5" className="fill-accent/25" />
      <g transform="translate(176 178) rotate(5)">
        <circle cx="0" cy="6" r="11" className="fill-accent/70 stroke-accent" strokeWidth="2.5" />
        <circle cx="26" cy="6" r="11" className="fill-accent/70 stroke-accent" strokeWidth="2.5" />
        <line x1="11" y1="6" x2="15" y2="6" className="stroke-accent" strokeWidth="2.5" />
        <line x1="-11" y1="4" x2="-20" y2="0" className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Porte */}
      <rect x="252" y="148" width="58" height="106" rx="8" className="fill-surface-3" stroke="currentColor" strokeOpacity="0.08" />
      <rect x="260" y="156" width="42" height="46" rx="6" className="fill-primary/10" />
      <circle cx="298" cy="204" r="3" className="fill-primary" />

      {/* Plante décorative */}
      <path d="M52 260 L44 232 L60 232 Z" className="fill-surface-3" />
      <circle cx="52" cy="222" r="9" className="fill-accent/50" />
      <circle cx="42" cy="228" r="7" className="fill-primary/50" />
      <circle cx="62" cy="228" r="7" className="fill-primary/40" />
    </svg>
  );
}
