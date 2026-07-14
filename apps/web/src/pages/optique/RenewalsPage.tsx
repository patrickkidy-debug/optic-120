import { useQuery } from '@tanstack/react-query';
import { BellRing, Phone, MessageCircle } from 'lucide-react';
import { listRenewals } from '../../features/optique/api';
import { PageHeader, Badge, PageLoader, EmptyState } from '../../components/ui';

function waLink(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

/** Ancienneté en mois d'une date passée (arrondi), pour le suivi du renouvellement. */
function monthsAgo(v?: string | null): number | null {
  if (!v) return null;
  const months = Math.round((Date.now() - new Date(v).getTime()) / (30 * 24 * 60 * 60 * 1000));
  return months >= 0 ? months : null;
}
function ageLabel(v?: string | null): string {
  const m = monthsAgo(v);
  if (m === null) return '—';
  if (m === 0) return 'ce mois-ci';
  return `il y a ${m} mois`;
}

export function RenewalsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['renewals'], queryFn: listRenewals });

  return (
    <div>
      <PageHeader
        title="Rappels de renouvellement"
        subtitle="Clients à recontacter : ordonnance à renouveler ou nouvel achat à proposer"
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={BellRing} title="Aucun rappel pour le moment" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Client</th>
                <th className="table-cell font-semibold">Motif</th>
                <th className="table-cell font-semibold">Renouvellement</th>
                <th className="table-cell font-semibold">Contact</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => {
                const wa = waLink(c.phone);
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell font-medium text-content">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {c.renewPrescription && <Badge tone="warning">Ordonnance à renouveler</Badge>}
                        {c.reorder && <Badge tone="info">Nouvel achat à proposer</Badge>}
                      </div>
                    </td>
                    <td className="table-cell text-xs text-content-muted">
                      <div>Dernier achat : {ageLabel(c.lastPurchaseAt)}</div>
                      <div>Ordonnance : {ageLabel(c.lastPrescriptionAt)}</div>
                    </td>
                    <td className="table-cell text-content-muted">
                      {c.phone || c.email || '—'}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end gap-2">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="btn-ghost h-8 rounded-lg px-2.5 text-xs">
                            <Phone className="h-3.5 w-3.5" /> Appeler
                          </a>
                        )}
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-outline h-8 rounded-lg px-2.5 text-xs text-success"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
