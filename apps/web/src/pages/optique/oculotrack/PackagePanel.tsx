import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, KeyRound, MessageCircle, Package, Printer, Truck, XCircle } from 'lucide-react';
import { ot, type PackageDetail } from '../../../features/oculotrack/api';
import { PackageBadge, QrImage, StageBadge, Timeline, qrDataUrl } from '../../../features/oculotrack/ui';
import { Button } from '../../../components/ui';
import { useAuthStore } from '../../../store/auth';
import { apiErrorMessage } from '../../../lib/api';
import { formatDate, formatDateTime } from '../../../lib/format';
import { tr } from '../../../lib/tr';
import { Drawer, Section } from './OrderPanel';
import { AnomalyModal, HandoverModal, ReceiveModal } from './modals';

/** Étiquette 100 × 150 mm à coller sur le colis : QR + numéro, aucune donnée client. */
async function printLabel(p: PackageDetail['package'], store: string) {
  const qr = await qrDataUrl(p.scanUrl, 420);
  const w = window.open('', '_blank', 'width=520,height=760');
  if (!w) return alert(tr('ot.allowPopups'));
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.number)}</title>
<style>@page{size:100mm 150mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#000}
.l{width:100mm;height:150mm;padding:6mm;display:flex;flex-direction:column;gap:3mm;border:1px dashed #bbb}
.t{display:flex;justify-content:space-between;font-size:9pt;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
.n{font-family:ui-monospace,Consolas,monospace;font-size:20pt;font-weight:800;text-align:center}
.q{display:flex;justify-content:center}.q img{width:58mm;height:58mm}
.r{display:flex;align-items:center;justify-content:center;gap:3mm;font-size:13pt;font-weight:700}
.i{font-size:9pt;border-top:1px solid #000;padding-top:2mm;display:grid;grid-template-columns:auto 1fr;gap:1mm 3mm}
.i b{text-transform:uppercase;font-size:7.5pt}.o{font-family:ui-monospace,Consolas,monospace;font-size:8.5pt}
.f{margin-top:auto;font-size:8pt;text-align:center}
@media print{.l{border:0}}</style></head><body><div class="l">
<div class="t"><span>OculoTrack</span><span>${esc(p.direction === 'RETURN' ? tr('ot.dir.RETURN') : tr('ot.dir.OUTBOUND'))}</span></div>
<div class="n">${esc(p.number)}</div>
<div class="q"><img src="${qr}" alt="QR"></div>
<div class="r"><span>${esc(p.fromCity || store)}</span><span>→</span><span>${esc(p.toCity || p.supplier?.name || '')}</span></div>
<div class="i"><b>${esc(tr('ot.f.from'))}</b><span>${esc(store)}</span><b>${esc(tr('ot.f.to'))}</b><span>${esc(p.supplier?.name ?? '')}</span>
<b>${esc(tr('ot.f.content'))}</b><span class="o">${esc(p.items.map((i) => i.lensOrder.trackCode).join(' · '))}</span>
${p.carrierName ? `<b>${esc(tr('ot.f.carrier'))}</b><span>${esc(p.carrierName)}${p.externalTracking ? ` · ${esc(p.externalTracking)}` : ''}</span>` : ''}
<b>${esc(tr('ot.f.date'))}</b><span>${esc(formatDate(new Date().toISOString()))}</span></div>
<div class="f">${esc(tr('ot.labelHint'))}</div></div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`);
  w.document.close();
}

export function PackagePanel({
  id,
  onClose,
  onOpenOrder,
  canManage,
  onInvite,
}: {
  id: string;
  onClose: () => void;
  onOpenOrder: (id: string) => void;
  canManage: boolean;
  /** Présent si l'utilisateur peut gérer les accès au portail. */
  onInvite?: (supplierId: string) => void;
}) {
  const qc = useQueryClient();
  const store = useAuthStore((s) => s.user?.tenantName) ?? '';
  const { data, isLoading, error } = useQuery({ queryKey: ['ot', 'package', id], queryFn: () => ot.package(id) });
  const [modal, setModal] = useState<null | 'handover' | 'receive' | 'anomaly'>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ot'] });
    qc.invalidateQueries({ queryKey: ['lens-orders'] });
  };
  const cancel = useMutation({ mutationFn: () => ot.cancelPackage(id), onSuccess: refresh, onError: (e) => alert(apiErrorMessage(e)) });
  const { data: accesses } = useQuery({ queryKey: ['ot', 'accesses'], queryFn: ot.accesses, enabled: Boolean(onInvite), retry: false });

  if (isLoading || !data) {
    return (
      <Drawer title={<p className="font-semibold">OculoTrack</p>} onClose={onClose}>
        {error ? <p className="text-sm text-danger">{apiErrorMessage(error)}</p> : <p className="text-sm text-content-muted">…</p>}
      </Drawer>
    );
  }
  const p = data.package;
  const wa = (p.supplier?.whatsapp || p.supplier?.phone || '').replace(/\D/g, '');
  const portalUrl = `${window.location.origin}/portail`;
  const openAnoms = p.anomalies.filter((a) => a.status === 'OPEN');

  return (
    <Drawer
      onClose={onClose}
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-bold text-content">{p.number}</span>
          <PackageBadge status={p.status} late={p.lateDays} />
        </div>
      }
      subtitle={<p className="mt-0.5 text-xs text-content-muted">{tr(`ot.dir.${p.direction}`)} · {tr('ot.ordersCount', { n: p.items.length })}</p>}
    >
      <section className="card flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-start">
        <QrImage value={p.scanUrl} size={168} className="shrink-0 border" />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="flex items-center gap-2 text-base font-semibold text-content">
            {p.fromCity || store} <ArrowRight className="h-4 w-4 text-primary" /> {p.toCity || p.supplier?.name}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {[
              [tr('ot.f.supplier'), p.supplier?.name],
              [tr('ot.f.carrier'), p.carrierName],
              [tr('ot.f.tracking'), p.externalTracking],
              [tr('ot.f.created'), formatDateTime(p.createdAt)],
              [tr('ot.f.shipped'), p.shippedAt ? formatDateTime(p.shippedAt) : null],
              [tr('ot.f.expected'), p.expectedAt ? formatDate(p.expectedAt) : null],
              [tr('ot.f.received'), p.receivedAt ? formatDateTime(p.receivedAt) : null],
              [tr('ot.f.weight'), p.weightGrams ? `${p.weightGrams} g` : null],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="min-w-0">
                <dt className="text-content-faint">{k}</dt>
                <dd className="truncate font-medium text-content">{v}</dd>
              </div>
            ))}
          </dl>
          {p.lateDays > 0 && (
            <p className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" /> {tr('ot.lateBanner', { n: p.lateDays })}
            </p>
          )}
        </div>
      </section>

      {onInvite && accesses && p.supplier && p.direction === 'OUTBOUND' && !accesses.some((a) => a.supplier?.id === p.supplier!.id) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
          <KeyRound className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-sm text-content">{tr('ot.noPortalForLab', { name: p.supplier.name })}</p>
          <Button onClick={() => onInvite(p.supplier!.id)}>{tr('ot.inviteLab')}</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => printLabel(p, store)}>
          <Printer className="h-4 w-4" /> {tr('ot.printLabel')}
        </Button>
        {canManage && p.direction === 'OUTBOUND' && p.status === 'PREPARING' && (
          <Button onClick={() => setModal('handover')}>
            <Truck className="h-4 w-4" /> {tr('ot.handover')}
          </Button>
        )}
        {canManage && p.direction === 'RETURN' && p.status !== 'CANCELLED' && p.items.some((i) => i.lensOrder.trackStage !== 'RECEIPT_CONFIRMED' && i.lensOrder.trackStage !== 'COMPLETED') && (
          <Button onClick={() => setModal('receive')}>
            <CheckCircle2 className="h-4 w-4" /> {tr('ot.confirmReceipt')}
          </Button>
        )}
        {wa && (
          <a
            className="btn-outline h-10 rounded-xl px-3 text-sm text-success"
            target="_blank"
            rel="noreferrer"
            href={`https://wa.me/${wa}?text=${encodeURIComponent(tr('ot.waPackage', { number: p.number, n: p.items.length, url: portalUrl }))}`}
          >
            <MessageCircle className="h-4 w-4" /> {tr('ot.notifySupplier')}
          </a>
        )}
        {canManage && (
          <Button variant="outline" onClick={() => setModal('anomaly')}>
            <AlertTriangle className="h-4 w-4" /> {tr('ot.reportAnomaly')}
          </Button>
        )}
        {canManage && p.status === 'PREPARING' && (
          <Button variant="ghost" className="text-danger" loading={cancel.isPending} onClick={() => confirm(tr('ot.cancelPackageConfirm')) && cancel.mutate()}>
            <XCircle className="h-4 w-4" /> {tr('ot.cancelPackage')}
          </Button>
        )}
      </div>

      <Section title={tr('ot.content')} icon={Package}>
        <ul className="divide-y">
          {p.items.map((i) => (
            <li key={i.lensOrderId}>
              <button type="button" onClick={() => onOpenOrder(i.lensOrderId)} className="flex w-full flex-wrap items-center gap-2 py-2.5 text-left">
                <span className="font-mono text-sm font-bold text-content">{i.lensOrder.trackCode}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-content-muted">
                  {i.lensOrder.customer ? `${i.lensOrder.customer.firstName} ${i.lensOrder.customer.lastName} · ` : ''}
                  {i.lensOrder.frameRef ?? i.lensOrder.description}
                </span>
                {i.checks && (
                  <span className={`text-xs font-semibold ${Object.values(i.checks).every(Boolean) ? 'text-success' : 'text-danger'}`}>
                    {Object.values(i.checks).every(Boolean) ? `✓ ${tr('ot.checked')}` : `⚠ ${tr('ot.checkFailed')}`}
                  </span>
                )}
                <StageBadge stage={i.lensOrder.trackStage} />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {openAnoms.length > 0 && (
        <Section title={tr('ot.tab.anomalies')} icon={AlertTriangle}>
          <ul className="space-y-2">
            {openAnoms.map((a) => (
              <li key={a.id} className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-sm">
                <p className="font-semibold text-content">{tr(`ot.an.${a.type}`)}</p>
                <p className="text-xs text-content-faint">{a.reportedByName} · {formatDateTime(a.createdAt)}</p>
                {a.comment && <p className="mt-1 text-content-muted">{a.comment}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={tr('ot.timeline')} icon={CheckCircle2}>
        <Timeline events={data.events} />
      </Section>

      {modal === 'handover' && <HandoverModal pkg={p} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === 'receive' && <ReceiveModal pkg={p} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === 'anomaly' && <AnomalyModal packageId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
    </Drawer>
  );
}
