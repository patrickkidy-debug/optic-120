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
import { TEAM_WHATSAPP_DISPLAY, demoWhatsappLink, transferReceiptLink } from '../../lib/whatsapp';
import { ActionBar, ActivationShell, ChoiceCard, PrimaryAction } from './shared';
import { displayLocale } from '../../lib/format';
import { tr } from '../../lib/tr';

const METHOD_LABELS: Record<string, string> = {
  get CASH() { return tr('ui.PaymentStep.especes'); },
  get CARD() { return tr('ui.PaymentStep.carteBancaire'); },
  get CHEQUE() { return tr('ui.PaymentStep.cheque'); },
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN MoMo',
  MOOV_MONEY: 'Moov Money',
  FREE_MONEY: 'Free Money',
  MPESA: 'M-Pesa',
  EMOLA: 'e-Mola',
  MKESH: 'mKesh',
  MULTICAIXA: 'Multicaixa',
  get BANK_TRANSFER() { return tr('ui.PaymentStep.virementBancaire'); },
};

/** 1440 -> « 24 heures », 4320 -> « 3 jours », 45 -> « 45 minutes ». */
export function formatTrialDuration(minutes: number): string {
  // Pluriel géré par i18next (units.hours_one / units.hours_other…).
  if (minutes % 1440 === 0 && minutes > 1440) return tr('units.days', { count: minutes / 1440 });
  if (minutes % 60 === 0) return tr('units.hours', { count: minutes / 60 });
  return tr('units.minutes', { count: minutes });
}

/** 12000 -> « 12 000 », 17.2 -> « 17,20 » (centimes toujours complets). */
const money = (n: number) =>
  n.toLocaleString(displayLocale(), Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
 * Deux façons d'activer : Mobile Money via Moneroo (checkout,
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
  contact,
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
  /** Coordonnées saisies à l'étape 4, reprises dans le message WhatsApp. */
  contact: { fullName?: string | null; establishment?: string | null; city?: string | null };
}) {
  const plan = PLAN_CATALOG.find((p) => p.code === planCode) ?? PLAN_CATALOG[0]!;
  const currency = SUPPORTED_COUNTRIES.find((c) => c.code === country)?.currency ?? 'XOF';
  const cycle = (billingCycle as BillingCycle) ?? 'MONTHLY';
  const total = planPriceForCycle(plan.code, currency, cycle);
  // L'abonnement est toujours facturé en FCFA.
  const billedXof = planPriceForCycle(plan.code, 'XOF', cycle);
  const outsideCfa = isOutsideCfa(country);

  const mobile = paymentMethodsForCountry(country).filter((m) => m !== 'CASH' && m !== 'CHEQUE');
  // Pas de carte bancaire : Mobile Money via Moneroo, ou virement.
  const online: PaymentMethod[] = outsideCfa ? [] : mobile.filter((m) => m !== 'CARD');
  const methods: PaymentMethod[] = [...online, ...(bank ? (['BANK_TRANSFER'] as PaymentMethod[]) : [])];
  const [method, setMethod] = useState<PaymentMethod | null>(methods[0] ?? null);

  const trial = trialMinutes > 0;
  const period = tr(cycle === 'MONTHLY' ? 'units.perMonth' : cycle === 'QUARTERLY' ? 'units.per3Months' : 'units.per6Months');
  const isTransfer = method === 'BANK_TRANSFER';

  return (
    <ActivationShell
      step="PAYMENT"
      title={trial ? tr('ui.PaymentStep.choisissezCommentDemarrer') : tr('ui.PaymentStep.activezVotreAbonnement')}
      subtitle={
        trial
          ? tr('ui.PaymentStep.testezLeLogicielGratuitementPendant', { trialMinutes: formatTrialDuration(trialMinutes) })
          : tr('ui.PaymentStep.votreEspaceSOuvriraDes')
      }
    >
      {trial && (
        <section className="rounded-2xl border border-primary/40 bg-primary-soft/40 p-5">
          <p className="flex items-center gap-2 font-display text-lg font-extrabold text-content">
            <PlayCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            {tr('ui.PaymentStep.testerGratuitementPendant')} {formatTrialDuration(trialMinutes)}
          </p>
          <p className="mt-1 text-sm text-content-muted">
            {tr('ui.PaymentStep.accesCompletSansPaiementNi')}
          </p>
          <Button className="mt-4 w-full justify-center" disabled={submitting} onClick={onTrial}>
            <PlayCircle className="h-4 w-4" />
            {submitting ? tr('ui.PaymentStep.ouvertureDeVotreEspace') : tr('ui.PaymentStep.commencerLEssaiGratuit')}
          </Button>
        </section>
      )}

      <WhatsappContact contact={contact} planName={plan.name} />

      {trial && (
        <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-content-faint">
          <span className="h-px flex-1 bg-line" /> {tr('ui.PaymentStep.ouActivezDesMaintenant')} <span className="h-px flex-1 bg-line" />
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
            {tr('ui.PaymentStep.regleParVirementBancaireEn')} {xofLabel(billedXof, currency === 'EUR')} {period}.
            {currency === 'EUR' ? tr('ui.PaymentStep.pariteFixe1655957') : tr('ui.PaymentStep.leMontantDansVotreDevise')}
          </p>
        )}
      </div>

      {methods.length === 0 ? (
        <div className="mt-5 rounded-xl bg-[color:var(--warning)]/10 p-4 text-sm text-content">
          {tr('ui.PaymentStep.lePaiementEnLigneN')}{' '}
          <span className="font-semibold">{TEAM_WHATSAPP_DISPLAY}</span> {tr('ui.PaymentStep.nousVousIndiquonsCommentRegler')}
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-2 font-medium text-content">{tr('ui.PaymentStep.moyenDePaiement')}</p>
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
            <li>{tr('ui.PaymentStep.n1FaitesLeVirementDu')}</li>
            <li>
              {tr('ui.PaymentStep.n2EnvoyezLaCaptureD')}{' '}
              <span className="font-semibold text-content">{TEAM_WHATSAPP_DISPLAY}</span>.
            </li>
            <li>{tr('ui.PaymentStep.n3NousVerifionsLeVirement')}</li>
          </ol>
        </div>
      )}

      {!isTransfer && methods.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5 text-xs text-content-muted ring-1 ring-line">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          {tr('ui.PaymentStep.votreAbonnementSeraActiveApres')}
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
                {submitting ? tr('ui.PaymentStep.enregistrement') : tr('ui.PaymentStep.jAiFaitLeVirement')}
              </PrimaryAction>
            ) : (
              <PrimaryAction disabled={!method || submitting} onClick={() => method && onPay(method)}>
                <Lock className="h-4 w-4" />
                {submitting ? tr('ui.PaymentStep.ouvertureDuPaiement') : tr('ui.PaymentStep.payerEtActiverMonAbonnement')}
              </PrimaryAction>
            )}
          </div>
        </div>
      </ActionBar>
    </ActivationShell>
  );
}

/**
 * Discussion avec l'équipe, proposée seulement ici : le prospect a déjà donné
 * ses coordonnées, le message pré-rempli les reprend pour que l'équipe sache
 * à qui elle parle sans poser de questions.
 */
function WhatsappContact({
  contact,
  planName,
}: {
  contact: { fullName?: string | null; establishment?: string | null; city?: string | null };
  planName: string;
}) {
  const lines = [
    tr('ui.PaymentStep.bonjourJAiUneQuestion'),
    contact.fullName ? tr('ui.PaymentStep.nomFullname', { fullName: contact.fullName }) : '',
    contact.establishment
      ? `Établissement : ${contact.establishment}${contact.city ? ` (${contact.city})` : ''}`
      : '',
    tr('ui.PaymentStep.offreEnvisageePlanname', { planName: planName }),
  ].filter(Boolean);
  return (
    <a
      href={demoWhatsappLink(lines.join('\n'))}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[#128C7E] ring-1 ring-[#25D366]/50 transition hover:bg-[#25D366]/10"
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {tr('ui.PaymentStep.uneQuestionAvantDeVous')}
    </a>
  );
}

/** Coordonnées bancaires de l'éditeur, avec le montant exact à virer. */
export function BankCard({ bank, amount }: { bank: BankDetails; amount: string }) {
  const rows: [string, string | null, boolean?][] = [
    [tr('ui.PaymentStep.banque'), bank.bankName],
    [tr('ui.PaymentStep.titulaire'), bank.accountName],
    [tr('ui.PaymentStep.ibanNDeCompte'), bank.accountNumber, true],
    [tr('ui.PaymentStep.swiftBic'), bank.swift],
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
        <span className="text-content-muted">{tr('ui.PaymentStep.montantAVirer')}</span>
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
    <ActivationShell title={tr('ui.PaymentStep.virementEnregistre')} subtitle={tr('ui.PaymentStep.derniereEtapeEnvoyezNousVotre')}>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 font-medium text-content">
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
          {tr('ui.PaymentStep.facture')} {request.invoiceNumber} — {amount}
        </p>
        <p className="mt-2 text-sm text-content-muted">
          {tr('ui.PaymentStep.envoyezLaCaptureDEcran')}{' '}
          <span className="font-semibold text-content">{TEAM_WHATSAPP_DISPLAY}</span>{tr('ui.PaymentStep.nousVerifionsLeVirementPuis')}
        </p>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-white shadow-sm hover:brightness-95"
        >
          <MessageCircle className="h-5 w-5" /> {tr('ui.PaymentStep.envoyerMonRecuSurWhatsapp')}
        </a>
      </div>

      {bank && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-content">{tr('ui.PaymentStep.rappelDesCoordonneesBancaires')}</p>
          <BankCard bank={bank} amount={amount} />
        </div>
      )}

      {trialMinutes > 0 && (
        <div className="mt-5 rounded-2xl border border-primary/40 bg-primary-soft/40 p-5">
          <p className="font-medium text-content">{tr('ui.PaymentStep.enAttendantLaVerification')}</p>
          <p className="mt-1 text-sm text-content-muted">
            {tr('ui.PaymentStep.decouvrezLeLogicielGratuitementPendant')} {formatTrialDuration(trialMinutes)}.
          </p>
          <Button className="mt-3 w-full justify-center" disabled={submitting} onClick={onTrial}>
            <PlayCircle className="h-4 w-4" />
            {submitting ? tr('ui.PaymentStep.ouvertureDeVotreEspace') : tr('ui.PaymentStep.commencerLEssaiGratuit')}
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
