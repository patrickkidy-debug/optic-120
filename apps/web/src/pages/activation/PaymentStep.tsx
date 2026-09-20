import { useState } from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
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

/**
 * Étape 5 — paiement.
 *
 * Le bouton n'active rien : il ouvre le paiement chez Moneroo. L'espace ne
 * s'ouvre qu'à la confirmation reçue de la passerelle, jamais sur un simple
 * retour de navigateur. L'écran l'annonce clairement, pour qu'un client qui
 * abandonne le checkout ne croie pas son compte actif.
 */
export function PaymentStep({
  planCode,
  billingCycle,
  country,
  submitting,
  error,
  onBack,
  onPay,
}: {
  planCode: string | null;
  billingCycle: string | null;
  country: string | null;
  submitting: boolean;
  error: string;
  onBack: () => void;
  onPay: (method: PaymentMethod) => void;
}) {
  const plan = PLAN_CATALOG.find((p) => p.code === planCode) ?? PLAN_CATALOG[0]!;
  const currency = SUPPORTED_COUNTRIES.find((c) => c.code === country)?.currency ?? 'XOF';
  const cycle = (billingCycle as BillingCycle) ?? 'MONTHLY';
  const total = planPriceForCycle(plan.code, currency, cycle);

  // Les moyens dépendent du pays : proposer Wave au Mozambique n'aurait aucun sens.
  const methods = paymentMethodsForCountry(country).filter((m) => m !== 'CASH' && m !== 'CHEQUE');
  const [method, setMethod] = useState<PaymentMethod | null>(methods[0] ?? null);

  return (
    <ActivationShell
      step="PAYMENT"
      title="Activez votre abonnement"
      subtitle="Votre espace s'ouvrira dès la confirmation du paiement."
    >
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-sm text-content-muted">OculoSaaS {plan.name}</p>
        <p className="mt-1 font-display text-3xl font-extrabold text-content">
          {total.toLocaleString('fr-FR')} {currency}
          <span className="ml-1 text-sm font-normal text-content-muted">
            {cycle === 'MONTHLY' ? '/ mois' : cycle === 'QUARTERLY' ? '/ 3 mois' : '/ 6 mois'}
          </span>
        </p>
      </div>

      <div className="mt-5">
        <p className="mb-2 font-medium text-content">Moyen de paiement</p>
        {methods.length === 0 ? (
          <p className="rounded-lg bg-[color:var(--warning)]/10 px-3 py-2 text-sm text-warning">
            Aucun moyen de paiement n'est disponible pour ce pays. Contactez-nous pour régler
            autrement.
          </p>
        ) : (
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
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5 text-xs text-content-muted ring-1 ring-line">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        Votre compte sera activé après confirmation du paiement par la passerelle. Un simple retour
        depuis la page de paiement ne suffit pas.
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
            <PrimaryAction disabled={!method || submitting} onClick={() => method && onPay(method)}>
              <Lock className="h-4 w-4" />
              {submitting ? 'Ouverture du paiement…' : 'Payer et activer mon abonnement'}
            </PrimaryAction>
          </div>
        </div>
      </ActionBar>
    </ActivationShell>
  );
}
