import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import {
  SUPPORTED_COUNTRIES,
  activationInformationSchema,
  type ActivationInformationInput,
} from '@oculo/shared-types';
import { Button, Field } from '../../components/ui';
import { ActionBar, ActivationShell, ChoiceCard, PrimaryAction } from './shared';
import { formatTrialDuration } from './PaymentStep';
import { trFr } from '../../lib/sharedLabels';
import { tr } from '../../lib/tr';

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
  trialMinutes,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  initial: Partial<ActivationInformationInput>;
  /** Durée de l'essai gratuit proposé à l'étape suivante ; 0 = aucun. */
  trialMinutes: number;
  submitting: boolean;
  error: string;
  onBack: () => void;
  onSubmit: (input: ActivationInformationInput) => void;
}) {
  const [fullName, setFullName] = useState(initial.fullName ?? '');
  const [establishmentName, setEstablishmentName] = useState(initial.establishmentName ?? '');
  const [country, setCountry] = useState(
    initial.country || countryOf(initial.whatsapp)?.code || countryOf(initial.phone)?.code || '',
  );
  // Numéros saisis SANS indicatif : l'indicatif vient du pays choisi.
  const [phone, setPhone] = useState(localPart(initial.phone));
  const [whatsapp, setWhatsapp] = useState(localPart(initial.whatsapp));
  const [email, setEmail] = useState(initial.email ?? '');
  const [city, setCity] = useState(initial.city ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [wantsStockImport, setWantsStockImport] = useState<boolean | null>(null);
  const [hasExistingData, setHasExistingData] = useState<boolean | null>(null);
  const [localError, setLocalError] = useState('');

  // L'indicatif suit le pays : changer de pays change l'indicatif des deux
  // numéros sans toucher à ce qui a été tapé.
  const dial = SUPPORTED_COUNTRIES.find((c) => c.code === country)?.dial ?? '';

  /** Numéro collé avec son indicatif (+33 6…) : le pays s'aligne dessus. */
  function typeNumber(value: string, set: (v: string) => void) {
    const pasted = value.trim().startsWith('+') || value.trim().startsWith('00') ? countryOf(value) : undefined;
    if (pasted) {
      setCountry(pasted.code);
      set(localPart(value));
      return;
    }
    set(value.replace(/^\s+/, ''));
  }

  function submit() {
    if (!dial) {
      setLocalError(tr('ui.InformationStep.choisissezVotrePaysIlFixe'));
      return;
    }
    const parsed = activationInformationSchema.safeParse({
      fullName,
      establishmentName,
      phone: withDial(dial, phone),
      whatsapp: withDial(dial, whatsapp),
      email,
      country,
      city,
      password,
      wantsStockImport: wantsStockImport ?? false,
      hasExistingData: hasExistingData ?? false,
    });
    if (!parsed.success) {
      setLocalError(trFr(parsed.error.issues[0]?.message) ?? tr('ui.InformationStep.verifiezLesInformationsSaisies'));
      return;
    }
    setLocalError('');
    onSubmit(parsed.data);
  }

  return (
    <ActivationShell
      step="INFORMATION"
      title={tr('ui.InformationStep.creonsVotreEspaceOculosaas')}
      subtitle={tr('ui.InformationStep.cesInformationsServentACreer')}
    >
      <div className="space-y-3">
        <Field label={tr('ui.InformationStep.nomComplet')}>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label={tr('ui.InformationStep.nomDeLOptique')}>
          <input
            className="input"
            value={establishmentName}
            onChange={(e) => setEstablishmentName(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={tr('ui.InformationStep.pays')}>
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{tr('ui.InformationStep.choisissezVotrePays')}</option>
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('ui.InformationStep.ville')}>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={tr('ui.InformationStep.telephone')}>
            <DialInput dial={dial} value={phone} onChange={(v) => typeNumber(v, setPhone)} />
          </Field>
          <Field label="WhatsApp">
            <DialInput
              dial={dial}
              value={whatsapp}
              placeholder="07 12 34 56 78"
              onChange={(v) => typeNumber(v, setWhatsapp)}
            />
            <p className="mt-1 text-xs text-content-faint">
              {tr('ui.InformationStep.cEstParCeNumero')}
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

        <Field label={tr('ui.InformationStep.motDePasse')}>
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
              aria-label={showPassword ? tr('ui.InformationStep.masquerLeMotDePasse') : tr('ui.InformationStep.afficherLeMotDePasse')}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <YesNo
          label={tr('ui.InformationStep.souhaitezVousQueNousVous')}
          value={wantsStockImport}
          onChange={setWantsStockImport}
        />
        <YesNo
          label={tr('ui.InformationStep.possedezVousDejaDesDonnees')}
          value={hasExistingData}
          onChange={setHasExistingData}
        />
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5 text-xs text-content-muted ring-1 ring-line">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        {trialMinutes > 0
          ? tr('ui.InformationStep.votreEspaceEstCreeA', { trialMinutes: formatTrialDuration(trialMinutes) })
          : tr('ui.InformationStep.votreEspaceEstCreeA2')}
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
              {submitting ? tr('ui.InformationStep.creationEnCours') : trialMinutes > 0 ? tr('ui.InformationStep.continuer') : tr('ui.InformationStep.continuerVersLePaiement')}
              <ArrowRight className="h-4 w-4" />
            </PrimaryAction>
          </div>
        </div>
      </ActionBar>
    </ActivationShell>
  );
}

/** Pays d'un numéro international (indicatif le plus long d'abord : +352 avant +35). */
function countryOf(value: string | null | undefined) {
  if (!value) return undefined;
  const cleaned = value.replace(/[\s().-]/g, '').replace(/^00/, '+');
  return [...SUPPORTED_COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => cleaned.startsWith(c.dial));
}

/** « +225 07 12 34 56 » -> « 07 12 34 56 » ; un numéro sans indicatif est gardé tel quel. */
function localPart(value: string | null | undefined): string {
  if (!value) return '';
  const c = countryOf(value);
  if (!c) return value.trim();
  const trimmed = value.trim().replace(/^00/, '+');
  // Retire l'indicatif en tolérant les séparateurs saisis entre ses chiffres.
  let i = 0;
  let matched = 0;
  while (i < trimmed.length && matched < c.dial.length) {
    if (trimmed[i] === c.dial[matched]) matched += 1;
    else if (!/[\s().-]/.test(trimmed[i]!)) break;
    i += 1;
  }
  return trimmed.slice(i).trim();
}

/** Numéro complet envoyé au serveur : indicatif du pays + numéro local. */
function withDial(dial: string, local: string): string {
  const n = local.trim();
  return n ? `${dial} ${n}` : '';
}

/** Champ téléphone avec l'indicatif du pays affiché devant, non modifiable. */
function DialInput({
  dial,
  value,
  placeholder,
  onChange,
}: {
  dial: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex">
      <span
        className="inline-flex min-w-[3.5rem] items-center justify-center rounded-l-xl border border-r-0 border-line bg-surface-2 px-2.5 text-sm font-medium text-content-muted"
        aria-label={dial ? tr('ui.InformationStep.indicatifDial', { dial: dial }) : tr('ui.InformationStep.indicatifChoisissezUnPays')}
      >
        {dial || '+…'}
      </span>
      <input
        className="input rounded-l-none"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
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
        <ChoiceCard label={tr('ui.InformationStep.oui')} selected={value === true} onSelect={() => onChange(true)} />
        <ChoiceCard label={tr('ui.InformationStep.non')} selected={value === false} onSelect={() => onChange(false)} />
      </div>
    </div>
  );
}
