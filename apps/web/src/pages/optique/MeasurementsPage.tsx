import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, ChevronRight, History, Keyboard, Loader2, Ruler, Save, ScanFace, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  createMeasurement,
  deleteMeasurement,
  getMeasurement,
  listMeasurements,
  updateMeasurement,
  type Measurement,
} from '../../features/optique/measurements';
import { CustomerSearch } from '../../features/optique/SaleTools';
import { CameraCapture } from './measure/CameraCapture';
import { Workspace, type SavedMarkers, type WorkspaceExisting } from './measure/Workspace';
import { NumberInput } from '../../components/NumberInput';
import { PageHeader, Button, EmptyState, PageLoader, Badge, Modal } from '../../components/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { tr } from '../../lib/tr';

type FieldKey =
  | 'pdTotal' | 'odMonoPd' | 'ogMonoPd' | 'odHeight' | 'ogHeight' | 'nearPd'
  | 'lensWidth' | 'lensHeight' | 'bridge' | 'frameWidth' | 'vertex' | 'pantoTilt' | 'wrapAngle';

/** Champs de la saisie manuelle, groupés comme une fiche de centrage. */
const GROUPS: { title: string; fields: { key: FieldKey; unit: string; max: number }[] }[] = [
  { title: 'measure.g.pd', fields: [{ key: 'odMonoPd', unit: 'mm', max: 45 }, { key: 'ogMonoPd', unit: 'mm', max: 45 }, { key: 'pdTotal', unit: 'mm', max: 90 }, { key: 'nearPd', unit: 'mm', max: 90 }] },
  { title: 'measure.g.heights', fields: [{ key: 'odHeight', unit: 'mm', max: 50 }, { key: 'ogHeight', unit: 'mm', max: 50 }] },
  { title: 'measure.g.frame', fields: [{ key: 'frameWidth', unit: 'mm', max: 200 }, { key: 'lensWidth', unit: 'mm', max: 80 }, { key: 'lensHeight', unit: 'mm', max: 70 }, { key: 'bridge', unit: 'mm', max: 40 }] },
  { title: 'measure.g.position', fields: [{ key: 'vertex', unit: 'mm', max: 30 }, { key: 'pantoTilt', unit: '°', max: 30 }, { key: 'wrapAngle', unit: '°', max: 40 }] },
];
const ALL_FIELDS = GROUPS.flatMap((g) => g.fields.map((f) => f.key));

const nfmt = (n: number | null) => (n == null ? '—' : String(n).replace('.', ','));

type Screen =
  | { kind: 'home' }
  | { kind: 'camera' }
  | { kind: 'workspace'; photo: HTMLCanvasElement | null; existing: WorkspaceExisting | null }
  | { kind: 'manual'; editing: Measurement | null };

export function MeasurementsPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('optique.prescriptions.create');
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [resumeOpen, setResumeOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const { data: history, isLoading } = useQuery({
    queryKey: ['measurements', customer?.id ?? null],
    queryFn: () => listMeasurements(customer?.id),
  });

  const del = useMutation({
    mutationFn: deleteMeasurement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['measurements'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  function saved() {
    qc.invalidateQueries({ queryKey: ['measurements'] });
    setScreen({ kind: 'home' });
    setFlash(tr('cz.savedOk'));
    setTimeout(() => setFlash(''), 4000);
  }

  /** Reprendre : photo + repères si la mesure a été prise par photo, sinon la fiche manuelle. */
  async function resume(m: Measurement) {
    setResumeOpen(false);
    if (!m.hasPhoto) {
      setScreen({ kind: 'manual', editing: m });
      return;
    }
    setLoadingId(m.id);
    try {
      const d = await getMeasurement(m.id);
      const saved = d.markers as unknown as SavedMarkers | null;
      if (!d.photoUrl || !saved || saved.v !== 1) {
        setScreen({ kind: 'manual', editing: m });
        return;
      }
      if (m.customer) setCustomer({ id: m.customer.id, name: `${m.customer.firstName} ${m.customer.lastName}` });
      setScreen({
        kind: 'workspace',
        photo: null,
        existing: {
          id: d.id,
          photoUrl: d.photoUrl,
          saved,
          params: { vertex: d.vertex, pantoTilt: d.pantoTilt, wrapAngle: d.wrapAngle, nearPd: d.nearPd },
          frameLabel: d.frameLabel,
          notes: d.notes,
        },
      });
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setLoadingId(null);
    }
  }

  if (screen.kind === 'camera') {
    return (
      <CameraCapture
        onClose={() => setScreen({ kind: 'home' })}
        onCapture={(photo) => setScreen({ kind: 'workspace', photo, existing: null })}
      />
    );
  }
  if (screen.kind === 'workspace') {
    return (
      <Workspace
        photo={screen.photo}
        existing={screen.existing}
        customerId={customer?.id ?? null}
        customerName={customer?.name}
        onClose={() => setScreen({ kind: 'home' })}
        onSaved={saved}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={tr('cz.title')} subtitle={tr('cz.subtitle')} />

      <div className="card p-4">
        <p className="mb-1.5 text-sm font-medium text-content">{tr('measure.customer')}</p>
        <CustomerSearch value={customer?.id ?? null} onChange={(id, c) => setCustomer(id ? { id, name: c ? `${c.firstName} ${c.lastName}` : customer?.name ?? '' } : null)} />
      </div>

      {flash && (
        <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-[color:var(--success)]/10 px-3 py-2 text-sm font-medium text-success">
          <ShieldCheck className="h-4 w-4" /> {flash}
        </p>
      )}

      {canCreate && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setScreen({ kind: 'camera' })}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent p-5 text-left text-white shadow-card-lg transition hover:-translate-y-0.5 md:row-span-1"
          >
            <span className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20"><ScanFace className="h-6 w-6" /></span>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-white/80">{tr('cz.recommended')}</p>
            <p className="font-display text-lg font-bold">{tr('cz.modeAuto')}</p>
            <p className="mt-1 text-sm text-white/85">{tr('cz.modeAutoHint')}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">{tr('cz.start')} <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
          </button>
          <ModeCard icon={Keyboard} title={tr('cz.modeManual')} hint={tr('cz.modeManualHint')} onClick={() => setScreen({ kind: 'manual', editing: null })} />
          <ModeCard icon={History} title={tr('cz.modeResume')} hint={tr('cz.modeResumeHint')} onClick={() => setResumeOpen(true)} />
        </div>
      )}

      {screen.kind === 'manual' && (
        <ManualSheet
          editing={screen.editing}
          customerId={customer?.id ?? null}
          onClose={() => setScreen({ kind: 'home' })}
          onSaved={saved}
        />
      )}

      <div className="card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-display font-bold text-content">{customer ? tr('measure.historyCustomer') : tr('measure.historyRecent')}</h2>
        </div>
        <HistoryList
          rows={history}
          loading={isLoading}
          loadingId={loadingId}
          showCustomer={!customer}
          canEdit={canCreate}
          onOpen={resume}
          onDelete={(m) => confirm(tr('measure.deleteConfirm')) && del.mutate(m.id)}
        />
      </div>

      {resumeOpen && (
        <Modal open onClose={() => setResumeOpen(false)} title={tr('cz.modeResume')} size="lg">
          <HistoryList rows={history} loading={isLoading} loadingId={loadingId} showCustomer={!customer} canEdit={false} onOpen={resume} onDelete={() => undefined} />
        </Modal>
      )}
    </div>
  );
}

function ModeCard({ icon: Icon, title, hint, onClick }: { icon: typeof Keyboard; title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card group p-5 text-left transition hover:-translate-y-0.5 hover:border-primary">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-6 w-6" /></span>
      <p className="mt-4 font-display text-lg font-bold text-content">{title}</p>
      <p className="mt-1 text-sm text-content-muted">{hint}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">{tr('cz.open')} <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
    </button>
  );
}

function HistoryList({
  rows,
  loading,
  loadingId,
  showCustomer,
  canEdit,
  onOpen,
  onDelete,
}: {
  rows?: Measurement[];
  loading: boolean;
  loadingId: string | null;
  showCustomer: boolean;
  canEdit: boolean;
  onOpen: (m: Measurement) => void;
  onDelete: (m: Measurement) => void;
}) {
  if (loading) return <PageLoader />;
  if (!rows?.length) return <EmptyState icon={Ruler} title={tr('measure.empty')} />;
  return (
    <ul className="divide-y">
      {rows.map((m) => (
        <li key={m.id} className="flex items-center gap-3 px-4 py-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${m.hasPhoto ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-content-muted'}`}>
            {m.hasPhoto ? <Camera className="h-5 w-5" /> : <Keyboard className="h-5 w-5" />}
          </span>
          <button type="button" onClick={() => onOpen(m)} className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-content">
              {showCustomer && (m.customer ? `${m.customer.firstName} ${m.customer.lastName} · ` : `${tr('cz.noCustomer')} · `)}
              {formatDateTime(m.takenAt)}
            </p>
            <p className="truncate font-mono text-xs text-content-muted">
              PD {nfmt(m.odMonoPd)} / {nfmt(m.ogMonoPd)} ({nfmt(m.pdTotal)}) · H {nfmt(m.odHeight)} / {nfmt(m.ogHeight)}
              {m.lensWidth != null && ` · ${nfmt(m.lensWidth)}□${nfmt(m.bridge)}`}
            </p>
          </button>
          {m.confidence != null && (
            <Badge tone={m.confidence >= 80 ? 'success' : m.confidence >= 60 ? 'warning' : 'danger'}>{m.confidence} %</Badge>
          )}
          {loadingId === m.id ? (
            <Loader2 className="h-4 w-4 animate-spin text-content-faint" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-content-faint" />
          )}
          {canEdit && (
            <button type="button" className="btn-ghost h-8 w-8 shrink-0 rounded-lg p-0 text-danger" aria-label={tr('measure.delete')} onClick={() => onDelete(m)}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ManualSheet({
  editing,
  customerId,
  onClose,
  onSaved,
}: {
  editing: Measurement | null;
  customerId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vals, setVals] = useState<Record<FieldKey, number>>(() =>
    Object.fromEntries(ALL_FIELDS.map((k) => [k, (editing?.[k] as number | null) ?? 0])) as Record<FieldKey, number>,
  );
  const [frameLabel, setFrameLabel] = useState(editing?.frameLabel ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const save = useMutation({
    mutationFn: () => {
      const payload = Object.fromEntries(ALL_FIELDS.map((k) => [k, vals[k] > 0 ? vals[k] : null])) as Record<FieldKey, number | null>;
      return editing
        ? updateMeasurement(editing.id, { ...payload, frameLabel, notes })
        : createMeasurement({ ...payload, method: 'MANUAL', customerId: customerId ?? '', frameLabel, notes });
    },
    onSuccess: onSaved,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const monoGap =
    vals.pdTotal > 0 && vals.odMonoPd > 0 && vals.ogMonoPd > 0 ? Math.abs(vals.odMonoPd + vals.ogMonoPd - vals.pdTotal) : 0;
  const hasValue = ALL_FIELDS.some((k) => vals[k] > 0);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display font-bold text-content">
          <Keyboard className="h-5 w-5 text-primary" /> {editing ? tr('cz.editManual') : tr('cz.modeManual')}
        </h2>
        <button type="button" onClick={onClose} className="btn-ghost h-8 w-8 rounded-lg p-0" aria-label={tr('ui.ui.fermer')}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {GROUPS.map((g) => (
          <div key={g.title} className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">{tr(g.title)}</p>
            <div className="grid grid-cols-2 gap-2">
              {g.fields.map((f) => (
                <label key={f.key} className="block min-w-0">
                  <span className="mb-0.5 block truncate text-xs text-content-muted">{tr(f.key === 'frameWidth' ? 'cz.frameWidth' : `measure.f.${f.key}`)}</span>
                  <span className="relative block">
                    <NumberInput
                      className="input h-10 pr-9 text-right font-mono"
                      value={vals[f.key] || null}
                      decimals={1}
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
        {!customerId && !editing && <span className="text-xs text-content-faint">{tr('measure.noCustomer')}</span>}
      </div>
    </div>
  );
}
