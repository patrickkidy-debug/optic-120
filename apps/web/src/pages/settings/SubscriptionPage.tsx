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
} from 'lucide-react';
import type { PaymentMethod } from '@oculo/shared-types';
import {
  getPlans,
  getSubscription,
  getInvoices,
  subscribe,
  payInvoice,
  billingPaymentStatus,
  simulateBillingPayment,
  type Plan,
} from '../../features/billing/api';
import { useAuthStore, usePermission } from '../../store/auth';
import { planPrice } from '@oculo/shared-types';
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

export function SubscriptionPage() {
  const currency = getActiveCurrency();
  const qc = useQueryClient();
  const canManage = usePermission('billing.manage');
  const setSuspended = useAuthStore((s) => s.setSuspended);
  const [payFor, setPayFor] = useState<{ kind: 'plan' | 'invoice'; id: string; label: string; amount: number } | null>(null);

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

  // Offre présélectionnée depuis la landing (?plan=CODE).
  const [params] = useSearchParams();
  const autoOpened = useRef(false);
  const [autoLaunch, setAutoLaunch] = useState(false);
  useEffect(() => {
    const code = params.get('plan');
    if (!code || autoOpened.current || !plans) return;
    const plan = plans.find((p) => p.code === code);
    if (!plan) return;
    autoOpened.current = true;
    // Plus d'essai gratuit : toute offre présélectionnée (Starter par défaut
    // après l'inscription) lance directement le paiement Moneroo.
    setAutoLaunch(true);
    subscribe(plan.id, 'WAVE')
      .then((res) => {
        // eventID identique au eventId envoyé côté serveur (Conversions API) → déduplication Meta.
        trackPixelEvent(
          'InitiateCheckout',
          { value: planPrice(plan.code, currency), currency, content_name: plan.name },
          `checkout_${res.paymentId}`,
        );
        if (res.redirectUrl) {
          // Mémorise le paiement pour confirmer le Purchase au retour de Moneroo.
          sessionStorage.setItem(
            PENDING_PURCHASE_KEY,
            JSON.stringify({ paymentId: res.paymentId, planName: plan.name, amount: planPrice(plan.code, currency) }),
          );
          window.location.href = res.redirectUrl;
        } else {
          setAutoLaunch(false);
          setPayFor({ kind: 'plan', id: plan.id, label: plan.name, amount: planPrice(plan.code, currency) });
        }
      })
      .catch(() => {
        setAutoLaunch(false);
        setPayFor({ kind: 'plan', id: plan.id, label: plan.name, amount: planPrice(plan.code, currency) });
      });
  }, [params, plans]);

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

      {(() => {
        const standard = plans?.find((p) => p.code === 'STANDARD');
        const needsActivation =
          !!sub && (sub.status !== 'ACTIVE' || new Date(sub.currentPeriodEnd).getTime() <= Date.now());
        if (!standard || !needsActivation || !canManage) return null;
        const expired = new Date(sub!.currentPeriodEnd).getTime() <= Date.now();
        return (
          <div className="mb-8 overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-br from-primary-soft to-surface p-6 shadow-glow">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
                  <Sparkles className="h-3.5 w-3.5" /> Offre recommandée
                </span>
                <h3 className="mt-3 font-display text-2xl font-extrabold text-content">
                  Continuez avec l'offre {standard.name}
                </h3>
                <p className="mt-1 max-w-xl text-sm text-content-muted">
                  {expired
                    ? "Votre essai gratuit est terminé. Gardez l'accès complet à toutes les fonctionnalités de votre espace."
                    : "Activez dès maintenant pour continuer sans interruption après votre essai gratuit."}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-content">
                  {standard.features.slice(0, 4).map((f) => (
                    <span key={f} className="inline-flex items-center gap-1.5">
                      <Check className="h-4 w-4 shrink-0 text-primary" /> {f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-center">
                <div className="font-display text-3xl font-extrabold text-gradient">
                  {formatCurrency(planPrice(standard.code, currency))}
                </div>
                <div className="text-xs text-content-muted">par mois</div>
                <Button
                  className="mt-3 w-full px-6 shadow-glow sm:w-auto"
                  onClick={() =>
                    setPayFor({ kind: 'plan', id: standard.id, label: standard.name, amount: planPrice(standard.code, currency) })
                  }
                >
                  Activer l'offre {standard.name}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      <h3 className="mb-3 font-display text-lg font-bold text-content">Nos offres</h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans?.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            current={sub?.plan.code === p.code}
            canManage={canManage}
            onSubscribe={() => setPayFor({ kind: 'plan', id: p.id, label: p.name, amount: planPrice(p.code, currency) })}
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
                        <Button onClick={() => setPayFor({ kind: 'invoice', id: inv.id, label: inv.number, amount: Number(inv.amount) })} className="h-8 px-3 text-xs">
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
  onSubscribe,
}: {
  plan: Plan;
  current: boolean;
  canManage: boolean;
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
      <p className="mt-3 font-display text-2xl font-bold text-content">
        {formatCurrency(planPrice(plan.code, currency))}
        <span className="text-sm font-normal text-content-muted"> / mois</span>
      </p>
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
  target: { kind: 'plan' | 'invoice'; id: string; label: string; amount: number };
  onClose: () => void;
  onPaid: () => void;
}) {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'choose' | 'pending' | 'done'>('choose');
  const [error, setError] = useState('');
  const [isSimulation, setIsSimulation] = useState(false);
  const purchaseTracked = useRef(false);

  const payMut = useMutation({
    mutationFn: (method: PaymentMethod) =>
      target.kind === 'plan' ? subscribe(target.id, method) : payInvoice(target.id, method),
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
      {phase === 'choose' && (
        <>
          <p className="mb-2 text-sm text-content-muted">Choisissez votre moyen de paiement</p>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => payMut.mutate(m.value)}
                disabled={payMut.isPending}
                className="card flex flex-col items-center gap-1.5 p-3 transition hover:border-primary"
              >
                <m.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-content">{m.label}</span>
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-xs text-content-faint">Paiement sécurisé via Moneroo</p>
            <PaymentMethodLogos />
          </div>
        </>
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
