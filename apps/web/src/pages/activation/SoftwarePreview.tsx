import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';

/**
 * Aperçu du logiciel dans le tunnel de vente.
 *
 * Captures RÉELLES d'OculoSaaS, prises sur un établissement de démonstration
 * (données d'exemple du mode démo, aucune donnée client). Vignette recadrée
 * sur le contenu pour rester lisible sur téléphone ; l'écran complet s'ouvre
 * en grand au clic.
 */
const SCREENS = [
  {
    key: 'dashboard',
    title: 'Tableau de bord',
    text: "Chiffre d'affaires, ventes du jour, panier moyen et clients : l'essentiel en un coup d'œil.",
  },
  {
    key: 'caisse',
    title: 'Caisse & ventes',
    text: 'Montures, verres sur mesure et options, remise, TVA et garantie, devis ou encaissement.',
  },
  {
    key: 'produits',
    title: 'Catalogue produits',
    text: 'Montures, verres, lentilles et accessoires, avec import Excel et export PDF.',
  },
  {
    key: 'stock',
    title: 'Gestion du stock',
    text: 'Quantités par magasin, alertes de rupture, réceptions, transferts et inventaire.',
  },
  {
    key: 'clients',
    title: 'Clients & ordonnances',
    text: 'Fiche client, ordonnances, devis et relance WhatsApp en un clic.',
  },
  {
    key: 'rapports',
    title: 'Rapports & analyses',
    text: "Chiffre d'affaires, encaissé, reste à encaisser et évolution sur la période choisie.",
  },
] as const;

export function SoftwarePreview() {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const move = useCallback(
    (delta: number) => setOpen((i) => (i === null ? i : (i + delta + SCREENS.length) % SCREENS.length)),
    [],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, close, move]);

  const current = open === null ? null : SCREENS[open]!;

  return (
    <section className="mt-12">
      <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wider text-primary">
        Aperçu du logiciel
      </p>
      <h2 className="text-center font-display text-xl font-extrabold text-content sm:text-2xl">
        Voyez OculoSaaS avant de commencer
      </h2>
      <p className="mx-auto mb-5 mt-1 max-w-md text-center text-sm text-content-muted">
        Les vrais écrans du logiciel. Cliquez ou touchez une image pour l'agrandir.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {SCREENS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setOpen(i)}
            className="group overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="relative border-b border-line bg-surface-2">
              <div className="flex items-center gap-1.5 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-danger/50" />
                <span className="h-2 w-2 rounded-full bg-accent/50" />
                <span className="h-2 w-2 rounded-full bg-success/50" />
              </div>
              <img
                src={`/apercu/${s.key}-vignette.webp`}
                alt={`Écran ${s.title} d'OculoSaaS`}
                width={720}
                height={508}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
              <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-content">{s.title}</h3>
              <p className="mt-0.5 text-xs text-content-muted">{s.text}</p>
            </div>
          </button>
        ))}
      </div>

      {current && open !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
          onClick={close}
        >
          <div className="w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3 text-white">
              <div>
                <p className="font-display text-lg font-bold">{current.title}</p>
                <p className="text-sm text-white/75">{current.text}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 hover:bg-white/20"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={`/apercu/${current.key}.webp`}
              alt={`Écran ${current.title} d'OculoSaaS`}
              width={1440}
              height={900}
              className="max-h-[75vh] w-full rounded-xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center justify-between text-white">
              <button
                type="button"
                onClick={() => move(-1)}
                className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              >
                <ChevronLeft className="h-4 w-4" /> Précédent
              </button>
              <span className="text-sm text-white/70">
                {open + 1} / {SCREENS.length}
              </span>
              <button
                type="button"
                onClick={() => move(1)}
                className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              >
                Suivant <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
