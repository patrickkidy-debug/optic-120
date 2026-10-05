import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Contact,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Glasses,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  getCustomer,
  getCustomerDirectory,
  type Customer,
  type DirectoryCustomer,
  type DirectorySegment,
  type DirectorySort,
  type DirectoryVisit,
} from '../../features/optique/api';
import { printClientDossier } from '../../features/optique/clientDossierDocument';
import type { CompanyInfo } from '../../features/optique/saleDocument';
import { useAuthStore, usePermission } from '../../store/auth';
import { usePosStore } from '../../store/pos';
import { useUIStore } from '../../store/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { sendWhatsappForStage } from '../../lib/whatsapp';
import { useToast } from '../../components/Toast';
import { Avatar } from '../../components/Avatar';
import { WhatsappSendButton } from '../../components/WhatsappSendButton';
import { Badge, Button, DropdownMenu, EmptyState, type DropdownItem } from '../../components/ui';
import { CustomerFormModal } from './clients/CustomerFormModal';
import { ImportCustomersModal } from './clients/ImportCustomersModal';
import { PatientProfile, type ProfileTab } from './clients/PatientProfile';
import { BirthdaysPanel } from './clients/BirthdaysPanel';
import { tr } from '../../lib/tr';

const PAGE_SIZE = 25;
const SEGMENTS: DirectorySegment[] = ['new', 'active', 'inactive', 'withRx', 'withoutRx', 'withPurchase', 'withoutPurchase', 'followUp'];
const VISITS: DirectoryVisit[] = ['today', '7d', '30d', '3m', 'over6m'];
/** Filtres mutuellement exclusifs : en choisir un retire son contraire. */
const OPPOSITE: Partial<Record<DirectorySegment, DirectorySegment>> = {
  active: 'inactive',
  inactive: 'active',
  withRx: 'withoutRx',
  withoutRx: 'withRx',
  withPurchase: 'withoutPurchase',
  withoutPurchase: 'withPurchase',
};

const hasWhatsapp = (phone?: string | null) => Boolean(phone && phone.replace(/\D/g, '').length >= 6);

/** « il y a 3 j », « il y a 2 mois »… pour lire une date d'un coup d'œil. */
function relative(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return tr('crm.today');
  if (days < 30) return tr('crm.daysAgo', { n: days });
  if (days < 365) return tr('crm.monthsAgo', { n: Math.floor(days / 30) });
  return tr('crm.yearsAgo', { n: Math.floor(days / 365) });
}

export function ClientsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const canCreate = usePermission('optique.customers.create');
  const canUpdate = usePermission('optique.customers.update');
  const canRx = usePermission('optique.prescriptions.create');
  const canQuote = usePermission('optique.quotes.create');
  const canSell = usePermission('optique.sales.create');
  const branchId = useUIStore((st) => st.activeBranchId) ?? undefined;

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [segments, setSegments] = useState<DirectorySegment[]>([]);
  const [visit, setVisit] = useState<DirectoryVisit | ''>('');
  const [sort, setSort] = useState<DirectorySort>('recent');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [formFor, setFormFor] = useState<Customer | null | 'new'>(null);
  const [importing, setImporting] = useState(false);
  const [profile, setProfile] = useState<{ id: string; tab?: ProfileTab; addRx?: boolean } | null>(null);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Recherche instantanée, sans requête à chaque frappe.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, segments, visit, sort, branchId]);
  // « / » place le curseur dans la recherche, comme dans les SaaS de référence.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['customer-directory', branchId, debounced, segments, visit, sort, page],
    queryFn: () => getCustomerDirectory({ search: debounced, branchId, segments, visit: visit || undefined, sort, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.customers ?? [];
  const total = data?.total ?? 0;
  const stats = data?.stats;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtering = Boolean(debounced || segments.length || visit);
  const activeFilters = segments.length + (visit ? 1 : 0);

  function toggleSegment(s: DirectorySegment) {
    setSegments((prev) => {
      if (prev.includes(s)) return prev.filter((x) => x !== s);
      const opp = OPPOSITE[s];
      return [...prev.filter((x) => x !== opp), s];
    });
  }

  function toPos(customerId: string) {
    const pos = usePosStore.getState();
    pos.clear();
    pos.setCustomer(customerId);
    navigate('/optique/caisse');
  }

  const company: CompanyInfo = {
    name: user?.tenantName ?? 'OculoSaaS',
    logoUrl: user?.tenantLogoUrl,
    location: user?.tenantLocation,
    contactPhone: user?.tenantContactPhone,
    contactEmail: user?.tenantContactEmail,
    ...user?.tenantInvoiceSettings,
  };

  async function downloadDossier(id: string) {
    try {
      printClientDossier(await getCustomer(id), company);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  function whatsapp(c: DirectoryCustomer, lang?: 'fr' | 'en') {
    sendWhatsappForStage('followup', c.phone, { client: c.firstName, etablissement: user?.tenantName ?? 'OculoSaaS' }, lang);
  }

  function actionsFor(c: DirectoryCustomer): DropdownItem[] {
    const items: DropdownItem[] = [{ label: tr('crm.viewFile'), icon: Eye, onClick: () => setProfile({ id: c.id }) }];
    if (canUpdate) items.push({ label: tr('crm.edit'), icon: Pencil, onClick: () => setFormFor(c) });
    if (canRx) items.push({ label: tr('crm.newRx'), icon: Glasses, onClick: () => setProfile({ id: c.id, tab: 'prescriptions', addRx: true }) });
    if (canQuote) items.push({ label: tr('crm.newQuote'), icon: FileText, onClick: () => toPos(c.id) });
    if (canSell) items.push({ label: tr('crm.newSale'), icon: ShoppingCart, onClick: () => toPos(c.id) });
    if (hasWhatsapp(c.phone)) items.push({ label: tr('crm.sendWhatsapp'), icon: MessageCircle, onClick: () => whatsapp(c) });
    items.push({ label: tr('crm.downloadFile'), icon: Download, onClick: () => void downloadDossier(c.id) });
    return items;
  }

  /** Export de la sélection courante (filtres compris), toutes pages. */
  async function exportList(kind: 'xlsx' | 'pdf') {
    setExporting(kind);
    try {
      const all: DirectoryCustomer[] = [];
      for (let p = 1; p < 500; p++) {
        const d = await getCustomerDirectory({ search: debounced, branchId, segments, visit: visit || undefined, sort, page: p, pageSize: 100 });
        all.push(...d.customers);
        if (p * 100 >= d.total) break;
      }
      const head = [tr('crm.colId'), tr('crm.firstName'), tr('crm.lastName'), tr('crm.phone'), 'Email', tr('crm.colLastVisit'), tr('crm.colRx'), tr('crm.kSpent'), tr('crm.colStatus'), tr('crm.kRegistered')];
      const body = all.map((c) => [
        c.code,
        c.firstName,
        c.lastName,
        c.phone ?? '',
        c.email ?? '',
        c.lastVisitAt ? formatDate(c.lastVisitAt) : '',
        rxLabel(c.rxStatus),
        c.totalSpent,
        c.active ? tr('crm.statusActive') : tr('crm.statusInactive'),
        c.createdAt ? formatDate(c.createdAt) : '',
      ]);
      if (kind === 'xlsx') {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...body]), 'Clients');
        XLSX.writeFile(wb, `clients-${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else {
        const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const win = window.open('', '_blank', 'width=1000,height=1100');
        if (!win) return toast.error(tr('ui.ClientsPage.veuillezAutoriserLesFenetresPop'));
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(tr('crm.title'))}</title>
          <style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#0f172a;font-size:11px}
          h1{font-size:18px;margin:0}p{color:#64748b;margin:2px 0 12px}table{width:100%;border-collapse:collapse}
          th{background:#7c3aed;color:#fff;text-align:left;padding:6px}td{padding:5px 6px;border-bottom:1px solid #e2e8f0}</style></head>
          <body><h1>${esc(user?.tenantName ?? 'OculoSaaS')} — ${esc(tr('crm.title'))}</h1><p>${esc(formatDate(new Date()))} · ${all.length}</p>
          <table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${body.map((r) => `<tr>${r.map((v, i) => `<td>${esc(i === 7 ? formatCurrency(Number(v)) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
        win.document.close();
        setTimeout(() => win.print(), 400);
      }
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-content">{tr('crm.title')}</h1>
          <p className="mt-1 text-sm text-content-muted">{tr('crm.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu busy={exporting} disabled={total === 0} onExport={(k) => void exportList(k)} />
          {canCreate && (
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4" /> {tr('crm.import')}
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setFormFor('new')}>
              <Plus className="h-4 w-4" /> {tr('crm.newClient')}
            </Button>
          )}
        </div>
      </div>

      {/* Indicateurs : cliquer applique le filtre correspondant. */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Users} label={tr('crm.kpiTotal')} value={stats?.total} hint={stats ? tr('crm.kpiThisMonth', { n: stats.newThisMonth }) : undefined} onClick={() => setSegments([])} active={segments.length === 0 && !visit} />
        <KpiCard icon={Sparkles} label={tr('crm.kpiNew')} value={stats?.newThisMonth} hint={tr('crm.kpiNewHint')} onClick={() => setSegments(['new'])} active={segments.length === 1 && segments[0] === 'new'} />
        <KpiCard icon={UserCheck} label={tr('crm.kpiActive')} value={stats?.active} hint={tr('crm.kpiActiveHint')} onClick={() => setSegments(['active'])} active={segments.length === 1 && segments[0] === 'active'} />
        <KpiCard icon={BellRing} label={tr('crm.kpiFollowUp')} value={stats?.followUp} hint={tr('crm.kpiFollowUpHint')} tone="warning" onClick={() => setSegments(['followUp'])} active={segments.length === 1 && segments[0] === 'followUp'} />
      </div>

      <BirthdaysPanel branchId={branchId} onOpen={(id) => setProfile({ id })} />

      {/* Recherche + filtres */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            ref={searchRef}
            className="input pl-9 pr-16"
            placeholder={tr('crm.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={tr('crm.searchPlaceholder')}
          />
          {search ? (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-content-faint hover:text-content" onClick={() => setSearch('')} aria-label={tr('crm.clear')}>
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border px-1.5 text-[10px] text-content-faint sm:block">/</kbd>
          )}
        </div>
        <Button variant={showFilters || activeFilters ? 'primary' : 'outline'} onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" /> {tr('crm.filters')}
          {activeFilters > 0 && <span className="rounded-full bg-white/25 px-1.5 text-xs">{activeFilters}</span>}
        </Button>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as DirectorySort)} aria-label={tr('crm.sort')}>
          <option value="recent">{tr('crm.sortRecent')}</option>
          <option value="visit">{tr('crm.sortVisit')}</option>
          <option value="name">{tr('crm.sortName')}</option>
          <option value="spent">{tr('crm.sortSpent')}</option>
        </select>
      </div>

      {showFilters && (
        <div className="card mb-3 animate-fade-in space-y-3 p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-faint">{tr('crm.segment')}</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={segments.length === 0} onClick={() => setSegments([])}>
                {tr('crm.segAll')}
              </Chip>
              {SEGMENTS.map((s) => (
                <Chip key={s} on={segments.includes(s)} onClick={() => toggleSegment(s)}>
                  {tr(`crm.seg_${s}`)}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-faint">{tr('crm.lastVisit')}</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={!visit} onClick={() => setVisit('')}>
                {tr('crm.anyTime')}
              </Chip>
              {VISITS.map((v) => (
                <Chip key={v} on={visit === v} onClick={() => setVisit(visit === v ? '' : v)}>
                  {tr(`crm.visit_${v}`)}
                </Chip>
              ))}
            </div>
          </div>
          {activeFilters > 0 && (
            <button
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => {
                setSegments([]);
                setVisit('');
              }}
            >
              {tr('crm.resetFilters')}
            </button>
          )}
        </div>
      )}

      {/* Résultats */}
      {isError ? (
        <EmptyState icon={Contact} title={tr('crm.loadError')} hint={tr('crm.loadErrorHint')} action={<Button variant="outline" onClick={() => void refetch()}>{tr('crm.retry')}</Button>} />
      ) : isLoading ? (
        <SkeletonList />
      ) : rows.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={Search}
            title={tr('crm.noResult')}
            hint={tr('crm.noResultHint')}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setSegments([]);
                  setVisit('');
                }}
              >
                {tr('crm.resetFilters')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Contact}
            title={tr('crm.noClient')}
            hint={tr('crm.noClientHint')}
            action={
              canCreate && (
                <Button onClick={() => setFormFor('new')}>
                  <Plus className="h-4 w-4" /> {tr('crm.addClient')}
                </Button>
              )
            }
          />
        )
      ) : (
        <div className={`card transition-opacity ${isFetching ? 'opacity-70' : ''}`}>
          {/* Tableau : tablette et ordinateur. Les colonnes secondaires
              apparaissent quand la largeur le permet. */}
          <table className="hidden w-full md:table">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-content-faint">
                <th className="table-cell font-semibold">{tr('crm.colPatient')}</th>
                <th className="table-cell hidden font-semibold xl:table-cell">{tr('crm.colContact')}</th>
                <th className="table-cell font-semibold">{tr('crm.colLastVisit')}</th>
                <th className="table-cell font-semibold">{tr('crm.colRx')}</th>
                <th className="table-cell hidden font-semibold lg:table-cell">{tr('crm.colLastPurchase')}</th>
                <th className="table-cell font-semibold">{tr('crm.colStatus')}</th>
                <th className="table-cell w-24 text-right font-semibold">
                  <span className="sr-only">{tr('crm.colActions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="group cursor-pointer border-b transition-colors last:border-0 hover:bg-primary-soft/40"
                  onClick={() => setProfile({ id: c.id })}
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <Avatar firstName={c.firstName} lastName={c.lastName} className="h-9 w-9 shrink-0 rounded-full text-xs" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-content group-hover:text-primary">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="font-mono text-[11px] text-content-faint">
                          {c.code}
                          <span className="font-sans xl:hidden">{c.phone ? ` · ${c.phone}` : ''}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell hidden text-sm xl:table-cell">
                    <p className="text-content">{c.phone ?? '—'}</p>
                    <p className="max-w-[200px] truncate text-xs text-content-faint">{c.email ?? ''}</p>
                  </td>
                  <td className="table-cell text-sm">
                    {c.lastVisitAt ? (
                      <>
                        <p className="text-content">{formatDate(c.lastVisitAt)}</p>
                        <p className="text-xs text-content-faint">{relative(c.lastVisitAt)}</p>
                      </>
                    ) : (
                      <span className="text-content-faint">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <RxBadge status={c.rxStatus} />
                  </td>
                  <td className="table-cell hidden text-sm lg:table-cell">
                    {c.lastPurchase ? (
                      <>
                        <p className="font-medium text-content">{formatCurrency(c.lastPurchase.total)}</p>
                        <p className="max-w-[180px] truncate text-xs text-content-faint">{c.lastPurchase.label ?? c.lastPurchase.number}</p>
                      </>
                    ) : (
                      <span className="text-content-faint">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={c.active ? 'success' : 'neutral'}>{c.active ? tr('crm.statusActive') : tr('crm.statusInactive')}</Badge>
                      {c.followUp && <span className="text-[11px] font-medium text-warning">{tr('crm.toFollowUp')}</span>}
                    </div>
                  </td>
                  <td className="table-cell text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {hasWhatsapp(c.phone) && (
                        <WhatsappSendButton onSend={(lang) => whatsapp(c, lang)} className="btn-ghost h-8 rounded-lg px-2 text-xs text-success" title={tr('crm.sendWhatsapp')}>
                          <MessageCircle className="h-4 w-4" />
                        </WhatsappSendButton>
                      )}
                      <DropdownMenu items={actionsFor(c)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cartes : mobile. */}
          <ul className="divide-y md:hidden">
            {rows.map((c) => (
              <li key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar firstName={c.firstName} lastName={c.lastName} className="h-10 w-10 shrink-0 rounded-full text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-content">
                        {c.firstName} {c.lastName}
                      </p>
                      <Badge tone={c.active ? 'success' : 'neutral'}>{c.active ? tr('crm.statusActive') : tr('crm.statusInactive')}</Badge>
                    </div>
                    <p className="text-sm text-content-muted">{c.phone ?? '—'}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-content-faint">
                      {c.lastVisitAt ? `${tr('crm.lastVisit')} : ${formatDate(c.lastVisitAt)}` : tr('crm.noVisit')}
                      <span>·</span>
                      <span>{tr('crm.colRx')} :</span>
                      <RxBadge status={c.rxStatus} />
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="outline" className="h-9 flex-1 text-sm" onClick={() => setProfile({ id: c.id })}>
                    <Eye className="h-4 w-4" /> {tr('crm.viewFile')}
                  </Button>
                  {hasWhatsapp(c.phone) && (
                    <WhatsappSendButton onSend={(lang) => whatsapp(c, lang)} className="btn-outline h-9 rounded-lg px-3 text-success">
                      <MessageCircle className="h-4 w-4" />
                    </WhatsappSendButton>
                  )}
                  <DropdownMenu items={actionsFor(c)} />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
            <span className="text-content-muted">
              {tr('crm.showing', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total })}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-content-faint">
                  {page} / {pageCount}
                </span>
                <Button variant="outline" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={tr('crm.prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} aria-label={tr('crm.next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {formFor && (
        <CustomerFormModal
          customer={formFor === 'new' ? null : formFor}
          onClose={() => setFormFor(null)}
          onAddPrescription={(c) => {
            setFormFor(null);
            setProfile({ id: c.id, tab: 'prescriptions', addRx: true });
          }}
          onCreateQuote={(c) => {
            setFormFor(null);
            toPos(c.id);
          }}
        />
      )}
      {importing && <ImportCustomersModal onClose={() => setImporting(false)} />}
      {profile && (
        <PatientProfile
          key={profile.id + (profile.tab ?? '')}
          customerId={profile.id}
          initialTab={profile.tab}
          startAddingRx={profile.addRx}
          onClose={() => setProfile(null)}
          onEdit={(c) => setFormFor(c)}
        />
      )}
    </div>
  );
}

function rxLabel(s: DirectoryCustomer['rxStatus']): string {
  return s === 'valid' ? tr('crm.rxValid') : s === 'expired' ? tr('crm.rxExpired') : tr('crm.rxNone');
}

function RxBadge({ status }: { status: DirectoryCustomer['rxStatus'] }) {
  if (status === 'none') return <span className="text-xs text-content-faint">{tr('crm.rxNone')}</span>;
  return <Badge tone={status === 'valid' ? 'success' : 'danger'}>{rxLabel(status)}</Badge>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  value?: number;
  hint?: string;
  tone?: 'warning';
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card-lg ${active ? 'ring-2 ring-primary/40' : ''}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-content-muted">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone === 'warning' ? 'bg-[color:var(--warning)]/15 text-warning' : 'bg-primary-soft text-primary'}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {value === undefined ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-surface-2" />
      ) : (
        <p className="mt-1 font-display text-2xl font-bold text-content">{value.toLocaleString()}</p>
      )}
      {hint && <p className="mt-0.5 text-xs text-content-faint">{hint}</p>}
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg px-2.5 py-1.5 text-sm transition ${on ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'}`}
    >
      {children}
    </button>
  );
}

function ExportMenu({ busy, disabled, onExport }: { busy: 'xlsx' | 'pdf' | null; disabled: boolean; onExport: (k: 'xlsx' | 'pdf') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button variant="outline" loading={Boolean(busy)} disabled={disabled} onClick={() => setOpen((v) => !v)}>
        <Download className="h-4 w-4" /> {tr('crm.export')}
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 animate-fade-in rounded-xl border bg-surface p-1 shadow-card-md">
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2" onClick={() => { setOpen(false); onExport('xlsx'); }}>
            <FileSpreadsheet className="h-4 w-4 text-success" /> Excel (.xlsx)
          </button>
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2" onClick={() => { setOpen(false); onExport('pdf'); }}>
            <Printer className="h-4 w-4" /> PDF
          </button>
        </div>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="card divide-y">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 p-4">
          <div className="h-9 w-9 rounded-full bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 rounded bg-surface-2" />
            <div className="h-2.5 w-24 rounded bg-surface-2" />
          </div>
          <div className="hidden h-3 w-24 rounded bg-surface-2 md:block" />
          <div className="hidden h-5 w-16 rounded-full bg-surface-2 md:block" />
        </div>
      ))}
    </div>
  );
}
