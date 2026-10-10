import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Copy, Factory, MessageCircle, Truck } from 'lucide-react';
import { TRACK_ANOMALY_TYPES, type TrackAnomalyType } from '@oculo/shared-types';
import { ot, type PackageDetail } from '../../../features/oculotrack/api';
import { trackFileToDataUrl } from '../../../features/oculotrack/file';
import { PhotoButton } from '../../../features/oculotrack/ui';
import { listSuppliers } from '../../../features/management/api';
import { listMeasurements } from '../../../features/optique/measurements';
import { Button, Field, Modal } from '../../../components/ui';
import { apiErrorMessage } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import { tr } from '../../../lib/tr';

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const fmt = (n: number | null) => (n == null ? '—' : String(n).replace('.', ','));

/* ------------------------------ Activer le suivi ------------------------------ */

export function StartTrackingModal({ orderId, onClose, onDone }: { orderId?: string; onClose: () => void; onDone: (id: string) => void }) {
  const { data: cands } = useQuery({ queryKey: ['ot', 'candidates'], queryFn: ot.candidates });
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const [id, setId] = useState(orderId ?? '');
  const order = (cands as (NonNullable<typeof cands>[number] & { customerId?: string | null; supplierId?: string | null; frameRef?: string | null })[] | undefined)?.find((c) => c.id === id);
  const [supplierId, setSupplierId] = useState('');
  const [frameRef, setFrameRef] = useState('');
  const [measurementId, setMeasurementId] = useState('');
  const [expectedAt, setExpectedAt] = useState(inDays(7));
  const [note, setNote] = useState('');
  const { data: measures } = useQuery({
    queryKey: ['measurements', order?.customerId],
    queryFn: () => listMeasurements(order!.customerId!),
    enabled: Boolean(order?.customerId),
  });
  useEffect(() => {
    if (order?.supplierId && !supplierId) setSupplierId(order.supplierId);
    if (!order?.supplierId && order?.supplierName && suppliers && !supplierId) {
      const s = suppliers.find((x) => x.name.toLowerCase() === order.supplierName!.toLowerCase());
      if (s) setSupplierId(s.id);
    }
    if (order?.frameRef && !frameRef) setFrameRef(order.frameRef);
  }, [order, suppliers, supplierId, frameRef]);
  useEffect(() => {
    if (measures?.length && !measurementId) setMeasurementId(measures[0]!.id);
  }, [measures, measurementId]);

  const save = useMutation({
    mutationFn: () => ot.start(id, { supplierId, frameRef, measurementId, expectedAt, note }),
    onSuccess: () => onDone(id),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={tr('ot.trackOrder')} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-content-muted">{tr('ot.startHint')}</p>
        <Field label={tr('ot.f.lensOrder')}>
          <select className="input" value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">{tr('ot.choose')}</option>
            {(cands ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.number} — {c.customer ? `${c.customer.firstName} ${c.customer.lastName}` : tr('ot.walkIn')} — {c.description}
              </option>
            ))}
          </select>
          {cands && cands.length === 0 && <p className="mt-1 text-xs text-content-faint">{tr('ot.noCandidates')}</p>}
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={tr('ot.f.supplierLab')}>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">{tr('ot.choose')}</option>
              {(suppliers ?? []).filter((s) => s.isActive !== false).map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label={tr('ot.f.frameRef')}>
            <input className="input" value={frameRef} maxLength={120} onChange={(e) => setFrameRef(e.target.value)} placeholder="RX-4587" />
          </Field>
          <Field label={tr('ot.f.returnBy')}>
            <input className="input" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
          </Field>
          <Field label={tr('ot.f.measurement')}>
            <select className="input" value={measurementId} onChange={(e) => setMeasurementId(e.target.value)} disabled={!order?.customerId}>
              <option value="">{order?.customerId ? tr('ot.noMeasurement') : tr('ot.noCustomerMeasure')}</option>
              {(measures ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {formatDate(m.takenAt)} · EP {fmt(m.pdTotal)} · H {fmt(m.odHeight)}/{fmt(m.ogHeight)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={tr('ot.f.comment')}>
          <textarea className="input min-h-[70px]" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="text-xs text-content-faint">{tr('ot.filesLater')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tr('ot.cancel')}</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!id || !supplierId}>
            <Check className="h-4 w-4" /> {tr('ot.startTracking')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------- Préparer l'expédition ---------------------------- */

export function CreatePackageModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const [supplierId, setSupplierId] = useState('');
  const supplier = suppliers?.find((s) => s.id === supplierId);
  const { data: orders } = useQuery({ queryKey: ['ot', 'orders', 'sup', supplierId], queryFn: () => ot.orders({ supplierId }), enabled: Boolean(supplierId) });
  const ready = useMemo(() => (orders ?? []).filter((o) => ['CREATED', 'FRAME_PREPARED'].includes(o.trackStage)), [orders]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => setSel(new Set(ready.map((o) => o.id))), [ready]);
  const [fromCity, setFromCity] = useState(() => {
    try { return localStorage.getItem('ot_from_city') ?? ''; } catch { return ''; }
  });
  const [toCity, setToCity] = useState('');
  useEffect(() => { if (supplier?.city) setToCity(supplier.city); }, [supplier]);
  const [carrierName, setCarrierName] = useState('');
  const [externalTracking, setExternalTracking] = useState('');
  const [expectedAt, setExpectedAt] = useState(inDays(supplier?.deliveryDays ? Math.min(supplier.deliveryDays, 7) : 2));
  const [weight, setWeight] = useState('');

  const save = useMutation({
    mutationFn: () => {
      try { localStorage.setItem('ot_from_city', fromCity); } catch { /* stockage indisponible */ }
      return ot.createPackage({
        lensOrderIds: [...sel],
        supplierId,
        fromCity,
        toCity,
        carrierName,
        externalTracking,
        expectedAt,
        weightGrams: weight ? Number(weight) : null,
      });
    },
    onSuccess: (p) => onDone(p.id),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={tr('ot.preparePackage')} size="lg">
      <div className="space-y-4">
        <Field label={tr('ot.f.supplierLab')}>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{tr('ot.choose')}</option>
            {(suppliers ?? []).filter((s) => s.isActive !== false).map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>
            ))}
          </select>
        </Field>
        {supplierId && (
          <div className="rounded-xl border">
            <p className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wide text-content-faint">{tr('ot.ordersToShip')}</p>
            {!ready.length ? (
              <p className="p-3 text-sm text-content-muted">{tr('ot.noOrdersToShip')}</p>
            ) : (
              <ul className="max-h-56 divide-y overflow-y-auto">
                {ready.map((o) => (
                  <li key={o.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                      <input type="checkbox" checked={sel.has(o.id)} onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(o.id) : n.delete(o.id); return n; })} />
                      <span className="font-mono text-sm font-bold">{o.trackCode}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-content-muted">
                        {o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : ''} {o.frameRef ? `· ${o.frameRef}` : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={tr('ot.f.fromCity')}><input className="input" value={fromCity} onChange={(e) => setFromCity(e.target.value)} placeholder="Daloa" /></Field>
          <Field label={tr('ot.f.toCity')}><input className="input" value={toCity} onChange={(e) => setToCity(e.target.value)} placeholder="Abidjan" /></Field>
          <Field label={tr('ot.f.carrier')}><input className="input" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} placeholder={tr('ot.f.carrierPh')} /></Field>
          <Field label={tr('ot.f.tracking')}><input className="input" value={externalTracking} onChange={(e) => setExternalTracking(e.target.value)} placeholder="TRP-458921" /></Field>
          <Field label={tr('ot.f.expectedLab')}><input className="input" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} /></Field>
          <Field label={tr('ot.f.weightOpt')}><input className="input" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value.replace(/\D/g, ''))} placeholder="g" /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tr('ot.cancel')}</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!supplierId || sel.size === 0}>
            <Check className="h-4 w-4" /> {tr('ot.createPackage', { n: sel.size })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------- Remise au transporteur ---------------------------- */

export function HandoverModal({ pkg, onClose, onDone }: { pkg: PackageDetail['package']; onClose: () => void; onDone: () => void }) {
  const { data: accesses } = useQuery({ queryKey: ['ot', 'accesses'], queryFn: ot.accesses, retry: false });
  const carriers = (accesses ?? []).filter((a) => a.account.kind === 'CARRIER');
  const [carrierAccess, setCarrierAccess] = useState(pkg.carrierAccessId ?? '');
  const [carrierName, setCarrierName] = useState(pkg.carrierName ?? '');
  const [externalTracking, setExternalTracking] = useState(pkg.externalTracking ?? '');
  const [expectedAt, setExpectedAt] = useState(pkg.expectedAt?.slice(0, 10) ?? inDays(2));
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      if ((carrierAccess || null) !== (pkg.carrierAccessId || null)) await ot.assignCarrier(pkg.id, carrierAccess || null);
      return ot.handover(pkg.id, { carrierName, externalTracking, expectedAt, note, photo: photo ?? undefined });
    },
    onSuccess: onDone,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={tr('ot.handover')} size="md">
      <div className="space-y-3">
        {carriers.length > 0 && (
          <Field label={tr('ot.f.carrierAccount')}>
            <select className="input" value={carrierAccess} onChange={(e) => { setCarrierAccess(e.target.value); const c = carriers.find((x) => x.id === e.target.value); if (c) setCarrierName(c.account.name); }}>
              <option value="">{tr('ot.noCarrierAccount')}</option>
              {carriers.map((c) => <option key={c.id} value={c.id}>{c.account.name}</option>)}
            </select>
          </Field>
        )}
        <Field label={tr('ot.f.carrier')}><input className="input" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} placeholder={tr('ot.f.carrierPh')} /></Field>
        <Field label={tr('ot.f.tracking')}><input className="input" value={externalTracking} onChange={(e) => setExternalTracking(e.target.value)} placeholder="TRP-458921" /></Field>
        <Field label={tr('ot.f.expectedLab')}><input className="input" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} /></Field>
        <Field label={tr('ot.f.comment')}><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex items-center gap-3">
          <PhotoButton label={photo ? tr('ot.photoOk') : tr('ot.photoPackage')} onPhoto={async (f) => setPhoto(await trackFileToDataUrl(f))} />
          {photo && <img src={photo} alt="" className="h-12 w-12 rounded-lg object-cover" />}
        </div>
        <p className="text-xs text-content-faint">{carrierAccess ? tr('ot.handoverCarrierHint') : tr('ot.handoverHint')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tr('ot.cancel')}</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}><Truck className="h-4 w-4" /> {tr('ot.confirmHandover')}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------- Réception (retour au magasin) -------------------------- */

type Checks = { received: boolean; reference: boolean; quantity: boolean; condition: boolean };
const ALL_OK: Checks = { received: true, reference: true, quantity: true, condition: true };

/** Contrôle commande par commande, réutilisé par le portail fournisseur. */
export function ChecksList({ items, checks, setChecks }: { items: { id: string; code: string; sub?: string | null }[]; checks: Record<string, Checks>; setChecks: (c: Record<string, Checks>) => void }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => {
        const c = checks[it.id] ?? ALL_OK;
        return (
          <li key={it.id} className="rounded-xl border p-3">
            <p className="font-mono text-sm font-bold text-content">{it.code} <span className="font-sans text-xs font-normal text-content-muted">{it.sub}</span></p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(['received', 'reference', 'quantity', 'condition'] as const).map((k) => (
                <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${c[k] ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-600'}`}>
                  <input type="checkbox" checked={c[k]} onChange={(e) => setChecks({ ...checks, [it.id]: { ...c, [k]: e.target.checked } })} />
                  {tr(`ot.check.${k}`)}
                </label>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ReceiveModal({ pkg, onClose, onDone }: { pkg: PackageDetail['package']; onClose: () => void; onDone: () => void }) {
  const [checks, setChecks] = useState<Record<string, Checks>>(() => Object.fromEntries(pkg.items.map((i) => [i.lensOrderId, ALL_OK])));
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const save = useMutation({ mutationFn: () => ot.receive(pkg.id, { checks, note, photo: photo ?? undefined }), onSuccess: onDone, onError: (e) => alert(apiErrorMessage(e)) });
  const issues = Object.values(checks).some((c) => !Object.values(c).every(Boolean));
  return (
    <Modal open onClose={onClose} title={tr('ot.confirmReceiptOf', { number: pkg.number })} size="md">
      <div className="space-y-3">
        <ChecksList items={pkg.items.map((i) => ({ id: i.lensOrderId, code: i.lensOrder.trackCode, sub: i.lensOrder.frameRef }))} checks={checks} setChecks={setChecks} />
        <Field label={tr('ot.f.comment')}><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <PhotoButton label={photo ? tr('ot.photoOk') : tr('ot.photoOptional')} onPhoto={async (f) => setPhoto(await trackFileToDataUrl(f))} />
        {issues && <p className="text-xs font-medium text-danger">{tr('ot.issuesWillReport')}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tr('ot.cancel')}</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}><Check className="h-4 w-4" /> {tr('ot.confirmReceipt')}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------- Anomalie ----------------------------------- */

export function AnomalyForm({ onSubmit, busy }: { onSubmit: (v: { type: TrackAnomalyType; comment: string; photo?: string }) => void; busy?: boolean }) {
  const [type, setType] = useState<TrackAnomalyType>('FRAME_DAMAGED');
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        {TRACK_ANOMALY_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={`rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition ${type === t ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-300' : 'text-content-muted hover:border-red-500/50'}`}>
            {tr(`ot.an.${t}`)}
          </button>
        ))}
      </div>
      <textarea className="input min-h-[80px]" placeholder={tr('ot.anomalyComment')} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} />
      <div className="flex items-center gap-3">
        <PhotoButton label={photo ? tr('ot.photoOk') : tr('ot.photoOptional')} onPhoto={async (f) => setPhoto(await trackFileToDataUrl(f))} />
        {photo && <img src={photo} alt="" className="h-12 w-12 rounded-lg object-cover" />}
      </div>
      <Button className="w-full bg-red-600 hover:bg-red-700" loading={busy} onClick={() => onSubmit({ type, comment, photo: photo ?? undefined })}>
        {tr('ot.sendAnomaly')}
      </Button>
    </div>
  );
}

export function AnomalyModal({ lensOrderId, packageId, onClose, onDone }: { lensOrderId?: string; packageId?: string; onClose: () => void; onDone: () => void }) {
  const save = useMutation({
    mutationFn: (v: { type: TrackAnomalyType; comment: string; photo?: string }) => ot.reportAnomaly({ ...v, lensOrderId, packageId }),
    onSuccess: onDone,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={tr('ot.reportAnomaly')} size="md">
      <AnomalyForm onSubmit={(v) => save.mutate(v)} busy={save.isPending} />
    </Modal>
  );
}

/* ----------------------------- Invitation au portail ----------------------------- */

export function InviteModal({ onClose }: { onClose: () => void }) {
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const [kind, setKind] = useState<'SUPPLIER' | 'CARRIER'>('SUPPLIER');
  const [supplierId, setSupplierId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const sup = suppliers?.find((s) => s.id === supplierId);
  useEffect(() => {
    if (sup) {
      if (!name) setName(sup.contactName || sup.name);
      if (!email && sup.email) setEmail(sup.email);
      if (!phone) setPhone(sup.whatsapp || sup.phone || '');
    }
  }, [sup]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => ot.invite({ kind, name, email, phone, supplierId: kind === 'SUPPLIER' ? supplierId : undefined }),
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const res = save.data;
  const wa = phone.replace(/\D/g, '');
  const msg = res?.inviteUrl ? tr('ot.waInvite', { name, url: res.inviteUrl }) : tr('ot.waAccess', { name, url: `${window.location.origin}/portail` });

  return (
    <Modal open onClose={onClose} title={tr('ot.invite')} size="md">
      {res ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-success"><Check className="h-4 w-4" /> {res.inviteUrl ? tr('ot.inviteCreated') : tr('ot.accessGranted')}</p>
          {res.inviteUrl && (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="mb-1 text-xs text-content-muted">{tr('ot.inviteLink')}</p>
              <p className="break-all font-mono text-xs text-content">{res.inviteUrl}</p>
              <button type="button" className="mt-2 text-xs font-semibold text-primary" onClick={() => navigator.clipboard?.writeText(res.inviteUrl!)}>
                <Copy className="mr-1 inline h-3.5 w-3.5" />{tr('ot.copy')}
              </button>
            </div>
          )}
          {wa && (
            <a className="btn-primary flex h-11 items-center justify-center gap-2 rounded-xl text-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`}>
              <MessageCircle className="h-4 w-4" /> {tr('ot.sendWhatsapp')}
            </a>
          )}
          <Button variant="ghost" className="w-full" onClick={onClose}>{tr('ot.close')}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {([['SUPPLIER', Factory], ['CARRIER', Truck]] as const).map(([k, Icon]) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${kind === k ? 'border-primary bg-primary-soft text-primary' : 'text-content-muted'}`}>
                <Icon className="h-5 w-5" /> {tr(`ot.kind.${k}`)}
              </button>
            ))}
          </div>
          {kind === 'SUPPLIER' && (
            <Field label={tr('ot.f.supplierLab')}>
              <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">{tr('ot.choose')}</option>
                {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          <Field label={tr('ot.f.contactName')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="WhatsApp"><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <p className="text-xs text-content-faint">{tr(kind === 'SUPPLIER' ? 'ot.inviteSupplierHint' : 'ot.inviteCarrierHint')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{tr('ot.cancel')}</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name || !email || (kind === 'SUPPLIER' && !supplierId)}>
              {tr('ot.sendInvite')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

