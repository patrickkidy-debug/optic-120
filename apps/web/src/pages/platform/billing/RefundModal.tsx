import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PLATFORM_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@oculo/shared-types';
import { Button, Field, Modal } from '../../../components/ui';
import { formatCurrency } from '../../../lib/format';
import { apiErrorMessage } from '../../../lib/api';
import { refundBillingInvoice, type Invoice } from '../../../features/billing/invoicing';

/**
 * Remboursement, total ou partiel (§23).
 *
 * Le remboursement s'AJOUTE à l'historique : il n'efface ni le paiement
 * d'origine, ni le montant encaissé. Un comptable doit pouvoir relire les deux
 * mouvements, et un encaissement effacé serait indétectable après coup.
 */
export function RefundModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: (invoice: Invoice) => void;
}) {
  const refundable = Math.max(0, invoice.amountPaid - invoice.amountRefunded);
  const [amount, setAmount] = useState(String(refundable));
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [reference, setReference] = useState('');
  const [refundedAt, setRefundedAt] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');

  const parsed = Number(amount.replace(',', '.'));
  const valid =
    Number.isFinite(parsed) && parsed > 0 && parsed <= refundable + 0.5 && reason.trim().length >= 3;

  const mutation = useMutation({
    mutationFn: () =>
      refundBillingInvoice(invoice.id, {
        amount: parsed,
        reason: reason.trim(),
        method: method || null,
        reference: reference.trim() || null,
        refundedAt,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={`Rembourser — ${invoice.number}`}>
      <div className="space-y-3">
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-content-muted">Encaissé sur cette facture</span>
            <span className="text-content">{formatCurrency(invoice.amountPaid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-content-muted">Déjà remboursé</span>
            <span className="text-content">{formatCurrency(invoice.amountRefunded)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t pt-1">
            <span className="font-medium text-content">Remboursable</span>
            <span className="font-display font-bold text-content">{formatCurrency(refundable)}</span>
          </div>
        </div>

        {refundable <= 0 ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-content-muted">
            Rien à rembourser : aucun montant encaissé n’est encore disponible sur cette facture.
          </p>
        ) : (
          <>
            <Field label="Montant remboursé">
              <input
                className="input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>

            <Field label="Motif">
              <textarea
                className="input min-h-[80px]"
                placeholder="Ex. paiement effectué deux fois, service non rendu…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Méthode de remboursement">
                <select
                  className="input"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}
                >
                  <option value="">Non précisée</option>
                  {PLATFORM_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date du remboursement">
                <input
                  className="input"
                  type="date"
                  value={refundedAt}
                  onChange={(e) => setRefundedAt(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Référence du remboursement">
              <input
                className="input"
                placeholder="Facultatif"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          </>
        )}

        {error && (
          <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={!valid}
            loading={mutation.isPending}
            onClick={() => {
              setError('');
              mutation.mutate();
            }}
          >
            Enregistrer le remboursement
          </Button>
        </div>
      </div>
    </Modal>
  );
}
