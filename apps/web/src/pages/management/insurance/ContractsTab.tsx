import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2, Users, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import {
  listInsuranceContracts,
  getInsuranceContract,
  createInsuranceContract,
  updateInsuranceContract,
  createGuarantee,
  updateGuarantee,
  deleteGuarantee,
  addBeneficiary,
  removeBeneficiary,
  type Insurer,
  type InsuranceContract,
  type InsuranceGuarantee,
} from '../../../features/management/api';
import { CustomerSearch } from '../../../features/optique/SaleTools';
import { apiErrorMessage } from '../../../lib/api';
import { formatCurrency, formatDate } from '../../../lib/format';
import { Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../../components/ui';
import {
  CONTRACT_STATUSES,
  contractStatusLabel,
  GUARANTEE_CATEGORY_OPTIONS,
  guaranteeCategoryLabel,
  num,
} from './shared';

export function ContractsTab({
  insurers,
  canUpdate,
  canCreate,
}: {
  insurers: Insurer[];
  canUpdate: boolean;
  canCreate: boolean;
}) {
  const [insurerId, setInsurerId] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InsuranceContract | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['insurance-contracts', insurerId],
    queryFn: () => listInsuranceContracts(insurerId || undefined),
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
        {canCreate && insurers.length > 0 && (
          <Button onClick={() => { setEditing(null); setCreating(true); }}>
            <Plus className="h-4 w-4" /> Nouveau contrat
          </Button>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun contrat"
          hint={
            insurers.length === 0
              ? "Créez d'abord un assureur."
              : 'Un contrat porte les garanties : catégorie, taux, plafond et franchise.'
          }
        />
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <div key={c.id} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(openId === c.id ? null : c.id)}
                className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-2"
              >
                {openId === c.id ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-content-faint" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-content-faint" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold text-content">{c.name}</p>
                  <p className="truncate text-xs text-content-muted">
                    {c.insurer?.name}
                    {c.reference ? ` · Réf. ${c.reference}` : ''}
                    {c.startsAt ? ` · du ${formatDate(c.startsAt)}` : ''}
                    {c.endsAt ? ` au ${formatDate(c.endsAt)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs text-content-faint sm:inline">
                    {c.guarantees.length} garantie(s) · {c._count?.beneficiaries ?? 0} bénéficiaire(s)
                  </span>
                  <Badge tone={c.status === 'ACTIVE' ? 'success' : c.status === 'SUSPENDED' ? 'warning' : 'neutral'}>
                    {contractStatusLabel(c.status)}
                  </Badge>
                </div>
              </button>

              {openId === c.id && (
                <ContractDetail
                  contractId={c.id}
                  canUpdate={canUpdate}
                  onEdit={() => { setEditing(c); setCreating(true); }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <ContractModal
          insurers={insurers}
          contract={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

/** Garanties et bénéficiaires d'un contrat, chargés à l'ouverture. */
function ContractDetail({
  contractId,
  canUpdate,
  onEdit,
}: {
  contractId: string;
  canUpdate: boolean;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const [addingGuarantee, setAddingGuarantee] = useState(false);
  const [editingGuarantee, setEditingGuarantee] = useState<InsuranceGuarantee | null>(null);
  const [addingBeneficiary, setAddingBeneficiary] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['insurance-contract', contractId],
    queryFn: () => getInsuranceContract(contractId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['insurance-contract', contractId] });
    qc.invalidateQueries({ queryKey: ['insurance-contracts'] });
    qc.invalidateQueries({ queryKey: ['insurers'] });
  };

  const removeGuarantee = useMutation({
    mutationFn: (id: string) => deleteGuarantee(id),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const removeBenef = useMutation({
    mutationFn: (id: string) => removeBeneficiary(id),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (isLoading || !data) return <div className="border-t p-4"><PageLoader /></div>;

  return (
    <div className="border-t bg-surface-2/40 p-4">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------------------------------ Garanties ------------------------------ */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-content">Garanties</h4>
            {canUpdate && (
              <button
                type="button"
                onClick={() => { setEditingGuarantee(null); setAddingGuarantee(true); }}
                className="btn-outline h-7 rounded-md px-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </button>
            )}
          </div>
          {data.guarantees.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-content-faint">
              Aucune garantie : ce contrat ne couvre rien pour l'instant.
            </p>
          ) : (
            <div className="space-y-2">
              {data.guarantees.map((g) => (
                <div key={g.id} className="rounded-lg border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content">
                        {guaranteeCategoryLabel(g.category)}{' '}
                        <span className="text-success">{g.coveragePercent} %</span>
                      </p>
                      <p className="mt-0.5 text-xs text-content-muted">
                        {g.ceilingAmount ? `Plafond ${formatCurrency(num(g.ceilingAmount))}` : 'Sans plafond'}
                        {g.deductibleAmount ? ` · Franchise ${formatCurrency(num(g.deductibleAmount))}` : ''}
                        {g.maxAmount ? ` · Max contrat ${formatCurrency(num(g.maxAmount))}` : ''}
                      </p>
                      {g.conditions && <p className="mt-1 text-xs text-content-faint">{g.conditions}</p>}
                    </div>
                    {canUpdate && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label="Modifier la garantie"
                          onClick={() => { setEditingGuarantee(g); setAddingGuarantee(true); }}
                          className="rounded-md p-1.5 text-content-faint transition hover:bg-surface-2 hover:text-content"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Supprimer la garantie"
                          onClick={() => {
                            if (confirm(`Supprimer la garantie « ${guaranteeCategoryLabel(g.category)} » ?`)) {
                              removeGuarantee.mutate(g.id);
                            }
                          }}
                          className="rounded-md p-1.5 text-content-faint transition hover:bg-surface-2 hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --------------------------- Bénéficiaires --------------------------- */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-content">Bénéficiaires</h4>
            {canUpdate && (
              <button
                type="button"
                onClick={() => setAddingBeneficiary(true)}
                className="btn-outline h-7 rounded-md px-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Rattacher un client
              </button>
            )}
          </div>
          {!data.beneficiaries || data.beneficiaries.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-content-faint">
              Aucun client rattaché. En caisse, ce contrat ne s'appliquera à personne.
            </p>
          ) : (
            <div className="space-y-1.5">
              {data.beneficiaries.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border bg-surface px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">
                      {b.customer?.firstName} {b.customer?.lastName}
                    </p>
                    <p className="truncate text-xs text-content-faint">
                      {b.membershipNumber ? `N° ${b.membershipNumber}` : 'Sans numéro d’assuré'}
                      {b.customer?.phone ? ` · ${b.customer.phone}` : ''}
                    </p>
                  </div>
                  {canUpdate && (
                    <button
                      type="button"
                      aria-label="Retirer le bénéficiaire"
                      onClick={() => {
                        if (confirm('Retirer ce client du contrat ?')) removeBenef.mutate(b.id);
                      }}
                      className="shrink-0 rounded-md p-1.5 text-content-faint transition hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {canUpdate && (
        <button type="button" onClick={onEdit} className="btn-outline mt-4 h-8 rounded-lg text-xs">
          <Pencil className="h-3.5 w-3.5" /> Modifier le contrat
        </button>
      )}

      {addingGuarantee && (
        <GuaranteeModal
          contractId={contractId}
          guarantee={editingGuarantee}
          taken={data.guarantees.map((g) => g.category)}
          onClose={() => { setAddingGuarantee(false); setEditingGuarantee(null); }}
        />
      )}
      {addingBeneficiary && (
        <BeneficiaryModal contractId={contractId} onClose={() => setAddingBeneficiary(false)} />
      )}
    </div>
  );
}

function ContractModal({
  insurers,
  contract,
  onClose,
}: {
  insurers: Insurer[];
  contract: InsuranceContract | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    insurerId: contract?.insurerId ?? insurers[0]?.id ?? '',
    name: contract?.name ?? '',
    reference: contract?.reference ?? '',
    startsAt: contract?.startsAt ? contract.startsAt.slice(0, 10) : '',
    endsAt: contract?.endsAt ? contract.endsAt.slice(0, 10) : '',
    status: contract?.status ?? 'ACTIVE',
    notes: contract?.notes ?? '',
  });

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        reference: form.reference,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        status: form.status as 'ACTIVE',
        notes: form.notes,
      };
      return contract
        ? updateInsuranceContract(contract.id, payload)
        : createInsuranceContract({ ...payload, insurerId: form.insurerId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-contracts'] });
      qc.invalidateQueries({ queryKey: ['insurance-contract'] });
      qc.invalidateQueries({ queryKey: ['insurers'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={contract ? 'Modifier le contrat' : 'Nouveau contrat'}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.name.trim().length > 0 && form.insurerId) mut.mutate();
        }}
      >
        {!contract && (
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
        )}
        <Field label="Nom du contrat">
          <input
            className="input"
            autoFocus
            placeholder="Ex. Convention entreprise 2026"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Référence">
            <input
              className="input"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </Field>
          <Field label="Statut">
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {CONTRACT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de début">
            <input
              className="input"
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </Field>
          <Field label="Date de fin">
            <input
              className="input"
              type="date"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            className="input min-h-[70px]"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending} disabled={form.name.trim().length === 0}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function GuaranteeModal({
  contractId,
  guarantee,
  taken,
  onClose,
}: {
  contractId: string;
  guarantee: InsuranceGuarantee | null;
  taken: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const available = GUARANTEE_CATEGORY_OPTIONS.filter(
    (c) => guarantee?.category === c.value || !taken.includes(c.value),
  );
  const [form, setForm] = useState({
    category: guarantee?.category ?? available[0]?.value ?? 'ALL',
    coveragePercent: String(guarantee?.coveragePercent ?? 80),
    ceilingAmount: guarantee?.ceilingAmount ? String(num(guarantee.ceilingAmount)) : '',
    deductibleAmount: guarantee?.deductibleAmount ? String(num(guarantee.deductibleAmount)) : '',
    maxAmount: guarantee?.maxAmount ? String(num(guarantee.maxAmount)) : '',
    conditions: guarantee?.conditions ?? '',
  });

  const optional = (v: string) => (v.trim() === '' ? null : Number(v));

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        category: form.category,
        coveragePercent: Number(form.coveragePercent),
        ceilingAmount: optional(form.ceilingAmount),
        deductibleAmount: optional(form.deductibleAmount),
        maxAmount: optional(form.maxAmount),
        conditions: form.conditions,
      };
      return guarantee ? updateGuarantee(guarantee.id, payload) : createGuarantee(contractId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-contract', contractId] });
      qc.invalidateQueries({ queryKey: ['insurance-contracts'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={guarantee ? 'Modifier la garantie' : 'Nouvelle garantie'} size="sm">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie">
            <select
              className="input"
              value={form.category}
              disabled={!!guarantee}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {available.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prise en charge (%)">
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              value={form.coveragePercent}
              onChange={(e) => setForm({ ...form, coveragePercent: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plafond par vente">
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Sans plafond"
              value={form.ceilingAmount}
              onChange={(e) => setForm({ ...form, ceilingAmount: e.target.value })}
            />
          </Field>
          <Field label="Franchise">
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Aucune"
              value={form.deductibleAmount}
              onChange={(e) => setForm({ ...form, deductibleAmount: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Montant maximum sur la durée du contrat">
          <input
            className="input"
            type="number"
            min="0"
            placeholder="Non limité"
            value={form.maxAmount}
            onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
          />
        </Field>
        <Field label="Conditions">
          <textarea
            className="input min-h-[60px]"
            placeholder="Ex. une monture tous les deux ans"
            value={form.conditions}
            onChange={(e) => setForm({ ...form, conditions: e.target.value })}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BeneficiaryModal({ contractId, onClose }: { contractId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [membershipNumber, setMembershipNumber] = useState('');

  const mut = useMutation({
    mutationFn: () => addBeneficiary(contractId, { customerId: customerId!, membershipNumber }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-contract', contractId] });
      qc.invalidateQueries({ queryKey: ['insurance-contracts'] });
      qc.invalidateQueries({ queryKey: ['insurers'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Rattacher un client au contrat" size="sm">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (customerId) mut.mutate(); }}>
        <Field label="Client">
          <CustomerSearch value={customerId} onChange={(id) => setCustomerId(id)} />
        </Field>
        <Field label="Numéro d'assuré">
          <input
            className="input"
            placeholder="Tel qu'il figure sur la carte"
            value={membershipNumber}
            onChange={(e) => setMembershipNumber(e.target.value)}
          />
        </Field>
        <p className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs text-content-muted">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          En caisse, la part assurance de ce client sera calculée avec les garanties de ce contrat.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending} disabled={!customerId}>
            Rattacher
          </Button>
        </div>
      </form>
    </Modal>
  );
}
