import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import {
  SUPPORTED_COUNTRIES,
  activationInformationSchema,
  type ActivationInformationInput,
} from '@oculo/shared-types';
import { Button, Field } from '../../components/ui';
import { ActionBar, ActivationShell, ChoiceCard, PrimaryAction } from './shared';

/**
 * Étape 4 — coordonnées, et création de l'espace.
 *
 * L'établissement est créé ici, mais SANS aucun accès : son abonnement naît
 * avec une période déjà expirée, et le garde d'abonnement refuse tout accès
 * tant que le paiement n'est pas confirmé. L'écran le dit, pour que personne
 * ne s'attende à entrer dans le logiciel à ce stade.
 */
export function InformationStep({
  initial,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  initial: Partial<ActivationInformationInput>;
  submitting: boolean;
  error: string;
  onBack: () => void;
  onSubmit: (input: ActivationInformationInput) => void;
}) {
  const [fullName, setFullName] = useState(initial.fullName ?? '');
  const [establishmentName, setEstablishmentName] = useState(initial.establishmentName ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp ?? '');
  const [email, setEmail] = useState(initial.email ?? '');
  const [country, setCountry] = useState(initial.country ?? '');
  const [city, setCity] = useState(initial.city ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [wantsStockImport, setWantsStockImport] = useState<boolean | null>(null);
  const [hasExistingData, setHasExistingData] = useState<boolean | null>(null);
  const [localError, setLocalError] = useState('');

  // L'indicatif est obligatoire : on le prerempli des que le pays est choisi,
  // plutot que de laisser l'utilisateur echouer a la validation puis deviner
  // le format attendu. La saisie deja commencee n'est jamais ecrasee.
  const dial = SUPPORTED_COUNTRIES.find((c) => c.code === country)?.dial ?? '';
  useEffect(() => {
    if (!dial) return;
    setWhatsapp((v) => (v.trim() === '' || /^\+\d{1,4}\s?$/.test(v.trim()) ? `${dial} ` : v));
  }, [dial]);

  function submit() {
    const parsed = activationInformationSchema.safeParse({
      fullName,
      establishmentName,
      phone,
      whatsapp,
      email,
      country,
      city,
      password,
      wantsStockImport: wantsStockImport ?? false,
      hasExistingData: hasExistingData ?? false,
    });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? 'Vérifiez les informations saisies');
      return;
    }
    setLocalError('');
    onSubmit(parsed.data);
  }

  return (
    <ActivationShell
      step="INFORMATION"
      title="Créons votre espace OculoSaaS"
      subtitle="Ces informations servent à créer votre espace et à vous accompagner ensuite."
    >
      <div className="space-y-3">
        <Field label="Nom complet">
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Nom de l'optique">
          <input
            className="input"
            value={establishmentName}
            onChange={(e) => setEstablishmentName(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Téléphone">
            <input
              className="input"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label="WhatsApp">
            <input
              className="input"
              type="tel"
              inputMode="tel"
              placeholder={dial ? `${dial} 77 123 45 67` : '+225 07 12 34 56'}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
            <p className="mt-1 text-xs text-content-faint">
              Indicatif du pays obligatoire{dial ? ` (${dial})` : ''} : c'est par ce numéro que nous
              vous rappellerons.
            </p>
          </Field>
        </div>

        <Field label="Email">
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Pays">
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Choisissez votre pays</option>
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ville">
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
        </div>

        <Field label="Mot de passe">
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-content-faint hover:text-content"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <YesNo
          label="Souhaitez-vous que nous vous aidions à importer votre stock ?"
          value={wantsStockImport}
          onChange={setWantsStockImport}
        />
        <YesNo
          label="Possédez-vous déjà des données à importer ?"
          value={hasExistingData}
          onChange={setHasExistingData}
        />
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5 text-xs text-content-muted ring-1 ring-line">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        Votre espace est créé à l'étape suivante et s'ouvrira dès la confirmation de votre paiement.
      </p>

      {(localError || error) && (
        <p className="mt-3 rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">
          {localError || error}
        </p>
      )}

      <ActionBar>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={submitting}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <PrimaryAction onClick={submit} disabled={submitting}>
              {submitting ? 'Création en cours…' : 'Continuer vers le paiement'}
              <ArrowRight className="h-4 w-4" />
            </PrimaryAction>
          </div>
        </div>
      </ActionBar>
    </ActivationShell>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-content">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <ChoiceCard label="Oui" selected={value === true} onSelect={() => onChange(true)} />
        <ChoiceCard label="Non" selected={value === false} onSelect={() => onChange(false)} />
      </div>
    </div>
  );
}
