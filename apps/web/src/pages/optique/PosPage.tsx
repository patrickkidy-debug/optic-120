import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Banknote,
  Smartphone,
  CreditCard,
  CheckCircle2,
  Loader2,
  QrCode,
} from 'lucide-react';
import type { PaymentMethod } from '@oculo/shared-types';
import { getStock, listCustomers, createSale, addPayment, paymentStatus, simulatePayment, getSale } from '../../features/optique/api';
import { getCollectInfo } from '../../features/settings/api';
import { printSaleDocument } from '../../features/optique/saleDocument';
import { useUIStore } from '../../store/ui';
import { usePermission, useAuthStore } from '../../store/auth';
import { usePosStore, computeTotals } from '../../store/pos';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { Button, Modal, PageLoader, Badge } from '../../components/ui';

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote; mobile: boolean }[] = [
  { value: 'CASH', label: 'Espèces', icon: Banknote, mobile: false },
  { value: 'CARD', label: 'Carte', icon: CreditCard, mobile: false },
  { value: 'WAVE', label: 'Wave', icon: Smartphone, mobile: true },
  { value: 'ORANGE_MONEY', label: 'Orange Money', icon: Smartphone, mobile: true },
  { value: 'MTN_MOMO', label: 'MTN MoMo', icon: Smartphone, mobile: true },
  { value: 'MOOV_MONEY', label: 'Moov Money', icon: Smartphone, mobile: true },
  { value: 'FREE_MONEY', label: 'Free Money', icon: Smartphone, mobile: true },
];

export function PosPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const branchId = useUIStore((s) => s.activeBranchId);
  const canQuote = usePermission('optique.quotes.create');
  const pos = usePosStore();
  const [search, setSearch] = useState('');
  const [paySale, setPaySale] = useState<{ id: string; due: number; number: string } | null>(null);

  const { data: stock, isLoading } = useQuery({
    queryKey: ['pos-stock', branchId],
    queryFn: () => getStock(branchId!),
    enabled: Boolean(branchId),
  });
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() });

  const totals = computeTotals(pos, user?.tenantVatRate ?? undefined);

  const products = (stock ?? []).filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()),
  );

  const createMut = useMutation({
    mutationFn: (type: 'SALE' | 'QUOTE') =>
      createSale({
        branchId: branchId!,
        customerId: pos.customerId ?? undefined,
        type,
        items: pos.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
        discountAmount: pos.discountAmount,
        insuranceAmount: pos.insuranceAmount,
      }),
    onSuccess: (sale, type) => {
      if (type === 'QUOTE') {
        pos.clear();
        alert(`Devis ${sale.number} créé.`);
      } else {
        setPaySale({ id: sale.id, due: Number(sale.totalAmount) - Number(sale.paidAmount), number: sale.number });
      }
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (!branchId) return <PageLoader />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* Catalogue */}
      <div className="lg:col-span-3">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isLoading ? (
          <PageLoader />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => (
              <button
                key={p.productId}
                onClick={() =>
                  pos.addLine({ productId: p.productId, name: p.name, sku: p.sku, unitPrice: p.sellPrice })
                }
                className="card p-3 text-left transition hover:border-primary hover:shadow-card-lg"
              >
                <div className="flex items-start justify-between">
                  <span className="line-clamp-2 text-sm font-semibold text-content">{p.name}</span>
                  {p.quantity <= p.minAlert && <Badge tone="danger">{p.quantity}</Badge>}
                </div>
                <div className="mt-2 font-display font-bold text-primary">{formatCurrency(p.sellPrice)}</div>
                <div className="text-xs text-content-faint">Stock : {p.quantity}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Panier */}
      <div className="lg:col-span-2">
        <div className="card sticky top-20 flex max-h-[calc(100vh-7rem)] flex-col">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="font-display font-bold text-content">{t('pos.cart')}</h2>
            <span className="ml-auto text-sm text-content-muted">{pos.lines.length} article(s)</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2">
            {pos.lines.length === 0 ? (
              <p className="py-10 text-center text-sm text-content-muted">{t('pos.emptyCart')}</p>
            ) : (
              <div className="space-y-2">
                {pos.lines.map((l) => (
                  <div key={l.productId} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-content">{l.name}</p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          value={l.unitPrice || ''}
                          onChange={(e) => pos.setUnitPrice(l.productId, Number(e.target.value) || 0)}
                          className="h-7 w-24 rounded-lg border bg-surface px-2 text-xs text-content"
                          title="Prix unitaire (modifiable)"
                          placeholder="Prix"
                        />
                        <span className="text-[11px] text-content-faint">FCFA</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => pos.setQuantity(l.productId, l.quantity - 1)} className="btn-ghost h-7 w-7 rounded-lg p-0">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{l.quantity}</span>
                      <button onClick={() => pos.setQuantity(l.productId, l.quantity + 1)} className="btn-ghost h-7 w-7 rounded-lg p-0">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button onClick={() => pos.removeLine(l.productId)} className="btn-ghost h-7 w-7 rounded-lg p-0 text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 border-t px-4 py-3">
            <select
              className="input"
              value={pos.customerId ?? ''}
              onChange={(e) => pos.setCustomer(e.target.value || null)}
            >
              <option value="">{t('pos.walkIn')}</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-content-muted">
                {t('pos.discount')}
                <input
                  type="number"
                  className="input mt-1"
                  value={pos.discountAmount || ''}
                  onChange={(e) => pos.setDiscount(Number(e.target.value) || 0)}
                />
              </label>
              <label className="text-xs text-content-muted">
                {t('pos.insurance')}
                <input
                  type="number"
                  className="input mt-1"
                  value={pos.insuranceAmount || ''}
                  onChange={(e) => pos.setInsurance(Number(e.target.value) || 0)}
                />
              </label>
            </div>

            <div className="space-y-1 text-sm">
              <Row label={t('pos.subtotal')} value={formatCurrency(totals.subtotal)} />
              <Row label={`${t('pos.tax')} (${user?.tenantVatRate ?? 18} %)`} value={formatCurrency(totals.taxAmount)} />
              <div className="my-1 border-t" />
              <div className="flex justify-between font-display text-lg font-bold text-content">
                <span>{t('pos.due')}</span>
                <span>{formatCurrency(totals.dueFromCustomer)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {canQuote && (
                <Button
                  variant="outline"
                  disabled={pos.lines.length === 0 || createMut.isPending}
                  onClick={() => createMut.mutate('QUOTE')}
                >
                  {t('pos.quote')}
                </Button>
              )}
              <Button
                variant="accent"
                className={canQuote ? '' : 'col-span-2'}
                disabled={pos.lines.length === 0}
                loading={createMut.isPending && createMut.variables === 'SALE'}
                onClick={() => createMut.mutate('SALE')}
              >
                {t('pos.checkout')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {paySale && (
        <PaymentModal
          sale={paySale}
          onClose={() => setPaySale(null)}
          onPaid={() => {
            pos.clear();
            setPaySale(null);
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['receivables'] });
            qc.invalidateQueries({ queryKey: ['sales'] });
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-content-muted">
      <span>{label}</span>
      <span className="text-content">{value}</span>
    </div>
  );
}

export function PaymentModal({
  sale,
  onClose,
  onPaid,
  onPaidLabel,
}: {
  sale: { id: string; due: number; number: string };
  onClose: () => void;
  onPaid: () => void;
  onPaidLabel?: string;
}) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState<number>(sale.due);
  const [settled, setSettled] = useState(0);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'choose' | 'collect' | 'pending' | 'done'>('choose');
  const [error, setError] = useState('');
  const [instruction, setInstruction] = useState<string | null>(null);
  const { data: collect } = useQuery({ queryKey: ['collect-info'], queryFn: getCollectInfo });

  // Montant à encaisser maintenant : borné à [1, solde dû]. S'il est inférieur
  // au solde, c'est un encaissement échelonné (acompte / tranche).
  const payNow = Math.min(Math.max(1, Math.round(amount || 0)), sale.due);
  const remainingAfter = sale.due - payNow;

  async function downloadInvoice() {
    try {
      const full = await getSale(sale.id);
      printSaleDocument(full, {
        name: user?.tenantName ?? 'OculoSaaS',
        logoUrl: user?.tenantLogoUrl,
        location: user?.tenantLocation,
        contactPhone: user?.tenantContactPhone,
        contactEmail: user?.tenantContactEmail,
        ...user?.tenantInvoiceSettings,
      });
    } catch {
      window.print();
    }
  }

  const payMut = useMutation({
    mutationFn: (m: PaymentMethod) => addPayment(sale.id, { method: m, amount: payNow }),
    onMutate: () => setSettled(payNow),
    onSuccess: (res) => {
      setPaymentId(res.paymentId);
      setInstruction(res.instruction ?? null);
      // CinetPay réel : ouvre la page de paiement hébergée dans un nouvel onglet.
      if (res.redirectUrl) window.open(res.redirectUrl, '_blank', 'noopener');
      if (res.status === 'SUCCESS') setPhase('done');
      else setPhase('pending');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  // Polling tant que le paiement mobile est en attente.
  useEffect(() => {
    if (phase !== 'pending' || !paymentId) return;
    const iv = setInterval(async () => {
      const s = await paymentStatus(paymentId);
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

  return (
    <Modal open onClose={onClose} title={`${t('pos.payment')} — ${sale.number}`} size="sm">
      <div className="mb-4 rounded-xl bg-surface-2 p-3 text-center">
        <p className="text-xs text-content-muted">{t('pos.due')}</p>
        <p className="font-display text-2xl font-bold text-content">{formatCurrency(sale.due)}</p>
      </div>

      {phase === 'choose' && (
        <>
          <label className="mb-3 block text-sm">
            <span className="text-content-muted">Montant encaissé maintenant</span>
            <input
              type="number"
              min={1}
              max={sale.due}
              className="input mt-1 text-right font-semibold"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
            />
            {remainingAfter > 0 ? (
              <span className="mt-1 block text-xs text-warning">
                Encaissement échelonné — reste {formatCurrency(remainingAfter)} après ce paiement.
              </span>
            ) : (
              <span className="mt-1 block text-xs text-content-faint">Paiement intégral du solde.</span>
            )}
          </label>
          <p className="mb-2 text-sm text-content-muted">{t('pos.chooseMethod')}</p>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  setMethod(m.value);
                  // Mobile Money : on affiche le QR / numéro de la boutique, puis
                  // le caissier confirme la réception. Espèces / carte : direct.
                  if (m.mobile) setPhase('collect');
                  else payMut.mutate(m.value);
                }}
                disabled={payMut.isPending}
                className="card flex flex-col items-center gap-1.5 p-3 transition hover:border-primary"
              >
                <m.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-content">{m.label}</span>
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </>
      )}

      {phase === 'collect' && (
        <div className="text-center">
          <p className="mb-3 text-sm text-content-muted">
            Le client paie via <b>{METHODS.find((m) => m.value === method)?.label}</b>
          </p>
          {collect?.qr ? (
            <img src={collect.qr} alt="QR de paiement" className="mx-auto h-44 w-44 rounded-xl border bg-white object-contain p-2" />
          ) : (
            <div className="mx-auto grid h-44 w-44 place-items-center rounded-xl border bg-surface-2 text-content-faint">
              <QrCode className="h-10 w-10" />
            </div>
          )}
          <div className="mx-auto mt-3 max-w-xs rounded-xl bg-surface-2 p-3 text-sm">
            {collect?.number ? (
              <>
                <div className="flex justify-between"><span className="text-content-muted">Numéro</span><span className="font-bold text-content">{collect.number}</span></div>
                {collect.name && <div className="flex justify-between"><span className="text-content-muted">Nom</span><span className="font-semibold text-content">{collect.name}</span></div>}
                {collect.network && <div className="flex justify-between"><span className="text-content-muted">Réseau</span><span className="text-content">{collect.network}</span></div>}
              </>
            ) : (
              <p className="text-xs text-content-muted">
                Aucune coordonnée d'encaissement configurée. Renseignez-la dans Paramètres → Paiements.
              </p>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => { setPhase('choose'); setMethod(null); }}>
              Retour
            </Button>
            <Button className="flex-1" loading={payMut.isPending} onClick={() => method && payMut.mutate(method)}>
              Paiement reçu
            </Button>
          </div>
        </div>
      )}

      {phase === 'pending' && (
        <div className="py-6 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-3 text-sm text-content-muted">{t('pos.pendingMobile')}</p>
          <p className="mt-1 text-xs text-content-faint">{METHODS.find((m) => m.value === method)?.label}</p>
          {instruction && (
            <p className="mx-auto mt-3 max-w-xs rounded-lg bg-surface-2 p-2 text-xs text-content-muted">
              {instruction}
            </p>
          )}
          {/* Le bouton de simulation n'apparaît qu'en mode simulation (pas en CinetPay réel). */}
          {paymentId && instruction?.toLowerCase().includes('simulation') && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void simulatePayment(paymentId)}
            >
              {t('pos.simulate')}
            </Button>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          {sale.due - settled > 0 ? (
            <>
              <p className="mt-3 font-display text-lg font-bold text-content">Encaissement enregistré</p>
              <p className="mt-1 text-sm text-content-muted">
                Reçu {formatCurrency(settled)} · reste{' '}
                <span className="font-semibold text-warning">{formatCurrency(sale.due - settled)}</span>
              </p>
            </>
          ) : (
            <p className="mt-3 font-display text-lg font-bold text-content">{t('pos.paid')}</p>
          )}
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={downloadInvoice}>
              {t('sales.print')}
            </Button>
            <Button onClick={onPaid}>{onPaidLabel ?? t('pos.newSale')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
