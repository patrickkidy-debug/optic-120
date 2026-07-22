import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Glasses, CircleDot, Package, Frame, Tag, MessageCircle, type LucideIcon } from 'lucide-react';
import type { LensOrderStatus, LensOrderCategory, SaleWaStage } from '@oculo/shared-types';
import {
  LENS_ORDER_STATUSES,
  LENS_ORDER_CATEGORIES,
  DEFAULT_LENS_PRICING,
  lensBaseOptions,
  lensBaseLabel,
  lensBasePrice,
} from '@oculo/shared-types';
import { listLensOrders, createLensOrder, setLensOrderStatus, listCustomers, type LensOrder } from '../../features/optique/api';
import { apiErrorMessage } from '../../lib/api';
import { sendWhatsappForStage } from '../../lib/whatsapp';
import { usePermission, useAuthStore } from '../../store/auth';
import { PageHeader, Button, Field, Modal, Badge, PageLoader, EmptyState } from '../../components/ui';

const STATUS: Record<LensOrderStatus, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
  ORDERED: { label: 'Commandé', tone: 'info' },
  RECEIVED: { label: 'Reçu', tone: 'warning' },
  MOUNTED: { label: 'Monté', tone: 'warning' },
  DELIVERED: { label: 'Livré', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

/** Étape du message WhatsApp selon le statut de la commande. */
const STAGE_FOR_STATUS: Partial<Record<LensOrderStatus, SaleWaStage>> = {
  ORDERED: 'lens_ordered',
  RECEIVED: 'lens_ready',
  MOUNTED: 'lens_ready',
  DELIVERED: 'lens_delivered',
};

const LENS_CAT: Record<LensOrderCategory, { label: string; icon: LucideIcon }> = {
  VERRES: { label: 'Verres', icon: Glasses },
  LENTILLES: { label: 'Lentilles de contact', icon: CircleDot },
  ACCESSOIRE: { label: 'Accessoire', icon: Package },
  MONTURE: { label: 'Monture', icon: Frame },
  AUTRE: { label: 'Autre', icon: Tag },
};

/* Configurateur de verres. Les PRIX viennent des tarifs de la boutique
   (user.tenantLensPricing, sinon barème par défaut) : ici on ne garde que les
   libellés. L'indice reste un multiplicateur physique, non modifiable. */
const LENS_INDEX = [
  { id: '1.5', label: '1.5 (standard)', mult: 1 },
  { id: '1.6', label: '1.6 (aminci)', mult: 1.3 },
  { id: '1.67', label: '1.67 (extra-aminci)', mult: 1.7 },
  { id: '1.74', label: '1.74 (ultra-aminci)', mult: 2.2 },
] as const;
const TREATMENTS = [
  { id: 'ar', label: 'Anti-reflet' },
  { id: 'blue', label: 'Anti-lumière bleue' },
  { id: 'photo', label: 'Photochromique' },
  { id: 'hard', label: 'Durci anti-rayures' },
] as const;

function formatDate(v?: string | null) {
  return v ? new Date(v).toLocaleDateString('fr-FR') : '—';
}
function fcfa(n: number) {
  return `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
}

const DAY = 24 * 60 * 60 * 1000;
function daysBetween(a: string | number | Date, b: string | number | Date) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY));
}

/** Délai de livraison : temps réel une fois livré, ou attente en cours (retard signalé). */
function DelayCell({ order }: { order: LensOrder }) {
  if (order.deliveredAt) {
    return (
      <span className="font-medium text-success">
        Livré en {daysBetween(order.createdAt, order.deliveredAt)} j
      </span>
    );
  }
  if (order.status === 'CANCELLED') return <span className="text-content-faint">—</span>;
  const late =
    order.expectedAt && Date.now() > new Date(order.expectedAt).getTime()
      ? daysBetween(order.expectedAt, Date.now())
      : 0;
  if (late > 0) return <span className="font-medium text-danger">Retard {late} j</span>;
  return <span className="text-content-muted">En cours {daysBetween(order.createdAt, Date.now())} j</span>;
}

function CatIcon({ category }: { category: string | null }) {
  const def = category ? LENS_CAT[category as LensOrderCategory] : undefined;
  if (!def) return null;
  const Icon = def.icon;
  return <Icon className="h-4 w-4 shrink-0 text-primary" />;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-4 w-1 rounded-full bg-primary" />
      <h4 className="text-xs font-bold uppercase tracking-wide text-content-muted">{children}</h4>
    </div>
  );
}

export function LensOrdersPage() {
  const qc = useQueryClient();
  const canManage = usePermission('optique.sales.create');
  const tenantName = useAuthStore((s) => s.user?.tenantName) ?? 'OculoSaaS';
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['lens-orders'], queryFn: () => listLensOrders() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['lens-orders'] });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LensOrderStatus }) => setLensOrderStatus(id, status),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Commandes de verres"
        subtitle="Suivi des commandes au laboratoire / fournisseur"
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Nouvelle commande
            </Button>
          )
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Glasses} title="Aucune commande de verres" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">N°</th>
                <th className="table-cell font-semibold">Client</th>
                <th className="table-cell font-semibold">Article</th>
                <th className="table-cell font-semibold">Fournisseur</th>
                <th className="table-cell font-semibold">Échéance</th>
                <th className="table-cell font-semibold">Délai livraison</th>
                <th className="table-cell font-semibold">Statut</th>
                <th className="table-cell text-right font-semibold">Prévenir</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell font-medium text-content">{o.number}</td>
                  <td className="table-cell text-content-muted">
                    {o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : '—'}
                  </td>
                  <td className="table-cell text-content-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <CatIcon category={o.category} />
                      {o.description}
                    </span>
                  </td>
                  <td className="table-cell text-content-muted">{o.supplierName ?? '—'}</td>
                  <td className="table-cell text-content-muted">{formatDate(o.expectedAt)}</td>
                  <td className="table-cell"><DelayCell order={o} /></td>
                  <td className="table-cell">
                    {canManage ? (
                      <select
                        className="input h-8 py-0 text-xs"
                        value={o.status}
                        onChange={(e) => statusMut.mutate({ id: o.id, status: e.target.value as LensOrderStatus })}
                      >
                        {LENS_ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS[s].label}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
                    )}
                  </td>
                  <td className="table-cell text-right">
                    {o.customer?.phone && STAGE_FOR_STATUS[o.status] && (
                      <button
                        onClick={() =>
                          sendWhatsappForStage(STAGE_FOR_STATUS[o.status]!, o.customer?.phone, {
                            client: o.customer?.firstName ?? '',
                            etablissement: tenantName,
                            numero: o.number,
                          })
                        }
                        className="btn-outline h-8 rounded-lg px-2.5 text-xs text-success"
                        title="Prévenir le client par WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <LensOrderModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); invalidate(); }} />}
    </div>
  );
}

function LensOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [category, setCategory] = useState<LensOrderCategory>('VERRES');
  const [customerId, setCustomerId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  // Champs libres (catégories autres que Verres).
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  // Configurateur (Verres).
  const [ltype, setLtype] = useState<string>('progressif');
  const [lindex, setLindex] = useState<(typeof LENS_INDEX)[number]['id']>('1.6');
  const [treats, setTreats] = useState<string[]>(['ar']);
  const [error, setError] = useState('');

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => listCustomers() });
  // Tarifs propres à la boutique (sinon barème par défaut).
  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;

  const isVerres = category === 'VERRES';
  const typeOptions = lensBaseOptions(pricing);
  const typeLabel = lensBaseLabel(pricing, ltype);
  const indexDef = LENS_INDEX.find((i) => i.id === lindex)!;
  const treatLabels = TREATMENTS.filter((t) => treats.includes(t.id)).map((t) => t.label);
  const treatSum = TREATMENTS.filter((t) => treats.includes(t.id)).reduce(
    (s, t) => s + (pricing[t.id] ?? 0),
    0,
  );
  const configPrice = Math.round((lensBasePrice(pricing, ltype) * indexDef.mult + treatSum) * 2); // paire
  const configDesc =
    `Verres ${typeLabel.toLowerCase()} indice ${lindex}` +
    (treatLabels.length ? ` — ${treatLabels.join(', ')}` : '') +
    ' (paire)';

  const finalDescription = isVerres ? configDesc : description.trim();
  const finalCost = isVerres ? configPrice : Number(cost) || undefined;
  const canSubmit = finalDescription.length >= 2;

  const toggle = (id: string) =>
    setTreats((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const mut = useMutation({
    mutationFn: () =>
      createLensOrder({
        customerId: customerId || '',
        category,
        description: finalDescription,
        supplierName: supplierName || undefined,
        expectedAt: expectedAt || undefined,
        cost: finalCost,
        notes: notes || undefined,
      }),
    onSuccess: onCreated,
    onError: (e) => setError(apiErrorMessage(e, 'Création impossible')),
  });

  return (
    <Modal open onClose={onClose} title="Nouvelle commande" size="lg">
      <div className="space-y-5">
        {/* Type d'article — grandes cartes */}
        <div>
          <p className="mb-2 text-sm font-medium text-content">Type d'article</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {LENS_ORDER_CATEGORIES.map((c) => {
              const Icon = LENS_CAT[c].icon;
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition ${
                    active ? 'border-primary bg-primary-soft shadow-card' : 'border-line hover:border-primary/50'
                  }`}
                >
                  <Icon className={`h-6 w-6 ${active ? 'text-primary' : 'text-content-muted'}`} />
                  <span className="text-[11px] font-medium leading-tight text-content">{LENS_CAT[c].label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Informations générales */}
        <div className="space-y-3">
          <SectionTitle>Informations générales</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Client (optionnel)">
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— Aucun —</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </Field>
            <Field label="Fournisseur / labo">
              <input className="input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            </Field>
            <Field label="Échéance">
              <input className="input" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Configuration selon le type */}
        {isVerres ? (
          <div className="space-y-3">
            <SectionTitle>Configuration des verres</SectionTitle>
            <div>
              <span className="label">Type de verre</span>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((t) => {
                  const active = ltype === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setLtype(t.key)}
                      className={`rounded-xl border p-3 text-sm transition ${
                        active ? 'border-primary bg-primary-soft text-content' : 'border-line text-content-muted'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Indice (amincissement)">
              <select className="input" value={lindex} onChange={(e) => setLindex(e.target.value as typeof lindex)}>
                {LENS_INDEX.map((i) => (
                  <option key={i.id} value={i.id}>{i.label}</option>
                ))}
              </select>
            </Field>
            <div>
              <span className="label">Traitements</span>
              <div className="grid grid-cols-2 gap-2">
                {TREATMENTS.map((t) => (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                      treats.includes(t.id) ? 'border-primary bg-primary-soft text-content' : 'border-line text-content-muted'
                    }`}
                  >
                    <input type="checkbox" checked={treats.includes(t.id)} onChange={() => toggle(t.id)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-4">
              <div className="text-sm text-content-muted">{configDesc}</div>
              <div className="mt-1 font-display text-2xl font-extrabold text-gradient">{fcfa(configPrice)}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <SectionTitle>Détail</SectionTitle>
            <Field label="Description">
              <input
                className="input"
                placeholder="Ex : Lentilles mensuelles, étui, cordon…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Coût (FCFA)">
              <input
                className="input"
                type="number"
                min={0}
                placeholder="Prix"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
          </div>
        )}

        <Field label="Notes">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={!canSubmit}>
            Créer la commande
          </Button>
        </div>
      </div>
    </Modal>
  );
}
