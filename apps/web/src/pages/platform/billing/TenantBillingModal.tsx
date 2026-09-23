import { useQuery } from '@tanstack/react-query';
import { FileText, MessageCircle, Plus, Wallet } from 'lucide-react';
import { Badge, Button, EmptyState, Modal, Spinner } from '../../../components/ui';
import { formatCurrency } from '../../../lib/format';
import { getTenantBilling, type Invoice } from '../../../features/billing/invoicing';
import { InvoiceStatusBadge, shortDate } from './shared';

const SUB_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  ACTIVE: { label: 'Actif', tone: 'success' },
  TRIALING: { label: 'Essai', tone: 'info' },
  PAST_DUE: { label: 'En attente de paiement', tone: 'warning' },
  SUSPENDED: { label: 'Suspendu', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
};

/**
 * Facturation d'un établissement (§20) : abonnement en cours, montants
 * consolidés et historique complet des factures, avec les trois gestes du
 * quotidien à portée de clic (§32).
 *
 * Les factures affichées viennent de la MÊME lecture que la liste générale,
 * avec un filtre sur l'établissement — pas d'une seconde requête écrite pour
 * l'occasion, qui aurait fini par afficher d'autres chiffres.
 */
export function TenantBillingModal({
  tenantId,
  onClose,
  onCreateInvoice,
  onOpenInvoice,
  onRecordPayment,
  onSendWhatsapp,
}: {
  tenantId: string;
  onClose: () => void;
  onCreateInvoice: (tenantId: string) => void;
  onOpenInvoice: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onSendWhatsapp: (invoice: Invoice) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-billing-tenant', tenantId],
    queryFn: () => getTenantBilling(tenantId),
  });

  const sub = data?.subscription;
  const subMeta = sub ? (SUB_STATUS[sub.status] ?? { label: sub.status, tone: 'neutral' as const }) : null;
  const expired = sub ? new Date(sub.currentPeriodEnd).getTime() < Date.now() : false;

  // Première facture encore due : c'est celle qu'on veut encaisser ou relancer.
  const outstandingInvoice = data?.invoices.find(
    (i) => i.kind === 'INVOICE' && i.balance > 0 && !['CANCELLED', 'VOID'].includes(i.status),
  );
  const latestInvoice = data?.invoices[0];

  return (
    <Modal
      open
      onClose={onClose}
      title={data ? `Facturation — ${data.tenant.name}` : 'Facturation'}
      size="xl"
    >
      {isLoading || !data ? (
        <div className="py-12 text-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Abonnement en cours */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl bg-surface-2 p-4 lg:col-span-2">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">
                Abonnement actuel
              </h4>
              {!sub ? (
                <p className="text-sm text-content-muted">
                  Cet établissement n’a pas d’abonnement rattaché.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Cell label="Offre" value={sub.planName} />
                  <Cell label="Prix" value={`${formatCurrency(sub.priceMonthly)}/mois`} />
                  <div>
                    <p className="text-xs text-content-faint">Statut</p>
                    <div className="mt-0.5">
                      {expired && sub.status === 'ACTIVE' ? (
                        <Badge tone="danger">Expiré</Badge>
                      ) : (
                        <Badge tone={subMeta!.tone}>{subMeta!.label}</Badge>
                      )}
                    </div>
                  </div>
                  <Cell
                    label="Prochaine échéance"
                    value={
                      sub.autoRenew ? shortDate(sub.currentPeriodEnd) : 'Sans renouvellement auto.'
                    }
                  />
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-content-muted">
                {data.tenant.whatsapp && <span>WhatsApp : {data.tenant.whatsapp}</span>}
                {data.tenant.email && <span>· {data.tenant.email}</span>}
              </div>
            </div>

            <div className="rounded-xl bg-surface-2 p-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">
                Totaux
              </h4>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-content-muted">Encaissé</dt>
                  <dd className="font-semibold text-success">{formatCurrency(data.totals.collected)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-content-muted">Reste dû</dt>
                  <dd className={`font-semibold ${data.totals.outstanding > 0 ? 'text-warning' : 'text-content-faint'}`}>
                    {formatCurrency(data.totals.outstanding)}
                  </dd>
                </div>
                <div className="flex justify-between border-t pt-1.5">
                  <dt className="text-content-muted">Factures</dt>
                  <dd className="text-content">{data.totals.invoiceCount}</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Actions rapides (§32) */}
          <div className="flex flex-wrap gap-2 border-y py-3">
            <Button className="h-9 px-3 text-xs" onClick={() => onCreateInvoice(tenantId)}>
              <Plus className="h-4 w-4" /> Créer une facture
            </Button>
            <Button
              variant="accent"
              className="h-9 px-3 text-xs"
              disabled={!outstandingInvoice}
              onClick={() => outstandingInvoice && onRecordPayment(outstandingInvoice)}
            >
              <Wallet className="h-4 w-4" /> Enregistrer un paiement
            </Button>
            <Button
              variant="outline"
              className="h-9 px-3 text-xs"
              disabled={!latestInvoice}
              onClick={() => latestInvoice && onSendWhatsapp(latestInvoice)}
            >
              <MessageCircle className="h-4 w-4" /> Envoyer une facture
            </Button>
          </div>
          {!outstandingInvoice && data.invoices.length > 0 && (
            <p className="-mt-3 text-xs text-content-faint">
              Aucune facture en attente de règlement : créez-en une pour encaisser.
            </p>
          )}

          {/* Historique */}
          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">
              Historique des paiements
            </h4>
            {data.invoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Aucune facture"
                hint="Aucune facture n’a encore été émise pour cet établissement."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-content-faint">
                      <th className="px-3 py-2 font-semibold">N°</th>
                      <th className="px-3 py-2 font-semibold">Émise</th>
                      <th className="px-3 py-2 text-right font-semibold">Montant</th>
                      <th className="px-3 py-2 text-right font-semibold">Payé</th>
                      <th className="px-3 py-2 text-right font-semibold">Solde</th>
                      <th className="px-3 py-2 font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="cursor-pointer border-b last:border-0 hover:bg-surface-2/50"
                        onClick={() => onOpenInvoice(inv)}
                      >
                        <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">
                          {inv.number}
                        </td>
                        <td className="px-3 py-2 text-content-muted">{shortDate(inv.issueDate)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-content">
                          {formatCurrency(inv.total)}
                        </td>
                        <td className="px-3 py-2 text-right text-content-muted">
                          {formatCurrency(inv.amountPaid)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-semibold ${
                            inv.balance > 0 ? 'text-warning' : 'text-content-faint'
                          }`}
                        >
                          {formatCurrency(inv.balance)}
                        </td>
                        <td className="px-3 py-2">
                          <InvoiceStatusBadge invoice={inv} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-content-faint">{label}</p>
      <p className="mt-0.5 font-semibold text-content">{value}</p>
    </div>
  );
}
