import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import {
  ANOMALY_CATEGORIES,
  ANOMALY_REASON_CODES,
  AnomalyCorrectionType,
  type AnomalyCategory,
  type AnomalyDeclareInput,
} from '@oculo/shared-types';
import { declareAnomaly, submitAnomaly } from '../../features/anomalies/api';
import { listProducts } from '../../features/optique/api';
import { apiErrorMessage } from '../../lib/api';
import { Modal, Field, Button } from '../../components/ui';
import {
  ANOMALY_CATEGORY_LABELS,
  ANOMALY_REASON_LABELS,
  ANOMALY_FIELDS_BY_CATEGORY,
  ANOMALY_CORRECTION_TYPES_BY_CATEGORY,
  CORRECTION_TYPE_LABELS,
} from './shared';
import { TargetPicker, type PickedTarget } from './TargetPicker';

interface SaleLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export function DeclareModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [category, setCategory] = useState<AnomalyCategory>('VENTE');
  const [correctionType, setCorrectionType] = useState<AnomalyCorrectionType>('FIELD_CORRECTION');
  const [target, setTarget] = useState<PickedTarget | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saleLines, setSaleLines] = useState<SaleLine[]>([]);
  const [cashRefund, setCashRefund] = useState('');
  const [description, setDescription] = useState('');
  const [reasonCode, setReasonCode] = useState('DATA_ENTRY_ERROR');
  const [reasonNote, setReasonNote] = useState('');
  const [comment, setComment] = useState('');
  const [submitNow, setSubmitNow] = useState(true);

  const correctionOptions = ANOMALY_CORRECTION_TYPES_BY_CATEGORY[category];
  const fields = ANOMALY_FIELDS_BY_CATEGORY[category];
  const isWholeSaleAction = correctionType === AnomalyCorrectionType.SALE_CANCELLATION || correctionType === AnomalyCorrectionType.PRODUCT_RETURN;
  const financiallySensitive = ['VENTE', 'DEVIS', 'CAISSE', 'PAIEMENT', 'ASSURANCE'].includes(category) || isWholeSaleAction;

  function resetTarget() {
    setTarget(null);
    setFieldValues({});
    setSaleLines([]);
  }

  function pickCategory(next: AnomalyCategory) {
    setCategory(next);
    setCorrectionType(ANOMALY_CORRECTION_TYPES_BY_CATEGORY[next][0]);
    resetTarget();
  }

  function onPick(t: PickedTarget) {
    setTarget(t);
    setFieldValues(t.current);
    if (t.saleItems) {
      setSaleLines(t.saleItems.map((i) => ({ productId: i.productId, productName: i.product.name, quantity: i.quantity, unitPrice: Number(i.unitPrice) })));
    }
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error('Sélectionnez un élément');
      const changes: AnomalyDeclareInput['changes'] = [];
      if (!isWholeSaleAction) {
        for (const f of fields) {
          if (f.name === 'items') {
            const newItems = JSON.stringify(saleLines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })));
            if (newItems !== target.current.items) changes.push({ fieldName: 'items', oldValue: target.current.items, newValue: newItems });
            continue;
          }
          const newVal = fieldValues[f.name] ?? '';
          const oldVal = target.current[f.name] ?? '';
          if (newVal !== oldVal) changes.push({ fieldName: f.name, oldValue: oldVal, newValue: newVal });
        }
      } else if (correctionType === AnomalyCorrectionType.PRODUCT_RETURN && cashRefund) {
        changes.push({ fieldName: 'cashRefund', oldValue: '', newValue: cashRefund });
      }
      if (!isWholeSaleAction && changes.length === 0) {
        throw new Error('Modifiez au moins une valeur avant de déclarer l’anomalie');
      }
      const anomaly = await declareAnomaly({
        category,
        correctionType,
        targetId: target.id,
        targetReference: target.reference,
        branchId: target.branchId || undefined,
        description,
        reasonCode: reasonCode as never,
        reasonNote,
        comment,
        changes,
      });
      if (submitNow) await submitAnomaly(anomaly.id);
      return anomaly;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anomalies'] });
      qc.invalidateQueries({ queryKey: ['anomalies-dashboard'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e, e instanceof Error ? e.message : undefined)),
  });

  const canSubmit = target && description.trim().length > 0 && (isWholeSaleAction || Object.keys(fieldValues).length > 0);

  return (
    <Modal open onClose={onClose} title="Déclarer une anomalie" size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie">
            <select className="input" value={category} onChange={(e) => pickCategory(e.target.value as AnomalyCategory)}>
              {ANOMALY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ANOMALY_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          {correctionOptions.length > 1 && (
            <Field label="Type de correction">
              <select
                className="input"
                value={correctionType}
                onChange={(e) => {
                  setCorrectionType(e.target.value as AnomalyCorrectionType);
                  resetTarget();
                }}
              >
                {correctionOptions.map((t) => (
                  <option key={t} value={t}>
                    {CORRECTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label="Élément concerné">
          {target ? (
            <div className="flex items-center justify-between rounded-lg border bg-surface-2 px-3 py-2">
              <span className="text-sm font-medium text-content">{target.reference}</span>
              <button type="button" onClick={resetTarget} className="text-xs text-content-muted hover:text-content">
                <ArrowLeft className="mr-1 inline h-3 w-3" /> Changer
              </button>
            </div>
          ) : (
            <TargetPicker category={category} onPick={onPick} />
          )}
        </Field>

        {target && !isWholeSaleAction && (
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
              Valeur actuelle → valeur souhaitée
            </p>
            <div className="space-y-2">
              {fields.map((f) =>
                f.name === 'items' ? (
                  <SaleLinesEditor key="items" lines={saleLines} onChange={setSaleLines} />
                ) : (
                  <div key={f.name} className="grid grid-cols-2 items-center gap-2 text-sm">
                    <div>
                      <p className="text-xs text-content-faint">{f.label}</p>
                      <p className="rounded-md bg-surface-2 px-2 py-1 text-content-muted">{target.current[f.name] || '—'}</p>
                    </div>
                    <input
                      className="input"
                      type={f.kind === 'money' || f.kind === 'int' ? 'number' : f.kind === 'date' ? 'datetime-local' : 'text'}
                      value={fieldValues[f.name] ?? ''}
                      onChange={(e) => setFieldValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      placeholder="Nouvelle valeur"
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {target && correctionType === AnomalyCorrectionType.PRODUCT_RETURN && (
          <Field label="Remboursement en espèces (facultatif)">
            <input className="input" type="number" min="0" value={cashRefund} onChange={(e) => setCashRefund(e.target.value)} />
          </Field>
        )}

        <Field label="Description">
          <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Motif">
            <select className="input" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {ANOMALY_REASON_CODES.map((r) => (
                <option key={r} value={r}>
                  {ANOMALY_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Précision sur le motif">
            <input className="input" value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} />
          </Field>
        </div>
        <Field label="Commentaire">
          <textarea className="input min-h-[50px]" value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>

        {financiallySensitive && (
          <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm font-medium text-danger">
            Cette action modifiera les données financières.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm text-content-muted">
          <input type="checkbox" checked={submitNow} onChange={(e) => setSubmitNow(e.target.checked)} />
          Soumettre immédiatement pour validation (sinon reste en brouillon)
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending} disabled={!canSubmit}>
            Déclarer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Petit éditeur de lignes pour la correction produit/quantité/prix d'une vente. */
function SaleLinesEditor({ lines, onChange }: { lines: SaleLine[]; onChange: (lines: SaleLine[]) => void }) {
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div>
      <p className="mb-1 text-xs text-content-faint">Articles (produit, quantité, prix)</p>
      <div className="space-y-1.5">
        {lines.map((l, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_80px_110px_32px] items-center gap-1.5">
            <span className="truncate text-sm text-content">{l.productName}</span>
            <input
              className="input h-8 text-sm"
              type="number"
              min="1"
              value={l.quantity}
              onChange={(e) => onChange(lines.map((x, i) => (i === idx ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x)))}
            />
            <input
              className="input h-8 text-sm"
              type="number"
              min="0"
              value={l.unitPrice}
              onChange={(e) => onChange(lines.map((x, i) => (i === idx ? { ...x, unitPrice: Math.max(0, Number(e.target.value)) } : x)))}
            />
            <button
              type="button"
              aria-label="Retirer la ligne"
              onClick={() => onChange(lines.filter((_, i) => i !== idx))}
              className="grid h-8 w-8 place-items-center rounded-md text-content-faint hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      {showPicker ? (
        <div className="mt-2 rounded-lg border p-2">
          <input
            className="input mb-2 h-8 text-sm"
            placeholder="Rechercher un produit à ajouter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <ProductQuickList
            search={search}
            onPick={(p) => {
              onChange([...lines, { productId: p.id, productName: p.name, quantity: 1, unitPrice: Number(p.sellPrice) }]);
              setShowPicker(false);
              setSearch('');
            }}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setShowPicker(true)} className="btn-outline mt-2 h-7 rounded-md px-2 text-xs">
          <Plus className="h-3.5 w-3.5" /> Ajouter un article
        </button>
      )}
    </div>
  );
}

function ProductQuickList({ search, onPick }: { search: string; onPick: (p: { id: string; name: string; sellPrice: number | string }) => void }) {
  const [items, setItems] = useState<{ id: string; name: string; sellPrice: number | string }[]>([]);
  useEffect(() => {
    if (search.trim().length < 2) {
      setItems([]);
      return;
    }
    let cancelled = false;
    listProducts({ search, pageSize: 8 }).then((r) => {
      if (!cancelled) setItems(r.items);
    });
    return () => {
      cancelled = true;
    };
  }, [search]);
  if (items.length === 0) return null;
  return (
    <div className="max-h-40 space-y-1 overflow-y-auto">
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p)}
          className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-surface-2"
        >
          {p.name} — {Number(p.sellPrice).toLocaleString('fr-FR')} FCFA
        </button>
      ))}
    </div>
  );
}
