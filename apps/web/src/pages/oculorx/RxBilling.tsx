import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
import { rx, type RxSavedStatement, type RxStatement } from '../../features/oculorx/api';
import { printStatement } from '../../features/oculorx/print';
import { Button, Field, Modal, PageLoader } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useAuthStore } from '../../store/auth';
import { Money, Panel, currentMonth, monthLabel, td, th } from './ui';

const MONTHS = Array.from({ length: 12 }, (_, i) => currentMonth(-i));

function PaidBadge({ s }: { s: RxSavedStatement | null | undefined }) {
  if (!s) return <span className="badge bg-surface-3 text-content-faint">Non généré</span>;
  return s.paidAt
    ? <span className="badge bg-[color:var(--success)]/15 text-success">Réglé le {formatDate(s.paidAt)}</span>
    : <span className="badge bg-[color:var(--warning)]/15 text-warning">À régler</span>;
}

/** Export Excel du relevé (lignes + totaux). */
async function exportExcel(st: RxStatement) {
  const XLSX = await import('xlsx');
  const rows = [
    ['Relevé', st.number],
    ['Fournisseur', `${st.supplier.name} (${st.supplier.code})`],
    ['Période', monthLabel(st.month)],
    [],
    ['Date', 'N°', 'Patient', 'Verre', 'Suppléments', 'Montant HT (FCFA)'],
    ...st.lines.map((l) => [formatDate(l.date), l.number + (l.credit ? ' (avoir)' : ''), l.patient, l.lens, l.supplements, l.amount]),
    [],
    ['', '', '', '', 'Total HT', st.totalHt],
    ['', '', '', '', `TVA ${st.vatRate} % (suppléments ; verres exonérés)`, st.vatAmount],
    ['', '', '', '', 'Total TTC', st.totalTtc],
    ['', '', '', '', 'Échéance', formatDate(st.dueDate)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 40 }, { wch: 20 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relevé');
  XLSX.writeFile(wb, `${st.number}.xlsx`);
}

export function RxBilling() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data: suppliers } = useQuery({ queryKey: ['rx', 'suppliers'], queryFn: rx.suppliers });
  const withOrders = (suppliers ?? []).filter((s) => s._count.rxOrders > 0);
  const [supplierId, setSupplierId] = useState('');
  useEffect(() => { if (!supplierId && withOrders[0]) setSupplierId(withOrders[0].id); }, [withOrders, supplierId]);
  const [month, setMonth] = useState(currentMonth(-1));
  const [paying, setPaying] = useState<RxSavedStatement | null>(null);
  const { data, isFetching } = useQuery({
    queryKey: ['rx', 'statement', supplierId, month],
    queryFn: () => rx.previewStatement(supplierId, month),
    enabled: Boolean(supplierId),
  });
  const { data: all } = useQuery({ queryKey: ['rx', 'statements'], queryFn: rx.statements });
  const generate = useMutation({
    mutationFn: () => rx.generateStatement(supplierId, month),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rx'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const unpay = useMutation({ mutationFn: (id: string) => rx.payStatement(id, { paid: false }), onSuccess: () => qc.invalidateQueries({ queryKey: ['rx'] }) });
  const st = data?.statement;
  const saved = data?.saved;
  // Un relevé déjà généré dont les montants ont changé depuis (commande ajoutée, retour…).
  const stale = saved && st && (saved.totalTtc !== st.totalTtc || saved.orderCount !== st.orderCount);
  const store = { name: user?.tenantName ?? 'Magasin', phone: user?.tenantContactPhone, location: user?.tenantLocation };

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Mois">
            <select className="input h-10 w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </Field>
          <Field label="Fournisseur">
            <select className="input h-10 w-auto" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {!withOrders.length && <option value="">Aucun fournisseur avec commandes</option>}
              {withOrders.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          {st && <div className="pb-2"><PaidBadge s={saved} /></div>}
        </div>
      </Panel>

      {!supplierId ? (
        <Panel><p className="text-sm text-content-muted">Aucune commande pour l'instant.</p></Panel>
      ) : !st || isFetching ? <PageLoader /> : (
        <>
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Relevé fournisseur</p>
                <p className="font-mono text-lg font-bold text-content">{st.number}</p>
                <p className="text-sm text-content-muted">Période : {monthLabel(st.month)} · {st.orderCount} ligne(s)</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-content">{st.supplier.name} ({st.supplier.code})</p>
                <p className="text-content-muted">{[st.supplier.city, st.supplier.country].filter(Boolean).join(', ')}</p>
                <p className="mt-1 text-content-muted">Magasin : {store.name}</p>
              </div>
            </div>
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className={th}>Date</th><th className={th}>N°</th><th className={th}>Patient</th><th className={th}>Verre</th>
                    <th className={th}>Suppléments</th><th className={`${th} text-right`}>Montant HT</th>
                  </tr>
                </thead>
                <tbody>
                  {st.lines.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className={`${td} text-content-muted`}>{formatDate(l.date)}</td>
                      <td className={`${td} font-mono text-xs`}>{l.number}{l.credit && <span className="badge ml-1.5 bg-[color:var(--danger)]/15 text-danger">avoir</span>}</td>
                      <td className={td}>{l.patient}</td>
                      <td className={`${td} text-xs text-content-muted`}>{l.lens}</td>
                      <td className={`${td} text-xs text-content-muted`}>{l.supplements || '—'}</td>
                      <td className={`${td} text-right`}><Money value={l.amount} /></td>
                    </tr>
                  ))}
                  {!st.lines.length && <tr><td colSpan={6} className={`${td} py-6 text-center text-content-muted`}>Aucune commande ce mois-ci chez ce fournisseur.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <p className="text-sm text-content-muted">Échéance : <b className="text-content">{formatDate(st.dueDate)}</b></p>
              <dl className="w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-content-muted">Total HT</dt><dd><Money value={st.totalHt} /></dd></div>
                <div className="flex justify-between"><dt className="text-content-muted">TVA {String(st.vatRate).replace('.', ',')} % sur suppléments</dt><dd><Money value={st.vatAmount} /></dd></div>
                <p className="text-right text-[11px] text-content-faint">Verres exonérés de TVA · base taxable <Money value={st.vatBase} /></p>
                <div className="flex justify-between border-t pt-1.5 text-base font-bold"><dt>Total TTC</dt><dd><Money value={st.totalTtc} /></dd></div>
              </dl>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <Button loading={generate.isPending} onClick={() => generate.mutate()}>
                <RefreshCw className="h-4 w-4" /> {saved ? (stale ? 'Mettre à jour le relevé' : 'Régénérer') : 'Générer le relevé'}
              </Button>
              <Button variant="outline" onClick={() => printStatement(st, store)}><Printer className="h-4 w-4" /> Imprimer / exporter PDF</Button>
              <Button variant="outline" onClick={() => void exportExcel(st)}><FileSpreadsheet className="h-4 w-4" /> Exporter Excel</Button>
              {saved && !saved.paidAt && <Button variant="accent" onClick={() => setPaying(saved)}><CheckCircle2 className="h-4 w-4" /> Marquer comme réglé</Button>}
              {saved?.paidAt && <Button variant="ghost" onClick={() => unpay.mutate(saved.id)}>Annuler le règlement</Button>}
            </div>
            {stale && <p className="mt-2 text-xs text-warning">Les commandes ont changé depuis la dernière génération : mettez le relevé à jour.</p>}
          </section>

          {/* Bloc interne : jamais imprimé */}
          <section className="card flex flex-wrap items-center justify-between gap-3 border-dashed p-4">
            <p className="text-sm text-content-muted">Usage interne — marge réalisée ce mois avec {st.supplier.name}</p>
            <p className="text-right">
              <Money value={st.margin} className="text-lg font-bold" />
              <span className="ml-2 text-sm text-content-muted">{String(st.marginPct).replace('.', ',')} % des ventes</span>
            </p>
          </section>
        </>
      )}

      <Panel title="Tous les relevés">
        {!all ? <PageLoader /> : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>N°</th><th className={th}>Fournisseur</th><th className={th}>Mois</th>
                  <th className={`${th} text-right`}>Montant TTC</th><th className={th}>Échéance</th><th className={th}>Paiement</th>
                </tr>
              </thead>
              <tbody>
                {all.map((s) => (
                  <tr key={s.id} className="cursor-pointer border-b last:border-0 hover:bg-primary-soft/30" onClick={() => { setSupplierId(s.supplierId); setMonth(s.month); }}>
                    <td className={`${td} font-mono text-xs font-bold`}>{s.number}</td>
                    <td className={td}>{s.supplier?.name}</td>
                    <td className={`${td} text-content-muted`}>{monthLabel(s.month)}</td>
                    <td className={`${td} text-right`}><Money value={s.totalTtc} /></td>
                    <td className={`${td} text-content-muted`}>{formatDate(s.dueDate)}</td>
                    <td className={td}><PaidBadge s={s} />{s.paymentMethod && <span className="ml-1 text-xs text-content-faint">{s.paymentMethod}</span>}</td>
                  </tr>
                ))}
                {!all.length && <tr><td colSpan={6} className={`${td} text-content-muted`}>Aucun relevé généré.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {paying && <PayModal statement={paying} onClose={() => setPaying(null)} />}
    </>
  );
}

function PayModal({ statement, onClose }: { statement: RxSavedStatement; onClose: () => void }) {
  const qc = useQueryClient();
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('Virement');
  const pay = useMutation({
    mutationFn: () => rx.payStatement(statement.id, { paid: true, paidAt, paymentMethod: method }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rx'] }); onClose(); },
    onError: (e) => alert(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={`Règlement ${statement.number}`} size="sm">
      <div className="space-y-3">
        <p className="text-sm text-content-muted">Montant : <Money value={statement.totalTtc} className="font-bold text-content" /></p>
        <Field label="Date du règlement"><input className="input" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>
        <Field label="Mode de paiement">
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {['Virement', 'Chèque', 'Espèces', 'Wave', 'Orange Money', 'MTN MoMo', 'Autre'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={pay.isPending} onClick={() => pay.mutate()}>Marquer comme réglé</Button>
        </div>
      </div>
    </Modal>
  );
}
