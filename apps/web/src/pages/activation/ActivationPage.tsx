import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Sparkles } from 'lucide-react';
import {
  ACTIVATION_NEEDS,
  BRANCH_COUNTS,
  PLAN_CATALOG,
  STRUCTURE_TYPES,
  SUPPORTED_COUNTRIES,
  planPrice,
  recommendPlan,
  type ActivationNeed,
  type ActivationStep,
  type BranchCount,
  type StructureType,
} from '@oculo/shared-types';
import { Button } from '../../components/ui';
import { ActionBar, ActivationShell, ChoiceCard, MultiChoiceCard, PrimaryAction } from './shared';
import { Intro } from './Intro';

/**
 * Tunnel d'activation — parcours commercial obligatoire.
 *
 * Les trois premières étapes ne demandent aucun compte : elles qualifient le
 * prospect et aboutissent à une offre recommandée. L'état vit dans la page ;
 * la reprise après abandon, la création de l'établissement et le paiement
 * arrivent aux étapes suivantes, côté serveur.
 */

type Screen = 'INTRO' | ActivationStep;

export function ActivationPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('INTRO');

  const [structureType, setStructureType] = useState<StructureType | null>(null);
  const [branchCount, setBranchCount] = useState<BranchCount | null>(null);
  const [country, setCountry] = useState('');
  const [needs, setNeeds] = useState<ActivationNeed[]>([]);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  const recommendation = useMemo(
    () => recommendPlan(branchCount, needs, structureType),
    [branchCount, needs, structureType],
  );
  const currency = SUPPORTED_COUNTRIES.find((c) => c.code === country)?.currency ?? 'XOF';

  if (screen === 'INTRO') {
    return <Intro onStart={() => setScreen('ACTIVITY')} />;
  }

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

        <ActionBar>
          <PrimaryAction disabled={!ready} onClick={() => setScreen('NEEDS')}>
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

        <ActionBar>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setScreen('ACTIVITY')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <PrimaryAction
                disabled={needs.length === 0}
                onClick={() => {
                  setPlanCode(recommendation.planCode);
                  setScreen('PLAN');
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

  // Étape 3 — offre recommandée.
  const shown = comparing ? PLAN_CATALOG : PLAN_CATALOG.filter((p) => p.code === recommendation.planCode);

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

      <ActionBar>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScreen('NEEDS')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <PrimaryAction disabled={!planCode} onClick={() => navigate('/activation')}>
              Continuer <ArrowRight className="h-4 w-4" />
            </PrimaryAction>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-content-faint">
          Les étapes « Vos informations » et « Paiement » arrivent dans la prochaine livraison.
        </p>
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
