import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, MessageCircle } from 'lucide-react';
import type { InvoiceMessageKind } from '@oculo/shared-types';
import { Button, Field, Modal, Spinner } from '../../../components/ui';
import {
  getBillingSettings,
  getInvoiceMessage,
  markInvoiceSent,
  type Invoice,
} from '../../../features/billing/invoicing';
import { printInvoice } from '../../../features/billing/invoiceDocument';
import { waLinkWithText } from './shared';

/**
 * Envoi de la facture par WhatsApp (§16).
 *
 * L'envoi passe par wa.me : le message part du compte WhatsApp du fondateur,
 * qui le relit avant d'appuyer sur Envoyer. Aucune API tierce, aucun quota,
 * aucun numéro d'expéditeur à faire valider.
 *
 * Ce que wa.me ne sait PAS faire : joindre un fichier. L'écran le dit
 * explicitement et propose de télécharger le PDF d'abord, plutôt que de laisser
 * croire que la pièce jointe partira toute seule — le client recevrait un
 * message annonçant une facture absente.
 */
export function WhatsappModal({
  invoice,
  kind = 'invoice',
  onClose,
}: {
  invoice: Invoice;
  kind?: InvoiceMessageKind;
  onClose: () => void;
}) {
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-billing-message', invoice.id, kind],
    queryFn: () => getInvoiceMessage(invoice.id, kind),
  });
  const { data: settings } = useQuery({
    queryKey: ['platform-billing-settings'],
    queryFn: getBillingSettings,
  });

  // Le message préparé par le serveur n'écrase jamais une modification en
  // cours : le fondateur peut l'ajuster avant l'envoi (§16).
  useEffect(() => {
    if (!data || touched) return;
    setMessage(data.message);
    setPhone(data.whatsapp ?? '');
  }, [data, touched]);

  const link = waLinkWithText(phone, message);

  return (
    <Modal open onClose={onClose} title={`Envoyer la facture ${invoice.number}`} size="lg">
      {isLoading ? (
        <div className="py-10 text-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-surface-2 p-3 text-sm">
            <div className="font-semibold text-content">{invoice.billing.name}</div>
            <div className="text-content-muted">
              {invoice.planName} · {invoice.number}
            </div>
          </div>

          <Field label="Numéro WhatsApp du destinataire">
            <input
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="+225 07 12 34 56"
              value={phone}
              onChange={(e) => {
                setTouched(true);
                setPhone(e.target.value);
              }}
            />
          </Field>

          {!link && (
            <p className="flex items-start gap-2 rounded-lg bg-[color:var(--warning)]/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Aucun numéro WhatsApp utilisable pour ce client. Renseignez-le ci-dessus pour activer
              l’envoi.
            </p>
          )}

          <Field label="Message">
            <textarea
              className="input min-h-[220px] font-mono text-xs leading-relaxed"
              value={message}
              onChange={(e) => {
                setTouched(true);
                setMessage(e.target.value);
              }}
            />
          </Field>

          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-content-muted">
            WhatsApp ne permet pas de joindre un fichier depuis un lien. Téléchargez d’abord le PDF,
            puis attachez-le dans la conversation après l’envoi du message.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              variant="outline"
              onClick={() => settings && printInvoice(invoice, settings)}
              disabled={!settings}
            >
              <Download className="h-4 w-4" /> Télécharger le PDF
            </Button>
            <Button
              disabled={!link || message.trim().length === 0}
              onClick={async () => {
                if (!link) return;
                window.open(link, '_blank', 'noopener,noreferrer');
                // Trace l'envoi (§19). Un échec de journalisation ne doit pas
                // faire croire que le message n'est pas parti : il l'est.
                await markInvoiceSent(invoice.id, 'whatsapp').catch(() => undefined);
                onClose();
              }}
            >
              <MessageCircle className="h-4 w-4" /> Ouvrir WhatsApp
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
