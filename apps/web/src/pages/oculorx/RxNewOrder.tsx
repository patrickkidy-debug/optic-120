import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, FileText, MessageCircle, Printer, Search, Send } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  RX_FRAME_LABELS,
  RX_FRAME_TYPES,
  RX_GEOMETRIES,
  RX_GEOMETRY_LABELS,
  rxAdvice,
  rxChecks,
  rxDiopter,
  rxNeedsAddition,
  rxParseNumber,
  type RxFrameType,
} from '@oculo/shared-types';
import { rx, type RxLens, type RxOrder, type RxPatientSource } from '../../features/oculorx/api';
import { printOrderSheet } from '../../features/oculorx/print';
import { CustomerSearch } from '../../features/optique/SaleTools';
import { Button, PageLoader } from '../../components/ui';
import { NumberInput } from '../../components/NumberInput';
import { apiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import { Money, Panel, td, th, useRx } from './ui';
import { LensLinks } from './LensLinks';
import { FabricationBadge, RxGuide } from './RxGuide';
import { openWhatsapp, orderWhatsappText, waNumber } from '../../features/oculorx/whatsapp';

type EyeText = { sph: string; cyl: string; axis: string };
const blankEye: EyeText = { sph: '', cyl: '', axis: '' };
const chip = (on: boolean) =>
  clsx('rounded-full border px-3 py-1.5 text-xs font-semibold transition', on ? 'border-primary bg-primary-soft text-content' : 'text-content-muted hover:text-content');

/** Saisie dioptrique : accepte « -1,25 », « +2 », « 1.5 ». */
function DioptreInput({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <input
      className="input h-10 text-right font-mono"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9,.+-]/g, ''))}
      onBlur={() => {
        const n = rxParseNumber(value);
        if (n != null && /[,.]|^[+-]?\d+$/.test(value)) onChange(rxDiopter(n));
      }}
    />
  );
}

export function RxNewOrder() {
  const qc = useQueryClient();
  const { settings, margins } = useRx();
  const user = useAuthStore((s) => s.user);
  const branchId = useUIStore((s) => s.activeBranchId);
  const { data: suppliers } = useQuery({ queryKey: ['rx', 'suppliers'], queryFn: rx.suppliers });
  const withLenses = (suppliers ?? []).filter((s) => s._count.rxLenses > 0);
  const [supplierId, setSupplierId] = useState('');
  useEffect(() => { if (!supplierId && withLenses[0]) setSupplierId(withLenses[0].id); }, [withLenses, supplierId]);
  const [geometry, setGeometry] = useState('');
  const [index, setIndex] = useState<number | null>(null);
  const { data: lenses, isLoading } = useQuery({ queryKey: ['rx', 'lenses', supplierId], queryFn: () => rx.lenses({ supplierId }), enabled: Boolean(supplierId) });
  const [lensQuery, setLensQuery] = useState('');
  const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const shown = (lenses ?? []).filter(
    (l) =>
      (!geometry || l.geometry === geometry) &&
      (index == null || l.lensIndex === index) &&
      (!lensQuery.trim() || norm([l.shopName, l.designation, l.reference, l.treatment, l.material].filter(Boolean).join(' ')).includes(norm(lensQuery.trim()))),
  );
  const indices = [...new Set((lenses ?? []).map((l) => l.lensIndex).filter((x): x is number => x != null))].sort((a, b) => a - b);
  const [lens, setLens] = useState<RxLens | null>(null);

  // Patient et ordonnance
  // Arrivée depuis un dossier client / une commande de verres : ?customer=…&lensOrder=…
  const [params] = useSearchParams();
  const [customerId, setCustomerId] = useState<string | null>(params.get('customer'));
  const { data: sources } = useQuery({ queryKey: ['rx', 'patient-rx', customerId], queryFn: () => rx.patientRx(customerId!), enabled: Boolean(customerId) });
  const [usedSource, setUsedSource] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [patientName, setPatientName] = useState('');
  const [fileNumber, setFileNumber] = useState('');
  const [od, setOd] = useState<EyeText>(blankEye);
  const [og, setOg] = useState<EyeText>(blankEye);
  const [addition, setAddition] = useState('');
  const [pd, setPd] = useState('');
  const [height, setHeight] = useState('');
  const [frameType, setFrameType] = useState<RxFrameType | null>(null);
  const [mounted, setMounted] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [comment, setComment] = useState('');
  const [salePrice, setSalePrice] = useState(0);
  const [done, setDone] = useState<{ order: RxOrder; emailed: boolean } | null>(null);

  // Prix de vente de la paire : celui du catalogue boutique (sinon à saisir).
  const suggested = lens?.suggestedPrice ? lens.suggestedPrice * 2 : 0;
  useEffect(() => setSalePrice(suggested), [lens?.id, suggested]);

  function applySource(s: RxPatientSource) {
    const txt = (v: number | null) => (v == null ? '' : rxDiopter(v));
    setOd({ sph: txt(s.od.sph), cyl: s.od.cyl ? txt(s.od.cyl) : '', axis: s.od.cyl && s.od.axis != null ? String(Math.round(s.od.axis)) : '' });
    setOg({ sph: txt(s.og.sph), cyl: s.og.cyl ? txt(s.og.cyl) : '', axis: s.og.cyl && s.og.axis != null ? String(Math.round(s.og.axis)) : '' });
    setAddition(s.addition ? txt(s.addition) : '');
    if (s.pd) setPd(String(s.pd).replace('.', ','));
    if (s.height) setHeight(String(s.height).replace('.', ','));
    setUsedSource(s.id);
  }
  // Commande de verres d'origine : son ordonnance est reprise d'office.
  useEffect(() => {
    const wanted = params.get('lensOrder');
    const s = sources?.find((x) => x.id === wanted) ?? (wanted ? undefined : undefined);
    if (s && !usedSource) applySource(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  const eye = (e: EyeText) => ({ sph: rxParseNumber(e.sph), cyl: rxParseNumber(e.cyl), axis: e.axis.trim() === '' ? null : Math.round(rxParseNumber(e.axis) ?? -1) });
  const needsAdd = lens ? rxNeedsAddition(lens.geometry) : false;
  const hasPatient = Boolean(customerId || patientName.trim());
  const checks = useMemo(
    () => (lens ? rxChecks(lens, { od: eye(od), og: eye(og), addition: needsAdd ? rxParseNumber(addition) : null, hasPatient }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lens, od, og, addition, hasPatient],
  );
  const allOk = Boolean(lens) && checks.every((c) => c.ok);
  // Conseil (non bloquant) : indice et stock / RX selon l'ordonnance saisie.
  const advice = lens ? rxAdvice(lens.geometry, eye(od), eye(og)) : null;
  const adviceWarn = advice && lens
    ? lens.lensIndex != null && lens.lensIndex + 0.001 < advice.index
      ? `Ce verre est en indice ${lens.lensIndex.toFixed(2).replace('.', ',')} : un ${advice.index.toFixed(2).replace('.', ',')} serait plus fin pour cette correction.`
      : advice.needsRx && lens.fabrication === 'STOCK'
        ? 'Ce verre est un verre de stock : cette correction demande plutôt un verre RX.'
        : null
    : null;
  const fees = (mounted ? settings?.mountedFee ?? 0 : 0) + (urgent ? settings?.urgentFee ?? 0 : 0);
  const purchase = lens && lens.purchasePrice != null ? lens.purchasePrice * 2 + fees : null;
  const margin = purchase != null ? salePrice - purchase : null;
  const marginPct = margin != null && salePrice > 0 ? Math.round((margin / salePrice) * 1000) / 10 : null;

  const send = useMutation({
    mutationFn: () =>
      rx.createOrder({
        lensId: lens!.id,
        customerId,
        patientName: patientName.trim() || customerName || null,
        fileNumber: fileNumber.trim() || null,
        od: eye(od),
        og: eye(og),
        addition: needsAdd ? rxParseNumber(addition) : null,
        pd: rxParseNumber(pd),
        height: rxParseNumber(height),
        frameType,
        mounted,
        urgent,
        comment: comment.trim() || null,
        salePrice,
        branchId: branchId ?? null,
      }),
    onSuccess: (r) => {
      setDone(r);
      qc.invalidateQueries({ queryKey: ['rx'] });
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  function reset() {
    setDone(null);
    setLens(null);
    setCustomerId(null);
    setCustomerName('');
    setPatientName('');
    setFileNumber('');
    setOd(blankEye);
    setOg(blankEye);
    setAddition('');
    setPd('');
    setHeight('');
    setFrameType(null);
    setMounted(false);
    setUrgent(false);
    setComment('');
  }

  if (done) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <p className="font-arcade text-xl text-content">Commande {done.order.number} envoyée</p>
          <div className="rounded-xl border bg-surface-2 px-5 py-3 text-center">
            <p className="font-bold text-content text-base">{done.order.lens.shopName || done.order.lens.designation}</p>
            {done.order.lens.shopName && (
              <p className="mt-0.5 text-[10px] text-content-faint">
                Fournisseur : {done.order.lens.designation} ({done.order.lens.reference})
              </p>
            )}
            <p className="mt-1.5 text-xs text-content-muted">
              Patient : <b className="text-content">{done.order.patientName}</b>
              {done.order.fileNumber ? ' · Dossier ' + done.order.fileNumber : ''}
            </p>
          </div>
          <p className="max-w-md text-sm text-content-muted">
            {done.emailed
              ? `Le bon de commande a été envoyé par email à ${done.order.supplier.name}.`
              : `${done.order.supplier.name} n'a pas d'email de commande : imprimez le bon ou enregistrez-le en PDF pour le lui transmettre.`}
          </p>
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-content-muted">Commande de verres et suivi OculoTrack créés automatiquement :</p>
            <LensLinks link={done.order.lensOrder} />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => printOrderSheet(done.order, { name: user?.tenantName ?? 'Magasin', phone: user?.tenantContactPhone })}>
              <Printer className="h-4 w-4" /> Bon de commande (PDF)
            </Button>
            {waNumber(done.order.supplier) && (
              <Button variant="outline" onClick={() => openWhatsapp(waNumber(done.order.supplier)!, orderWhatsappText(done.order, user?.tenantName ?? 'Magasin'))}>
                <MessageCircle className="h-4 w-4" /> Envoyer sur WhatsApp
              </Button>
            )}
            <Button onClick={reset}>Nouvelle commande</Button>
          </div>
        </div>
      </Panel>
    );
  }

  if (!suppliers) return <PageLoader />;
  if (!withLenses.length) {
    return <Panel><p className="text-sm text-content-muted">Aucun catalogue fournisseur. Importez-en un dans « Catalogues fournisseurs » (ou chargez la démo depuis le tableau de bord).</p></Panel>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_330px]">
      <div className="min-w-0 space-y-4">
        {/* Étape A : verre */}
        <Panel title="A · Verre">
          <div className="flex flex-wrap gap-2">
            {withLenses.map((s) => (
              <button key={s.id} type="button" className={chip(s.id === supplierId)} onClick={() => { setSupplierId(s.id); setLens(null); setIndex(null); }}>
                {s.name}
              </button>
            ))}
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
            <input className="input h-10 pl-9" placeholder="Rechercher un verre : progressif, lumière bleue, photo, 1.67, LUNEO…" value={lensQuery} onChange={(e) => setLensQuery(e.target.value)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={chip(!geometry)} onClick={() => setGeometry('')}>Toutes géométries</button>
            {RX_GEOMETRIES.map((g) => (
              <button key={g} type="button" className={chip(geometry === g)} onClick={() => setGeometry(g)}>{RX_GEOMETRY_LABELS[g]}</button>
            ))}
            <span className="mx-1 h-5 w-px bg-line" />
            <button type="button" className={chip(index == null)} onClick={() => setIndex(null)}>Tous indices</button>
            {indices.map((i) => (
              <button key={i} type="button" className={clsx(chip(index === i), 'font-mono')} onClick={() => setIndex(i)}>{i.toFixed(2).replace('.', ',')}</button>
            ))}
          </div>
          <div className="-mx-4 mt-3 max-h-80 overflow-auto">
            {isLoading ? <PageLoader /> : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b">
                    <th className={th}>Verre</th>
                    <th className={th}>Plage</th>
                    <th className={`${th} text-right`}>{margins ? 'Achat / paire' : 'Vente / paire'}</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l) => (
                    <tr key={l.id} className={clsx('border-b last:border-0', lens?.id === l.id && 'bg-primary-soft/50')}>
                      <td className={td}>
                        {l.shopName ? (
                          <>
                            <span className="block font-semibold text-content text-sm">{l.shopName}</span>
                            <span className="block text-[11px] text-content-muted">
                              {RX_GEOMETRY_LABELS[l.geometry as keyof typeof RX_GEOMETRY_LABELS] ?? l.geometry}
                              {l.lensIndex ? ` · Indice ${String(l.lensIndex).replace('.', ',')}` : ''}
                              {l.treatment ? ` · ${l.treatment}` : ''}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-content-faint">
                              Fournisseur : {l.designation} ({l.reference})
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="block font-medium text-content">{l.designation}</span>
                            <span className="block text-[11px] text-content-faint">
                              <span className="font-mono">{l.reference}</span> · {RX_GEOMETRY_LABELS[l.geometry as keyof typeof RX_GEOMETRY_LABELS] ?? l.geometry}
                              {l.lensIndex ? ` · Indice ${String(l.lensIndex).replace('.', ',')}` : ''} {l.treatment ? `· ${l.treatment}` : ''}
                            </span>
                          </>
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap font-mono text-[11px] text-content-muted`}>
                        {rxDiopter(l.sphMin)} / {rxDiopter(l.sphMax)} · cyl {l.cylMax != null ? l.cylMax.toFixed(2).replace('.', ',') : '—'}
                        {rxNeedsAddition(l.geometry) && <span className="block">add {rxDiopter(l.addMin)} / {rxDiopter(l.addMax)}</span>}
                      </td>
                      <td className={`${td} text-right`}>
                        <Money value={margins ? (l.purchasePrice ?? 0) * 2 : l.suggestedPrice != null ? l.suggestedPrice * 2 : null} />
                        <span className="mt-0.5 block"><FabricationBadge value={l.fabrication} /></span>
                      </td>
                      <td className={`${td} text-right`}>
                        <Button variant={lens?.id === l.id ? 'primary' : 'outline'} onClick={() => setLens(l)}>{lens?.id === l.id ? 'Choisi' : 'Choisir'}</Button>
                      </td>
                    </tr>
                  ))}
                  {!shown.length && <tr><td className={`${td} text-content-muted`} colSpan={4}>Aucun verre pour ces filtres.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        {/* Étape B : patient et ordonnance */}
        <Panel title="B · Patient et ordonnance">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <p className="label">Patient OculoSaaS</p>
              <CustomerSearch value={customerId} onChange={(id, c) => { setCustomerId(id); setCustomerName(c ? `${c.firstName} ${c.lastName}` : ''); setUsedSource(null); }} />
            </div>
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <label className="block"><span className="label">… ou nom du patient</span><input className="input" value={patientName} onChange={(e) => setPatientName(e.target.value)} disabled={Boolean(customerId)} placeholder={customerName || 'Nom et prénom'} /></label>
              <label className="block"><span className="label">N° dossier</span><input className="input" value={fileNumber} onChange={(e) => setFileNumber(e.target.value)} /></label>
            </div>
          </div>

          {customerId && (
            <div className="mt-3 rounded-xl border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-content-faint">
                <FileText className="h-3.5 w-3.5" /> Ordonnances du patient
              </p>
              {!sources?.length ? (
                <p className="text-xs text-content-muted">Aucune ordonnance enregistrée dans son dossier ni dans ses commandes de verres.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sources.map((s) => (
                    <button key={s.id} type="button" onClick={() => applySource(s)} className={chip(usedSource === s.id)}>
                      {usedSource === s.id ? '✓ ' : ''}{s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="-mx-4 mt-4 overflow-x-auto px-4">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr>
                  <th className={th} />
                  <th className={`${th} text-right`}>Sphère</th>
                  <th className={`${th} text-right`}>Cylindre</th>
                  <th className={`${th} text-right`}>Axe (°)</th>
                </tr>
              </thead>
              <tbody>
                {([['OD', od, setOd], ['OG', og, setOg]] as const).map(([label, v, set]) => (
                  <tr key={label}>
                    <td className="pr-2 font-bold text-content">{label}</td>
                    <td className="p-1"><DioptreInput value={v.sph} onChange={(x) => set({ ...v, sph: x })} placeholder="-1,25" /></td>
                    <td className="p-1"><DioptreInput value={v.cyl} onChange={(x) => set({ ...v, cyl: x })} placeholder="-0,50" /></td>
                    <td className="p-1"><input className="input h-10 text-right font-mono" inputMode="numeric" value={v.axis} onChange={(e) => set({ ...v, axis: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="90" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="block"><span className="label">Addition{needsAdd ? ' *' : ''}</span><DioptreInput value={addition} onChange={setAddition} placeholder={needsAdd ? '+2,00' : '—'} disabled={!needsAdd} /></label>
            <label className="block"><span className="label">Écart pupillaire (mm)</span><input className="input h-10 text-right font-mono" inputMode="decimal" value={pd} onChange={(e) => setPd(e.target.value)} placeholder="63" /></label>
            <label className="block"><span className="label">Hauteur de montage (mm)</span><input className="input h-10 text-right font-mono" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="20" /></label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="label mb-0 mr-1">Monture</span>
            {RX_FRAME_TYPES.map((f) => (
              <button key={f} type="button" className={chip(frameType === f)} onClick={() => setFrameType(frameType === f ? null : f)}>{RX_FRAME_LABELS[f]}</button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={mounted} onChange={(e) => setMounted(e.target.checked)} /> Taillé-monté{margins && settings ? <span className="text-content-faint">(+ {settings.mountedFee.toLocaleString('fr-FR')} FCFA)</span> : null}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgence{margins && settings ? <span className="text-content-faint">(+ {settings.urgentFee.toLocaleString('fr-FR')} FCFA)</span> : null}</label>
          </div>
          <label className="mt-3 block"><span className="label">Commentaire au fournisseur</span><textarea className="input min-h-[70px]" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} /></label>
        </Panel>
        <RxGuide />
      </div>

      {/* Récapitulatif */}
      <div className="xl:sticky xl:top-20 xl:self-start">
        <Panel title="Récapitulatif">
          {!lens ? (
            <p className="text-sm text-content-muted">Choisissez un verre pour commencer.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-surface-2 p-3">
                {lens.shopName ? (
                  <>
                    <p className="text-base font-bold text-content">{lens.shopName}</p>
                    <p className="mt-0.5 text-xs text-content-muted">
                      {RX_GEOMETRY_LABELS[lens.geometry as keyof typeof RX_GEOMETRY_LABELS] ?? lens.geometry}
                      {lens.lensIndex ? ` · Indice ${String(lens.lensIndex).replace('.', ',')}` : ''}
                      {lens.treatment ? ` · ${lens.treatment}` : ''}
                    </p>
                    <p className="mt-1.5 border-t border-line/60 pt-1 text-[10px] text-content-faint">
                      Fournisseur : {lens.designation} ({lens.reference}) · {lens.supplier.name}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-content">{lens.designation}</p>
                    <p className="font-mono text-[11px] text-content-faint">{lens.reference} · {lens.supplier.name}</p>
                  </>
                )}
              </div>
              {advice && (
                <div className={clsx('rounded-xl border p-3 text-xs', adviceWarn ? 'border-[color:var(--warning)]/50 bg-[color:var(--warning)]/10' : 'bg-surface-2/60')}>
                  <p className="font-bold text-content">Conseil · puissance la plus forte {advice.power.toFixed(2).replace('.', ',')} D</p>
                  <p className="mt-0.5 text-content-muted">Indice : <b className="text-content">{advice.index.toFixed(2).replace('.', ',')}</b> — {advice.advice.split('— ')[1] ?? advice.advice}</p>
                  <p className="text-content-muted">
                    Fabrication : <b className="text-content">{advice.needsRx ? 'RX (sur mesure)' : 'Stock possible'}</b>
                    {advice.reasons.length > 0 && <> ({advice.reasons.join(', ')})</>}
                  </p>
                  {adviceWarn && <p className="mt-1 font-semibold text-warning">{adviceWarn}</p>}
                </div>
              )}
              <ul className="space-y-1">
                {checks.map((c) => (
                  <li key={c.key} className={clsx('flex items-start gap-2 text-xs', c.ok ? 'text-success' : 'text-danger')}>
                    {c.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    <span><b>{c.label}</b> — {c.detail}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1.5 border-t pt-3">
                {margins && purchase != null && (
                  <>
                    <div className="flex justify-between"><span className="text-content-muted">Paire de verres</span><Money value={lens.purchasePrice! * 2} /></div>
                    {fees > 0 && <div className="flex justify-between"><span className="text-content-muted">Suppléments</span><Money value={fees} /></div>}
                    <div className="flex justify-between font-semibold"><span>Prix d'achat</span><Money value={purchase} /></div>
                  </>
                )}
                <label className="flex items-center justify-between gap-3 pt-1">
                  <span className="font-semibold">Prix de vente patient</span>
                  <NumberInput min={0} value={salePrice} onChange={setSalePrice} className="input h-9 w-36 text-right font-mono" />
                </label>
                {suggested > 0 && salePrice !== suggested && (
                  <button type="button" className="text-[11px] text-primary" onClick={() => setSalePrice(suggested)}>Revenir au prix boutique ({suggested.toLocaleString('fr-FR')} FCFA)</button>
                )}
                {margins && margin != null && (
                  <div className={clsx('flex justify-between rounded-lg px-2 py-1.5 font-bold', margin < 0 ? 'bg-[color:var(--danger)]/10 text-danger' : 'bg-[color:var(--success)]/10 text-success')}>
                    <span>Marge</span>
                    <span className="font-mono">{margin < 0 ? '− ' : ''}{Math.abs(margin).toLocaleString('fr-FR')} FCFA · {String(marginPct ?? 0).replace('.', ',')} %</span>
                  </div>
                )}
              </div>
              {margin != null && margin < 0 && (
                <p className="rounded-lg bg-[color:var(--danger)]/10 px-2 py-1.5 text-center text-xs font-semibold text-danger">Vente à perte : augmentez le prix de vente pour envoyer.</p>
              )}
              <Button className="w-full" disabled={!allOk || salePrice <= 0 || (margin != null && margin < 0)} loading={send.isPending} onClick={() => send.mutate()}>
                <Send className="h-4 w-4" /> Envoyer la commande au fournisseur
              </Button>
              {!allOk && <p className="text-center text-[11px] text-content-faint">Corrigez les contrôles en rouge pour envoyer.</p>}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
