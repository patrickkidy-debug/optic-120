import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Pencil, FileText, Users, ClipboardList } from 'lucide-react';
import { insurerCreateSchema, type InsurerCreateInput } from '@oculo/shared-types';
import {
  listInsurers,
  createInsurer,
  updateInsurer,
  getInsurerUpcoming,
  type Insurer,
  type InsuranceClaim,
} from '../../features/management/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';
import { INSURER_TYPES, insurerTypeLabel, TabBar } from './insurance/shared';
import { OverviewTab } from './insurance/OverviewTab';
import { ContractsTab } from './insurance/ContractsTab';
import { ClaimsTab, ClaimDetailModal } from './insurance/ClaimsTab';
import { RefundsTab } from './insurance/RefundsTab';
import { ReceivablesTab } from './insurance/ReceivablesTab';
import { tr } from '../../lib/tr';

type Tab = 'overview' | 'insurers' | 'contracts' | 'claims' | 'refunds' | 'receivables';

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', get label() { return tr('ui.InsurancePage.tableauDeBord'); } },
  { value: 'insurers', get label() { return tr('ui.InsurancePage.assureurs'); } },
  { value: 'contracts', get label() { return tr('ui.InsurancePage.contrats'); } },
  { value: 'claims', get label() { return tr('ui.InsurancePage.prisesEnCharge'); } },
  { value: 'refunds', get label() { return tr('ui.InsurancePage.remboursements'); } },
  { value: 'receivables', get label() { return tr('ui.InsurancePage.creances'); } },
];

export function InsurancePage() {
  const canCreate = usePermission('insurance.create');
  const canUpdate = usePermission('insurance.update');
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState<Insurer | null>(null);
  const [open, setOpen] = useState(false);
  const [claim, setClaim] = useState<InsuranceClaim | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data, isLoading } = useQuery({ queryKey: ['insurers'], queryFn: listInsurers });
  const { data: upcoming } = useQuery({
    queryKey: ['insurer-upcoming', month],
    queryFn: () => getInsurerUpcoming(month),
  });

  return (
    <div>
      <PageHeader
        title={tr('ui.InsurancePage.assurances')}
        subtitle={tr('ui.InsurancePage.contratsGarantiesPrisesEnCharge')}
        actions={
          canCreate && (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> {tr('ui.InsurancePage.nouvelleAssurance')}
            </Button>
          )
        }
      />

      {/* Bandeau mensuel : tout est calculé depuis les remboursements
          réellement enregistrés, plus aucun montant ne se saisit ici. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary-soft/25 p-3">
        <div>
          <p className="text-sm font-semibold text-content">{tr('ui.InsurancePage.remboursementsAssuranceParMois')}</p>
          <p className="text-xs text-content-muted">
            {tr('ui.InsurancePage.calculeAPartirDesVersements')}
          </p>
        </div>
        <input
          aria-label={tr('ui.InsurancePage.moisDeRemboursement')}
          className="input h-9 w-auto"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        {upcoming && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{tr('ui.InsurancePage.recuCeMois')} {formatCurrency(upcoming.receivedThisMonth ?? 0)}</Badge>
            <Badge tone="info">{tr('ui.InsurancePage.enAttente')} {formatCurrency(upcoming.pendingTotal ?? 0)}</Badge>
            <Badge tone="danger">{tr('ui.InsurancePage.enRetard')} {formatCurrency(upcoming.lateTotal ?? 0)}</Badge>
            <Badge tone="neutral">
              {tr('ui.InsurancePage.prochaineEcheance')} {upcoming.nextDueDate ? formatDate(upcoming.nextDueDate) : '—'}
            </Badge>
          </div>
        )}
      </div>

      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      {isLoading ? (
        <PageLoader />
      ) : tab === 'overview' ? (
        <OverviewTab />
      ) : tab === 'insurers' ? (
        <InsurersTab
          insurers={data ?? []}
          canUpdate={canUpdate}
          onEdit={(i) => { setEditing(i); setOpen(true); }}
        />
      ) : tab === 'contracts' ? (
        <ContractsTab insurers={data ?? []} canUpdate={canUpdate} canCreate={canCreate} />
      ) : tab === 'claims' ? (
        <ClaimsTab insurers={data ?? []} canUpdate={canUpdate} canCreate={canCreate} />
      ) : tab === 'refunds' ? (
        <RefundsTab insurers={data ?? []} canUpdate={canUpdate} />
      ) : (
        <ReceivablesTab insurers={data ?? []} onOpenClaim={setClaim} />
      )}

      {open && <InsurerModal insurer={editing} onClose={() => setOpen(false)} />}
      {claim && (
        <ClaimDetailModal claim={claim} canUpdate={canUpdate} onClose={() => setClaim(null)} />
      )}
    </div>
  );
}

/** Cartes assureurs : le design d'origine, enrichi des compteurs du module. */
function InsurersTab({
  insurers,
  canUpdate,
  onEdit,
}: {
  insurers: Insurer[];
  canUpdate: boolean;
  onEdit: (insurer: Insurer) => void;
}) {
  if (insurers.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={tr('ui.InsurancePage.aucuneAssurance')}
        hint={tr('ui.InsurancePage.creezUnAssureurPuisSon')}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {insurers.map((i) => (
        <div key={i.id} className="card p-5">
          <div className="flex items-start justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--success)]/15 text-success">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <Badge tone="info">{insurerTypeLabel(i.type)}</Badge>
          </div>
          <h3 className="mt-3 font-display font-bold text-content">{i.name}</h3>

          {/* Le taux n'est plus la règle : il ne sert qu'à défaut de contrat. */}
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-2xl font-bold text-success">{i.coveragePercent}%</span>
            <span className="text-xs text-content-muted">
              {(i.contractCount ?? 0) > 0 ? tr('ui.InsurancePage.tauxParDefaut') : tr('ui.InsurancePage.dePriseEnCharge')}
            </span>
          </div>

          <div className="mt-2 space-y-1 text-xs text-content-faint">
            {i.phone && <p>{i.phone}</p>}
            {i.email && <p>{i.email}</p>}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-surface-2 p-2.5 text-center text-xs">
            <Counter icon={FileText} value={i.contractCount ?? 0} label="contrats" />
            <Counter icon={Users} value={i.beneficiaryCount ?? 0} label={tr('ui.InsurancePage.assures')} />
            <Counter icon={ClipboardList} value={i.claimCount ?? 0} label="dossiers" />
          </div>

          <div className="mt-2 rounded-lg bg-surface-2 px-2.5 py-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-content-muted">{tr('ui.InsurancePage.enAttente2')}</span>
              <span className="font-semibold text-warning">{formatCurrency(i.pendingAmount ?? 0)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span className="text-content-muted">{tr('ui.InsurancePage.rembourse')}</span>
              <span className="font-semibold text-success">{formatCurrency(i.refundedAmount ?? 0)}</span>
            </div>
          </div>

          {canUpdate && (
            <button
              onClick={() => onEdit(i)}
              className="btn-outline mt-3 h-8 w-full rounded-lg text-xs"
            >
              <Pencil className="h-3.5 w-3.5" /> {tr('ui.InsurancePage.modifier')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Counter({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof FileText;
  value: number;
  label: string;
}) {
  return (
    <div>
      <Icon className="mx-auto h-3.5 w-3.5 text-content-faint" />
      <p className="mt-0.5 font-display font-bold text-content">{value}</p>
      <p className="text-content-faint">{label}</p>
    </div>
  );
}

function InsurerModal({ insurer, onClose }: { insurer: Insurer | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<InsurerCreateInput>({
    resolver: zodResolver(insurerCreateSchema),
    defaultValues: insurer
      ? {
          name: insurer.name,
          type: insurer.type as InsurerCreateInput['type'],
          coveragePercent: insurer.coveragePercent,
          phone: insurer.phone ?? '',
          email: insurer.email ?? '',
          notes: insurer.notes ?? '',
        }
      : { type: 'HEALTH_INSURANCE', coveragePercent: 80 },
  });

  const mut = useMutation({
    mutationFn: (v: InsurerCreateInput) => (insurer ? updateInsurer(insurer.id, v) : createInsurer(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurers'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={insurer ? tr('ui.InsurancePage.modifierLAssurance') : tr('ui.InsurancePage.nouvelleAssurance')}>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <Field label={tr('ui.InsurancePage.nom')}><input className="input" {...register('name')} />{errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('ui.InsurancePage.type')}>
            <select className="input" {...register('type')}>
              {INSURER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label={tr('ui.InsurancePage.priseEnChargeParDefaut')}>
            <select className="input" {...register('coveragePercent', { valueAsNumber: true })}>
              {Array.from({ length: 101 }, (_, i) => (
                <option key={i} value={i}>
                  {i} %
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="rounded-lg bg-surface-2 p-2.5 text-xs text-content-muted">
          {tr('ui.InsurancePage.ceTauxNeSApplique')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('ui.InsurancePage.telephone')}><input className="input" {...register('phone')} /></Field>
          <Field label="Email"><input className="input" type="email" {...register('email')} /></Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{tr('ui.InsurancePage.annuler')}</Button>
          <Button type="submit" loading={mut.isPending}>{tr('ui.InsurancePage.enregistrer')}</Button>
        </div>
      </form>
    </Modal>
  );
}
