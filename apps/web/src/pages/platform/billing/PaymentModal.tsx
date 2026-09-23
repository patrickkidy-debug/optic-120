import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PLATFORM_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@oculo/shared-types';
import { Button, Field, Modal } from '../../../components/ui';
import { formatCurrency } from '../../../lib/format';
import { apiErrorMessage } from '../../../lib/api';
import { recordBillingPayment, type Invoice } from '../../../features/billing/invoicing';

/**
 * Enregistrement d'un règlement, total ou partiel (§21-22).
 *
 * Le montant est prérempli avec le SOLDE restant, pas avec le total : sur une
 * facture déjà partiellement réglée, proposer le total ferait saisir un
 * doublon. Le serveur refuse de toute façon tout dépassement du solde.
 */
export function PaymentModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: (invoice: Invoice) => void;
}) {
  const [amount, setAmount] = useState(String(invoice.balance));
  const [method, setMethod] = useState<PaymentMethod>('WAVE');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const parsed = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= invoice.balance + 0.5;
  const remainder = invoice.balance - (Number.isFinite(parsed) ? parsed : 0);

  const mutation = useMutation({
    mutationFn: () =>
      recordBillingPayment(invoice.id, {
        amount: parsed,
        method,
        reference: reference.trim() || null,
        paidAt,
        notes: notes.trim() || null,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={`Enregistrer un paiement — ${invoice.number}`}>
      <div className="space-y-3">
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-content-muted">Total de la facture</span>
            <span className="font-semibold text-content">{formatCurrency(invoice.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-content-muted">Déjà encaissé</span>
            <span className="text-content">{formatCurrency(invoice.amountPaid)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t pt-1">
            <span className="font-medium text-content">Solde restant</span>
            <span className="font-display font-bold text-warning">
              {formatCurrency(invoice.balance)}
            </span>
          </div>
        </div>

        <Field label="Montant encaissé">
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        {valid && remainder > 0.5 && (
          <p className="rounded-lg bg-[color:var(--warning)]/10 px-3 py-2 text-xs text-warning">
            Paiement partiel : il restera {formatCurrency(remainder)} à percevoir, et la facture
            passera en « Partiellement payée ».
          </p>
        )}
        {!valid && amount.trim() !== '' && (
          <p className="text-xs text-danger">
            Saisissez un montant supérieur à zéro et inférieur ou égal au solde restant.
          </p>
        )}

        <Field label="Méthode de paiement">
          <select
            className="input"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {PLATFORM_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Référence de transaction">
            <input
              className="input"
              placeholder="Facultatif"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label="Date du paiement">
            <input
              className="input"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            className="input min-h-[70px]"
            placeholder="Facultatif"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button
            disabled={!valid}
            loading={mutation.isPending}
            onClick={() => {
              setError('');
              mutation.mutate();
            }}
          >
            Enregistrer le paiement
          </Button>
        </div>
      </div>
    </Modal>
  );
}
