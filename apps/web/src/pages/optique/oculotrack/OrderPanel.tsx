import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Glasses,
  Link2,
  Loader2,
  MessageCircle,
  Package,
  Paperclip,
  Ruler,
  Upload,
  X,
} from 'lucide-react';
import { LENS_TREATMENTS, TRACK_ATTACHMENT_KINDS, TRACK_STAGES, trackStageRank, type TrackAttachmentKind, type TrackStage } from '@oculo/shared-types';
import { ot } from '../../../features/oculotrack/api';
import { trackFileToDataUrl } from '../../../features/oculotrack/file';
import { Journey, PackageBadge, StageBadge, Timeline } from '../../../features/oculotrack/ui';
import { Button } from '../../../components/ui';
import { apiErrorMessage } from '../../../lib/api';
import { formatDate, formatDateTime } from '../../../lib/format';
import { tr } from '../../../lib/tr';
import { AnomalyModal } from './modals';

export function Drawer({ title, subtitle, onClose, children }: { title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label={tr('ot.close')} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-bg shadow-2xl animate-fade-in">
        <div className="flex items-start gap-3 border-b px-4 py-3 sm:px-5" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
          <div className="min-w-0 flex-1">{title}{subtitle}</div>
          <button type="button" onClick={onClose} className="btn-ghost h-9 w-9 shrink-0 rounded-lg p-0" aria-label={tr('ot.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Section({ title, icon: Icon, children, action }: { title: string; icon?: typeof Package; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <h3 className="text-sm font-bold text-content">{title}</h3>
        <span className="ml-auto">{action}</span>
      </div>
      {children}
    </section>
  );
}

const fmtRx = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'number' ? (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) : String(v));

export function OrderPanel({ id, onClose, onOpenPackage, canManage }: { id: string; onClose: () => void; onOpenPackage: (id: string) => void; canManage: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['ot', 'order', id], queryFn: () => ot.order(id) });
  const [anomaly, setAnomaly] = useState(false);
  const [kind, setKind] = useState<TrackAttachmentKind>('FRAME_PHOTO');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ data: string; mime: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ot'] });
    qc.invalidateQueries({ queryKey: ['lens-orders'] });
  };
  const stage = useMutation({
    mutationFn: (s: 'FRAME_PREPARED' | 'COMPLETED' | 'CANCELLED') => ot.storeStage(id, s),
    onSuccess: refresh,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const resolve = useMutation({ mutationFn: (aid: string) => ot.resolveAnomaly(aid, prompt(tr('ot.resolutionPrompt')) ?? ''), onSuccess: refresh, onError: (e) => alert(apiErrorMessage(e)) });

  async function upload(f: File) {
    setUploading(true);
    try {
      await ot.addAttachment(id, { kind, name: f.name, data: await trackFileToDataUrl(f) });
      refresh();
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  async function open(aid: string) {
    try {
      const a = await ot.attachment(aid);
      setPreview({ data: a.data, mime: a.mime });
    } catch (e) {
      alert(apiErrorMessage(e));
    }
  }

  if (isLoading || !data) {
    return (
      <Drawer title={<p className="font-semibold">OculoTrack</p>} onClose={onClose}>
        {error ? <p className="text-sm text-danger">{apiErrorMessage(error)}</p> : <Loader2 className="mx-auto h-6 w-6 animate-spin text-content-faint" />}
      </Drawer>
    );
  }
  const o = data.order;
  const st = (o.trackStage ?? 'CREATED') as TrackStage;
  const pending = st === 'CANCELLED' || st === 'COMPLETED' ? [] : TRACK_STAGES.filter((s) => s !== 'CANCELLED' && trackStageRank(s) > trackStageRank(st));
  const openAnoms = o.trackAnomalies.filter((a) => a.status === 'OPEN');
  const rx = o.lensConfig?.prescription;
  const og = rx?.sameForBoth ? rx.od : rx?.og;
  const m = data.measurement;
  const supplierWa = (o.supplier?.whatsapp || o.supplier?.phone || '').replace(/\D/g, '');
  const clientWa = (o.customer?.phone || '').replace(/\D/g, '');
  const outbound = o.packageItems.map((i) => i.package).find((p) => p.direction === 'OUTBOUND' && p.status !== 'CANCELLED');

  return (
    <Drawer
      onClose={onClose}
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-bold text-content">{o.trackCode ?? o.number}</span>
          <StageBadge stage={st} issue={openAnoms.length > 0} />
        </div>
      }
      subtitle={
        <p className="mt-0.5 text-xs text-content-muted">
          {o.number} · {o.description}
        </p>
      }
    >
      {!o.trackCode ? (
        <p className="text-sm text-content-muted">{tr('ot.notTracked')}</p>
      ) : (
        <>
          <section className="card p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-content-faint">{tr('ot.whereIsFrame')}</p>
            <Journey stage={st} from={outbound?.fromCity} to={o.supplier?.city || o.supplier?.name} />
            {openAnoms.length > 0 && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-300">
                <AlertTriangle className="h-4 w-4" /> {tr('ot.openAnomalies', { n: openAnoms.length })}
              </p>
            )}
          </section>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              {(st === 'CREATED') && (
                <Button variant="outline" onClick={() => stage.mutate('FRAME_PREPARED')} loading={stage.isPending}>
                  <Glasses className="h-4 w-4" /> {tr('ot.framePrepared')}
                </Button>
              )}
              {trackStageRank(st) >= trackStageRank('ARRIVED_AT_STORE') && st !== 'COMPLETED' && st !== 'CANCELLED' && (
                <Button onClick={() => stage.mutate('COMPLETED')} loading={stage.isPending}>
                  <CheckCircle2 className="h-4 w-4" /> {tr('ot.complete')}
                </Button>
              )}
              <Button variant="outline" onClick={() => setAnomaly(true)}>
                <AlertTriangle className="h-4 w-4" /> {tr('ot.reportAnomaly')}
              </Button>
              {o.publicUrl && (
                <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(o.publicUrl!); alert(tr('ot.linkCopied')); }}>
                  <Link2 className="h-4 w-4" /> {tr('ot.copyPublic')}
                </Button>
              )}
              {o.publicUrl && clientWa && (
                <a
                  className="btn-outline h-10 rounded-xl px-3 text-sm text-success"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/${clientWa}?text=${encodeURIComponent(tr('ot.waClient', { code: o.trackCode, url: o.publicUrl }))}`}
                >
                  <MessageCircle className="h-4 w-4" /> {tr('ot.sendClient')}
                </a>
              )}
              {st !== 'CANCELLED' && st !== 'COMPLETED' && trackStageRank(st) <= trackStageRank('PACKED') && (
                <Button variant="ghost" className="text-danger" onClick={() => confirm(tr('ot.cancelConfirm')) && stage.mutate('CANCELLED')}>
                  {tr('ot.cancelOrder')}
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Section title={tr('ot.sec.order')} icon={Glasses}>
              <dl className="space-y-1.5 text-sm">
                {[
                  [tr('ot.f.client'), o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : '—'],
                  [tr('ot.f.frame'), o.frameProduct ? `${o.frameProduct.brand ? `${o.frameProduct.brand} · ` : ''}${o.frameProduct.name}` : '—'],
                  [tr('ot.f.frameRef'), o.frameRef || '—'],
                  [tr('ot.f.lenses'), [o.lensConfig?.lensType, o.lensConfig?.index && `${tr('ot.f.index')} ${o.lensConfig.index}`, o.lensConfig?.material].filter(Boolean).join(' · ') || o.description],
                  [tr('ot.f.treatments'), o.lensConfig?.treatments?.map((k) => LENS_TREATMENTS.find((t) => t.key === k)?.label ?? k).join(', ') || '—'],
                  [tr('ot.f.created'), formatDate(o.createdAt)],
                  [tr('ot.f.returnBy'), o.expectedAt ? formatDate(o.expectedAt) : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-content-muted">{k}</dt>
                    <dd className="text-right font-medium text-content">{v}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            <Section
              title={tr('ot.sec.supplier')}
              icon={Package}
              action={
                supplierWa ? (
                  <a className="text-xs font-semibold text-success" target="_blank" rel="noreferrer" href={`https://wa.me/${supplierWa}?text=${encodeURIComponent(tr('ot.waSupplier', { code: o.trackCode }))}`}>
                    <MessageCircle className="mr-1 inline h-3.5 w-3.5" />WhatsApp
                  </a>
                ) : null
              }
            >
              <p className="text-sm font-semibold text-content">{o.supplier?.name ?? o.supplierName ?? '—'}</p>
              <p className="text-xs text-content-muted">{o.supplier?.city ?? ''}</p>
              <ul className="mt-3 space-y-1.5">
                {o.packageItems.map(({ package: p }) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => onOpenPackage(p.id)} className="flex w-full items-center gap-2 rounded-lg bg-surface-2/60 px-2.5 py-2 text-left text-xs hover:bg-surface-2">
                      <Package className="h-3.5 w-3.5" />
                      <span className="font-mono font-bold">{p.number}</span>
                      <span className="text-content-muted">{tr(`ot.dir.${p.direction}`)}</span>
                      <span className="ml-auto"><PackageBadge status={p.status} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          {(rx || m) && (
            <Section title={tr('ot.sec.prescription')} icon={Ruler}>
              {rx && (
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-content-faint">
                        <th className="py-1 text-left" />
                        <th>Sph</th><th>Cyl</th><th>{tr('ot.f.axis')}</th><th>Add</th><th>{tr('ot.f.prism')}</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {([['OD', rx.od], ['OG', og]] as const).map(([eye, e]) => (
                        <tr key={eye} className="border-t">
                          <td className="py-1.5 text-left font-sans font-bold">{eye}</td>
                          <td>{fmtRx(e?.sphere)}</td>
                          <td>{fmtRx(e?.cylinder)}</td>
                          <td>{e?.axis != null ? `${e.axis}°` : '—'}</td>
                          <td>{fmtRx(e?.addition)}</td>
                          <td>{e?.prism != null ? `${e.prism} ${e.prismBase ?? ''}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {m && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {([
                    ['EP', m.pdTotal], ['½ OD', m.odMonoPd], ['½ OG', m.ogMonoPd], ['H OD', m.odHeight], ['H OG', m.ogHeight],
                    ['A', m.lensWidth], ['B', m.lensHeight], ['DBL', m.bridge], [tr('ot.f.vertex'), m.vertex], [tr('ot.f.panto'), m.pantoTilt], [tr('ot.f.wrap'), m.wrapAngle],
                  ] as const).filter(([, v]) => v != null).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-surface-2/60 px-2 py-1.5">
                      <p className="text-content-faint">{k}</p>
                      <p className="font-mono font-semibold text-content">{String(v).replace('.', ',')}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section
            title={tr('ot.sec.files')}
            icon={Paperclip}
            action={
              canManage ? (
                <span className="flex items-center gap-1.5">
                  <select className="input h-8 w-auto py-0 text-xs" value={kind} onChange={(e) => setKind(e.target.value as TrackAttachmentKind)}>
                    {TRACK_ATTACHMENT_KINDS.filter((k) => ['FRAME_PHOTO', 'PRESCRIPTION', 'MEASUREMENT', 'DOCUMENT', 'OTHER'].includes(k)).map((k) => (
                      <option key={k} value={k}>{tr(`ot.att.${k}`)}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-outline h-8 rounded-lg px-2 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {tr('ot.add')}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
                </span>
              ) : null
            }
          >
            {!o.trackAttachments.length ? (
              <p className="text-sm text-content-muted">{tr('ot.noFiles')}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {o.trackAttachments.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => open(a.id)} className="flex w-full items-center gap-2 rounded-xl border p-2.5 text-left hover:border-primary">
                      <FileText className="h-5 w-5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-content">{tr(`ot.att.${a.kind}`)}</span>
                        <span className="block truncate text-[11px] text-content-faint">{a.uploadedByName} · {formatDateTime(a.createdAt)}</span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-content-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {o.trackAnomalies.length > 0 && (
            <Section title={tr('ot.tab.anomalies')} icon={AlertTriangle}>
              <ul className="space-y-2">
                {o.trackAnomalies.map((a) => (
                  <li key={a.id} className={`rounded-xl border p-3 ${a.status === 'OPEN' ? 'border-red-500/40 bg-red-500/5' : 'opacity-70'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-content">{tr(`ot.an.${a.type}`)}</span>
                      <span className="text-xs text-content-faint">{a.reportedByName} · {formatDateTime(a.createdAt)}</span>
                      {a.status === 'OPEN' && canManage && (
                        <button type="button" className="ml-auto text-xs font-semibold text-primary" onClick={() => resolve.mutate(a.id)}>
                          {tr('ot.resolve')}
                        </button>
                      )}
                      {a.status === 'RESOLVED' && <span className="ml-auto text-xs font-semibold text-success">✓ {tr('ot.resolved')}</span>}
                    </div>
                    {a.comment && <p className="mt-1 text-sm text-content-muted">{a.comment}</p>}
                    {a.resolution && <p className="mt-1 text-xs text-content-faint">→ {a.resolution}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={tr('ot.timeline')} icon={CheckCircle2}>
            <Timeline events={data.events} pending={pending.slice(0, 3)} />
          </Section>
        </>
      )}

      {anomaly && <AnomalyModal lensOrderId={id} onClose={() => setAnomaly(false)} onDone={() => { setAnomaly(false); refresh(); }} />}
      {preview && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/90" onClick={() => setPreview(null)}>
          <div className="flex justify-end gap-2 p-3">
            <a href={preview.data} download className="rounded-lg bg-white/15 px-3 py-2 text-sm text-white" onClick={(e) => e.stopPropagation()}>
              <Copy className="mr-1 inline h-4 w-4" /> {tr('ot.download')}
            </a>
            <button type="button" className="rounded-lg bg-white/15 px-3 py-2 text-white" onClick={() => setPreview(null)}><X className="h-4 w-4" /></button>
          </div>
          {preview.mime === 'application/pdf' ? (
            <iframe title="pdf" src={preview.data} className="min-h-0 flex-1 bg-white" />
          ) : (
            <img src={preview.data} alt="" className="m-auto max-h-full max-w-full object-contain p-3" />
          )}
        </div>
      )}
    </Drawer>
  );
}
