import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Upload,
  MessageSquare,
  Settings as SettingsIcon,
  BarChart3,
  Phone,
  CalendarClock,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Flame,
  Mail,
} from 'lucide-react';
import clsx from 'clsx';
import {
  listProspects,
  getProspect,
  updateProspect,
  deleteProspect,
  addProspectNote,
  markContacted,
  setWhatsappStatus,
  previewProspectImport,
  commitProspectImport,
  getCrmStats,
  listTemplates,
  saveTemplate,
  deleteTemplate,
  getCrmSettings,
  updateCrmSettings,
  renderMessage,
  renderEmail,
  listProspectCountries,
  createProspect,
  type Prospect,
  type ImportRow,
  type WhatsappStatus,
  type ProspectStatus,
} from '../../features/crm/api';
import { apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Button, Badge, PageLoader, EmptyState, Modal, Field } from '../../components/ui';

/* --------------------------- Libellés partagés --------------------------- */

const STATUS_LABELS: Record<ProspectStatus, string> = {
  NEW: 'Nouveau',
  CONTACTED: 'Contacté',
  REPLIED: 'Répondu',
  DEMO_SCHEDULED: 'Démo programmée',
  DEMO_COMPLETED: 'Démo réalisée',
  TRIAL: 'Essai',
  CUSTOMER: 'Client',
  LOST: 'Perdu',
};
const STATUS_ORDER: ProspectStatus[] = [
  'NEW',
  'CONTACTED',
  'REPLIED',
  'DEMO_SCHEDULED',
  'DEMO_COMPLETED',
  'TRIAL',
  'CUSTOMER',
  'LOST',
];
const SEGMENTS = ['DISCOVERY', 'STANDARD', 'PREMIUM'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'HOT'] as const;
const WA_LABELS: Record<WhatsappStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  WHATSAPP_VERIFIED: { label: 'WhatsApp vérifié', tone: 'success' },
  PHONE_VALID_WHATSAPP_UNCONFIRMED: { label: 'WhatsApp non confirmé', tone: 'warning' },
  PHONE_INVALID: { label: 'Numéro invalide', tone: 'danger' },
  VERIFICATION_FAILED: { label: 'Vérification impossible', tone: 'neutral' },
};

function scoreTone(score: number): 'success' | 'accent' | 'info' | 'neutral' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'accent';
  if (score >= 40) return 'info';
  return 'neutral';
}
function scoreBandLabel(score: number): string {
  if (score >= 80) return 'HOT';
  if (score >= 60) return 'WARM';
  if (score >= 40) return 'COLD';
  return 'LOW';
}

type CrmTab = 'overview' | 'prospects' | 'pipeline' | 'import' | 'messages' | 'settings';

export function CrmPage() {
  const [tab, setTab] = useState<CrmTab>('overview');

  return (
    <div>
      <PageHeader
        title="CRM / Prospection"
        subtitle="Importer, qualifier et contacter les opticiens — réservé au fondateur"
      />

      <div className="mb-5 flex gap-1 overflow-x-auto border-b">
        {[
          { id: 'overview' as CrmTab, label: "Vue d'ensemble", icon: BarChart3 },
          { id: 'prospects' as CrmTab, label: 'Prospects', icon: Users },
          { id: 'pipeline' as CrmTab, label: 'Pipeline', icon: Flame },
          { id: 'import' as CrmTab, label: 'Import', icon: Upload },
          { id: 'messages' as CrmTab, label: 'Messages', icon: MessageSquare },
          { id: 'settings' as CrmTab, label: 'Paramètres', icon: SettingsIcon },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition',
              tab === t.id
                ? 'border-primary text-content'
                : 'border-transparent text-content-muted hover:text-content',
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab onGoToDue={() => setTab('prospects')} />}
      {tab === 'prospects' && <ProspectsTab />}
      {tab === 'pipeline' && <PipelineTab />}
      {tab === 'import' && <ImportTab />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

/* ---------------------------- Vue d'ensemble ---------------------------- */

function OverviewTab({ onGoToDue }: { onGoToDue: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['crm-stats'], queryFn: getCrmStats });
  if (isLoading) return <PageLoader />;
  if (!data) return null;

  const kpis = [
    { label: 'Total prospects', value: data.total },
    { label: 'Nouveaux ce mois', value: data.newThisMonth },
    { label: 'Contactés', value: data.contacted },
    { label: 'Taux de réponse', value: `${data.replyRate} %` },
    { label: 'Démos programmées', value: data.demosScheduled },
    { label: 'Démos réalisées', value: data.demos },
    { label: 'Essais', value: data.trials },
    { label: 'Clients', value: data.customers },
    { label: 'Taux de conversion', value: `${data.conversionRate} %` },
  ];
  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.value));

  return (
    <div className="space-y-6">
      {data.dueToday > 0 && (
        <button
          onClick={onGoToDue}
          className="flex w-full items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-left transition hover:border-accent"
        >
          <CalendarClock className="h-5 w-5 shrink-0 text-accent" />
          <span className="flex-1 text-sm font-medium text-content">
            {data.dueToday} relance(s) à faire aujourd&apos;hui
          </span>
          <span className="text-xs font-semibold text-accent">Voir</span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-content-muted">{k.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-content">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="mb-4 font-display font-bold text-content">Entonnoir de conversion</h3>
        <div className="space-y-2">
          {data.funnel.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-content-muted">{f.key}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-lg bg-surface-3">
                <div
                  className="flex h-full items-center justify-end rounded-lg bg-brand px-2 text-xs font-bold text-white transition-all"
                  style={{ width: `${Math.max(4, (f.value / maxFunnel) * 100)}%` }}
                >
                  {f.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.sources.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b px-5 py-4">
            <h3 className="font-display font-bold text-content">Conversions par source</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">Source</th>
                  <th className="table-cell text-center font-semibold">Prospects</th>
                  <th className="table-cell text-center font-semibold">Essais</th>
                  <th className="table-cell text-center font-semibold">Clients</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((s) => (
                  <tr key={s.source} className="border-b last:border-0">
                    <td className="table-cell font-medium text-content">{s.source}</td>
                    <td className="table-cell text-center">{s.total}</td>
                    <td className="table-cell text-center">{s.trials}</td>
                    <td className="table-cell text-center font-semibold text-success">{s.customers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Prospects ------------------------------- */

function ProspectsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [segment, setSegment] = useState('');
  const [priority, setPriority] = useState('');
  const [wa, setWa] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [country, setCountry] = useState('');
  const [hasEmail, setHasEmail] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [contactFor, setContactFor] = useState<Prospect | null>(null);
  const [creating, setCreating] = useState(false);

  // Recherche serveur : on attend la fin de la frappe pour ne pas lancer une
  // requête par caractère.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo(
    () => ({
      search: debounced || undefined,
      status: status || undefined,
      segment: segment || undefined,
      priority: priority || undefined,
      whatsappStatus: wa || undefined,
      dueOnly: dueOnly || undefined,
      country: country || undefined,
      hasEmail: hasEmail || undefined,
      page,
      pageSize: 50,
    }),
    [debounced, status, segment, priority, wa, dueOnly, country, hasEmail, page],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['crm-prospects', filters],
    queryFn: () => listProspects(filters),
  });
  // Pays reellement presents, deduits de l'indicatif : on ne propose jamais un
  // pays sans prospect.
  const { data: countries } = useQuery({ queryKey: ['crm-countries'], queryFn: listProspectCountries });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
          <input
            className="input pl-9"
            placeholder="Rechercher un établissement, un nom, un numéro…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select className="input w-auto" value={segment} onChange={(e) => { setSegment(e.target.value); setPage(1); }}>
          <option value="">Tous segments</option>
          {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-auto" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
          <option value="">Toutes priorités</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input w-auto" value={wa} onChange={(e) => { setWa(e.target.value); setPage(1); }}>
          <option value="">Tout WhatsApp</option>
          {(Object.keys(WA_LABELS) as WhatsappStatus[]).map((k) => (
            <option key={k} value={k}>{WA_LABELS[k].label}</option>
          ))}
        </select>
        <select className="input w-auto" value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}>
          <option value="">Tous les pays</option>
          {countries?.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name} ({c.count})
            </option>
          ))}
        </select>
        <button
          onClick={() => { setHasEmail((v) => !v); setPage(1); }}
          className={clsx(
            'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition',
            hasEmail ? 'border-primary bg-primary/10 text-primary' : 'text-content-muted hover:text-content',
          )}
        >
          <Mail className="h-4 w-4" /> Avec e-mail
        </button>
        <button
          onClick={() => { setDueOnly((v) => !v); setPage(1); }}
          className={clsx(
            'rounded-xl border px-3 py-2 text-sm font-medium transition',
            dueOnly ? 'border-accent bg-accent/10 text-accent' : 'text-content-muted hover:text-content',
          )}
        >
          À relancer
        </button>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Prospect
        </Button>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun prospect"
          hint="Importez un fichier Excel/CSV depuis l'onglet Import, ou ajoutez un prospect à la main."
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                    <th className="table-cell font-semibold">Établissement</th>
                    <th className="table-cell font-semibold">Contact</th>
                    <th className="table-cell font-semibold">Pays</th>
                    <th className="table-cell font-semibold">Téléphone</th>
                    <th className="table-cell font-semibold">WhatsApp</th>
                    <th className="table-cell text-center font-semibold">Score</th>
                    <th className="table-cell font-semibold">Statut</th>
                    <th className="table-cell font-semibold">Relance</th>
                    <th className="table-cell text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => {
                    const wl = WA_LABELS[p.whatsappStatus];
                    const overdue = p.nextFollowUpAt && new Date(p.nextFollowUpAt) <= new Date();
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-surface-2/50">
                        <td className="table-cell">
                          <button onClick={() => setOpenId(p.id)} className="text-left font-medium text-content hover:text-primary">
                            {p.establishmentName}
                          </button>
                          <div className="text-xs text-content-faint">
                            {[p.city, p.country].filter(Boolean).join(', ') || '—'}
                          </div>
                        </td>
                        <td className="table-cell text-content-muted">
                          {[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className='table-cell text-content-muted'>{p.phoneCountry ?? '—'}</td>
                        <td className='table-cell font-mono text-xs text-content-muted'>
                          {p.phoneNormalized ?? p.phone ?? '—'}
                        </td>
                        <td className="table-cell"><Badge tone={wl.tone}>{wl.label}</Badge></td>
                        <td className="table-cell text-center">
                          <Badge tone={scoreTone(p.leadScore)}>
                            {p.leadScore} · {scoreBandLabel(p.leadScore)}
                          </Badge>
                        </td>
                        <td className="table-cell text-content-muted">{STATUS_LABELS[p.status]}</td>
                        <td className="table-cell">
                          {p.nextFollowUpAt ? (
                            <span className={overdue ? 'font-semibold text-accent' : 'text-content-muted'}>
                              {formatDate(p.nextFollowUpAt)}
                            </span>
                          ) : (
                            <span className="text-content-faint">—</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setContactFor(p)}
                              disabled={p.whatsappStatus === 'PHONE_INVALID'}
                              title={p.whatsappStatus === 'PHONE_INVALID' ? 'Numéro invalide' : 'Contacter sur WhatsApp'}
                              className="btn-primary h-8 rounded-lg px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                            </button>
                            <button onClick={() => setOpenId(p.id)} className="btn-outline h-8 rounded-lg px-2 text-xs">
                              Fiche
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-content-muted">
            <span>{data.total} prospect(s)</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </Button>
              <span>{page} / {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </Button>
            </div>
          </div>
        </>
      )}

      {openId && (
        <ProspectDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            void qc.invalidateQueries({ queryKey: ['crm-prospects'] });
            void qc.invalidateQueries({ queryKey: ['crm-stats'] });
          }}
          onContact={(p) => setContactFor(p)}
        />
      )}
      {contactFor && (
        <ContactModal
          prospect={contactFor}
          onClose={() => setContactFor(null)}
          onSent={() => {
            void qc.invalidateQueries({ queryKey: ['crm-prospects'] });
            void qc.invalidateQueries({ queryKey: ['crm-stats'] });
          }}
        />
      )}
      {creating && (
        <NewProspectModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void qc.invalidateQueries({ queryKey: ['crm-prospects'] });
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Fiche prospect ------------------------------ */

function ProspectDrawer({
  id,
  onClose,
  onChanged,
  onContact,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onContact: (p: Prospect) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-prospect', id], queryFn: () => getProspect(id) });
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function run(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['crm-prospect', id] });
      onChanged();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }

  return (
    <Modal open onClose={onClose} title={data?.establishmentName ?? 'Prospect'} size="lg">
      {isLoading || !data ? (
        <PageLoader />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Info label="Contact" value={[data.firstName, data.lastName].filter(Boolean).join(' ') || '—'} />
            <Info label="Téléphone" value={data.phoneNormalized ?? data.phone ?? '—'} />
            <Info label="Email" value={data.email ?? '—'} />
            <Info label="Ville" value={data.city ?? '—'} />
            <Info label="Pays" value={data.country ?? '—'} />
            <Info label="Source" value={data.source} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={scoreTone(data.leadScore)}>
              Score {data.leadScore} · {scoreBandLabel(data.leadScore)}
            </Badge>
            <Badge tone={WA_LABELS[data.whatsappStatus].tone}>{WA_LABELS[data.whatsappStatus].label}</Badge>
            <Badge>{data.segment}</Badge>
            <Badge>{data.priority}</Badge>
          </div>

          {/* Progression du pipeline */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">Pipeline</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.filter((s) => s !== 'LOST').map((s) => {
                const idx = STATUS_ORDER.indexOf(s);
                const cur = STATUS_ORDER.indexOf(data.status);
                const done = data.status !== 'LOST' && idx <= cur;
                return (
                  <button
                    key={s}
                    onClick={() => void run(() => updateProspect(id, { status: s }))}
                    className={clsx(
                      'rounded-lg px-2.5 py-1 text-xs font-medium transition',
                      done ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted hover:text-content',
                    )}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
              <button
                onClick={() => void run(() => updateProspect(id, { status: 'LOST' }))}
                className={clsx(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition',
                  data.status === 'LOST' ? 'bg-danger text-white' : 'bg-surface-2 text-content-muted hover:text-content',
                )}
              >
                Perdu
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-y py-3">
            <Button onClick={() => onContact(data)} disabled={data.whatsappStatus === 'PHONE_INVALID'}>
              <MessageSquare className="h-4 w-4" /> WhatsApp
            </Button>
            {data.phoneNormalized && (
              <a href={`tel:${data.phoneNormalized}`} className="btn-outline">
                <Phone className="h-4 w-4" /> Appeler
              </a>
            )}
            <Button
              variant="outline"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 2);
                void run(() => updateProspect(id, { nextFollowUpAt: d.toISOString() }));
              }}
            >
              <CalendarClock className="h-4 w-4" /> Relancer J+2
            </Button>
            {data.whatsappStatus !== 'WHATSAPP_VERIFIED' && (
              <Button variant="outline" onClick={() => void run(() => setWhatsappStatus(id, 'WHATSAPP_VERIFIED'))}>
                <CheckCircle2 className="h-4 w-4" /> Marquer WhatsApp vérifié
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => {
                if (!confirm(`Supprimer définitivement « ${data.establishmentName} » ?`)) return;
                void run(async () => {
                  await deleteProspect(id);
                  onClose();
                });
              }}
            >
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">Ajouter une note</p>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ce que le prospect a dit, objection, contexte…"
              />
              <Button
                disabled={!note.trim()}
                onClick={() =>
                  void run(async () => {
                    await addProspectNote(id, note);
                    setNote('');
                  })
                }
              >
                Ajouter
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-faint">Historique</p>
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {data.events.length === 0 ? (
                <p className="text-sm text-content-muted">Aucun évènement.</p>
              ) : (
                data.events.map((e) => (
                  <div key={e.id} className="flex gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <span className="shrink-0 text-xs text-content-faint">{formatDate(e.createdAt)}</span>
                    <span className="text-content">{e.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-content-faint">{label}</p>
      <p className="truncate font-medium text-content">{value}</p>
    </div>
  );
}

/* ----------------------------- Contact WhatsApp ----------------------------- */

function ContactModal({
  prospect,
  onClose,
  onSent,
}: {
  prospect: Prospect;
  onClose: () => void;
  onSent: () => void;
}) {
  const { data: templates } = useQuery({ queryKey: ['crm-templates'], queryFn: listTemplates });
  const [templateId, setTemplateId] = useState('');
  const [preview, setPreview] = useState('');
  const [subject, setSubject] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState('');
  // Canal de contact : WhatsApp par défaut, e-mail si le prospect en a un.
  // Le contenu vient du MÊME modèle dans les deux cas — un seul texte à tenir
  // à jour, seul l'objet est ajouté pour le courrier.
  const canWhatsapp = prospect.whatsappStatus !== 'PHONE_INVALID' && Boolean(prospect.phoneNormalized);
  const canEmail = Boolean(prospect.email);
  const [channel, setChannel] = useState<'whatsapp' | 'email'>(canWhatsapp ? 'whatsapp' : 'email');

  useEffect(() => {
    if (!templateId && templates?.length) setTemplateId(templates[0].id);
  }, [templates, templateId]);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    const load =
      channel === 'email'
        ? renderEmail(prospect.id, templateId).then((r) => {
            setSubject(r.subject);
            return r;
          })
        : renderMessage(prospect.id, templateId);
    load
      .then((r) => {
        if (cancelled) return;
        setPreview(r.body);
        setTemplateName(r.templateName);
      })
      .catch((e) => setError(apiErrorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [templateId, prospect.id, channel]);

  const unconfirmed = prospect.whatsappStatus === 'PHONE_VALID_WHATSAPP_UNCONFIRMED';

  function open() {
    // L'envoi n'est JAMAIS automatique, quel que soit le canal : on ouvre
    // l'application avec le texte prérempli, le fondateur relit et envoie.
    if (channel === 'email') {
      if (!prospect.email) return;
      const href = `mailto:${prospect.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(preview)}`;
      window.open(href, '_blank', 'noopener');
    } else {
      const digits = (prospect.phoneNormalized ?? '').replace(/[^\d]/g, '');
      if (!digits) return;
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(preview)}`, '_blank', 'noopener');
    }
    const label = channel === 'email' ? `${templateName} (e-mail)` : templateName;
    void markContacted(prospect.id, label).then(onSent).catch(() => undefined);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Contacter ${prospect.establishmentName}`} size="lg">
      <div className="space-y-4">
        {/* Choix du canal : seuls ceux réellement disponibles sont proposés. */}
        <div className="flex gap-2">
          <button
            onClick={() => setChannel('whatsapp')}
            disabled={!canWhatsapp}
            className={clsx(
              'flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition',
              channel === 'whatsapp'
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-content-muted hover:text-content',
              !canWhatsapp && 'cursor-not-allowed opacity-40',
            )}
          >
            <MessageSquare className="h-4 w-4" /> WhatsApp
          </button>
          <button
            onClick={() => setChannel('email')}
            disabled={!canEmail}
            title={canEmail ? undefined : "Ce prospect n'a pas d'adresse e-mail"}
            className={clsx(
              'flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition',
              channel === 'email'
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-content-muted hover:text-content',
              !canEmail && 'cursor-not-allowed opacity-40',
            )}
          >
            <Mail className="h-4 w-4" /> E-mail
          </button>
        </div>

        {unconfirmed && channel === 'whatsapp' && (
          <div className="flex items-start gap-2 rounded-xl bg-[color:var(--warning)]/10 p-3 text-sm text-content">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              Numéro valide mais <b>WhatsApp non confirmé</b> — aucun moyen officiel ne permet de le vérifier
              sans écrire. Vous pouvez tenter l&apos;envoi : s&apos;il répond, le statut passera automatiquement
              en « vérifié ».
            </span>
          </div>
        )}

        <Field label="Modèle de message">
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates?.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>

        {channel === 'email' && (
          <Field label='Objet'>
            <input className='input' value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
        )}

        <Field label="Aperçu (modifiable)">
          <textarea
            className="input min-h-[220px] font-mono text-xs"
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <span className='truncate font-mono text-xs text-content-muted'>
            {channel === 'email' ? prospect.email : prospect.phoneNormalized}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button disabled={!preview.trim()} onClick={open}>
              {channel === 'email' ? <Mail className='h-4 w-4' /> : <MessageSquare className='h-4 w-4' />}
              {channel === 'email' ? 'Ouvrir le courrier' : 'Ouvrir WhatsApp'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Nouveau prospect ------------------------------ */

function NewProspectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    establishmentName: '',
    firstName: '',
    phone: '',
    country: '',
    city: '',
    email: '',
    segment: 'STANDARD',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError('');
    setSaving(true);
    try {
      await createProspect({ ...form, source: 'MANUAL' });
      onCreated();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Nouveau prospect" size="md">
      <div className="space-y-3">
        <Field label="Établissement *">
          <input className="input" value={form.establishmentName} onChange={(e) => set('establishmentName', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom du contact">
            <input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone *">
            <input className="input" placeholder="+225 07 58 12 34 56" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Pays (si numéro sans indicatif)">
            <input className="input" placeholder="CI" value={form.country} onChange={(e) => set('country', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ville">
            <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Segment">
            <select className="input" value={form.segment} onChange={(e) => set('segment', e.target.value)}>
              {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={saving} disabled={!form.establishmentName.trim() || !form.phone.trim()} onClick={() => void submit()}>
            Créer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------- Import -------------------------------- */

function ImportTab() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    setResult(null);
    try {
      setRows(await previewProspectImport(file));
    } catch (err) {
      setError(apiErrorMessage(err, 'Impossible de lire ce fichier'));
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const r = rows ?? [];
    return {
      neu: r.filter((x) => x.outcome === 'new').length,
      dup: r.filter((x) => x.outcome === 'duplicate').length,
      bad: r.filter((x) => x.outcome === 'invalid').length,
    };
  }, [rows]);

  async function commit() {
    if (!rows) return;
    setLoading(true);
    setError('');
    try {
      const res = await commitProspectImport(rows, 'IMPORT_EXCEL');
      setResult(res);
      setRows(null);
      void qc.invalidateQueries({ queryKey: ['crm-prospects'] });
      void qc.invalidateQueries({ queryKey: ['crm-stats'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <p className="mt-3 font-display text-lg font-bold text-content">
          {result.created} prospect(s) importé(s)
        </p>
        {result.skipped > 0 && (
          <p className="mt-1 text-sm text-content-muted">{result.skipped} ligne(s) ignorée(s) (doublons ou invalides).</p>
        )}
        <Button className="mt-5" onClick={() => setResult(null)}>Importer un autre fichier</Button>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition hover:border-primary">
          <Upload className="h-8 w-8 text-content-faint" />
          <span className="text-sm font-medium text-content">Choisir un fichier .xlsx ou .csv</span>
          <span className="text-xs text-content-muted">
            Colonnes reconnues : Établissement, Prénom, Nom, Téléphone, Email, Pays, Ville, Adresse, Segment
          </span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
        </label>
        {loading && <PageLoader />}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Badge tone="success">{counts.neu} nouveaux</Badge>
        <Badge tone="info">{counts.dup} doublons ignorés</Badge>
        <Badge tone="danger">{counts.bad} invalides</Badge>
      </div>

      {/* Toutes les lignes rejetées : c'est presque toujours la structure du
          fichier, pas son contenu. On explique quoi vérifier plutôt que de
          laisser un tableau rouge sans issue. */}
      {counts.neu === 0 && counts.bad > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="text-content">
            <p className="font-semibold">Aucune colonne reconnue dans ce fichier</p>
            <p className="mt-1 text-content-muted">
              Vérifiez que la feuille contient bien une ligne d&apos;en-tête avec au minimum une colonne
              <b> Établissement</b> (ou Nom, Entreprise, Magasin) et une colonne <b>Téléphone</b>. Un titre
              ou des lignes vides au-dessus du tableau sont détectés automatiquement, mais un tableau sans
              en-tête ne peut pas être interprété.
            </p>
          </div>
        </div>
      )}

      <div className="card max-h-[420px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
              <th className="table-cell font-semibold">Établissement</th>
              <th className="table-cell font-semibold">Téléphone normalisé</th>
              <th className="table-cell font-semibold">Ville</th>
              <th className="table-cell text-center font-semibold">Score</th>
              <th className="table-cell font-semibold">Résultat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="table-cell text-content">{r.establishmentName || <span className="text-content-faint">(vide)</span>}</td>
                <td className="table-cell font-mono text-xs">{r.phoneNormalized ?? <span className="text-danger">—</span>}</td>
                <td className="table-cell text-content-muted">{r.city || '—'}</td>
                <td className="table-cell text-center">{r.leadScore}</td>
                <td className="table-cell">
                  <Badge tone={r.outcome === 'new' ? 'success' : r.outcome === 'duplicate' ? 'info' : 'danger'}>
                    {r.outcome === 'new' ? 'À créer' : r.outcome === 'duplicate' ? 'Doublon' : 'Invalide'}
                  </Badge>
                  {r.reason && <span className="ml-2 text-xs text-content-faint">{r.reason}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setRows(null)}>Annuler</Button>
        <Button loading={loading} disabled={counts.neu === 0} onClick={() => void commit()}>
          Importer {counts.neu} prospect(s)
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------- Messages -------------------------------- */

function MessagesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-templates'], queryFn: listTemplates });
  const [editing, setEditing] = useState<{ id?: string; name: string; body: string } | null>(null);
  const [error, setError] = useState('');

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-content-muted">
          Variables disponibles : <code>{'{{first_name}}'}</code> <code>{'{{establishment_name}}'}</code>{' '}
          <code>{'{{city}}'}</code> <code>{'{{country}}'}</code> <code>{'{{demo_videos_url}}'}</code>{' '}
          <code>{'{{signup_url}}'}</code> <code>{'{{demo_booking_url}}'}</code>
        </p>
        <Button onClick={() => setEditing({ name: '', body: '' })}>
          <Plus className="h-4 w-4" /> Modèle
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {data?.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-content">{t.name}</p>
                {t.isDefault && <Badge tone="info">Par défaut</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="outline" className="h-8 px-2 text-xs" onClick={() => setEditing(t)}>
                  Modifier
                </Button>
                <button
                  onClick={() => {
                    const msg = t.isDefault
                      ? 'Réinitialiser ce modèle par défaut ?'
                      : `Supprimer le modèle « ${t.name} » ?`;
                    if (!confirm(msg)) return;
                    void deleteTemplate(t.id)
                      .then(() => qc.invalidateQueries({ queryKey: ['crm-templates'] }))
                      .catch((e) => setError(apiErrorMessage(e)));
                  }}
                  className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-xs text-content-muted">
              {t.body}
            </pre>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Modifier le modèle' : 'Nouveau modèle'} size="lg">
          <div className="space-y-3">
            <Field label="Nom">
              <input
                className="input"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Message">
              <textarea
                className="input min-h-[260px] font-mono text-xs"
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
              <Button
                disabled={!editing.name.trim() || !editing.body.trim()}
                onClick={() =>
                  void saveTemplate(editing)
                    .then(() => {
                      setEditing(null);
                      return qc.invalidateQueries({ queryKey: ['crm-templates'] });
                    })
                    .catch((e) => setError(apiErrorMessage(e)))
                }
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------- Paramètres ------------------------------- */

function SettingsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-settings'], queryFn: getCrmSettings });
  const [form, setForm] = useState({ demoVideosUrl: '', signupUrl: '', demoBookingUrl: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (data) {
      setForm({
        demoVideosUrl: data.demoVideosUrl ?? '',
        signupUrl: data.signupUrl ?? '',
        demoBookingUrl: data.demoBookingUrl ?? '',
      });
    }
  }, [data]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="card p-5">
        <h3 className="font-display font-bold text-content">Liens de conversion</h3>
        <p className="mt-1 text-sm text-content-muted">
          Insérés automatiquement dans les messages via les variables. Jamais codés en dur.
        </p>
        <div className="mt-4 space-y-3">
          <Field label="URL des vidéos de démonstration — {{demo_videos_url}}">
            <input
              className="input"
              placeholder="https://oculosaas.com/demo/videos"
              value={form.demoVideosUrl}
              onChange={(e) => setForm({ ...form, demoVideosUrl: e.target.value })}
            />
          </Field>
          <Field label="URL d'inscription — {{signup_url}}">
            <input
              className="input"
              placeholder="https://oculosaas.com/signup"
              value={form.signupUrl}
              onChange={(e) => setForm({ ...form, signupUrl: e.target.value })}
            />
          </Field>
          <Field label="URL de réservation de démo — {{demo_booking_url}}">
            <input
              className="input"
              placeholder="https://wa.me/..."
              value={form.demoBookingUrl}
              onChange={(e) => setForm({ ...form, demoBookingUrl: e.target.value })}
            />
          </Field>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={() =>
              void updateCrmSettings({
                demoVideosUrl: form.demoVideosUrl || null,
                signupUrl: form.signupUrl || null,
                demoBookingUrl: form.demoBookingUrl || null,
              })
                .then(() => {
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2500);
                  return qc.invalidateQueries({ queryKey: ['crm-settings'] });
                })
                .catch((e) => setError(apiErrorMessage(e)))
            }
          >
            Enregistrer
          </Button>
          {saved && <span className="text-sm text-success">Enregistré</span>}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="flex items-center gap-2 font-display font-bold text-content">
          <HelpCircle className="h-4 w-4 text-primary" /> Vérification WhatsApp
        </h3>
        <p className="mt-2 text-sm text-content-muted">
          Meta n&apos;expose aucun moyen officiel de savoir si un numéro possède WhatsApp sans lui envoyer de
          message. Le CRM applique donc une règle honnête :
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Badge tone="warning">WhatsApp non confirmé</Badge>
            <span className="text-content-muted">numéro au bon format, joignabilité inconnue.</span>
          </li>
          <li className="flex items-start gap-2">
            <Badge tone="danger">Numéro invalide</Badge>
            <span className="text-content-muted">format inexploitable, bouton WhatsApp désactivé.</span>
          </li>
          <li className="flex items-start gap-2">
            <Badge tone="success">WhatsApp vérifié</Badge>
            <span className="text-content-muted">
              posé automatiquement dès que le prospect répond, ou manuellement depuis sa fiche.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default CrmPage;

/* -------------------------------- Pipeline -------------------------------- */

const COLUMN_TONE: Record<ProspectStatus, string> = {
  NEW: 'border-t-content-faint',
  CONTACTED: 'border-t-primary/60',
  REPLIED: 'border-t-cyan/60',
  DEMO_SCHEDULED: 'border-t-accent/60',
  DEMO_COMPLETED: 'border-t-accent',
  TRIAL: 'border-t-[color:var(--warning)]',
  CUSTOMER: 'border-t-[color:var(--success)]',
  LOST: 'border-t-[color:var(--danger)]',
};

/**
 * Pipeline Kanban. Glisser-déposer HTML5 natif, même mécanique que le tableau
 * des commandes de verres — aucune librairie supplémentaire à charger.
 *
 * Le tableau charge jusqu'à 400 prospects : au-delà, un Kanban devient de
 * toute façon illisible et l'onglet Prospects (filtré, paginé) est l'outil
 * adapté. Un compteur signale les prospects non affichés.
 */
function PipelineTab() {
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState<ProspectStatus | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [contactFor, setContactFor] = useState<Prospect | null>(null);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['crm-pipeline'],
    queryFn: () => listProspects({ pageSize: 400 }),
  });

  const byColumn = useMemo(() => {
    const m = new Map<ProspectStatus, Prospect[]>();
    STATUS_ORDER.forEach((s) => m.set(s, []));
    (data?.items ?? []).forEach((p) => m.get(p.status)?.push(p));
    return m;
  }, [data]);

  async function move(id: string, status: ProspectStatus) {
    setError('');
    try {
      await updateProspect(id, { status });
      await qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
      void qc.invalidateQueries({ queryKey: ['crm-stats'] });
      void qc.invalidateQueries({ queryKey: ['crm-prospects'] });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }

  if (isLoading) return <PageLoader />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={Flame}
        title="Pipeline vide"
        hint="Importez des prospects pour les suivre étape par étape."
      />
    );
  }

  const hidden = data.total - data.items.length;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      {hidden > 0 && (
        <p className="text-xs text-content-muted">
          {data.items.length} prospects affichés sur {data.total}. Utilisez l&apos;onglet Prospects et ses
          filtres pour travailler sur le reste.
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-3">
        {STATUS_ORDER.map((status) => {
          const items = byColumn.get(status) ?? [];
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData('text/plain');
                if (id) void move(id, status);
              }}
              className={clsx(
                'flex w-64 shrink-0 flex-col rounded-2xl border-t-4 bg-surface-2/40',
                COLUMN_TONE[status],
                dragOver === status && 'ring-2 ring-primary/40',
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-content">
                  {STATUS_LABELS[status]}
                </h3>
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-content-muted">
                  {items.length}
                </span>
              </div>

              <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto px-2 pb-3">
                {items.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-content-faint">Aucun prospect</p>
                ) : (
                  items.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', p.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => setOpenId(p.id)}
                      className="card cursor-grab space-y-1.5 p-2.5 text-left transition hover:border-primary active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-content">
                          {p.establishmentName}
                        </span>
                        <Badge tone={scoreTone(p.leadScore)}>{p.leadScore}</Badge>
                      </div>
                      <p className="truncate text-xs text-content-faint">
                        {[p.city, p.country].filter(Boolean).join(', ') || '—'}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-content-muted">
                          {p.phoneNormalized ?? '—'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContactFor(p);
                          }}
                          disabled={p.whatsappStatus === 'PHONE_INVALID'}
                          title={p.whatsappStatus === 'PHONE_INVALID' ? 'Numéro invalide' : 'Contacter'}
                          className="rounded-lg p-1 text-primary transition hover:bg-primary/10 disabled:opacity-30"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openId && (
        <ProspectDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            void qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
            void qc.invalidateQueries({ queryKey: ['crm-stats'] });
          }}
          onContact={(p) => setContactFor(p)}
        />
      )}
      {contactFor && (
        <ContactModal
          prospect={contactFor}
          onClose={() => setContactFor(null)}
          onSent={() => {
            void qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
            void qc.invalidateQueries({ queryKey: ['crm-stats'] });
          }}
        />
      )}
    </div>
  );
}
