import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, Pencil, Plus, Search, Settings2 } from 'lucide-react';
import {
  RX_GEOMETRIES,
  RX_GEOMETRY_LABELS,
  RX_INDICES,
  rxDiopter,
  rxNeedsAddition,
  rxParseRows,
  type RxLensRow,
  type RxSupplierInput,
} from '@oculo/shared-types';
import { rx, type RxSupplier } from '../../features/oculorx/api';
import { downloadTemplate, readCatalogFile } from '../../features/oculorx/importFile';
import { Button, Field, Modal, PageLoader } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Money, Panel, td, th, useRx } from './ui';

const geoLabel = (g: string) => RX_GEOMETRY_LABELS[g as keyof typeof RX_GEOMETRY_LABELS] ?? g;
const idx = (v: number | null) => (v == null ? '—' : v.toFixed(2).replace('.', ','));

export function RxCatalogs() {
  const { manage, margins } = useRx();
  const { data: suppliers } = useQuery({ queryKey: ['rx', 'suppliers'], queryFn: rx.suppliers });
  const [editing, setEditing] = useState<RxSupplier | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [coef, setCoef] = useState(false);

  return (
    <>
      <Panel
        title="Fournisseurs"
        actions={manage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setCoef(true)}><Settings2 className="h-4 w-4" /> Coefficients et suppléments</Button>
            <Button variant="outline" onClick={() => setImporting(true)}><FileUp className="h-4 w-4" /> Importer un catalogue</Button>
            <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Ajouter un fournisseur</Button>
          </div>
        )}
      >
        {!suppliers ? <PageLoader /> : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>Fournisseur</th>
                  <th className={th}>Code</th>
                  <th className={th}>Ville</th>
                  <th className={`${th} text-right`}>Délai</th>
                  <th className={th}>Contact</th>
                  <th className={th}>Email de commande</th>
                  <th className={`${th} text-right`}>Verres</th>
                  {manage && <th className={th} />}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className={`${td} font-medium text-content`}>{s.name}{s.rxDemo && <span className="badge ml-2 bg-surface-3 text-content-faint">Démo</span>}</td>
                    <td className={`${td} font-mono text-xs`}>{s.code || '—'}</td>
                    <td className={`${td} text-content-muted`}>{[s.city, s.country].filter(Boolean).join(', ') || '—'}</td>
                    <td className={`${td} text-right font-mono`}>{s.deliveryDays != null ? `${s.deliveryDays} j` : '—'}</td>
                    <td className={`${td} text-content-muted`}>{[s.contactName, s.phone].filter(Boolean).join(' · ') || '—'}</td>
                    <td className={`${td} text-content-muted`}>{s.orderEmail || <span className="text-warning">à renseigner</span>}</td>
                    <td className={`${td} text-right font-mono`}>{s._count.rxLenses}</td>
                    {manage && <td className={`${td} text-right`}><button type="button" className="btn-ghost h-8 w-8 rounded-lg p-0" aria-label="Modifier" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></button></td>}
                  </tr>
                ))}
                {!suppliers.length && <tr><td colSpan={8} className={`${td} text-content-muted`}>Aucun fournisseur.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <CatalogTable suppliers={suppliers ?? []} margins={margins} manage={manage} />

      {editing && <SupplierModal supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {importing && suppliers && <ImportModal suppliers={suppliers} onClose={() => setImporting(false)} />}
      {coef && <CoefficientModal onClose={() => setCoef(false)} />}
    </>
  );
}

function CatalogTable({ suppliers, margins, manage }: { suppliers: RxSupplier[]; margins: boolean; manage: boolean }) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [q, setQ] = useState('');
  const [geometry, setGeometry] = useState('');
  const [index, setIndex] = useState('');
  const [treatment, setTreatment] = useState('');
  const { data: lenses, isLoading } = useQuery({
    queryKey: ['rx', 'lenses', 'catalog', supplierId, q, geometry, index, treatment],
    queryFn: () => rx.lenses({ supplierId: supplierId || undefined, q: q.trim() || undefined, geometry: geometry || undefined, index: index ? Number(index) : undefined, treatment: treatment || undefined, all: manage }),
  });
  const toggle = useMutation({ mutationFn: ({ id, on }: { id: string; on: boolean }) => rx.setLensActive(id, on), onSuccess: () => qc.invalidateQueries({ queryKey: ['rx', 'lenses'] }) });

  return (
    <Panel title={`Catalogue${lenses ? ` · ${lenses.length} verre(s)` : ''}`}>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input className="input h-9 pl-9 text-sm" placeholder="Référence ou désignation" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input h-9 w-auto text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">Tous les fournisseurs</option>
          {suppliers.filter((s) => s._count.rxLenses > 0).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input h-9 w-auto text-sm" value={geometry} onChange={(e) => setGeometry(e.target.value)}>
          <option value="">Géométrie</option>
          {RX_GEOMETRIES.map((g) => <option key={g} value={g}>{RX_GEOMETRY_LABELS[g]}</option>)}
        </select>
        <select className="input h-9 w-auto text-sm" value={index} onChange={(e) => setIndex(e.target.value)}>
          <option value="">Indice</option>
          {RX_INDICES.map((i) => <option key={i} value={i}>{idx(i)}</option>)}
        </select>
        <input className="input h-9 w-40 text-sm" placeholder="Traitement" value={treatment} onChange={(e) => setTreatment(e.target.value)} />
      </div>
      {isLoading ? <PageLoader /> : (
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b">
                <th className={th}>Référence</th>
                <th className={th}>Désignation</th>
                <th className={th}>Géométrie</th>
                <th className={`${th} text-right`}>Indice</th>
                <th className={th}>Matière</th>
                <th className={th}>Traitement</th>
                <th className={th}>Plage de fabrication</th>
                {margins && <th className={`${th} text-right`}>Achat / verre</th>}
                <th className={`${th} text-right`}>Vente conseillée</th>
                {margins && <th className={`${th} text-right`}>Marge / verre</th>}
                {manage && <th className={th}>Actif</th>}
              </tr>
            </thead>
            <tbody>
              {(lenses ?? []).map((l) => (
                <tr key={l.id} className={clsx('border-b last:border-0', !l.isActive && 'opacity-50')}>
                  <td className={`${td} font-mono text-xs font-bold`}>{l.reference}<span className="block font-sans text-[11px] font-normal text-content-faint">{l.supplier.name}</span></td>
                  <td className={td}>{l.designation}</td>
                  <td className={`${td} text-content-muted`}>{geoLabel(l.geometry)}</td>
                  <td className={`${td} text-right font-mono`}>{idx(l.lensIndex)}</td>
                  <td className={`${td} text-content-muted`}>{l.material || '—'}</td>
                  <td className={`${td} text-content-muted`}>{l.treatment || '—'}</td>
                  <td className={`${td} whitespace-nowrap font-mono text-[11px] text-content-muted`}>
                    sph {rxDiopter(l.sphMin)} / {rxDiopter(l.sphMax)} · cyl {idx(l.cylMax)}
                    {rxNeedsAddition(l.geometry) && <span className="block">add {rxDiopter(l.addMin)} / {rxDiopter(l.addMax)}</span>}
                  </td>
                  {margins && (
                    <td className={`${td} text-right`}>
                      <Money value={l.purchasePrice} />
                      {!!l.priceHistory?.length && (
                        <span className="block text-[10px] text-content-faint" title={l.priceHistory.map((h) => `${h.price.toLocaleString('fr-FR')} FCFA jusqu'au ${formatDate(h.until)}`).join('\n')}>
                          ancien {l.priceHistory[l.priceHistory.length - 1].price.toLocaleString('fr-FR')} · maj {formatDate(l.priceUpdatedAt)}
                        </span>
                      )}
                    </td>
                  )}
                  <td className={`${td} text-right`}><Money value={l.suggestedPrice} /></td>
                  {margins && <td className={`${td} text-right font-semibold`}><Money value={l.margin} /></td>}
                  {manage && <td className={td}><input type="checkbox" checked={l.isActive} onChange={(e) => toggle.mutate({ id: l.id, on: e.target.checked })} aria-label="Verre actif" /></td>}
                </tr>
              ))}
              {!lenses?.length && <tr><td colSpan={11} className={`${td} py-6 text-center text-content-muted`}>Aucun verre.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function SupplierModal({ supplier, onClose }: { supplier: RxSupplier | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<RxSupplierInput>({
    name: supplier?.name ?? '',
    code: supplier?.code ?? '',
    city: supplier?.city ?? '',
    country: supplier?.country ?? '',
    deliveryDays: supplier?.deliveryDays ?? null,
    contactName: supplier?.contactName ?? '',
    phone: supplier?.phone ?? '',
    orderEmail: supplier?.orderEmail ?? '',
    rxCoefficient: supplier?.rxCoefficient ?? null,
    rxVatRate: supplier?.rxVatRate ?? null,
  });
  const set = (p: Partial<RxSupplierInput>) => setF((x) => ({ ...x, ...p }));
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  const save = useMutation({
    mutationFn: () => (supplier ? rx.updateSupplier(supplier.id, f) : rx.createSupplier(f)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rx'] }); onClose(); },
    onError: (e) => alert(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={supplier ? `Modifier ${supplier.name}` : 'Ajouter un fournisseur'} size="lg">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nom *"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Code (relevés)"><input className="input font-mono uppercase" value={f.code ?? ''} onChange={(e) => set({ code: e.target.value.toUpperCase() })} maxLength={20} placeholder="VAT" /></Field>
        <Field label="Ville"><input className="input" value={f.city ?? ''} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="Pays"><input className="input" value={f.country ?? ''} onChange={(e) => set({ country: e.target.value })} /></Field>
        <Field label="Délai moyen de livraison (jours)"><input className="input" inputMode="numeric" value={f.deliveryDays ?? ''} onChange={(e) => set({ deliveryDays: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} /></Field>
        <Field label="Contact"><input className="input" value={f.contactName ?? ''} onChange={(e) => set({ contactName: e.target.value })} /></Field>
        <Field label="Téléphone"><input className="input" type="tel" value={f.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Email de commande"><input className="input" type="email" value={f.orderEmail ?? ''} onChange={(e) => set({ orderEmail: e.target.value })} placeholder="commandes@fournisseur.com" /></Field>
        <Field label="Coefficient de vente propre (optionnel)"><input className="input" inputMode="decimal" value={f.rxCoefficient ?? ''} onChange={(e) => set({ rxCoefficient: num(e.target.value) })} placeholder="ex. 2,6" /></Field>
        <Field label="TVA sur suppléments (%) (optionnel)"><input className="input" inputMode="decimal" value={f.rxVatRate ?? ''} onChange={(e) => set({ rxVatRate: num(e.target.value) })} placeholder="18" /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button disabled={!f.name.trim()} loading={save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
      </div>
    </Modal>
  );
}

function ImportModal({ suppliers, onClose }: { suppliers: RxSupplier[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<{ valid: RxLensRow[]; invalid: { line: number; reason: string; reference?: string }[] } | null>(null);
  const [result, setResult] = useState<{ added: number; updated: number; unchanged: number } | null>(null);
  const [error, setError] = useState('');
  const commit = useMutation({
    mutationFn: () => rx.importLenses(supplierId, parsed!.valid),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ['rx'] }); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setResult(null);
    setFileName(file.name);
    try {
      const rows = await readCatalogFile(file);
      if (!rows.length) throw new Error('Le fichier ne contient aucune ligne.');
      setParsed(rxParseRows(rows));
    } catch (e) {
      setParsed(null);
      setError((e as Error).message || 'Fichier illisible');
    }
  }

  return (
    <Modal open onClose={onClose} title="Importer un catalogue fournisseur" size="xl">
      {result && parsed ? (
        <div className="space-y-4 py-4 text-center">
          <p className="font-arcade text-lg text-content">Import terminé</p>
          <p className="text-sm text-content-muted">
            <b className="text-content">{result.added}</b> verre(s) ajouté(s), <b className="text-content">{result.updated}</b> prix mis à jour,{' '}
            <b className="text-content">{parsed.invalid.length}</b> ligne(s) ignorée(s){result.unchanged ? `, ${result.unchanged} inchangé(s)` : ''}.
          </p>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Fournisseur">
              <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <div className="flex items-end">
              <Button variant="ghost" onClick={downloadTemplate}><Download className="h-4 w-4" /> Fichier modèle</Button>
            </div>
          </div>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition hover:border-primary">
            <FileUp className="h-7 w-7 text-primary" />
            <span className="text-sm font-semibold text-content">{fileName || 'Choisir un fichier CSV ou Excel'}</span>
            <span className="text-xs text-content-faint">Colonnes : référence, désignation, géométrie, indice, matière, traitement, diamètre, sph/cyl/add min-max, prix_achat_ht. Séparateur « ; » ou « , », décimales avec virgule acceptées.</span>
            <input type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          {parsed && (
            <>
              <p className="text-sm text-content-muted">
                Aperçu : <b className="text-content">{parsed.valid.length}</b> verre(s) prêt(s) à importer, <b className={parsed.invalid.length ? 'text-danger' : 'text-content'}>{parsed.invalid.length}</b> ligne(s) ignorée(s).
                Une référence déjà présente voit son prix mis à jour (l'ancien est conservé dans l'historique).
              </p>
              <div className="max-h-72 overflow-auto rounded-xl border">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b">
                      <th className={th}>Réf.</th><th className={th}>Désignation</th><th className={th}>Géom.</th><th className={`${th} text-right`}>Indice</th>
                      <th className={th}>Traitement</th><th className={th}>Plage</th><th className={`${th} text-right`}>Prix HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.valid.slice(0, 200).map((r) => (
                      <tr key={r.reference} className="border-b last:border-0">
                        <td className={`${td} font-mono`}>{r.reference}</td><td className={td}>{r.designation}</td><td className={td}>{geoLabel(r.geometry)}</td>
                        <td className={`${td} text-right font-mono`}>{idx(r.lensIndex)}</td><td className={td}>{r.treatment || '—'}</td>
                        <td className={`${td} font-mono`}>{rxDiopter(r.sphMin)} / {rxDiopter(r.sphMax)} · cyl {idx(r.cylMax)}</td>
                        <td className={`${td} text-right`}><Money value={r.purchasePrice} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!!parsed.invalid.length && (
                <div className="rounded-xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 p-3 text-xs">
                  <p className="mb-1 font-bold text-danger">Lignes ignorées</p>
                  <ul className="max-h-28 space-y-0.5 overflow-auto text-content-muted">
                    {parsed.invalid.map((x) => <li key={x.line}>Ligne {x.line}{x.reference ? ` (${x.reference})` : ''} : {x.reason}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Annuler</Button>
                <Button disabled={!parsed.valid.length || !supplierId} loading={commit.isPending} onClick={() => commit.mutate()}>Valider l'import ({parsed.valid.length})</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function CoefficientModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { settings } = useRx();
  const [f, setF] = useState({ coefficient: '2,8', vatRate: '18', mountedFee: '2500', urgentFee: '3000', geo: {} as Record<string, string> });
  useEffect(() => {
    if (!settings) return;
    const s = (n: number) => String(n).replace('.', ',');
    setF({
      coefficient: s(settings.coefficient),
      vatRate: s(settings.vatRate),
      mountedFee: String(settings.mountedFee),
      urgentFee: String(settings.urgentFee),
      geo: Object.fromEntries(Object.entries(settings.geometryCoefficients).map(([k, v]) => [k, v != null ? s(v) : ''])),
    });
  }, [settings]);
  const n = (v: string) => Number(v.replace(',', '.'));
  const save = useMutation({
    mutationFn: () =>
      rx.saveSettings({
        coefficient: n(f.coefficient),
        vatRate: n(f.vatRate),
        mountedFee: Math.round(n(f.mountedFee)),
        urgentFee: Math.round(n(f.urgentFee)),
        geometryCoefficients: Object.fromEntries(Object.entries(f.geo).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, n(v)])),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rx'] }); onClose(); },
    onError: (e) => alert(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title="Coefficients et suppléments" size="lg">
      <p className="mb-3 text-sm text-content-muted">Prix de vente conseillé = prix d'achat × coefficient, arrondi aux 500 FCFA. Priorité : coefficient du fournisseur, puis de la géométrie, puis le coefficient global. Les verres sont exonérés de TVA : seule la part des suppléments (taillé-monté, urgence) est taxée sur les relevés.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Coefficient global"><input className="input text-right font-mono" value={f.coefficient} onChange={(e) => setF({ ...f, coefficient: e.target.value })} /></Field>
        <Field label="TVA sur suppléments (%)"><input className="input text-right font-mono" value={f.vatRate} onChange={(e) => setF({ ...f, vatRate: e.target.value })} /></Field>
        <Field label="Taillé-monté (FCFA)"><input className="input text-right font-mono" value={f.mountedFee} onChange={(e) => setF({ ...f, mountedFee: e.target.value })} /></Field>
        <Field label="Urgence (FCFA)"><input className="input text-right font-mono" value={f.urgentFee} onChange={(e) => setF({ ...f, urgentFee: e.target.value })} /></Field>
      </div>
      <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-content-faint">Par géométrie (laisser vide = global)</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RX_GEOMETRIES.map((g) => (
          <Field key={g} label={RX_GEOMETRY_LABELS[g]}>
            <input className="input text-right font-mono" value={f.geo[g] ?? ''} placeholder={f.coefficient} onChange={(e) => setF({ ...f, geo: { ...f.geo, [g]: e.target.value } })} />
          </Field>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button loading={save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
      </div>
    </Modal>
  );
}
