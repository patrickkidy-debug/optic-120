import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2, MessageCircle, PhoneOff, RotateCcw, Save } from 'lucide-react';
import { RENEWAL_TEMPLATE_MAX, RENEWAL_TEMPLATE_VARIABLES } from '@oculo/shared-types';
import {
  getRenewalTemplate,
  listRenewals,
  recordRenewalReminder,
  resetRenewalTemplate,
  saveRenewalTemplate,
  type RenewalRow,
} from '../../features/billing/api';
import { waLink } from '../../lib/whatsapp';
import { apiErrorMessage } from '../../lib/api';
import { Badge, Button, EmptyState, PageLoader } from '../../components/ui';
import {
  STATUS_LABEL,
  URGENCY_TONE,
  describeDelay,
  describeLastReminder,
  remindedToday,
  renderRenewalMessage,
  urgencyOf,
} from './renewals';

const WINDOWS = [3, 7, 15, 30] as const;
const EXPIRED_LOOKBACK_DAYS = 30;

/**
 * Relances de renouvellement.
 *
 * Chaque envoi ouvre WhatsApp avec le message déjà rédigé : le fondateur appuie
 * sur Envoyer dans WhatsApp. C'est le fonctionnement de tous les messages
 * WhatsApp d'OculoSaaS — aucune API ni quota — et l'écran le dit clairement,
 * pour que « relancé » ne soit jamais lu comme « reçu ».
 */
export function RenewalsTab() {
  const qc = useQueryClient();
  const [within, setWithin] = useState<number>(7);
  const [includeExpired, setIncludeExpired] = useState(true);
  const [hideDone, setHideDone] = useState(false);
  const [trackError, setTrackError] = useState('');

  const activationUrl = `${window.location.origin}/activer`;

  const {
    data: rows,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['platform-renewals', within, includeExpired],
    queryFn: () => listRenewals(within, includeExpired ? EXPIRED_LOOKBACK_DAYS : 0),
  });

  const { data: tpl } = useQuery({ queryKey: ['platform-renewal-template'], queryFn: getRenewalTemplate });
  const template = tpl?.template ?? '';

  const reminderMut = useMutation({
    mutationFn: (row: RenewalRow) => recordRenewalReminder(row.tenantId, row.msLeft),
    onSuccess: () => {
      setTrackError('');
      qc.invalidateQueries({ queryKey: ['platform-renewals'] });
    },
    // WhatsApp est déjà ouvert à ce stade : l'échec ne concerne que le suivi.
    // On le dit, sans prétendre que le message n'est pas parti.
    onError: (e) =>
      setTrackError(
        `WhatsApp a bien été ouvert, mais la relance n'a pas pu être enregistrée : ${apiErrorMessage(e)}`,
      ),
  });

  function send(row: RenewalRow) {
    const link = waLink(row.whatsapp);
    if (!link || !template) return;
    const text = renderRenewalMessage(template, row, activationUrl);
    // Ouverture SYNCHRONE, dans le geste de clic : ouverte après un `await`,
    // la fenêtre serait bloquée par le navigateur comme popup non sollicitée.
    window.open(`${link}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    reminderMut.mutate(row);
  }

  const all = rows ?? [];
  const visible = hideDone ? all.filter((r) => !remindedToday(r.lastReminderAt)) : all;
  const stats = useMemo(
    () => ({
      total: all.length,
      expired: all.filter((r) => r.msLeft < 0).length,
      noPhone: all.filter((r) => !waLink(r.whatsapp)).length,
      doneToday: all.filter((r) => remindedToday(r.lastReminderAt)).length,
    }),
    [all],
  );

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h3 className="font-display text-base font-bold text-content">Abonnements à renouveler</h3>
            <p className="mt-0.5 text-sm text-content-muted">
              Relancez sur WhatsApp les établissements dont l'abonnement arrive à échéance. Chaque bouton
              ouvre WhatsApp avec le message déjà rédigé : il vous reste à appuyer sur Envoyer.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-content-muted">Échéance dans les</span>
          {WINDOWS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setWithin(d)}
              aria-pressed={within === d}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                within === d
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
              }`}
            >
              {d} jours
            </button>
          ))}
          <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-sm text-content-muted">
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={(e) => setIncludeExpired(e.target.checked)}
            />
            Inclure les échus depuis {EXPIRED_LOOKBACK_DAYS} jours
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-content-muted">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            Masquer ceux relancés aujourd'hui
          </label>
        </div>

        {rows && rows.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="badge bg-surface-3 text-content-muted">{stats.total} à suivre</span>
            {stats.expired > 0 && (
              <span className="badge bg-[color:var(--danger)]/15 text-danger">{stats.expired} déjà échus</span>
            )}
            <span className="badge bg-[color:var(--success)]/15 text-success">
              {stats.doneToday} relancés aujourd'hui
            </span>
            {stats.noPhone > 0 && (
              <span className="badge bg-[color:var(--warning)]/15 text-warning">
                {stats.noPhone} sans numéro WhatsApp
              </span>
            )}
          </div>
        )}
      </div>

      {trackError && (
        <p className="rounded-lg bg-[color:var(--warning)]/10 px-3 py-2 text-sm text-warning">{trackError}</p>
      )}

      {isError ? (
        <div className="card grid place-items-center p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
          <p className="mt-3 font-medium text-content">Impossible de charger les échéances</p>
          <p className="mt-1 text-sm text-content-muted">{apiErrorMessage(error)}</p>
          <Button className="mt-4" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </div>
      ) : isLoading ? (
        <PageLoader />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={all.length === 0 ? 'Aucune échéance proche' : 'Tout le monde a été relancé aujourd’hui'}
          hint={
            all.length === 0
              ? `Aucun abonnement n'arrive à échéance dans les ${within} prochains jours.`
              : 'Décochez « Masquer ceux relancés aujourd’hui » pour les revoir.'
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Établissement</th>
                <th className="table-cell font-semibold">Offre</th>
                <th className="table-cell font-semibold">Échéance</th>
                <th className="table-cell font-semibold">Dernière relance</th>
                <th className="table-cell text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const urgency = urgencyOf(r.msLeft);
                const hasPhone = Boolean(waLink(r.whatsapp));
                const doneToday = remindedToday(r.lastReminderAt);
                return (
                  <tr key={r.tenantId} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell">
                      <p className="font-medium text-content">{r.tenantName}</p>
                      <p className="text-xs text-content-faint">{r.whatsapp || 'Aucun numéro'}</p>
                    </td>
                    <td className="table-cell">
                      <p className="text-content">{r.planName}</p>
                      <p className="text-xs text-content-faint">{STATUS_LABEL[r.status] ?? r.status}</p>
                    </td>
                    <td className="table-cell">
                      <Badge tone={URGENCY_TONE[urgency]}>Échéance {describeDelay(r.msLeft)}</Badge>
                      <p className="mt-0.5 text-xs text-content-faint">
                        {new Date(r.currentPeriodEnd).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </td>
                    <td className="table-cell">
                      <p className={doneToday ? 'text-success' : 'text-content-muted'}>
                        {doneToday && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                        {describeLastReminder(r.lastReminderAt)}
                      </p>
                      {r.reminderCount > 1 && (
                        <p className="text-xs text-content-faint">{r.reminderCount} relances au total</p>
                      )}
                    </td>
                    <td className="table-cell text-right">
                      {hasPhone ? (
                        <Button
                          variant={doneToday ? 'outline' : undefined}
                          onClick={() => send(r)}
                          disabled={!template}
                        >
                          <MessageCircle className="h-4 w-4" />
                          {doneToday ? 'Relancer à nouveau' : 'Envoyer sur WhatsApp'}
                        </Button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs text-content-faint"
                          title="Aucun numéro WhatsApp n'a été renseigné à l'inscription"
                        >
                          <PhoneOff className="h-3.5 w-3.5" aria-hidden="true" /> Pas de numéro
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TemplateEditor preview={visible[0] ?? all[0]} activationUrl={activationUrl} />
    </div>
  );
}

/** Modèle de message, partagé entre opérateurs et conservé côté serveur. */
function TemplateEditor({ preview, activationUrl }: { preview?: RenewalRow; activationUrl: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['platform-renewal-template'], queryFn: getRenewalTemplate });
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (data && !dirty) setDraft(data.template);
  }, [data, dirty]);

  const onSaved = (r: { template: string }) => {
    qc.setQueryData(['platform-renewal-template'], r);
    setDraft(r.template);
    setDirty(false);
  };

  const saveMut = useMutation({
    mutationFn: () => saveRenewalTemplate(draft),
    onSuccess: (r) => {
      onSaved(r);
      setFeedback({ tone: 'success', text: 'Message enregistré.' });
    },
    onError: (e) => setFeedback({ tone: 'danger', text: apiErrorMessage(e) }),
  });

  const resetMut = useMutation({
    mutationFn: resetRenewalTemplate,
    onSuccess: (r) => {
      onSaved(r);
      setFeedback({ tone: 'success', text: 'Message par défaut rétabli.' });
    },
    onError: (e) => setFeedback({ tone: 'danger', text: apiErrorMessage(e) }),
  });

  /** Insère la variable à la position du curseur, pas en fin de texte. */
  function insert(key: string) {
    const el = ref.current;
    const token = `{${key}}`;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + token + draft.slice(end));
    setDirty(true);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="card p-4">
      <h3 className="font-display text-base font-bold text-content">Message de relance</h3>
      <p className="mb-3 text-xs text-content-faint">
        Partagé par tous les opérateurs. Les variables entre accolades sont remplacées pour chaque
        établissement.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <textarea
            ref={ref}
            className="input min-h-[190px] font-mono text-sm"
            value={draft}
            maxLength={RENEWAL_TEMPLATE_MAX}
            aria-label="Message de relance"
            onChange={(e) => {
              setDraft(e.target.value);
              setDirty(true);
              setFeedback(null);
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-content-faint">
            <span>*gras* et _italique_ sont interprétés par WhatsApp.</span>
            <span>
              {draft.length}/{RENEWAL_TEMPLATE_MAX}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {RENEWAL_TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insert(v.key)}
                title={v.label}
                className="rounded-md bg-surface-2 px-2 py-1 font-mono text-xs text-content-muted hover:bg-surface-3 hover:text-content"
              >
                {`{${v.key}}`}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => saveMut.mutate()}
              loading={saveMut.isPending}
              disabled={!dirty || draft.trim().length === 0}
            >
              <Save className="h-4 w-4" /> Enregistrer
            </Button>
            <Button
              variant="ghost"
              onClick={() => resetMut.mutate()}
              loading={resetMut.isPending}
              disabled={data?.isDefault && !dirty}
            >
              <RotateCcw className="h-4 w-4" /> Message par défaut
            </Button>
          </div>
          {feedback && (
            <p className={`mt-2 text-sm ${feedback.tone === 'success' ? 'text-success' : 'text-danger'}`}>
              {feedback.text}
            </p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-content-muted">
            Aperçu {preview ? `— ${preview.tenantName}` : ''}
          </p>
          {preview ? (
            <div className="whitespace-pre-wrap rounded-xl bg-[#dcf8c6] p-3 text-sm text-[#111b21] shadow-sm">
              {renderRenewalMessage(draft, preview, activationUrl)}
            </div>
          ) : (
            <p className="rounded-xl bg-surface-2 p-3 text-sm text-content-muted">
              L'aperçu s'affiche dès qu'un établissement est à relancer.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
