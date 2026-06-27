import { useLocation } from 'react-router-dom';
import { Rocket } from 'lucide-react';

const TITLES: Record<string, string> = {
  '/clinique/patients': 'Dossier médical des patients',
  '/clinique/consultations': 'Consultations ophtalmologiques',
  '/clinique/rendez-vous': 'Agenda & rendez-vous',
  '/clinique/chirurgies': 'Chirurgies & suivi postopératoire',
  '/gestion/personnel': 'Gestion du personnel (RH)',
  '/gestion/finance': 'Finance & comptabilité',
  '/gestion/fournisseurs': 'Fournisseurs & approvisionnement',
  '/gestion/assurances': 'Assurances & tiers payant',
};

export function ComingSoon() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? 'Module à venir';

  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Rocket className="h-7 w-7" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold text-content">{title}</h1>
      <p className="mt-2 max-w-md text-content-muted">
        Ce module fait partie de la <span className="font-semibold text-content">Phase 2</span> de la
        feuille de route OculoSaaS. Les fondations (authentification, multi-tenant, rôles, module
        Optique) sont déjà opérationnelles.
      </p>
      <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-1.5 text-sm font-medium text-content-muted">
        🚧 En cours de développement
      </span>
    </div>
  );
}
