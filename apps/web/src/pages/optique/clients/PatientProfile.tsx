import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CalendarDays,
  Download,
  FileText,
  Glasses,
  History,
  LayoutDashboard,
  MessageCircle,
  NotebookPen,
  Pencil,
  Plus,
  ReceiptText,
  ShoppingCart,
  Stethoscope,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { ageFromBirthDate } from '@oculo/shared-types';
import { getCustomer, updateCustomer, type CustomerDetail } from '../../../features/optique/api';
import { PrescriptionForm } from '../../../features/optique/PrescriptionForm';
import { printClientDossier } from '../../../features/optique/clientDossierDocument';
import type { CompanyInfo } from '../../../features/optique/saleDocument';
import { createPatientFromCustomer } from '../../../features/clinic/api';
import { usePermission, useAuthStore } from '../../../store/auth';
import { usePosStore } from '../../../store/pos';
import { formatCurrency, formatDate, formatDateTime } from '../../../lib/format';
import { apiErrorMessage } from '../../../lib/api';
import { sendWhatsappForStage } from '../../../lib/whatsapp';
import { useToast } from '../../../components/Toast';
import { Avatar } from '../../../components/Avatar';
import { WhatsappSendButton } from '../../../components/WhatsappSendButton';
import { Badge, Button, DropdownMenu, Spinner } from '../../../components/ui';
import { LensOrderRow, PrescriptionCard, RepairRow, SaleRow } from '../ClientRecord';
import { tr } from '../../../lib/tr';

export type ProfileTab = 'overview' | 'prescriptions' | 'purchases' | 'quotes' | 'consultations' | 'appointments' | 'history' | 'notes';

interface TimelineEvent {
  at: string;
  kind: 'sale' | 'quote' | 'rx' | 'lens' | 'repair' | 'consult' | 'appoint' | 'created';
  title: string;
  detail?: string;
}

const KIND_ICON: Record<TimelineEvent['kind'], typeof Glasses> = {
  sale: ShoppingCart,
  quote: FileText,
  rx: Glasses,
  lens: Glasses,
  repair: Wrench,
  consult: Stethoscope,
  appoint: CalendarClock,
  created: Plus,
};

/** Fil chronologique du patient, construit uniquement à partir de ses données réelles. */
function buildTimeline(c: CustomerDetail): TimelineEvent[] {
  const ev: TimelineEvent[] = [];
  for (const s of c.sales) {
    if (s.status === 'CANCELLED') continue;
    const items = s.items.map((i) => i.product.name).join(', ');
    ev.push({
      at: s.createdAt,
      kind: s.type === 'QUOTE' ? 'quote' : 'sale',
      title: s.type === 'QUOTE' ? tr('crm.tlQuote', { n: s.number }) : s.type === 'RETURN' ? tr('crm.tlReturn', { n: s.number }) : tr('crm.tlSale', { n: s.number }),
      detail: [items, formatCurrency(Number(s.totalAmount))].filter(Boolean).join(' · '),
    });
  }
  for (const p of c.prescriptions) {
    ev.push({
      at: p.date,
      kind: 'rx',
      title: tr('crm.tlRx'),
      detail: [p.lensType, p.prescriberName && `${tr('crm.prescriber')} ${p.prescriberName}`].filter(Boolean).join(' · ') || undefined,
    });
  }
  for (const o of c.lensOrders) ev.push({ at: o.createdAt, kind: 'lens', title: tr('crm.tlLens', { n: o.number }), detail: o.description ?? undefined });
  for (const r of c.repairs) ev.push({ at: r.createdAt, kind: 'repair', title: tr('crm.tlRepair', { n: r.number }), detail: r.description });
  for (const k of c.clinic?.consultations ?? []) {
    ev.push({ at: k.date, kind: 'consult', title: tr('crm.tlConsult'), detail: [k.practitionerName, k.diagnosis].filter(Boolean).join(' · ') || undefined });
  }
  for (const a of c.clinic?.appointments ?? []) {
    ev.push({ at: a.scheduledAt, kind: 'appoint', title: tr('crm.tlAppoint'), detail: a.reason ?? undefined });
  }
  if (c.createdAt) ev.push({ at: c.createdAt, kind: 'created', title: tr('crm.tlCreated') });
  return ev.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function PatientProfile({
  customerId,
  initialTab = 'overview',
  startAddingRx = false,
  onClose,
  onEdit,
}: {
  customerId: string;
  initialTab?: ProfileTab;
  startAddingRx?: boolean;
  onClose: () => void;
  onEdit?: (c: CustomerDetail) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const canRx = usePermission('optique.prescriptions.create');
  const canQuote = usePermission('optique.quotes.create');
  const canSell = usePermission('optique.sales.create');
  const canUpdate = usePermission('optique.customers.update');
  const canClinic = usePermission('clinic.patients.create');
  const canConsult = usePermission('clinic.consultations.view');
  const canAppoint = usePermission('clinic.appointments.view');
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [addingRx, setAddingRx] = useState(startAddingRx);
  const [editingRx, setEditingRx] = useState<CustomerDetail['prescriptions'][number] | null>(null);

  const { data: c, isLoading } = useQuery({ queryKey: ['customer', customerId], queryFn: () => getCustomer(customerId) });

  // Échap ferme le panneau, comme une fenêtre.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const company: CompanyInfo = {
    name: user?.tenantName ?? 'OculoSaaS',
    logoUrl: user?.tenantLogoUrl,
    location: user?.tenantLocation,
    contactPhone: user?.tenantContactPhone,
    contactEmail: user?.tenantContactEmail,
    ...user?.tenantInvoiceSettings,
  };

  const timeline = useMemo(() => (c ? buildTimeline(c) : []), [c]);
  const sales = c?.sales.filter((s) => s.type !== 'QUOTE') ?? [];
  const quotes = c?.sales.filter((s) => s.type === 'QUOTE') ?? [];
  const lastVisit = timeline.find((e) => e.kind !== 'created')?.at ?? null;
  const lastSale = sales.find((s) => s.type === 'SALE' && s.status !== 'CANCELLED');
  const lastRx = c?.prescriptions[0];
  const rxExpired = lastRx?.expiresAt ? new Date(lastRx.expiresAt) < new Date() : false;
  const recentlyActive = lastVisit ? Date.now() - new Date(lastVisit).getTime() < 365 * 86_400_000 : false;

  function toPos() {
    const pos = usePosStore.getState();
    pos.clear();
    pos.setCustomer(customerId);
    onClose();
    navigate('/optique/caisse');
  }

  const clinicMut = useMutation({
    mutationFn: () => createPatientFromCustomer(customerId),
    onSuccess: (p) => navigate('/clinique/patients', { state: { openPatientId: p.id } }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const TABS: { id: ProfileTab; label: string; icon: typeof Glasses; count?: number; show: boolean }[] = [
    { id: 'overview', label: tr('crm.tabOverview'), icon: LayoutDashboard, show: true },
    { id: 'prescriptions', label: tr('crm.tabRx'), icon: Glasses, count: c?.prescriptions.length, show: true },
    { id: 'purchases', label: tr('crm.tabPurchases'), icon: ShoppingCart, count: c?.summary?.salesCount ?? sales.length, show: true },
    { id: 'quotes', label: tr('crm.tabQuotes'), icon: FileText, count: c?.summary?.quotesCount ?? quotes.length, show: true },
    { id: 'consultations', label: tr('crm.tabConsult'), icon: Stethoscope, count: c?.clinic?.consultations?.length, show: canConsult },
    { id: 'appointments', label: tr('crm.tabAppoint'), icon: CalendarDays, count: c?.clinic?.appointments?.length, show: canAppoint },
    { id: 'history', label: tr('crm.tabHistory'), icon: History, show: true },
    { id: 'notes', label: tr('crm.tabNotes'), icon: NotebookPen, show: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={tr('crm.patientFile')}>
      <div className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-4xl animate-slide-in-right flex-col bg-bg shadow-card-lg">
        {isLoading || !c ? (
          <div className="grid flex-1 place-items-center">
            <Spinner />
          </div>
        ) : (
          <>
            {/* En-tête : identité + actions principales, toujours visibles. */}
            <header className="border-b bg-surface px-5 pb-0 pt-5 sm:px-6">
              <div className="flex items-start gap-4">
                <Avatar firstName={c.firstName} lastName={c.lastName} className="h-14 w-14 shrink-0 rounded-2xl text-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display text-xl font-bold text-content">
                      {c.firstName} {c.lastName}
                    </h2>
                    <Badge tone={recentlyActive ? 'success' : 'neutral'}>{recentlyActive ? tr('crm.statusActive') : tr('crm.statusInactive')}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-content-muted">
                    <span className="font-mono text-xs text-content-faint">{c.code}</span>
                    {c.phone && <> · {c.phone}</>}
                    {c.email && <> · {c.email}</>}
                  </p>
                  {(() => {
                    const age = ageFromBirthDate(c.dateOfBirth);
                    const bits = [age !== null ? tr('crm.age', { n: age }) : null, c.profession, c.address].filter(Boolean);
                    return bits.length ? <p className="mt-0.5 text-xs text-content-faint">{bits.join(' · ')}</p> : null;
                  })()}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <DropdownMenu
                    items={[
                      ...(canUpdate && onEdit ? [{ label: tr('crm.edit'), icon: Pencil, onClick: () => onEdit(c) }] : []),
                      { label: tr('crm.downloadFile'), icon: Download, onClick: () => printClientDossier(c, company) },
                      ...(canClinic ? [{ label: tr('crm.clinicFile'), icon: Stethoscope, onClick: () => clinicMut.mutate() }] : []),
                    ]}
                  />
                  <button onClick={onClose} className="btn-ghost h-9 w-9 rounded-lg p-0" aria-label={tr('ui.ui.fermer')}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {c.phone && c.phone.replace(/\D/g, '').length >= 6 && (
                  <WhatsappSendButton
                    onSend={(lang) =>
                      sendWhatsappForStage('followup', c.phone, { client: c.firstName, etablissement: user?.tenantName ?? 'OculoSaaS' }, lang)
                    }
                    className="btn-outline h-9 rounded-lg px-3 text-sm text-success"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </WhatsappSendButton>
                )}
                {canQuote && (
                  <Button variant="outline" className="h-9 px-3 text-sm" onClick={toPos}>
                    <FileText className="h-4 w-4" /> {tr('crm.newQuote')}
                  </Button>
                )}
                {canRx && (
                  <Button
                    variant="outline"
                    className="h-9 px-3 text-sm"
                    onClick={() => {
                      setTab('prescriptions');
                      setAddingRx(true);
                    }}
                  >
                    <Glasses className="h-4 w-4" /> {tr('crm.newRx')}
                  </Button>
                )}
                {canSell && (
                  <Button className="h-9 px-3 text-sm" onClick={toPos}>
                    <ShoppingCart className="h-4 w-4" /> {tr('crm.newSale')}
                  </Button>
                )}
              </div>

              <nav className="-mb-px mt-4 flex gap-1 overflow-x-auto" role="tablist">
                {TABS.filter((t) => t.show).map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      tab === t.id ? 'border-primary text-primary' : 'border-transparent text-content-muted hover:text-content'
                    }`}
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                    {t.count ? <span className="rounded-full bg-surface-2 px-1.5 text-[11px] text-content-muted">{t.count}</span> : null}
                  </button>
                ))}
              </nav>
            </header>

            <div key={tab} className="flex-1 animate-fade-in overflow-y-auto px-5 py-5 sm:px-6">
              {tab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <Kpi label={tr('crm.kRegistered')} value={c.createdAt ? formatDate(c.createdAt) : '—'} />
                    <Kpi label={tr('crm.kLastVisit')} value={lastVisit ? formatDate(lastVisit) : '—'} />
                    <Kpi
                      label={tr('crm.kLastPurchase')}
                      value={lastSale ? formatCurrency(Number(lastSale.totalAmount)) : '—'}
                      sub={lastSale ? formatDate(lastSale.createdAt) : undefined}
                    />
                    <Kpi label={tr('crm.kVisits')} value={String(c.summary?.visits ?? timeline.length - 1)} />
                    <Kpi
                      label={tr('crm.kSpent')}
                      value={formatCurrency(c.summary?.totalSpent ?? 0)}
                      sub={c.summary && c.summary.balance > 0 ? tr('crm.kBalance', { v: formatCurrency(c.summary.balance) }) : undefined}
                      icon={Wallet}
                    />
                    <Kpi
                      label={tr('crm.kLastRx')}
                      value={lastRx ? formatDate(lastRx.date) : tr('crm.rxNone')}
                      sub={lastRx ? (rxExpired ? tr('crm.rxExpired') : tr('crm.rxValid')) : undefined}
                      tone={lastRx ? (rxExpired ? 'danger' : 'success') : undefined}
                    />
                  </div>

                  {c.notes && (
                    <div className="rounded-xl border bg-surface p-3 text-sm text-content-muted">
                      <span className="font-semibold text-content">{tr('crm.tabNotes')} : </span>
                      {c.notes}
                    </div>
                  )}

                  <div className="card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold text-content">{tr('crm.recentActivity')}</h3>
                      {timeline.length > 6 && (
                        <button className="text-xs font-semibold text-primary hover:underline" onClick={() => setTab('history')}>
                          {tr('crm.seeAll')}
                        </button>
                      )}
                    </div>
                    <Timeline events={timeline.slice(0, 6)} />
                  </div>
                </div>
              )}

              {tab === 'prescriptions' && (
                <div className="space-y-4">
                  {canRx && !addingRx && !editingRx && (
                    <Button onClick={() => setAddingRx(true)}>
                      <Plus className="h-4 w-4" /> {tr('crm.newRx')}
                    </Button>
                  )}
                  {(addingRx || editingRx) && (
                    <PrescriptionForm
                      customerId={customerId}
                      prescription={editingRx ?? undefined}
                      onClose={() => {
                        setAddingRx(false);
                        setEditingRx(null);
                      }}
                      onSaved={() => {
                        void qc.invalidateQueries({ queryKey: ['customer', customerId] });
                        void qc.invalidateQueries({ queryKey: ['customer-directory'] });
                        toast.success(tr('crm.toastRxSaved'));
                        setAddingRx(false);
                        setEditingRx(null);
                      }}
                    />
                  )}
                  {c.prescriptions.length === 0 ? (
                    <Empty icon={Glasses} text={tr('crm.noRx')} />
                  ) : (
                    c.prescriptions.map((p, i) => (
                      <div key={p.id}>
                        {i === 1 && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-faint">{tr('crm.olderRx')}</p>}
                        <PrescriptionCard
                          rx={p}
                          patient={{ firstName: c.firstName, lastName: c.lastName, phone: c.phone }}
                          company={company}
                          canEdit={canRx}
                          onEdit={() => setEditingRx(p)}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'purchases' && (
                <ListBlock
                  empty={<Empty icon={ShoppingCart} text={tr('crm.noPurchase')} />}
                  items={sales}
                  render={(s) => (
                    <div key={s.id} className="group relative">
                      <SaleRow sale={s} />
                      <button
                        className="mt-1 text-xs font-semibold text-primary opacity-80 hover:underline group-hover:opacity-100"
                        onClick={() => {
                          onClose();
                          navigate('/optique/ventes', { state: { openSaleId: s.id } });
                        }}
                      >
                        {tr('crm.openSale')}
                      </button>
                    </div>
                  )}
                  more={c.summary && c.summary.salesCount > sales.length ? tr('crm.moreInSales', { n: c.summary.salesCount }) : undefined}
                />
              )}

              {tab === 'quotes' && (
                <ListBlock
                  empty={<Empty icon={FileText} text={tr('crm.noQuote')} />}
                  items={quotes}
                  render={(s) => (
                    <div key={s.id}>
                      <SaleRow sale={s} />
                      <button
                        className="mt-1 text-xs font-semibold text-primary hover:underline"
                        onClick={() => {
                          onClose();
                          navigate('/optique/devis', { state: { openSaleId: s.id } });
                        }}
                      >
                        {tr('crm.openQuote')}
                      </button>
                    </div>
                  )}
                />
              )}

              {tab === 'consultations' && (
                <ClinicBlock
                  linked={Boolean(c.clinic)}
                  canCreate={canClinic}
                  onCreate={() => clinicMut.mutate()}
                  loading={clinicMut.isPending}
                  empty={tr('crm.noConsult')}
                  items={c.clinic?.consultations ?? []}
                  render={(k) => (
                    <div key={k.id} className="rounded-xl border bg-surface p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-content">{formatDate(k.date)}</span>
                        {k.lensType && <Badge tone="info">{k.lensType}</Badge>}
                      </div>
                      {k.practitionerName && <p className="text-xs text-content-faint">{k.practitionerName}</p>}
                      {(k.visualAcuityRight || k.visualAcuityLeft) && (
                        <p className="mt-1 text-xs text-content-muted">
                          AV OD {k.visualAcuityRight ?? '—'} · OG {k.visualAcuityLeft ?? '—'}
                        </p>
                      )}
                      {k.diagnosis && <p className="mt-1 text-content-muted">{k.diagnosis}</p>}
                    </div>
                  )}
                />
              )}

              {tab === 'appointments' && (
                <ClinicBlock
                  linked={Boolean(c.clinic)}
                  canCreate={canClinic}
                  onCreate={() => clinicMut.mutate()}
                  loading={clinicMut.isPending}
                  empty={tr('crm.noAppoint')}
                  items={c.clinic?.appointments ?? []}
                  render={(a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-xl border bg-surface p-3 text-sm">
                      <div>
                        <p className="font-medium text-content">{formatDateTime(a.scheduledAt)}</p>
                        {a.reason && <p className="text-xs text-content-muted">{a.reason}</p>}
                      </div>
                      <Badge tone={new Date(a.scheduledAt) > new Date() ? 'info' : 'neutral'}>{a.status}</Badge>
                    </div>
                  )}
                />
              )}

              {tab === 'history' && (
                <div className="space-y-5">
                  <div className="card p-4">
                    <Timeline events={timeline} />
                  </div>
                  {c.lensOrders.length > 0 && (
                    <Group icon={Glasses} title={tr('crm.lensOrders', { n: c.lensOrders.length })}>
                      {c.lensOrders.map((o) => (
                        <LensOrderRow key={o.id} order={o} />
                      ))}
                    </Group>
                  )}
                  {c.repairs.length > 0 && (
                    <Group icon={Wrench} title={tr('crm.repairs', { n: c.repairs.length })}>
                      {c.repairs.map((r) => (
                        <RepairRow key={r.id} repair={r} />
                      ))}
                    </Group>
                  )}
                </div>
              )}

              {tab === 'notes' && <NotesEditor customer={c} canEdit={canUpdate} />}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: typeof Wallet;
  tone?: 'success' | 'danger';
}) {
  return (
    <div className="rounded-xl border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-xs text-content-faint">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </p>
      <p className="mt-1 font-display text-base font-bold text-content">{value}</p>
      {sub && <p className={`text-xs ${tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-content-faint'}`}>{sub}</p>}
    </div>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-content-muted">{tr('crm.noActivity')}</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {events.map((e, i) => {
        const Icon = KIND_ICON[e.kind];
        return (
          <li key={i} className="relative">
            <span className="absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full border bg-surface text-primary">
              <Icon className="h-3 w-3" />
            </span>
            <p className="text-xs text-content-faint">{formatDate(e.at)}</p>
            <p className="text-sm font-medium text-content">{e.title}</p>
            {e.detail && <p className="truncate text-xs text-content-muted">{e.detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function ListBlock<T>({ items, render, empty, more }: { items: T[]; render: (t: T) => ReactNode; empty: ReactNode; more?: string }) {
  if (items.length === 0) return <>{empty}</>;
  return (
    <div className="space-y-2">
      {items.map(render)}
      {more && <p className="pt-2 text-center text-xs text-content-faint">{more}</p>}
    </div>
  );
}

function ClinicBlock<T>({
  linked,
  canCreate,
  onCreate,
  loading,
  items,
  render,
  empty,
}: {
  linked: boolean;
  canCreate: boolean;
  onCreate: () => void;
  loading: boolean;
  items: T[];
  render: (t: T) => ReactNode;
  empty: string;
}) {
  if (!linked) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <Stethoscope className="mx-auto h-8 w-8 text-content-faint" />
        <p className="mt-2 text-sm text-content-muted">{tr('crm.noClinicFile')}</p>
        {canCreate && (
          <Button className="mt-3" variant="outline" loading={loading} onClick={onCreate}>
            <Stethoscope className="h-4 w-4" /> {tr('crm.openClinic')}
          </Button>
        )}
      </div>
    );
  }
  return <ListBlock items={items} render={render} empty={<Empty icon={Stethoscope} text={empty} />} />;
}

function Group({ icon: Icon, title, children }: { icon: typeof Glasses; title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 font-semibold text-content">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Glasses; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed p-8 text-center">
      <Icon className="h-8 w-8 text-content-faint" />
      <p className="mt-2 text-sm text-content-muted">{text}</p>
    </div>
  );
}

function NotesEditor({ customer, canEdit }: { customer: CustomerDetail; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [notes, setNotes] = useState(customer.notes ?? '');
  const mut = useMutation({
    mutationFn: () => updateCustomer(customer.id, { notes }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer', customer.id] });
      toast.success(tr('crm.toastNotes'));
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div className="space-y-3">
      <textarea
        className="input min-h-[220px]"
        value={notes}
        maxLength={1000}
        disabled={!canEdit}
        placeholder={tr('ui.ClientsPage.antecedentsPreferencesDeMontureRemarques')}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-content-faint">{notes.length} / 1000</span>
        {canEdit && (
          <Button loading={mut.isPending} disabled={notes === (customer.notes ?? '')} onClick={() => mut.mutate()}>
            <ReceiptText className="h-4 w-4" /> {tr('ui.ClientsPage.enregistrer')}
          </Button>
        )}
      </div>
    </div>
  );
}
