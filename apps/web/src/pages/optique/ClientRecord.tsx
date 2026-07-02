import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Glasses, Plus, Printer, ReceiptText, FileText, Star } from 'lucide-react';
import type { PrescriptionCreateInput } from '@oculo/shared-types';
import { getCustomer, createPrescription, type Prescription } from '../../features/optique/api';
import { usePermission } from '../../store/auth';
import { usePosStore } from '../../store/pos';
import { apiErrorMessage } from '../../lib/api';
import { formatDate, formatCurrency } from '../../lib/format';
import { Modal, Button, Badge, PageLoader, Field } from '../../components/ui';

export function ClientRecord({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canCreate = usePermission('optique.prescriptions.create');
  const canQuote = usePermission('optique.quotes.create');
  const [adding, setAdding] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer(customerId),
  });

  function startQuote() {
    const pos = usePosStore.getState();
    pos.clear();
    pos.setCustomer(customerId);
    onClose();
    navigate('/optique/caisse');
  }

  return (
    <Modal open onClose={onClose} title="Fiche client" size="lg">
      {isLoading || !customer ? (
        <PageLoader />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-4">
            <div>
              <h3 className="font-display text-lg font-bold text-content">{customer.firstName} {customer.lastName}</h3>
              <p className="text-sm text-content-muted">
                {customer.phone ?? '—'}{customer.email ? ` · ${customer.email}` : ''}
              </p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">
                <Star className="h-3.5 w-3.5" /> {customer.loyaltyPoints ?? 0} points de fidélité
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canQuote && (
                <Button variant="outline" onClick={startQuote}>
                  <FileText className="h-4 w-4" /> Créer un devis
                </Button>
              )}
              {canCreate && !adding && (
                <Button onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" /> Ordonnance
                </Button>
              )}
            </div>
          </div>

          {adding && (
            <PrescriptionForm
              customerId={customerId}
              onClose={() => setAdding(false)}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['customer', customerId] });
                setAdding(false);
              }}
            />
          )}

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Glasses className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-content">Ordonnances ({customer.prescriptions.length})</h4>
            </div>
            {customer.prescriptions.length === 0 ? (
              <p className="text-sm text-content-muted">Aucune ordonnance enregistrée.</p>
            ) : (
              <div className="space-y-3">
                {customer.prescriptions.map((p) => (
                  <PrescriptionCard key={p.id} rx={p} />
                ))}
              </div>
            )}
          </div>

          {customer.sales.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-content">Dernières ventes</h4>
              </div>
              <div className="space-y-1.5">
                {customer.sales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                    <span className="font-medium text-content">{s.number}</span>
                    <span className="text-content-muted">{formatCurrency(Number(s.totalAmount))}</span>
                    <Badge tone="neutral">{s.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function PrescriptionCard({ rx }: { rx: Prescription }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-content">{formatDate(rx.date)}</span>
        <div className="flex items-center gap-2">
          {rx.lensType && <Badge tone="info">{rx.lensType}</Badge>}
          <button onClick={() => window.print()} className="btn-ghost h-7 w-7 rounded-lg p-0" title="Imprimer">
            <Printer className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <table className="w-full text-center text-sm">
        <thead>
          <tr className="text-xs uppercase text-content-faint">
            <th className="py-1 text-left font-semibold">Œil</th>
            <th className="font-semibold">Sphère</th>
            <th className="font-semibold">Cylindre</th>
            <th className="font-semibold">Axe</th>
            <th className="font-semibold">Add.</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="py-1 text-left font-medium text-content">OD</td>
            <td className="text-content-muted">{rx.odSphere ?? '—'}</td>
            <td className="text-content-muted">{rx.odCylinder ?? '—'}</td>
            <td className="text-content-muted">{rx.odAxis ?? '—'}</td>
            <td className="text-content-muted">{rx.odAddition ?? '—'}</td>
          </tr>
          <tr className="border-t">
            <td className="py-1 text-left font-medium text-content">OG</td>
            <td className="text-content-muted">{rx.ogSphere ?? '—'}</td>
            <td className="text-content-muted">{rx.ogCylinder ?? '—'}</td>
            <td className="text-content-muted">{rx.ogAxis ?? '—'}</td>
            <td className="text-content-muted">{rx.ogAddition ?? '—'}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-content-faint">
        {rx.pupillaryDistance && <span>Écart pupillaire : {rx.pupillaryDistance} mm</span>}
        {rx.prescriberName && <span>Prescripteur : {rx.prescriberName}</span>}
      </div>
      {rx.notes && <p className="mt-1 text-xs text-content-muted">{rx.notes}</p>}
    </div>
  );
}

function PrescriptionForm({
  customerId,
  onClose,
  onSaved,
}: {
  customerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<PrescriptionCreateInput>();
  const mut = useMutation({
    mutationFn: (v: PrescriptionCreateInput) => createPrescription(customerId, v),
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const cell = 'input px-2 py-1.5 text-center text-sm';

  return (
    <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4">
      <h4 className="flex items-center gap-2 font-semibold text-content">
        <Glasses className="h-4 w-4 text-primary" /> Nouvelle ordonnance optique
      </h4>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs uppercase text-content-faint">
              <th className="px-1 pb-1 text-left font-semibold">Œil</th>
              <th className="px-1 pb-1 font-semibold">Sphère</th>
              <th className="px-1 pb-1 font-semibold">Cylindre</th>
              <th className="px-1 pb-1 font-semibold">Axe</th>
              <th className="px-1 pb-1 font-semibold">Addition</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-2 font-semibold text-content">OD</td>
              <td className="px-1"><input className={cell} placeholder="+0.00" {...register('odSphere')} /></td>
              <td className="px-1"><input className={cell} placeholder="-0.00" {...register('odCylinder')} /></td>
              <td className="px-1"><input className={cell} placeholder="0°" {...register('odAxis')} /></td>
              <td className="px-1"><input className={cell} placeholder="+0.00" {...register('odAddition')} /></td>
            </tr>
            <tr>
              <td className="pr-2 font-semibold text-content">OG</td>
              <td className="px-1"><input className={cell} placeholder="+0.00" {...register('ogSphere')} /></td>
              <td className="px-1"><input className={cell} placeholder="-0.00" {...register('ogCylinder')} /></td>
              <td className="px-1"><input className={cell} placeholder="0°" {...register('ogAxis')} /></td>
              <td className="px-1"><input className={cell} placeholder="+0.00" {...register('ogAddition')} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Écart pupillaire (mm)"><input className="input" placeholder="62" {...register('pupillaryDistance')} /></Field>
        <Field label="Type de verres"><input className="input" placeholder="Progressifs…" {...register('lensType')} /></Field>
        <Field label="Prescripteur"><input className="input" {...register('prescriberName')} /></Field>
      </div>

      {/* Mesures avancées de montage */}
      <details className="rounded-xl border border-line bg-surface-2/40 px-3 py-2">
        <summary className="cursor-pointer select-none text-sm font-semibold text-content-muted">
          Mesures avancées de montage (optionnel)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Hauteur OD (mm)"><input className="input" placeholder="18" {...register('odHeight')} /></Field>
          <Field label="Hauteur OG (mm)"><input className="input" placeholder="18" {...register('ogHeight')} /></Field>
          <Field label="EP près OD (mm)"><input className="input" placeholder="29" {...register('odNearPd')} /></Field>
          <Field label="EP près OG (mm)"><input className="input" placeholder="29" {...register('ogNearPd')} /></Field>
          <Field label="Vertex (mm)"><input className="input" placeholder="12" {...register('vertex')} /></Field>
          <Field label="Angle pantoscopique (°)"><input className="input" placeholder="8" {...register('pantoTilt')} /></Field>
        </div>
      </details>

      <Field label="Notes"><input className="input" {...register('notes')} /></Field>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={mut.isPending}>Enregistrer l'ordonnance</Button>
      </div>
    </form>
  );
}
