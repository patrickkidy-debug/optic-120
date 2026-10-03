import { useLocation } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { tr } from '../lib/tr';

const TITLES: Record<string, string> = {
  get '/clinique/patients'() { return tr('ui.ComingSoon.dossierMedicalDesPatients'); },
  get '/clinique/consultations'() { return tr('ui.ComingSoon.consultationsOphtalmologiques'); },
  get '/clinique/rendez-vous'() { return tr('ui.ComingSoon.agendaRendezVous'); },
  get '/clinique/chirurgies'() { return tr('ui.ComingSoon.chirurgiesSuiviPostoperatoire'); },
  get '/gestion/personnel'() { return tr('ui.ComingSoon.gestionDuPersonnelRh'); },
  get '/gestion/finance'() { return tr('ui.ComingSoon.financeComptabilite'); },
  get '/gestion/fournisseurs'() { return tr('ui.ComingSoon.fournisseursApprovisionnement'); },
  get '/gestion/assurances'() { return tr('ui.ComingSoon.assurancesTiersPayant'); },
};

export function ComingSoon() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? tr('ui.ComingSoon.moduleAVenir');

  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Rocket className="h-7 w-7" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold text-content">{title}</h1>
      <p className="mt-2 max-w-md text-content-muted">
        {tr('ui.ComingSoon.ceModuleFaitPartieDe')} <span className="font-semibold text-content">{tr('ui.ComingSoon.phase2')}</span> {tr('ui.ComingSoon.deLaFeuilleDeRoute')}
      </p>
      <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-1.5 text-sm font-medium text-content-muted">
        {tr('ui.ComingSoon.enCoursDeDeveloppement')}
      </span>
    </div>
  );
}
