import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Keyboard, Ruler, Save, Trash2, AlertTriangle } from 'lucide-react';
import type { MeasurementMethod } from '@oculo/shared-types';
import {
  createMeasurement,
  deleteMeasurement,
  listMeasurements,
  type Measurement,
  type MeasureValues,
} from '../../features/optique/measurements';
import { CustomerSearch } from '../../features/optique/SaleTools';
import { PhotoMeasure } from './measure/PhotoMeasure';
import { NumberInput } from '../../components/NumberInput';
import { PageHeader, Button, EmptyState, PageLoader, Badge } from '../../components/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { tr } from '../../lib/tr';

type FieldKey =
  | 'pdTotal'
  | 'odMonoPd'
  | 'ogMonoPd'
  | 'odHeight'
  | 'ogHeight'
  | 'nearPd'
  | 'lensWidth'
  | 'lensHeight'
  | 'bridge'
  | 'vertex'
  | 'pantoTilt'
  | 'wrapAngle';

/** Champs de la fiche, groupés comme sur une fiche de centrage papier. */
const GROUPS: { title: string; fields: { key: FieldKey; unit: string; max: number }[] }[] = [
  {
    title: 'measure.g.pd',
    fields: [
      { key: 'pdTotal', unit: 'mm', max: 90 },
      { key: 'odMonoPd', unit: 'mm', max: 45 },
      { key: 'ogMonoPd', unit: 'mm', max: 45 },
      { key: 'nearPd', unit: 'mm', max: 90 },
    ],
  },
  {
    title: 'measure.g.heights',
    fields: [
      { key: 'odHeight', unit: 'mm', max: 50 },
      { key: 'ogHeight', unit: 'mm', max: 50 },
    ],
  },
  {
    title: 'measure.g.frame',
    fields: [
      { key: 'lensWidth', unit: 'mm', max: 80 },
      { key: 'lensHeight', unit: 'mm', max: 70 },
      { key: 'bridge', unit: 'mm', max: 40 },
    ],
  },
  {
    title: 'measure.g.position',
    fields: [
      { key: 'vertex', unit: 'mm', max: 30 },
      { key: 'pantoTilt', unit: '°', max: 30 },
      { key: 'wrapAngle', unit: '°', max: 40 },
    ],
  },
];

const EMPTY: Record<FieldKey, number> = {
  pdTotal: 0, odMonoPd: 0, ogMonoPd: 0, odHeight: 0, ogHeight: 0, nearPd: 0,
  lensWidth: 0, lensHeight: 0, bridge: 0, vertex: 0, pantoTilt: 0, wrapAngle: 0,
};

const fmt = (n: number | null) => (n == null ? '—' : String(n).replace('.', ','));

export function MeasurementsPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('optique.prescriptions.create');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [tab, setTab] = useState<'photo' | 'manual'>('photo');
  const [vals, setVals] = useState<Record<FieldKey, number>>(EMPTY);
  const [method, setMethod] = useState<MeasurementMethod>('MANUAL');
  const [frameLabel, setFrameLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: history, isLoading } = useQuery({
    queryKey: ['measurements', customerId],
    queryFn: () => listMeasurements(customerId),
  });

  const save = useMutation({
    mutationFn: () => {
      const n = (k: FieldKey) => (vals[k] > 0 ? vals[k] : null);
      return createMeasurement({
        customerId: customerId ?? '',
        method,
        pdTotal: n('pdTotal'), odMonoPd: n('odMonoPd'), ogMonoPd: n('ogMonoPd'),
        odHeight: n('odHeight'), ogHeight: n('ogHeight'), nearPd: n('nearPd'),
        lensWidth: n('lensWidth'), lensHeight: n('lensHeight'), bridge: n('bridge'),
        vertex: n('vertex'), pantoTilt: n('pantoTilt'), wrapAngle: n('wrapAngle'),
        frameLabel, notes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['measurements'] });
      setVals(EMPTY);
      setFrameLabel('');
      setNotes('');
      setMethod('MANUAL');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: deleteMeasurement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['measurements'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  function applyPhoto(v: MeasureValues, m: MeasurementMethod) {
    setVals((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x != null)) }));
    setMethod(m);
    document.getElementById('measure-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const hasValue = Object.values(vals).some((v) => v > 0);
  // Cohérence : la somme des écarts mono doit retrouver l'écart total (±1 mm).
  const monoGap = vals.pdTotal > 0 && vals.odMonoPd > 0 && vals.ogMonoPd > 0 ? Math.abs(vals.odMonoPd + vals.ogMonoPd - vals.pdTotal) : 0;

  return (
    <div className="space-y-5">
      <PageHeader title={tr('measure.title')} subtitle={tr('measure.subtitle')} />

      <div className="card p-4">
        <p className="mb-1.5 text-sm font-medium text-content">{tr('measure.customer')}</p>
        <CustomerSearch value={customerId} onChange={(id) => setCustomerId(id)} />
      </div>

      {canCreate && (
        <div className="card p-4">
          <div className="mb-4 inline-flex rounded-xl bg-surface-2 p-1" role="tablist">
            {([
              ['photo', Camera, 'measure.tabPhoto'],
              ['manual', Keyboard, 'measure.tabManual'],
            ] as const).map(([k, Icon, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === k ? 'bg-surface text-content shadow-sm' : 'text-content-muted'}`}
              >
                <Icon className="h-4 w-4" /> {tr(label)}
              </button>
            ))}
          </div>
          {tab === 'photo' ? <PhotoMeasure onUse={applyPhoto} /> : <p className="text-sm text-content-muted">{tr('measure.manualHint')}</p>}
        </div>
      )}

      {canCreate && (
        <div id="measure-sheet" className="card scroll-mt-20 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display font-bold text-content">
              <Ruler className="h-5 w-5 text-primary" /> {tr('measure.sheet')}
            </h2>
            {method !== 'MANUAL' && <Badge tone="info">{tr(`measure.method.${method}`)}</Badge>}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {GROUPS.map((g) => (
              <div key={g.title} className="rounded-xl border p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">{tr(g.title)}</p>
                <div className="grid grid-cols-2 gap-2">
                  {g.fields.map((f) => (
                    <label key={f.key} className="block min-w-0">
                      <span className="mb-0.5 block truncate text-xs text-content-muted">{tr(`measure.f.${f.key}`)}</span>
                      <span className="relative block">
                        <NumberInput
                          className="input h-10 pr-9 text-right font-mono"
                          value={vals[f.key] || null}
                          decimals={1}
                          min={0}
                          max={f.max}
                          placeholder="—"
                          onChange={(n) => setVals((p) => ({ ...p, [f.key]: n }))}
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-content-faint">{f.unit}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {monoGap > 1 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> {tr('measure.monoMismatch', { gap: monoGap.toFixed(1) })}
            </p>
          )}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="label">{tr('measure.frameLabel')}</span>
              <input className="input" value={frameLabel} maxLength={160} onChange={(e) => setFrameLabel(e.target.value)} placeholder={tr('measure.frameLabelPh')} />
            </label>
            <label className="block">
              <span className="label">{tr('measure.notes')}</span>
              <input className="input" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!hasValue}>
              <Save className="h-4 w-4" /> {tr('measure.save')}
            </Button>
            {!customerId && <span className="text-xs text-content-faint">{tr('measure.noCustomer')}</span>}
            {saved && <span className="text-sm text-success">{tr('measure.saved')}</span>}
          </div>
        </div>
      )}

      <div className="card">
        <div className="border-b px-4 py-3">
          <h2 className="font-display font-bold text-content">{customerId ? tr('measure.historyCustomer') : tr('measure.historyRecent')}</h2>
        </div>
        {isLoading ? (
          <PageLoader />
        ) : !history?.length ? (
          <EmptyState icon={Ruler} title={tr('measure.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-content-faint">
                  <th className="table-cell font-semibold">{tr('measure.colDate')}</th>
                  {!customerId && <th className="table-cell font-semibold">{tr('measure.customer')}</th>}
                  <th className="table-cell text-center font-semibold">{tr('measure.colPd')}</th>
                  <th className="table-cell text-center font-semibold">{tr('measure.colMono')}</th>
                  <th className="table-cell text-center font-semibold">{tr('measure.colHeights')}</th>
                  <th className="table-cell text-center font-semibold">{tr('measure.colFrame')}</th>
                  <th className="table-cell w-10" />
                </tr>
              </thead>
              <tbody>
                {history.map((m: Measurement) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="table-cell whitespace-nowrap">
                      <p className="text-content">{formatDateTime(m.takenAt)}</p>
                      <p className="text-[11px] text-content-faint">{tr(`measure.method.${m.method}`)}{m.frameLabel ? ` · ${m.frameLabel}` : ''}</p>
                    </td>
                    {!customerId && (
                      <td className="table-cell">{m.customer ? `${m.customer.firstName} ${m.customer.lastName}` : <span className="text-content-faint">—</span>}</td>
                    )}
                    <td className="table-cell text-center font-mono">{fmt(m.pdTotal)}</td>
                    <td className="table-cell whitespace-nowrap text-center font-mono">{fmt(m.odMonoPd)} / {fmt(m.ogMonoPd)}</td>
                    <td className="table-cell whitespace-nowrap text-center font-mono">{fmt(m.odHeight)} / {fmt(m.ogHeight)}</td>
                    <td className="table-cell whitespace-nowrap text-center font-mono">{fmt(m.lensWidth)} □ {fmt(m.bridge)} · {fmt(m.lensHeight)}</td>
                    <td className="table-cell text-right">
                      {canCreate && (
                        <button
                          type="button"
                          className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                          aria-label={tr('measure.delete')}
                          onClick={() => confirm(tr('measure.deleteConfirm')) && del.mutate(m.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
