import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Sparkles } from 'lucide-react';
import {
  ACTIVATION_NEEDS,
  BRANCH_COUNTS,
  PLAN_CATALOG,
  STRUCTURE_TYPES,
  SUPPORTED_COUNTRIES,
  planPrice,
  recommendPlan,
  type ActivationInformationInput,
  type ActivationNeed,
  type ActivationStep,
  type AuthUser,
  type BranchCount,
  type PaymentMethod,
  type StructureType,
} from '@oculo/shared-types';
import {
  getActivation,
  saveActivity,
  saveInformation,
  saveNeeds,
  savePlan,
  getTrialOffer,
  requestBankTransfer,
  startActivation,
  startPayment,
  startTrial,
  type BankDetails,
  type BankTransferRequest,
} from '../../features/activation/api';
import { api, apiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { setActiveCurrency, displayLocale } from '../../lib/format';
import { Button, PageLoader } from '../../components/ui';
import { ActionBar, ActivationShell, ChoiceCard, MultiChoiceCard, PrimaryAction } from './shared';
import { Intro } from './Intro';
import { InformationStep } from './InformationStep';
import { BankTransferSent, PaymentStep } from './PaymentStep';
import { tr } from '../../lib/tr';

/**
 * Tunnel d'activation — parcours commercial obligatoire.
 *
 * Chaque étape est enregistrée côté serveur : un prospect qui ferme son
 * navigateur reprend où il s'était arrêté, et le fondateur voit où les
 * abandons se produisent. Le jeton de parcours est conservé localement — il
 * ne donne accès qu'à ce parcours, jamais à l'application.
 */

const TOKEN_KEY = 'oculo_activation_token';

type Screen = 'INTRO' | ActivationStep;

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function writeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* Stockage refusé : le parcours fonctionne, sans reprise après fermeture. */
  }
}

export function ActivationPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  // Clic sur le logo : on veut la presentation, meme si un parcours est en cours.
  const wantsIntro = (location.state as { intro?: boolean } | null)?.intro === true;
  const [screen, setScreen] = useState<Screen>('INTRO');
  // Etape ou reprendre un parcours interrompu, quand on repart de la presentation.
  const [resumeStep, setResumeStep] = useState<ActivationStep>('ACTIVITY');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(true);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  // Essai gratuit en fin de parcours ; 0 tant que la durée n'est pas connue
  // (ou si l'essai est désactivé en console) : le bouton reste alors masqué.
  const [trialMinutes, setTrialMinutes] = useState(0);
  // Coordonnées bancaires de l'éditeur (null = virement non proposé).
  const [bank, setBank] = useState<BankDetails | null>(null);
  // Virement déclaré : l'écran suivant demande le reçu par WhatsApp.
  const [transfer, setTransfer] = useState<BankTransferRequest | null>(null);

  const [structureType, setStructureType] = useState<StructureType | null>(null);
  const [branchCount, setBranchCount] = useState<BranchCount | null>(null);
  const [country, setCountry] = useState('');
  const [needs, setNeeds] = useState<ActivationNeed[]>([]);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [info, setInfo] = useState<Partial<ActivationInformationInput>>({});

  const recommendation = useMemo(
    () => recommendPlan(branchCount, needs, structureType),
    [branchCount, needs, structureType],
  );
  const currency = SUPPORTED_COUNTRIES.find((c) => c.code === country)?.currency ?? 'XOF';

  // Reprise d'un parcours interrompu.
  useEffect(() => {
    const existing = readToken();
    if (!existing) {
      setRestoring(false);
      return;
    }
    getActivation(existing)
      .then((s) => {
        setToken(s.token);
        setStructureType((s.structureType as StructureType) ?? null);
        setBranchCount((s.branchCount as BranchCount) ?? null);
        setCountry(s.country ?? '');
        setNeeds(s.needs as ActivationNeed[]);
        setPlanCode(s.planCode);
        setInfo({
          fullName: s.fullName ?? '',
          establishmentName: s.establishmentName ?? '',
          phone: s.phone ?? '',
          whatsapp: s.whatsapp ?? '',
          email: s.email ?? '',
          country: s.country ?? '',
          city: s.city ?? '',
        });
        // Un parcours déjà réglé ne se reprend pas : il repart de zéro.
        if (!s.activated && s.step !== 'DONE') {
          setResumeStep(s.step as ActivationStep);
          // Arrivee par le logo : la presentation d'abord, la reprise ensuite.
          if (!wantsIntro) setScreen(s.step as ActivationStep);
        }
      })
      .catch(() => undefined)
      .finally(() => setRestoring(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getTrialOffer()
      .then((o) => {
        setTrialMinutes(o.minutes);
        setBank(o.bank);
      })
      .catch(() => setTrialMinutes(0));
  }, []);

  // Toute etape atteinte devient le point de reprise : sans cela, repasser par
  // la presentation au milieu du parcours ramenait a la premiere question.
  useEffect(() => {
    if (screen !== 'INTRO') setResumeStep(screen);
  }, [screen]);

  // Clic sur le logo alors que la page est deja ouverte : meme route, donc pas
  // de remontage — on bascule l'ecran explicitement.
  useEffect(() => {
    if (!wantsIntro) return;
    setScreen('INTRO');
    setError('');
    window.scrollTo({ top: 0 });
  }, [location.key, wantsIntro]);

  /** Crée le parcours au premier clic, avec l'origine publicitaire. */
  async function begin() {
    setError('');
    if (token) {
      // Parcours deja entame : reprendre a l'etape atteinte, pas au debut.
      setScreen(resumeStep);
      return;
    }
    setBusy(true);
    try {
      const session = await startActivation({
        utm_source: params.get('utm_source') ?? undefined,
        utm_medium: params.get('utm_medium') ?? undefined,
        utm_campaign: params.get('utm_campaign') ?? undefined,
      });
      setToken(session.token);
      writeToken(session.token);
      setScreen('ACTIVITY');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** Enregistre l'étape puis avance. Une panne réseau ne fait pas perdre la saisie. */
  async function step<T>(action: (t: string) => Promise<T>, next: Screen) {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await action(token);
      setScreen(next);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function pay(method: PaymentMethod) {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const result = await startPayment(token, method);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      // Pas de redirection (paiement mobile à confirmer) : on suit l'état
      // depuis la page de retour, seule à décider de l'activation.
      window.location.href = `/activation/retour?session=${encodeURIComponent(token)}`;
    } catch (e) {
      setError(apiErrorMessage(e));
      setBusy(false);
    }
  }

  /** Essai gratuit : le serveur ouvre la session, on entre directement dans l'espace. */
  async function tryForFree() {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const { accessToken } = await startTrial(token);
      const { data } = await api.get<{ user: AuthUser }>('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setActiveCurrency(data.user.tenantCurrency);
      setAuth(accessToken, data.user);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setError(apiErrorMessage(e));
      setBusy(false);
    }
  }

  /** Virement déclaré : facture en attente, activation par l'équipe à réception du reçu. */
  async function declareTransfer() {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      setTransfer(await requestBankTransfer(token));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (restoring) return <PageLoader />;

  if (screen === 'INTRO') return <Intro onStart={() => void begin()} trialMinutes={trialMinutes} />;

  if (screen === 'ACTIVITY') {
    const ready = Boolean(structureType && branchCount && country);
    return (
      <ActivationShell
        step="ACTIVITY"
        title={tr('ui.ActivationPage.parlezNousDeVotreActivite')}
        subtitle={tr('ui.ActivationPage.troisReponsesSuffisentPourVous')}
      >
        <Question label={tr('ui.ActivationPage.quelTypeDeStructureGerez')}>
          {STRUCTURE_TYPES.map((s) => (
            <ChoiceCard
              key={s.value}
              label={s.label}
              selected={structureType === s.value}
              onSelect={() => setStructureType(s.value)}
            />
          ))}
        </Question>

        <Question label={tr('ui.ActivationPage.combienDeBoutiquesGerezVous')}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {BRANCH_COUNTS.map((b) => (
              <ChoiceCard
                key={b.value}
                label={b.label}
                selected={branchCount === b.value}
                onSelect={() => setBranchCount(b.value)}
              />
            ))}
          </div>
        </Question>

        <Question label={tr('ui.ActivationPage.dansQuelPaysEtesVous')}>
          <select
            className="input"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label={tr('ui.ActivationPage.pays')}
          >
            <option value="">{tr('ui.ActivationPage.choisissezVotrePays')}</option>
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </Question>

        <ErrorLine text={error} />

        <ActionBar>
          <PrimaryAction
            disabled={!ready || busy}
            onClick={() =>
              void step(
                (t) =>
                  saveActivity(t, {
                    structureType: structureType!,
                    branchCount: branchCount!,
                    country,
                  }),
                'NEEDS',
              )
            }
          >
            {tr('ui.ActivationPage.continuer')} <ArrowRight className="h-4 w-4" />
          </PrimaryAction>
        </ActionBar>
      </ActivationShell>
    );
  }

  if (screen === 'NEEDS') {
    return (
      <ActivationShell
        step="NEEDS"
        title={tr('ui.ActivationPage.queSouhaitezVousAmeliorer')}
        subtitle={tr('ui.ActivationPage.plusieursReponsesPossiblesCelaNous')}
      >
        <div className="space-y-2">
          {ACTIVATION_NEEDS.map((n) => (
            <MultiChoiceCard
              key={n.value}
              label={n.label}
              selected={needs.includes(n.value)}
              onToggle={() =>
                setNeeds((prev) =>
                  prev.includes(n.value) ? prev.filter((x) => x !== n.value) : [...prev, n.value],
                )
              }
            />
          ))}
        </div>

        <ErrorLine text={error} />

        <ActionBar>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setScreen('ACTIVITY')} disabled={busy}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <PrimaryAction
                disabled={needs.length === 0 || busy}
                onClick={() => {
                  setPlanCode(recommendation.planCode);
                  void step((t) => saveNeeds(t, { needs }), 'PLAN');
                }}
              >
                {tr('ui.ActivationPage.continuer')} <ArrowRight className="h-4 w-4" />
              </PrimaryAction>
            </div>
          </div>
        </ActionBar>
      </ActivationShell>
    );
  }

  if (screen === 'INFORMATION') {
    return (
      <InformationStep
        initial={{ ...info, country: country || info.country }}
        trialMinutes={trialMinutes}
        submitting={busy}
        error={error}
        onBack={() => setScreen('PLAN')}
        onSubmit={(input) => {
          setInfo(input);
          void step((t) => saveInformation(t, input), 'PAYMENT');
        }}
      />
    );
  }

  if ((screen === 'PAYMENT' || screen === 'DONE') && transfer) {
    return (
      <BankTransferSent
        request={transfer}
        bank={bank}
        country={country}
        establishment={info.establishmentName ?? null}
        trialMinutes={trialMinutes}
        submitting={busy}
        error={error}
        onTrial={() => void tryForFree()}
      />
    );
  }

  if (screen === 'PAYMENT' || screen === 'DONE') {
    return (
      <PaymentStep
        planCode={planCode}
        billingCycle="MONTHLY"
        country={country}
        submitting={busy}
        error={error}
        onBack={() => setScreen('INFORMATION')}
        onPay={(m) => void pay(m)}
        trialMinutes={trialMinutes}
        onTrial={() => void tryForFree()}
        bank={bank}
        onBankTransfer={() => void declareTransfer()}
        contact={{ fullName: info.fullName, establishment: info.establishmentName, city: info.city }}
      />
    );
  }

  // Étape 3 — offre recommandée.
  const shown = comparing
    ? PLAN_CATALOG
    : PLAN_CATALOG.filter((p) => p.code === recommendation.planCode);

  return (
    <ActivationShell
      step="PLAN"
      title={tr('ui.ActivationPage.voiciLaFormuleAdapteeA')}
      subtitle={reasonLabel(recommendation.reason)}
    >
      <div className="space-y-3">
        {shown.map((p) => {
          const isRecommended = p.code === recommendation.planCode;
          const selected = planCode === p.code;
          return (
            <div
              key={p.code}
              className={`rounded-2xl border p-5 transition-all ${
                selected ? 'border-primary shadow-md' : 'border-line bg-surface'
              }`}
            >
              {isRecommended && (
                <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  <Sparkles className="h-3 w-3" /> {tr('ui.ActivationPage.recommandePourVous')}
                </span>
              )}
              <h2 className="font-display text-xl font-extrabold text-content">{p.name}</h2>
              <p className="mt-1 text-sm text-content-muted">{p.description}</p>

              <p className="mt-3 font-display text-2xl font-extrabold text-content">
                {planPrice(p.code, currency).toLocaleString(displayLocale(), { minimumFractionDigits: Number.isInteger(planPrice(p.code, currency)) ? 0 : 2 })}{' '}
                {currency}
                <span className="ml-1 text-sm font-normal text-content-muted">{tr('units.perMonth')}</span>
              </p>

              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-content-muted">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-4 w-full justify-center"
                variant={selected ? undefined : 'outline'}
                onClick={() => setPlanCode(p.code)}
              >
                {selected ? tr('ui.ActivationPage.formuleSelectionnee') : tr('ui.ActivationPage.choisirCetteFormule')}
              </Button>
            </div>
          );
        })}
      </div>

      {!comparing && (
        <button
          type="button"
          onClick={() => setComparing(true)}
          className="mt-3 text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {tr('ui.ActivationPage.comparerLesAutresFormules')}
        </button>
      )}

      <ErrorLine text={error} />

      <ActionBar>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScreen('NEEDS')} disabled={busy}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <PrimaryAction
              disabled={!planCode || busy}
              onClick={() =>
                void step(
                  (t) => savePlan(t, { planCode: planCode as never, billingCycle: 'MONTHLY' }),
                  'INFORMATION',
                )
              }
            >
              {tr('ui.ActivationPage.continuer')} <ArrowRight className="h-4 w-4" />
            </PrimaryAction>
          </div>
        </div>
      </ActionBar>
    </ActivationShell>
  );
}

/** Raison de la recommandation (texte français du code partagé) dans la langue active. */
const REASON_KEYS: Record<string, string> = {
  "Au-delà de 5 magasins, seule l'offre Growth couvre un réseau sans limite.": 'activationUi.reasonGrowth',
  "Standard couvre jusqu'à 5 magasins, ce qui correspond à votre organisation.": 'activationUi.reasonStandardBranches',
  'Vos besoins dépassent un point de vente unique : Standard les couvre tous.': 'activationUi.reasonStandardNeeds',
  "Starter suffit à votre activité : tout l'essentiel, jusqu'à 2 magasins.": 'activationUi.reasonStarter',
};
function reasonLabel(fr: string): string {
  const key = REASON_KEYS[fr];
  return key ? tr(key) : fr;
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-2.5 font-medium text-content">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="mt-3 rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">{text}</p>
  );
}
