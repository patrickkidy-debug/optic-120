import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { getCustomers } from '../lib/partnerApi';
import { formatCurrency, formatDate } from '../lib/format';
import { Badge, PageHeader, PageLoader, EmptyState } from '../components/ui';

export function CustomersPage() {
  const { data, isLoading } = useQuery({ queryKey: ['partner-customers'], queryFn: getCustomers });

  return (
    <div>
      <PageHeader title="Mes clients" subtitle="Les magasins qui se sont inscrits via votre lien" />
      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aucun client pour l'instant"
          hint="Vos clients apparaîtront ici dès qu'un magasin s'inscrit via votre lien de parrainage."
        />
      ) : (
        <div className="space-y-2">
          {data.map((c) => (
            <div key={c.tenantId} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-content">{c.tenantName}</p>
                  <p className="text-xs text-content-faint">
                    {c.planName ?? 'Aucun abonnement'} {c.linkedAt ? `· inscrit le ${formatDate(c.linkedAt)}` : ''}
                  </p>
                </div>
                <Badge tone={c.active ? 'success' : 'neutral'}>{c.active ? 'Actif' : 'Inactif'}</Badge>
              </div>
              {c.commissionGenerated > 0 && (
                <p className="mt-2 text-xs text-content-faint">
                  Commission générée : <span className="font-semibold text-content">{formatCurrency(c.commissionGenerated)}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
