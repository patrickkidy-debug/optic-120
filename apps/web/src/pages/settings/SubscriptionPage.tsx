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
import { apiErrorMessage } from '../../lib/api';
import { trackPixelEvent } from '../../lib/pixel';
import { formatCurrency, formatDate } from '../../lib/format';
import { PageHeader, Button, Modal, Badge, PageLoader } from '../../components/ui';
import { PaymentMethodLogos } from '../../components/PaymentMethodLogos';

// Trace un paiement lancé en plein écran (redirection Moneroo) le temps que
// l'utilisateur revienne sur la page, afin de pouvoir confirmer le Purchase
// Meta Pixel sans dépendre d'un paramètre d'URL renvoyé par Moneroo.
const PENDING_PURCHASE_KEY = 'oculo-pending-purchase';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  TRIALING: { label: "Période d'essai", tone: 'info' },
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
  const qc = useQueryClient();
  const canManage = usePermission('billing.manage');
  const setSuspended = useAuthStore((s) => s.setSuspended);
  const [payFor, setPayFor] = useState<{ kind: 'plan' | 'invoice'; id: string; label: string; amount: number } | null>(null);

  const { data: sub, isLoading } = useQuery({ queryKey: ['subscription'], queryFn: getSubscription });
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: getPlans });
  const { data: invoices } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });

  // Dès qu'on constate un abonnement non suspendu, on lève la garde.
  useEffect(() => {
    if (sub && sub.status !== 'SUSPENDED' && sub.status !== 'CANCELLED') setSuspended(false);
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
          trackPixelEvent('Purchase', {
            value: pending.amount,
            currency: 'XOF',
            content_name: pending.planName,
          });
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
    // Forfaits payants (Standard/Premium) → on lance directement le paiement
    // Moneroo : redirection automatique vers le checkout sécurisé.
    if (plan.code === 'STANDARD' || plan.code === 'PREMIUM') {
      setAutoLaunch(true);
      trackPixelEvent('InitiateCheckout', {
        value: plan.priceMonthly,
        currency: 'XOF',
        content_name: plan.name,
      });
      subscribe(plan.id, 'WAVE')
        .then((res) => {
          if (res.redirectUrl) {
            // Mémorise le paiement pour confirmer le Purchase au retour de Moneroo.
            sessionStorage.setItem(
              PENDING_PURCHASE_KEY,
              JSON.stringify({ paymentId: res.paymentId, planName: plan.name, amount: plan.priceMonthly }),
            );
            window.location.href = res.redirectUrl;
          } else {
            setAutoLaunch(false);
            setPayFor({ kind: 'plan', id: plan.id, label: plan.name, amount: plan.priceMonthly });
          }
        })
        .catch(() => {
          setAutoLaunch(false);
          setPayFor({ kind: 'plan', id: plan.id, label: plan.name, amount: plan.priceMonthly });
        });
    } else {
      setPayFor({ kind: 'plan', id: plan.id, label: plan.name, amount: plan.priceMonthly });
    }
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
            <p className="font-display text-2xl font-bold text-gradient">{formatCurrency(sub.plan.priceMonthly)}<span className="text-sm font-normal text-content-muted"> / mois</span></p>
            <p className="mt-2 text-xs text-content-muted">
              {sub.status === 'TRIALING' && sub.trialEndsAt
                ? `Essai jusqu'au ${formatDate(sub.trialEndsAt)}`
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

      <h3 className="mb-3 font-display text-lg font-bold text-content">Nos offres</h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans?.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            current={sub?.plan.code === p.code}
            canManage={canManage}
            onSubscribe={() => setPayFor({ kind: 'plan', id: p.id, label: p.name, amount: p.priceMonthly })}
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
  const highlight = plan.code === 'PREMIUM';
  return (
    <div className={`card relative p-5 ${highlight ? 'border-primary shadow-glow' : ''}`}>
      {highlight && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
          <Sparkles className="h-3 w-3" /> Populaire
        </span>
      )}
      <h4 className="font-display text-lg font-bold text-content">{plan.name}</h4>
      <p className="mt-1 text-sm text-content-muted">{plan.description}</p>
      <p className="mt-3 font-display text-2xl font-bold text-content">
        {formatCurrency(plan.priceMonthly)}
        <span className="text-sm font-normal text-content-muted"> / mois</span>
      </p>
      <ul className="mt-4 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-content">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
          </li>
        ))}
      </ul>
      <div className="mt-5">
        {current ? (
          <Button variant="outline" className="w-full" disabled>
            Offre actuelle
          </Button>
        ) : (
          canManage && (
            <Button variant={highlight ? 'accent' : 'primary'} className="w-full" onClick={onSubscribe}>
              Choisir cette offre
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
    mutationFn: (method: PaymentMethod) => {
      trackPixelEvent('InitiateCheckout', { value: target.amount, currency: 'XOF', content_name: target.label });
      return target.kind === 'plan' ? subscribe(target.id, method) : payInvoice(target.id, method);
    },
    onSuccess: (res) => {
      setPaymentId(res.paymentId);
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
    if (phase !== 'done' || purchaseTracked.current) return;
    purchaseTracked.current = true;
    trackPixelEvent('Purchase', { value: target.amount, currency: 'XOF', content_name: target.label });
  }, [phase, target]);

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
