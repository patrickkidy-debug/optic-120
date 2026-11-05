import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, KeyRound, MessageCircle, Pencil, Plus, Search, Settings2, Store, Trash2, X } from 'lucide-react';
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
import { rx, type RxLens, type RxSupplier } from '../../features/oculorx/api';
import { downloadTemplate, readCatalogFile } from '../../features/oculorx/importFile';
import { Button, Field, Modal, PageLoader } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Money, Panel, td, th, useRx } from './ui';
import { FabricationBadge, RxGuide } from './RxGuide';
import { InviteModal } from '../optique/oculotrack/modals';
import { usePermission } from '../../store/auth';
import { waNumber } from '../../features/oculorx/whatsapp';
import { NumberInput } from '../../components/NumberInput';

const geoLabel = (g: string) => RX_GEOMETRY_LABELS[g as keyof typeof RX_GEOMETRY_LABELS] ?? g;
const idx = (v: number | null) => (v == null ? '—' : v.toFixed(2).replace('.', ','));

export function RxCatalogs() {
  const { manage, margins } = useRx();
  const { data: suppliers } = useQuery({ queryKey: ['rx', 'suppliers'], queryFn: rx.suppliers });
  const [editing, setEditing] = useState<RxSupplier | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [coef, setCoef] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const qcRoot = useQueryClient();
  const clear = useMutation({
    mutationFn: (id: string) => rx.clearCatalog(id),
    onSuccess: (r) => {
      qcRoot.invalidateQueries({ queryKey: ['rx'] });
      alert(`${r.deleted} verre(s) supprimé(s)${r.deactivated ? `, ${r.deactivated} désactivé(s) car déjà commandé(s)` : ''}.`);
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const canPortal = usePermission('oculotrack.portal');

  return (
    <>
      <Panel
        title="Fournisseurs"
        actions={manage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setCoef(true)}><Settings2 className="h-4 w-4" /> Suppléments, montage et TVA</Button>
            {margins && <Button variant="outline" onClick={() => setImporting(true)}><FileUp className="h-4 w-4" /> Importer un catalogue</Button>}
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
                    <td className={`${td} text-content-muted`}>
                      {[s.contactName, s.phone].filter(Boolean).join(' · ') || '—'}
                      {waNumber(s) && (
                        <a href={`https://wa.me/${waNumber(s)}`} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex align-middle text-success" title="Écrire sur WhatsApp">
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                    </td>
                    <td className={`${td} text-content-muted`}>{s.orderEmail || <span className="text-warning">à renseigner</span>}</td>
                    <td className={`${td} text-right font-mono`}>{s._count.rxLenses}</td>
                    {manage && (
                      <td className={`${td} whitespace-nowrap text-right`}>
                        {canPortal && (
                          <button type="button" className="btn-ghost h-8 rounded-lg px-2 text-xs" title="Donner un accès au portail fournisseur (suivi des commandes)" onClick={() => setInvite(s.id)}>
                            <KeyRound className="mr-1 inline h-3.5 w-3.5" /> Portail
                          </button>
                        )}
                        <button type="button" className="btn-ghost h-8 w-8 rounded-lg p-0" aria-label="Modifier" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></button>
                        {s._count.rxLenses > 0 && (
                          <button
                            type="button"
                            className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                            aria-label="Supprimer le catalogue importé"
                            title="Supprimer le catalogue importé"
                            onClick={() => confirm(`Supprimer les ${s._count.rxLenses} verre(s) importés de ${s.name} ? Les verres déjà commandés sont seulement désactivés.`) && clear.mutate(s.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!suppliers.length && <tr><td colSpan={8} className={`${td} text-content-muted`}>Aucun fournisseur.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <RxGuide />
      <CatalogTable suppliers={suppliers ?? []} margins={margins} manage={manage} />

      {editing && <SupplierModal supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {importing && suppliers && <ImportModal suppliers={suppliers} onClose={() => setImporting(false)} />}
      {coef && <CoefficientModal onClose={() => setCoef(false)} />}
      {invite && <InviteModal supplierId={invite} onClose={() => setInvite(null)} />}
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
  const [shopEdit, setShopEdit] = useState<RxLens | null>(null);
  const { settings } = useRx();
  const [view, setView] = useState<'supplier' | 'shop'>('supplier');

  return (
    <Panel
      title={`Catalogue${lenses ? ` · ${lenses.length} verre(s)` : ''}`}
      actions={
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {([['supplier', 'Catalogue fournisseur'], ['shop', 'Catalogue boutique']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setView(k)} className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold', view === k ? 'bg-surface text-content shadow-sm' : 'text-content-muted')}>
              {label}
            </button>
          ))}
        </div>
      }
    >
      {!!settings?.shopMountingFee && (
        <p className="mb-3 rounded-lg bg-primary-soft/50 px-3 py-2 text-xs font-semibold text-content">
          Montage inclus : + {settings.shopMountingFee.toLocaleString('fr-FR')} F sur chaque paire (réglable dans « Suppléments, montage et TVA »).
        </p>
      )}
      {view === 'shop' && (
        <p className="mb-3 text-xs text-content-muted">
          Donnez à chaque verre son nom commercial en boutique et son prix de vente à la paire : OculoRX calcule alors le bénéfice réel (prix boutique − prix d'achat fournisseur).
          Un verre sans prix boutique n'a pas de prix de vente : il est à fixer avant de le vendre.
        </p>
      )}
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
                <th className={th}>{view === 'shop' ? 'Nom boutique / fournisseur' : 'Désignation'}</th>
                <th className={th}>Type</th>
                <th className={th}>Géométrie</th>
                <th className={`${th} text-right`}>Indice</th>
                <th className={th}>Matière</th>
                <th className={th}>Traitement</th>
                <th className={th}>Plage de fabrication</th>
                {margins && <th className={`${th} text-right`}>Achat / paire</th>}
                <th className={`${th} text-right`}>Prix boutique / paire</th>
                {margins && <th className={`${th} text-right`}>{view === 'shop' ? 'Bénéfice réel / paire' : 'Marge / paire'}</th>}
                {manage && <th className={th}>{view === 'shop' ? '' : 'Actif'}</th>}
              </tr>
            </thead>
            <tbody>
              {(lenses ?? []).map((l) => (
                <tr key={l.id} className={clsx('border-b last:border-0', !l.isActive && 'opacity-50')}>
                  <td className={`${td} font-mono text-xs font-bold`}>{l.reference}<span className="block font-sans text-[11px] font-normal text-content-faint">{l.supplier.name}</span></td>
                  <td className={td}>
                    {view === 'shop' ? (
                      <>
                        <span className={l.shopName ? 'font-semibold text-content' : 'italic text-content-faint'}>{l.shopName || 'Nom boutique à renseigner'}</span>
                        <span className="block text-[11px] text-content-faint">Fournisseur : {l.designation}</span>
                      </>
                    ) : (
                      <>
                        {l.designation}
                        {l.shopName && <span className="block text-[11px] text-content-faint">Boutique : {l.shopName}</span>}
                      </>
                    )}
                  </td>
                  <td className={td}><FabricationBadge value={l.fabrication} />{!l.fabrication && <span className="text-xs text-content-faint">—</span>}</td>
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
                      <Money value={l.purchasePrice != null ? l.purchasePrice * 2 : null} />
                      {!!l.priceHistory?.length && (
                        <span className="block text-[10px] text-content-faint" title={l.priceHistory.map((h) => `${(h.price * 2).toLocaleString('fr-FR')} FCFA la paire jusqu'au ${formatDate(h.until)}`).join('\n')}>
                          ancien {(l.priceHistory[l.priceHistory.length - 1].price * 2).toLocaleString('fr-FR')} · maj {formatDate(l.priceUpdatedAt)}
                        </span>
                      )}
                    </td>
                  )}
                  <td className={`${td} text-right`}>
                    {l.suggestedPrice != null ? <Money value={l.suggestedPrice * 2} /> : <span className="text-xs italic text-content-faint">à fixer</span>}
                  </td>
                  {margins && <td className={`${td} text-right font-semibold`}><Money value={l.margin != null ? l.margin * 2 : null} /></td>}
                  {manage && (
                    <td className={td}>
                      {view === 'shop' ? (
                        <button type="button" className="btn-ghost h-8 w-8 rounded-lg p-0" aria-label="Nom et prix boutique" onClick={() => setShopEdit(l)}><Store className="h-4 w-4" /></button>
                      ) : (
                        <input type="checkbox" checked={l.isActive} onChange={(e) => toggle.mutate({ id: l.id, on: e.target.checked })} aria-label="Verre actif" />
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!lenses?.length && <tr><td colSpan={11} className={`${td} py-6 text-center text-content-muted`}>Aucun verre.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {shopEdit && <ShopLensModal lens={shopEdit} margins={margins} onClose={() => setShopEdit(null)} />}
    </Panel>
  );
}

/** Catalogue boutique d'un verre : nom commercial et prix de vente au magasin. */
function ShopLensModal({ lens, margins, onClose }: { lens: RxLens; margins: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [shopName, setShopName] = useState(lens.shopName ?? '');
  // Saisie à la paire (comme l'affiche boutique) ; OculoRX garde le prix d'un verre.
  const [pairPrice, setPairPrice] = useState(lens.shopPrice ? lens.shopPrice * 2 : 0);
  const save = useMutation({
    mutationFn: () => rx.updateLens(lens.id, { shopName: shopName.trim() || null, shopPrice: pairPrice > 0 ? Math.round(pairPrice / 2) : null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rx'] }); onClose(); },
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const buyPair = lens.purchasePrice != null ? lens.purchasePrice * 2 : null;
  const profit = buyPair != null && pairPrice > 0 ? pairPrice - buyPair : null;
  return (
    <Modal open onClose={onClose} title="Catalogue boutique" size="md">
      <div className="space-y-3">
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-content-faint">Verre du fournisseur</p>
          <p className="font-semibold text-content">{lens.designation}</p>
          <p className="font-mono text-[11px] text-content-faint">{lens.reference} · {lens.supplier.name}</p>
        </div>
        <Field label="Nom commercial en boutique"><input className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="ex. Verre Confort Écran 1.56" maxLength={200} /></Field>
        <Field label="Prix de vente de la paire (FCFA)">
          <NumberInput min={0} value={pairPrice} onChange={setPairPrice} className="input text-right font-mono" placeholder="ex. 85000" />
        </Field>
        {margins && profit != null && (
          <p className={clsx('rounded-lg px-3 py-2 text-sm font-bold', profit < 0 ? 'bg-[color:var(--danger)]/10 text-danger' : 'bg-[color:var(--success)]/10 text-success')}>
            Bénéfice réel par paire : {profit < 0 ? '− ' : ''}{Math.abs(profit).toLocaleString('fr-FR')} FCFA (achat {buyPair!.toLocaleString('fr-FR')} FCFA la paire)
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={save.isPending} disabled={profit != null && profit < 0 && pairPrice > 0} onClick={() => save.mutate()}>Enregistrer</Button>
        </div>
        {profit != null && profit < 0 && pairPrice > 0 && <p className="text-right text-xs font-semibold text-danger">Vente à perte : le prix boutique doit couvrir le prix d'achat.</p>}
      </div>
    </Modal>
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
    whatsapp: supplier?.whatsapp ?? '',
    orderEmail: supplier?.orderEmail ?? '',
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
        <Field label="WhatsApp (commandes et suivi)"><input className="input" type="tel" value={f.whatsapp ?? ''} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="+221 77 000 00 00" /></Field>
        <Field label="Email de commande"><input className="input" type="email" value={f.orderEmail ?? ''} onChange={(e) => set({ orderEmail: e.target.value })} placeholder="commandes@fournisseur.com" /></Field>
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

  // Remise à zéro : un nouveau `key` vide aussi le champ fichier du navigateur.
  const [fileKey, setFileKey] = useState(0);
  function clearFile() {
    setFileName('');
    setParsed(null);
    setError('');
    setResult(null);
    setFileKey((k) => k + 1);
  }

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
          {fileName && (
            <div className="flex items-center gap-3 rounded-xl border bg-surface-2/60 px-3 py-2 text-sm">
              <FileUp className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate font-semibold text-content">{fileName}</span>
              <Button variant="ghost" onClick={clearFile}><X className="h-4 w-4" /> Retirer le fichier</Button>
            </div>
          )}
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition hover:border-primary">
            <FileUp className="h-7 w-7 text-primary" />
            <span className="text-sm font-semibold text-content">{fileName ? 'Choisir un autre fichier' : 'Choisir un fichier CSV ou Excel'}</span>
            <span className="text-xs text-content-faint">Colonnes : référence, désignation, géométrie, indice, matière, traitement, diamètre, sph/cyl/add min-max, fabrication (Stock ou RX), prix_achat_paire_ht, et facultativement nom_commercial et prix_vente_paire (catalogue boutique). Prix à la paire, comme sur les grilles fournisseurs. Séparateur « ; » ou « , », décimales avec virgule acceptées.</span>
            <input key={fileKey} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
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
                      <th className={th}>Type</th><th className={th}>Traitement</th><th className={th}>Plage</th><th className={`${th} text-right`}>Achat / paire</th><th className={th}>Nom boutique</th><th className={`${th} text-right`}>Vente / paire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.valid.slice(0, 200).map((r) => (
                      <tr key={r.reference} className="border-b last:border-0">
                        <td className={`${td} font-mono`}>{r.reference}</td><td className={td}>{r.designation}</td><td className={td}>{geoLabel(r.geometry)}</td>
                        <td className={`${td} text-right font-mono`}>{idx(r.lensIndex)}</td><td className={td}><FabricationBadge value={r.fabrication} /></td><td className={td}>{r.treatment || '—'}</td>
                        <td className={`${td} font-mono`}>{rxDiopter(r.sphMin)} / {rxDiopter(r.sphMax)} · cyl {idx(r.cylMax)}</td>
                        <td className={`${td} text-right`}><Money value={r.purchasePrice * 2} /></td>
                        <td className={td}>{r.shopName || '—'}</td>
                        <td className={`${td} text-right`}>{r.shopPrice ? <Money value={r.shopPrice * 2} /> : '—'}</td>
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
  const [f, setF] = useState({ vatRate: '18', mountedFee: '2500', urgentFee: '3000', shopMountingFee: '0' });
  useEffect(() => {
    if (!settings) return;
    setF({ vatRate: String(settings.vatRate).replace('.', ','), mountedFee: String(settings.mountedFee), urgentFee: String(settings.urgentFee), shopMountingFee: String(settings.shopMountingFee ?? 0) });
  }, [settings]);
  const n = (v: string) => Number(v.replace(',', '.'));
  const save = useMutation({
    // Les coefficients ne sont plus utilisés : on renvoie simplement les valeurs enregistrées.
    mutationFn: () =>
      rx.saveSettings({
        coefficient: settings?.coefficient ?? 2.8,
        geometryCoefficients: {},
        vatRate: n(f.vatRate),
        mountedFee: Math.round(n(f.mountedFee)),
        urgentFee: Math.round(n(f.urgentFee)),
        shopMountingFee: Math.round(n(f.shopMountingFee) || 0),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rx'] }); onClose(); },
    onError: (e) => alert(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title="Suppléments et TVA" size="md">
      <p className="mb-3 text-sm text-content-muted">Montants facturés par le fournisseur pour les options. Les verres sont exonérés de TVA : seule la part des suppléments est taxée sur les relevés. Les prix de vente se fixent dans le catalogue boutique.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="TVA sur suppléments (%)"><input className="input text-right font-mono" value={f.vatRate} onChange={(e) => setF({ ...f, vatRate: e.target.value })} /></Field>
        <Field label="Taillé-monté (FCFA)"><input className="input text-right font-mono" value={f.mountedFee} onChange={(e) => setF({ ...f, mountedFee: e.target.value })} /></Field>
        <Field label="Urgence (FCFA)"><input className="input text-right font-mono" value={f.urgentFee} onChange={(e) => setF({ ...f, urgentFee: e.target.value })} /></Field>
      </div>
      <div className="mt-4 rounded-xl border border-primary/40 bg-primary-soft/40 p-3">
        <Field label="Montage ajouté au prix de vente (FCFA par paire)">
          <input className="input text-right font-mono" inputMode="numeric" value={f.shopMountingFee} onChange={(e) => setF({ ...f, shopMountingFee: e.target.value.replace(/\D/g, '') })} placeholder="0" />
        </Field>
        <p className="mt-1 text-xs text-content-muted">Ajouté à tous les prix boutique (ex. 1 000 F tant que le montage est payé à l'extérieur). Mettez 0 pour revenir aux prix de l'affiche.</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button loading={save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
      </div>
    </Modal>
  );
}
