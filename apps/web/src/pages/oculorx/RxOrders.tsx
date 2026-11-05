import { useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Mail, Printer, Search } from 'lucide-react';
import { RX_FRAME_LABELS, RX_NEXT_STATUSES, RX_STATUS_LABELS, rxDiopter, type RxFrameType, type RxStatus } from '@oculo/shared-types';
import { rx, type RxOrder } from '../../features/oculorx/api';
import { printOrderSheet } from '../../features/oculorx/print';
import { Button, Modal, PageLoader } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { useAuthStore } from '../../store/auth';
import { Money, Panel, StatusBadge, td, th, useRx } from './ui';
import { LensLinks } from './LensLinks';

const FILTERS = [
  { id: '', label: 'Toutes' },
  { id: 'open', label: 'En cours' },
  { id: 'delivered', label: 'Livrées' },
];

export function RxOrders() {
  const { margins } = useRx();
  const [status, setStatus] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<RxOrder | null>(null);
  const { data: suppliers } = useQuery({ queryKey: ['rx', 'suppliers'], queryFn: rx.suppliers });
  const { data: orders, isLoading } = useQuery({
    queryKey: ['rx', 'orders', status, supplierId, from, to, q],
    queryFn: () => rx.orders({ status: status || undefined, supplierId: supplierId || undefined, from: from || undefined, to: to || undefined, q: q.trim() || undefined }),
  });
  // Totaux de la sélection, hors commandes annulées ou retournées.
  const counted = (orders ?? []).filter((o) => o.status !== 'CANCELLED' && o.status !== 'RETURNED');
  const total = (k: 'purchasePrice' | 'salePrice' | 'margin') => counted.reduce((s, o) => s + (o[k] ?? 0), 0);

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setStatus(f.id)} className={clsx('rounded-full border px-3 py-1.5 text-xs font-semibold', status === f.id ? 'border-primary bg-primary-soft text-content' : 'text-content-muted')}>
                {f.label}
              </button>
            ))}
          </div>
          <select className="input h-9 w-auto text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Tous les fournisseurs</option>
            {suppliers?.filter((s) => s._count.rxOrders > 0).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="text-xs text-content-muted">Du <input type="date" className="input ml-1 inline h-9 w-auto text-sm" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs text-content-muted">au <input type="date" className="input ml-1 inline h-9 w-auto text-sm" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
            <input className="input h-9 pl-9 text-sm" placeholder="Patient, n° de commande ou de dossier" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </Panel>

      <section className="card overflow-hidden p-0">
        {isLoading ? <PageLoader /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>N° / date</th>
                  <th className={th}>Patient</th>
                  <th className={th}>Fournisseur</th>
                  <th className={th}>Verre</th>
                  <th className={th}>OD / OG</th>
                  {margins && <th className={`${th} text-right`}>Achat</th>}
                  <th className={`${th} text-right`}>Vente</th>
                  {margins && <th className={`${th} text-right`}>Marge</th>}
                  <th className={th}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((o) => (
                  <tr key={o.id} onClick={() => setOpen(o)} className="cursor-pointer border-b last:border-0 hover:bg-primary-soft/30">
                    <td className={td}>
                      <span className="whitespace-nowrap font-mono text-xs font-bold text-content">{o.number}</span>
                      <span className="block text-[11px] text-content-faint">{formatDate(o.createdAt)}</span>
                    </td>
                    <td className={td}>{o.patientName}{o.fileNumber && <span className="block text-[11px] text-content-faint">{o.fileNumber}</span>}</td>
                    <td className={`${td} text-content-muted`}>{o.supplier.name}</td>
                    <td className={`${td} text-xs`}>{o.lens.designation}<span className="block font-mono text-[11px] text-content-faint">{o.lens.reference}</span></td>
                    <td className={`${td} whitespace-nowrap font-mono text-[11px] text-content-muted`}>
                      {rxDiopter(o.od.sph)} {o.od.cyl ? `(${rxDiopter(o.od.cyl)})` : ''}
                      <span className="block">{rxDiopter(o.og.sph)} {o.og.cyl ? `(${rxDiopter(o.og.cyl)})` : ''}</span>
                    </td>
                    {margins && <td className={`${td} text-right`}><Money value={o.purchasePrice} /></td>}
                    <td className={`${td} text-right`}><Money value={o.salePrice} /></td>
                    {margins && <td className={`${td} text-right font-semibold`}><Money value={o.margin} /></td>}
                    <td className={td}>
                      <StatusBadge status={o.status} />
                      {o.lensOrder?.trackCode && <span className="mt-1 block font-mono text-[10px] text-content-faint">{o.lensOrder.trackCode}</span>}
                    </td>
                  </tr>
                ))}
                {!orders?.length && <tr><td colSpan={9} className={`${td} py-8 text-center text-content-muted`}>Aucune commande.</td></tr>}
              </tbody>
              {!!counted.length && (
                <tfoot>
                  <tr className="border-t-2 bg-surface-2/50 font-bold">
                    <td className={td} colSpan={5}>Total sélection · {counted.length} commande(s) <span className="font-normal text-content-faint">(hors annulées / retours)</span></td>
                    {margins && <td className={`${td} text-right`}><Money value={total('purchasePrice')} /></td>}
                    <td className={`${td} text-right`}><Money value={total('salePrice')} /></td>
                    {margins && <td className={`${td} text-right`}><Money value={total('margin')} /></td>}
                    <td className={td} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      {open && <OrderModal order={open} margins={margins} onClose={() => setOpen(null)} />}
    </>
  );
}

function OrderModal({ order: o, margins, onClose }: { order: RxOrder; margins: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { order: canOrder } = useRx();
  const user = useAuthStore((s) => s.user);
  const [saleNumber, setSaleNumber] = useState('');
  const done = () => { qc.invalidateQueries({ queryKey: ['rx'] }); onClose(); };
  const setStatus = useMutation({ mutationFn: (s: RxStatus) => rx.setStatus(o.id, s), onSuccess: done, onError: (e) => alert(apiErrorMessage(e)) });
  const link = useMutation({ mutationFn: () => rx.linkSale(o.id, saleNumber.trim()), onSuccess: (s) => { alert(`Commande liée à la facture ${s.number}`); done(); }, onError: (e) => alert(apiErrorMessage(e)) });
  const resend = useMutation({ mutationFn: () => rx.resend(o.id), onSuccess: () => alert('Bon de commande renvoyé par email.'), onError: (e) => alert(apiErrorMessage(e)) });
  const next = RX_NEXT_STATUSES[o.status] ?? [];

  return (
    <Modal open onClose={onClose} title={`Commande ${o.number}`} size="lg">
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={o.status} />
          <span className="text-content-muted">{o.supplier.name} · {formatDateTime(o.createdAt)}{o.userName ? ` · ${o.userName}` : ''}</span>
          {o.isDemo && <span className="badge bg-surface-3 text-content-faint">Démo</span>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-semibold text-content">{o.lens.designation}</p>
            <p className="font-mono text-[11px] text-content-faint">{o.lens.reference}</p>
            <p className="mt-2">{o.patientName}{o.fileNumber ? ` · dossier ${o.fileNumber}` : ''}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 font-mono text-xs">
            <p>OD {rxDiopter(o.od.sph)} · cyl {rxDiopter(o.od.cyl)} · {o.od.axis != null ? `${o.od.axis}°` : '—'}</p>
            <p>OG {rxDiopter(o.og.sph)} · cyl {rxDiopter(o.og.cyl)} · {o.og.axis != null ? `${o.og.axis}°` : '—'}</p>
            <p className="mt-1 font-sans text-content-muted">
              Add {rxDiopter(o.addition)} · EP {o.pd ?? '—'} · H {o.height ?? '—'} · {o.frameType ? RX_FRAME_LABELS[o.frameType as RxFrameType] : '—'}
              {o.mounted ? ' · Taillé-monté' : ''}{o.urgent ? ' · Urgence' : ''}
            </p>
          </div>
        </div>
        {o.comment && <p className="rounded-xl border p-3 text-content-muted">{o.comment}</p>}
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-content-faint">Suivi lié</p>
          <LensLinks link={o.lensOrder} />
          {o.lensOrder && <p className="mt-1 text-[11px] text-content-faint">Les statuts se mettent à jour dans les deux sens : Kanban, étapes OculoTrack (colis, laboratoire, retour) et OculoRX.</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl border p-3 text-center">
          {margins && <div><p className="text-[11px] uppercase text-content-faint">Achat</p><Money value={o.purchasePrice} className="font-bold" /></div>}
          <div><p className="text-[11px] uppercase text-content-faint">Vente</p><Money value={o.salePrice} className="font-bold" /></div>
          {margins && <div><p className="text-[11px] uppercase text-content-faint">Marge</p><Money value={o.margin} className="font-bold" /></div>}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-content-faint">Historique</p>
          <ol className="space-y-1 border-l-2 border-primary/30 pl-3">
            {o.statusHistory.map((h, i) => (
              <li key={i} className="text-xs"><b>{RX_STATUS_LABELS[h.status]}</b> <span className="text-content-faint">· {formatDateTime(h.at)}{h.by ? ` · ${h.by}` : ''}</span>{h.note ? <span className="block text-content-muted">{h.note}</span> : null}</li>
            ))}
          </ol>
        </div>

        {canOrder && next.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {next.map((s) => (
              <Button key={s} variant={s === 'CANCELLED' || s === 'RETURNED' ? 'outline' : 'primary'} loading={setStatus.isPending && setStatus.variables === s}
                onClick={() => (s !== 'CANCELLED' || confirm('Annuler cette commande ?')) && setStatus.mutate(s)}>
                {s === 'CANCELLED' ? 'Annuler' : s === 'RETURNED' ? 'Retour / SAV' : `Passer à « ${RX_STATUS_LABELS[s]} »`}
              </Button>
            ))}
          </div>
        )}

        {canOrder && o.status === 'DELIVERED' && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border p-3">
            <label className="min-w-0 flex-1"><span className="label">{o.saleId ? 'Facture patient liée — changer' : 'Lier à la facture patient (n° de vente)'}</span><input className="input h-10 font-mono" value={saleNumber} onChange={(e) => setSaleNumber(e.target.value)} placeholder="VEN-2026-000123" /></label>
            <Button variant="outline" disabled={!saleNumber.trim()} loading={link.isPending} onClick={() => link.mutate()}><Link2 className="h-4 w-4" /> Lier</Button>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          {canOrder && <Button variant="ghost" loading={resend.isPending} onClick={() => resend.mutate()}><Mail className="h-4 w-4" /> Renvoyer par email</Button>}
          <Button variant="outline" onClick={() => printOrderSheet(o, { name: user?.tenantName ?? 'Magasin', phone: user?.tenantContactPhone })}><Printer className="h-4 w-4" /> Bon de commande</Button>
        </div>
      </div>
    </Modal>
  );
}
