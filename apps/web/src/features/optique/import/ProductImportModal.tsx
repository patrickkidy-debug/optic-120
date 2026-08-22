import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileUp, Trash2, Upload } from 'lucide-react';
import { previewProductImport, commitProductImport, type ImportPreviewRow } from './api';
import { apiErrorMessage } from '../../../lib/api';
import { invalidateProductViews } from '../../../lib/invalidate';
import { Modal, Button, Badge, PageLoader } from '../../../components/ui';

const CATEGORIES = [
  { value: 'MONTURE', label: 'Montures' },
  { value: 'VERRE', label: 'Verres' },
  { value: 'LENTILLE', label: 'Lentilles' },
  { value: 'ACCESSOIRE', label: 'Accessoires' },
  { value: 'ENTRETIEN', label: "Produits d'entretien" },
  { value: 'SERVICE', label: 'Services' },
  { value: 'AUTRE', label: 'Autres' },
];

const STATUS_BADGE: Record<ImportPreviewRow['status'], { label: string; tone: 'success' | 'info' | 'danger' }> = {
  create: { label: 'Nouveau', tone: 'success' },
  update: { label: 'Mise à jour', tone: 'info' },
  error: { label: 'Erreur', tone: 'danger' },
};

type Phase = 'choose' | 'review' | 'confirm' | 'result';

export function ProductImportModal({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('choose');
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const preview = await previewProductImport(file);
      setRows(preview);
      setPhase('review');
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible de lire ce fichier"));
    } finally {
      setLoading(false);
    }
  }

  function updateRow(i: number, patch: Partial<ImportPreviewRow>) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        // Corriger un nom/référence manquant retire l'erreur.
        if (next.status === 'error' && next.name.trim()) next.status = next.existingProductId ? 'update' : 'create';
        return next;
      }),
    );
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  const usable = rows.filter((r) => r.status !== 'error');
  const toCreate = usable.filter((r) => r.status === 'create').length;
  const toUpdate = usable.filter((r) => r.status === 'update').length;

  async function confirmImport() {
    setError('');
    setLoading(true);
    try {
      const res = await commitProductImport(branchId, usable);
      invalidateProductViews(qc);
      setResult(res);
      setPhase('result');
    } catch (err) {
      setError(apiErrorMessage(err, "Échec de l'import"));
    } finally {
      setLoading(false);
    }
  }

  if (phase === 'choose') {
    return (
      <Modal open onClose={onClose} title="Importer des produits" size="md">
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            Importez un fichier Excel (.xlsx) ou CSV. OculoSaaS détecte automatiquement les colonnes
            (référence, nom, catégorie, marque, prix, stock) et vous permet de tout vérifier avant
            d'enregistrer quoi que ce soit.
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition hover:border-primary">
            <FileUp className="h-8 w-8 text-content-faint" />
            <span className="text-sm font-medium text-content">Choisir un fichier .xlsx ou .csv</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
          </label>
          {loading && <PageLoader />}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end border-t pt-3">
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (phase === 'review') {
    return (
      <Modal open onClose={onClose} title="Vérifier avant import" size="xl">
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            Corrigez ce qui doit l'être avant de valider — rien n'est encore enregistré.
          </p>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">Référence</th>
                  <th className="table-cell font-semibold">Nom</th>
                  <th className="table-cell font-semibold">Catégorie</th>
                  <th className="table-cell font-semibold">Marque</th>
                  <th className="table-cell text-right font-semibold">Achat</th>
                  <th className="table-cell text-right font-semibold">Vente</th>
                  <th className="table-cell text-center font-semibold">Stock</th>
                  <th className="table-cell font-semibold">Statut</th>
                  <th className="table-cell w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="table-cell">
                      <input
                        className="input h-8 w-24 px-2 text-xs"
                        value={r.sku}
                        onChange={(e) => updateRow(i, { sku: e.target.value })}
                      />
                    </td>
                    <td className="table-cell">
                      <input
                        className="input h-8 w-full min-w-[9rem] px-2 text-xs"
                        value={r.name}
                        onChange={(e) => updateRow(i, { name: e.target.value })}
                      />
                    </td>
                    <td className="table-cell">
                      <select
                        className="input h-8 px-2 text-xs"
                        value={r.category}
                        onChange={(e) => updateRow(i, { category: e.target.value })}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="table-cell">
                      <input
                        className="input h-8 w-24 px-2 text-xs"
                        value={r.brand}
                        onChange={(e) => updateRow(i, { brand: e.target.value })}
                      />
                    </td>
                    <td className="table-cell">
                      <input
                        type="number"
                        className="input h-8 w-20 px-2 text-right text-xs"
                        value={r.buyPrice}
                        onChange={(e) => updateRow(i, { buyPrice: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="table-cell">
                      <input
                        type="number"
                        className="input h-8 w-20 px-2 text-right text-xs"
                        value={r.sellPrice}
                        onChange={(e) => updateRow(i, { sellPrice: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="table-cell">
                      <input
                        type="number"
                        className="input h-8 w-16 px-2 text-center text-xs"
                        value={r.stock ?? ''}
                        placeholder="—"
                        onChange={(e) =>
                          updateRow(i, { stock: e.target.value === '' ? null : Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="table-cell">
                      <Badge tone={STATUS_BADGE[r.status].tone}>{STATUS_BADGE[r.status].label}</Badge>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => removeRow(i)} className="btn-ghost h-7 w-7 rounded-lg p-0 text-danger">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-sm text-content-muted">{rows.length} ligne(s)</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button disabled={usable.length === 0} onClick={() => setPhase('confirm')}>
                Continuer
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  if (phase === 'confirm') {
    return (
      <Modal open onClose={onClose} title="Confirmer l'import" size="sm">
        <div className="space-y-4 text-center">
          <p className="text-sm text-content-muted">Vous êtes sur le point d'importer :</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="font-display text-xl font-bold text-success">{toCreate}</p>
              <p className="text-xs text-content-muted">Nouveaux produits</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="font-display text-xl font-bold text-primary">{toUpdate}</p>
              <p className="text-xs text-content-muted">Mis à jour</p>
            </div>
          </div>
          {rows.length - usable.length > 0 && (
            <p className="text-xs text-content-faint">{rows.length - usable.length} ligne(s) en erreur ignorée(s).</p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-center gap-2 border-t pt-4">
            <Button variant="ghost" onClick={() => setPhase('review')}>
              Retour
            </Button>
            <Button loading={loading} onClick={() => void confirmImport()}>
              <Upload className="h-4 w-4" /> Confirmer l'import
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // result
  return (
    <Modal open onClose={onClose} title="Import terminé" size="sm">
      <div className="space-y-4 text-center">
        <p className="font-display text-lg font-bold text-content">
          {result?.created ?? 0} créé(s), {result?.updated ?? 0} mis à jour
        </p>
        {result && result.errors.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-xl bg-[color:var(--danger)]/10 p-3 text-left text-xs text-danger">
            {result.errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}
        <div className="border-t pt-4">
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  );
}
