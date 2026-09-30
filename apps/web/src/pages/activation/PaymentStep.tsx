import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Landmark, Lock, MessageCircle, PlayCircle, ShieldCheck } from 'lucide-react';
import {
  PLAN_CATALOG,
  SUPPORTED_COUNTRIES,
  XOF_PER_EUR,
  paymentMethodsForCountry,
  planPriceForCycle,
  type BillingCycle,
  type PaymentMethod,
} from '@oculo/shared-types';
import { Button } from '../../components/ui';
import type { BankDetails, BankTransferRequest } from '../../features/activation/api';
import { TEAM_WHATSAPP_DISPLAY, transferReceiptLink } from '../../lib/whatsapp';
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
  BANK_TRANSFER: 'Virement bancaire',
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

/** Montant FCFA, avec son équivalent exact en euros hors zone FCFA. */
function xofLabel(xof: number, withEuro: boolean): string {
  const eur = Math.round((xof / XOF_PER_EUR) * 100) / 100;
  return `${money(xof)} FCFA${withEuro ? ` (${money(eur)} €)` : ''}`;
}

/** Pays hors zone FCFA : Moneroo n'y encaisse pas, seul le virement est proposé. */
function isOutsideCfa(country: string | null): boolean {
  const currency = SUPPORTED_COUNTRIES.find((c) => c.code === country)?.currency ?? 'XOF';
  return !(['XOF', 'XAF'] as string[]).includes(currency);
}

/**
 * Étape 5 — choix libre : tester gratuitement ou activer l'abonnement.
 *
 * Trois façons d'activer : Mobile Money ou carte via Moneroo (checkout,
 * activation à la confirmation de la passerelle), ou virement bancaire
 * (facture en attente, activation par l'équipe à réception du reçu envoyé
 * sur WhatsApp). Depuis l'Europe, Moneroo n'encaisse pas : seul le virement
 * est proposé.
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
  bank,
  onBankTransfer,
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
  /** Coordonnées bancaires de l'éditeur ; null = virement non proposé. */
  bank: BankDetails | null;
  onBankTransfer: () => void;
}) {
  const plan = PLAN_CATALOG.find((p) => p.code === planCode) ?? PLAN_CATALOG[0]!;
  const currency = SUPPORTED_COUNTRIES.find((c) => c.code === country)?.currency ?? 'XOF';
  const cycle = (billingCycle as BillingCycle) ?? 'MONTHLY';
  const total = planPriceForCycle(plan.code, currency, cycle);
  // L'abonnement est toujours facturé en FCFA.
  const billedXof = planPriceForCycle(plan.code, 'XOF', cycle);
  const outsideCfa = isOutsideCfa(country);

  const mobile = paymentMethodsForCountry(country).filter((m) => m !== 'CASH' && m !== 'CHEQUE');
  const online: PaymentMethod[] = outsideCfa ? [] : [...mobile.filter((m) => m !== 'CARD'), 'CARD'];
  const methods: PaymentMethod[] = [...online, ...(bank ? (['BANK_TRANSFER'] as PaymentMethod[]) : [])];
  const [method, setMethod] = useState<PaymentMethod | null>(methods[0] ?? null);

  const trial = trialMinutes > 0;
  const period = cycle === 'MONTHLY' ? '/ mois' : cycle === 'QUARTERLY' ? '/ 3 mois' : '/ 6 mois';
  const isTransfer = method === 'BANK_TRANSFER';

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
            Réglé par virement bancaire en francs CFA : {xofLabel(billedXof, currency === 'EUR')} {period}.
            {currency === 'EUR' ? ' Parité fixe : 1 € = 655,957 FCFA.' : ' Le montant dans votre devise est indicatif.'}
          </p>
        )}
      </div>

      {methods.length === 0 ? (
        <div className="mt-5 rounded-xl bg-[color:var(--warning)]/10 p-4 text-sm text-content">
          Le paiement en ligne n'est pas disponible depuis votre pays. Écrivez-nous sur WhatsApp au{' '}
          <span className="font-semibold">{TEAM_WHATSAPP_DISPLAY}</span> : nous vous indiquons comment
          régler votre abonnement.
        </div>
      ) : (
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
      )}

      {isTransfer && bank && (
        <div className="mt-4">
          <BankCard bank={bank} amount={xofLabel(billedXof, outsideCfa)} />
          <ol className="mt-3 space-y-1.5 text-sm text-content-muted">
            <li>1. Faites le virement du montant ci-dessus sur ce compte.</li>
            <li>
              2. Envoyez la capture d'écran ou le reçu sur WhatsApp au{' '}
              <span className="font-semibold text-content">{TEAM_WHATSAPP_DISPLAY}</span>.
            </li>
            <li>3. Nous vérifions le virement et activons votre compte.</li>
          </ol>
        </div>
      )}

      {!isTransfer && methods.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5 text-xs text-content-muted ring-1 ring-line">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          Votre abonnement sera activé après confirmation du paiement par la passerelle. Un simple
          retour depuis la page de paiement ne suffit pas.
        </p>
      )}

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
            {isTransfer ? (
              <PrimaryAction disabled={submitting} onClick={onBankTransfer}>
                <Landmark className="h-4 w-4" />
                {submitting ? 'Enregistrement…' : "J'ai fait le virement"}
              </PrimaryAction>
            ) : (
              <PrimaryAction disabled={!method || submitting} onClick={() => method && onPay(method)}>
                <Lock className="h-4 w-4" />
                {submitting ? 'Ouverture du paiement…' : 'Payer et activer mon abonnement'}
              </PrimaryAction>
            )}
          </div>
        </div>
      </ActionBar>
    </ActivationShell>
  );
}

/** Coordonnées bancaires de l'éditeur, avec le montant exact à virer. */
export function BankCard({ bank, amount }: { bank: BankDetails; amount: string }) {
  const rows: [string, string | null, boolean?][] = [
    ['Banque', bank.bankName],
    ['Titulaire', bank.accountName],
    ['IBAN / N° de compte', bank.accountNumber, true],
    ['SWIFT / BIC', bank.swift],
  ];
  return (
    <div className="rounded-xl bg-surface-2 p-4 text-sm ring-1 ring-line">
      {rows
        .filter(([, v]) => v)
        .map(([label, value, strong]) => (
          <div key={label} className="flex flex-wrap justify-between gap-x-3 py-0.5">
            <span className="text-content-muted">{label}</span>
            <span className={`select-all break-all text-right ${strong ? 'font-bold' : 'font-semibold'} text-content`}>
              {value}
            </span>
          </div>
        ))}
      <div className="mt-2 flex justify-between border-t border-line pt-2">
        <span className="text-content-muted">Montant à virer</span>
        <span className="font-display font-bold text-content">{amount}</span>
      </div>
    </div>
  );
}

/**
 * Virement déclaré : rien n'est encore activé. L'écran le dit clairement et
 * donne le moyen d'envoyer le reçu à l'équipe, message pré-rempli.
 */
export function BankTransferSent({
  request,
  bank,
  country,
  establishment,
  trialMinutes,
  submitting,
  error,
  onTrial,
}: {
  request: BankTransferRequest;
  bank: BankDetails | null;
  country: string | null;
  establishment: string | null;
  trialMinutes: number;
  submitting: boolean;
  error: string;
  onTrial: () => void;
}) {
  const amount = request.currency === 'XOF'
    ? xofLabel(request.amount, isOutsideCfa(country))
    : `${money(request.amount)} ${request.currency}`;
  const link = transferReceiptLink({ invoiceNumber: request.invoiceNumber, establishment, amount });

  return (
    <ActivationShell title="Virement enregistré" subtitle="Dernière étape : envoyez-nous votre reçu.">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 font-medium text-content">
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
          Facture {request.invoiceNumber} — {amount}
        </p>
        <p className="mt-2 text-sm text-content-muted">
          Envoyez la capture d'écran ou le reçu de votre virement sur WhatsApp au{' '}
          <span className="font-semibold text-content">{TEAM_WHATSAPP_DISPLAY}</span>. Nous vérifions
          le virement puis activons votre compte : vous vous connecterez alors avec votre e-mail et
          votre mot de passe.
        </p>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-white shadow-sm hover:brightness-95"
        >
          <MessageCircle className="h-5 w-5" /> Envoyer mon reçu sur WhatsApp
        </a>
      </div>

      {bank && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-content">Rappel des coordonnées bancaires</p>
          <BankCard bank={bank} amount={amount} />
        </div>
      )}

      {trialMinutes > 0 && (
        <div className="mt-5 rounded-2xl border border-primary/40 bg-primary-soft/40 p-5">
          <p className="font-medium text-content">En attendant la vérification</p>
          <p className="mt-1 text-sm text-content-muted">
            Découvrez le logiciel gratuitement pendant {formatTrialDuration(trialMinutes)}.
          </p>
          <Button className="mt-3 w-full justify-center" disabled={submitting} onClick={onTrial}>
            <PlayCircle className="h-4 w-4" />
            {submitting ? 'Ouverture de votre espace…' : "Commencer l'essai gratuit"}
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </ActivationShell>
  );
}
