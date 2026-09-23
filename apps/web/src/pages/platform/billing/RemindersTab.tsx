import { useQuery } from '@tanstack/react-query';
import { BellRing, MessageCircle } from 'lucide-react';
import { Badge, Button, EmptyState, PageLoader } from '../../../components/ui';
import { formatCurrency } from '../../../lib/format';
import { listBillingReminders, type Invoice, type ReminderRow } from '../../../features/billing/invoicing';
import { shortDate } from './shared';

const KIND_META: Record<string, { label: string; tone: 'warning' | 'danger' | 'info' }> = {
  before: { label: 'Avant échéance', tone: 'info' },
  due: { label: "Échéance aujourd'hui", tone: 'warning' },
  after: { label: 'Échéance dépassée', tone: 'danger' },
};

/**
 * Relances de paiement (§18).
 *
 * Aucun message n'est envoyé automatiquement. Chaque relance part d'un clic du
 * fondateur, qui relit le texte avant l'envoi : une relance automatique sur un
 * numéro erroné, ou sur un client qui vient de payer par un autre canal, ne se
 * rattrape pas.
 */
export function BillingRemindersTab({ onSend }: { onSend: (invoice: Invoice, kind: ReminderRow['reminderKind']) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-billing-reminders'],
    queryFn: listBillingReminders,
  });

  if (isLoading) return <PageLoader />;

  const rows = data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BellRing}
        title="Aucune relance à faire"
        hint="Aucune facture n’arrive à échéance ni n’est en retard selon vos réglages."
      />
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
            <th className="table-cell font-semibold">Client</th>
            <th className="table-cell font-semibold">Facture</th>
            <th className="table-cell text-right font-semibold">Solde</th>
            <th className="table-cell font-semibold">Échéance</th>
            <th className="table-cell font-semibold">Situation</th>
            <th className="table-cell text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const meta = KIND_META[r.reminderKind] ?? KIND_META.after;
            return (
              <tr key={r.id} className="border-b last:border-0 hover:bg-surface-2/50">
                <td className="table-cell">
                  <div className="font-medium text-content">{r.billing.name}</div>
                  <div className="text-xs text-content-faint">{r.billing.whatsapp ?? 'Sans numéro WhatsApp'}</div>
                </td>
                <td className="table-cell font-mono text-xs text-content-muted">{r.number}</td>
                <td className="table-cell text-right font-semibold text-warning">
                  {formatCurrency(r.balance)}
                </td>
                <td className="table-cell text-content-muted">{shortDate(r.dueDate)}</td>
                <td className="table-cell">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <div className="mt-0.5 text-xs text-content-faint">
                    {r.daysToDue > 0
                      ? `dans ${r.daysToDue} jour${r.daysToDue > 1 ? 's' : ''}`
                      : r.daysToDue === 0
                        ? "aujourd'hui"
                        : `depuis ${Math.abs(r.daysToDue)} jour${Math.abs(r.daysToDue) > 1 ? 's' : ''}`}
                  </div>
                </td>
                <td className="table-cell text-right">
                  <Button className="h-8 px-3 text-xs" onClick={() => onSend(r, r.reminderKind)}>
                    <MessageCircle className="h-3.5 w-3.5" /> Relancer
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
