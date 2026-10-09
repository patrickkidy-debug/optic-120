import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Truck,
  Pencil,
  Globe,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Search,
  Clock,
  Wallet,
  PackageCheck,
  Glasses,
  Archive,
  ArchiveRestore,
  ExternalLink,
  FileText,
} from 'lucide-react';
import {
  LENS_ORDER_STATUS_LABELS,
  SUPPLIER_CATEGORIES,
  supplierCreateSchema,
  waLangsForCountry,
  fillWaTemplate,
  type LensOrderStatus,
  type SupplierCreateInput,
  type WaMessageLang,
} from '@oculo/shared-types';
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  getSupplierActivity,
  type Supplier,
} from '../../features/management/api';
import { usePermission, useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, EmptyState } from '../../components/ui';
import { tr } from '../../lib/tr';
import { trFr } from '../../lib/sharedLabels';

const digits = (p?: string | null) => (p ?? '').replace(/\D/g, '');
const waNumber = (s: Supplier) => digits(s.whatsapp) || digits(s.phone);

export function SuppliersPage() {
  const canCreate = usePermission('suppliers.create');
  const canUpdate = usePermission('suppliers.update');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<Supplier | null>(null);
  const [writeTo, setWriteTo] = useState<Supplier | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'ALL' | 'LOCAL' | 'INTERNATIONAL'>('ALL');
  const [category, setCategory] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  const all = data ?? [];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((s) => {
      if (!showArchived && s.isActive === false) return false;
      if (type !== 'ALL' && s.type !== type) return false;
      if (category && !(s.categories ?? []).includes(category)) return false;
      if (!q) return true;
      return [s.name, s.contactName, s.phone, s.whatsapp, s.email, s.city, s.country].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [all, search, type, category, showArchived]);

  const active = all.filter((s) => s.isActive !== false);
  const openOrders = active.reduce((n, s) => n + (s.stats?.openLensOrders ?? 0), 0);
  const receptions = active.reduce((n, s) => n + (s.stats?.receptions ?? 0), 0);

  const openForm = (s: Supplier | null) => {
    setEditing(s);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr('ui.SuppliersPage.fournisseurs')}
        subtitle={tr('ui.SuppliersPage.partenairesLocauxEtInternationaux')}
        actions={
          canCreate && (
            <Button onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" /> {tr('ui.SuppliersPage.nouveauFournisseur')}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Kpi icon={Truck} label={tr('sup.kpiActive')} value={active.length} />
        <Kpi icon={Glasses} label={tr('sup.kpiOpenOrders')} value={openOrders} tone={openOrders > 0 ? 'warning' : undefined} />
        <Kpi icon={PackageCheck} label={tr('sup.kpiReceptions')} value={receptions} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input className="input pl-9" placeholder={tr('sup.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="inline-flex rounded-xl bg-surface-2 p-1">
          {(['ALL', 'LOCAL', 'INTERNATIONAL'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${type === t ? 'bg-surface text-content shadow-sm' : 'text-content-muted'}`}
            >
              {t === 'ALL' ? tr('sup.all') : t === 'LOCAL' ? tr('ui.SuppliersPage.local') : tr('ui.SuppliersPage.international')}
            </button>
          ))}
        </div>
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={tr('sup.categories')}>
          <option value="">{tr('sup.allCategories')}</option>
          {SUPPLIER_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{tr(`sup.cat.${c.key}`)}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-content-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          {tr('sup.showArchived')}
        </label>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState icon={Truck} title={all.length ? tr('sup.noMatch') : tr('ui.SuppliersPage.aucunFournisseur')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((s) => (
            <SupplierCard
              key={s.id}
              s={s}
              canUpdate={canUpdate}
              onOpen={() => setDetail(s)}
              onEdit={() => openForm(s)}
              onWrite={() => setWriteTo(s)}
            />
          ))}
        </div>
      )}

      {formOpen && <SupplierModal supplier={editing} onClose={() => setFormOpen(false)} />}
      {detail && (
        <SupplierDetail
          s={all.find((x) => x.id === detail.id) ?? detail}
          canUpdate={canUpdate}
          onClose={() => setDetail(null)}
          onEdit={(s) => openForm(s)}
          onWrite={(s) => setWriteTo(s)}
        />
      )}
      {writeTo && <WhatsappComposer s={writeTo} onClose={() => setWriteTo(null)} />}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Truck; label: string; value: number; tone?: 'warning' }) {
  return (
    <div className="card flex min-w-0 items-center gap-3 p-3 sm:p-4">
      <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid ${tone === 'warning' ? 'bg-[color:var(--warning)]/15 text-warning' : 'bg-primary-soft text-primary'}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-bold text-content">{value}</p>
        <p className="line-clamp-2 text-[11px] leading-tight text-content-muted sm:text-xs">{label}</p>
      </div>
    </div>
  );
}

function ContactButtons({ s, onWrite, size = 'sm' }: { s: Supplier; onWrite: () => void; size?: 'sm' | 'md' }) {
  const h = size === 'md' ? 'h-9 px-3 text-sm' : 'h-8 px-2.5 text-xs';
  return (
    <div className="flex flex-wrap gap-1.5">
      {waNumber(s) && (
        <button type="button" onClick={onWrite} className={`btn-outline rounded-lg text-success ${h}`}>
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </button>
      )}
      {s.phone && (
        <a href={`tel:${s.phone}`} className={`btn-outline rounded-lg ${h}`}>
          <Phone className="h-4 w-4" /> {tr('sup.call')}
        </a>
      )}
      {s.email && (
        <a href={`mailto:${s.email}`} className={`btn-outline rounded-lg ${h}`}>
          <Mail className="h-4 w-4" /> Email
        </a>
      )}
    </div>
  );
}

function SupplierCard({
  s,
  canUpdate,
  onOpen,
  onEdit,
  onWrite,
}: {
  s: Supplier;
  canUpdate: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onWrite: () => void;
}) {
  const place = [s.city, s.country].filter(Boolean).join(', ');
  return (
    <div className={`card flex flex-col p-5 ${s.isActive === false ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft font-display text-sm font-bold text-primary">
          {s.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="block max-w-full truncate text-left font-display font-bold text-content hover:text-primary">
            {s.name}
          </button>
          <p className="truncate text-sm text-content-muted">{s.contactName || '—'}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={s.type === 'INTERNATIONAL' ? 'accent' : 'info'}>
            {s.type === 'INTERNATIONAL' ? tr('ui.SuppliersPage.international') : tr('ui.SuppliersPage.local')}
          </Badge>
          {s.isActive === false && <Badge tone="neutral">{tr('sup.archived')}</Badge>}
        </div>
      </div>

      {(s.categories?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {s.categories!.map((c) => (
            <span key={c} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-content-muted">{tr(`sup.cat.${c}`)}</span>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-1 text-xs text-content-muted">
        {(s.whatsapp || s.phone) && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" /> {s.whatsapp || s.phone}</p>}
        {s.email && <p className="flex min-w-0 items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{s.email}</span></p>}
        {place && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /> {place}</p>}
        {(s.deliveryDays != null || s.paymentTerms) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {s.deliveryDays != null && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {tr('sup.deliveryIn', { n: s.deliveryDays })}</span>}
            {s.paymentTerms && <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> {s.paymentTerms}</span>}
          </p>
        )}
      </div>

      {s.stats && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-surface-2/60 p-2.5 text-xs">
          <div>
            <p className={`font-display text-base font-bold ${s.stats.openLensOrders ? 'text-warning' : 'text-content'}`}>{s.stats.openLensOrders}</p>
            <p className="text-content-faint">{tr('sup.openOrders')}</p>
          </div>
          <div>
            <p className="font-display text-base font-bold text-content">{s.stats.receptions}</p>
            <p className="truncate text-content-faint">
              {s.stats.lastReceptionAt ? tr('sup.lastReception', { date: formatDate(s.stats.lastReceptionAt) }) : tr('sup.receptions')}
            </p>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <ContactButtons s={s} onWrite={onWrite} />
        <div className="flex gap-1">
          <button type="button" onClick={onOpen} className="btn-ghost h-8 rounded-lg px-2.5 text-xs">
            <FileText className="h-4 w-4" /> {tr('sup.file')}
          </button>
          {canUpdate && (
            <button type="button" onClick={onEdit} className="btn-ghost h-8 w-8 rounded-lg p-0" aria-label={tr('ui.SuppliersPage.modifier')}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplierDetail({
  s,
  canUpdate,
  onClose,
  onEdit,
  onWrite,
}: {
  s: Supplier;
  canUpdate: boolean;
  onClose: () => void;
  onEdit: (s: Supplier) => void;
  onWrite: (s: Supplier) => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'orders' | 'receptions'>('orders');
  const { data, isLoading } = useQuery({ queryKey: ['supplier-activity', s.id], queryFn: () => getSupplierActivity(s.id) });
  const archive = useMutation({
    mutationFn: () => updateSupplier(s.id, { isActive: s.isActive === false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const info: [string, React.ReactNode][] = [
    [tr('sup.contact'), s.contactName],
    [tr('ui.SuppliersPage.telephone'), s.phone],
    ['WhatsApp', s.whatsapp],
    ['Email', s.email],
    [tr('sup.website'), s.website ? (
      <a href={/^https?:\/\//.test(s.website) ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
        {s.website} <ExternalLink className="h-3 w-3" />
      </a>
    ) : null],
    [tr('ui.SuppliersPage.adresse'), [s.address, s.city, s.country].filter(Boolean).join(', ')],
    [tr('sup.deliveryDays'), s.deliveryDays != null ? tr('sup.days', { n: s.deliveryDays }) : null],
    [tr('sup.paymentTerms'), s.paymentTerms],
  ];

  return (
    <Modal open onClose={onClose} title={s.name} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={s.type === 'INTERNATIONAL' ? 'accent' : 'info'}>
              {s.type === 'INTERNATIONAL' ? tr('ui.SuppliersPage.international') : tr('ui.SuppliersPage.local')}
            </Badge>
            {s.isActive === false && <Badge tone="neutral">{tr('sup.archived')}</Badge>}
            {(s.categories ?? []).map((c) => (
              <span key={c} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-content-muted">{tr(`sup.cat.${c}`)}</span>
            ))}
          </div>
          {canUpdate && (
            <div className="flex gap-1.5">
              <Button variant="outline" className="h-9 px-3 text-sm" onClick={() => onEdit(s)}>
                <Pencil className="h-4 w-4" /> {tr('ui.SuppliersPage.modifier')}
              </Button>
              <Button
                variant="ghost"
                className="h-9 px-3 text-sm"
                loading={archive.isPending}
                onClick={() => (s.isActive === false || confirm(tr('sup.archiveConfirm'))) && archive.mutate()}
              >
                {s.isActive === false ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                {s.isActive === false ? tr('sup.restore') : tr('sup.archive')}
              </Button>
            </div>
          )}
        </div>

        <ContactButtons s={s} onWrite={() => onWrite(s)} size="md" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <dl className="space-y-2 rounded-xl border p-3 text-sm">
            {info.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] uppercase tracking-wide text-content-faint">{k}</dt>
                <dd className="break-words text-content">{v}</dd>
              </div>
            ))}
            {s.notes && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-content-faint">{tr('sup.notes')}</dt>
                <dd className="whitespace-pre-wrap text-content-muted">{s.notes}</dd>
              </div>
            )}
          </dl>

          <div className="min-w-0 rounded-xl border">
            <div className="flex gap-1 border-b p-1.5">
              {([
                ['orders', Glasses, tr('sup.tabOrders'), data?.lensOrders.length],
                ['receptions', PackageCheck, tr('sup.tabReceptions'), data?.receptions.length],
              ] as const).map(([k, Icon, label, n]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-primary-soft text-primary' : 'text-content-muted hover:text-content'}`}
                >
                  <Icon className="h-4 w-4" /> {label} {n != null && <span className="text-xs opacity-70">({n})</span>}
                </button>
              ))}
            </div>
            <div className="max-h-[50vh] overflow-auto">
              {isLoading ? (
                <PageLoader />
              ) : tab === 'orders' ? (
                !data?.lensOrders.length ? (
                  <p className="p-4 text-sm text-content-muted">{tr('sup.noOrders')}</p>
                ) : (
                  <ul className="divide-y">
                    {data.lensOrders.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-content">{o.number}</p>
                          <p className="truncate text-content-muted">{o.description}</p>
                          <p className="text-[11px] text-content-faint">
                            {o.customer ? `${o.customer.firstName} ${o.customer.lastName} · ` : ''}
                            {formatDate(o.createdAt)}
                            {o.expectedAt ? ` → ${formatDate(o.expectedAt)}` : ''}
                          </p>
                        </div>
                        <Badge tone={o.status === 'DELIVERED' ? 'success' : o.status === 'CANCELLED' ? 'neutral' : 'warning'}>
                          {trFr(LENS_ORDER_STATUS_LABELS[o.status as LensOrderStatus] ?? o.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )
              ) : !data?.receptions.length ? (
                <p className="p-4 text-sm text-content-muted">{tr('sup.noReceptions')}</p>
              ) : (
                <ul className="divide-y">
                  {data.receptions.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-content">{r.productName}</p>
                        <p className="text-[11px] text-content-faint">{r.sku} · {formatDate(r.createdAt)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-content">+{r.quantity}</p>
                        {r.unitCost != null && <p className="text-[11px] text-content-faint">{formatCurrency(r.unitCost)} / u</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Message WhatsApp au fournisseur ---------------- */

type SupTpl = 'quote' | 'order' | 'followup' | 'invoice' | 'free';

/** Modèles par langue du FOURNISSEUR (un labo international écrit souvent en anglais). */
const SUP_TEMPLATES: Record<WaMessageLang, Record<SupTpl, string>> = {
  fr: {
    quote: 'Bonjour {contact},\n\nIci *{etablissement}*. Pourriez-vous nous faire parvenir votre meilleure offre (prix et délai de livraison) pour :\n- \n\nMerci d’avance.',
    order: 'Bonjour {contact},\n\nIci *{etablissement}*. Nous souhaitons passer la commande suivante :\n- \n\nMerci de nous confirmer la disponibilité et la date de livraison.',
    followup: 'Bonjour {contact},\n\nIci *{etablissement}*. Nous faisons le point sur notre commande *{numero}* ({description}), passée le {date}.\nPourriez-vous nous indiquer où elle en est et sa date de livraison prévue ?\n\nMerci.',
    invoice: 'Bonjour {contact},\n\nIci *{etablissement}*. Pourriez-vous nous transmettre la facture ou le relevé de nos derniers achats ?\n\nMerci.',
    free: 'Bonjour {contact},\n\nIci *{etablissement}*. ',
  },
  en: {
    quote: 'Hello {contact},\n\nThis is *{etablissement}*. Could you please send us your best offer (price and delivery time) for:\n- \n\nThank you in advance.',
    order: 'Hello {contact},\n\nThis is *{etablissement}*. We would like to place the following order:\n- \n\nPlease confirm availability and the delivery date.',
    followup: 'Hello {contact},\n\nThis is *{etablissement}*. We are following up on our order *{numero}* ({description}), placed on {date}.\nCould you let us know its status and expected delivery date?\n\nThank you.',
    invoice: 'Hello {contact},\n\nThis is *{etablissement}*. Could you please send us the invoice or statement for our latest purchases?\n\nThank you.',
    free: 'Hello {contact},\n\nThis is *{etablissement}*. ',
  },
  pt: {
    quote: 'Olá {contact},\n\nFala a *{etablissement}*. Poderia enviar-nos a sua melhor proposta (preço e prazo de entrega) para:\n- \n\nObrigado desde já.',
    order: 'Olá {contact},\n\nFala a *{etablissement}*. Gostaríamos de fazer a seguinte encomenda:\n- \n\nPor favor confirme a disponibilidade e a data de entrega.',
    followup: 'Olá {contact},\n\nFala a *{etablissement}*. Estamos a acompanhar a nossa encomenda *{numero}* ({description}), feita em {date}.\nPoderia indicar-nos o estado e a data de entrega prevista?\n\nObrigado.',
    invoice: 'Olá {contact},\n\nFala a *{etablissement}*. Poderia enviar-nos a fatura ou o extrato das nossas últimas compras?\n\nObrigado.',
    free: 'Olá {contact},\n\nFala a *{etablissement}*. ',
  },
};

function WhatsappComposer({ s, onClose }: { s: Supplier; onClose: () => void }) {
  const user = useAuthStore((st) => st.user);
  const tenantLang = waLangsForCountry(user?.tenantCountryCode)[0] ?? 'fr';
  const [lang, setLang] = useState<WaMessageLang>(tenantLang);
  const [tpl, setTpl] = useState<SupTpl>('quote');
  const [orderId, setOrderId] = useState('');
  const { data } = useQuery({ queryKey: ['supplier-activity', s.id], queryFn: () => getSupplierActivity(s.id) });
  const openOrders = (data?.lensOrders ?? []).filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
  const order = openOrders.find((o) => o.id === orderId) ?? openOrders[0];

  const build = (t: SupTpl, l: WaMessageLang) =>
    fillWaTemplate(SUP_TEMPLATES[l][t], {
      contact: s.contactName ?? '',
      etablissement: user?.tenantName ?? '',
      numero: order?.number ?? '',
      description: order?.description ?? '',
      date: order ? formatDate(order.createdAt) : '',
    });
  const [text, setText] = useState(() => build('quote', lang));
  const regen = (t: SupTpl, l: WaMessageLang) => setText(build(t, l));

  const number = waNumber(s);
  function send() {
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    onClose();
  }

  const TPLS: SupTpl[] = ['quote', 'order', 'followup', 'invoice', 'free'];
  return (
    <Modal open onClose={onClose} title={tr('sup.writeTitle', { name: s.name })} size="lg">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {TPLS.map((t) => (
            <button
              key={t}
              type="button"
              disabled={t === 'followup' && openOrders.length === 0}
              onClick={() => { setTpl(t); regen(t, lang); }}
              className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-40 ${tpl === t ? 'border-primary bg-primary-soft text-primary' : 'text-content-muted hover:border-primary/50'}`}
            >
              {tr(`sup.tpl.${t}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-content-muted">
            {tr('sup.language')}
            <select className="input h-9 w-auto" value={lang} onChange={(e) => { const l = e.target.value as WaMessageLang; setLang(l); regen(tpl, l); }}>
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
            </select>
          </label>
          {tpl === 'followup' && openOrders.length > 0 && (
            <select
              className="input h-9 min-w-0 flex-1"
              value={order?.id ?? ''}
              onChange={(e) => {
                setOrderId(e.target.value);
                const o = openOrders.find((x) => x.id === e.target.value);
                setText(fillWaTemplate(SUP_TEMPLATES[lang].followup, {
                  contact: s.contactName ?? '',
                  etablissement: user?.tenantName ?? '',
                  numero: o?.number ?? '',
                  description: o?.description ?? '',
                  date: o ? formatDate(o.createdAt) : '',
                }));
              }}
            >
              {openOrders.map((o) => (
                <option key={o.id} value={o.id}>{o.number} — {o.description}</option>
              ))}
            </select>
          )}
        </div>
        <textarea className="input min-h-[180px] resize-y text-sm" value={text} onChange={(e) => setText(e.target.value)} />
        <p className="text-xs text-content-faint">{tr('sup.writeHint', { number: s.whatsapp || s.phone || '' })}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tr('ui.SuppliersPage.annuler')}</Button>
          <Button onClick={send} disabled={!number || !text.trim()}>
            <MessageCircle className="h-4 w-4" /> {tr('sup.openWhatsapp')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Formulaire ---------------- */

function SupplierModal({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SupplierCreateInput>({
    resolver: zodResolver(supplierCreateSchema),
    defaultValues: supplier
      ? {
          name: supplier.name,
          type: supplier.type as SupplierCreateInput['type'],
          contactName: supplier.contactName ?? '',
          phone: supplier.phone ?? '',
          whatsapp: supplier.whatsapp ?? '',
          email: supplier.email ?? '',
          address: supplier.address ?? '',
          city: supplier.city ?? '',
          country: supplier.country ?? '',
          website: supplier.website ?? '',
          paymentTerms: supplier.paymentTerms ?? '',
          deliveryDays: supplier.deliveryDays ?? null,
          categories: supplier.categories ?? [],
          notes: supplier.notes ?? '',
        }
      : { type: 'LOCAL', categories: [], deliveryDays: null },
  });
  const cats = watch('categories') ?? [];

  const mut = useMutation({
    mutationFn: (v: SupplierCreateInput) => (supplier ? updateSupplier(supplier.id, v) : createSupplier(v)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={supplier ? tr('ui.SuppliersPage.modifierLeFournisseur') : tr('ui.SuppliersPage.nouveauFournisseur')} size="lg">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
          <Field label={tr('ui.SuppliersPage.nom')}>
            <input className="input" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-danger">{trFr(errors.name.message)}</p>}
          </Field>
          <Field label={tr('ui.SuppliersPage.type')}>
            <select className="input" {...register('type')}>
              <option value="LOCAL">{tr('ui.SuppliersPage.local')}</option>
              <option value="INTERNATIONAL">{tr('ui.SuppliersPage.international')}</option>
            </select>
          </Field>
        </div>

        <div>
          <p className="label">{tr('sup.categories')}</p>
          <div className="flex flex-wrap gap-1.5">
            {SUPPLIER_CATEGORIES.map((c) => {
              const on = cats.includes(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setValue('categories', on ? cats.filter((x) => x !== c.key) : [...cats, c.key])}
                  className={`rounded-lg border px-2.5 py-1 text-sm transition ${on ? 'border-primary bg-primary-soft text-primary' : 'text-content-muted hover:border-primary/50'}`}
                >
                  {tr(`sup.cat.${c.key}`)}
                </button>
              );
            })}
          </div>
        </div>

        <fieldset className="grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-content-faint">{tr('sup.contactBlock')}</legend>
          <Field label={tr('sup.contact')}><input className="input" {...register('contactName')} /></Field>
          <Field label={tr('ui.SuppliersPage.telephone')}><input className="input" inputMode="tel" {...register('phone')} /></Field>
          <Field label={tr('sup.whatsappField')}><input className="input" inputMode="tel" placeholder={tr('sup.whatsappPh')} {...register('whatsapp')} /></Field>
          <Field label="Email">
            <input className="input" type="email" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-danger">{trFr(errors.email.message)}</p>}
          </Field>
          <Field label={tr('sup.website')}><input className="input" placeholder="www…" {...register('website')} /></Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-content-faint">{tr('sup.addressBlock')}</legend>
          <div className="sm:col-span-3"><Field label={tr('ui.SuppliersPage.adresse')}><input className="input" {...register('address')} /></Field></div>
          <Field label={tr('sup.city')}><input className="input" {...register('city')} /></Field>
          <Field label={tr('sup.country')}><input className="input" {...register('country')} /></Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-content-faint">{tr('sup.termsBlock')}</legend>
          <Field label={tr('sup.deliveryDays')}>
            <input
              className="input"
              inputMode="numeric"
              {...register('deliveryDays', { setValueAs: (v) => (v === '' || v == null ? null : Number(String(v).replace(/\D/g, '')) || 0) })}
            />
          </Field>
          <Field label={tr('sup.paymentTerms')}><input className="input" placeholder={tr('sup.paymentTermsPh')} {...register('paymentTerms')} /></Field>
          <div className="sm:col-span-2"><Field label={tr('sup.notes')}><textarea className="input min-h-[70px]" {...register('notes')} /></Field></div>
        </fieldset>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{tr('ui.SuppliersPage.annuler')}</Button>
          <Button type="submit" loading={mut.isPending}>{tr('ui.SuppliersPage.enregistrer')}</Button>
        </div>
      </form>
    </Modal>
  );
}
