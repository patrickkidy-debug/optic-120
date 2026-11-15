import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  FileDown,
  FileUp,
  Mail,
  MessageCircle,
  Printer,
  Save,
  Send,
  Shapes,
  Share2,
} from 'lucide-react';
import clsx from 'clsx';
import {
  PRECAL_FRAME_TYPES,
  PRECAL_DESIGNS,
  PRECAL_INDICES,
  TEMPLATE_SHAPES,
  fitToBox,
  offsetRadii,
  parseOma,
  precalSchema,
  shapeStats,
  templateRadii,
  toOma,
  type FrameType,
  type Precal,
  type TemplateShape,
  type TraceSource,
} from '@oculo/shared-types';
import { Badge, Button, PageLoader } from '../../components/ui';
import { createTrace, getTrace, updateTrace, type FrameTrace } from '../../features/oculolab/api';
import { computePrecal, fmtDpt, fmtMm } from '../../features/oculolab/precal';
import { buildPrecalSheetHtml, downloadText, openPrecalSheet } from '../../features/oculolab/precalSheet';
import { listCustomers, listPrescriptions, type Customer } from '../../features/optique/api';
import { listMeasurements } from '../../features/optique/measurements';
import { listSuppliers } from '../../features/management/api';
import type { CompanyInfo } from '../../features/optique/saleDocument';
import { useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { waLink } from '../../lib/whatsapp';
import { tr } from '../../lib/tr';
import { PhotoTracer } from './PhotoTracer';
import { ShapeView } from './ShapeView';

const L = (k: string, o?: Record<string, unknown>) => tr(`oculolab.editor.${k}`, o);
const T = (k: string, o?: Record<string, unknown>) => tr(`oculolab.${k}`, o);

/** Valeur d'ordonnance saisie en texte (« -1,25 », « +0.50 ») → nombre. */
function rxNum(v: string | null | undefined): number | null {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.').replace('−', '-').replace(/[^0-9+.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function companyInfo(): CompanyInfo {
  const user = useAuthStore.getState().user;
  return {
    name: user?.tenantName ?? 'OculoSaaS',
    logoUrl: user?.tenantLogoUrl,
    location: user?.tenantLocation,
    contactPhone: user?.tenantContactPhone,
    contactEmail: user?.tenantContactEmail,
    ...user?.tenantInvoiceSettings,
  };
}

const EMPTY_PRECAL: Precal = precalSchema.parse({});

type Step = 1 | 2 | 3 | 4;

export function OculoLabEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const isNew = !id;

  const { data: existing, isLoading } = useQuery({ queryKey: ['oculolab-trace', id], queryFn: () => getTrace(id!), enabled: !isNew });

  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<TraceSource>('PHOTO');
  const [baseRadii, setBaseRadii] = useState<number[] | null>(null);
  const [bevel, setBevel] = useState(0);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateShape>('SOFT_RECT');
  const [tplA, setTplA] = useState(52);
  const [tplB, setTplB] = useState(38);
  const [dbl, setDbl] = useState(18);
  const [frameType, setFrameType] = useState<FrameType>('FULL_RIM');
  const [frameRef, setFrameRef] = useState('');
  const [label, setLabel] = useState('');
  const [customer, setCustomer] = useState<Pick<Customer, 'id' | 'firstName' | 'lastName'> | null>(null);
  const [measurementId, setMeasurementId] = useState<string | null>(null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [precal, setPrecal] = useState<Precal>(EMPTY_PRECAL);
  const [error, setError] = useState('');
  const [omaError, setOmaError] = useState('');

  // Reprise d'une fiche existante : on va directement aux cotes.
  useEffect(() => {
    if (!existing) return;
    setSource(existing.source);
    setBaseRadii(existing.radii);
    setConfidence(existing.confidence);
    setDbl(existing.dbl);
    setFrameType(existing.frameType);
    setFrameRef(existing.frameRef ?? '');
    setLabel(existing.label ?? '');
    setCustomer(existing.customer);
    setMeasurementId(existing.measurementId);
    setPrescriptionId(existing.prescriptionId);
    setSupplierId(existing.supplierId);
    setPrecal(precalSchema.parse(existing.precal ?? {}));
    // Juste après la création : on reste sur l'envoi ; sinon reprise aux cotes.
    setStep((location.state as { step?: Step } | null)?.step ?? 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const radii = useMemo(() => (baseRadii ? (bevel ? offsetRadii(baseRadii, bevel) : baseRadii) : null), [baseRadii, bevel]);
  const result = useMemo(
    () => (radii ? computePrecal(radii, dbl, precal, { frameType, confidence }) : null),
    [radii, dbl, precal, frameType, confidence],
  );

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const supplier = suppliers?.find((s) => s.id === supplierId) ?? null;

  const draft: FrameTrace | null = radii
    ? {
        id: existing?.id ?? 'draft',
        number: existing?.number ?? L('draftNumber'),
        label: label || null,
        customerId: customer?.id ?? null,
        customer: customer ? { ...customer, phone: null } : null,
        supplierId,
        supplier: supplier
          ? { id: supplier.id, name: supplier.name, phone: supplier.phone, whatsapp: supplier.whatsapp ?? null, email: supplier.email }
          : null,
        lensOrderId: existing?.lensOrderId ?? null,
        measurementId,
        prescriptionId,
        source,
        frameType,
        frameRef: frameRef || null,
        radii,
        boxA: result!.stats.a,
        boxB: result!.stats.b,
        dbl,
        ed: result!.stats.ed,
        circumference: result!.stats.circumference,
        confidence,
        precal,
        status: existing?.status ?? 'DRAFT',
        sentAt: existing?.sentAt ?? null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    : null;

  const saveMut = useMutation({
    mutationFn: async (status?: 'SENT') => {
      if (!radii) throw new Error(L('noShape'));
      const input = {
        label,
        customerId: customer?.id ?? null,
        supplierId,
        measurementId,
        prescriptionId,
        source,
        frameType,
        frameRef: frameRef || null,
        radii,
        dbl,
        confidence,
        precal,
        ...(photoUrl ? { photoUrl } : {}),
        ...(status ? { status } : {}),
      };
      return existing ? updateTrace(existing.id, input) : createTrace(input);
    },
    onSuccess: (saved) => {
      setError('');
      qc.invalidateQueries({ queryKey: ['oculolab-traces'] });
      qc.setQueryData(['oculolab-trace', saved.id], saved);
      if (isNew) navigate(`/oculolab/${saved.id}`, { replace: true, state: { step: 4 } });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (!isNew && isLoading) return <PageLoader />;

  const setEye = (side: 'od' | 'og', patch: Partial<Precal['od']>) =>
    setPrecal((p) => ({ ...p, [side]: { ...p[side], ...patch } }));

  const stepsDef: { n: Step; label: string }[] = [
    { n: 1, label: L('step1') },
    { n: 2, label: L('step2') },
    { n: 3, label: L('step3') },
    { n: 4, label: L('step4') },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/oculolab" className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-content">
            <ArrowLeft className="h-4 w-4" /> OculoLab
          </Link>
          <h1 className="mt-1 font-arcade text-[24px] leading-tight text-content sm:text-[28px]">
            {existing ? existing.number : L('newTitle')}
          </h1>
          <span aria-hidden className="mt-2 block h-1.5 w-14 rounded-full bg-brand" />
        </div>
        {existing && <Badge tone={existing.status === 'SENT' ? 'success' : 'neutral'}>{T(`status_${existing.status}`)}</Badge>}
      </div>

      {/* Étapes */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stepsDef.map((s) => {
          const reachable = s.n === 1 || Boolean(radii);
          return (
            <button
              key={s.n}
              type="button"
              disabled={!reachable}
              onClick={() => setStep(s.n)}
              className={clsx(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition disabled:opacity-40',
                step === s.n ? 'border-primary bg-primary-soft font-semibold text-content' : 'text-content-muted hover:text-content',
              )}
            >
              <span
                className={clsx(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-lg font-arcade text-xs',
                  step === s.n ? 'bg-brand text-white' : step > s.n ? 'bg-[color:var(--success)]/20 text-success' : 'bg-surface-2',
                )}
              >
                {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Forme */}
      {step === 1 && (
        <div className="card p-5">
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {(
              [
                ['PHOTO', Camera, L('srcPhoto'), L('srcPhotoHint')],
                ['TEMPLATE', Shapes, L('srcTemplate'), L('srcTemplateHint')],
                ['OMA', FileUp, L('srcOma'), L('srcOmaHint')],
              ] as const
            ).map(([s, Icon, title, hint]) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={clsx(
                  'rounded-2xl border p-3 text-left transition',
                  source === s ? 'border-primary bg-primary-soft shadow-[4px_4px_0_#7c3aed]' : 'hover:border-primary/50',
                )}
              >
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-1.5 font-semibold text-content">{title}</p>
                <p className="text-xs text-content-muted">{hint}</p>
              </button>
            ))}
          </div>

          {source === 'PHOTO' && (
            <PhotoTracer
              onDone={(r) => {
                setBaseRadii(r.radii);
                setConfidence(r.confidence);
                setPhotoUrl(r.photoUrl);
                // Bord intérieur d'un cercle mesuré : le verre entre dans le drageoir (≈ 0,5 mm).
                setBevel(r.innerRim && frameType === 'FULL_RIM' ? 0.5 : 0);
                if (r.dbl) setDbl(r.dbl);
                setStep(2);
              }}
            />
          )}

          {source === 'TEMPLATE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TEMPLATE_SHAPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTemplate(s)}
                    className={clsx(
                      'rounded-xl border p-2 text-center text-xs transition',
                      template === s ? 'border-primary bg-primary-soft font-semibold text-content' : 'text-content-muted hover:text-content',
                    )}
                  >
                    <ShapeView radii={templateRadii(s, 52, s === 'ROUND' ? 52 : 38)} className="mx-auto h-14 w-20" />
                    {T(`shape_${s}`)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <NumField label={L('aLabel')} value={tplA} onChange={setTplA} min={30} max={80} />
                <NumField label={L('bLabel')} value={tplB} onChange={setTplB} min={15} max={70} />
                <Button
                  onClick={() => {
                    setBaseRadii(templateRadii(template, tplA, tplB));
                    setConfidence(null);
                    setPhotoUrl(null);
                    setBevel(0);
                    setStep(2);
                  }}
                >
                  {L('useTemplate')} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {source === 'OMA' && (
            <div className="space-y-3">
              <p className="text-sm text-content-muted">{L('omaHelp')}</p>
              <label className="btn-outline inline-flex h-11 cursor-pointer rounded-xl px-4 text-sm">
                <FileUp className="h-4 w-4" /> {L('omaPick')}
                <input
                  type="file"
                  accept=".oma,.vca,.txt,.dat"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const parsed = parseOma(await f.text());
                    if (!parsed) {
                      setOmaError(L('omaInvalid'));
                      return;
                    }
                    setOmaError('');
                    setBaseRadii(parsed.radii);
                    if (parsed.dbl) setDbl(parsed.dbl);
                    setConfidence(null);
                    setPhotoUrl(null);
                    setBevel(0);
                    setStep(2);
                  }}
                />
              </label>
              {omaError && <p className="text-sm text-danger">{omaError}</p>}
            </div>
          )}
        </div>
      )}

      {/* 2. Cotes */}
      {step === 2 && radii && result && (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="card card-sticker p-5" style={{ ['--sticker' as string]: '#7c3aed' }}>
            <ShapeView radii={radii} pair dbl={dbl} showBox className="w-full text-content" strokeWidth={0.5} />
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              <Stat label="A" value={result.stats.a} />
              <Stat label="B" value={result.stats.b} />
              <Stat label={L('dbl')} value={dbl} />
              <Stat label="ED" value={result.stats.ed} />
              <Stat label={L('framePd')} value={result.framePd} />
              <Stat label={L('circ')} value={result.stats.circumference} />
            </div>
            {confidence != null && (
              <p className={clsx('mt-3 text-xs', confidence >= 75 ? 'text-success' : 'text-warning')}>
                {L('detectionConfidence', { n: confidence })}
              </p>
            )}
          </div>
          <div className="card space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <NumField label={L('dbl')} value={dbl} onChange={setDbl} min={5} max={40} step={0.5} />
              <label className="block text-sm">
                <span className="text-content-muted">{L('frameType')}</span>
                <select className="input mt-1" value={frameType} onChange={(e) => setFrameType(e.target.value as FrameType)}>
                  {PRECAL_FRAME_TYPES.map((f) => (
                    <option key={f} value={f}>{T(`type_${f}`)}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-content-muted">{L('frameRef')}</span>
              <input className="input mt-1" value={frameRef} placeholder="Ray-Ban RB5154 · 51□21 145" onChange={(e) => setFrameRef(e.target.value)} />
            </label>
            <EngravedFit
              frameRef={frameRef}
              current={result.stats}
              onFit={(a, b, bridge) => {
                setBaseRadii((r) => (r ? fitToBox(r, Math.max(1, a - 2 * bevel), Math.max(1, b - 2 * bevel)) : r));
                if (bridge) setDbl(bridge);
              }}
            />
            <NumField label={L('bevel')} hint={L('bevelHint')} value={bevel} onChange={setBevel} min={0} max={2} step={0.1} />
            <div className="flex justify-between gap-2 pt-1">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> {L('reshape')}
              </Button>
              <Button onClick={() => setStep(3)}>
                {L('next')} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Centrage et verres */}
      {step === 3 && radii && result && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="card space-y-4 p-5">
            <CustomerPicker
              value={customer}
              onChange={(c) => {
                setCustomer(c);
                setMeasurementId(null);
                setPrescriptionId(null);
              }}
            />
            {customer && (
              <ClientSources
                customerId={customer.id}
                measurementId={measurementId}
                prescriptionId={prescriptionId}
                onMeasurement={(m) => {
                  setMeasurementId(m?.id ?? null);
                  if (!m) return;
                  setEye('od', { monoPd: m.odMonoPd ?? undefined, height: m.odHeight ?? undefined });
                  setEye('og', { monoPd: m.ogMonoPd ?? undefined, height: m.ogHeight ?? undefined });
                }}
                onPrescription={(p) => {
                  setPrescriptionId(p?.id ?? null);
                  if (!p) return;
                  setEye('od', { sphere: rxNum(p.odSphere), cylinder: rxNum(p.odCylinder), axis: rxNum(p.odAxis), addition: rxNum(p.odAddition) });
                  setEye('og', { sphere: rxNum(p.ogSphere), cylinder: rxNum(p.ogCylinder), axis: rxNum(p.ogAxis), addition: rxNum(p.ogAddition) });
                  if (rxNum(p.odAddition) || rxNum(p.ogAddition)) setPrecal((x) => ({ ...x, design: x.design === 'SINGLE_VISION' ? 'PROGRESSIVE' : x.design }));
                }}
              />
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-content-faint">
                    <th />
                    <th className="px-1 pb-1">{L('sphere')}</th>
                    <th className="px-1 pb-1">{L('cylinder')}</th>
                    <th className="px-1 pb-1">{L('axis')}</th>
                    <th className="px-1 pb-1">{L('addition')}</th>
                    <th className="px-1 pb-1">{L('monoPd')}</th>
                    <th className="px-1 pb-1">{L('height')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(['od', 'og'] as const).map((side) => (
                    <tr key={side}>
                      <th className="pr-2 text-left font-arcade text-sm text-content">{side.toUpperCase()}</th>
                      {(['sphere', 'cylinder', 'axis', 'addition', 'monoPd', 'height'] as const).map((k) => (
                        <td key={k} className="p-1">
                          <input
                            type="number"
                            step={k === 'axis' ? 1 : k === 'monoPd' || k === 'height' ? 0.5 : 0.25}
                            className="input h-9 px-2 text-center"
                            value={precal[side][k] ?? ''}
                            onChange={(e) => setEye(side, { [k]: e.target.value === '' ? null : Number(e.target.value) })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-content-muted">{L('design')}</span>
                <select className="input mt-1" value={precal.design} onChange={(e) => setPrecal((p) => ({ ...p, design: e.target.value as Precal['design'] }))}>
                  {PRECAL_DESIGNS.map((d) => (
                    <option key={d} value={d}>{T(`design_${d}`)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-content-muted">{L('index')}</span>
                <select
                  className="input mt-1"
                  value={precal.index ?? ''}
                  onChange={(e) => setPrecal((p) => ({ ...p, index: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">—</option>
                  {PRECAL_INDICES.map((n) => (
                    <option key={n} value={n}>
                      {n.toFixed(2)}
                      {n === Math.max(result.od.suggestedIndex ?? 0, result.og.suggestedIndex ?? 0) ? ` — ${L('suggested')}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-content-muted">{L('material')}</span>
                <input className="input mt-1" value={precal.material ?? ''} onChange={(e) => setPrecal((p) => ({ ...p, material: e.target.value }))} />
              </label>
              <label className="block text-sm">
                <span className="text-content-muted">{L('treatments')}</span>
                <input className="input mt-1" value={precal.treatments ?? ''} placeholder={L('treatmentsPh')} onChange={(e) => setPrecal((p) => ({ ...p, treatments: e.target.value }))} />
              </label>
              {(precal.design === 'PROGRESSIVE' || precal.design === 'BIFOCAL') && (
                <NumField
                  label={L('minFitting')}
                  value={precal.minFittingHeight ?? 16}
                  onChange={(v) => setPrecal((p) => ({ ...p, minFittingHeight: v }))}
                  min={10}
                  max={30}
                />
              )}
            </div>
            <label className="block text-sm">
              <span className="text-content-muted">{L('notes')}</span>
              <textarea className="input mt-1 min-h-[70px]" value={precal.notes ?? ''} onChange={(e) => setPrecal((p) => ({ ...p, notes: e.target.value }))} />
            </label>
          </div>

          {/* Résultats en direct */}
          <div className="space-y-4">
            <div className="card card-sticker p-5" style={{ ['--sticker' as string]: '#ec4899' }}>
              <ShapeView radii={radii} pair dbl={dbl} showBox oc={{ od: result.od.oc, og: result.og.oc }} className="w-full text-content" strokeWidth={0.5} />
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-content-faint">
                    <th />
                    <th>OD</th>
                    <th>OG</th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  <ResRow label={L('hDec')} od={fmtMm(result.od.oc.x, true)} og={fmtMm(result.og.oc.x, true)} />
                  <ResRow label={L('vDec')} od={fmtMm(result.od.oc.y, true)} og={fmtMm(result.og.oc.y, true)} />
                  <ResRow label={L('mbd')} od={`Ø ${fmtMm(result.od.mbd)}`} og={`Ø ${fmtMm(result.og.mbd)}`} />
                  <ResRow
                    label={L('blank')}
                    od={result.od.blank ? `Ø ${result.od.blank}` : '> 85'}
                    og={result.og.blank ? `Ø ${result.og.blank}` : '> 85'}
                    strong
                  />
                  <ResRow label={L('power')} od={fmtDpt(result.od.power)} og={fmtDpt(result.og.power)} />
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-content-faint">{L('decLegend')}</p>
            </div>
            <ThicknessCard result={result} chosen={precal.index} />
            <Warnings result={result} />
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4" /> {L('back')}
              </Button>
              <Button onClick={() => setStep(4)}>
                {L('toSheet')} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Fiche et envoi */}
      {step === 4 && draft && result && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="card overflow-hidden p-0">
            <iframe title={L('preview')} srcDoc={buildPrecalSheetHtml(draft, companyInfo())} className="h-[720px] w-full bg-white" />
          </div>
          <div className="card space-y-4 p-5">
            <label className="block text-sm">
              <span className="text-content-muted">{L('label')}</span>
              <input className="input mt-1" value={label} placeholder={L('labelPh')} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-content-muted">{L('supplier')}</span>
              <select className="input mt-1" value={supplierId ?? ''} onChange={(e) => setSupplierId(e.target.value || null)}>
                <option value="">—</option>
                {suppliers?.filter((s) => s.isActive !== false).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {suppliers && suppliers.length === 0 && (
                <Link to="/gestion/fournisseurs" className="mt-1 block text-xs text-primary underline">{L('addSupplier')}</Link>
              )}
            </label>
            {result.warnings.some((w) => w.level === 'danger') && (
              <p className="flex items-start gap-2 rounded-xl bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {L('fixBeforeSend')}
              </p>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="grid gap-2">
              <Button onClick={() => saveMut.mutate(undefined)} loading={saveMut.isPending}>
                <Save className="h-4 w-4" /> {existing ? L('save') : L('create')}
              </Button>
              <Button variant="outline" onClick={() => openPrecalSheet(draft, companyInfo())}>
                <Printer className="h-4 w-4" /> {L('print')}
              </Button>
              <Button variant="outline" onClick={() => downloadText(`${draft.number}.oma`, toOma({ radii: draft.radii, dbl, job: draft.number }))}>
                <FileDown className="h-4 w-4" /> {L('downloadOma')}
              </Button>
            </div>
            <SendBlock
              trace={draft}
              result={result}
              disabled={!existing}
              onSent={() => saveMut.mutate('SENT')}
            />
            {existing?.sentAt && (
              <p className="text-xs text-success">{L('sentOn', { date: new Date(existing.sentAt).toLocaleString() })}</p>
            )}
            <Button variant="ghost" className="w-full" onClick={() => setStep(3)}>
              <ArrowLeft className="h-4 w-4" /> {L('back')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 0.5,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="text-content-muted">{label}</span>
      <input
        type="number"
        className="input mt-1"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
      />
      {hint && <span className="mt-1 block text-xs text-content-faint">{hint}</span>}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-content-faint">{label}</p>
      <p className="font-arcade text-base text-content">{value.toFixed(1)}</p>
    </div>
  );
}

function ResRow({ label, od, og, strong }: { label: string; od: string; og: string; strong?: boolean }) {
  return (
    <tr className={clsx('border-t', strong && 'font-bold text-content')}>
      <th className="py-1.5 text-left text-xs font-medium text-content-muted">{label}</th>
      <td>{od}</td>
      <td>{og}</td>
    </tr>
  );
}

/** « 52□18 » ou « 52-18-140 » dans la référence : proposition d'ajustement aux cotes gravées. */
function EngravedFit({
  frameRef,
  current,
  onFit,
}: {
  frameRef: string;
  current: { a: number; b: number };
  onFit: (a: number, b: number, bridge: number | null) => void;
}) {
  const m = frameRef.match(/\b([3-7]\d(?:[.,]\d)?)\s*(?:□|\[\]|x|×|-|\/|\s)\s*([1-2]\d(?:[.,]\d)?)\b/i);
  const parsedA = m ? Number(m[1]!.replace(',', '.')) : null;
  const parsedDbl = m ? Number(m[2]!.replace(',', '.')) : null;
  const [a, setA] = useState<number>(parsedA ?? Math.round(current.a));
  const [b, setB] = useState<number | ''>('');
  useEffect(() => {
    if (parsedA) setA(parsedA);
  }, [parsedA]);
  return (
    <div className="rounded-xl border bg-surface-2 p-3">
      <p className="text-sm font-semibold text-content">{L('engravedTitle')}</p>
      <p className="mb-2 text-xs text-content-muted">{L('engravedHelp')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block w-24 text-xs">
          <span className="text-content-faint">A</span>
          <input type="number" step={0.5} className="input mt-1 h-9" value={a} onChange={(e) => setA(Number(e.target.value))} />
        </label>
        <label className="block w-24 text-xs">
          <span className="text-content-faint">B ({L('optional')})</span>
          <input type="number" step={0.5} className="input mt-1 h-9" value={b} onChange={(e) => setB(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
        <Button
          variant="outline"
          className="h-9"
          onClick={() => onFit(a, b === '' ? (current.b * a) / current.a : b, parsedDbl)}
          disabled={!a || a < 30}
        >
          {L('fit')}
        </Button>
      </div>
      {parsedDbl && <p className="mt-1 text-xs text-content-faint">{L('engravedFound', { a: parsedA, dbl: parsedDbl })}</p>}
    </div>
  );
}

function CustomerPicker({
  value,
  onChange,
}: {
  value: Pick<Customer, 'id' | 'firstName' | 'lastName'> | null;
  onChange: (c: Pick<Customer, 'id' | 'firstName' | 'lastName'> | null) => void;
}) {
  const [q, setQ] = useState('');
  const { data } = useQuery({ queryKey: ['customers-search', q], queryFn: () => listCustomers(q), enabled: q.trim().length >= 2 });
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border bg-surface-2 px-3 py-2">
        <span className="text-sm font-semibold text-content">{value.firstName} {value.lastName}</span>
        <button type="button" className="text-xs text-content-muted underline" onClick={() => onChange(null)}>{L('change')}</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input className="input" placeholder={L('customerSearch')} value={q} onChange={(e) => setQ(e.target.value)} />
      {data && q.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border bg-surface p-1 shadow-card-md">
          {data.length === 0 && <p className="px-3 py-2 text-sm text-content-muted">{L('noCustomer')}</p>}
          {data.slice(0, 8).map((c) => (
            <button
              key={c.id}
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
              onClick={() => {
                onChange(c);
                setQ('');
              }}
            >
              {c.firstName} {c.lastName}
              {c.phone && <span className="ml-2 text-xs text-content-faint">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientSources({
  customerId,
  measurementId,
  prescriptionId,
  onMeasurement,
  onPrescription,
}: {
  customerId: string;
  measurementId: string | null;
  prescriptionId: string | null;
  onMeasurement: (m: Awaited<ReturnType<typeof listMeasurements>>[number] | null) => void;
  onPrescription: (p: Awaited<ReturnType<typeof listPrescriptions>>[number] | null) => void;
}) {
  const { data: measures } = useQuery({ queryKey: ['measurements', customerId], queryFn: () => listMeasurements(customerId) });
  const { data: rxs } = useQuery({ queryKey: ['prescriptions', customerId], queryFn: () => listPrescriptions(customerId) });
  const d = (s: string) => new Date(s).toLocaleDateString();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="text-content-muted">{L('fromMeasurement')}</span>
        <select
          className="input mt-1"
          value={measurementId ?? ''}
          onChange={(e) => onMeasurement(measures?.find((m) => m.id === e.target.value) ?? null)}
        >
          <option value="">{measures?.length ? L('choose') : L('noMeasurement')}</option>
          {measures?.map((m) => (
            <option key={m.id} value={m.id}>
              {d(m.takenAt)} · EP {m.odMonoPd ?? '—'}/{m.ogMonoPd ?? '—'}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-content-muted">{L('fromPrescription')}</span>
        <select
          className="input mt-1"
          value={prescriptionId ?? ''}
          onChange={(e) => onPrescription(rxs?.find((p) => p.id === e.target.value) ?? null)}
        >
          <option value="">{rxs?.length ? L('choose') : L('noPrescription')}</option>
          {rxs?.map((p) => (
            <option key={p.id} value={p.id}>
              {d(p.date)} · OD {p.odSphere ?? '—'} / OG {p.ogSphere ?? '—'}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ThicknessCard({ result, chosen }: { result: ReturnType<typeof computePrecal>; chosen: number | null | undefined }) {
  const eyes = (['od', 'og'] as const).filter((s) => result[s].thickness.length);
  if (!eyes.length) return null;
  return (
    <div className="card p-4">
      <p className="mb-2 text-sm font-semibold text-content">{L('thickness')}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-center text-xs">
          <thead>
            <tr className="text-content-faint">
              <th className="text-left">{L('index')}</th>
              {PRECAL_INDICES.map((n) => (
                <th key={n} className={clsx('px-1', n === chosen && 'text-primary')}>{n.toFixed(2)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eyes.map((s) => {
              const r = result[s];
              return (
                <tr key={s} className="border-t">
                  <th className="py-1 text-left">{s.toUpperCase()}</th>
                  {r.thickness.map((t) => {
                    const v = (r.power ?? 0) < 0 ? t.edge : t.center;
                    return (
                      <td
                        key={t.index}
                        className={clsx(
                          'px-1',
                          t.index === chosen && 'font-bold text-primary',
                          t.index === r.suggestedIndex && 'underline decoration-[#ec4899] decoration-2 underline-offset-4',
                        )}
                      >
                        {v.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-content-faint">{L('thicknessHint')}</p>
    </div>
  );
}

function Warnings({ result }: { result: ReturnType<typeof computePrecal> }) {
  if (!result.warnings.length) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-[color:var(--success)]/10 px-3 py-2 text-sm text-success">
        <Check className="h-4 w-4" /> {L('allGood')}
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {result.warnings.map((w, i) => (
        <p
          key={i}
          className={clsx(
            'flex items-start gap-2 rounded-xl px-3 py-2 text-sm',
            w.level === 'danger' ? 'bg-[color:var(--danger)]/10 text-danger' : 'bg-[color:var(--warning)]/10 text-warning',
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {tr(`oculolab.warn.${w.code}`, { ...w.values, eye: w.eye ? w.eye.toUpperCase() : '' })}
        </p>
      ))}
    </div>
  );
}

/** Message récapitulatif pour le fournisseur (WhatsApp / email). */
function supplierMessage(trace: FrameTrace, result: ReturnType<typeof computePrecal>): string {
  const p = trace.precal;
  const eye = (s: 'od' | 'og') =>
    `${s.toUpperCase()} : ${fmtDpt(p[s].sphere)} (${fmtDpt(p[s].cylinder)}) ${p[s].axis ?? '—'}° Add ${fmtDpt(p[s].addition)} · EP ${fmtMm(p[s].monoPd)} · H ${fmtMm(p[s].height)} · Ø ${result[s].blank ?? '>85'}`;
  return [
    tr('oculolab.msg.hello'),
    tr('oculolab.msg.intro', { number: trace.number }),
    trace.customer ? tr('oculolab.msg.client', { name: `${trace.customer.firstName} ${trace.customer.lastName}` }) : '',
    tr('oculolab.msg.frame', { ref: trace.frameRef || trace.label || '—', type: T(`type_${trace.frameType}`) }),
    `A ${result.stats.a.toFixed(1)} · B ${result.stats.b.toFixed(1)} · DBL ${trace.dbl.toFixed(1)} · ED ${result.stats.ed.toFixed(1)}`,
    eye('od'),
    eye('og'),
    tr('oculolab.msg.lens', { design: T(`design_${p.design}`), index: p.index ? p.index.toFixed(2) : '—', treatments: p.treatments || '—' }),
    tr('oculolab.msg.files', { number: trace.number }),
  ]
    .filter(Boolean)
    .join('\n');
}

function SendBlock({
  trace,
  result,
  disabled,
  onSent,
}: {
  trace: FrameTrace;
  result: ReturnType<typeof computePrecal>;
  disabled: boolean;
  onSent: () => void;
}): ReactNode {
  const text = supplierMessage(trace, result);
  const wa = waLink(trace.supplier?.whatsapp || trace.supplier?.phone);
  const email = trace.supplier?.email;
  const omaFile = () => new File([toOma({ radii: trace.radii, dbl: trace.dbl, job: trace.number })], `${trace.number}.oma`, { type: 'application/octet-stream' });
  const canShareFiles = typeof navigator !== 'undefined' && 'canShare' in navigator && navigator.canShare?.({ files: [omaFile()] });

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="text-sm font-semibold text-content">{L('sendTitle')}</p>
      {disabled ? (
        <p className="text-xs text-content-muted">{L('saveFirst')}</p>
      ) : (
        <>
          <p className="text-xs text-content-muted">{L('sendHelp')}</p>
          <div className="grid gap-2">
            {canShareFiles && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.share({ files: [omaFile()], text, title: trace.number });
                    onSent();
                  } catch {
                    // Partage annulé par l'utilisateur : rien à faire.
                  }
                }}
              >
                <Share2 className="h-4 w-4" /> {L('share')}
              </Button>
            )}
            {wa && (
              <a
                href={`${wa}?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-outline h-10 rounded-xl text-sm"
                onClick={onSent}
              >
                <MessageCircle className="h-4 w-4 text-success" /> {L('whatsapp')}
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}?subject=${encodeURIComponent(`${T('sheet.title')} ${trace.number}`)}&body=${encodeURIComponent(text)}`}
                className="btn-outline h-10 rounded-xl text-sm"
                onClick={onSent}
              >
                <Mail className="h-4 w-4" /> {L('email')}
              </a>
            )}
            {!wa && !email && !canShareFiles && <p className="text-xs text-content-faint">{L('noContact')}</p>}
            <Button variant="ghost" onClick={onSent}>
              <Send className="h-4 w-4" /> {L('markSent')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
