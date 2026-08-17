import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Crown,
  Check,
  Banknote,
  Smartphone,
  CreditCard,
  Loader2,
  CheckCircle2,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { PaymentMethod, BillingCycle } from '@oculo/shared-types';
import {
  getPlans,
  getSubscription,
  getInvoices,
  subscribe,
  payInvoice,
  billingPaymentStatus,
  simulateBillingPayment,
  getPayInfo,
  subscribeManual,
  type Plan,
} from '../../features/billing/api';
import { useAuthStore, usePermission } from '../../store/auth';
import { planPrice, planPriceForCycle, BILLING_CYCLE_MONTHS, BILLING_CYCLE_DISCOUNT } from '@oculo/shared-types';
import { apiErrorMessage } from '../../lib/api';
import { trackPixelEvent } from '../../lib/pixel';
import { formatCurrency, formatDate, getActiveCurrency } from '../../lib/format';
import { PageHeader, Button, Modal, Badge, PageLoader } from '../../components/ui';
import { PaymentMethodLogos } from '../../components/PaymentMethodLogos';

// Trace un paiement lancé en plein écran (redirection Moneroo) le temps que
// l'utilisateur revienne sur la page, afin de pouvoir confirmer le Purchase
// Meta Pixel sans dépendre d'un paramètre d'URL renvoyé par Moneroo.
const PENDING_PURCHASE_KEY = 'oculo-pending-purchase';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  TRIALING: { label: 'En attente de paiement', tone: 'warning' },
  ACTIVE: { label: 'Actif', tone: 'success' },
  PAST_DUE: { label: 'Paiement en retard', tone: 'warning' },
  SUSPENDED: { label: 'Suspendu', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

/** Cycle choisi sur la landing : URL (?cycle=) d'abord, sinon mémorisé à l'inscription. */
function readSelectedCycle(params: URLSearchParams): BillingCycle {
  const fromUrl = params.get('cycle');
  if (fromUrl === 'QUARTERLY' || fromUrl === 'SEMIANNUAL') return fromUrl;
  const stored = sessionStorage.getItem('oculo-cycle');
  return stored === 'QUARTERLY' || stored === 'SEMIANNUAL' ? stored : 'MONTHLY';
}

function limitLabel(v: number | null): string {
  return v == null ? 'Illimité' : String(v);
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max == null ? 0 : Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const danger = max != null && used >= max;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-content-muted">{label}</span>
        <span className={danger ? 'font-semibold text-danger' : 'text-content'}>
          {used} / {limitLabel(max)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full ${danger ? 'bg-danger' : 'bg-brand'}`}
          style={{ width: max == null ? '12%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

const CYCLE_OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: 'MONTHLY', label: 'Mensuel' },
  { value: 'QUARTERLY', label: '3 mois' },
  { value: 'SEMIANNUAL', label: '6 mois' },
];

/** Sélecteur de cycle de facturation : mensuel, 3 mois ou 6 mois payés en une fois. */
function CycleToggle({ cycle, onChange }: { cycle: BillingCycle; onChange: (c: BillingCycle) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border bg-surface p-1">
      {CYCLE_OPTIONS.map((opt) => {
        const discount = BILLING_CYCLE_DISCOUNT[opt.value];
        const active = cycle === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              active ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
            }`}
          >
            {opt.label}
            {discount > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-success/15 text-success'
                }`}
              >
                −{Math.round(discount * 100)}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Prix affiché pour une offre + un cycle : montant total, et détail mensuel équivalent + économie si groupé. */
function PlanPrice({ code, currency, cycle }: { code: string; currency: string; cycle: BillingCycle }) {
  const total = planPriceForCycle(code, currency, cycle);
  if (cycle === 'MONTHLY') {
    return (
      <p className="mt-3 font-display text-2xl font-bold text-content">
        {formatCurrency(total)}
        <span className="text-sm font-normal text-content-muted"> / mois</span>
      </p>
    );
  }
  const monthly = planPrice(code, currency);
  const months = BILLING_CYCLE_MONTHS[cycle];
  const fullPrice = monthly * months;
  const savings = fullPrice - total;
  return (
    <div className="mt-3">
      <p className="font-display text-2xl font-bold text-content">
        {formatCurrency(total)}
        <span className="text-sm font-normal text-content-muted"> pour {months} mois</span>
      </p>
      <p className="mt-0.5 text-xs text-content-muted">≈ {formatCurrency(Math.round(total / months))} / mois</p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-success">
        <Tag className="h-3 w-3" /> Économisez {formatCurrency(savings)}
      </p>
    </div>
  );
}

export function SubscriptionPage() {
  const currency = getActiveCurrency();
  const qc = useQueryClient();
  const canManage = usePermission('billing.manage');
  const setSuspended = useAuthStore((s) => s.setSuspended);
  const [payFor, setPayFor] = useState<{ kind: 'plan' | 'invoice'; id: string; label: string; amount: number; cycle: BillingCycle } | null>(null);

  const { data: sub, isLoading } = useQuery({ queryKey: ['subscription'], queryFn: getSubscription });
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: getPlans });
  const { data: invoices } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });

  // On ne lève la garde que si l'abonnement donne RÉELLEMENT accès : statut
  // actif ET période en cours non expirée. Un statut "TRIALING" (en attente de
  // paiement, période déjà expirée) ne doit jamais débloquer le dashboard,
  // sinon l'utilisateur accéderait à son espace sans avoir payé.
  useEffect(() => {
    const hasAccess =
      sub != null &&
      sub.status !== 'SUSPENDED' &&
      sub.status !== 'CANCELLED' &&
      new Date(sub.currentPeriodEnd).getTime() > Date.now();
    if (hasAccess) setSuspended(false);
  }, [sub, setSuspended]);

  // Retour d'une redirection plein écran vers Moneroo (forfait payant choisi
  // à l'inscription) : on reprend le suivi du paiement amorcé avant le départ
  // pour confirmer l'événement Purchase une fois le paiement validé.
  const resumedPurchase = useRef(false);
  useEffect(() => {
    if (resumedPurchase.current) return;
    resumedPurchase.current = true;
    const raw = sessionStorage.getItem(PENDING_PURCHASE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_PURCHASE_KEY);
    let pending: { paymentId: string; planName: string; amount: number };
    try {
      pending = JSON.parse(raw);
    } catch {
      return;
    }
    let attempts = 0;
    const iv = setInterval(async () => {
      attempts += 1;
      try {
        const s = await billingPaymentStatus(pending.paymentId);
        if (s.status === 'SUCCESS') {
          // eventID identique au eventId envoyé côté serveur (Conversions API) → déduplication Meta.
          trackPixelEvent(
            'Purchase',
            { value: pending.amount, currency: 'XOF', content_name: pending.planName },
            `purchase_${pending.paymentId}`,
          );
          qc.invalidateQueries({ queryKey: ['subscription'] });
          setSuspended(false);
          clearInterval(iv);
        } else if (s.status === 'FAILED' || attempts >= 24) {
          clearInterval(iv);
        }
      } catch {
        clearInterval(iv);
      }
    }, 2500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Offre présélectionnée depuis la landing (?plan=CODE&cycle=SEMIANNUAL).
  const [params, setParams] = useSearchParams();

  // Cycle de facturation choisi (toggle "Nos offres" + grille de réactivation) —
  // initialisé depuis l'URL si le visiteur a déjà choisi "6 mois" sur la landing.
  const [cycle, setCycle] = useState<BillingCycle>(readSelectedCycle(params));

  // « Activer l'abonnement » (bandeau d'essai) arrive avec ?pay=1 : on ouvre
  // aussitôt le paiement de l'offre en cours, même si on est déjà sur la page.
  useEffect(() => {
    if (params.get('pay') !== '1' || !sub || !canManage) return;
    setPayFor({
      kind: 'plan',
      id: sub.plan.id,
      label: sub.plan.name,
      amount: planPriceForCycle(sub.plan.code, currency, cycle),
      cycle,
    });
    setParams({}, { replace: true });
  }, [params, sub, canManage, currency, cycle, setParams]);
  const autoOpened = useRef(false);
  const [autoLaunch, setAutoLaunch] = useState(false);
  useEffect(() => {
    const code = params.get('plan');
    if (!code || autoOpened.current || !plans) return;
    const plan = plans.find((p) => p.code === code);
    if (!plan) return;
    autoOpened.current = true;
    // Cycle porté depuis la landing (?cycle=SEMIANNUAL), sinon mensuel par défaut.
    const initCycle: BillingCycle = readSelectedCycle(params);
    const amount = planPriceForCycle(plan.code, currency, initCycle);
    // Plus d'essai gratuit : toute offre présélectionnée (Starter par défaut
    // après l'inscription) lance directement le paiement Moneroo.
    setAutoLaunch(true);
    subscribe(plan.id, 'WAVE', undefined, initCycle)
      .then((res) => {
        // eventID identique au eventId envoyé côté serveur (Conversions API) → déduplication Meta.
        trackPixelEvent(
          'InitiateCheckout',
          { value: amount, currency, content_name: plan.name },
          `checkout_${res.paymentId}`,
        );
        if (res.redirectUrl) {
          // Mémorise le paiement pour confirmer le Purchase au retour de Moneroo.
          sessionStorage.setItem(
            PENDING_PURCHASE_KEY,
            JSON.stringify({ paymentId: res.paymentId, planName: plan.name, amount }),
          );
          window.location.href = res.redirectUrl;
        } else {
          setAutoLaunch(false);
          setPayFor({ kind: 'plan', id: plan.id, label: plan.name, amount, cycle: initCycle });
        }
      })
      .catch(() => {
        setAutoLaunch(false);
        setPayFor({ kind: 'plan', id: plan.id, label: plan.name, amount, cycle: initCycle });
      });
  }, [params, plans, currency]);

  if (isLoading) return <PageLoader />;
  if (autoLaunch)
    return (
      <div className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-3 text-sm text-content-muted">
            Redirection vers le paiement sécurisé Moneroo…
          </p>
        </div>
      </div>
    );

  return (
    <div>
      <PageHeader title="Abonnement" subtitle="Votre offre, votre consommation et vos factures" />

      {sub && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card bg-hero p-5 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white">
                <Crown className="h-5 w-5" />
              </span>
              <Badge tone={STATUS[sub.status]?.tone ?? 'neutral'}>{STATUS[sub.status]?.label ?? sub.status}</Badge>
            </div>
            <h3 className="mt-3 font-display text-xl font-bold text-content">Offre {sub.plan.name}</h3>
            <p className="font-display text-2xl font-bold text-gradient">{formatCurrency(planPrice(sub.plan.code, currency))}<span className="text-sm font-normal text-content-muted"> / mois</span></p>
            <p className="mt-2 text-xs text-content-muted">
              {sub.status === 'TRIALING'
                ? "Activez votre abonnement pour accéder à votre espace."
                : `Période en cours jusqu'au ${formatDate(sub.currentPeriodEnd)}`}
            </p>
          </div>

          <div className="card p-5 lg:col-span-2">
            <h4 className="mb-3 font-display font-bold text-content">Consommation</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UsageBar label="Utilisateurs" used={sub.usage.users} max={sub.plan.maxUsers} />
              <UsageBar label="Magasins" used={sub.usage.branches} max={sub.plan.maxBranches} />
              <UsageBar label="Patients" used={sub.usage.patients} max={sub.plan.maxPatients} />
              <UsageBar label="Ventes" used={sub.usage.sales} max={sub.plan.maxSales} />
            </div>
          </div>
        </div>
      )}

      {/* Échéance atteinte : on présente TOUTES les offres pour que le client
          règle directement celle qu'il veut, sans être poussé vers une seule. */}
      {(() => {
        const needsActivation =
          !!sub && (sub.status !== 'ACTIVE' || new Date(sub.currentPeriodEnd).getTime() <= Date.now());
        if (!plans || plans.length === 0 || !needsActivation || !canManage) return null;
        const expired = new Date(sub!.currentPeriodEnd).getTime() <= Date.now();
        return (
          <div className="mb-8 overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-br from-primary-soft to-surface p-6 shadow-glow">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
              <Sparkles className="h-3.5 w-3.5" /> Choisissez votre offre
            </span>
            <h3 className="mt-3 font-display text-2xl font-extrabold text-content">
              {expired ? 'Réactivez votre espace' : 'Activez votre abonnement'}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-content-muted">
              {expired
                ? 'Votre période est terminée. Sélectionnez l’offre qui vous convient et réglez-la directement — vous retrouvez l’accès immédiatement.'
                : 'Sélectionnez librement l’offre qui vous convient pour continuer sans interruption.'}
            </p>

            <div className="mt-4">
              <CycleToggle cycle={cycle} onChange={setCycle} />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => {
                const isCurrent = sub?.plan.code === p.code;
                return (
                  <div
                    key={p.id}
                    className="flex flex-col rounded-xl border bg-surface p-4 transition hover:border-primary hover:shadow-card-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-display font-bold text-content">{p.name}</h4>
                      {isCurrent && <Badge tone="info">Offre actuelle</Badge>}
                    </div>
                    <PlanPrice code={p.code} currency={currency} cycle={cycle} />
                    <ul className="mt-2 flex-1 space-y-1">
                      {p.features.slice(0, 4).map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-xs text-content-muted">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-3 w-full"
                      variant={isCurrent ? undefined : 'outline'}
                      onClick={() =>
                        setPayFor({
                          kind: 'plan',
                          id: p.id,
                          label: p.name,
                          amount: planPriceForCycle(p.code, currency, cycle),
                          cycle,
                        })
                      }
                    >
                      Payer {p.name}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-content">Nos offres</h3>
        <CycleToggle cycle={cycle} onChange={setCycle} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans?.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            current={sub?.plan.code === p.code}
            canManage={canManage}
            cycle={cycle}
            onSubscribe={() =>
              setPayFor({ kind: 'plan', id: p.id, label: p.name, amount: planPriceForCycle(p.code, currency, cycle), cycle })
            }
          />
        ))}
      </div>

      {invoices && invoices.length > 0 && (
        <div className="card mt-6 overflow-hidden">
          <div className="border-b px-5 py-4">
            <h3 className="font-display font-bold text-content">Factures</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">N°</th>
                  <th className="table-cell font-semibold">Période</th>
                  <th className="table-cell text-right font-semibold">Montant</th>
                  <th className="table-cell font-semibold">Statut</th>
                  <th className="table-cell text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell font-medium text-content">{inv.number}</td>
                    <td className="table-cell text-content-muted">
                      {formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}
                    </td>
                    <td className="table-cell text-right font-semibold text-content">{formatCurrency(Number(inv.amount))}</td>
                    <td className="table-cell">
                      <Badge tone={inv.status === 'PAID' ? 'success' : inv.status === 'FAILED' ? 'danger' : 'warning'}>
                        {inv.status === 'PAID' ? 'Payée' : inv.status === 'FAILED' ? 'Échouée' : 'En attente'}
                      </Badge>
                    </td>
                    <td className="table-cell text-right">
                      {inv.status !== 'PAID' && canManage && (
                        <Button onClick={() => setPayFor({ kind: 'invoice', id: inv.id, label: inv.number, amount: Number(inv.amount), cycle: 'MONTHLY' })} className="h-8 px-3 text-xs">
                          Payer
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payFor && (
        <BillingPaymentModal
          target={payFor}
          onClose={() => setPayFor(null)}
          onPaid={() => {
            qc.invalidateQueries({ queryKey: ['subscription'] });
            qc.invalidateQueries({ queryKey: ['invoices'] });
            setSuspended(false);
            setPayFor(null);
          }}
        />
      )}
    </div>
  );
}

function PlanCard({
  plan,
  current,
  canManage,
  cycle,
  onSubscribe,
}: {
  plan: Plan;
  current: boolean;
  canManage: boolean;
  cycle: BillingCycle;
  onSubscribe: () => void;
}) {
  const currency = getActiveCurrency();
  const highlight = plan.code === 'STANDARD';
  return (
    <div
      className={`card relative p-5 ${
        highlight ? 'border-2 border-primary bg-gradient-to-b from-primary-soft to-surface shadow-glow' : ''
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-xs font-bold text-white shadow-card">
          ⭐ LE PLUS POPULAIRE
        </span>
      )}
      <h4 className="mt-1 font-display text-lg font-bold text-content">{plan.name}</h4>
      {highlight && (
        <p className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
          <Sparkles className="h-3 w-3" /> Recommandé pour les opticiens
        </p>
      )}
      <p className="mt-1 text-sm text-content-muted">{plan.description}</p>
      <PlanPrice code={plan.code} currency={currency} cycle={cycle} />
      <ul className="mt-4 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-content">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
          </li>
        ))}
      </ul>
      {highlight && (
        <p className="mt-4 rounded-xl bg-success/10 px-3 py-2 text-center text-xs font-semibold text-success">
          Plus de 90&nbsp;% des établissements actifs choisissent cette offre.
        </p>
      )}
      <div className="mt-5">
        {current ? (
          <Button variant="outline" className="w-full" disabled>
            Offre actuelle
          </Button>
        ) : (
          canManage && (
            <Button variant={highlight ? 'accent' : 'primary'} className="w-full" onClick={onSubscribe}>
              {highlight ? '🚀 Passer au plan Standard' : 'Choisir cette offre'}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'WAVE', label: 'Wave', icon: Smartphone },
  { value: 'ORANGE_MONEY', label: 'Orange Money', icon: Smartphone },
  { value: 'MTN_MOMO', label: 'MTN MoMo', icon: Smartphone },
  { value: 'MOOV_MONEY', label: 'Moov Money', icon: Smartphone },
  { value: 'FREE_MONEY', label: 'Free Money', icon: Smartphone },
  { value: 'CARD', label: 'Carte bancaire', icon: CreditCard },
];

function BillingPaymentModal({
  target,
  onClose,
  onPaid,
}: {
  target: { kind: 'plan' | 'invoice'; id: string; label: string; amount: number; cycle: BillingCycle };
  onClose: () => void;
  onPaid: () => void;
}) {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'choose' | 'pending' | 'done' | 'manual'>('choose');
  const [error, setError] = useState('');
  const [isSimulation, setIsSimulation] = useState(false);
  const purchaseTracked = useRef(false);

  // Moyens réellement disponibles (passerelle en ligne, règlement direct).
  const { data: payInfo } = useQuery({ queryKey: ['pay-info'], queryFn: getPayInfo });

  // Règlement Mobile Money direct : crée la facture et le paiement en attente ;
  // le fondateur confirme ensuite depuis la console (onglet « À confirmer »).
  const manualMut = useMutation({
    mutationFn: () => subscribeManual(target.id, target.cycle),
    onSuccess: () => setPhase('manual'),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const payMut = useMutation({
    mutationFn: (method: PaymentMethod) =>
      target.kind === 'plan' ? subscribe(target.id, method, undefined, target.cycle) : payInvoice(target.id, method),
    onSuccess: (res) => {
      setPaymentId(res.paymentId);
      // eventID identique au eventId envoyé côté serveur (Conversions API) → déduplication Meta.
      trackPixelEvent(
        'InitiateCheckout',
        { value: target.amount, currency: 'XOF', content_name: target.label },
        `checkout_${res.paymentId}`,
      );
      setIsSimulation(res.simulation);
      // PayTech : redirection vers le checkout hébergé, puis on attend la
      // confirmation par IPN (polling du statut en arrière-plan).
      if (res.redirectUrl) {
        window.open(res.redirectUrl, '_blank', 'noopener');
        setPhase('pending');
        return;
      }
      setPhase(res.status === 'SUCCESS' ? 'done' : 'pending');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  useEffect(() => {
    if (phase !== 'pending' || !paymentId) return;
    const iv = setInterval(async () => {
      const s = await billingPaymentStatus(paymentId);
      if (s.status === 'SUCCESS') {
        setPhase('done');
        clearInterval(iv);
      } else if (s.status === 'FAILED') {
        setError('Paiement échoué');
        setPhase('choose');
        clearInterval(iv);
      }
    }, 2500);
    return () => clearInterval(iv);
  }, [phase, paymentId]);

  useEffect(() => {
    if (phase !== 'done' || purchaseTracked.current || !paymentId) return;
    purchaseTracked.current = true;
    // eventID identique au eventId envoyé côté serveur (Conversions API) → déduplication Meta.
    trackPixelEvent(
      'Purchase',
      { value: target.amount, currency: 'XOF', content_name: target.label },
      `purchase_${paymentId}`,
    );
  }, [phase, target, paymentId]);

  return (
    <Modal open onClose={onClose} title={`Paiement — ${target.label}`} size="sm">
      <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5">
        <span className="text-sm text-content-muted">
          Montant à régler{target.kind === 'plan' ? ` (${BILLING_CYCLE_MONTHS[target.cycle]} mois)` : ''}
        </span>
        <span className="font-display text-lg font-bold text-content">{formatCurrency(target.amount)}</span>
      </div>
      {phase === 'choose' && (
        <>
          {/* Paiement en ligne : uniquement si une passerelle est configurée. */}
          {payInfo?.gateway !== false && (
            <>
              <p className="mb-2 text-sm text-content-muted">Choisissez votre moyen de paiement</p>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => payMut.mutate(m.value)}
                    disabled={payMut.isPending || manualMut.isPending}
                    className="card flex flex-col items-center gap-1.5 p-3 transition hover:border-primary"
                  >
                    <m.icon className="h-5 w-5 text-primary" />
                    <span className="text-xs font-medium text-content">{m.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-xs text-content-faint">Paiement sécurisé via Moneroo</p>
                <PaymentMethodLogos />
              </div>
            </>
          )}

          {/* Règlement direct sur le numéro de l'éditeur : toujours proposé si
              configuré, et seule option quand aucune passerelle n'est active. */}
          {target.kind === 'plan' && payInfo?.manual && (
            <div className={payInfo.gateway ? 'mt-4 border-t pt-3' : ''}>
              <p className="text-sm font-medium text-content">
                {payInfo.gateway ? 'Ou payer directement par Mobile Money' : 'Payer par Mobile Money'}
              </p>
              <div className="mt-2 rounded-xl bg-surface-2 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-content-muted">Numéro</span>
                  <span className="font-bold text-content">{payInfo.manual.number}</span>
                </div>
                {payInfo.manual.name && (
                  <div className="flex justify-between">
                    <span className="text-content-muted">Nom</span>
                    <span className="font-semibold text-content">{payInfo.manual.name}</span>
                  </div>
                )}
                {payInfo.manual.network && (
                  <div className="flex justify-between">
                    <span className="text-content-muted">Réseau</span>
                    <span className="text-content">{payInfo.manual.network}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t pt-1">
                  <span className="text-content-muted">Montant</span>
                  <span className="font-display font-bold text-content">
                    {formatCurrency(target.amount)}
                  </span>
                </div>
              </div>
              <Button
                className="mt-3 w-full"
                variant={payInfo.gateway ? 'outline' : undefined}
                loading={manualMut.isPending}
                onClick={() => manualMut.mutate()}
              >
                J'ai payé — enregistrer ma demande
              </Button>
              <p className="mt-1.5 text-xs text-content-faint">
                Envoyez le montant au numéro ci-dessus, puis cliquez : nous confirmons votre
                paiement et votre abonnement s'active.
              </p>
            </div>
          )}

          {/* Rien n'est disponible : on le dit clairement au lieu d'échouer. */}
          {payInfo && !payInfo.gateway && !payInfo.manual && (
            <p className="rounded-xl bg-[color:var(--warning)]/10 p-3 text-sm text-content">
              Le paiement en ligne n'est pas encore disponible. Contactez-nous depuis la page Aide
              pour activer votre abonnement.
            </p>
          )}

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </>
      )}

      {phase === 'manual' && (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 font-display text-lg font-bold text-content">Demande enregistrée</p>
          <p className="mt-1 text-sm text-content-muted">
            Dès que nous aurons vérifié votre versement, votre abonnement sera activé. Vous
            n'avez rien d'autre à faire.
          </p>
          <Button className="mt-5" onClick={onClose}>
            Fermer
          </Button>
        </div>
      )}

      {phase === 'pending' && (
        <div className="py-6 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-3 text-sm text-content-muted">
            Finalisez le paiement dans l’onglet Moneroo, puis revenez ici. Confirmation
            automatique en cours…
          </p>
          {paymentId && isSimulation && (
            <Button variant="outline" className="mt-4" onClick={() => void simulateBillingPayment(paymentId)}>
              Simuler la confirmation
            </Button>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 font-display text-lg font-bold text-content">Abonnement activé</p>
          <Button className="mt-5" onClick={onPaid}>Continuer</Button>
        </div>
      )}
    </Modal>
  );
}
