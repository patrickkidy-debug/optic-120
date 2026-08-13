import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Glasses,
  Plus,
  Printer,
  Pencil,
  ReceiptText,
  FileText,
  Star,
  Eye,
  Wrench,
  ChevronDown,
  ChevronUp,
  History,
} from 'lucide-react';
import { ageFromBirthDate, LENS_ORDER_BOARD_STATUSES, LENS_ORDER_STATUS_LABELS, type LensOrderStatus, type RepairStatus } from '@oculo/shared-types';
import {
  getCustomer,
  type Prescription,
  type CustomerSale,
  type CustomerLensOrder,
  type CustomerRepair,
} from '../../features/optique/api';
import { PrescriptionForm } from '../../features/optique/PrescriptionForm';
import { printPrescription, type PrescriptionPatient } from '../../features/optique/prescriptionDocument';
import type { CompanyInfo } from '../../features/optique/saleDocument';
import { usePermission, useAuthStore } from '../../store/auth';
import { usePosStore } from '../../store/pos';
import { formatDate, formatCurrency } from '../../lib/format';
import { Modal, Button, Badge, PageLoader } from '../../components/ui';

const SALE_TYPE_LABEL: Record<string, string> = { SALE: 'Vente', QUOTE: 'Devis', RETURN: 'Retour' };

const REPAIR_STATUS: Record<RepairStatus, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
  RECEIVED: { label: 'Reçu', tone: 'info' },
  IN_PROGRESS: { label: 'En cours', tone: 'warning' },
  READY: { label: 'Prêt', tone: 'success' },
  DELIVERED: { label: 'Livré', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

/** Ton de badge pour une commande de verres, cohérent avec le Kanban. */
function lensOrderTone(status: LensOrderStatus): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
  if (status === 'CANCELLED') return 'danger';
  if (status === 'READY' || status === 'DELIVERED') return 'success';
  const idx = (LENS_ORDER_BOARD_STATUSES as readonly string[]).indexOf(status);
  return idx >= 3 ? 'warning' : 'info';
}

export function ClientRecord({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canCreate = usePermission('optique.prescriptions.create');
  const canQuote = usePermission('optique.quotes.create');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Prescription | null>(null);
  const [showAllRx, setShowAllRx] = useState(false);

  const company: CompanyInfo = {
    name: user?.tenantName ?? 'OculoSaaS',
    logoUrl: user?.tenantLogoUrl,
    location: user?.tenantLocation,
    contactPhone: user?.tenantContactPhone,
    contactEmail: user?.tenantContactEmail,
    ...user?.tenantInvoiceSettings,
  };

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

  // Les deux ordonnances les plus récentes sont toujours visibles ; le reste
  // de l'historique se déplie au besoin (dossier complet sans surcharger l'écran).
  const recentRx = customer?.prescriptions.slice(0, 2) ?? [];
  const olderRx = customer?.prescriptions.slice(2) ?? [];

  return (
    <Modal open onClose={onClose} title="Fiche client" size="xl">
      {isLoading || !customer ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-4">
            <div>
              <h3 className="font-display text-lg font-bold text-content">{customer.firstName} {customer.lastName}</h3>
              <p className="text-sm text-content-muted">
                {customer.phone ?? '—'}{customer.email ? ` · ${customer.email}` : ''}
              </p>
              {/* Âge, profession et adresse : contexte utile au conseil (presbytie,
                  usage professionnel des verres) et aux relances. */}
              {(() => {
                const age = ageFromBirthDate(customer.dateOfBirth);
                const bits = [
                  age !== null ? `${age} ans` : null,
                  customer.profession || null,
                  customer.address || null,
                ].filter(Boolean);
                return bits.length > 0 ? (
                  <p className="text-xs text-content-faint">{bits.join(' · ')}</p>
                ) : null;
              })()}
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

          {customer.notes && (
            <div className="rounded-xl border border-line bg-surface-2/60 p-3 text-sm text-content-muted">
              <span className="font-semibold text-content">Notes — </span>
              {customer.notes}
            </div>
          )}

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

          {editing && (
            <PrescriptionForm
              customerId={customerId}
              prescription={editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['customer', customerId] });
                setEditing(null);
              }}
            />
          )}

          {/* Ordonnances : les 2 plus récentes toujours visibles. */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Glasses className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-content">Ordonnances ({customer.prescriptions.length})</h4>
            </div>
            {customer.prescriptions.length === 0 ? (
              <p className="text-sm text-content-muted">Aucune ordonnance enregistrée.</p>
            ) : (
              <div className="space-y-3">
                {recentRx.map((p) => (
                  <PrescriptionCard
                    key={p.id}
                    rx={p}
                    patient={{ firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone }}
                    company={company}
                    canEdit={canCreate}
                    onEdit={() => setEditing(p)}
                  />
                ))}
                {olderRx.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowAllRx((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      {showAllRx ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {showAllRx ? 'Masquer' : `Voir les ${olderRx.length} ordonnance(s) précédente(s)`}
                    </button>
                    {showAllRx && (
                      <div className="space-y-3">
                        {olderRx.map((p) => (
                          <PrescriptionCard
                            key={p.id}
                            rx={p}
                            patient={{ firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone }}
                            company={company}
                            canEdit={canCreate}
                            onEdit={() => setEditing(p)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {customer.sales.length > 0 && (
            <RecordSection icon={ReceiptText} title={`Achats & devis (${customer.sales.length})`}>
              <div className="space-y-2">
                {customer.sales.map((s) => (
                  <SaleRow key={s.id} sale={s} />
                ))}
              </div>
            </RecordSection>
          )}

          {customer.lensOrders.length > 0 && (
            <RecordSection icon={Glasses} title={`Commandes de verres (${customer.lensOrders.length})`}>
              <div className="space-y-2">
                {customer.lensOrders.map((o) => (
                  <LensOrderRow key={o.id} order={o} />
                ))}
              </div>
            </RecordSection>
          )}

          {customer.repairs.length > 0 && (
            <RecordSection icon={Wrench} title={`SAV & réparations (${customer.repairs.length})`}>
              <div className="space-y-2">
                {customer.repairs.map((r) => (
                  <RepairRow key={r.id} repair={r} />
                ))}
              </div>
            </RecordSection>
          )}

          {customer.sales.length === 0 && customer.lensOrders.length === 0 && customer.repairs.length === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-content-muted">
              <History className="h-4 w-4 shrink-0" /> Aucun achat, commande de verres ou réparation enregistré pour ce client.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function RecordSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ReceiptText;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-content">{title}</h4>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function SaleRow({ sale }: { sale: CustomerSale }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border p-2.5 text-sm">
      <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-medium text-content">{sale.number}</span>
          <Badge tone="neutral">{SALE_TYPE_LABEL[sale.type] ?? sale.type}</Badge>
          <span className="truncate text-xs text-content-faint">{formatDate(sale.createdAt)} · {sale.branch.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-semibold text-content">{formatCurrency(Number(sale.totalAmount))}</span>
          <Badge tone="neutral">{sale.status}</Badge>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-content-faint" /> : <ChevronDown className="h-3.5 w-3.5 text-content-faint" />}
        </span>
      </button>
      {open && sale.items.length > 0 && (
        <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-content-muted">
          {sale.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{it.quantity} × {it.product.name}</span>
              <span className="shrink-0">{formatCurrency(Number(it.lineTotal))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LensOrderRow({ order }: { order: CustomerLensOrder }) {
  return (
    <div className="rounded-lg border p-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-medium text-content">{order.number}</span>
          <Badge tone={lensOrderTone(order.status)}>{LENS_ORDER_STATUS_LABELS[order.status]}</Badge>
        </span>
        {order.cost != null && <span className="shrink-0 font-semibold text-content">{formatCurrency(Number(order.cost))}</span>}
      </div>
      <p className="mt-1 truncate text-xs text-content-muted">
        {order.odLens || order.ogLens ? [order.odLens && `OD ${order.odLens}`, order.ogLens && `OG ${order.ogLens}`].filter(Boolean).join(' · ') : order.description}
      </p>
      <p className="mt-0.5 text-xs text-content-faint">
        Commandé le {formatDate(order.createdAt)}
        {order.deliveredAt ? ` · livré le ${formatDate(order.deliveredAt)}` : order.expectedAt ? ` · prévu le ${formatDate(order.expectedAt)}` : ''}
      </p>
    </div>
  );
}

function RepairRow({ repair }: { repair: CustomerRepair }) {
  const st = REPAIR_STATUS[repair.status];
  return (
    <div className="rounded-lg border p-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-medium text-content">{repair.number}</span>
          <Badge tone={st.tone}>{st.label}</Badge>
        </span>
        {repair.cost != null && <span className="shrink-0 font-semibold text-content">{formatCurrency(Number(repair.cost))}</span>}
      </div>
      <p className="mt-1 truncate text-xs text-content-muted">{repair.description}</p>
      <p className="mt-0.5 text-xs text-content-faint">Reçu le {formatDate(repair.createdAt)}</p>
    </div>
  );
}

function PrescriptionCard({
  rx,
  patient,
  company,
  canEdit,
  onEdit,
}: {
  rx: Prescription;
  patient: PrescriptionPatient;
  company: CompanyInfo;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const [zoom, setZoom] = useState(false);

  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-content">{formatDate(rx.date)}</span>
          {/* Validité : une ordonnance périmée doit être refaite avant de
              commander des verres — on l'annonce clairement. */}
          {rx.expiresAt &&
            (new Date(rx.expiresAt) < new Date() ? (
              <Badge tone="danger">Expirée le {formatDate(rx.expiresAt)}</Badge>
            ) : (
              <span className="text-xs text-content-faint">
                Valide jusqu'au {formatDate(rx.expiresAt)}
              </span>
            ))}
        </div>
        <div className="flex items-center gap-2">
          {rx.lensType && <Badge tone="info">{rx.lensType}</Badge>}
          {canEdit && (
            <button
              onClick={onEdit}
              className="btn-ghost h-7 w-7 rounded-lg p-0"
              title="Modifier l'ordonnance"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => printPrescription(rx, patient, company)}
            className="btn-ghost h-7 w-7 rounded-lg p-0"
            title="Imprimer l'ordonnance"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {rx.photoUrl && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-2">
          <div
            className="relative h-14 w-20 cursor-pointer overflow-hidden rounded-md border bg-surface-2 transition hover:opacity-90"
            onClick={() => setZoom(true)}
            title="Cliquez pour agrandir le scan"
          >
            <img src={rx.photoUrl} alt="Scan ordonnance papier" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition hover:opacity-100">
              <Eye className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold text-content">Scan de l'ordonnance papier</p>
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="mt-0.5 inline-flex items-center gap-1 font-medium text-primary underline hover:text-primary-hover"
            >
              <Eye className="h-3 w-3" /> Voir le document original
            </button>
          </div>
        </div>
      )}

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

      {zoom && rx.photoUrl && (
        <Modal open onClose={() => setZoom(false)} title="Scan de l'ordonnance papier" size="lg">
          <img src={rx.photoUrl} alt="Ordonnance papier agrandie" className="max-h-[75vh] w-full object-contain" />
        </Modal>
      )}
    </div>
  );
}
