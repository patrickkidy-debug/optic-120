import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Contact, Glasses, FileText, Printer, MessageCircle, Download } from 'lucide-react';

/** Lien wa.me à partir d'un numéro (garde les chiffres uniquement). */
function waLink(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}
import { customerCreateSchema, type CustomerCreateInput } from '@oculo/shared-types';
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  getCustomer,
  type Customer,
} from '../../features/optique/api';
import { printClientDossier } from '../../features/optique/clientDossierDocument';
import type { CompanyInfo } from '../../features/optique/saleDocument';
import { useAuthStore, usePermission } from '../../store/auth';
import { usePosStore } from '../../store/pos';
import { apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Button, Modal, Field, PageLoader, EmptyState } from '../../components/ui';
import { ClientRecord } from './ClientRecord';

export function ClientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canCreate = usePermission('optique.customers.create');
  const canUpdate = usePermission('optique.customers.update');
  const canSeeRx = usePermission('optique.prescriptions.view');
  const canQuote = usePermission('optique.quotes.create');
  const user = useAuthStore((s) => s.user);
  const tenantName = user?.tenantName;
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dossierLoading, setDossierLoading] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => listCustomers(search || undefined),
  });

  // Pré-sélectionne le client en caisse et bascule sur la création de devis.
  function startQuote(customerId: string) {
    const pos = usePosStore.getState();
    pos.clear();
    pos.setCustomer(customerId);
    navigate('/optique/caisse');
  }

  // Dossier client complet (identité, ordonnances, achats, commandes verres,
  // réparations) en PDF — un clic par ligne, sans passer par la fiche client.
  async function downloadDossier(customerId: string) {
    setDossierLoading(customerId);
    try {
      const company: CompanyInfo = {
        name: user?.tenantName ?? 'OculoSaaS',
        logoUrl: user?.tenantLogoUrl,
        location: user?.tenantLocation,
        contactPhone: user?.tenantContactPhone,
        contactEmail: user?.tenantContactEmail,
        ...user?.tenantInvoiceSettings,
      };
      const full = await getCustomer(customerId);
      printClientDossier(full, company);
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setDossierLoading(null);
    }
  }

  // Génère un PDF (via impression navigateur) de TOUT le fichier clients,
  // indépendamment du filtre de recherche en cours.
  async function exportPdf() {
    setExporting(true);
    try {
      const all = await listCustomers();
      const esc = (v: unknown) =>
        String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const body = all
        .map(
          (c, i) => `<tr>
            <td>${i + 1}</td>
            <td>${esc(`${c.firstName} ${c.lastName}`)}</td>
            <td>${esc(c.phone || '—')}</td>
            <td>${esc(c.email || '—')}</td>
            <td>${esc(c.createdAt ? formatDate(c.createdAt) : '—')}</td>
          </tr>`,
        )
        .join('');
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
        <title>${esc(t('clients.listTitle'))}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          body { font-family: -apple-system,'Segoe UI',Roboto,Arial,sans-serif; color:#1e293b; padding:20px; }
          h1 { font-size:20px; margin:0 0 2px; color:#0d9488; }
          .muted { color:#64748b; font-size:12px; }
          table { width:100%; border-collapse:collapse; margin-top:16px; font-size:12px; }
          th { background:#0d9488; color:#fff; padding:8px 10px; text-align:left; }
          td { padding:7px 10px; border-bottom:1px solid #e2e8f0; }
        </style></head><body>
        <h1>${esc(tenantName ?? 'OculoSaaS')}</h1>
        <div class="muted">${esc(t('clients.listTitle'))} — ${new Date().toLocaleDateString()} · ${all.length}</div>
        <table>
          <thead><tr><th>#</th><th>${esc(t('common.client'))}</th><th>${esc(t('common.phone'))}</th><th>${esc(t('common.email'))}</th><th>${esc(t('common.registeredOn'))}</th></tr></thead>
          <tbody>${body}</tbody>
        </table></body></html>`;
      const win = window.open('', '_blank', 'width=900,height=1100');
      if (!win) {
        alert('Veuillez autoriser les fenêtres pop-up pour générer le PDF.');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.onload = () => {
        win.focus();
        win.print();
      };
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          /* déjà imprimé */
        }
      }, 600);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('clients.title')}
        subtitle={t('clients.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={exportPdf}
              loading={exporting}
              disabled={!customers || customers.length === 0}
            >
              <Printer className="h-4 w-4" /> PDF
            </Button>
            {canCreate && (
              <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> {t('clients.newClient')}
              </Button>
            )}
          </div>
        }
      />

      <div className="relative mb-4 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input className="input pl-9" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !customers || customers.length === 0 ? (
        <EmptyState
          icon={Contact}
          title={t('clients.none')}
          hint={t('clients.emptyHint')}
          action={canCreate && <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> {t('clients.newClient')}</Button>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">{t('common.client')}</th>
                <th className="table-cell font-semibold">{t('common.phone')}</th>
                <th className="table-cell font-semibold">{t('common.email')}</th>
                <th className="table-cell font-semibold">{t('common.registeredOn')}</th>
                <th className="table-cell text-right font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                        <Contact className="h-4 w-4" />
                      </span>
                      <span className="font-medium text-content">{c.firstName} {c.lastName}</span>
                    </div>
                  </td>
                  <td className="table-cell text-content-muted">{c.phone ?? '—'}</td>
                  <td className="table-cell text-content-muted">{c.email ?? '—'}</td>
                  <td className="table-cell text-content-muted">{c.createdAt ? formatDate(c.createdAt) : '—'}</td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
                      {waLink(c.phone) && (
                        <a
                          href={waLink(c.phone)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-outline h-8 rounded-lg px-2.5 text-xs text-success"
                          title={`Relancer ${c.firstName} sur WhatsApp`}
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      )}
                      {canQuote && (
                        <button onClick={() => startQuote(c.id)} className="btn-outline h-8 rounded-lg px-2.5 text-xs">
                          <FileText className="h-3.5 w-3.5" /> Devis
                        </button>
                      )}
                      {canSeeRx && (
                        <button onClick={() => setRecordId(c.id)} className="btn-outline h-8 rounded-lg px-2.5 text-xs">
                          <Glasses className="h-3.5 w-3.5" /> Ordonnances
                        </button>
                      )}
                      {canSeeRx && (
                        <button
                          onClick={() => downloadDossier(c.id)}
                          disabled={dossierLoading === c.id}
                          className="btn-outline h-8 rounded-lg px-2.5 text-xs disabled:opacity-50"
                          title="Télécharger le dossier client (PDF)"
                        >
                          <Download className="h-3.5 w-3.5" /> {dossierLoading === c.id ? '…' : 'Dossier'}
                        </button>
                      )}
                      {canUpdate && (
                        <button onClick={() => { setEditing(c); setModalOpen(true); }} className="btn-ghost h-8 w-8 rounded-lg p-0">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <CustomerModal customer={editing} onClose={() => setModalOpen(false)} />}
      {recordId && <ClientRecord customerId={recordId} onClose={() => setRecordId(null)} />}
    </div>
  );
}

function CustomerModal({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<CustomerCreateInput>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: customer
      ? {
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          // L'input date attend `YYYY-MM-DD`.
          dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : '',
          gender: (customer.gender as CustomerCreateInput['gender']) ?? '',
          address: customer.address ?? '',
          profession: customer.profession ?? '',
          notes: customer.notes ?? '',
        }
      : {},
  });

  const mut = useMutation({
    mutationFn: (v: CustomerCreateInput) => (customer ? updateCustomer(customer.id, v) : createCustomer(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); onClose(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={customer ? t('clients.editClient') : t('clients.newClient')}>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><input className="input" {...register('firstName')} />{errors.firstName && <p className="mt-1 text-xs text-danger">{errors.firstName.message}</p>}</Field>
          <Field label="Nom"><input className="input" {...register('lastName')} />{errors.lastName && <p className="mt-1 text-xs text-danger">{errors.lastName.message}</p>}</Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone"><input className="input" {...register('phone')} /></Field>
          <Field label="Email"><input className="input" type="email" {...register('email')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de naissance">
            <input className="input" type="date" {...register('dateOfBirth')} />
          </Field>
          <Field label="Genre">
            <select className="input" {...register('gender')}>
              <option value="">— Non précisé —</option>
              <option value="MALE">Masculin</option>
              <option value="FEMALE">Féminin</option>
              <option value="OTHER">Autre</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Profession">
            <input className="input" {...register('profession')} placeholder="Enseignant, chauffeur…" />
          </Field>
          <Field label="Adresse">
            <input className="input" {...register('address')} placeholder="Quartier, ville" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            className="input min-h-[60px]"
            {...register('notes')}
            placeholder="Antécédents, préférences de monture, remarques…"
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={mut.isPending}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
