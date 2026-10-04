import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { CustomerCreateInput } from '@oculo/shared-types';
import { createCustomer, getCustomerDirectory } from '../../../features/optique/api';
import { useUIStore } from '../../../store/ui';
import { apiErrorMessage } from '../../../lib/api';
import { Button, Modal, ProgressBar } from '../../../components/ui';
import { tr } from '../../../lib/tr';

/**
 * Import d'un fichier clients (Excel ou CSV) via l'API de création existante,
 * une ligne à la fois : aucune route serveur dédiée, les mêmes contrôles
 * qu'une saisie manuelle. Colonnes reconnues par leur nom (FR ou EN), doublons
 * de téléphone ou d'e-mail ignorés (dans le fichier et dans le fichier client).
 */
const COLUMNS: Record<keyof CustomerCreateInput | 'fullName' | 'city', string[]> = {
  firstName: ['prenom', 'firstname', 'first name', 'prénom'],
  lastName: ['nom', 'lastname', 'last name', 'nom de famille', 'surname'],
  fullName: ['nom complet', 'full name', 'client', 'patient', 'name'],
  phone: ['telephone', 'téléphone', 'tel', 'phone', 'mobile', 'whatsapp', 'portable'],
  email: ['email', 'e-mail', 'mail', 'courriel'],
  dateOfBirth: ['date de naissance', 'naissance', 'birth', 'date of birth', 'dob'],
  gender: ['genre', 'sexe', 'gender', 'sex'],
  address: ['adresse', 'address', 'quartier'],
  city: ['ville', 'city'],
  profession: ['profession', 'metier', 'métier', 'job', 'occupation'],
  notes: ['notes', 'note', 'remarques', 'commentaire', 'comments'],
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function toIsoDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

function toGender(v: unknown): CustomerCreateInput['gender'] {
  const s = norm(String(v ?? ''));
  if (['m', 'h', 'homme', 'male', 'masculin', 'man'].includes(s)) return 'MALE';
  if (['f', 'femme', 'female', 'feminin', 'woman'].includes(s)) return 'FEMALE';
  return '';
}

type Row = CustomerCreateInput & { _line: number };

function parseRows(raw: Record<string, unknown>[]): { rows: Row[]; skipped: number } {
  const rows: Row[] = [];
  let skipped = 0;
  raw.forEach((r, i) => {
    const byKey: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) byKey[norm(k)] = v;
    const pick = (field: keyof typeof COLUMNS) => {
      for (const alias of COLUMNS[field]) {
        const v = byKey[norm(alias)];
        if (v != null && String(v).trim() !== '') return v;
      }
      return '';
    };
    let firstName = String(pick('firstName')).trim();
    let lastName = String(pick('lastName')).trim();
    const full = String(pick('fullName')).trim();
    if ((!firstName || !lastName) && full) {
      const parts = full.split(/\s+/);
      firstName ||= parts.slice(0, -1).join(' ') || parts[0]!;
      lastName ||= parts.length > 1 ? parts[parts.length - 1]! : '-';
    }
    if (!firstName || !lastName) {
      skipped++;
      return;
    }
    const address = [String(pick('address')).trim(), String(pick('city')).trim()].filter(Boolean).join(', ');
    rows.push({
      _line: i + 2,
      firstName: firstName.slice(0, 80),
      lastName: lastName.slice(0, 80),
      phone: String(pick('phone')).trim().slice(0, 40) || undefined,
      email: String(pick('email')).trim(),
      dateOfBirth: toIsoDate(pick('dateOfBirth')),
      gender: toGender(pick('gender')),
      address: address.slice(0, 200),
      profession: String(pick('profession')).trim().slice(0, 120),
      notes: String(pick('notes')).trim().slice(0, 1000),
    });
  });
  return { rows, skipped };
}

async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Prénom', 'Nom', 'Téléphone', 'Email', 'Date de naissance', 'Genre', 'Adresse', 'Ville', 'Profession', 'Notes'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Clients');
  XLSX.writeFile(wb, 'modele-import-clients.xlsx');
}

export function ImportCustomersModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const branchId = useUIStore((st) => st.activeBranchId);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<{ done: number; created: number; dup: number; failed: string[] } | null>(null);
  const [finished, setFinished] = useState(false);

  async function onFile(file: File) {
    setError('');
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]!]!;
      const parsed = parseRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }));
      setRows(parsed.rows);
      setSkipped(parsed.skipped);
      if (parsed.rows.length === 0) setError(tr('crm.importNoRows'));
    } catch {
      setError(tr('crm.importBadFile'));
    }
  }

  async function run() {
    if (!rows || !branchId) {
      if (!branchId) setError(tr('ui.ClientsPage.selectionnezUnMagasinAvantDe'));
      return;
    }
    // Doublons : téléphones / e-mails déjà présents dans le fichier client.
    const known = new Set<string>();
    for (let page = 1; page < 200; page++) {
      const d = await getCustomerDirectory({ branchId, page, pageSize: 100 });
      for (const c of d.customers) {
        if (c.phone) known.add('p' + c.phone.replace(/\D/g, ''));
        if (c.email) known.add('e' + c.email.toLowerCase());
      }
      if (page * 100 >= d.total) break;
    }
    const state = { done: 0, created: 0, dup: 0, failed: [] as string[] };
    setProgress({ ...state });
    for (const r of rows) {
      const keys = [r.phone && 'p' + r.phone.replace(/\D/g, ''), r.email && 'e' + r.email.toLowerCase()].filter(Boolean) as string[];
      if (keys.some((k) => known.has(k))) {
        state.dup++;
      } else {
        const { _line, ...input } = r;
        try {
          await createCustomer(input, branchId);
          keys.forEach((k) => known.add(k));
          state.created++;
        } catch (e) {
          state.failed.push(tr('crm.importLineError', { line: _line, msg: apiErrorMessage(e) }));
        }
      }
      state.done++;
      setProgress({ ...state, failed: [...state.failed] });
    }
    setFinished(true);
    void qc.invalidateQueries({ queryKey: ['customer-directory'] });
    void qc.invalidateQueries({ queryKey: ['customers'] });
  }

  const running = progress && !finished;

  return (
    <Modal open onClose={running ? () => undefined : onClose} title={tr('crm.importTitle')} size="lg">
      <div className="space-y-4">
        {!progress && (
          <>
            <p className="text-sm text-content-muted">{tr('crm.importIntro')}</p>
            <div className="flex flex-wrap gap-2">
              <label className="btn-primary cursor-pointer">
                <Upload className="h-4 w-4" /> {fileName || tr('crm.importChoose')}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
                />
              </label>
              <Button variant="outline" onClick={() => void downloadTemplate()}>
                <Download className="h-4 w-4" /> {tr('crm.importTemplate')}
              </Button>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            {rows && rows.length > 0 && (
              <div className="rounded-xl border">
                <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-content">{tr('crm.importReady', { n: rows.length })}</span>
                  {skipped > 0 && <span className="text-content-faint">· {tr('crm.importSkipped', { n: skipped })}</span>}
                </div>
                <table className="w-full text-left text-xs">
                  <tbody>
                    {rows.slice(0, 5).map((r) => (
                      <tr key={r._line} className="border-b last:border-0">
                        <td className="px-3 py-1.5 font-medium text-content">
                          {r.firstName} {r.lastName}
                        </td>
                        <td className="px-3 py-1.5 text-content-muted">{r.phone || '—'}</td>
                        <td className="px-3 py-1.5 text-content-muted">{r.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 5 && <p className="px-3 py-1.5 text-xs text-content-faint">+ {rows.length - 5}…</p>}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="ghost" onClick={onClose}>
                {tr('ui.ClientsPage.annuler')}
              </Button>
              <Button disabled={!rows || rows.length === 0} onClick={() => void run()}>
                {tr('crm.importRun', { n: rows?.length ?? 0 })}
              </Button>
            </div>
          </>
        )}

        {progress && rows && (
          <div className="space-y-4">
            <ProgressBar value={progress.done} max={rows.length} label={tr('crm.importProgress')} sublabel={`${progress.done} / ${rows.length}`} />
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="font-display text-xl font-bold text-success">{progress.created}</p>
                <p className="text-xs text-content-muted">{tr('crm.importCreated')}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="font-display text-xl font-bold text-content">{progress.dup}</p>
                <p className="text-xs text-content-muted">{tr('crm.importDup')}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="font-display text-xl font-bold text-danger">{progress.failed.length}</p>
                <p className="text-xs text-content-muted">{tr('crm.importFailed')}</p>
              </div>
            </div>
            {progress.failed.length > 0 && (
              <ul className="max-h-32 overflow-y-auto rounded-lg bg-[color:var(--danger)]/5 p-2 text-xs text-danger">
                {progress.failed.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
            {finished && (
              <div className="flex items-center justify-between border-t pt-4">
                <span className="flex items-center gap-2 text-sm font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" /> {tr('crm.importDone')}
                </span>
                <Button onClick={onClose}>{tr('crm.close')}</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
