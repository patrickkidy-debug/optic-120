import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  Glasses,
  Plus,
  Printer,
  Receipt,
  Search,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';
import type { ConsultationCreateInput } from '@oculo/shared-types';
import { lensBaseOptions, lensLabel, DEFAULT_LENS_PRICING } from '@oculo/shared-types';
import {
  listConsultations,
  createConsultation,
  listPatients,
  prepareConsultationBilling,
  type Consultation,
} from '../../features/clinic/api';
import { printMedicalPrescription } from '../../features/clinic/clinicDocument';
import type { CompanyInfo } from '../../features/optique/saleDocument';
import { usePermission, useAuthStore } from '../../store/auth';
import { usePosStore } from '../../store/pos';
import { useUIStore } from '../../store/ui';
import { apiErrorMessage } from '../../lib/api';
import { currencySymbol, formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { Avatar } from '../../components/Avatar';
import { Badge, Button, DropdownMenu, EmptyState, Field, Modal, PageLoader } from '../../components/ui';
import { tr } from '../../lib/tr';

type Period = 'all' | 'today' | '7d' | '30d';
const DAY = 86_400_000;
const ACUITY = ['10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10', '2/10', '1/10', '1/20', 'CLD', 'VBLM', 'PL+'];
const PRICE_KEY = 'oculo_consult_price';

function useCompany(): CompanyInfo {
  const user = useAuthStore((s) => s.user);
  return {
    name: user?.tenantName ?? 'OculoSaaS',
    logoUrl: user?.tenantLogoUrl,
    location: user?.tenantLocation,
    contactPhone: user?.tenantContactPhone,
    contactEmail: user?.tenantContactEmail,
    ...user?.tenantInvoiceSettings,
  };
}

/** Réfraction lisible : « -1.25 (-0.50 × 90°) Add +2.00 ». */
function composeRefraction(r: { sph: string; cyl: string; axe: string; add: string }): string {
  const sign = (v: string) => {
    const t = v.trim().replace(',', '.');
    if (!t) return '';
    return /^[+-]/.test(t) || Number(t) === 0 ? t : `+${t}`;
  };
  const parts: string[] = [];
  if (r.sph.trim()) parts.push(sign(r.sph));
  if (r.cyl.trim()) parts.push(`(${sign(r.cyl)}${r.axe.trim() ? ` × ${r.axe.trim().replace(/°$/, '')}°` : ''})`);
  if (r.add.trim()) parts.push(`Add ${sign(r.add)}`);
  return parts.join(' ');
}

export function ConsultationsPage() {
  const canCreate = usePermission('clinic.consultations.create');
  const canBill = usePermission('optique.sales.create');
  const company = useCompany();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Consultation | null>(null);
  const [billing, setBilling] = useState<Consultation | null>(null);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const { data, isLoading } = useQuery({ queryKey: ['consultations'], queryFn: () => listConsultations() });

  const now = Date.now();
  const startToday = new Date().setHours(0, 0, 0, 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const all = data ?? [];
  const stats = useMemo(() => {
    const month = all.filter((c) => new Date(c.date).getTime() >= monthStart);
    return {
      today: all.filter((c) => new Date(c.date).getTime() >= startToday).length,
      month: month.length,
      withRx: month.filter((c) => c.refractionRight || c.refractionLeft || c.prescription).length,
      patients: new Set(month.map((c) => c.patientId)).size,
    };
  }, [all, monthStart, startToday]);

  const list = all.filter((c) => {
    const t = new Date(c.date).getTime();
    if (period === 'today' && t < startToday) return false;
    if (period === '7d' && t < now - 7 * DAY) return false;
    if (period === '30d' && t < now - 30 * DAY) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const hay = `${c.patient?.firstName ?? ''} ${c.patient?.lastName ?? ''} ${c.diagnosis ?? ''} ${c.practitionerName ?? ''}`.toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  });

  const print = (c: Consultation) =>
    printMedicalPrescription(
      c,
      { firstName: c.patient?.firstName ?? '', lastName: c.patient?.lastName ?? '', dateOfBirth: c.patient?.dateOfBirth ?? null, phone: c.patient?.phone ?? null },
      company,
    );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-content">{tr('consult.title')}</h1>
          <p className="mt-1 text-sm text-content-muted">{tr('consult.subtitle')}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {tr('ui.ConsultationsPage.nouvelleConsultation')}
          </Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={CalendarDays} label={tr('consult.kToday')} value={data ? stats.today : undefined} />
        <Kpi icon={Activity} label={tr('consult.kMonth')} value={data ? stats.month : undefined} />
        <Kpi icon={Glasses} label={tr('consult.kRx')} value={data ? stats.withRx : undefined} hint={tr('consult.kMonthHint')} />
        <Kpi icon={Users} label={tr('consult.kPatients')} value={data ? stats.patients : undefined} hint={tr('consult.kMonthHint')} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input className="input pl-9" placeholder={tr('consult.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1" role="group">
          {(['all', 'today', '7d', '30d'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-2 text-sm transition ${period === p ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted hover:text-content'}`}
            >
              {tr(`consult.p_${p}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={all.length === 0 ? tr('ui.ConsultationsPage.aucuneConsultation') : tr('consult.noResult')}
          hint={all.length === 0 ? tr('consult.emptyHint') : undefined}
          action={
            canCreate && all.length === 0 && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> {tr('ui.ConsultationsPage.nouvelleConsultation')}
              </Button>
            )
          }
        />
      ) : (
        <div className="card">
          <ul className="divide-y">
            {list.map((c) => (
              <li key={c.id} className="group flex cursor-pointer flex-wrap items-center gap-4 px-4 py-3 transition-colors hover:bg-primary-soft/40" onClick={() => setDetail(c)}>
                <Avatar firstName={c.patient?.firstName} lastName={c.patient?.lastName} className="h-10 w-10 shrink-0 rounded-full text-xs" />
                <div className="min-w-[180px] flex-1">
                  <p className="font-medium text-content group-hover:text-primary">
                    {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : '—'}
                  </p>
                  <p className="text-xs text-content-faint">
                    {formatDateTime(c.date)}
                    {c.practitionerName && ` · ${c.practitionerName}`}
                  </p>
                </div>
                <div className="hidden min-w-[150px] text-xs md:block">
                  <p className="text-content-faint">{tr('consult.acuity')}</p>
                  <p className="font-medium text-content">
                    OD {c.visualAcuityRight || '—'} · OG {c.visualAcuityLeft || '—'}
                  </p>
                </div>
                <div className="hidden min-w-[160px] flex-1 lg:block">
                  {c.diagnosis ? <Badge tone="info">{c.diagnosis}</Badge> : <span className="text-xs text-content-faint">{tr('consult.noDiagnosis')}</span>}
                  {c.lensType && <p className="mt-1 truncate text-xs text-content-muted">{c.lensType}</p>}
                </div>
                <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => print(c)} title={tr('consult.printRx')}>
                    <Printer className="h-4 w-4" />
                  </Button>
                  {canBill && (
                    <Button variant="outline" className="h-8 px-2.5 text-xs" onClick={() => setBilling(c)}>
                      <Receipt className="h-3.5 w-3.5" /> {tr('consult.bill')}
                    </Button>
                  )}
                  <DropdownMenu
                    items={[
                      { label: tr('consult.view'), icon: Eye, onClick: () => setDetail(c) },
                      { label: tr('consult.printRx'), icon: Printer, onClick: () => print(c) },
                      ...(canBill ? [{ label: tr('consult.bill'), icon: Receipt, onClick: () => setBilling(c) }] : []),
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <NewConsultationModal
          onClose={() => setOpen(false)}
          onPrint={print}
          onBill={canBill ? (c) => { setOpen(false); setBilling(c); } : undefined}
        />
      )}
      {detail && (
        <ConsultationDetail
          c={detail}
          onClose={() => setDetail(null)}
          onPrint={() => print(detail)}
          onBill={canBill ? () => { setBilling(detail); setDetail(null); } : undefined}
        />
      )}
      {billing && <BillConsultationModal c={billing} onClose={() => setBilling(null)} />}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value?: number; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-content-muted">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {value === undefined ? <div className="mt-2 h-7 w-12 animate-pulse rounded bg-surface-2" /> : <p className="mt-1 font-display text-2xl font-bold text-content">{value}</p>}
      {hint && <p className="text-xs text-content-faint">{hint}</p>}
    </div>
  );
}

/* --------------------------- Nouvelle consultation --------------------------- */

function NewConsultationModal({
  onClose,
  onPrint,
  onBill,
}: {
  onClose: () => void;
  onPrint: (c: Consultation) => void;
  onBill?: (c: Consultation) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Consultation | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;
  const lensOptions = lensBaseOptions(pricing);
  const { data: patients } = useQuery({ queryKey: ['patients', ''], queryFn: () => listPatients() });
  const [od, setOd] = useState({ sph: '', cyl: '', axe: '', add: '' });
  const [og, setOg] = useState({ sph: '', cyl: '', axe: '', add: '' });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ConsultationCreateInput>({
    defaultValues: { practitionerName: user ? `${user.firstName} ${user.lastName}` : '' },
  });
  const patientId = watch('patientId');
  const filtered = (patients ?? []).filter((p) =>
    `${p.firstName} ${p.lastName} ${p.phone ?? ''}`.toLowerCase().includes(patientSearch.trim().toLowerCase()),
  );

  const mut = useMutation({
    mutationFn: (v: ConsultationCreateInput) =>
      createConsultation({ ...v, refractionRight: composeRefraction(od), refractionLeft: composeRefraction(og) }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['consultations'] });
      toast.success(tr('consult.saved'));
      const p = patients?.find((x) => x.id === c.patientId);
      setSaved({ ...c, patient: p ? { firstName: p.firstName, lastName: p.lastName, customerId: p.customerId, phone: p.phone, dateOfBirth: p.dateOfBirth } : undefined });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (saved) {
    return (
      <Modal open onClose={onClose} title={tr('ui.ConsultationsPage.nouvelleConsultation')} size="sm">
        <div className="py-2 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 font-display text-lg font-bold text-content">{tr('consult.saved')}</p>
          <p className="mt-1 text-sm text-content-muted">{tr('consult.nextStep')}</p>
          <div className="mt-5 grid gap-2">
            <Button onClick={() => onPrint(saved)}>
              <Printer className="h-4 w-4" /> {tr('consult.printRx')}
            </Button>
            {onBill && (
              <Button variant="outline" onClick={() => onBill(saved)}>
                <Receipt className="h-4 w-4" /> {tr('consult.billLong')}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {tr('crm.close')}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={tr('ui.ConsultationsPage.nouvelleConsultation')} size="lg">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-5" noValidate>
        <Section icon={UserRound} title={tr('consult.secPatient')}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <span className="label">
                Patient <span className="text-danger">*</span>
              </span>
              <input className="input mb-2" placeholder={tr('consult.searchPatient')} value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
              <select className="input" size={Math.min(5, Math.max(2, filtered.length))} {...register('patientId', { required: true })}>
                {filtered.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                    {p.phone ? ` — ${p.phone}` : ''}
                  </option>
                ))}
              </select>
              {errors.patientId && <p className="mt-1 text-xs text-danger">{tr('consult.errPatient')}</p>}
              {patients && patients.length === 0 && <p className="mt-1 text-xs text-content-faint">{tr('consult.noPatientHint')}</p>}
            </div>
            <div className="space-y-3">
              <Field label={tr('consult.practitioner')}>
                <input className="input" placeholder={tr('consult.practitionerPh')} {...register('practitionerName')} />
              </Field>
              <Field label={tr('consult.date')}>
                <input className="input" type="date" defaultValue={new Date().toISOString().slice(0, 10)} {...register('date')} />
              </Field>
              {patientId && <p className="text-xs text-success">✓ {tr('consult.patientSelected')}</p>}
            </div>
          </div>
        </Section>

        <Section icon={Eye} title={tr('consult.secExam')}>
          <datalist id="acuity-list">
            {ACUITY.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label={tr('ui.ConsultationsPage.acuiteVisuelleOd')}>
              <input className="input" list="acuity-list" placeholder="10/10" {...register('visualAcuityRight')} />
            </Field>
            <Field label={tr('ui.ConsultationsPage.acuiteVisuelleOg')}>
              <input className="input" list="acuity-list" placeholder="10/10" {...register('visualAcuityLeft')} />
            </Field>
            <Field label={tr('ui.ConsultationsPage.tonometrieOd')}>
              <input className="input" placeholder="mmHg" {...register('tonometryRight')} />
            </Field>
            <Field label={tr('ui.ConsultationsPage.tonometrieOg')}>
              <input className="input" placeholder="mmHg" {...register('tonometryLeft')} />
            </Field>
          </div>
        </Section>

        <Section icon={Glasses} title={tr('consult.secRefraction')}>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-[11px] uppercase tracking-wider text-content-faint">
                  <th className="px-3 py-2 text-left font-semibold">{tr('doc.eye')}</th>
                  <th className="px-2 py-2 font-semibold">{tr('doc.sphere')}</th>
                  <th className="px-2 py-2 font-semibold">{tr('doc.cylinder')}</th>
                  <th className="px-2 py-2 font-semibold">{tr('doc.axis')}</th>
                  <th className="px-2 py-2 font-semibold">{tr('doc.addition')}</th>
                </tr>
              </thead>
              <tbody>
                {([['OD', od, setOd], ['OG', og, setOg]] as const).map(([eye, val, set]) => (
                  <tr key={eye} className="border-t">
                    <td className="px-3 py-2 font-semibold text-content">{eye}</td>
                    {(['sph', 'cyl', 'axe', 'add'] as const).map((k) => (
                      <td key={k} className="px-1.5 py-1.5">
                        <input
                          className="input h-9 text-center"
                          inputMode="decimal"
                          placeholder={k === 'axe' ? '0–180' : '±0.00'}
                          value={val[k]}
                          onChange={(e) => set({ ...val, [k]: e.target.value })}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(composeRefraction(od) || composeRefraction(og)) && (
            <p className="mt-2 text-xs text-content-muted">
              OD : <b>{composeRefraction(od) || '—'}</b> · OG : <b>{composeRefraction(og) || '—'}</b>
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={tr('ui.ConsultationsPage.typeDeVerresRecommande')}>
              <select className="input" {...register('lensType')}>
                <option value="">{tr('ui.ConsultationsPage.aucun')}</option>
                {lensOptions.map((b) => {
                  const label = lensLabel(pricing, b.key, []);
                  return (
                    <option key={b.key} value={label}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label={tr('ui.ConsultationsPage.diagnostic')}>
              <input className="input" placeholder={tr('consult.diagnosisPh')} {...register('diagnosis')} />
            </Field>
          </div>
        </Section>

        <Section icon={FileText} title={tr('consult.secNotes')}>
          <textarea className="input min-h-[70px]" placeholder={tr('consult.notesPh')} {...register('prescription')} />
        </Section>

        {error && <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tr('ui.ConsultationsPage.annuler')}
          </Button>
          <Button type="submit" loading={mut.isPending}>
            {tr('ui.ConsultationsPage.enregistrer')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Eye; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-content-faint">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
      </h3>
      {children}
    </section>
  );
}

/* ------------------------------ Fiche consultation ------------------------------ */

function ConsultationDetail({ c, onClose, onPrint, onBill }: { c: Consultation; onClose: () => void; onPrint: () => void; onBill?: () => void }) {
  const row = (label: string, od?: string | null, og?: string | null) =>
    od || og ? (
      <tr className="border-t">
        <td className="py-2 pr-3 text-content-muted">{label}</td>
        <td className="py-2 text-center font-medium text-content">{od || '—'}</td>
        <td className="py-2 text-center font-medium text-content">{og || '—'}</td>
      </tr>
    ) : null;
  return (
    <Modal open onClose={onClose} title={tr('consult.detailTitle')} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-4">
          <Avatar firstName={c.patient?.firstName} lastName={c.patient?.lastName} className="h-12 w-12 rounded-2xl text-sm" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-content">{c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : '—'}</p>
            <p className="text-sm text-content-muted">
              {formatDate(c.date)}
              {c.practitionerName && ` · ${c.practitionerName} (${tr('doc.optometrist')})`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onPrint}>
              <Printer className="h-4 w-4" /> {tr('consult.printRx')}
            </Button>
            {onBill && (
              <Button onClick={onBill}>
                <Receipt className="h-4 w-4" /> {tr('consult.bill')}
              </Button>
            )}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-content-faint">
              <th className="py-1 text-left font-semibold">{tr('doc.exam')}</th>
              <th className="py-1 font-semibold">OD</th>
              <th className="py-1 font-semibold">OG</th>
            </tr>
          </thead>
          <tbody>
            {row(tr('doc.visualAcuity'), c.visualAcuityRight, c.visualAcuityLeft)}
            {row(tr('doc.refraction'), c.refractionRight, c.refractionLeft)}
            {row(tr('doc.iop'), c.tonometryRight, c.tonometryLeft)}
          </tbody>
        </table>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label={tr('ui.ConsultationsPage.diagnostic')} value={c.diagnosis} />
          <Info label={tr('ui.ConsultationsPage.typeDeVerresRecommande')} value={c.lensType} />
        </div>
        <Info label={tr('consult.secNotes')} value={c.prescription} multiline />
      </div>
    </Modal>
  );
}

function Info({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-content-faint">{label}</p>
      <p className={`mt-0.5 text-sm text-content ${multiline ? 'whitespace-pre-line' : ''}`}>{value || '—'}</p>
    </div>
  );
}

/* ------------------------------ Facturation ------------------------------ */

/**
 * Facture une consultation (client qui ne prend pas de lunettes) : prépare la
 * fiche client et la prestation, puis ouvre la caisse avec la ligne prête.
 * L'encaissement suit le circuit normal (moyen de paiement, reçu, session).
 */
function BillConsultationModal({ c, onClose }: { c: Consultation; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const branchId = useUIStore((s) => s.activeBranchId);
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState(tr('consult.defaultLabel'));
  useEffect(() => {
    try {
      const last = localStorage.getItem(PRICE_KEY);
      if (last) setAmount(last);
    } catch {
      /* stockage indisponible */
    }
  }, []);
  const value = Number(amount.replace(/\s/g, '').replace(',', '.'));
  const mut = useMutation({
    mutationFn: () => {
      if (!branchId) throw new Error(tr('ui.ClientsPage.selectionnezUnMagasinAvantDe'));
      return prepareConsultationBilling(c.id, { branchId, amount: value, label });
    },
    onSuccess: (r) => {
      try {
        localStorage.setItem(PRICE_KEY, String(value));
      } catch {
        /* stockage indisponible */
      }
      const pos = usePosStore.getState();
      pos.clear();
      pos.setCustomer(r.customerId);
      pos.addLine({ productId: r.product.id, name: label, sku: r.product.sku, unitPrice: value });
      pos.setUnitPrice(r.product.id, value);
      toast.success(tr('consult.toPos'));
      navigate('/optique/caisse');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={tr('consult.billTitle')} size="sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <p className="font-semibold text-content">{c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : '—'}</p>
          <p className="text-content-muted">{tr('consult.billOf', { date: formatDate(c.date) })}</p>
        </div>
        <Field label={tr('consult.billLabel')}>
          <input className="input" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label={`${tr('consult.billAmount')} (${currencySymbol()})`}>
          <input className="input text-right text-lg font-semibold" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        {value > 0 && <p className="text-right text-sm text-content-muted">{formatCurrency(value)}</p>}
        <p className="text-xs text-content-faint">{tr('consult.billHint')}</p>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" onClick={onClose}>
            {tr('ui.ConsultationsPage.annuler')}
          </Button>
          <Button disabled={!(value > 0) || !label.trim()} loading={mut.isPending} onClick={() => mut.mutate()}>
            <Receipt className="h-4 w-4" /> {tr('consult.billGo')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
