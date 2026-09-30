import { useState } from 'react';
import { ArrowLeft, Lock, PlayCircle, ShieldCheck } from 'lucide-react';
import {
  PLAN_CATALOG,
  SUPPORTED_COUNTRIES,
  paymentMethodsForCountry,
  planPriceForCycle,
  type BillingCycle,
  type PaymentMethod,
} from '@oculo/shared-types';
import { Button } from '../../components/ui';
import { ActionBar, ActivationShell, ChoiceCard, PrimaryAction } from './shared';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  CARD: 'Carte bancaire',
  CHEQUE: 'Chèque',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN MoMo',
  MOOV_MONEY: 'Moov Money',
  FREE_MONEY: 'Free Money',
  MPESA: 'M-Pesa',
  EMOLA: 'e-Mola',
  MKESH: 'mKesh',
  MULTICAIXA: 'Multicaixa',
};

/** 1440 -> « 24 heures », 4320 -> « 3 jours », 45 -> « 45 minutes ». */
export function formatTrialDuration(minutes: number): string {
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
  if (minutes % 1440 === 0 && minutes > 1440) return plural(minutes / 1440, 'jour');
  if (minutes % 60 === 0) return plural(minutes / 60, 'heure');
  return plural(minutes, 'minute');
}

/** 12000 -> « 12 000 », 17.2 -> « 17,20 » (centimes toujours complets). */
const money = (n: number) =>
  n.toLocaleString('fr-FR', Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Étape 5 — choix libre : tester gratuitement ou activer l'abonnement.
 *
 * Le paiement n'est pas obligatoire pour découvrir le logiciel : l'essai ouvre
 * l'espace aussitôt, pour la durée réglée en console fondateur. Le paiement,
 * lui, n'active rien par le bouton : il ouvre le checkout Moneroo, et l'espace
 * ne passe en abonnement actif qu'à la confirmation de la passerelle.
 */
export function PaymentStep({
  planCode,
  billingCycle,
  country,
  submitting,
  error,
  onBack,
  onPay,
  trialMinutes,
  onTrial,
}: {
  planCode: string | null;
  billingCycle: string | null;
  country: string | null;
  submitting: boolean;
  error: string;
  onBack: () => void;
  onPay: (method: PaymentMethod) => void;
  /** Durée de l'essai gratuit ; 0 = pas d'essai proposé. */
  trialMinutes: number;
  onTrial: () => void;
}) {
  const plan = PLAN_CATALOG.find((p) => p.code === planCode) ?? PLAN_CATALOG[0]!;
  const currency = SUPPORTED_COUNTRIES.find((c) => c.code === country)?.currency ?? 'XOF';
  const cycle = (billingCycle as BillingCycle) ?? 'MONTHLY';
  const total = planPriceForCycle(plan.code, currency, cycle);
  // L'abonnement est toujours facturé en FCFA : hors zone FCFA, on affiche
  // le montant réellement débité, pour que personne ne soit surpris.
  const billedXof = planPriceForCycle(plan.code, 'XOF', cycle);
  const outsideCfa = !(['XOF', 'XAF'] as string[]).includes(currency);

  // Les moyens dépendent du pays (pas de Wave en France) ; la carte bancaire
  // est acceptée partout par Moneroo.
  const mobile = paymentMethodsForCountry(country).filter((m) => m !== 'CASH' && m !== 'CHEQUE');
  const methods: PaymentMethod[] = [...mobile.filter((m) => m !== 'CARD'), 'CARD'];
  const [method, setMethod] = useState<PaymentMethod>(methods[0]!);

  const trial = trialMinutes > 0;
  const period = cycle === 'MONTHLY' ? '/ mois' : cycle === 'QUARTERLY' ? '/ 3 mois' : '/ 6 mois';

  return (
    <ActivationShell
      step="PAYMENT"
      title={trial ? 'Choisissez comment démarrer' : 'Activez votre abonnement'}
      subtitle={
        trial
          ? `Testez le logiciel gratuitement pendant ${formatTrialDuration(trialMinutes)}, ou activez votre abonnement dès maintenant.`
          : "Votre espace s'ouvrira dès la confirmation du paiement."
      }
    >
      {trial && (
        <section className="rounded-2xl border border-primary/40 bg-primary-soft/40 p-5">
          <p className="flex items-center gap-2 font-display text-lg font-extrabold text-content">
            <PlayCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            Tester gratuitement pendant {formatTrialDuration(trialMinutes)}
          </p>
          <p className="mt-1 text-sm text-content-muted">
            Accès complet, sans paiement ni carte bancaire. Vous activerez votre abonnement quand vous
            le souhaitez, depuis votre espace.
          </p>
          <Button className="mt-4 w-full justify-center" disabled={submitting} onClick={onTrial}>
            <PlayCircle className="h-4 w-4" />
            {submitting ? 'Ouverture de votre espace…' : "Commencer l'essai gratuit"}
          </Button>
        </section>
      )}

      {trial && (
        <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-content-faint">
          <span className="h-px flex-1 bg-line" /> ou activez dès maintenant <span className="h-px flex-1 bg-line" />
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-sm text-content-muted">OculoSaaS {plan.name}</p>
        <p className="mt-1 font-display text-3xl font-extrabold text-content">
          {money(total)} {currency === 'XOF' ? 'FCFA' : currency}
          <span className="ml-1 text-sm font-normal text-content-muted">{period}</span>
        </p>
        {outsideCfa && (
          <p className="mt-2 text-xs text-content-muted">
            Réglé par carte bancaire et débité en francs CFA : {money(billedXof)} FCFA {period}.
            {currency === 'EUR' ? '' : ' Le montant affiché dans votre devise est indicatif.'}
          </p>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 font-medium text-content">Moyen de paiement</p>
        <div className="space-y-2">
          {methods.map((m) => (
            <ChoiceCard
              key={m}
              label={METHOD_LABELS[m] ?? m}
              selected={method === m}
              onSelect={() => setMethod(m)}
            />
          ))}
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5 text-xs text-content-muted ring-1 ring-line">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        Votre abonnement sera activé après confirmation du paiement par la passerelle. Un simple
        retour depuis la page de paiement ne suffit pas.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ActionBar>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={submitting}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <PrimaryAction disabled={submitting} onClick={() => onPay(method)}>
              <Lock className="h-4 w-4" />
              {submitting ? 'Ouverture du paiement…' : 'Payer et activer mon abonnement'}
            </PrimaryAction>
          </div>
        </div>
      </ActionBar>
    </ActivationShell>
  );
}
