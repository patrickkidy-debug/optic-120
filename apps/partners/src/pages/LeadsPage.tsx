import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { getLeads, createLead, updateLead, type Lead } from '../lib/partnerApi';
import type { PartnerLeadCreateInput } from '@oculo/shared-types';
import { apiErrorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { Badge, Button, Field, Modal, PageHeader, PageLoader, EmptyState } from '../components/ui';

const STATUS_LABEL: Record<string, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
  NEW: { label: 'Nouveau', tone: 'neutral' },
  CONTACTED: { label: 'Contacté', tone: 'info' },
  DEMO: { label: 'Démonstration', tone: 'info' },
  TRIAL: { label: 'Essai', tone: 'warning' },
  SUBSCRIBED: { label: 'Abonné', tone: 'success' },
  LOST: { label: 'Perdu', tone: 'danger' },
};
const STATUS_OPTIONS = ['NEW', 'CONTACTED', 'DEMO', 'TRIAL', 'SUBSCRIBED', 'LOST'] as const;

export function LeadsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['partner-leads'], queryFn: getLeads });
  const [adding, setAdding] = useState(false);

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Lead['status'] }) => updateLead(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner-leads'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Mes prospects"
        subtitle="Les magasins que vous avez identifiés ou recommandés"
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        }
      />
      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Users} title="Aucun prospect pour l'instant" hint="Ajoutez un magasin que vous avez démarché." />
      ) : (
        <div className="space-y-2">
          {data.map((lead) => (
            <div key={lead.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-content">{lead.establishmentName}</p>
                  <p className="text-xs text-content-faint">
                    {[lead.contactName, lead.phone, lead.city].filter(Boolean).join(' · ') || 'Aucun contact renseigné'}
                  </p>
                  <p className="mt-1 text-[11px] text-content-faint">Ajouté le {formatDate(lead.createdAt)}</p>
                </div>
                <Badge tone={STATUS_LABEL[lead.status]?.tone ?? 'neutral'}>
                  {STATUS_LABEL[lead.status]?.label ?? lead.status}
                </Badge>
              </div>
              <select
                value={lead.status}
                onChange={(e) => statusMut.mutate({ id: lead.id, status: e.target.value as Lead['status'] })}
                className="input mt-3 h-9 text-xs"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s].label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      {adding && <AddLeadModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddLeadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PartnerLeadCreateInput>({ establishmentName: '' });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => createLead(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-leads'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Ajouter un prospect" size="sm">
      <div className="space-y-3">
        <Field label="Nom de l'établissement">
          <input
            className="input"
            value={form.establishmentName}
            onChange={(e) => setForm((f) => ({ ...f, establishmentName: e.target.value }))}
          />
        </Field>
        <Field label="Nom du contact">
          <input
            className="input"
            value={form.contactName ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
          />
        </Field>
        <Field label="Téléphone">
          <input
            className="input"
            value={form.phone ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </Field>
        <Field label="Ville">
          <input
            className="input"
            value={form.city ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            loading={mut.isPending}
            disabled={!form.establishmentName.trim()}
            onClick={() => mut.mutate()}
          >
            Ajouter
          </Button>
        </div>
      </div>
    </Modal>
  );
}
