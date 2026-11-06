import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy, Mail, MessageCircle, Send, CheckCircle2, Search, ArrowRight, Activity, ListChecks,
  ShoppingCart, Upload, FlaskConical, UserPlus, Crown, Inbox, ChevronDown, X,
} from 'lucide-react';
import clsx from 'clsx';
import { supportTicketSchema, type SupportTicketInput } from '@oculo/shared-types';
import { createSupportTicket, listMySupportTickets } from '../features/support/api';
import { HELP_CATEGORIES, normalizeSearch, type HelpArticle } from '../features/support/knowledge';
import { WatchDemoCard } from '../features/demo/WatchDemoCard';
import { API_URL, apiErrorMessage } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useUIStore } from '../store/ui';
import { PageHeader, Button, Field, Badge } from '../components/ui';
import { tr } from '../lib/tr';
import { trFr } from '../lib/sharedLabels';

const SUPPORT_EMAIL = 'oculossaas@gmail.com';
const WHATSAPP = '221768881739'; // numéro de support (format international, sans +)

const TOPICS = [
  'Caisse et ventes',
  'Produits et stock',
  'Clients et ordonnances',
  'Commandes de verres / OculoRX',
  'OculoTrack',
  'Abonnement et paiement',
  'Compte et accès',
  'Bug ou page qui ne marche pas',
  'Suggestion d’amélioration',
  'Autre',
];

const GUIDES = [
  { to: '/configuration-boutique', label: 'Configurer ma boutique', hint: 'Étapes guidées, 30 min', icon: ListChecks },
  { to: '/optique/caisse', label: 'Faire ma première vente', hint: 'Caisse / Vente', icon: ShoppingCart },
  { to: '/optique/produits', label: 'Importer mon catalogue', hint: 'Fichier Excel ou CSV', icon: Upload },
  { to: '/oculorx', label: 'Commander des verres', hint: 'OculoRX', icon: FlaskConical },
  { to: '/parametres/utilisateurs', label: 'Ajouter un employé', hint: 'Utilisateurs et rôles', icon: UserPlus },
  { to: '/parametres/abonnement', label: 'Gérer mon abonnement', hint: 'Paiement et factures', icon: Crown },
];

/** Interroge l'API pour afficher l'état du service et le temps de réponse. */
function useServiceStatus() {
  return useQuery({
    queryKey: ['service-health'],
    queryFn: async () => {
      const start = performance.now();
      try {
        const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
        return { ok: res.ok, ms: Math.round(performance.now() - start) };
      } catch {
        return { ok: false, ms: 0 };
      }
    },
    refetchInterval: 60_000,
  });
}

/** Infos techniques jointes à une demande : aident le support à reproduire. */
function technicalInfo(path: string, branchId: string | null): string {
  const nav = window.navigator;
  return [
    '— Infos techniques —',
    `Page : ${path}`,
    `Navigateur : ${nav.userAgent}`,
    `Écran : ${window.screen.width}×${window.screen.height}`,
    `Connexion : ${nav.onLine ? 'en ligne' : 'hors ligne'}`,
    `Magasin : ${branchId ?? '—'}`,
    `Date : ${new Date().toLocaleString('fr-FR')}`,
  ].join('\n');
}

function Article({ a, open, onToggle }: { a: HelpArticle; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl bg-surface-2">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex-1 font-medium text-content">{a.q}</span>
        <ChevronDown className={clsx('h-4 w-4 shrink-0 text-content-faint transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-sm text-content-muted">{a.a}</p>
          {a.to && (
            <Link to={a.to} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Ouvrir l’écran <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function SupportPage() {
  const location = useLocation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const branchId = useUIStore((s) => s.activeBranchId);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState(HELP_CATEGORIES[0]!.key);
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [topic, setTopic] = useState(TOPICS[0]!);
  const [urgent, setUrgent] = useState(false);
  const [withTech, setWithTech] = useState(true);
  const status = useServiceStatus();
  const { data: myTickets } = useQuery({ queryKey: ['my-support-tickets'], queryFn: listMySupportTickets });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SupportTicketInput>({ resolver: zodResolver(supportTicketSchema) });

  // Lien direct « /aide?sujet=… » (depuis un message d'erreur, par exemple).
  useEffect(() => {
    const s = new URLSearchParams(location.search).get('sujet');
    if (s) setValue('subject', s.slice(0, 120));
  }, [location.search, setValue]);

  const results = useMemo(() => {
    const q = normalizeSearch(query.trim());
    if (q.length < 2) return null;
    const words = q.split(/\s+/);
    return HELP_CATEGORIES.flatMap((c) =>
      c.articles.filter((a) => {
        const hay = normalizeSearch(`${a.q} ${a.a} ${a.tags ?? ''} ${c.label}`);
        return words.every((w) => hay.includes(w));
      }),
    );
  }, [query]);

  async function onSubmit(values: SupportTicketInput) {
    setError('');
    try {
      const prefix = `[${topic}]${urgent ? ' [URGENT]' : ''} `;
      const subject = (prefix + values.subject).slice(0, 160);
      const message = (withTech ? `${values.message}\n\n${technicalInfo(location.pathname, branchId)}` : values.message).slice(0, 4000);
      await createSupportTicket({ subject, message });
      setSent(true);
      reset();
      setUrgent(false);
      void qc.invalidateQueries({ queryKey: ['my-support-tickets'] });
    } catch (e) {
      setError(apiErrorMessage(e, tr('ui.SupportPage.envoiImpossible')));
    }
  }

  const waText = encodeURIComponent(
    `Bonjour OculoSaaS, j’ai besoin d’aide.${user?.tenantName ? `\nÉtablissement : ${user.tenantName}` : ''}${user ? `\nNom : ${user.firstName} ${user.lastName}` : ''}\nMa question : `,
  );
  const category = HELP_CATEGORIES.find((c) => c.key === cat) ?? HELP_CATEGORIES[0]!;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={tr('ui.SupportPage.aideSupport')} subtitle="Trouvez une réponse en quelques secondes, ou écrivez-nous : nous sommes là." />

      {/* Recherche */}
      <div className="card mb-4 p-5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-content-faint" />
          <input
            className="input h-14 pl-12 pr-12 text-base"
            placeholder="Rechercher : encaisser, étiquettes, ordonnance, abonnement…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-content-faint" aria-label="Effacer">
              <X className="h-5 w-5" />
            </button>
          )}
        </label>
        {results && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-content-muted">{results.length} réponse(s)</p>
            {results.map((a) => (
              <Article key={a.q} a={a} open={openQ === a.q} onToggle={() => setOpenQ((o) => (o === a.q ? null : a.q))} />
            ))}
            {results.length === 0 && (
              <p className="rounded-xl bg-surface-2 p-4 text-sm text-content-muted">
                Aucune réponse trouvée. Écrivez-nous avec le formulaire ci-dessous ou sur WhatsApp : nous répondons vite.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Contacts + état du service */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <a href={`https://wa.me/${WHATSAPP}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-4 transition hover:border-primary">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#25D366]/15 text-[#25D366]"><MessageCircle className="h-5 w-5" /></span>
          <div>
            <div className="font-semibold text-content">WhatsApp</div>
            <div className="text-xs text-content-muted">{tr('ui.SupportPage.reponseRapide')} · message pré-rempli</div>
          </div>
        </a>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="card flex items-center gap-3 p-4 transition hover:border-primary">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary"><Mail className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="font-semibold text-content">Email</div>
            <div className="truncate text-xs text-content-muted">{SUPPORT_EMAIL}</div>
          </div>
        </a>
        <div className="card flex items-center gap-3 p-4">
          <span
            className={clsx(
              'grid h-11 w-11 place-items-center rounded-xl',
              status.data?.ok === false ? 'bg-[color:var(--danger)]/15 text-danger' : 'bg-[color:var(--success)]/15 text-success',
            )}
          >
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <div className="font-semibold text-content">État du service</div>
            <div className="text-xs text-content-muted">
              {status.isLoading
                ? 'Vérification…'
                : status.data?.ok
                  ? `Opérationnel · réponse en ${status.data.ms} ms`
                  : 'Serveur injoignable : vérifiez votre connexion'}
            </div>
          </div>
        </div>
      </div>

      {/* Guides rapides */}
      <div className="card mb-4 p-5">
        <h3 className="mb-3 font-display font-bold text-content">Guides rapides</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((g) => (
            <Link key={g.to} to={g.to} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-primary/50 hover:bg-primary/5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><g.icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-content">{g.label}</span>
                <span className="block text-xs text-content-muted">{g.hint}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-content-faint" />
            </Link>
          ))}
        </div>
        <div className="mt-3">
          <WatchDemoCard compact />
        </div>
      </div>

      {/* Base de connaissances par thème */}
      <div className="card mb-4 p-5">
        <h3 className="mb-3 font-display font-bold text-content">{tr('ui.SupportPage.questionsFrequentes')}</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          {HELP_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={clsx(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                cat === c.key ? 'border-primary bg-primary text-white' : 'border-line text-content-muted hover:border-primary/50',
              )}
            >
              {c.label} <span className="opacity-70">· {c.articles.length}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {category.articles.map((a) => (
            <Article key={a.q} a={a} open={openQ === a.q} onToggle={() => setOpenQ((o) => (o === a.q ? null : a.q))} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Formulaire */}
        <div className="card p-5 lg:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold text-content">{tr('ui.SupportPage.envoyerUneDemande')}</h3>
          </div>
          {sent ? (
            <div className="grid place-items-center py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="mt-3 font-display text-lg font-bold text-content">{tr('ui.SupportPage.demandeEnvoyee')}</p>
              <p className="mt-1 text-sm text-content-muted">{tr('ui.SupportPage.notreEquipeVousRepondraDans')} Suivez-la dans « Mes demandes ».</p>
              <Button variant="outline" className="mt-5" onClick={() => setSent(false)}>{tr('ui.SupportPage.nouvelleDemande')}</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Thème">
                  <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
                    {TOPICS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Urgence">
                  <div className="flex gap-2">
                    {[false, true].map((u) => (
                      <button
                        key={String(u)}
                        type="button"
                        onClick={() => setUrgent(u)}
                        className={clsx(
                          'input flex-1 text-sm font-medium',
                          urgent === u && (u ? 'border-danger text-danger' : 'border-primary text-primary'),
                        )}
                      >
                        {u ? 'Bloque mon travail' : 'Normale'}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <Field label={tr('ui.SupportPage.sujet')}>
                <input className="input" placeholder={tr('ui.SupportPage.exProblemeDEncaissement')} {...register('subject')} />
                {errors.subject && <p className="mt-1 text-xs text-danger">{trFr(errors.subject.message)}</p>}
              </Field>
              <Field label="Message">
                <textarea
                  className="input min-h-[140px]"
                  placeholder="Décrivez ce que vous faisiez, ce qui s’est passé et ce que vous attendiez…"
                  {...register('message')}
                />
                {errors.message && <p className="mt-1 text-xs text-danger">{trFr(errors.message.message)}</p>}
              </Field>
              <label className="flex items-start gap-2 text-sm text-content-muted">
                <input type="checkbox" className="mt-1" checked={withTech} onChange={(e) => setWithTech(e.target.checked)} />
                <span>Joindre les infos techniques (page, navigateur, écran, connexion) pour aider le support à comprendre plus vite. Aucune donnée client n’est envoyée.</span>
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" loading={isSubmitting}>
                <Send className="h-4 w-4" /> {tr('ui.SupportPage.envoyer')}
              </Button>
            </form>
          )}
        </div>

        {/* Mes demandes */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold text-content">Mes demandes</h3>
          </div>
          {!myTickets?.length ? (
            <p className="rounded-xl bg-surface-2 p-4 text-sm text-content-muted">Vous n’avez encore envoyé aucune demande.</p>
          ) : (
            <ul className="space-y-2">
              {myTickets.map((t) => (
                <li key={t.id} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-content">{t.subject}</p>
                    <span className="shrink-0 whitespace-nowrap">
                      <Badge tone={t.status === 'CLOSED' ? 'success' : 'warning'}>{t.status === 'CLOSED' ? 'Traitée' : 'En cours'}</Badge>
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-content-faint">
                    Envoyée le {new Date(t.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
