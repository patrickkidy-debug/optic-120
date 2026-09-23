import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import {
  PAYMENT_METHOD_LABELS,
  PLATFORM_PAYMENT_METHODS,
  invoiceTotals,
  type PaymentMethod,
} from '@oculo/shared-types';
import { Button, Field, Modal, Spinner } from '../../../components/ui';
import { formatCurrency } from '../../../lib/format';
import { apiErrorMessage } from '../../../lib/api';
import {
  createBillingInvoice,
  listBillingClients,
  type Invoice,
} from '../../../features/billing/invoicing';

interface LineDraft {
  description: string;
  periodLabel: string;
  quantity: string;
  unitPrice: string;
}

const emptyLine: LineDraft = { description: '', periodLabel: '', quantity: '1', unitPrice: '' };

function toNumber(value: string): number {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function addMonthsIso(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Création manuelle d'une facture (§6).
 *
 * Le total affiché est calculé par `invoiceTotals`, la MÊME fonction que le
 * serveur utilise pour recalculer et enregistrer le montant. Un total envoyé
 * par le navigateur n'est jamais cru : c'est la règle qui empêche un écran
 * d'annoncer un montant que la base ne porte pas.
 */
export function NewInvoiceModal({
  presetTenantId,
  onClose,
  onCreated,
}: {
  presetTenantId?: string;
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
}) {
  const { data: clients, isLoading } = useQuery({
    queryKey: ['platform-billing-clients'],
    queryFn: listBillingClients,
  });

  const [tenantId, setTenantId] = useState(presetTenantId ?? '');
  const [contact, setContact] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [lines, setLines] = useState<LineDraft[]>([{ ...emptyLine }]);
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');

  const today = new Date().toISOString().slice(0, 10);
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [periodMonths, setPeriodMonths] = useState('1');
  const [periodStart, setPeriodStart] = useState(today);
  const [notes, setNotes] = useState('');

  const [withPayment, setWithPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('WAVE');
  const [payReference, setPayReference] = useState('');
  const [payDate, setPayDate] = useState(today);

  const [error, setError] = useState('');

  const client = useMemo(() => clients?.find((c) => c.id === tenantId), [clients, tenantId]);

  // Préremplissage depuis l'établissement choisi. Les coordonnées restent
  // modifiables : elles seront FIGÉES sur la facture émise, donc ce qui est
  // saisi ici est ce qui sera imprimé, pas ce que la fiche client dira demain.
  useEffect(() => {
    if (!client) return;
    setWhatsapp(client.whatsapp ?? '');
    setEmail(client.email ?? '');
    setAddress(client.address ?? '');
    setCountry(client.country ?? '');
    setLines((prev) => {
      const untouched = prev.length === 1 && !prev[0].description && !prev[0].unitPrice;
      if (!untouched || !client.planName) return prev;
      return [
        {
          description: `Abonnement OculoSaaS — ${client.planName}`,
          periodLabel: '',
          quantity: '1',
          unitPrice: String(client.priceMonthly ?? ''),
        },
      ];
    });
  }, [client]);

  const months = Math.max(0, Math.round(toNumber(periodMonths)));
  const periodEnd = months > 0 ? addMonthsIso(periodStart, months) : periodStart;

  const totals = invoiceTotals({
    items: lines.map((l) => ({ quantity: toNumber(l.quantity), unitPrice: toNumber(l.unitPrice) })),
    discount: toNumber(discount),
    tax: toNumber(tax),
  });

  const linesValid = lines.every((l) => l.description.trim().length >= 2 && toNumber(l.unitPrice) >= 0);
  const payValue = toNumber(payAmount);
  const paymentValid = !withPayment || (payValue > 0 && payValue <= totals.total + 0.5);
  const canSubmit =
    tenantId !== '' &&
    lines.length > 0 &&
    linesValid &&
    totals.total > 0 &&
    totals.discount <= totals.subtotal &&
    paymentValid;

  const mutation = useMutation({
    mutationFn: () =>
      createBillingInvoice({
        tenantId,
        billingName: client?.name ?? null,
        billingContact: contact.trim() || null,
        billingWhatsapp: whatsapp.trim() || null,
        billingEmail: email.trim() || null,
        billingAddress: address.trim() || null,
        billingCity: city.trim() || null,
        billingCountry: country.trim() || null,
        items: lines.map((l) => ({
          description: l.description.trim(),
          periodLabel: l.periodLabel.trim() || null,
          quantity: toNumber(l.quantity),
          unitPrice: toNumber(l.unitPrice),
        })),
        discount: toNumber(discount),
        tax: toNumber(tax),
        currency: client?.currency ?? 'XOF',
        planId: client?.planId ?? null,
        periodStart,
        periodEnd,
        periodMonths: months,
        issueDate,
        dueDate,
        notes: notes.trim() || null,
        payment: withPayment
          ? {
              amount: payValue,
              method: payMethod,
              reference: payReference.trim() || null,
              paidAt: payDate,
              notes: null,
            }
          : null,
      }),
    onSuccess: onCreated,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const setLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  return (
    <Modal open onClose={onClose} title="Nouvelle facture" size="xl">
      {isLoading ? (
        <div className="py-12 text-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Client */}
          <section>
            <h3 className="mb-2 text-sm font-bold text-content">Client</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Établissement">
                <select className="input" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                  <option value="">Choisissez un établissement</option>
                  {(clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.planName ? ` — ${c.planName}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nom du responsable">
                <input
                  className="input"
                  placeholder="Facultatif"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </Field>
              <Field label="Numéro WhatsApp">
                <input className="input" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              </Field>
              <Field label="E-mail">
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Adresse">
                <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ville">
                  <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
                </Field>
                <Field label="Pays">
                  <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} />
                </Field>
              </div>
            </div>
          </section>

          {/* Lignes */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-content">Détail de la facture</h3>
              <Button
                variant="outline"
                className="h-8 px-2.5 text-xs"
                onClick={() => setLines((prev) => [...prev, { ...emptyLine }])}
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
              </Button>
            </div>

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="rounded-xl bg-surface-2 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <input
                        className="input"
                        placeholder="Désignation"
                        value={line.description}
                        onChange={(e) => setLine(i, { description: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        className="input"
                        placeholder="Période (facultatif)"
                        value={line.periodLabel}
                        onChange={(e) => setLine(i, { periodLabel: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <input
                        className="input text-right"
                        inputMode="decimal"
                        placeholder="Qté"
                        value={line.quantity}
                        onChange={(e) => setLine(i, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        className="input text-right"
                        inputMode="decimal"
                        placeholder="Prix"
                        value={line.unitPrice}
                        onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:col-span-1">
                      <span className="text-xs font-semibold text-content sm:hidden">
                        {formatCurrency(toNumber(line.quantity) * toNumber(line.unitPrice))}
                      </span>
                      <button
                        type="button"
                        aria-label="Supprimer la ligne"
                        disabled={lines.length === 1}
                        onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                        className="grid h-9 w-9 place-items-center rounded-lg text-content-faint hover:text-danger disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 hidden text-right text-xs text-content-muted sm:block">
                    Total ligne : {formatCurrency(toNumber(line.quantity) * toNumber(line.unitPrice))}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Remise">
                <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
              <Field label="Taxes">
                <input className="input" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
              </Field>
              <div className="rounded-xl bg-surface-2 p-3 text-sm">
                <div className="flex justify-between text-content-muted">
                  <span>Sous-total</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-content-muted">
                    <span>Remise</span>
                    <span>- {formatCurrency(totals.discount)}</span>
                  </div>
                )}
                {totals.tax > 0 && (
                  <div className="flex justify-between text-content-muted">
                    <span>Taxes</span>
                    <span>{formatCurrency(totals.tax)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t pt-1">
                  <span className="font-medium text-content">Total</span>
                  <span className="font-display font-bold text-content">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
            {totals.discount > totals.subtotal && (
              <p className="mt-2 text-xs text-danger">La remise dépasse le sous-total.</p>
            )}
          </section>

          {/* Abonnement et dates */}
          <section>
            <h3 className="mb-2 text-sm font-bold text-content">Période et échéance</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Field label="Date d'émission">
                <input className="input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </Field>
              <Field label="Date d'échéance">
                <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              <Field label="Début de période">
                <input className="input" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </Field>
              <Field label="Mois couverts">
                <input className="input" inputMode="numeric" value={periodMonths} onChange={(e) => setPeriodMonths(e.target.value)} />
              </Field>
            </div>
            <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-content-muted">
              {months > 0
                ? `Au règlement complet, l’abonnement sera prolongé de ${months} mois (période jusqu’au ${periodEnd}).`
                : "Aucun mois indiqué : cette facture n’ouvrira aucun accès et ne prolongera pas l’abonnement."}
            </p>

            <Field label="Notes">
              <textarea
                className="input mt-3 min-h-[70px]"
                placeholder="Facultatif — apparaît sur la facture imprimée"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </section>

          {/* Règlement immédiat */}
          <section>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-content">
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={withPayment}
                onChange={(e) => {
                  setWithPayment(e.target.checked);
                  if (e.target.checked && !payAmount) setPayAmount(String(totals.total));
                }}
              />
              Enregistrer un paiement immédiatement
            </label>

            {withPayment && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Field label="Montant">
                  <input className="input" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                </Field>
                <Field label="Méthode">
                  <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                    {PLATFORM_PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Référence">
                  <input className="input" value={payReference} onChange={(e) => setPayReference(e.target.value)} />
                </Field>
                <Field label="Date">
                  <input className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </Field>
                {!paymentValid && (
                  <p className="text-xs text-danger sm:col-span-4">
                    Le montant doit être supérieur à zéro et ne pas dépasser le total de la facture.
                  </p>
                )}
              </div>
            )}
          </section>

          {error && (
            <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Annuler
            </Button>
            <Button
              disabled={!canSubmit}
              loading={mutation.isPending}
              onClick={() => {
                setError('');
                mutation.mutate();
              }}
            >
              Créer la facture
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
