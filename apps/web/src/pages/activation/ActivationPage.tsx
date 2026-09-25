import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
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
  startActivation,
  startPayment,
} from '../../features/activation/api';
import { apiErrorMessage } from '../../lib/api';
import { Button, PageLoader } from '../../components/ui';
import { ActionBar, ActivationShell, ChoiceCard, MultiChoiceCard, PrimaryAction } from './shared';
import { Intro } from './Intro';
import { InformationStep } from './InformationStep';
import { PaymentStep } from './PaymentStep';

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

  if (restoring) return <PageLoader />;

  if (screen === 'INTRO') return <Intro onStart={() => void begin()} />;

  if (screen === 'ACTIVITY') {
    const ready = Boolean(structureType && branchCount && country);
    return (
      <ActivationShell
        step="ACTIVITY"
        title="Parlez-nous de votre activité"
        subtitle="Trois réponses suffisent pour vous proposer la formule adaptée."
      >
        <Question label="Quel type de structure gérez-vous ?">
          {STRUCTURE_TYPES.map((s) => (
            <ChoiceCard
              key={s.value}
              label={s.label}
              selected={structureType === s.value}
              onSelect={() => setStructureType(s.value)}
            />
          ))}
        </Question>

        <Question label="Combien de boutiques gérez-vous ?">
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

        <Question label="Dans quel pays êtes-vous situé ?">
          <select
            className="input"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Pays"
          >
            <option value="">Choisissez votre pays</option>
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
            Continuer <ArrowRight className="h-4 w-4" />
          </PrimaryAction>
        </ActionBar>
      </ActivationShell>
    );
  }

  if (screen === 'NEEDS') {
    return (
      <ActivationShell
        step="NEEDS"
        title="Que souhaitez-vous améliorer ?"
        subtitle="Plusieurs réponses possibles. Cela nous sert à préparer votre configuration."
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
                Continuer <ArrowRight className="h-4 w-4" />
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
      title="Voici la formule adaptée à votre activité"
      subtitle={recommendation.reason}
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
                  <Sparkles className="h-3 w-3" /> Recommandé pour vous
                </span>
              )}
              <h2 className="font-display text-xl font-extrabold text-content">{p.name}</h2>
              <p className="mt-1 text-sm text-content-muted">{p.description}</p>

              <p className="mt-3 font-display text-2xl font-extrabold text-content">
                {planPrice(p.code, currency).toLocaleString('fr-FR')} {currency}
                <span className="ml-1 text-sm font-normal text-content-muted">/ mois</span>
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
                {selected ? 'Formule sélectionnée' : 'Choisir cette formule'}
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
          Comparer les autres formules
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
              Continuer <ArrowRight className="h-4 w-4" />
            </PrimaryAction>
          </div>
        </div>
      </ActionBar>
    </ActivationShell>
  );
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
