import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Wallet } from 'lucide-react';
import { InsuranceClaimStatus } from '@oculo/shared-types';
import {
  listClaims,
  createClaim,
  updateClaim,
  addRefund,
  type Insurer,
  type InsuranceClaim,
} from '../../../features/management/api';
import { apiErrorMessage } from '../../../lib/api';
import { formatCurrency, formatDate } from '../../../lib/format';
import { Button, Modal, Field, PageLoader, EmptyState } from '../../../components/ui';
import { CLAIM_STATUSES, ClaimStatusBadge, claimStatusLabel, num } from './shared';

/** Invalide tout ce qu'un mouvement de dossier fait bouger ailleurs. */
export function useInsuranceRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['insurance-claims'] });
    qc.invalidateQueries({ queryKey: ['insurance-refunds'] });
    qc.invalidateQueries({ queryKey: ['insurance-receivables'] });
    qc.invalidateQueries({ queryKey: ['insurance-dashboard'] });
    qc.invalidateQueries({ queryKey: ['insurance-summary'] });
    qc.invalidateQueries({ queryKey: ['insurer-upcoming'] });
    qc.invalidateQueries({ queryKey: ['insurers'] });
    qc.invalidateQueries({ queryKey: ['receivables'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function ClaimsTab({
  insurers,
  canUpdate,
  canCreate,
}: {
  insurers: Insurer[];
  canUpdate: boolean;
  canCreate: boolean;
}) {
  const [insurerId, setInsurerId] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<InsuranceClaim | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['insurance-claims', insurerId, status],
    queryFn: () => listClaims({ insurerId: insurerId || undefined, status: status || undefined }),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filtrer par assureur"
          className="input h-9 w-auto"
          value={insurerId}
          onChange={(e) => setInsurerId(e.target.value)}
        >
          <option value="">Tous les assureurs</option>
          {insurers.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrer par statut"
          className="input h-9 w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          {CLAIM_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {canCreate && insurers.length > 0 && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouveau dossier
          </Button>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucune prise en charge"
          hint="Chaque vente avec une part assurance ouvre automatiquement un dossier."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-surface-2/60 text-left text-xs uppercase tracking-wide text-content-muted">
                <th className="table-cell font-semibold">Dossier</th>
                <th className="table-cell font-semibold">Assureur</th>
                <th className="table-cell font-semibold">Client</th>
                <th className="table-cell text-right font-semibold">Demandé</th>
                <th className="table-cell text-right font-semibold">Accepté</th>
                <th className="table-cell text-right font-semibold">Payé</th>
                <th className="table-cell text-right font-semibold">Restant</th>
                <th className="table-cell font-semibold">Échéance</th>
                <th className="table-cell font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="cursor-pointer border-b last:border-0 transition hover:bg-surface-2"
                >
                  <td className="table-cell font-medium text-content">
                    {c.number}
                    {c.sale && <span className="block text-xs text-content-faint">{c.sale.number}</span>}
                  </td>
                  <td className="table-cell text-content-muted">{c.insurer?.name ?? '—'}</td>
                  <td className="table-cell text-content-muted">
                    {c.customer ? `${c.customer.firstName} ${c.customer.lastName}` : '—'}
                  </td>
                  <td className="table-cell text-right text-content">{formatCurrency(num(c.requestedAmount))}</td>
                  <td className="table-cell text-right text-content">{formatCurrency(num(c.acceptedAmount))}</td>
                  <td className="table-cell text-right text-success">{formatCurrency(num(c.paidAmount))}</td>
                  <td className="table-cell text-right font-semibold text-warning">
                    {formatCurrency(c.remainingAmount)}
                  </td>
                  <td className="table-cell text-content-muted">{c.dueAt ? formatDate(c.dueAt) : '—'}</td>
                  <td className="table-cell">
                    <ClaimStatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ClaimDetailModal claim={selected} canUpdate={canUpdate} onClose={() => setSelected(null)} />
      )}
      {creating && <ClaimCreateModal insurers={insurers} onClose={() => setCreating(false)} />}
    </div>
  );
}

/** Détail d'un dossier : montants, décision de l'assureur et remboursements. */
export function ClaimDetailModal({
  claim,
  canUpdate,
  onClose,
}: {
  claim: InsuranceClaim;
  canUpdate: boolean;
  onClose: () => void;
}) {
  const refresh = useInsuranceRefresh();
  const [error, setError] = useState('');
  const [status, setStatus] = useState(claim.status);
  const [accepted, setAccepted] = useState(String(num(claim.acceptedAmount)));
  const [notes, setNotes] = useState(claim.notes ?? '');
  const [dueAt, setDueAt] = useState(claim.dueAt ? claim.dueAt.slice(0, 10) : '');
  const [refunding, setRefunding] = useState(false);
  const [current, setCurrent] = useState(claim);

  const save = useMutation({
    mutationFn: () =>
      updateClaim(claim.id, {
        status: status as typeof InsuranceClaimStatus.PENDING,
        acceptedAmount: Number(accepted),
        notes,
        dueAt,
      }),
    onSuccess: (updated) => {
      setCurrent(updated);
      refresh();
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const expected = current.expectedAmount;
  const remaining = current.remainingAmount;

  return (
    <Modal open onClose={onClose} title={`Prise en charge ${current.number}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Line label="Assureur" value={current.insurer?.name ?? '—'} />
            <Line
              label="Client"
              value={current.customer ? `${current.customer.firstName} ${current.customer.lastName}` : '—'}
            />
            <Line label="Vente" value={current.sale?.number ?? '—'} />
            <Line label="Contrat" value={current.contract?.name ?? 'Aucun'} />
            <Line label="Total de la vente" value={formatCurrency(num(current.totalAmount))} />
            <Line label="Demandé" value={formatCurrency(num(current.requestedAmount))} />
            <Line label="Part client" value={formatCurrency(num(current.patientAmount))} />
            <Line label="Demandée le" value={formatDate(current.requestedAt)} />
          </div>
        </div>

        <div className="rounded-xl border border-primary/25 bg-primary-soft/25 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-content-muted">Créance assurance</span>
            <span className="font-display text-xl font-bold text-content">{formatCurrency(remaining)}</span>
          </div>
          <p className="mt-1 text-xs text-content-muted">
            {formatCurrency(expected)} attendu · {formatCurrency(num(current.paidAmount))} déjà reçu
          </p>
        </div>

        {canUpdate && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Statut">
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {CLAIM_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Montant accepté">
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={accepted}
                  onChange={(e) => setAccepted(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Échéance">
              <input className="input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </Field>
            <Field label="Notes">
              <textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {remaining > 0 && status !== InsuranceClaimStatus.REJECTED && (
                <Button type="button" variant="ghost" onClick={() => setRefunding(true)}>
                  <Wallet className="h-4 w-4" /> Enregistrer un remboursement
                </Button>
              )}
              <Button type="submit" loading={save.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        )}

        <div>
          <h4 className="mb-2 text-sm font-semibold text-content">Remboursements reçus</h4>
          {!current.refunds || current.refunds.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-content-faint">
              Aucun versement enregistré : rien n'a encore été encaissé sur ce dossier.
            </p>
          ) : (
            <div className="space-y-1.5">
              {current.refunds.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-success">{formatCurrency(num(r.receivedAmount))}</p>
                    <p className="truncate text-xs text-content-faint">
                      {formatDate(r.receivedAt)}
                      {r.reference ? ` · ${r.reference}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {refunding && (
        <RefundModal
          claim={current}
          onDone={(updated) => {
            setCurrent(updated);
            setRefunding(false);
            refresh();
          }}
          onClose={() => setRefunding(false)}
        />
      )}
    </Modal>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-content-muted">{label}</p>
      <p className="truncate font-medium text-content">{value}</p>
    </div>
  );
}

/** Saisie d'un versement réellement reçu, toujours rattaché à un dossier. */
export function RefundModal({
  claim,
  onDone,
  onClose,
}: {
  claim: InsuranceClaim;
  onDone: (claim: InsuranceClaim) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const max = claim.remainingAmount;
  const [amount, setAmount] = useState(String(Math.round(max)));
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const parsed = Number(amount);
  const invalid = !Number.isFinite(parsed) || parsed <= 0 || parsed > max;

  const mut = useMutation({
    mutationFn: () => addRefund(claim.id, { receivedAmount: parsed, receivedAt, reference, notes }),
    onSuccess: onDone,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={`Remboursement — ${claim.number}`} size="sm">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) mut.mutate();
        }}
      >
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-content-muted">Restant dû</span>
            <span className="font-display font-bold text-content">{formatCurrency(max)}</span>
          </div>
        </div>
        <Field label="Montant reçu">
          <input
            className="input"
            type="number"
            min="1"
            max={max}
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
          />
          {invalid && (
            <p className="mt-1 text-xs text-danger">Saisissez un montant entre 1 et {formatCurrency(max)}.</p>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de réception">
            <input
              className="input"
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </Field>
          <Field label="Référence">
            <input
              className="input"
              placeholder="N° de chèque, virement…"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Commentaire">
          <textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending} disabled={invalid}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ClaimCreateModal({ insurers, onClose }: { insurers: Insurer[]; onClose: () => void }) {
  const refresh = useInsuranceRefresh();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    insurerId: insurers[0]?.id ?? '',
    totalAmount: '',
    requestedAmount: '',
    status: InsuranceClaimStatus.PENDING as string,
    dueAt: '',
    notes: '',
  });

  const mut = useMutation({
    mutationFn: () =>
      createClaim({
        insurerId: form.insurerId,
        totalAmount: Number(form.totalAmount || 0),
        requestedAmount: Number(form.requestedAmount || 0),
        acceptedAmount: 0,
        status: form.status as typeof InsuranceClaimStatus.PENDING,
        dueAt: form.dueAt,
        notes: form.notes,
      }),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const valid = form.insurerId && Number(form.requestedAmount) > 0;

  return (
    <Modal open onClose={onClose} title="Nouvelle prise en charge" size="sm">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) mut.mutate(); }}>
        <p className="rounded-lg bg-surface-2 p-3 text-xs text-content-muted">
          Une vente encaissée avec une part assurance ouvre déjà son dossier automatiquement. Ce
          formulaire sert aux dossiers saisis hors caisse.
        </p>
        <Field label="Assureur">
          <select
            className="input"
            value={form.insurerId}
            onChange={(e) => setForm({ ...form, insurerId: e.target.value })}
          >
            {insurers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant total">
            <input
              className="input"
              type="number"
              min="0"
              value={form.totalAmount}
              onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
            />
          </Field>
          <Field label="Montant demandé">
            <input
              className="input"
              type="number"
              min="0"
              value={form.requestedAmount}
              onChange={(e) => setForm({ ...form, requestedAmount: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Statut">
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {[InsuranceClaimStatus.DRAFT, InsuranceClaimStatus.PENDING].map((s) => (
                <option key={s} value={s}>
                  {claimStatusLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Échéance">
            <input
              className="input"
              type="date"
              value={form.dueAt}
              onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            className="input min-h-[60px]"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending} disabled={!valid}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
